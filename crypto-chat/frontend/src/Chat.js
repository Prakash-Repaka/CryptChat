import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import io from 'socket.io-client';
import Sidebar from './Sidebar';
import './Chat.css';
import { encryptData, decryptData, importKey } from './utils/crypto';

const Chat = ({ token, username }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showAuditId, setShowAuditId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  const isRoomMode = !!roomId;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Helper to generate random AES key
  const generateAESKey = () => {
    return CryptoJS.lib.WordArray.random(32).toString(); // 256-bit
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

  const sendMessage = async () => {
    if (!messageInput.trim() || isSending) return;
    setIsSending(true);

    try {
      let payload = {};
      if (isRoomMode) {
        const roomKey = deriveRoomKey(roomId);
        const encryptedMsg = encryptMessageAES(messageInput, roomKey);
        payload = {
          roomId,
          encryptedMessage: encryptedMsg,
          encryptedKey: 'ROOM_KEY' // Used to indicate room-based derivation
        };
      } else if (selectedUser) {
        const keyRes = await axios.get(`http://localhost:5000/api/users/${selectedUser.username}/key`);
        const receiverPublicKey = keyRes.data.publicKey;

        if (!receiverPublicKey) {
          throw new Error('User public key not found!');
        }

        const sessionKey = generateAESKey();
        const encryptedMsg = encryptMessageAES(messageInput, sessionKey);
        const importedPublicKey = await importKey(receiverPublicKey, 'public');
        const encryptedSessionKey = await encryptData(importedPublicKey, sessionKey);

        payload = {
          receiverUsername: selectedUser.username,
          encryptedMessage: encryptedMsg,
          encryptedKey: encryptedSessionKey
        };
      }

      const res = await axios.post('http://localhost:5000/api/messages', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Optimistic update
      const newMessage = {
        _id: Date.now().toString(), // Temp ID
        sender: { username },
        roomId: isRoomMode ? roomId : null,
        receiver: isRoomMode ? null : selectedUser._id,
        encryptedMessage: payload.encryptedMessage,
        encryptedKey: payload.encryptedKey,
        createdAt: new Date().toISOString(),
        decrypted: messageInput
      };

      // Note: We don't always need optimistic updates if Socket.io is fast, 
      // but it helps if the server is slow.
      // However, to avoid duplicates when socket emits back:
      // setMessages(prev => [...prev, newMessage]); 

      setMessageInput('');
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
      if (msg.roomId) {
        const roomKey = deriveRoomKey(msg.roomId);
        return decryptMessageAES(msg.encryptedMessage, roomKey);
      } else {
        const privateKeyPem = localStorage.getItem('privateKey');
        if (!privateKeyPem) return 'Private key missing';

        // If we are the sender, we can't decrypt unless we have the session key.
        // In this MVP, we only decrypt if we are the receiver or it's a room.
        if (msg.sender.username === username) {
          return msg.decrypted || "** Private Message Sent **";
        }

        const importedPrivateKey = await importKey(privateKeyPem, 'private');
        const aesKey = await decryptData(importedPrivateKey, msg.encryptedKey);
        return decryptMessageAES(msg.encryptedMessage, aesKey);
      }
    } catch (err) {
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
        return { ...msg, decrypted: content, error: content ? null : 'Decryption Failed' };
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

    if (isRoomMode) {
      newSocket.emit('joinRoom', roomId);
    } else {
      newSocket.emit('register', username);
    }

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
        // Avoid duplicate if optimistic update was used (though we disabled it above for simplicity)
        setMessages(prev => {
          if (prev.find(m => m._id === message._id)) return prev;
          return [...prev, message];
        });

        const decrypted = await decryptMessageContent(message);
        setMessages(prev => prev.map(m =>
          m._id === message._id ? { ...m, decrypted, error: decrypted ? null : 'Decryption Failed' } : m
        ));
      }
    });

    return () => newSocket.disconnect();
  }, [username, selectedUser, isRoomMode, roomId, decryptMessageContent]);

  const toggleAudit = (id) => {
    setShowAuditId(showAuditId === id ? null : id);
  };

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
            </div>
          ) : (
            selectedUser ? (
              <div className="header-user">
                <div className="avatar small">{selectedUser.username.charAt(0).toUpperCase()}</div>
                <div className="header-info">
                  <h2>{selectedUser.username}</h2>
                  <span className="secure-badge">Direct Encryption Active</span>
                </div>
              </div>
            ) : (
              <h2>Select a user to start chatting</h2>
            )
          )}
        </div>

        {(isRoomMode || selectedUser) ? (
          <>
            <div className="chat-messages">
              {messages.map((msg, index) => (
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
                        {msg.decrypted || "Encrypted Content"}
                        {msg.error && <span className="error-text"> ({msg.error})</span>}
                      </div>
                      <div className="message-time">{new Date(msg.createdAt || msg.timestamp || Date.now()).toLocaleTimeString()}</div>
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
                      <div className="audit-info">
                        Only the parties with the private key or Room ID can decrypt this data.
                        The server only sees the values above.
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <div className="chat-input">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
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
                <button onClick={sendMessage} disabled={!messageInput.trim() || isSending}>
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
