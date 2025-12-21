import React, { useState } from 'react';
import MFASetup from './MFASetup';
import './Settings.css';

const Settings = () => {
    const [showMFASetup, setShowMFASetup] = useState(false);
    const username = localStorage.getItem('username');

    return (
        <div className="settings-container">
            <div className="settings-content">
                <h1>⚙️ Settings</h1>

                <div className="settings-section">
                    <h2>Security</h2>
                    <div className="settings-item">
                        <div className="settings-item-info">
                            <h3>Multi-Factor Authentication</h3>
                            <p>Add an extra layer of security to your account</p>
                        </div>
                        <button
                            className="settings-btn"
                            onClick={() => setShowMFASetup(true)}
                        >
                            Manage MFA
                        </button>
                    </div>
                </div>

                <div className="settings-section">
                    <h2>Account Information</h2>
                    <div className="settings-item">
                        <div className="settings-item-info">
                            <h3>Username</h3>
                            <p>{username}</p>
                        </div>
                    </div>
                </div>
            </div>

            {showMFASetup && (
                <MFASetup
                    username={username}
                    onClose={() => setShowMFASetup(false)}
                />
            )}
        </div>
    );
};

export default Settings;
