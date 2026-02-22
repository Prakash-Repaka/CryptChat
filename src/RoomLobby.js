import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './RoomLobby.css';
import axios from 'axios';
import { API_BASE } from './config';
import { setRoomName, getRoomName } from './utils/helpers';

const RoomLobby = () => {
    const [joinRoomId, setJoinRoomId] = useState('');
    const [roomName, setRoomNameState] = useState('');
    const [copiedLink, setCopiedLink] = useState('');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const roomParam = searchParams.get('room');
        if (roomParam) setJoinRoomId(roomParam.trim().toUpperCase());
    }, [searchParams]);

    const handleCreateRoom = async () => {
        const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const name = roomName.trim() || newRoomId;
        const token = localStorage.getItem('token');

        try {
            await axios.post(`${API_BASE}/rooms`, { roomId: newRoomId, name }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRoomName(newRoomId, name);
            navigate(`/chat/room/${newRoomId}`);
        } catch (err) {
            console.error('Failed to create room in DB:', err);
            // Even if DB fails (e.g. offline), we still allow entering the room for legacy/anonymous support
            setRoomName(newRoomId, name);
            navigate(`/chat/room/${newRoomId}`);
        }
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();
        if (!joinRoomId.trim()) return;
        const id = joinRoomId.trim().toUpperCase();
        navigate(`/chat/room/${id}`);
    };

    const handleCopyLink = (roomId) => {
        const url = `${window.location.origin}/join/${roomId}`;
        navigator.clipboard.writeText(url)
            .then(() => { setCopiedLink('✅ Link copied!'); setTimeout(() => setCopiedLink(''), 2500); })
            .catch(() => {
                const ta = document.createElement('textarea');
                ta.value = url; document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
                setCopiedLink('✅ Link copied!'); setTimeout(() => setCopiedLink(''), 2500);
            });
    };

    return (
        <div className="lobby-container">
            <div className="lobby-card">
                <h1>🔐 Secure Room Lobby</h1>
                <p>Create a new encrypted room or join one via ID or link.</p>

                <div className="lobby-actions">
                    {/* Create */}
                    <div className="action-section">
                        <h3>🚀 Start a New Room</h3>
                        <input
                            type="text"
                            placeholder="Room name (optional)"
                            value={roomName}
                            onChange={(e) => setRoomNameState(e.target.value)}
                            className="room-input"
                            maxLength={40}
                            style={{ marginBottom: '0.5rem' }}
                        />
                        <button className="create-btn" onClick={handleCreateRoom}>
                            Create New Room
                        </button>
                    </div>

                    <div className="divider">OR</div>

                    {/* Join by ID */}
                    <form className="action-section" onSubmit={handleJoinRoom}>
                        <h3>🔑 Join by Room ID</h3>
                        <input
                            type="text"
                            placeholder="Enter Room ID (e.g. AB12CD)"
                            value={joinRoomId}
                            onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                            className="room-input"
                            maxLength={12}
                        />
                        {joinRoomId.trim().length >= 4 && (
                            <button type="button" className="copy-link-btn" onClick={() => handleCopyLink(joinRoomId.trim())} title="Copy invite link">
                                🔗 Copy Invite Link
                            </button>
                        )}
                        {copiedLink && <div className="link-copied-toast">{copiedLink}</div>}
                        <button type="submit" className="join-btn" disabled={!joinRoomId.trim()}>Join Room</button>
                    </form>

                    <div className="lobby-info-box">
                        <span className="lobby-info-icon">💡</span>
                        <div>
                            <strong>Share a room link</strong>
                            <p>Anyone with the link can join after logging in. The room key is derived from the Room ID — only members can decrypt messages.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoomLobby;
