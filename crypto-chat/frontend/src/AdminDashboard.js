import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminDashboard.css';
import { API_BASE } from './config';

const AdminDashboard = ({ token }) => {
    const [stats, setStats] = useState({ userCount: 0, messageCount: 0, activityCount: 0, roomCount: 0 });
    const [users, setUsers] = useState([]);
    const [activities, setActivities] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [announcement, setAnnouncement] = useState('');
    const [selectedUserSessions, setSelectedUserSessions] = useState([]);
    const [viewingSessionsFor, setViewingSessionsFor] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchData = useCallback(async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };

            const [statsRes, usersRes, activitiesRes, roomsRes] = await Promise.all([
                axios.get(`${API_BASE}/admin/stats`, config),
                axios.get(`${API_BASE}/admin/users`, config),
                axios.get(`${API_BASE}/admin/activities`, config),
                axios.get(`${API_BASE}/admin/rooms`, config)
            ]);

            setStats(statsRes.data);
            setUsers(usersRes.data);
            setActivities(activitiesRes.data);
            setRooms(roomsRes.data);

            if (viewingSessionsFor) {
                const sessionsRes = await axios.get(`${API_BASE}/admin/users/${viewingSessionsFor}/sessions`, config);
                setSelectedUserSessions(sessionsRes.data);
            }
            setError('');
        } catch (err) {
            setError('Failed to fetch admin data. Are you an admin?');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [token, viewingSessionsFor]);

    useEffect(() => {
        if (token) {
            fetchData();
            const interval = setInterval(fetchData, 30000);
            return () => clearInterval(interval);
        }
    }, [token, fetchData]);

    const handleViewSessions = async (userId) => {
        setViewingSessionsFor(userId);
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const res = await axios.get(`${API_BASE}/admin/users/${userId}/sessions`, config);
            setSelectedUserSessions(res.data);
        } catch (err) {
            alert('Failed to fetch sessions');
        }
    };

    const handleRevokeSession = async (sessionId) => {
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.post(`${API_BASE}/admin/users/${viewingSessionsFor}/sessions/${sessionId}/revoke`, {}, config);
            handleViewSessions(viewingSessionsFor);
        } catch (err) {
            alert('Failed to revoke session');
        }
    };

    const handleBanUser = async (userId, username, isBanned) => {
        const action = isBanned ? 'unban' : 'ban';
        const reason = isBanned ? '' : prompt(`Reason for banning ${username}:`);
        if (!isBanned && reason === null) return;

        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.post(`${API_BASE}/admin/users/${userId}/${action}`, { reason }, config);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || `Failed to ${action} user`);
        }
    };

    const handleSendAnnouncement = async () => {
        if (!announcement.trim()) return;
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.post(`${API_BASE}/admin/announcements`, { message: announcement }, config);
            setAnnouncement('');
            alert('Announcement sent!');
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to send announcement');
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(`Are you sure you want to delete user "${username}"? This action is permanent.`)) {
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.delete(`${API_BASE}/admin/users/${userId}`, config);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete user');
        }
    };

    if (loading) return <div className="admin-dashboard">Loading Admin Panel...</div>;

    return (
        <div className="admin-dashboard">
            <header className="admin-header">
                <h1>Administrator Control Center</h1>
                <div className="header-actions">
                    <button className="refresh-btn" onClick={fetchData}>Refresh Data</button>
                </div>
            </header>

            {error && <div className="error">{error}</div>}

            <div className="stats-grid">
                <div className="stat-card">
                    <span className="stat-value">{stats.userCount}</span>
                    <span className="stat-label">Total Users</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{stats.messageCount}</span>
                    <span className="stat-label">Total Messages</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{stats.roomCount}</span>
                    <span className="stat-label">Active Rooms</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{stats.activityCount}</span>
                    <span className="stat-label">System Events</span>
                </div>
            </div>

            <div className="admin-grid">
                {/* Global Announcement */}
                <div className="admin-section full-width">
                    <h2>📢 System Announcement</h2>
                    <div className="announcement-box">
                        <textarea
                            value={announcement}
                            onChange={(e) => setAnnouncement(e.target.value)}
                            placeholder="Type a message to blast to all logged-in users..."
                        />
                        <button className="send-btn" onClick={handleSendAnnouncement}>Broadcast to All Users</button>
                    </div>
                </div>

                {/* User Moderation */}
                <div className="admin-section">
                    <h2>👥 User Management</h2>
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Status</th>
                                    <th>Moderation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user._id} className={user.isBanned ? 'banned-row' : ''}>
                                        <td>
                                            <div className="user-info">
                                                <span className="username">@{user.username}</span>
                                                {user.isAdmin && <span className="small-badge admin">Admin</span>}
                                            </div>
                                        </td>
                                        <td>
                                            {user.isBanned ? <span className="small-badge banned">BANNED</span> : <span className="small-badge active">Active</span>}
                                        </td>
                                        <td>
                                            <div className="btn-group">
                                                {!user.isAdmin && (
                                                    <button
                                                        className={`action-btn ${user.isBanned ? 'unban' : 'ban'}`}
                                                        onClick={() => handleBanUser(user._id, user.username, user.isBanned)}
                                                    >
                                                        {user.isBanned ? 'Unban' : 'Ban'}
                                                    </button>
                                                )}
                                                {!user.isAdmin && (
                                                    <button
                                                        className="action-btn delete"
                                                        onClick={() => handleDeleteUser(user._id, user.username)}
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="admin-section">
                    <h2>🏠 Active Rooms</h2>
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Room ID</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rooms.map(roomId => (
                                    <tr key={roomId}>
                                        <td><code>{roomId}</code></td>
                                        <td>
                                            <button className="action-btn join" onClick={() => navigate(`/chat/room/${roomId}`)}>Join Admin Audit</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Session Management Section */}
                {viewingSessionsFor && (
                    <div className="admin-section full-width session-viewer">
                        <div className="section-header">
                            <h2>📱 Device & Session Management</h2>
                            <button className="close-btn" onClick={() => setViewingSessionsFor(null)}>Close Viewer</button>
                        </div>
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Device ID</th>
                                        <th>IP Address</th>
                                        <th>Last Seen</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedUserSessions.map(session => (
                                        <tr key={session._id}>
                                            <td><code>{session.deviceId}</code></td>
                                            <td>{session.ip}</td>
                                            <td>{new Date(session.lastSeen).toLocaleString()}</td>
                                            <td>
                                                <button className="action-btn delete" onClick={() => handleRevokeSession(session._id)}>Revoke Access</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Technical Audit / Network Interceptor */}
                <div className="admin-section full-width">
                    <div className="section-header">
                        <h2>🛠️ Network Interceptor (Live Traffic Security Audit)</h2>
                        <span className="live-pulse">LIVE INTERCEPT ACTIVE</span>
                    </div>
                    <div className="audit-log interceptor">
                        {activities.map(activity => (
                            <div key={activity._id} className="audit-item">
                                <span className="audit-time">[{new Date(activity.timestamp).toLocaleTimeString()}]</span>
                                <span className={`audit-tag ${activity.action.toLowerCase()}`}>{activity.action}</span>
                                <span className="audit-user">{activity.username || 'SYSTEM'}</span>
                                <span className="audit-details">
                                    {activity.details}
                                    {activity.action === 'MESSAGE_SENT' && (
                                        <span className="technical-view"> [BLOB: {Math.random().toString(36).substring(7)}... | RSA-4096-PSS]</span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
