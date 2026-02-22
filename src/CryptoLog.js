import React, { useState, useEffect, useCallback } from 'react';
import './CryptoLog.css';

/**
 * Global event listener for crypto logs.
 * Components can call CryptoLog.add(message) to add a log.
 */
const cryptoLogListeners = new Set();

export const addCryptoLog = (message, type = 'info') => {
    const log = {
        id: Date.now() + Math.random(),
        message,
        type,
        timestamp: new Date().toLocaleTimeString(),
    };
    cryptoLogListeners.forEach(callback => callback(log));
};

const CryptoLog = () => {
    const [logs, setLogs] = useState([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleAddLog = (newLog) => {
            setLogs(prev => [newLog, ...prev].slice(0, 50));
        };
        cryptoLogListeners.add(handleAddLog);
        return () => cryptoLogListeners.delete(handleAddLog);
    }, []);

    if (!isOpen) {
        return (
            <div className="crypto-log-mini" onClick={() => setIsOpen(true)}>
                <span className="pulse-dot"></span>
                <span className="mini-text">CRYPTO_HUD: ACTIVE</span>
            </div>
        );
    }

    return (
        <div className="crypto-log-container">
            <div className="crypto-log-header">
                <div className="header-status">
                    <span className="pulse-dot"></span>
                    <span>SYSTEM_HUD_v2.0</span>
                </div>
                <button className="close-btn" onClick={() => setIsOpen(false)}>_HIDE</button>
            </div>
            <div className="crypto-log-body">
                {logs.length === 0 ? (
                    <div className="log-entry system">Initializing security modules...</div>
                ) : (
                    logs.map(log => (
                        <div key={log.id} className={`log-entry ${log.type}`}>
                            <span className="log-time">[{log.timestamp}]</span>
                            <span className="log-msg">{log.message}</span>
                        </div>
                    ))
                )}
            </div>
            <div className="crypto-log-footer">
                <div className="footer-stat">ENTROPY: 256-BIT</div>
                <div className="footer-stat">STATE: ENCRYPTED</div>
            </div>
        </div>
    );
};

export default CryptoLog;
