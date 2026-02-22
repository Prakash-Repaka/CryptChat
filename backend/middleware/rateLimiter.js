const rateLimit = require('express-rate-limit');

// General rate limiter for all API routes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        message: 'Too many requests from this IP, please try again after 15 minutes'
    }
});

// Stricter limiter for sensitive routes like login and signup
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 signup/login requests per hour
    message: {
        message: 'Too many auth attempts from this IP, please try again after an hour'
    }
});

// Limiter for message sending to prevent spam
const messageLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // Limit each IP to 20 messages per minute
    message: {
        message: 'You are sending messages too fast, please slow down'
    }
});

module.exports = { apiLimiter, authLimiter, messageLimiter };
