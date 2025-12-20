import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminDashboard.css';

const AdminDashboard = ({ token }) => {
    const [stats, setStats] = useState({ userCount: 0, messageCount: 0, activityCount: 0, roomCount: 0 });
    const [users, setUsers] = useState([]);
    const [activities, setActivities] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchData = useCallback(async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };

            const [statsRes, usersRes, activitiesRes, roomsRes] = await Promise.all([
                axios.get('http://localhost:5000/api/admin/stats', config),
                axios.get('http://localhost:5000/api/admin/users', config),
                axios.get('http://localhost:5000/api/admin/activities', config),
                axios.get('http://localhost:5000/api/admin/rooms', config)
            ]);

            setStats(statsRes.data);
            setUsers(usersRes.data);
            setActivities(activitiesRes.data);
            setRooms(roomsRes.data);
            setError('');
        } catch (err) {
            setError('Failed to fetch admin data. Are you an admin?');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            fetchData();
            // Refresh data every 30 seconds
            const interval = setInterval(fetchData, 30000);
            return () => clearInterval(interval);
        }
    }, [token, fetchData]);

    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(`Are you sure you want to delete user "${username}"? This action is permanent.`)) {
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.delete(`http://localhost:5000/api/admin/users/${userId}`, config);
            fetchData(); // Refresh data
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete user');
        }
    };

    const handleJoinRoom = (roomId) => {
        navigate(`/chat/room/${roomId}`);
    };

    if (loading) return <div className="admin-dashboard">Loading Admin Panel...</div>;

    return (
        <div className="admin-dashboard">
            <header className="admin-header">
                <h1>Administrator Control Center</h1>
                <p>Monitor system activity, manage users, and audit chat rooms.</p>
            </header>

            {error && <div className="error">{error}</div>}

            <div className="stats-container">
                <div className="card">
                    <h3>Total Users</h3>
                    <p>{stats.userCount}</p>
                </div>
                <div className="card">
                    <h3>Total Messages</h3>
                    <p>{stats.messageCount}</p>
                </div>
                <div className="card">
                    <h3>Active Rooms</h3>
                    <p>{stats.roomCount}</p>
                </div>
                <div className="card">
                    <h3>System Events</h3>
                    <p>{stats.activityCount}</p>
                </div>
            </div>

            <div className="dashboard-sections">
                <div className="section-card">
                    <h2>User Management</h2>
                    <div className="table-container">
                        <table className="user-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user._id}>
                                        <td>{user.username}</td>
                                        <td>{user.isAdmin ? <span className="badge admin">Admin</span> : 'User'}</td>
                                        <td>
                                            {!user.isAdmin && (
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => handleDeleteUser(user._id, user.username)}
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="section-card">
                    <h2>Active Chat Rooms</h2>
                    <div className="table-container">
                        <table className="user-table">
                            <thead>
                                <tr>
                                    <th>Room ID</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rooms.length > 0 ? rooms.map(roomId => (
                                    <tr key={roomId}>
                                        <td><code>{roomId}</code></td>
                                        <td>
                                            <button
                                                className="join-btn-small"
                                                onClick={() => handleJoinRoom(roomId)}
                                            >
                                                Join Room
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="2" style={{ textAlign: 'center', color: '#666', padding: '1rem' }}>
                                            No active rooms found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="section-card full-width">
                    <h2>Live Activity Log</h2>
                    <div className="activity-list">
                        {activities.length > 0 ? activities.map(activity => (
                            <div key={activity._id} className="activity-item">
                                <div className="activity-header">
                                    <span className="activity-user">@{activity.username || 'System'}</span>
                                    <span className="activity-time">{new Date(activity.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="activity-action">{activity.action}</div>
                                <div className="activity-details">{activity.details}</div>
                            </div>
                        )) : (
                            <p style={{ textAlign: 'center', color: '#666' }}>No activities logged yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
