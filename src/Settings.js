import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MFASetup from './MFASetup';
import './Settings.css';
import { API_BASE } from './config';

const Settings = ({ token, installPrompt, setInstallPrompt }) => {
    const [showMFASetup, setShowMFASetup] = useState(false);
    const username = localStorage.getItem('username');

    // Password change
    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [pwdMsg, setPwdMsg] = useState('');
    const [pwdErr, setPwdErr] = useState('');
    const [pwdLoading, setPwdLoading] = useState(false);

    // Sessions
    const [sessions, setSessions] = useState([]);
    const [sessionsLoaded, setSessionsLoaded] = useState(false);

    const authToken = token || localStorage.getItem('token');

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPwdMsg(''); setPwdErr('');
        if (newPwd !== confirmPwd) { setPwdErr('New passwords do not match.'); return; }
        if (newPwd.length < 6) { setPwdErr('New password must be at least 6 characters.'); return; }
        setPwdLoading(true);
        try {
            await axios.post(`${API_BASE}/users/me/change-password`, { currentPassword: currentPwd, newPassword: newPwd }, { headers: { Authorization: `Bearer ${authToken}` } });
            setPwdMsg('✅ Password changed successfully!');
            setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
        } catch (err) {
            setPwdErr(err.response?.data?.message || 'Failed to change password.');
        } finally { setPwdLoading(false); }
    };

    const loadSessions = async () => {
        try {
            const res = await axios.get(`${API_BASE}/users/me/sessions`, { headers: { Authorization: `Bearer ${authToken}` } });
            setSessions(res.data);
            setSessionsLoaded(true);
        } catch { setSessions([]); setSessionsLoaded(true); }
    };

    const revokeSession = async (sessionId) => {
        try {
            await axios.delete(`${API_BASE}/users/me/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${authToken}` } });
            setSessions(prev => prev.filter(s => s._id !== sessionId));
        } catch (err) { alert('Failed to revoke session.'); }
    };

    return (
        <div className="settings-container">
            <div className="settings-content">
                <h1>⚙️ Settings</h1>

                {/* Security Section */}
                <div className="settings-section">
                    <h2>Security</h2>

                    {/* MFA */}
                    <div className="settings-item">
                        <div className="settings-item-info">
                            <h3>Multi-Factor Authentication</h3>
                            <p>Add an extra layer of security to your account</p>
                        </div>
                        <button className="settings-btn" onClick={() => setShowMFASetup(true)}>Manage MFA</button>
                    </div>

                    {/* Password Change */}
                    <div className="settings-item column">
                        <div className="settings-item-info">
                            <h3>Change Password</h3>
                            <p>Update your account password</p>
                        </div>
                        <form className="settings-form" onSubmit={handlePasswordChange}>
                            <input type="password" className="settings-input" placeholder="Current password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required />
                            <input type="password" className="settings-input" placeholder="New password (min 6 chars)" value={newPwd} onChange={e => setNewPwd(e.target.value)} required />
                            <input type="password" className="settings-input" placeholder="Confirm new password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
                            {pwdMsg && <p className="settings-success">{pwdMsg}</p>}
                            {pwdErr && <p className="settings-error">{pwdErr}</p>}
                            <button type="submit" className="settings-btn primary" disabled={pwdLoading}>{pwdLoading ? 'Saving…' : 'Change Password'}</button>
                        </form>
                    </div>
                </div>

                {/* Account Section */}
                <div className="settings-section">
                    <h2>Account Information</h2>
                    <div className="settings-item">
                        <div className="settings-item-info">
                            <h3>Username</h3>
                            <p>{username}</p>
                        </div>
                    </div>
                </div>

                {/* Active Sessions */}
                <div className="settings-section">
                    <div className="settings-section-header">
                        <h2>Active Sessions</h2>
                        {!sessionsLoaded && <button className="settings-btn-sm" onClick={loadSessions}>Load Sessions</button>}
                    </div>
                    {sessionsLoaded && (
                        sessions.length === 0 ? (
                            <p className="settings-muted">No session data available. (Sessions are tracked only if the server stores them.)</p>
                        ) : (
                            <div className="sessions-list">
                                {sessions.map(s => (
                                    <div key={s._id} className="session-item">
                                        <div>
                                            <span className="session-device">{s.device || 'Unknown device'}</span>
                                            <span className="session-time">{s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}</span>
                                        </div>
                                        <button className="settings-btn-sm danger" onClick={() => revokeSession(s._id)}>Revoke</button>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
                {/* Application Section */}
                <div className="settings-section">
                    <h2>Application</h2>
                    <div className="settings-item">
                        <div className="settings-item-info">
                            <h3>Desktop App</h3>
                            <p>
                                {window.matchMedia('(display-mode: standalone)').matches
                                    ? 'CryptChat is installed and running in app mode.'
                                    : 'Install CryptChat for a native app experience.'}
                            </p>
                        </div>
                        {!window.matchMedia('(display-mode: standalone)').matches && (
                            installPrompt ? (
                                <button className="settings-btn primary" onClick={() => {
                                    installPrompt.prompt();
                                    installPrompt.userChoice.then((choice) => {
                                        if (choice.outcome === 'accepted') setInstallPrompt(null);
                                    });
                                }}>Install App</button>
                            ) : (
                                <button className="settings-btn" disabled>Installed / Unavailable</button>
                            )
                        )}
                    </div>
                </div>
            </div>

            {showMFASetup && <MFASetup username={username} onClose={() => setShowMFASetup(false)} />}
        </div>
    );
};

export default Settings;
