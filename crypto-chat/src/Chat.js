import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import io from 'socket.io-client';
import Sidebar from './Sidebar';
import './Chat.css';

const Chat = ({ token, username }) => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [encryptKey, setEncryptKey] = useState('');
  const [decryptKey, setDecryptKey] = useState('');
  const [receiverUsername, setReceiverUsername] = useState('');
  const [socket, setSocket] = useState(null);

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
        return null; 
      }
    } catch (e) {
      return null;
    }
  };

  const sendMessage = async () => {
    if (messageInput.trim() && encryptKey.trim() && receiverUsername.trim()) {
      const encrypted = encryptMessage(messageInput, encryptKey);
      try {
        await axios.post('http://localhost:5000/api/messages', {
          receiverUsername,
          encryptedMessage: encrypted
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessageInput('');
        fetchMessages(); // Refresh messages
      } catch (err) {
        console.error('Error sending message:', err);
      }
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/messages', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data.map(msg => ({
        ...msg,
        decrypted: null,
        error: null
      })));
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.emit('register', username);

    newSocket.on('newMessage', (message) => {
      setMessages(prev => [...prev, { ...message, decrypted: null, error: null }]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [username]);

  const attemptDecrypt = (index) => {
    const newMessages = [...messages];
    const decrypted = decryptMessage(newMessages[index].encrypted, decryptKey);
    if (decrypted) {
      newMessages[index].decrypted = decrypted;
      newMessages[index].error = null;
    } else {
      newMessages[index].error = 'Wrong key';
      newMessages[index].decrypted = null;
    }
    setMessages(newMessages);
  };

  return (
    <div className="chat-layout">
      <Sidebar onlineUsers={[]} />
      <div className="main-chat">
        <div className="chat-header">
          <h2>Secure Chat Room</h2>
        </div>
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message-bubble ${msg.sender.username === username ? 'own' : 'other'}`}>
              <div className="message-avatar">
                {msg.sender.username.charAt(0).toUpperCase()}
              </div>
              <div className="message-content">
                <div className="message-sender">{msg.sender.username}</div>
                <div className="message-text">
                  {msg.decrypted ? msg.decrypted : msg.encrypted}
                  {!msg.decrypted && <button onClick={() => attemptDecrypt(index)}>Decrypt</button>}
                  {msg.error && <span className="error-text">{msg.error}</span>}
                </div>
                <div className="message-time">{new Date(msg.createdAt).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input
            type="text"
            value={receiverUsername}
            onChange={(e) => setReceiverUsername(e.target.value)}
            placeholder="Receiver Username"
          />
          <input
            type="text"
            value={encryptKey}
            onChange={(e) => setEncryptKey(e.target.value)}
            placeholder="Encryption Key"
          />
          <input
            type="text"
            value={decryptKey}
            onChange={(e) => setDecryptKey(e.target.value)}
            placeholder="Decryption Key"
          />
          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type a secure message..."
            rows="2"
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
