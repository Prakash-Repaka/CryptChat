import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './Auth';
import Chat from './Chat';
import Header from './Header';
import AdminDashboard from './AdminDashboard';
import RoomLobby from './RoomLobby';
import './App.css';

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true');

  const handleLogin = (newToken, newUsername, adminStatus) => {
    setToken(newToken);
    setUsername(newUsername);
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    if (adminStatus) {
      setIsAdmin(true);
      localStorage.setItem('isAdmin', 'true');
    } else {
      setIsAdmin(false);
      localStorage.removeItem('isAdmin');
    }
  };

  const handleLogout = () => {
    setToken(null);
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
        <Header username={username} onLogout={handleLogout} isAdmin={isAdmin} />
        <Routes>
          <Route
            path="/"
            element={!token ?
              <Auth onLogin={handleLogin} setIsAdmin={setIsAdmin} /> :
              <Navigate to="/lobby" />
            }
          />
          <Route
            path="/lobby"
            element={token ? <RoomLobby /> : <Navigate to="/" />}
          />
          <Route
            path="/chat/room/:roomId"
            element={token ? <Chat token={token} username={username} /> : <Navigate to="/" />}
          />
          <Route
            path="/chat"
            element={token ? <Chat token={token} username={username} /> : <Navigate to="/" />}
          />
          <Route
            path="/admin"
            element={token && isAdmin ? <AdminDashboard token={token} /> : <Navigate to="/" />}
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
