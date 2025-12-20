const ActivityLog = require('../models/ActivityLog');

const logActivity = async (userId, username, action, details) => {
    try {
        const log = new ActivityLog({
            user: userId,
            username: username,
            action: action,
            details: details
        });
        await log.save();
        console.log(`[ActivityLog] ${username || 'System'}: ${action} - ${details}`);
    } catch (err) {
        console.error('Failed to log activity:', err);
    }
};

module.exports = { logActivity };
