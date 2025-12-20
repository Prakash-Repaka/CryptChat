import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import io from 'socket.io-client';
import Sidebar from './Sidebar';
import './Chat.css';
import { encryptData, decryptData, importKey } from './utils/crypto';

const Chat = ({ token, username }) => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  // Helper to generate random AES key
  const generateAESKey = () => {
    return CryptoJS.lib.WordArray.random(32).toString(); // 256-bit
  };

  const encryptMessage = (text, key) => {
    return CryptoJS.AES.encrypt(text, key).toString();
  };

  const decryptMessage = (encrypted, key) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (decrypted) {
        return decrypted;
      } else {
        return null; // Decryption failed
      }
    } catch (e) {
      return null;
    }
  };

  const sendMessage = async () => {
    if (messageInput.trim() && selectedUser) {
      try {
        // 1. Fetch Receiver's Public Key (Using backend route)
        // Note: For optimization, we could include publicKey in search results, but fetching fresh is safer
        const keyRes = await axios.get(`http://localhost:5000/api/users/${selectedUser.username}/key`);
        const receiverPublicKey = keyRes.data.publicKey;

        if (!receiverPublicKey) {
          alert('User public key not found!');
          return;
        }

        // 2. Generate Random AES Key
        const sessionKey = generateAESKey();

        // 3. Encrypt Message with AES
        const encryptedMsg = encryptMessage(messageInput, sessionKey);

        // 4. Encrypt AES Key with RSA
        const importedPublicKey = await importKey(receiverPublicKey, 'public');
        const encryptedSessionKey = await encryptData(importedPublicKey, sessionKey);

        // 5. Send Payload
        await axios.post('http://localhost:5000/api/messages', {
          receiverUsername: selectedUser.username,
          encryptedMessage: encryptedMsg,
          encryptedKey: encryptedSessionKey
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const newMessage = {
          sender: { username: username }, // Optimistic update
          receiver: selectedUser._id, // Ideally populate object, but ID is fine for now
          encryptedMessage: encryptedMsg,
          encryptedKey: encryptedSessionKey, // We can't decrypt our own sent message in this model easily without storing sender-encrypted key
          createdAt: new Date().toISOString(),
          // We can't show decrypted text for our own message immediately unless we store plain text or encrypt for ourselves too
          // For MVP, just show plain text locally
          decrypted: messageInput
        };

        // Optimistic append
        setMessages(prev => [...prev, newMessage]);
        setMessageInput('');
        // fetchMessages(); // No need to fetch immediately if optimized
      } catch (err) {
        console.error('Error sending message:', err);
        alert('Failed to send message.');
      }
    }
  };

  const decryptMessageContent = async (msg) => {
    try {
      const privateKeyPem = localStorage.getItem('privateKey');
      if (!privateKeyPem) return 'Private key missing';

      const importedPrivateKey = await importKey(privateKeyPem, 'private');

      // Decrypt the AES key
      const aesKey = await decryptData(importedPrivateKey, msg.encryptedKey);

      // Decrypt the message
      const decrypted = decryptMessage(msg.encryptedMessage, aesKey);
      return decrypted;
    } catch (err) {
      // console.error("Decryption failed (expected for sent messages)", err);
      return null;
    }
  };

  const fetchMessages = React.useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/messages', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const allMessages = res.data;
      // Filter for selected user context locally (Ideally backend does filtering)
      // Since API returns ALL messages for user, we filter here

      if (!selectedUser) {
        setMessages([]);
        return;
      }

      const chatMessages = allMessages.filter(msg =>
        (msg.sender.username === selectedUser.username && msg.receiver.username === username) || // Received from them
        (msg.sender.username === username && msg.receiver.username === selectedUser.username)   // Sent to them
        // Note: Backend 'receiver' field is populated object in fetch but ID in send, check backend populate
      );

      // Decrypt what we can
      const decryptedMessages = await Promise.all(chatMessages.map(async (msg) => {
        if (msg.sender.username === username) {
          // It's my sent message. I can't decrypt it with my private key because I encrypted it with THEIR public key.
          // In a real app, I should have encrypted it for myself too.
          // For now, just show "Sent Encrypted Message" or similar if we didn't catch it optimistically
          return { ...msg, decrypted: "** Encrypted Message Sent **" };
        }
        // Incoming message
        const content = await decryptMessageContent(msg);
        return { ...msg, decrypted: content, error: content ? null : 'Decryption Failed' };
      }));

      setMessages(decryptedMessages);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, [token, selectedUser, username]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [fetchMessages, selectedUser]);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');

    newSocket.emit('register', username);

    newSocket.on('newMessage', async (message) => {
      // Only append if it belongs to current chat
      if (selectedUser && message.sender.username === selectedUser.username) {
        const decrypted = await decryptMessageContent(message);
        setMessages(prev => [...prev, { ...message, decrypted, error: decrypted ? null : 'Decryption Failed' }]);
      }
      // Else: Notification indicator (skipped for now)
    });

    return () => {
      newSocket.disconnect();
    };
  }, [username, selectedUser]);

  return (
    <div className="chat-layout">
      <Sidebar
        onlineUsers={[]}
        onSelectUser={setSelectedUser}
        selectedUser={selectedUser}
      />
      <div className="main-chat">
        <div className="chat-header">
          {selectedUser ? (
            <div className="header-user">
              <div className="avatar small">{selectedUser.username.charAt(0).toUpperCase()}</div>
              <h2>{selectedUser.username}</h2>
            </div>
          ) : (
            <h2>Select a user to start chatting</h2>
          )}
        </div>

        {selectedUser ? (
          <>
            <div className="chat-messages">
              {messages.map((msg, index) => (
                <div key={index} className={`message-bubble ${msg.sender.username === username ? 'own' : 'other'}`}>
                  <div className="message-content">
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
                placeholder="Type a secure message..."
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


