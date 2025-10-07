import React from 'react';
import './Sidebar.css';

const Sidebar = ({ onlineUsers = [] }) => {
  return (
    <div className="sidebar">
      <h3>Online Users</h3>
      <ul className="user-list">
        {onlineUsers.length > 0 ? (
          onlineUsers.map((user, index) => (
            <li key={index} className="user-item">
              <div className="avatar">{user.charAt(0).toUpperCase()}</div>
              <span>{user}</span>
            </li>
          ))
        ) : (
          <li className="user-item">No users online</li>
        )}
      </ul>
    </div>
  );
};

export default Sidebar;
