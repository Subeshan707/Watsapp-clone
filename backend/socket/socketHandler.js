const User = require('../models/User');
const Message = require('../models/Message');
const { createAndEmitMessage } = require('../controllers/messageController');

async function markUndeliveredAsDelivered(io, receiverId) {
  const pending = await Message.find({ receiver: receiverId, deliveredAt: null }).select('_id');
  if (!pending || pending.length === 0) return;

  const ids = pending.map((m) => m._id);
  const now = new Date();
  await Message.updateMany(
    { _id: { $in: ids }, deliveredAt: null },
    { $set: { deliveredAt: now } },
  );

  const updated = await Message.find({ _id: { $in: ids } })
    .populate('sender', '_id username')
    .populate('receiver', '_id username');

  for (const msg of updated) {
    io.to(`user:${msg.sender._id}`).emit('messageUpdated', msg);
  }
}

async function markConversationAsRead(io, readerId, otherUserId) {
  const unread = await Message.find({
    sender: otherUserId,
    receiver: readerId,
    readAt: null,
  }).select('_id');

  if (!unread || unread.length === 0) return [];

  const ids = unread.map((m) => m._id);
  const now = new Date();

  // Ensure deliveredAt exists without overriding existing timestamps.
  await Message.updateMany(
    { _id: { $in: ids }, deliveredAt: null },
    { $set: { deliveredAt: now } },
  );
  await Message.updateMany(
    { _id: { $in: ids }, readAt: null },
    { $set: { readAt: now } },
  );

  const updated = await Message.find({ _id: { $in: ids } })
    .populate('sender', '_id username')
    .populate('receiver', '_id username');

  for (const msg of updated) {
    io.to(`user:${msg.sender._id}`).emit('messageUpdated', msg);
  }

  return updated;
}

function isUserOnline(io, userId) {
  try {
    const room = io?.sockets?.adapter?.rooms?.get(`user:${userId}`);
    return !!room && room.size > 0;
  } catch {
    return false;
  }
}

function makeCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

module.exports = (io) => {
  // In-memory call sessions (1:1)
  const activeCalls = new Map(); // callId -> { callId, callerId, calleeId, type, status, createdAt }
  const userToCallId = new Map(); // userId -> callId

  function cleanupCall(callId) {
    const call = activeCalls.get(callId);
    if (!call) return;
    activeCalls.delete(callId);
    if (userToCallId.get(call.callerId) === callId) userToCallId.delete(call.callerId);
    if (userToCallId.get(call.calleeId) === callId) userToCallId.delete(call.calleeId);
  }

  io.use(async (socket, next) => {
    const userId = socket.handshake.query.userId;
    if (!userId) {
      return next(new Error('Authentication required: userId missing'));
    }
    try {
      const user = await User.findById(userId);
      if (!user) {
        return next(new Error('Invalid user ID'));
      }
      socket.userId = userId;
      socket.user = { _id: userId, username: user.username };
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User ${userId} connected`);
    socket.join(`user:${userId}`);

    // When a user comes online, mark any pending inbound messages as delivered.
    markUndeliveredAsDelivered(io, userId).catch(() => {
      // best-effort; no-op
    });

    socket.on('sendMessage', async (data, callback) => {
      const { receiverId, content } = data;
      if (!receiverId || !content || content.trim() === '') {
        if (callback) callback({ error: 'Invalid message data' });
        return;
      }

      try {
        const message = await createAndEmitMessage(io, userId, receiverId, content);
        if (callback) callback({ success: true, message });
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    socket.on('markConversationRead', async (data, callback) => {
      const { otherUserId } = data || {};
      if (!otherUserId) {
        if (callback) callback({ error: 'otherUserId is required' });
        return;
      }

      try {
        await markConversationAsRead(io, userId, otherUserId);
        if (callback) callback({ success: true });
      } catch (err) {
        if (callback) callback({ error: err.message || 'Failed to mark as read' });
      }
    });

    // --- Calling (WebRTC signaling over Socket.IO) ---
    socket.on('startCall', async (data, callback) => {
      const { calleeId, type } = data || {};
      const callType = type === 'video' ? 'video' : 'audio';

      if (!calleeId || typeof calleeId !== 'string') {
        if (callback) callback({ error: 'calleeId is required' });
        return;
      }
      if (calleeId === userId) {
        if (callback) callback({ error: 'Cannot call yourself' });
        return;
      }

      if (userToCallId.has(userId) || userToCallId.has(calleeId)) {
        if (callback) callback({ error: 'User is busy' });
        return;
      }

      if (!isUserOnline(io, calleeId)) {
        if (callback) callback({ error: 'User is offline' });
        return;
      }

      const callId = makeCallId();
      const from = socket.user || { _id: userId, username: '' };
      const call = {
        callId,
        callerId: userId,
        calleeId,
        type: callType,
        status: 'ringing',
        createdAt: Date.now(),
      };

      activeCalls.set(callId, call);
      userToCallId.set(userId, callId);
      userToCallId.set(calleeId, callId);

      io.to(`user:${calleeId}`).emit('incomingCall', { callId, from, type: callType });
      if (callback) callback({ success: true, callId });
    });

    socket.on('cancelCall', (data, callback) => {
      const { callId } = data || {};
      const call = callId ? activeCalls.get(callId) : null;
      if (!call || call.callerId !== userId) {
        if (callback) callback({ error: 'Invalid call' });
        return;
      }

      io.to(`user:${call.calleeId}`).emit('callCanceled', { callId });
      cleanupCall(callId);
      if (callback) callback({ success: true });
    });

    socket.on('answerCall', (data, callback) => {
      const { callId, accept } = data || {};
      const call = callId ? activeCalls.get(callId) : null;
      if (!call || call.calleeId !== userId) {
        if (callback) callback({ error: 'Invalid call' });
        return;
      }

      if (accept !== true) {
        io.to(`user:${call.callerId}`).emit('callRejected', { callId });
        cleanupCall(callId);
        if (callback) callback({ success: true });
        return;
      }

      call.status = 'accepted';
      activeCalls.set(callId, call);
      io.to(`user:${call.callerId}`).emit('callAccepted', { callId });
      if (callback) callback({ success: true });
    });

    socket.on('endCall', (data, callback) => {
      const { callId } = data || {};
      const call = callId ? activeCalls.get(callId) : null;
      if (!call || (call.callerId !== userId && call.calleeId !== userId)) {
        if (callback) callback({ error: 'Invalid call' });
        return;
      }

      const otherId = call.callerId === userId ? call.calleeId : call.callerId;
      io.to(`user:${otherId}`).emit('callEnded', { callId });
      cleanupCall(callId);
      if (callback) callback({ success: true });
    });

    socket.on('webrtcOffer', (data) => {
      const { callId, sdp } = data || {};
      const call = callId ? activeCalls.get(callId) : null;
      if (!call || call.callerId !== userId) return;
      io.to(`user:${call.calleeId}`).emit('webrtcOffer', { callId, sdp });
    });

    socket.on('webrtcAnswer', (data) => {
      const { callId, sdp } = data || {};
      const call = callId ? activeCalls.get(callId) : null;
      if (!call || call.calleeId !== userId) return;
      io.to(`user:${call.callerId}`).emit('webrtcAnswer', { callId, sdp });
    });

    socket.on('webrtcIceCandidate', (data) => {
      const { callId, candidate } = data || {};
      const call = callId ? activeCalls.get(callId) : null;
      if (!call || (call.callerId !== userId && call.calleeId !== userId)) return;

      const otherId = call.callerId === userId ? call.calleeId : call.callerId;
      io.to(`user:${otherId}`).emit('webrtcIceCandidate', { callId, candidate });
    });

    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`);

      // If this was the last active socket for this user and they were in a call, end it.
      setTimeout(() => {
        if (isUserOnline(io, userId)) return;
        const callId = userToCallId.get(userId);
        if (!callId) return;

        const call = activeCalls.get(callId);
        if (!call) {
          userToCallId.delete(userId);
          return;
        }
        const otherId = call.callerId === userId ? call.calleeId : call.callerId;
        io.to(`user:${otherId}`).emit('callEnded', { callId });
        cleanupCall(callId);
      }, 0);
    });
  });
};
