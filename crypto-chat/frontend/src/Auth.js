import React, { useState } from 'react';
import axios from 'axios';
import './Auth.css';
import { generateKeyPair, exportKey } from './utils/crypto';

const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    email: '',
    contactNumber: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isLogin) {
      if (formData.password.length < 3) {
        setError('Password must be at least 3 characters long.');
        return;
      }
      if (formData.username.length < 3) {
        setError('Username must be at least 3 characters long.');
        return;
      }
    }

    try {
      let publicKey = null;
      if (!isLogin) {
        // Generate keys on signup
        const keyPair = await generateKeyPair();
        const exportedPublic = await exportKey(keyPair.publicKey);
        const exportedPrivate = await exportKey(keyPair.privateKey);

        publicKey = exportedPublic;
        localStorage.setItem('privateKey', exportedPrivate);
      }

      const url = isLogin ? 'http://localhost:5000/api/auth/login' : 'http://localhost:5000/api/auth/signup';
      const payload = { ...formData };
      if (publicKey) payload.publicKey = publicKey;

      const res = await axios.post(url, payload);

      // Use the onLogin callback provided by App.js
      onLogin(res.data.token, res.data.username, !!res.data.isAdmin);

      if (isLogin && res.data.publicKey) {
        // Optionally store own public key if needed
      }
    } catch (err) {
      console.error("Auth Error:", err);
      if (err.response) {
        setError(err.response.data?.message || 'Server error occurred');
      } else if (err.request) {
        setError('No response from server. Is the backend running on port 5000?');
      } else {
        setError('Request failed: ' + err.message);
      }
    }
  };

  return (
    <div className="secure-auth-wrapper">
      <div className="secure-auth-box">
        <h1>{isLogin ? 'SECURE LOGIN' : 'SECURE SIGNUP'}</h1>
        <form onSubmit={handleSubmit} className="secure-auth-form">
          {/* Signup Fields - Only show if NOT login */
            !isLogin && (
              <>
                <div className="form-group">
                  <input type="text" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} className="secure-input" required />
                </div>
                <div className="form-group">
                  <input type="text" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} className="secure-input" required />
                </div>
                <div className="form-group">
                  <input type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleChange} className="secure-input" required />
                </div>
                <div className="form-group">
                  <input type="text" name="contactNumber" placeholder="Phone Number" value={formData.contactNumber} onChange={handleChange} className="secure-input" required />
                </div>
              </>
            )}

          <div className="form-group">
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
              className="secure-input"
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="secure-input"
            />
          </div>
          <button type="submit" className="secure-btn">{isLogin ? 'Login' : 'Signup'}</button>
        </form>
        {error && <p className="secure-error">{error}</p>}
        <p className="secure-toggle" onClick={() => setIsLogin(!isLogin)}>
          Toggle Login/Signup (Current: {isLogin ? 'LOGIN' : 'SIGNUP'})
        </p>
      </div>
    </div>
  );
};

export default Auth;
