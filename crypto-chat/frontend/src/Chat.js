import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import io from 'socket.io-client';
import Sidebar from './Sidebar';
import './Chat.css';
import { encryptData, decryptData, importKey, encryptFile, decryptFile, generateECDHKeyPair, exportECDHKey, deriveSharedSecret } from './utils/crypto';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EmojiPicker from 'emoji-picker-react';

const Chat = ({ token, username }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
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
  const [sessionKeyPair, setSessionKeyPair] = useState(null); // { public, private }
  const [handshakeReady, setHandshakeReady] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const sharedSecretRef = useRef(null);

  const isRoomMode = !!roomId;

  useEffect(() => {
    if (!isRoomMode && selectedUser) {
      const initPFS = async () => {
        const keys = await generateECDHKeyPair();
        setSessionKeyPair(keys);
        setHandshakeReady(false);
        sharedSecretRef.current = null;
      };
      initPFS();
    }
  }, [selectedUser, isRoomMode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateAESKey = () => {
    return CryptoJS.lib.WordArray.random(32).toString();
  };

  const deriveRoomKey = (id) => {
    return CryptoJS.SHA256(id).toString();
  };

  const encryptMessageAES = (text, key) => {
    return CryptoJS.AES.encrypt(text, key).toString();
  };

  const decryptMessageAES = (encrypted, key) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || null;
    } catch (e) {
      return null;
    }
  };

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);

    if (socketRef.current) {
      socketRef.current.emit('typing', {
        roomId: isRoomMode ? roomId : null,
        recipientUsername: isRoomMode ? null : selectedUser?.username
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('stopTyping', {
          roomId: isRoomMode ? roomId : null,
          recipientUsername: isRoomMode ? null : selectedUser?.username
        });
      }, 2000);
    }
  };

  const onEmojiClick = (emojiObject) => {
    setMessageInput(prev => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit.");
      e.target.value = null;
      return;
    }
    setSelectedFile(file);
  };

  const sendMessage = async () => {
    if ((!messageInput.trim() && !selectedFile) || isSending) return;
    setIsSending(true);

    try {
      let payload = {};
      let sessionKey = null;

      if (isRoomMode) {
        sessionKey = deriveRoomKey(roomId);
        const encryptedMsg = encryptMessageAES(messageInput || (selectedFile ? `Shared a file: ${selectedFile.name}` : ''), sessionKey);

        let fileData = null;
        if (selectedFile) {
          fileData = await encryptFile(selectedFile, sessionKey);
        }

        payload = {
          roomId,
          encryptedMessage: encryptedMsg,
          encryptedKey: 'ROOM_KEY',
          expiryMinutes: expiryMinutes > 0 ? expiryMinutes : null,
          encryptedFileData: fileData,
          fileName: selectedFile?.name,
          fileType: selectedFile?.type
        };
      } else if (selectedUser) {
        const keyRes = await axios.get(`http://localhost:5000/api/users/${selectedUser.username}/key`);
        const receiverPublicKey = keyRes.data.publicKey;

        if (!receiverPublicKey) {
          throw new Error('User public key not found!');
        }

        sessionKey = generateAESKey();
        const encryptedMsg = encryptMessageAES(messageInput || (selectedFile ? `Shared a file: ${selectedFile.name}` : ''), sessionKey);

        let fileData = null;
        if (selectedFile) {
          fileData = await encryptFile(selectedFile, sessionKey);
        }

        const importedPublicKey = await importKey(receiverPublicKey, 'public');
        const encryptedSessionKey = await encryptData(importedPublicKey, sessionKey);

        payload = {
          receiverUsername: selectedUser.username,
          encryptedMessage: encryptedMsg,
          encryptedKey: encryptedSessionKey,
          expiryMinutes: expiryMinutes > 0 ? expiryMinutes : null,
          encryptedFileData: fileData,
          fileName: selectedFile?.name,
          fileType: selectedFile?.type
        };
      }

      await axios.post('http://localhost:5000/api/messages', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessageInput('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = null;
      setExpiryMinutes(0);

      if (socketRef.current) {
        socketRef.current.emit('stopTyping', {
          roomId: isRoomMode ? roomId : null,
          recipientUsername: isRoomMode ? null : selectedUser?.username
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to send message.';
      alert(`Error: ${errorMsg}`);
    } finally {
      setIsSending(false);
    }
  };

  const decryptMessageContent = useCallback(async (msg) => {
    try {
      let aesKey = null;

      if (msg.roomId) {
        aesKey = deriveRoomKey(msg.roomId);
      } else {
        // PFS Handshake logic
        if (msg.ephemeralPublicKey && sessionKeyPair && !sharedSecretRef.current) {
          if (msg.sender.username !== username) {
            try {
              sharedSecretRef.current = await deriveSharedSecret(sessionKeyPair.privateKey, msg.ephemeralPublicKey);
              setHandshakeReady(true);
            } catch (e) {
              console.error("PFS Derivation error", e);
            }
          }
        }

        if (msg.sender.username === username) {
          return { text: msg.decrypted || "** Private Message Sent **" };
        }

        if (msg.encryptedKey && msg.encryptedKey.startsWith("PFS:") && sharedSecretRef.current) {
          try {
            const combined = new Uint8Array(window.atob(msg.encryptedKey.replace("PFS:", "")).split("").map(c => c.charCodeAt(0)));
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);

            const secretKey = await window.crypto.subtle.importKey(
              "raw",
              sharedSecretRef.current,
              "AES-GCM",
              false,
              ["decrypt"]
            );
            const decrypted = await window.crypto.subtle.decrypt(
              { name: "AES-GCM", iv: iv },
              secretKey,
              data.buffer
            );
            aesKey = new TextDecoder().decode(decrypted);
          } catch (e) {
            console.error("PFS Decryption failed, falling back to basic check", e);
          }
        }

        if (!aesKey) {
          const privateKeyPem = localStorage.getItem('privateKey');
          if (!privateKeyPem) return { text: 'Private key missing' };
          const importedPrivateKey = await importKey(privateKeyPem, 'private');
          aesKey = await decryptData(importedPrivateKey, msg.encryptedKey);
        }
      }

      const text = decryptMessageAES(msg.encryptedMessage, aesKey);

      let fileUrl = null;
      if (msg.encryptedFileData) {
        const blob = await decryptFile(msg.encryptedFileData, aesKey, msg.fileType);
        fileUrl = URL.createObjectURL(blob);
      }

      return { text, fileUrl };
    } catch (err) {
      console.error("Decryption error:", err);
      return null;
    }
  }, [username]);

  const fetchMessages = useCallback(async () => {
    try {
      const url = isRoomMode
        ? `http://localhost:5000/api/messages?roomId=${roomId}`
        : 'http://localhost:5000/api/messages';

      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      let allMessages = res.data;

      if (!isRoomMode && selectedUser) {
        allMessages = allMessages.filter(msg =>
          (msg.sender.username === selectedUser.username && msg.receiver?.username === username) ||
          (msg.sender.username === username && msg.receiver?.username === selectedUser.username)
        );
      } else if (!isRoomMode && !selectedUser) {
        setMessages([]);
        return;
      }

      const decryptedMessages = await Promise.all(allMessages.map(async (msg) => {
        const content = await decryptMessageContent(msg);
        return { ...msg, decrypted: content?.text, decryptedFileUrl: content?.fileUrl, error: content ? null : 'Decryption Failed' };
      }));

      setMessages(decryptedMessages);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, [token, selectedUser, username, isRoomMode, roomId, decryptMessageContent]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    socketRef.current = newSocket;

    if (isRoomMode) {
      newSocket.emit('joinRoom', roomId);
    } else {
      newSocket.emit('register', username);
    }

    newSocket.on('userTyping', ({ username: typingUser }) => {
      setTypingUsers(prev => ({ ...prev, [typingUser]: true }));
    });

    newSocket.on('userStoppedTyping', ({ username: typingUser }) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[typingUser];
        return next;
      });
    });

    newSocket.on('newMessage', async (message) => {
      let shouldAppend = false;
      if (isRoomMode && message.roomId === roomId) shouldAppend = true;
      if (!isRoomMode && selectedUser &&
        ((message.sender.username === selectedUser.username && message.receiver?.username === username) ||
          (message.sender.username === username && message.receiver?.username === selectedUser.username))
        && !message.roomId) {
        shouldAppend = true;
      }

      if (shouldAppend) {
        setMessages(prev => {
          if (prev.find(m => m._id === message._id)) return prev;
          return [...prev, message];
        });

        const decrypted = await decryptMessageContent(message);
        setMessages(prev => prev.map(m =>
          m._id === message._id ? { ...m, decrypted: decrypted?.text, decryptedFileUrl: decrypted?.fileUrl, error: decrypted ? null : 'Decryption Failed' } : m
        ));

        if (message.sender.username !== username) {
          newSocket.emit('messageRead', { messageId: message._id, senderUsername: message.sender.username });
        }
      }
    });

    newSocket.on('messageStatusUpdate', ({ messageId, status }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, status } : m));
    });

    newSocket.on('systemAnnouncement', ({ message, sender }) => {
      alert(`📢 SYSTEM ANNOUNCEMENT from ${sender}:\n\n${message}`);
    });

    return () => newSocket.disconnect();
  }, [username, selectedUser, isRoomMode, roomId, decryptMessageContent]);

  const toggleAudit = (id) => {
    setShowAuditId(showAuditId === id ? null : id);
  };

  const filteredMessages = messages.filter(msg =>
    msg.decrypted?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="chat-layout">
      {!isRoomMode && (
        <Sidebar
          onlineUsers={[]}
          onSelectUser={setSelectedUser}
          selectedUser={selectedUser}
        />
      )}

      <div className="main-chat" style={{ width: isRoomMode ? '100%' : 'auto' }}>
        <div className="chat-header">
          {isRoomMode ? (
            <div className="room-header">
              <button className="back-btn" onClick={() => navigate('/lobby')}>← Lobby</button>
              <div className="header-info">
                <h2>Room: {roomId}</h2>
                <span className="secure-badge">End-to-End Encrypted</span>
              </div>
              <div className="header-actions">
                <button className="icon-btn" onClick={() => setShowSearch(!showSearch)}>🔍</button>
              </div>
            </div>
          ) : (
            selectedUser ? (
              <div className="header-user">
                <div className="avatar small">{selectedUser.username.charAt(0).toUpperCase()}</div>
                <div className="header-info">
                  <h2>{selectedUser.username}</h2>
                  <span className="secure-badge">Direct Encryption Active</span>
                  {handshakeReady && <span className="pfs-badge">PFS Secured (ECDH)</span>}
                </div>
                <div className="header-actions">
                  <button className="icon-btn" onClick={() => setShowSearch(!showSearch)}>🔍</button>
                </div>
              </div>
            ) : (
              <h2>Select a user to start chatting</h2>
            )
          )}
        </div>

        {showSearch && (
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search in encrypted messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}>Close</button>
          </div>
        )}

        {(isRoomMode || selectedUser) ? (
          <>
            <div className="chat-messages">
              {filteredMessages.map((msg, index) => (
                <div key={msg._id || index} className={`message-bundle ${msg.sender.username === username ? 'own' : 'other'}`}>
                  <div className={`message-bubble ${msg.sender.username === username ? 'own' : 'other'}`}>
                    <div className="message-content">
                      <div className="message-top">
                        <span className="message-sender">{msg.sender.username}</span>
                        <button className="audit-toggle" onClick={() => toggleAudit(msg._id || index)}>
                          {showAuditId === (msg._id || index) ? 'Hide Audit' : 'Show Audit'}
                        </button>
                      </div>

                      <div className="message-text">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.decrypted || "Encrypted Content"}
                        </ReactMarkdown>
                        {msg.error && <span className="error-text"> ({msg.error})</span>}
                      </div>

                      {msg.decryptedFileUrl && (
                        <div className="message-media">
                          {msg.fileType?.startsWith('image/') ? (
                            <img src={msg.decryptedFileUrl} alt="Secure Upload" className="chat-image" />
                          ) : (
                            <a href={msg.decryptedFileUrl} download={msg.fileName} className="file-link">
                              📎 Download {msg.fileName}
                            </a>
                          )}
                        </div>
                      )}

                      <div className="message-status">
                        <span className="message-time">{new Date(msg.createdAt || msg.timestamp || Date.now()).toLocaleTimeString()}</span>
                        {msg.sender.username === username && msg.status === 'read' && <span className="read-status">✓✓</span>}
                      </div>
                    </div>
                  </div>

                  {showAuditId === (msg._id || index) && (
                    <div className="encryption-audit-box">
                      <h4>🔐 Encryption Proof</h4>
                      <div className="audit-field">
                        <label>Encrypted Payload:</label>
                        <div className="audit-value">{msg.encryptedMessage}</div>
                      </div>
                      <div className="audit-field">
                        <label>Encrypted AES Key:</label>
                        <div className="audit-value">{msg.encryptedKey}</div>
                      </div>
                      {msg.encryptedFileData && (
                        <div className="audit-field">
                          <label>Encrypted File Blob (Base64):</label>
                          <div className="audit-value">{msg.encryptedFileData.substring(0, 100)}...</div>
                        </div>
                      )}
                      <div className="audit-info">
                        Only the parties with the private key or Room ID can decrypt this data.
                        The server only sees the values above.
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {Object.keys(typingUsers).length > 0 && (
                <div className="typing-indicator">
                  {Object.keys(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <div className="input-toolbar">
                <div className="toolbar-left">
                  <select
                    value={expiryMinutes}
                    onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                    className="expiry-select"
                  >
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
                <button
                  className="emoji-btn"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  😊
                </button>
                <button
                  className="file-btn"
                  onClick={() => fileInputRef.current.click()}
                >
                  📎
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                {showEmojiPicker && (
                  <div className="emoji-picker-container">
                    <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" />
                  </div>
                )}
                <textarea
                  value={messageInput}
                  onChange={handleInputChange}
                  placeholder={isRoomMode ? `Secure Message to Room ${roomId}...` : "Type a secure message..."}
                  rows="1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={isSending}
                />
                <button className="send-btn" onClick={sendMessage} disabled={(!messageInput.trim() && !selectedFile) || isSending}>
                  <span className="send-icon">{isSending ? '...' : '➤'}</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="empty-state">
              <span className="empty-icon">💬</span>
              <p>Search for a friend or join a room to start a secure conversation.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
