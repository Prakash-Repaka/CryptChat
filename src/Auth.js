import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';
import { generateKeyPair, exportKey } from './utils/crypto';

import { API_BASE } from './config';

const API = `${API_BASE}/auth`;

const Auth = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requiresMFA, setRequiresMFA] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dbStatus, setDbStatus] = useState('checking'); // 'checking' | 'ok' | 'error'

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    email: '',
    contactNumber: ''
  });

  // Live field validation errors
  const [fieldErrors, setFieldErrors] = useState({});

  // Check backend connectivity on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await axios.get(`${API_BASE}/users/search?q=_healthcheck_`, {
          timeout: 3000
        });
        setDbStatus('ok');
      } catch (err) {
        if (err.response) {
          // Server responded (even with 4xx) means it's reachable
          setDbStatus('ok');
        } else {
          setDbStatus('error');
        }
      }
    };
    checkBackend();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear field error on typing
    setFieldErrors(prev => ({ ...prev, [name]: '' }));
    setError('');
  };

  const validateForm = () => {
    const errs = {};

    if (!formData.username.trim()) errs.username = 'Username is required';
    else if (formData.username.length < 3) errs.username = 'Min. 3 characters';

    if (!formData.password) errs.password = 'Password is required';
    else if (formData.password.length < 3) errs.password = 'Min. 3 characters';

    if (!isLogin) {
      if (!formData.firstName.trim()) errs.firstName = 'First name is required';
      if (!formData.lastName.trim()) errs.lastName = 'Last name is required';
      if (!formData.email.trim()) errs.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = 'Enter a valid email';
      if (!formData.contactNumber.trim()) errs.contactNumber = 'Phone number is required';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      let publicKey = null;

      if (!isLogin) {
        // Generate cryptographic key pair on signup
        const keyPair = await generateKeyPair();
        const exportedPublic = await exportKey(keyPair.publicKey);
        const exportedPrivate = await exportKey(keyPair.privateKey);
        publicKey = exportedPublic;
        localStorage.setItem('privateKey', exportedPrivate);
      }

      const url = isLogin ? `${API}/login` : `${API}/signup`;
      const payload = { ...formData };
      if (publicKey) payload.publicKey = publicKey;
      if (requiresMFA && mfaCode) payload.mfaToken = mfaCode;

      const res = await axios.post(url, payload);

      if (res.data.requiresMFA) {
        setRequiresMFA(true);
        setLoading(false);
        return;
      }

      // Success
      if (!isLogin) setSuccess('Account created! Logging you in…');

      onLogin(res.data.token, res.data.username, !!res.data.isAdmin);

      const pendingRoom = sessionStorage.getItem('pendingRoom');
      if (pendingRoom) {
        sessionStorage.removeItem('pendingRoom');
        navigate(`/chat/room/${pendingRoom}`);
      }

    } catch (err) {
      if (err.response) {
        setError(err.response.data?.message || 'Something went wrong. Try again.');
      } else if (err.request) {
        setError('Cannot reach the server. Is the backend running on port 5000?');
      } else {
        setError('Unexpected error: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
    setFieldErrors({});
    setRequiresMFA(false);
    setMfaCode('');
  };

  return (
    <div className="secure-auth-wrapper">

      <div className="secure-auth-box">

        {/* Logo / Brand */}
        <div className="auth-brand">
          <div className="auth-logo">🔐</div>
          <h1 className="auth-title">CryptChat</h1>
          <p className="auth-subtitle">End-to-end encrypted messaging</p>
        </div>

        {/* DB Status indicator */}
        <div className={`db-status-bar ${dbStatus}`}>
          <span className={`db-dot ${dbStatus}`}></span>
          {dbStatus === 'checking' && 'Connecting to server…'}
          {dbStatus === 'ok' && 'Server connected ✓'}
          {dbStatus === 'error' && 'Server offline — start the backend on port 5000'}
        </div>

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => isLogin || switchMode()}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => !isLogin || switchMode()}
            type="button"
          >
            Sign Up
          </button>
        </div>

        {/* MFA step overlay */}
        {requiresMFA ? (
          <form className="secure-auth-form" onSubmit={handleSubmit}>
            <div className="mfa-prompt">
              <div className="mfa-icon">🔑</div>
              <h3>Two-Factor Auth</h3>
              <p>Enter the 6-digit code from your authenticator app</p>
            </div>
            <div className="form-group">
              <input
                className={`secure-input mfa-input${error ? ' error' : ''}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="000000"
                value={mfaCode}
                onChange={e => { setMfaCode(e.target.value); setError(''); }}
                maxLength={6}
                autoFocus
                required
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="secure-btn" disabled={loading || mfaCode.length !== 6}>
              {loading ? <span className="btn-spinner"></span> : 'Verify Code'}
            </button>
            <button type="button" className="auth-link-btn" onClick={() => setRequiresMFA(false)}>
              ← Back to login
            </button>
          </form>
        ) : (
          <form className="secure-auth-form" onSubmit={handleSubmit} noValidate>

            {/* Signup-only fields */}
            {!isLogin && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input
                    className={`secure-input${fieldErrors.firstName ? ' error' : ''}`}
                    type="text"
                    name="firstName"
                    placeholder="Alice"
                    value={formData.firstName}
                    onChange={handleChange}
                    autoComplete="given-name"
                  />
                  {fieldErrors.firstName && <span className="field-error">{fieldErrors.firstName}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    className={`secure-input${fieldErrors.lastName ? ' error' : ''}`}
                    type="text"
                    name="lastName"
                    placeholder="Smith"
                    value={formData.lastName}
                    onChange={handleChange}
                    autoComplete="family-name"
                  />
                  {fieldErrors.lastName && <span className="field-error">{fieldErrors.lastName}</span>}
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  className={`secure-input${fieldErrors.email ? ' error' : ''}`}
                  type="email"
                  name="email"
                  placeholder="alice@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
                {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
              </div>
            )}

            {!isLogin && (
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  className={`secure-input${fieldErrors.contactNumber ? ' error' : ''}`}
                  type="tel"
                  name="contactNumber"
                  placeholder="+1 555 000 0000"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  autoComplete="tel"
                />
                {fieldErrors.contactNumber && <span className="field-error">{fieldErrors.contactNumber}</span>}
              </div>
            )}

            {/* Username */}
            <div className="form-group">
              <label className="form-label">{isLogin ? 'Username or Email' : 'Username'}</label>
              <input
                className={`secure-input${fieldErrors.username ? ' error' : ''}`}
                type="text"
                name="username"
                placeholder={isLogin ? 'alice or alice@mail.com' : 'alice'}
                value={formData.username}
                onChange={handleChange}
                autoComplete="username"
                autoFocus={isLogin}
              />
              {fieldErrors.username && <span className="field-error">{fieldErrors.username}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-wrapper">
                <input
                  className={`secure-input${fieldErrors.password ? ' error' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword(s => !s)}
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </div>

            {/* Errors / Success */}
            {error && <div className="auth-error">⚠️ {error}</div>}
            {success && <div className="auth-success">✅ {success}</div>}

            {/* Submit */}
            <button
              type="submit"
              className="secure-btn"
              disabled={loading || dbStatus === 'error'}
            >
              {loading
                ? <><span className="btn-spinner"></span> {isLogin ? 'Signing in…' : 'Creating account…'}</>
                : isLogin ? '🔓 Sign In' : '🚀 Create Account'
              }
            </button>
          </form>
        )}

        {/* Security note */}
        {!requiresMFA && (
          <div className="auth-security-note">
            <span>🔒</span>
            {isLogin
              ? 'Your key never leaves your device.'
              : 'A unique encryption key pair is generated locally on registration.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
