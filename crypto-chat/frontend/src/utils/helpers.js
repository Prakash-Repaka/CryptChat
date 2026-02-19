// ── Relative timestamp ────────────────────────────────────────────────────
export const getRelativeTime = (date) => {
    if (!date) return '';
    const now = Date.now();
    const ms = now - new Date(date).getTime();
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hrs = Math.floor(min / 60);
    const days = Math.floor(hrs / 24);

    if (sec < 10) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    if (min < 60) return `${min}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
};

// ── Client-side image compression via Canvas ──────────────────────────────
export const compressImage = (file, maxWidth = 1280, quality = 0.75) => {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) { resolve(file); return; }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ratio = Math.min(maxWidth / img.width, 1);
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    const compressed = new File([blob], file.name, { type: 'image/jpeg' });
                    resolve(compressed);
                }, 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

// ── Storage helper for recent conversations ───────────────────────────────
export const getRecentConversations = () => {
    try { return JSON.parse(localStorage.getItem('recentConversations') || '[]'); }
    catch { return []; }
};

export const addRecentConversation = (user) => {
    const recent = getRecentConversations().filter(u => u.username !== user.username);
    recent.unshift(user);
    localStorage.setItem('recentConversations', JSON.stringify(recent.slice(0, 20)));
};

// ── Room name storage ─────────────────────────────────────────────────────
export const getRoomName = (roomId) => {
    try { return JSON.parse(localStorage.getItem('roomNames') || '{}')[roomId] || roomId; }
    catch { return roomId; }
};

export const setRoomName = (roomId, name) => {
    try {
        const names = JSON.parse(localStorage.getItem('roomNames') || '{}');
        names[roomId] = name;
        localStorage.setItem('roomNames', JSON.stringify(names));
    } catch { }
};
