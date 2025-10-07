import React from 'react';
import './Header.css';

const Header = ({ username, onLogout }) => {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">🔐</span>
          <h1>CryptoChat</h1>
        </div>
        <div className="user-info">
          <span>Welcome, {username}</span>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>
    </header>
  );
};

export default Header;
