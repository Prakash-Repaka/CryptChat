import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CryptoJS from 'crypto-js';
import { API_BASE } from './config';
import { decryptData, importKey } from './utils/crypto';
import './ChatHistoryModal.css';

const deriveRoomKey = (id) => CryptoJS.SHA256(id).toString();

const decryptAES = (encrypted, key) => {
    try {
        const bytes = CryptoJS.AES.decrypt(encrypted, key);
        return bytes.toString(CryptoJS.enc.Utf8) || null;
    } catch {
        return null;
    }
};

const ChatHistoryModal = ({ roomId, receiverUsername, token, username, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const decryptMessage = async (msg) => {
        try {
            if (msg.roomId) {
                const roomKey = deriveRoomKey(msg.roomId);
                return decryptAES(msg.encryptedMessage, roomKey);
            } else {
                // DM Decryption
                const priv = localStorage.getItem('privateKey');
                if (!priv) return null;
                const importedPriv = await importKey(priv, 'private');
                const aesKey = await decryptData(importedPriv, msg.encryptedKey);
                return decryptAES(msg.encryptedMessage, aesKey);
            }
        } catch (e) {
            console.error('History decrypt fail:', e);
            return null;
        }
    };

    const loadHistory = useCallback(async () => {
        setLoading(true);
        try {
            const params = roomId ? `roomId=${roomId}` : `recipient=${receiverUsername}`;
            const res = await axios.get(
                `${API_BASE}/messages?${params}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const allMsg = res.data.messages || res.data;
            const decrypted = await Promise.all(allMsg.map(async (msg) => ({
                ...msg,
                decrypted: await decryptMessage(msg),
            })));

            setMessages(decrypted);
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setLoading(false);
        }
    }, [roomId, receiverUsername, token]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const filtered = messages.filter((m) =>
        m.decrypted?.toLowerCase().includes(search.toLowerCase()) ||
        m.sender?.username?.toLowerCase().includes(search.toLowerCase())
    );

    const formatTime = (ts) =>
        new Date(ts || Date.now()).toLocaleString(undefined, {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

    return (
        <>
            <div className="history-overlay" onClick={onClose} />

            <div className="history-panel" role="dialog" aria-label="Chat History">
                <div className="history-header">
                    <div className="history-header-top">
                        <h3>📖 {roomId ? `Room History — ${roomId}` : `Chat History — ${receiverUsername}`}</h3>
                        <button className="history-close-btn" onClick={onClose} aria-label="Close history">✕</button>
                    </div>
                    <span className="history-key-badge">
                        {roomId ? '🔐 Key derived from Room ID' : '🔐 Decrypted with your Private Key'}
                    </span>
                    <input
                        className="history-search"
                        type="text"
                        placeholder="Search history content or users…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="history-messages">
                    {loading ? (
                        <div className="history-loading">
                            <div className="history-spinner" />
                            <span>Retrieving encrypted history…</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="history-empty">
                            <span style={{ fontSize: '2rem' }}>🔒</span>
                            <span>{search ? 'No messages match your search.' : 'No messages yet in this conversation.'}</span>
                        </div>
                    ) : (
                        filtered.map((msg, i) => {
                            const isOwn = msg.sender?.username === username;
                            return (
                                <div key={msg._id || i} className={`history-msg${isOwn ? ' own-msg' : ''}`}>
                                    <div className="history-msg-meta">
                                        <span className="history-msg-sender">
                                            {isOwn ? 'You' : msg.sender?.username || 'Unknown'}
                                        </span>
                                        <span className="history-msg-time">{formatTime(msg.createdAt || msg.timestamp)}</span>
                                    </div>
                                    <div className="history-msg-text">
                                        {msg.decrypted ? (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.decrypted}</ReactMarkdown>
                                        ) : (
                                            <em style={{ opacity: 0.5 }}>{msg.encryptedKey === 'ROOM_KEY' ? 'Decryption failed' : '[Private Message Locked]'}</em>
                                        )}
                                    </div>
                                    {msg.fileName && (
                                        <div className="history-msg-file">
                                            📎 {msg.fileName}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {!loading && (
                    <div className="history-count">
                        {filtered.length} message{filtered.length !== 1 ? 's' : ''} shown
                    </div>
                )}
            </div>
        </>
    );
};

export default ChatHistoryModal;
