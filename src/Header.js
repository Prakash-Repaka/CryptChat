import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeSwitcher from './ThemeSwitcher';
import './Header.css';

const Header = ({ username, isAdmin, onLogout }) => {
  const location = useLocation();

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">🔐</span>
          <Link to="/chat" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1>CryptoChat</h1>
          </Link>
        </div>
        <div className="user-info">
          <ThemeSwitcher />
          <span>Welcome, {username}</span>
          <Link to="/settings" className="nav-btn">Settings</Link>
          {isAdmin && (
            location.pathname === '/admin'
              ? <Link to="/chat" className="nav-btn">Back to Chat</Link>
              : <Link to="/admin" className="nav-btn">Admin Dashboard</Link>
          )}
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>
    </header>
  );
};

export default Header;
