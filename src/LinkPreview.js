import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from './config';
import './LinkPreview.css';

// Detect URLs in text
const URL_REGEX = /(https?:\/\/[^\s"'<>]+)/gi;

export const extractUrls = (text) => {
    if (!text) return [];
    return [...new Set(text.match(URL_REGEX) || [])];
};

const cache = {};

const LinkPreview = ({ url }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errored, setErrored] = useState(false);

    const fetchPreview = useCallback(async () => {
        if (cache[url]) {
            setData(cache[url]);
            setLoading(false);
            return;
        }
        try {
            const res = await axios.get(`${API_BASE}/preview?url=${encodeURIComponent(url)}`, { timeout: 8000 });
            if (res.data && res.data.title) {
                cache[url] = res.data;
                setData(res.data);
            } else {
                setErrored(true);
            }
        } catch {
            setErrored(true);
        } finally {
            setLoading(false);
        }
    }, [url]);

    useEffect(() => { fetchPreview(); }, [fetchPreview]);

    if (loading) return <div className="link-preview-skeleton"></div>;
    if (errored || !data) return null;

    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="link-preview-card">
            {data.image && (
                <img
                    className="link-preview-image"
                    src={data.image}
                    alt={data.title || ''}
                    onError={e => e.target.style.display = 'none'}
                />
            )}
            <div className="link-preview-text">
                <span className="link-preview-hostname">🌐 {data.hostname}</span>
                {data.title && <p className="link-preview-title">{data.title}</p>}
                {data.description && <p className="link-preview-desc">{data.description.slice(0, 120)}{data.description.length > 120 ? '…' : ''}</p>}
            </div>
        </a>
    );
};

export default LinkPreview;
