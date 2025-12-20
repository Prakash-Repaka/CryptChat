import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css'; // We will create this simply

const AdminDashboard = ({ token }) => {
    const [stats, setStats] = useState({ userCount: 0, messageCount: 0 });
    const [users, setUsers] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const config = { headers: { Authorization: `Bearer ${token}` } };

                const statsRes = await axios.get('http://localhost:5000/api/admin/stats', config);
                setStats(statsRes.data);

                const usersRes = await axios.get('http://localhost:5000/api/admin/users', config);
                setUsers(usersRes.data);
            } catch (err) {
                setError('Failed to fetch admin data. Are you an admin?');
                console.error(err);
            }
        };
        fetchData();
    }, [token]);

    return (
        <div className="admin-dashboard">
            <h1>Admin Dashboard</h1>
            {error && <p className="error">{error}</p>}

            <div className="stats-container">
                <div className="card">
                    <h3>Total Users</h3>
                    <p>{stats.userCount}</p>
                </div>
                <div className="card">
                    <h3>Total Messages</h3>
                    <p>{stats.messageCount}</p>
                </div>
            </div>

            <h2>User Management</h2>
            <table className="user-table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Role</th>
                        <th>ID</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user._id}>
                            <td>{user.username}</td>
                            <td>{user.isAdmin ? 'Admin' : 'User'}</td>
                            <td>{user._id}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AdminDashboard;
