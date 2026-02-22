import React, { useState, useRef, useEffect } from 'react';
import './VoiceMessage.css';

const VoiceMessage = ({ onSend, onCancel }) => {
    const [state, setState] = useState('idle'); // idle | recording | preview
    const [duration, setDuration] = useState(0);
    const [audioUrl, setAudioUrl] = useState(null);
    const [audioBlob, setAudioBlob] = useState(null);
    const mediaRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
            mediaRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                setState('preview');
                stream.getTracks().forEach(t => t.stop());
            };

            recorder.start();
            setState('recording');
            const start = Date.now();
            timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - start) / 1000)), 500);
        } catch (err) {
            alert('Microphone access denied. Please allow microphone access to send voice messages.');
        }
    };

    const stopRecording = () => {
        clearInterval(timerRef.current);
        if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
    };

    const handleSend = () => {
        if (audioBlob) onSend(audioBlob);
    };

    const handleCancel = () => {
        if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
        clearInterval(timerRef.current);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        onCancel();
    };

    useEffect(() => {
        return () => {
            clearInterval(timerRef.current);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    return (
        <div className="voice-recorder">
            {state === 'idle' && (
                <button className="voice-start-btn" onClick={startRecording} title="Start recording">
                    🎙️ <span>Hold to Record</span>
                </button>
            )}

            {state === 'recording' && (
                <div className="voice-recording">
                    <span className="voice-dot"></span>
                    <span className="voice-timer">{fmt(duration)}</span>
                    <span className="voice-hint">Recording…</span>
                    <button className="voice-stop-btn" onClick={stopRecording}>⏹ Stop</button>
                    <button className="voice-cancel-x" onClick={handleCancel}>✕</button>
                </div>
            )}

            {state === 'preview' && (
                <div className="voice-preview">
                    <audio controls src={audioUrl} className="voice-audio-preview" />
                    <div className="voice-preview-actions">
                        <button className="voice-send-btn" onClick={handleSend}>📤 Send</button>
                        <button className="voice-discard-btn" onClick={handleCancel}>🗑 Discard</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Playback component for received voice messages ────────────────────────
export const VoicePlayback = ({ fileUrl, duration }) => (
    <div className="voice-playback">
        <span className="voice-play-icon">🎙️</span>
        <audio controls src={fileUrl} className="voice-audio" />
        {duration && <span className="voice-duration">{duration}</span>}
    </div>
);

export default VoiceMessage;
