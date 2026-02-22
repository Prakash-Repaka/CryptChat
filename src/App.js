import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import Auth from './Auth';
import Chat from './Chat';
import Header from './Header';
import AdminDashboard from './AdminDashboard';
import RoomLobby from './RoomLobby';
import Settings from './Settings';
import './App.css';

// Handles /join/:roomId links — saves pending room then routes appropriately
const JoinRedirect = ({ token }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  React.useEffect(() => {
    if (!roomId) { navigate('/'); return; }
    if (token) {
      navigate(`/chat/room/${roomId}`, { replace: true });
    } else {
      sessionStorage.setItem('pendingRoom', roomId);
      navigate('/', { replace: true });
    }
  }, [roomId, token, navigate]);
  return null;
};

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

  const [installPrompt, setInstallPrompt] = useState(null);

  React.useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <div className="App">
          <div className="crt-overlay" />
          <div className="cyber-grid" />
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
              path="/settings"
              element={token ? <Settings token={token} installPrompt={installPrompt} setInstallPrompt={setInstallPrompt} /> : <Navigate to="/" />}

            />
            <Route
              path="/admin"
              element={token && isAdmin ? <AdminDashboard token={token} /> : <Navigate to="/" />}
            />
            <Route
              path="/join/:roomId"
              element={<JoinRedirect token={token} />}
            />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
};

export default App;
