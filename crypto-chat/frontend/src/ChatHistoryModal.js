import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CryptoJS from 'crypto-js';
import { API_BASE } from './config';
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

const ChatHistoryModal = ({ roomId, token, username, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const loadHistory = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${API_BASE}/messages?roomId=${roomId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const roomKey = deriveRoomKey(roomId);
            const decrypted = res.data.map((msg) => ({
                ...msg,
                decrypted: decryptAES(msg.encryptedMessage, roomKey),
            }));

            setMessages(decrypted);
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setLoading(false);
        }
    }, [roomId, token]);

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
            {/* Click overlay to close */}
            <div className="history-overlay" onClick={onClose} />

            <div className="history-panel" role="dialog" aria-label="Chat History">
                {/* ── Header ── */}
                <div className="history-header">
                    <div className="history-header-top">
                        <h3>📖 Room History — {roomId}</h3>
                        <button className="history-close-btn" onClick={onClose} aria-label="Close history">✕</button>
                    </div>
                    <span className="history-key-badge">
                        🔐 Key derived from Room ID — no sharing required
                    </span>
                    <input
                        className="history-search"
                        type="text"
                        placeholder="Search messages or users…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* ── Body ── */}
                <div className="history-messages">
                    {loading ? (
                        <div className="history-loading">
                            <div className="history-spinner" />
                            <span>Decrypting history…</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="history-empty">
                            <span style={{ fontSize: '2rem' }}>🔒</span>
                            <span>{search ? 'No messages match your search.' : 'No messages yet in this room.'}</span>
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
                                            <em style={{ opacity: 0.5 }}>Could not decrypt</em>
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

                {/* ── Footer count ── */}
                {!loading && (
                    <div className="history-count">
                        {filtered.length} message{filtered.length !== 1 ? 's' : ''}
                        {search && ` matching "${search}"`}
                    </div>
                )}
            </div>
        </>
    );
};

export default ChatHistoryModal;
