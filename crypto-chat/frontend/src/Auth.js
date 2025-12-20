import React, { useState } from 'react';
import axios from 'axios';
import './Auth.css';
import { generateKeyPair, exportKey } from './utils/crypto';

const Auth = ({ setToken, setUsername, setIsAdmin }) => {
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

  const validatePassword = (password) => {
    const regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{6,}$/;
    return regex.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isLogin && !validatePassword(formData.password)) {
      setError('Password must be at least 6 characters long and include numbers and special characters.');
      return;
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
      setToken(res.data.token);
      setUsername(res.data.username);
      setIsAdmin(!!res.data.isAdmin);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('username', res.data.username);
      if (res.data.isAdmin) {
        localStorage.setItem('isAdmin', 'true');
      }

      if (isLogin && res.data.publicKey) {
        // Optionally store own public key if needed
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>{isLogin ? 'Login' : 'Details'}</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <>
              <div className="form-group-half">
                <input type="text" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} required />
                <input type="text" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} required />
              </div>
              <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
              <input type="text" name="contactNumber" placeholder="Contact Number" value={formData.contactNumber} onChange={handleChange} required />
            </>
          )}

          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <button type="submit" className="auth-btn">{isLogin ? 'Login' : 'Signup'}</button>
        </form>
        {error && <p className="error-msg">{error}</p>}
        <p className="toggle-auth" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Need an account? Signup' : 'Already have an account? Login'}
        </p>
      </div>
    </div>
  );
};

export default Auth;
