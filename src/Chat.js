import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import io from 'socket.io-client';
import Sidebar from './Sidebar';
import './Chat.css';
import { encryptData, decryptData, importKey, encryptFile, decryptFile, generateECDHKeyPair, deriveSharedSecret } from './utils/crypto';
import { getRelativeTime, compressImage, addRecentConversation, getRoomName } from './utils/helpers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EmojiPicker from 'emoji-picker-react';
import ChatHistoryModal from './ChatHistoryModal';
import LinkPreview, { extractUrls } from './LinkPreview';
import UserProfileModal from './UserProfileModal';
import VoiceMessage, { VoicePlayback } from './VoiceMessage';
import CryptoLog, { addCryptoLog } from './CryptoLog';
import { API_BASE, SOCKET_URL } from './config';

// ── Constants ────────────────────────────────────────────────────────────────
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const AVATAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
const avatarColor = (s) => AVATAR_COLORS[(s?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
const PAGE_SIZE = 50;

const Chat = ({ token, username }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  // Core state
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showAuditId, setShowAuditId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [expiryMinutes, setExpiryMinutes] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sessionKeyPair, setSessionKeyPair] = useState(null);
  const [handshakeReady, setHandshakeReady] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showToast, setShowToast] = useState('');

  // New feature state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [hoverMessageId, setHoverMessageId] = useState(null);
  const [showReactionPickerFor, setShowReactionPickerFor] = useState(null);
  const [profileModal, setProfileModal] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roomOwner, setRoomOwner] = useState(null);
  const [roomParticipants, setRoomParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);

  // Refs
  const messagesEndRef = useRef(null);
  const messagesTopRef = useRef(null);
  const chatBodyRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const sharedSecretRef = useRef(null);
  const isAtBottomRef = useRef(true);

  const isRoomMode = !!roomId;
  const roomDisplayName = isRoomMode ? getRoomName(roomId) : null;

  // ── Toast ────────────────────────────────────────────────────────────────
  const toast = (msg, dur = 2500) => { setShowToast(msg); setTimeout(() => setShowToast(''), dur); };

  // ── Scroll detection ─────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = bottom < 80;
    setShowScrollToBottom(bottom > 200);
    if (isAtBottomRef.current) setUnreadCount(0);
    // Infinite scroll: load older at top
    if (el.scrollTop < 60 && hasMore && !loadingMore) loadOlderMessages();
  }, [hasMore, loadingMore]);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // ── Share Room ───────────────────────────────────────────────────────────
  const handleShareRoom = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => toast('🔗 Room link copied!')).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      toast('🔗 Link copied!');
    });
  };

  // ── PFS Key Pair ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRoomMode && selectedUser) {
      const init = async () => {
        const keys = await generateECDHKeyPair();
        setSessionKeyPair(keys); setHandshakeReady(false); sharedSecretRef.current = null;
      };
      init();
      addRecentConversation(selectedUser);
    }
  }, [selectedUser, isRoomMode]);

  // ── Crypto helpers ───────────────────────────────────────────────────────
  const generateAESKey = () => {
    addCryptoLog('Generating random 256-bit AES key...', 'info');
    return CryptoJS.lib.WordArray.random(32).toString();
  };
  const deriveRoomKey = (id) => {
    addCryptoLog(`Deriving room key using SHA-256(${id})...`, 'system');
    return CryptoJS.SHA256(id).toString();
  };
  const encryptAES = (text, key) => {
    addCryptoLog('Encrypting payload with AES-256-CBC...', 'info');
    const encrypted = CryptoJS.AES.encrypt(text, key).toString();
    addCryptoLog('Payload successfully encrypted.', 'success');
    return encrypted;
  };
  const decryptAES = (enc, key) => {
    try {
      addCryptoLog('Attempting AES-256 decryption...', 'info');
      const decrypted = CryptoJS.AES.decrypt(enc, key).toString(CryptoJS.enc.Utf8) || null;
      if (decrypted) addCryptoLog('Decryption successful.', 'success');
      return decrypted;
    }
    catch {
      addCryptoLog('Decryption failed! Invalid key or corrupted data.', 'error');
      return null;
    }
  };

  // ── Typing ───────────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    if (!socketRef.current) return;
    socketRef.current.emit('typing', { roomId: isRoomMode ? roomId : null, recipientUsername: isRoomMode ? null : selectedUser?.username });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stopTyping', { roomId: isRoomMode ? roomId : null, recipientUsername: isRoomMode ? null : selectedUser?.username });
    }, 2000);
  };

  const onEmojiClick = (emojiObj) => { setMessageInput(prev => prev + emojiObj.emoji); setShowEmojiPicker(false); };

  const handleFileChange = async (e) => {
    let file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File size exceeds 5MB.'); e.target.value = null; return; }
    if (file.type.startsWith('image/')) file = await compressImage(file);
    setSelectedFile(file);
  };

  // ── Send Message ─────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if ((!messageInput.trim() && !selectedFile) || isSending) return;
    setIsSending(true);
    try {
      let payload = {};
      const replyToId = replyingTo?._id || null;

      if (isRoomMode) {
        const sessionKey = deriveRoomKey(roomId);
        const encMsg = encryptAES(messageInput || (selectedFile ? `Shared a file: ${selectedFile.name}` : ''), sessionKey);
        let fileData = null;
        if (selectedFile) fileData = await encryptFile(selectedFile, sessionKey);
        payload = { roomId, encryptedMessage: encMsg, encryptedKey: 'ROOM_KEY', expiryMinutes: expiryMinutes > 0 ? expiryMinutes : null, encryptedFileData: fileData, fileName: selectedFile?.name, fileType: selectedFile?.type, replyTo: replyToId };
      } else if (selectedUser) {
        addCryptoLog(`Requesting Public Key for ${selectedUser.username}...`, 'system');
        const keyRes = await axios.get(`${API_BASE}/users/${selectedUser.username}/key`);
        const recvPub = keyRes.data.publicKey;
        if (!recvPub) throw new Error('User public key not found!');
        addCryptoLog(`Public Key Received: ${recvPub.slice(0, 30)}...`, 'success');

        const sessionKey = generateAESKey();
        const encMsg = encryptAES(messageInput || (selectedFile ? `Shared a file: ${selectedFile.name}` : ''), sessionKey);
        let fileData = null;
        if (selectedFile) {
          addCryptoLog(`Encrypting file: ${selectedFile.name}...`, 'info');
          fileData = await encryptFile(selectedFile, sessionKey);
          addCryptoLog('File encryption complete.', 'success');
        }

        addCryptoLog('Importing RSA-OAEP public key...', 'info');
        const importedPub = await importKey(recvPub, 'public');
        addCryptoLog('Wrapping AES key with RSA-2048...', 'info');
        const encKey = await encryptData(importedPub, sessionKey);
        addCryptoLog('Hybrid encryption handshake complete.', 'success');

        payload = { receiverUsername: selectedUser.username, encryptedMessage: encMsg, encryptedKey: encKey, expiryMinutes: expiryMinutes > 0 ? expiryMinutes : null, encryptedFileData: fileData, fileName: selectedFile?.name, fileType: selectedFile?.type, replyTo: replyToId };
      }
      await axios.post(`${API_BASE}/messages`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setMessageInput(''); setSelectedFile(null); setReplyingTo(null);
      if (fileInputRef.current) fileInputRef.current.value = null;
      setExpiryMinutes(0);
      socketRef.current?.emit('stopTyping', { roomId: isRoomMode ? roomId : null, recipientUsername: isRoomMode ? null : selectedUser?.username });
    } catch (err) {
      alert(`Error: ${err.response?.data?.message || err.message}`);
    } finally { setIsSending(false); }
  };

  // ── Send Voice Message ───────────────────────────────────────────────────
  const sendVoiceMessage = async (blob) => {
    setShowVoiceRecorder(false);
    setIsSending(true);
    try {
      const voiceFile = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type });
      let payload = {};
      const fakeText = '🎙️ Voice Message';
      if (isRoomMode) {
        const sessionKey = deriveRoomKey(roomId);
        const encMsg = encryptAES(fakeText, sessionKey);
        const fileData = await encryptFile(voiceFile, sessionKey);
        payload = { roomId, encryptedMessage: encMsg, encryptedKey: 'ROOM_KEY', encryptedFileData: fileData, fileName: voiceFile.name, fileType: voiceFile.type };
      } else if (selectedUser) {
        const keyRes = await axios.get(`${API_BASE}/users/${selectedUser.username}/key`);
        const sessionKey = generateAESKey();
        const encMsg = encryptAES(fakeText, sessionKey);
        const fileData = await encryptFile(voiceFile, sessionKey);
        const importedPub = await importKey(keyRes.data.publicKey, 'public');
        const encKey = await encryptData(importedPub, sessionKey);
        payload = { receiverUsername: selectedUser.username, encryptedMessage: encMsg, encryptedKey: encKey, encryptedFileData: fileData, fileName: voiceFile.name, fileType: voiceFile.type };
      }
      await axios.post(`${API_BASE}/messages`, payload, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) { alert(`Voice send failed: ${err.message}`); }
    finally { setIsSending(false); }
  };

  // ── Edit Message ─────────────────────────────────────────────────────────
  const startEdit = (msg) => { setEditingMessageId(msg._id); setEditInput(msg.decrypted || ''); setShowReactionPickerFor(null); };
  const submitEdit = async (msg) => {
    if (!editInput.trim()) return;
    try {
      let encMsg;
      if (isRoomMode) encMsg = encryptAES(editInput, deriveRoomKey(roomId));
      else encMsg = encryptAES(editInput, generateAESKey());
      await axios.put(`${API_BASE}/messages/${msg._id}`, { encryptedMessage: encMsg }, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, decrypted: editInput, isEdited: true, editedAt: new Date() } : m));
      setEditingMessageId(null); toast('✏️ Message edited');
    } catch (err) { alert(err.response?.data?.message || 'Edit failed'); }
  };

  // ── Delete Message ───────────────────────────────────────────────────────
  const deleteMessage = async (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await axios.delete(`${API_BASE}/messages/${msgId}`, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(prev => prev.map(m => m._id === msgId ? { ...m, isDeleted: true, decrypted: '' } : m));
      toast('🗑️ Message deleted');
    } catch (err) { alert(err.response?.data?.message || 'Delete failed'); }
  };

  // ── React to Message ─────────────────────────────────────────────────────
  const reactToMessage = async (msgId, emoji) => {
    console.log('Reacting to:', msgId, emoji);
    if (!msgId) { console.error('No message ID'); return; }
    try {
      const res = await axios.post(`${API_BASE}/messages/${msgId}/react`, { emoji }, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(prev => prev.map(m => m._id === msgId ? { ...m, reactions: res.data.reactions } : m));
      setShowReactionPickerFor(null);
    } catch (err) {
      console.error('Reaction failed:', err);
      alert(`Reaction failed: ${err.response?.data?.message || err.message}`);
    }
  };

  // ── Pin Message ───────────────────────────────────────────────────────────
  const pinMessage = async (msgId) => {
    try {
      await axios.post(`${API_BASE}/messages/${msgId}/pin`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(prev => prev.map(m => m._id === msgId ? { ...m, pinned: !m.pinned } : m));
      if (isRoomMode) fetchPinnedMessages();
      toast('📌 Message pin toggled');
    } catch (err) { console.error('Pin failed:', err); }
  };

  // ── Room Admin Actions ───────────────────────────────────────────────────
  const kickUser = async (targetUsername) => {
    if (!window.confirm(`Kick ${targetUsername} from the room?`)) return;
    try {
      await axios.post(`${API_BASE}/rooms/${roomId}/kick`, { username: targetUsername }, { headers: { Authorization: `Bearer ${token}` } });
      toast(`👞 Kicked ${targetUsername}`);
    } catch (err) { alert(err.response?.data?.message || 'Kick failed'); }
  };

  const banUser = async (targetUsername) => {
    if (!window.confirm(`BAN ${targetUsername} from this room permanently?`)) return;
    try {
      await axios.post(`${API_BASE}/rooms/${roomId}/ban`, { username: targetUsername }, { headers: { Authorization: `Bearer ${token}` } });
      toast(`🚫 Banned ${targetUsername}`);
    } catch (err) { alert(err.response?.data?.message || 'Ban failed'); }
  };

  // ── Fetch Pinned Messages ─────────────────────────────────────────────────
  const fetchPinnedMessages = useCallback(async () => {
    if (!isRoomMode) return;
    try {
      const res = await axios.get(`${API_BASE}/messages/pinned?roomId=${roomId}`, { headers: { Authorization: `Bearer ${token}` } });
      setPinnedMessages(res.data);
    } catch { }
  }, [isRoomMode, roomId, token]);

  // ── Decryption ───────────────────────────────────────────────────────────
  const decryptMessageContent = useCallback(async (msg) => {
    try {
      let aesKey = null;
      if (msg.roomId) {
        aesKey = deriveRoomKey(msg.roomId);
      } else {
        if (msg.ephemeralPublicKey && sessionKeyPair && !sharedSecretRef.current) {
          if (msg.sender?.username !== username) {
            try { sharedSecretRef.current = await deriveSharedSecret(sessionKeyPair.privateKey, msg.ephemeralPublicKey); setHandshakeReady(true); }
            catch (e) { console.error('PFS error', e); }
          }
        }
        if (msg.sender?.username === username) return { text: msg.decrypted || '** Private Message Sent **' };
        if (msg.encryptedKey?.startsWith('PFS:') && sharedSecretRef.current) {
          try {
            const combined = new Uint8Array(window.atob(msg.encryptedKey.replace('PFS:', '')).split('').map(c => c.charCodeAt(0)));
            const sk = await window.crypto.subtle.importKey('raw', sharedSecretRef.current, 'AES-GCM', false, ['decrypt']);
            const dec = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, sk, combined.slice(12).buffer);
            aesKey = new TextDecoder().decode(dec);
          } catch (e) { console.error('PFS decrypt fail', e); }
        }
        if (!aesKey) {
          addCryptoLog('AES key not found in cache. Retrieving Local RSA Private Key...', 'warning');
          const priv = localStorage.getItem('privateKey');
          if (!priv) {
            addCryptoLog('CRITICAL: Private Key Missing!', 'error');
            return { text: 'Private key missing' };
          }
          addCryptoLog('Unwrapping AES key with RSA Private Key...', 'info');
          const importedPriv = await importKey(priv, 'private');
          aesKey = await decryptData(importedPriv, msg.encryptedKey);
          addCryptoLog('AES key successfully unwrapped.', 'success');
        }
      }
      const text = decryptAES(msg.encryptedMessage, aesKey);
      let fileUrl = null;
      if (msg.encryptedFileData && text) { // Only decrypt file if we successfully decrypted the key
        const blob = await decryptFile(msg.encryptedFileData, aesKey, msg.fileType);
        fileUrl = URL.createObjectURL(blob);
      }
      return { text, fileUrl };
    } catch (err) { console.error('Decrypt error:', err); return null; }
  }, [username]); // eslint-disable-line

  // ── Fetch Messages with Pagination ───────────────────────────────────────
  const fetchMessages = useCallback(async (pg = 1, prepend = false) => {
    try {
      if (pg === 1 || prepend) setLoadingMore(prepend);
      const url = isRoomMode
        ? `${API_BASE}/messages?roomId=${roomId}&page=${pg}&limit=${PAGE_SIZE}`
        : `${API_BASE}/messages?page=${pg}&limit=${PAGE_SIZE}`;

      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      let all = res.data.messages ?? res.data;
      if (Array.isArray(res.data)) all = res.data;

      if (!isRoomMode && selectedUser) {
        all = all.filter(m =>
          (m.sender?.username === selectedUser.username && m.receiver?.username === username) ||
          (m.sender?.username === username && m.receiver?.username === selectedUser.username)
        );
      } else if (!isRoomMode && !selectedUser) { setMessages([]); return; }

      setHasMore(res.data.hasMore ?? false);

      const decrypted = await Promise.all(all.map(async (msg) => {
        const c = await decryptMessageContent(msg);
        return { ...msg, decrypted: c?.text, decryptedFileUrl: c?.fileUrl, error: c ? null : 'Decryption Failed' };
      }));

      if (prepend) {
        setMessages(prev => [...decrypted, ...prev]);
        setTimeout(() => { if (chatBodyRef.current) chatBodyRef.current.scrollTop = 1; }, 50);
      } else {
        setMessages(decrypted);
        setTimeout(() => scrollToBottom('auto'), 100);
      }
    } catch (err) { console.error('Fetch messages error:', err); }
    finally { setLoadingMore(false); }
  }, [token, selectedUser, username, isRoomMode, roomId, decryptMessageContent]);

  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchMessages(nextPage, true);
  }, [page, hasMore, loadingMore, fetchMessages]);

  useEffect(() => { fetchMessages(1); setPage(1); }, [fetchMessages]);
  useEffect(() => { fetchPinnedMessages(); }, [fetchPinnedMessages]);

  useEffect(() => {
    if (isRoomMode) {
      axios.get(`${API_BASE}/rooms/${roomId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setRoomOwner(res.data.ownerUsername))
        .catch(() => { });
    } else {
      setRoomOwner(null);
    }
  }, [isRoomMode, roomId, token]);

  // ── Auto mark read ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    messages.forEach(msg => {
      if (msg.sender?.username !== username && msg._id && !(msg.readBy || []).includes(username)) {
        axios.post(`${API_BASE}/messages/${msg._id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => { });
      }
    });
  }, [messages.length, token, username]); // eslint-disable-line

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const sock = io(SOCKET_URL);
    socketRef.current = sock;
    if (isRoomMode) sock.emit('joinRoom', roomId);
    else sock.emit('register', username);

    sock.on('userTyping', ({ username: u }) => setTypingUsers(p => ({ ...p, [u]: true })));
    sock.on('userStoppedTyping', ({ username: u }) => setTypingUsers(p => { const n = { ...p }; delete n[u]; return n; }));

    sock.on('newMessage', async (message) => {
      let ok = false;
      if (isRoomMode && message.roomId === roomId) ok = true;
      if (!isRoomMode && selectedUser &&
        ((message.sender?.username === selectedUser.username && message.receiver?.username === username) ||
          (message.sender?.username === username && message.receiver?.username === selectedUser.username)) && !message.roomId) ok = true;

      if (ok) {
        // Prevent dupes
        setMessages(prev => {
          if (prev.find(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        const dec = await decryptMessageContent(message);
        setMessages(prev => prev.map(m => m._id === message._id ? { ...m, decrypted: dec?.text, decryptedFileUrl: dec?.fileUrl, error: dec ? null : 'Decryption Failed' } : m));

        if (message.sender?.username !== username) {
          if (!isAtBottomRef.current) setUnreadCount(c => c + 1);
          sock.emit('messageRead', { messageId: message._id, senderUsername: message.sender?.username });
        }
        if (isAtBottomRef.current) setTimeout(() => scrollToBottom(), 80);
      }
    });

    sock.on('messageReaction', ({ messageId, reactions }) => setMessages(p => p.map(m => m._id === messageId ? { ...m, reactions } : m)));
    sock.on('messageEdited', () => fetchMessages(1));
    sock.on('messageDeleted', ({ messageId }) => setMessages(p => p.map(m => m._id === messageId ? { ...m, isDeleted: true, decrypted: '' } : m)));
    sock.on('messageRead', ({ messageId, readBy }) => setMessages(p => p.map(m => m._id === messageId ? { ...m, readBy } : m)));
    sock.on('messagePinned', () => { fetchPinnedMessages(); fetchMessages(1); });
    sock.on('messageStatusUpdate', ({ messageId, status }) => setMessages(p => p.map(m => m._id === messageId ? { ...m, status } : m)));

    // Room Admin listeners
    sock.on('roomParticipants', (list) => setRoomParticipants(list));
    sock.on('kicked', ({ roomId: rid }) => {
      if (rid === roomId) {
        alert('🚫 You have been kicked from this room.');
        navigate('/lobby');
      }
    });
    sock.on('banned', ({ roomId: rid }) => {
      if (rid === roomId) {
        alert('🚫 You have been banned from this room.');
        navigate('/lobby');
      }
    });

    return () => sock.disconnect();
  }, [username, selectedUser, isRoomMode, roomId, decryptMessageContent, fetchMessages, fetchPinnedMessages]);

  const toggleAudit = (id) => setShowAuditId(showAuditId === id ? null : id);
  const filteredMessages = messages.filter(m => m.decrypted?.toLowerCase().includes(searchQuery.toLowerCase()));

  // ── Render Helpers ──────────────────────────────────────────────────────
  const renderReadReceipt = (msg) => {
    if (msg.sender?.username !== username) return null;
    const others = (msg.readBy || []).filter(u => u !== username);
    if (others.length > 0) return <span className="read-receipt read" title={`Read by: ${others.join(', ')}`}>✓✓</span>;
    return <span className="read-receipt sent">✓</span>;
  };

  const renderReactions = (msg) => {
    const rxn = msg.reactions || {};
    const entries = Object.entries(rxn).filter(([, u]) => u.length > 0);
    if (entries.length === 0) return null;
    return (
      <div className="reaction-bar">
        {entries.map(([emoji, users]) => (
          <button key={emoji} className={`reaction-pill ${users.includes(username) ? 'own' : ''}`}
            onClick={(e) => { e.stopPropagation(); reactToMessage(msg._id, emoji); }} title={users.join(', ')}>
            {emoji} <span>{users.length}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderAvatar = (msg) => {
    const u = msg.sender?.username || '?';
    if (msg.sender?.profilePic) return <img src={msg.sender.profilePic} alt={u} className="msg-avatar" onClick={(e) => { e.stopPropagation(); setProfileModal(u); }} />;
    return <div className="msg-avatar fallback" style={{ background: avatarColor(u) }} onClick={(e) => { e.stopPropagation(); setProfileModal(u); }} title={`Profile: ${u}`}>{u.slice(0, 1).toUpperCase()}</div>;
  };

  const renderReplyQuote = (msg) => {
    if (!msg.replyTo) return null;
    const rt = msg.replyTo;
    const senderName = rt.sender?.username || 'Unknown';
    const orig = rt.decrypted || (rt.encryptedMessage ? '🔒 Encrypted' : rt.fileName ? `📎 ${rt.fileName}` : '...');
    return (
      <div className="reply-quote">
        <span className="reply-sender">{senderName}</span>
        <span className="reply-text">{orig.slice(0, 80)}{orig.length > 80 ? '…' : ''}</span>
      </div>
    );
  };

  return (
    <div className="chat-layout" onClick={() => { setShowReactionPickerFor(null); setHoverMessageId(null); }}>
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {!isRoomMode && (
        <div className={`sidebar-wrap ${sidebarOpen ? 'open' : ''}`}>
          <Sidebar onlineUsers={[]} onSelectUser={(u) => { setSelectedUser(u); setSidebarOpen(false); }} selectedUser={selectedUser} />
        </div>
      )}

      <div className="main-chat" style={{ width: isRoomMode ? '100%' : 'auto' }}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="chat-header">
          {!isRoomMode && (
            <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)} title="Toggle Contacts">☰</button>
          )}
          {isRoomMode ? (
            <div className="room-header">
              <button className="back-btn" onClick={() => navigate('/lobby')}>← Lobby</button>
              <div className="header-info">
                <h2>{roomDisplayName !== roomId ? `${roomDisplayName}` : `Room: ${roomId}`}</h2>
                <span className="secure-badge">End-to-End Encrypted</span>
              </div>
              <div className="header-actions">
                <button className={`icon-btn ${showPinnedList ? 'active' : ''}`} title="Pinned messages" onClick={(e) => { e.stopPropagation(); setShowPinnedList(o => !o); }}>
                  📌{pinnedMessages.length > 0 && <span className="pin-count">{pinnedMessages.length}</span>}
                </button>
                <button className={`icon-btn ${showParticipants ? 'active' : ''}`} title="Room Members" onClick={(e) => { e.stopPropagation(); setShowParticipants(!showParticipants); }}>
                  👥{roomParticipants.length > 0 && <span className="pin-count">{roomParticipants.length}</span>}
                </button>
                <button className="icon-btn" title="Search" onClick={(e) => { e.stopPropagation(); setShowSearch(!showSearch); }}>🔍</button>
                <button className="icon-btn" title="Chat history" onClick={(e) => { e.stopPropagation(); setShowHistory(true); }}>📖</button>
                <button className="icon-btn" title="Copy room link" onClick={(e) => { e.stopPropagation(); handleShareRoom(); }}>🔗</button>
                <button className="icon-btn" title="My Profile" onClick={(e) => { e.stopPropagation(); setProfileModal(username); }}>👤</button>
              </div>
            </div>
          ) : (
            selectedUser ? (
              <div className="header-user">
                <div className="avatar small" style={{ background: avatarColor(selectedUser.username), cursor: 'pointer' }} onClick={() => setProfileModal(selectedUser.username)}>
                  {selectedUser.username.charAt(0).toUpperCase()}
                </div>
                <div className="header-info">
                  <h2 style={{ cursor: 'pointer' }} onClick={() => setProfileModal(selectedUser.username)}>{selectedUser.username}</h2>
                  <span className="secure-badge">Direct Encryption Active</span>
                  {handshakeReady && <span className="pfs-badge">PFS Secured (ECDH)</span>}
                </div>
                <div className="header-actions">
                  <button className="icon-btn" title="Search messages" onClick={(e) => { e.stopPropagation(); setShowSearch(!showSearch); }}>🔍</button>
                  <button className="icon-btn" title="Chat history" onClick={(e) => { e.stopPropagation(); setShowHistory(true); }}>📖</button>
                  <button className="icon-btn" title="My Profile" onClick={(e) => { e.stopPropagation(); setProfileModal(username); }}>👤</button>
                </div>
              </div>
            ) : (
              <h2>Select a contact</h2>
            )
          )}
        </div>

        {/* ── Pinned Panel ─────────────────────────────────────── */}
        {showPinnedList && pinnedMessages.length > 0 && (
          <div className="pinned-panel" onClick={e => e.stopPropagation()}>
            <div className="pinned-panel-header">
              <span>📌 Pinned Messages ({pinnedMessages.length})</span>
              <button onClick={() => setShowPinnedList(false)}>✕</button>
            </div>
            {pinnedMessages.map(pm => (
              <div key={pm._id} className="pinned-item">
                <span className="pinned-sender">{pm.sender?.username}</span>
                <span className="pinned-text">{pm.decrypted || (pm.encryptedMessage ? '🔒 Encrypted Message' : pm.fileName)}</span>
                <span className="pinned-by">pinned by {pm.pinnedBy}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Participants Panel ─────────────────────────────────── */}
        {showParticipants && isRoomMode && (
          <div className="pinned-panel participants-panel" onClick={e => e.stopPropagation()}>
            <div className="pinned-panel-header">
              <span>👥 Room Members ({roomParticipants.length})</span>
              <button onClick={() => setShowParticipants(false)}>✕</button>
            </div>
            <div className="participants-list">
              {roomParticipants.map(u => (
                <div key={u} className="participant-item">
                  <div className="participant-info">
                    <div className="avatar micro" style={{ background: avatarColor(u) }}>{u.charAt(0).toUpperCase()}</div>
                    <span className="participant-name">{u} {roomOwner === u && <span className="owner-badge" title="Room Owner">👑</span>}</span>
                    {u === username && <span className="you-label">(You)</span>}
                  </div>
                  {roomOwner === username && u !== username && (
                    <div className="participant-actions">
                      <button className="action-btn-sm" onClick={() => kickUser(u)} title="Kick User">👞</button>
                      <button className="action-btn-sm danger" onClick={() => banUser(u)} title="Ban User">🚫</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Search bar ───────────────────────────────────────────────── */}
        {showSearch && (
          <div className="search-bar" onClick={e => e.stopPropagation()}>
            <input type="text" placeholder="Search messages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus />
            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}>Close</button>
          </div>
        )}

        {(isRoomMode || selectedUser) ? (
          <>
            <div className="chat-messages" ref={chatBodyRef} onScroll={handleScroll}>
              {loadingMore && <div className="load-more-spinner">Loading older messages…</div>}
              {hasMore && !loadingMore && (
                <div className="load-more-trigger" ref={messagesTopRef}>
                  <button className="load-more-btn" onClick={loadOlderMessages}>↑ Load older messages</button>
                </div>
              )}

              {filteredMessages.map((msg, index) => {
                const isOwn = msg.sender?.username === username;
                const msgId = msg._id || index;
                const isHovered = hoverMessageId === msgId;
                const isDeleted = msg.isDeleted;
                const isVoice = msg.fileType?.startsWith('audio/');

                return (
                  <div key={msgId} className={`message-bundle ${isOwn ? 'own' : 'other'}`}
                    onMouseEnter={() => setHoverMessageId(msgId)}
                    onMouseLeave={() => setHoverMessageId(null)}>

                    {!isOwn && renderAvatar(msg)}

                    <div className="message-bubble-wrap">
                      <div className={`message-bubble ${isOwn ? 'own' : 'other'} ${isDeleted ? 'deleted' : ''}`}>
                        <div className="message-content">
                          <div className="message-top">
                            <span className="message-sender" onClick={(e) => { e.stopPropagation(); setProfileModal(msg.sender?.username); }}>
                              {msg.sender?.username} {roomOwner === msg.sender?.username && <span className="owner-crown" title="Room Owner">👑</span>}
                            </span>
                            <button className="audit-toggle" onClick={(e) => { e.stopPropagation(); toggleAudit(msgId); }}>
                              {showAuditId === msgId ? 'Hide Audit' : 'Audit'}
                            </button>
                          </div>

                          {!isDeleted && renderReplyQuote(msg)}

                          <div className="message-text">
                            {isDeleted ? (
                              <span className="deleted-label">🗑️ This message was deleted</span>
                            ) : editingMessageId === msg._id ? (
                              <div className="edit-mode" onClick={e => e.stopPropagation()}>
                                <textarea className="edit-input" value={editInput}
                                  onChange={e => setEditInput(e.target.value)} rows={2} autoFocus
                                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg); } if (e.key === 'Escape') setEditingMessageId(null); }} />
                                <div className="edit-actions">
                                  <button className="edit-save" onClick={() => submitEdit(msg)}>Save</button>
                                  <button className="edit-cancel" onClick={() => setEditingMessageId(null)}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {isVoice ? (
                                  <VoicePlayback fileUrl={msg.decryptedFileUrl} />
                                ) : (
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.decrypted || 'Encrypted Content'}
                                  </ReactMarkdown>
                                )}
                                {msg.isEdited && <span className="edited-label"> (edited)</span>}
                                {msg.error && <span className="error-text"> ({msg.error})</span>}
                                {!isVoice && msg.decrypted && extractUrls(msg.decrypted).slice(0, 1).map(url => <LinkPreview key={url} url={url} />)}
                              </>
                            )}
                          </div>

                          {!isDeleted && !isVoice && msg.decryptedFileUrl && (
                            <div className="message-media">
                              {msg.fileType?.startsWith('image/') ? (
                                <img src={msg.decryptedFileUrl} alt="Secure Upload" className="chat-image" onClick={(e) => { e.stopPropagation(); /* openlightbox */ }} />
                              ) : (
                                <a href={msg.decryptedFileUrl} download={msg.fileName} className="file-link" onClick={e => e.stopPropagation()}>📎 {msg.fileName}</a>
                              )}
                            </div>
                          )}

                          <div className="message-status">
                            <span className="message-time" title={new Date(msg.createdAt || msg.timestamp || Date.now()).toLocaleString()}>
                              {getRelativeTime(msg.createdAt || msg.timestamp)}
                            </span>
                            {renderReadReceipt(msg)}
                          </div>
                        </div>
                      </div>

                      {!isDeleted && renderReactions(msg)}

                      {!isDeleted && (
                        <button
                          className={`quick-react-btn ${isOwn ? 'own' : 'other'} ${showReactionPickerFor === msgId ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setShowReactionPickerFor(prev => prev === msgId ? null : msgId); }}
                          title="Add reaction"
                        >
                          ＋
                        </button>
                      )}

                      {!isDeleted && isHovered && (
                        <div className={`msg-actions ${isOwn ? 'own' : 'other'}`} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                          <button className="msg-action-btn" title="Reply" onClick={() => setReplyingTo(msg)}>↩️</button>
                          <button className="msg-action-btn" title="React" onClick={() => setShowReactionPickerFor(prev => prev === msgId ? null : msgId)}>😊</button>
                          {isRoomMode && <button className="msg-action-btn" title="Pin" onClick={() => pinMessage(msg._id)}>📌</button>}
                          {isOwn && (
                            <>
                              <button className="msg-action-btn" title="Edit" onClick={() => startEdit(msg)}>✏️</button>
                              <button className="msg-action-btn delete" title="Delete" onClick={() => deleteMessage(msg._id)}>🗑️</button>
                            </>
                          )}
                        </div>
                      )}

                      {showReactionPickerFor === msgId && (
                        <div className={`reaction-picker ${isOwn ? 'own' : 'other'}`}
                          onClick={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}>
                          {REACTION_EMOJIS.map(e => (
                            <button key={e} className="reaction-emoji-btn"
                              onClick={(event) => { event.stopPropagation(); reactToMessage(msg._id, e); }}
                              onMouseDown={e => e.stopPropagation()}>
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {showAuditId === msgId && (
                      <div className="encryption-audit-box" onClick={e => e.stopPropagation()}>
                        <h4>🔐 Encryption Proof</h4>
                        <div className="audit-field"><label>Encrypted Payload:</label><div className="audit-value">{msg.encryptedMessage}</div></div>
                        <div className="audit-field"><label>Encrypted Key:</label><div className="audit-value">{msg.encryptedKey?.slice(0, 50)}…</div></div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {showScrollToBottom && (
              <button className="scroll-to-bottom" onClick={(e) => { e.stopPropagation(); scrollToBottom(); setUnreadCount(0); }}>
                ↓ {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
              </button>
            )}

            {replyingTo && (
              <div className="reply-bar">
                <div className="reply-bar-content">
                  <span className="reply-bar-label">↩️ Replying to <strong>{replyingTo.sender?.username}</strong></span>
                  <span className="reply-bar-text">{(replyingTo.decrypted || '').slice(0, 60)}{replyingTo.decrypted?.length > 60 ? '…' : ''}</span>
                </div>
                <button className="reply-bar-close" onClick={() => setReplyingTo(null)}>✕</button>
              </div>
            )}

            {showVoiceRecorder && (
              <div className="voice-recorder-wrap">
                <VoiceMessage onSend={sendVoiceMessage} onCancel={() => setShowVoiceRecorder(false)} />
              </div>
            )}

            <div className="chat-input-area" onClick={e => e.stopPropagation()}>
              <div className="input-toolbar">
                <div className="toolbar-left">
                  <select value={expiryMinutes} onChange={(e) => setExpiryMinutes(Number(e.target.value))} className="expiry-select">
                    <option value={0}>No Self-Destruct</option>
                    <option value={1}>1 Minute</option>
                    <option value={5}>5 Minutes</option>
                    <option value={60}>1 Hour</option>
                  </select>
                  {selectedFile && <span className="file-preview">📎 {selectedFile.name}</span>}
                </div>
                <span className="secure-hint">🔐 E2EE Active</span>
              </div>
              <div className="chat-input">
                <button className="emoji-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>😊</button>
                <button className="file-btn" onClick={() => fileInputRef.current.click()}>📎</button>
                <button className="voice-btn" onClick={() => setShowVoiceRecorder(v => !v)} title="Voice message">🎙️</button>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                {showEmojiPicker && (
                  <div className="emoji-picker-container">
                    <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" />
                  </div>
                )}
                <textarea value={messageInput} onChange={handleInputChange}
                  placeholder={isRoomMode ? `Message Room: ${roomDisplayName}…` : 'Type a secure message...'}
                  rows="1"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  disabled={isSending} />
                <button className="send-btn" onClick={sendMessage} disabled={(!messageInput.trim() && !selectedFile) || isSending}>
                  <span className="send-icon">{isSending ? '…' : '➤'}</span>
                </button>
              </div>
            </div>
            <CryptoLog />
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="empty-state">
              <span className="empty-icon">💬</span>
              <p>Search for a contact or join a room to start a secure conversation.</p>
            </div>
          </div>
        )}
      </div>

      {showHistory && (
        <ChatHistoryModal
          roomId={isRoomMode ? roomId : null}
          receiverUsername={!isRoomMode ? selectedUser?.username : null}
          token={token}
          username={username}
          onClose={() => setShowHistory(false)}
        />
      )}
      {profileModal && <UserProfileModal username={profileModal} currentUser={username} token={token} onClose={() => setProfileModal(null)} />}
      {showToast && <div className="copy-toast">{showToast}</div>}
    </div >
  );
};

export default Chat;
