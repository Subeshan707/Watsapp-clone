const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Per-user deletion ("Delete for me")
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  content: {
    type: String,
    trim: true,
    default: ''
  },
  attachment: {
    url: String,
    type: { type: String }, // 'image', 'video', 'audio', 'document'
    name: String,
    size: Number,
    mimeType: String
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // Message status timestamps (WhatsApp-style ticks)
  deliveredAt: {
    type: Date,
    default: null
  },
  readAt: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('Message', MessageSchema);
