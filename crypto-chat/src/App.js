import React, { useState, useEffect } from 'react';
import './App.css';
import Chat from './Chat';
import Auth from './Auth';
import Header from './Header';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

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

  const handleLogout = () => {
    setToken('');
    setUsername('');
  };

  return (
    <div className="App">
      {!token ? (
        <Auth setToken={setToken} setUsername={setUsername} />
      ) : (
        <>
          <Header username={username} onLogout={handleLogout} />
          <Chat token={token} username={username} />
        </>
      )}
    </div>
  );
}

export default App;
