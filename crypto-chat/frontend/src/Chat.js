import React, { useState, useEffect, useCallback } from 'react';
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

  const isRoomMode = !!roomId;

  // Helper to generate random AES key
  const generateAESKey = () => {
    return CryptoJS.lib.WordArray.random(32).toString(); // 256-bit
  };

  const deriveRoomKey = (id) => {
    // Simple key derivation from Room ID (In production, use PBKDF2 with salt)
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
    if (!messageInput.trim()) return;

    if (isRoomMode) {
      // Room Mode Sending
      try {
        const roomKey = deriveRoomKey(roomId);
        const encryptedMsg = encryptMessageAES(messageInput, roomKey);

        await axios.post('http://localhost:5000/api/messages', {
          roomId,
          encryptedMessage: encryptedMsg,
          encryptedKey: 'ROOM_KEY' // Not used for rooms, but required by schema
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Optimistic update
        const newMessage = {
          sender: { username },
          roomId,
          encryptedMessage: encryptedMsg,
          encryptedKey: 'ROOM_KEY',
          createdAt: new Date().toISOString(),
          decrypted: messageInput
        };
        setMessages(prev => [...prev, newMessage]);
        setMessageInput('');

      } catch (err) {
        console.error('Error sending room message:', err);
        alert('Failed to send message.');
      }
    } else if (selectedUser) {
      // Direct Chat Sending
      try {
        const keyRes = await axios.get(`http://localhost:5000/api/users/${selectedUser.username}/key`);
        const receiverPublicKey = keyRes.data.publicKey;

        if (!receiverPublicKey) {
          alert('User public key not found!');
          return;
        }

        const sessionKey = generateAESKey();
        const encryptedMsg = encryptMessageAES(messageInput, sessionKey);
        const importedPublicKey = await importKey(receiverPublicKey, 'public');
        const encryptedSessionKey = await encryptData(importedPublicKey, sessionKey);

        await axios.post('http://localhost:5000/api/messages', {
          receiverUsername: selectedUser.username,
          encryptedMessage: encryptedMsg,
          encryptedKey: encryptedSessionKey
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const newMessage = {
          sender: { username },
          receiver: selectedUser._id,
          encryptedMessage: encryptedMsg,
          encryptedKey: encryptedSessionKey,
          createdAt: new Date().toISOString(),
          decrypted: messageInput
        };

        setMessages(prev => [...prev, newMessage]);
        setMessageInput('');
      } catch (err) {
        console.error('Error sending message:', err);
        alert('Failed to send message.');
      }
    }
  };

  const decryptMessageContent = useCallback(async (msg) => {
    try {
      if (msg.roomId) {
        // Room Decryption
        const roomKey = deriveRoomKey(msg.roomId);
        return decryptMessageAES(msg.encryptedMessage, roomKey);
      } else {
        // Direct Message Decryption
        const privateKeyPem = localStorage.getItem('privateKey');
        if (!privateKeyPem) return 'Private key missing';
        const importedPrivateKey = await importKey(privateKeyPem, 'private');
        const aesKey = await decryptData(importedPrivateKey, msg.encryptedKey);
        return decryptMessageAES(msg.encryptedMessage, aesKey);
      }
    } catch (err) {
      return null;
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const url = isRoomMode
        ? `http://localhost:5000/api/messages?roomId=${roomId}`
        : 'http://localhost:5000/api/messages';

      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      let allMessages = res.data;

      // For direct chat, filter client-side (unless API optimized)
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
        if (msg.sender.username === username && !isRoomMode) {
          // For direct chat sent messages, we can't always decrypt unless we stored sender copy.
          return { ...msg, decrypted: "** Encrypted Message Sent **" };
        }
        // Room chats can always be decrypted by sender too because key is roomId
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
    const newSocket = io('http://localhost:5000'); // Ensure URL matches backend

    if (isRoomMode) {
      // Since backend handles "join room" via socket if we implement room logic there,
      // But backend just broadcasts to roomId. We need to tell socket to join.
      // Wait, standard socket.io joins rooms via .join(). Backend usually handles this on 'connection' or specific event.
      // My backend doesn't implement 'joinRoom' event explicitly, but `io.to(roomId)` works if socket joined.
      // I need to add 'joinRoom' event to BACKEND or assume global broadcast?
      // Checking backend... Socket logic not fully custom. It emits to `connectedUsers[username]` or `io.to(roomId)`.
      // To receive room messages, socket MUST be in that room.
      newSocket.emit('joinRoom', roomId);
    } else {
      newSocket.emit('register', username);
    }

    newSocket.on('newMessage', async (message) => {
      let shouldAppend = false;
      if (isRoomMode && message.roomId === roomId) shouldAppend = true;
      if (!isRoomMode && selectedUser && message.sender.username === selectedUser.username && !message.roomId) shouldAppend = true;

      if (shouldAppend) {
        const decrypted = await decryptMessageContent(message);
        setMessages(prev => [...prev, { ...message, decrypted, error: decrypted ? null : 'Decryption Failed' }]);
      }
    });

    return () => newSocket.disconnect();
  }, [username, selectedUser, isRoomMode, roomId, decryptMessageContent]);

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
              <h2>Room: {roomId}</h2>
            </div>
          ) : (
            selectedUser ? (
              <div className="header-user">
                <div className="avatar small">{selectedUser.username.charAt(0).toUpperCase()}</div>
                <h2>{selectedUser.username}</h2>
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
                <div key={index} className={`message-bubble ${msg.sender.username === username ? 'own' : 'other'}`}>
                  <div className="message-content">
                    <div className="message-sender">{msg.sender.username}</div>
                    <div className="message-text">
                      {msg.decrypted || "Encrypted Content"}
                      {msg.error && <span className="error-text"> ({msg.error})</span>}
                    </div>
                    <div className="message-time">{new Date(msg.createdAt || Date.now()).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="chat-input">
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={isRoomMode ? `Message Room ${roomId}...` : "Type a secure message..."}
                rows="1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button onClick={sendMessage} disabled={!messageInput.trim()}>
                <span className="send-icon">➤</span>
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <p> Search for a friend on the left sidebar to start a secure conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;


