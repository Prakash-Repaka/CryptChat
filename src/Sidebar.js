import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Sidebar.css';
import { API_BASE } from './config';
import { getRecentConversations, addRecentConversation } from './utils/helpers';

const AVATAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
const avatarColor = (s) => AVATAR_COLORS[(s?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

const Sidebar = ({ onlineUsers = [], onSelectUser, selectedUser, unreadCounts = {} }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentConvs, setRecentConvs] = useState([]);

  useEffect(() => {
    setRecentConvs(getRecentConversations());
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm.trim()) { setSearchResults([]); return; }
      try {
        const res = await axios.get(`${API_BASE}/users/search?q=${searchTerm}`);
        setSearchResults(res.data);
      } catch (err) { console.error('Search error', err); }
    };
    const tid = setTimeout(searchUsers, 400);
    return () => clearTimeout(tid);
  }, [searchTerm]);

  const handleSelect = (user) => {
    addRecentConversation(user);
    setRecentConvs(getRecentConversations());
    onSelectUser(user);
  };

  const renderUserItem = (user, extraClass = '') => {
    const isSelected = selectedUser?.username === user.username;
    const unread = unreadCounts[user.username] || 0;
    return (
      <li
        key={user._id || user.username}
        className={`user-item ${isSelected ? 'active' : ''} ${extraClass}`}
        onClick={() => handleSelect(user)}
      >
        {/* Avatar */}
        <div className="sidebar-avatar-wrap">
          {user.profilePic ? (
            <img src={user.profilePic} alt={user.username} className="sidebar-avatar-img" />
          ) : (
            <div className="sidebar-avatar-fallback" style={{ background: avatarColor(user.username) }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="user-info-side">
          <span className="user-name">{user.username}</span>
          {user.statusMessage && <span className="user-status">{user.statusMessage}</span>}
        </div>
        {unread > 0 && <span className="sidebar-unread">{unread > 99 ? '99+' : unread}</span>}
      </li>
    );
  };

  const showRecent = !searchTerm && recentConvs.length > 0;
  const displayUsers = searchTerm ? searchResults : (showRecent ? recentConvs : onlineUsers);
  const sectionTitle = searchTerm ? 'Search Results' : (showRecent ? 'Recent' : 'Online Users');

  return (
    <div className="sidebar">
      <div className="search-box">
        <input
          type="text"
          placeholder="🔍 Search users…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && <button className="search-clear" onClick={() => setSearchTerm('')}>✕</button>}
      </div>

      <div className="sidebar-section">
        <h3>{sectionTitle}</h3>
        <ul className="user-list">
          {displayUsers.length > 0 ? (
            displayUsers.map(user => {
              const u = typeof user === 'string' ? { username: user } : user;
              return renderUserItem(u);
            })
          ) : (
            <li className="user-item empty">
              {searchTerm ? 'No users found' : 'No conversations yet'}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
