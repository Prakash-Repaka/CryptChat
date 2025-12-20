import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './RoomLobby.css';

const RoomLobby = () => {
    const [joinRoomId, setJoinRoomId] = useState('');
    const navigate = useNavigate();

    const handleCreateRoom = () => {
        // Generate a random 6-character Room ID
        const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        navigate(`/chat/room/${newRoomId}`);
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();
        if (joinRoomId.trim()) {
            navigate(`/chat/room/${joinRoomId.trim()}`);
        }
    };

    return (
        <div className="lobby-container">
            <div className="lobby-card">
                <h1>🔐 Secure Room Lobby</h1>
                <p>Create a new encrypted room or join an existing one.</p>

                <div className="lobby-actions">
                    <div className="action-section">
                        <h3>Start a New Chat</h3>
                        <button className="create-btn" onClick={handleCreateRoom}>
                            Create New Room
                        </button>
                    </div>

                    <div className="divider">OR</div>

                    <form className="action-section" onSubmit={handleJoinRoom}>
                        <h3>Join Existing Room</h3>
                        <input
                            type="text"
                            placeholder="Enter Room ID"
                            value={joinRoomId}
                            onChange={(e) => setJoinRoomId(e.target.value)}
                            className="room-input"
                        />
                        <button type="submit" className="join-btn" disabled={!joinRoomId.trim()}>
                            Join Room
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RoomLobby;
