import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Chat from './Chat';
import Auth from './Auth';
import Header from './Header';
import AdminDashboard from './AdminDashboard';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true');

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    if (username) {
      localStorage.setItem('username', username);
    } else {
      localStorage.removeItem('username');
    }
  }, [username]);

  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem('isAdmin', 'true');
    } else {
      localStorage.removeItem('isAdmin');
    }
  }, [isAdmin]);

  const handleLogout = () => {
    setToken('');
    setUsername('');
    setIsAdmin(false);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('privateKey');
    localStorage.removeItem('isAdmin');
  };

  return (
    <Router>
      <div className="App">
        {token && <Header username={username} isAdmin={isAdmin} onLogout={handleLogout} />}
        <Routes>
          <Route path="/" element={
            !token ? <Auth setToken={setToken} setUsername={setUsername} setIsAdmin={setIsAdmin} /> : <Navigate to="/chat" />
          } />
          <Route path="/chat" element={
            token ? <Chat token={token} username={username} /> : <Navigate to="/" />
          } />
          <Route path="/admin" element={
            token ? (isAdmin ? <AdminDashboard token={token} /> : <Navigate to="/chat" />) : <Navigate to="/" />
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
