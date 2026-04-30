const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');
const aiRoutes = require('./routes/aiRoutes');
const socketHandler = require('./socket/socketHandler');
const { migrateUsers } = require('./utils/migrate');

dotenv.config({ path: path.resolve(__dirname, '.env') });
console.log('GROQ_API_KEY configured:', Boolean(process.env.GROQ_API_KEY));

// Connect to DB and run migrations
connectDB().then(() => {
  migrateUsers().catch((err) => console.error('Migration error:', err));
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Configure for production
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Make io accessible to controllers
app.set('io', io);

// Routes
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/ai', aiRoutes);

// Socket.IO
socketHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
