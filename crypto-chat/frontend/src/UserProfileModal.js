import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from './config';
import './UserProfileModal.css';

const EMOJI_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
const randomColor = (s) => EMOJI_COLORS[s.charCodeAt(0) % EMOJI_COLORS.length];

const UserProfileModal = ({ username, currentUser, token, onClose }) => {
    const isOwn = username === currentUser;
    const [profile, setProfile] = useState(null);
    const [editing, setEditing] = useState(false);
    const [bio, setBio] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [previewPic, setPreviewPic] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const fetchProfile = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE}/users/${username}/profile`);
            setProfile(res.data);
            setBio(res.data.bio || '');
            setStatusMessage(res.data.statusMessage || '');
            setPreviewPic(res.data.profilePic || '');
        } catch {
            setProfile({ username, bio: '', statusMessage: '', profilePic: '' });
        }
    }, [username]);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 200 * 1024) { alert('Image must be under 200KB'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => setPreviewPic(ev.target.result);
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put(`${API_BASE}/users/me/profile`, {
                bio, statusMessage, profilePic: previewPic
            }, { headers: { Authorization: `Bearer ${token}` } });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            fetchProfile();
            setEditing(false);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    if (!profile) {
        return (
            <div className="upm-overlay" onClick={onClose}>
                <div className="upm-box" onClick={e => e.stopPropagation()}>
                    <div className="upm-skeleton"></div>
                </div>
            </div>
        );
    }

    const initials = profile.username?.slice(0, 2).toUpperCase() || '??';
    const avatarBg = randomColor(profile.username || 'A');

    return (
        <div className="upm-overlay" onClick={onClose}>
            <div className="upm-box" onClick={e => e.stopPropagation()}>
                {/* Close */}
                <button className="upm-close" onClick={onClose}>✕</button>

                {/* Avatar */}
                <div className="upm-avatar-wrap">
                    {(editing ? previewPic : profile.profilePic) ? (
                        <img src={editing ? previewPic : profile.profilePic} alt={profile.username} className="upm-avatar-img" />
                    ) : (
                        <div className="upm-avatar-fallback" style={{ background: avatarBg }}>{initials}</div>
                    )}
                    {editing && (
                        <label className="upm-avatar-upload">
                            📷
                            <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
                        </label>
                    )}
                </div>

                {/* Name + status */}
                <h2 className="upm-username">@{profile.username}</h2>
                {editing ? (
                    <input
                        className="upm-status-input"
                        value={statusMessage}
                        onChange={e => setStatusMessage(e.target.value)}
                        placeholder="Status message…"
                        maxLength={100}
                    />
                ) : (
                    <p className="upm-status">{profile.statusMessage || '🔒 Encrypted & Private'}</p>
                )}

                {/* Bio */}
                <div className="upm-bio-section">
                    <label className="upm-label">About</label>
                    {editing ? (
                        <textarea
                            className="upm-bio-input"
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            placeholder="Write something about yourself…"
                            maxLength={200}
                            rows={3}
                        />
                    ) : (
                        <p className="upm-bio">{profile.bio || 'No bio yet.'}</p>
                    )}
                </div>

                {/* Encryption badge */}
                <div className="upm-e2e-badge">🔐 End-to-End Encrypted</div>

                {/* Actions */}
                {isOwn && (
                    <div className="upm-actions">
                        {editing ? (
                            <>
                                <button className="upm-btn primary" onClick={handleSave} disabled={saving}>
                                    {saving ? '⏳ Saving…' : saved ? '✅ Saved!' : '💾 Save Profile'}
                                </button>
                                <button className="upm-btn secondary" onClick={() => setEditing(false)}>Cancel</button>
                            </>
                        ) : (
                            <button className="upm-btn primary" onClick={() => setEditing(true)}>✏️ Edit Profile</button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProfileModal;
