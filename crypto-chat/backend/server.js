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
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
app.use(apiLimiter); // Apply global rate limiting
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 5000;

// Store connected users: username -> socket.id
const connectedUsers = {};

// Middleware
app.use(cors());
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
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);

    // Try to find the username associated with this socket
    const username = Object.keys(connectedUsers).find(key => connectedUsers[key] === socket.id);
    logActivity(null, username || 'Unknown', 'ROOM_JOINED', `User joined room: ${roomId}`);
  });

  socket.on('disconnect', () => {
    // Remove from connected users
    for (let user in connectedUsers) {
      if (connectedUsers[user] === socket.id) {
        logActivity(null, user, 'USER_OFFLINE', `User ${user} went offline.`);
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
