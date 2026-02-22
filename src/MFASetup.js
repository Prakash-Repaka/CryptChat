import React, { useState } from 'react';
import axios from 'axios';
import './MFASetup.css';
import { API_BASE } from './config';

const MFASetup = ({ username, onClose }) => {
    const [step, setStep] = useState('initial'); // initial, setup, verify
    const [qrCode, setQrCode] = useState('');
    const [secret, setSecret] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSetupMFA = async () => {
        try {
            setError('');
            const res = await axios.post(`${API_BASE}/auth/setup-mfa`, { username });
            setQrCode(res.data.qrCode);
            setSecret(res.data.secret);
            setStep('verify');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to setup MFA');
        }
    };

    const handleVerifyMFA = async () => {
        try {
            setError('');
            await axios.post(`${API_BASE}/auth/verify-mfa`, {
                username,
                token: verificationCode
            });
            setSuccess('MFA enabled successfully!');
            setTimeout(() => {
                if (onClose) onClose();
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid verification code');
        }
    };

    const handleDisableMFA = async () => {
        const password = prompt('Enter your password to disable MFA:');
        if (!password) return;

        try {
            setError('');
            await axios.post(`${API_BASE}/auth/disable-mfa`, {
                username,
                password
            });
            setSuccess('MFA disabled successfully!');
            setTimeout(() => {
                if (onClose) onClose();
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to disable MFA');
        }
    };

    return (
        <div className="mfa-setup-container">
            <div className="mfa-setup-box">
                <h2>🔐 Multi-Factor Authentication</h2>

                {step === 'initial' && (
                    <div className="mfa-initial">
                        <p>Add an extra layer of security to your account with MFA.</p>
                        <button className="mfa-btn primary" onClick={handleSetupMFA}>
                            Enable MFA
                        </button>
                        <button className="mfa-btn secondary" onClick={handleDisableMFA}>
                            Disable MFA
                        </button>
                    </div>
                )}

                {step === 'verify' && (
                    <div className="mfa-verify">
                        <p>Scan this QR code with your authenticator app:</p>
                        {qrCode && <img src={qrCode} alt="MFA QR Code" className="qr-code" />}
                        <p className="secret-text">
                            Or enter this secret manually: <code>{secret}</code>
                        </p>
                        <input
                            type="text"
                            placeholder="Enter 6-digit code"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                            className="mfa-input"
                            maxLength={6}
                        />
                        <button className="mfa-btn primary" onClick={handleVerifyMFA}>
                            Verify & Enable
                        </button>
                    </div>
                )}

                {error && <p className="mfa-error">{error}</p>}
                {success && <p className="mfa-success">{success}</p>}

                {onClose && (
                    <button className="mfa-btn close" onClick={onClose}>
                        Close
                    </button>
                )}
            </div>
        </div>
    );
};

export default MFASetup;
