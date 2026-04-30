const Message = require('../models/Message');
const User = require('../models/User');

function isUserOnline(io, userId) {
  try {
    const room = io?.sockets?.adapter?.rooms?.get(`user:${userId}`);
    return !!room && room.size > 0;
  } catch {
    return false;
  }
}

// Helper: create and save a message, then emit via socket
const createAndEmitMessage = async (io, senderId, receiverId, content) => {
  // Validate users exist
  const sender = await User.findById(senderId);
  const receiver = await User.findById(receiverId);
  if (!sender || !receiver) throw new Error('Invalid sender or receiver');

  const deliveredAt = isUserOnline(io, receiverId) ? new Date() : null;

  const message = new Message({
    sender: senderId,
    receiver: receiverId,
    content: content.trim(),
    deliveredAt
  });
  await message.save();

  const populatedMessage = await Message.findById(message._id)
    .populate('sender', '_id username phoneNumber countryCode about')
    .populate('receiver', '_id username phoneNumber countryCode about');

  // Emit to both users' rooms
  io.to(`user:${senderId}`).emit('receiveMessage', populatedMessage);
  io.to(`user:${receiverId}`).emit('receiveMessage', populatedMessage);

  return populatedMessage;
};

// Get messages between current user and another user
const getMessages = async (req, res) => {
  const { otherUserId } = req.params;
  const currentUserId = req.userId;

  try {
    const messages = await Message.find({
      $and: [
        {
          $or: [
            { sender: currentUserId, receiver: otherUserId },
            { sender: otherUserId, receiver: currentUserId }
          ]
        },
        { deletedFor: { $nin: [currentUserId] } },
      ]
    })
      .populate('sender', '_id username phoneNumber countryCode about')
      .populate('receiver', '_id username phoneNumber countryCode about')
      .sort({ timestamp: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Send message via REST API
const sendMessage = async (req, res) => {
  const { receiverId, content } = req.body;
  const senderId = req.userId;

  if (!receiverId || !content || content.trim() === '') {
    return res.status(400).json({ error: 'Receiver ID and non-empty content are required' });
  }

  try {
    const io = req.app.get('io');
    const message = await createAndEmitMessage(io, senderId, receiverId, content);
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send message' });
  }
};

module.exports = { getMessages, sendMessage, createAndEmitMessage };
