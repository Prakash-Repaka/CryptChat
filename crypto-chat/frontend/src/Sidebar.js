import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Sidebar.css';

const Sidebar = ({ onlineUsers = [], onSelectUser, selectedUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchTerm.trim()) {
        setIsSearching(true);
        try {
          const res = await axios.get(`http://localhost:5000/api/users/search?q=${searchTerm}`);
          setSearchResults(res.data);
        } catch (err) {
          console.error("Search error", err);
        }
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    };

    const timeoutId = setTimeout(() => {
      searchUsers();
    }, 500); // Debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  return (
    <div className="sidebar">
      <div className="search-box">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="sidebar-section">
        <h3>{searchTerm ? 'Search Results' : 'Online Users'}</h3>
        <ul className="user-list">
          {searchTerm ? (
            searchResults.length > 0 ? (
              searchResults.map((user) => (
                <li
                  key={user._id}
                  className={`user-item ${selectedUser?.username === user.username ? 'active' : ''}`}
                  onClick={() => onSelectUser(user)}
                >
                  <div className="avatar">{user.username.charAt(0).toUpperCase()}</div>
                  <div className="user-info-side">
                    <span>{user.username}</span>
                  </div>
                </li>
              ))
            ) : (
              <li className="user-item">No users found</li>
            )
          ) : (
            onlineUsers.length > 0 ? (
              onlineUsers.map((user, index) => (
                <li key={index} className="user-item">
                  <div className="avatar">{user.charAt(0).toUpperCase()}</div>
                  <span>{user}</span>
                </li>
              ))
            ) : (
              <li className="user-item">No users online</li>
            )
          )}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
