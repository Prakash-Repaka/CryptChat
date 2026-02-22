const express = require('express');
const axios = require('axios');
const router = express.Router();

// Simple Open Graph / meta tag parser from HTML string
function parseOG(html, url) {
    const get = (prop) => {
        // Try og: meta first
        const ogMatch = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
            || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'));
        if (ogMatch) return ogMatch[1];
        // Fall back to name= meta
        const nameMatch = html.match(new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
            || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, 'i'));
        if (nameMatch) return nameMatch[1];
        return null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = get('title') || (titleMatch ? titleMatch[1].trim() : null);
    const description = get('description');
    let image = get('image');

    // Make image URL absolute if needed
    if (image && image.startsWith('/')) {
        try {
            const base = new URL(url);
            image = `${base.protocol}//${base.host}${image}`;
        } catch { }
    }

    const hostname = (() => {
        try { return new URL(url).hostname; } catch { return url; }
    })();

    return { title, description, image, hostname, url };
}

// GET /api/preview?url=... — Fetch OG preview for a URL
router.get('/', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ message: 'URL required' });

    // Only allow http/https
    if (!/^https?:\/\//i.test(url)) {
        return res.status(400).json({ message: 'Only http/https URLs allowed' });
    }

    try {
        const response = await axios.get(url, {
            timeout: 5000,
            maxContentLength: 500000, // 500KB max
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CryptChatBot/1.0; +https://cryptochat.local)',
                'Accept': 'text/html'
            },
            validateStatus: (s) => s < 400
        });

        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
            // For non-HTML (images, PDFs) just return URL info
            return res.json({ url, title: url, description: null, image: null, hostname: new URL(url).hostname });
        }

        const preview = parseOG(response.data, url);
        res.json(preview);
    } catch (err) {
        // Return minimal info on failure
        try {
            const hostname = new URL(url).hostname;
            res.json({ url, title: hostname, description: null, image: null, hostname });
        } catch {
            res.json({ url, title: url, description: null, image: null, hostname: '' });
        }
    }
});

module.exports = router;
