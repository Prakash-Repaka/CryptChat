const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const previewRoutes = require('./routes/preview');
const roomRoutes = require('./routes/rooms');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
app.use(apiLimiter); // Apply global rate limiting
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://10.10.10.95:3000', 'http://10.10.10.95:3001'],
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 5000;

// Store connected users: username -> socket.id
const connectedUsers = {};
const roomParticipants = {}; // roomId -> Set of usernames

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://10.10.10.95:3000', 'http://10.10.10.95:3001'],
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-chat', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('✅ MongoDB connected successfully');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('Ensure MongoDB is running (e.g., "mongod" or a cloud URI in .env)');
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/preview', previewRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', require('./middleware/auth'), require('./routes/admin'));

const { logActivity } = require('./utils/logger');

// ... (existing imports and setup)

// Replace the socket.io connection logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // When user logs in, store their socket
  socket.on('register', (username) => {
    connectedUsers[username] = socket.id;
    console.log(`User ${username} registered with socket ${socket.id}`);
    logActivity(null, username, 'USER_ONLINE', `User ${username} is now online.`);
  });

  // Join a specific room
  socket.on('joinRoom', async (roomId) => {
    // Check if user is banned from this room
    const username = Object.keys(connectedUsers).find(key => connectedUsers[key] === socket.id);
    if (username) {
      const Room = require('./models/Room');
      const room = await Room.findOne({ roomId: roomId.toUpperCase() });
      if (room && room.bannedUsers.includes(username)) {
        socket.emit('error', { message: 'You are banned from this room.' });
        return;
      }
    }

    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);

    if (username) {
      if (!roomParticipants[roomId]) roomParticipants[roomId] = new Set();
      roomParticipants[roomId].add(username);
      io.to(roomId).emit('roomParticipants', Array.from(roomParticipants[roomId]));
    }

    logActivity(null, username || 'Unknown', 'ROOM_JOINED', `User joined room: ${roomId}`);
  });

  socket.on('disconnect', () => {
    // Remove from connected users
    for (let user in connectedUsers) {
      if (connectedUsers[user] === socket.id) {
        logActivity(null, user, 'USER_OFFLINE', `User ${user} went offline.`);

        // Remove from rooms
        for (let roomId in roomParticipants) {
          if (roomParticipants[roomId].has(user)) {
            roomParticipants[roomId].delete(user);
            io.to(roomId).emit('roomParticipants', Array.from(roomParticipants[roomId]));
          }
        }

        delete connectedUsers[user];
        console.log(`User ${user} disconnected`);
        break;
      }
    }
  });
});

// Make io accessible in routes
app.set('io', io);
app.set('connectedUsers', connectedUsers);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
