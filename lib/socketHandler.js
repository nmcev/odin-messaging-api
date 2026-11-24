const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const GlobalMessage = require('../models/GlobalMessage');
const User = require('../models/User');
const ConversationSettings = require('../models/ConversationSetting');
require('dotenv').config();
const allowedOrigins = require('../config/origins');

const ALLOWED_TYPES = ['text', 'image', 'location'];
const ALLOWED_TIMERS = [0, 15 ,60, 300, 600]; // off, 15s, 1m, 5m, 10m (seconds)

const userSocketMap = new Map();

const pairKey = (a, b) => [String(a), String(b)].sort().join(':');

// only accept real 24-char hex ids (isValidObjectId also accepts any 12-char string)
const isObjectIdString = (id) =>
  typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);

const { isAllowedImageUrl } = require('../config/uploads');

const socketHandler = (server) => {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
    },
  });


  const emitToUser = (userId, event, data) => {
    const ids = userSocketMap.get(String(userId));
    if (ids) ids.forEach((id) => io.to(id).emit(event, data));
  };


  const scheduleExpiry = (msg) => {
    const delay = Math.max(0, msg.expiresAt.getTime() - Date.now());
    setTimeout(async () => {
      try {
        await Message.deleteOne({ _id: msg._id });
      } catch (e) {
        console.error('Expiry delete failed:', e);
      }
      const data = {
        messageId: String(msg._id),
        between: [String(msg.sender), String(msg.receiver)],
      };
      emitToUser(msg.sender, 'messageExpired', data);
      emitToUser(msg.receiver, 'messageExpired', data);
    }, delay);
  };

  // timers live in memory, so re-arm them for messages that survived a restart
  Message.find({ expiresAt: { $ne: null } }, '_id sender receiver expiresAt')
    .lean()
    .then((pending) => pending.forEach(scheduleExpiry))
    .catch((e) => console.error('Failed to reschedule message expiry:', e));

  // Presence updates can overlap (a page reload is a disconnect + connect a few ms apart).
  // Each run gets a sequence number and only the newest one is allowed to emit, so a slow,
  // older run can't overwrite newer lists and leave someone shown as both online and offline.
  let presenceSeq = 0;
  let presenceTimer = null;

  const emitPresence = async () => {
    const seq = ++presenceSeq;
    const onlineIds = Array.from(userSocketMap.keys());
    const [onlineUsers, offlineUsers] = await Promise.all([
      User.find({ _id: { $in: onlineIds } }).select('-password').lean(),
      User.find({ _id: { $nin: onlineIds } }).select('-password').lean(),
    ]);
    if (seq !== presenceSeq) return; // a newer snapshot started while we were querying
    io.emit('onlineUsers', onlineUsers);
    io.emit('offlineUsers', offlineUsers);
  };

  // coalesce bursts of connects/disconnects into one update
  const broadcastPresence = () => {
    if (presenceTimer) return;
    presenceTimer = setTimeout(() => {
      presenceTimer = null;
      emitPresence().catch((e) => console.error('Error emitting presence:', e));
    }, 100);
  };


  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('unauthorized'));
    }

    try {
      const decoded = jwt.verify(token, process.env.SECRET);
      // reject tokens belonging to deleted accounts
      const exists = await User.exists({ _id: decoded.userId });
      if (!exists) return next(new Error('unauthorized'));
      socket.userId = String(decoded.userId);
      next();
    } catch (error) {
      next(new Error('unauthorized'));
    }
  });



  io.on('connection', (socket) => {
    console.log(`New client connected! (user ${socket.userId})`);


    if (userSocketMap.has(socket.userId)) {
      userSocketMap.get(socket.userId).push(socket.id);
    } else {
      userSocketMap.set(socket.userId, [socket.id]);
    }
    broadcastPresence();

    socket.on('sendMessage', async (payload, callback) => {

      const fail = (message) => {
        socket.emit('errorMessage', { message });
        if (typeof callback === 'function') callback({ ok: false, message });
      };

      try {
        const { content, receiver, type = 'text', location } = payload || {};

        if (!ALLOWED_TYPES.includes(type)) {
          return fail('Invalid message type');
        }

        if (!isObjectIdString(receiver)) {
          return fail('Invalid receiver');
        }

        const messageData = { sender: socket.userId, receiver, type };

        if (type === 'location') {
          const lat = location?.lat;
          const lng = location?.lng;

          const validCoords =
            Number.isFinite(lat) && Number.isFinite(lng) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180;

          if (!validCoords) {
            return fail('Invalid coordinates');
          }

          messageData.location = { lat, lng };
          messageData.content = 'Location';
        } else {
          if (typeof content !== 'string' || !content.trim() || content.length > 2000) {
            return fail('Invalid message content');
          }
          if (type === 'image' && !isAllowedImageUrl(content)) {
            return fail('Invalid image URL');
          }
          messageData.content = content;
        }

        const settings = await ConversationSettings.findOne({
          pairKey: pairKey(socket.userId, receiver),
        }).lean();
        if (settings?.disappearAfter > 0) {
          messageData.expiresAt = new Date(Date.now() + settings.disappearAfter * 1000);
        }

        const newMessage = new Message(messageData);
        await newMessage.save();

        if (newMessage.expiresAt) scheduleExpiry(newMessage);

        const receiverSocketIds = userSocketMap.get(receiver);

        if (receiverSocketIds) {
          receiverSocketIds.forEach((receiverSocketId) => {
            socket.to(receiverSocketId).emit('receiveMessage', newMessage);
          });
        }

        // the sender gets the saved message back (with _id and expiresAt)
        if (typeof callback === 'function') callback({ ok: true, message: newMessage });
      } catch (error) {
        console.error('Error sending message:', error);
        fail('Error sending message');
      }
    });

    // The reader opened the conversation with `partner`: mark everything the partner sent
    // them as read, tell the partner (for "Read" under their messages) and the reader's
    // other tabs (to clear the unread dot there too).
    socket.on('markRead', async (payload, cb) => {
      try {
        const partner = payload?.partner;
        if (!mongoose.isValidObjectId(partner)) {
          return cb?.({ ok: false, message: 'Invalid partner' });
        }

        const readAt = new Date();
        const result = await Message.updateMany(
          { sender: partner, receiver: socket.userId, readAt: null }, // null also matches a missing field
          { $set: { readAt } }
        );

        if (result.modifiedCount > 0) {
          const data = {
            reader: String(socket.userId),
            partner: String(partner),
            readAt: readAt.toISOString(),
          };
          emitToUser(partner, 'messagesRead', data);
          emitToUser(socket.userId, 'messagesRead', data);
        }

        cb?.({ ok: true, updated: result.modifiedCount });
      } catch (e) {
        console.error('Error marking messages read:', e);
        cb?.({ ok: false, message: 'Error marking messages read' });
      }
    });

    socket.on('sendGlobalMessage', async (payload) => {

      try {
        const { content } = payload || {};
        if (typeof content !== 'string' || !content.trim() || content.length > 2000) {
          return socket.emit('errorMessage', { message: 'Invalid message content' });
        }

        const newGlobalMessage = new GlobalMessage({
          content,
          sender: socket.userId,
        });

        await newGlobalMessage.save();
        await newGlobalMessage.populate('sender');

        socket.broadcast.emit('receiveGlobalMessage', newGlobalMessage);
      } catch (error) {
        console.error('Error sending global message:', error);
        socket.emit('errorMessage', { message: 'Error sending global message' });
      }
    });

    socket.on('getTimer', async (payload, cb) => {
      if (typeof cb !== 'function') return;
      try {
        const receiver = payload?.receiver;
        if (!isObjectIdString(receiver)) return cb({ ok: false });

        const s = await ConversationSettings.findOne({
          pairKey: pairKey(socket.userId, receiver),
        }).lean();
        cb({ ok: true, seconds: s?.disappearAfter ?? 0 });
      } catch (e) {
        cb({ ok: false });
      }
    });

    socket.on('setTimer', async (payload, callback) => {
      const cb = typeof callback === 'function' ? callback : () => {};
      try {
        const { receiver, seconds } = payload || {};
        if (!isObjectIdString(receiver) || !ALLOWED_TIMERS.includes(seconds)) {
          return cb({ ok: false, message: 'Invalid timer' });
        }

        await ConversationSettings.findOneAndUpdate(
          { pairKey: pairKey(socket.userId, receiver) },
          { disappearAfter: seconds, updatedBy: socket.userId },
          { upsert: true }
        );

        const data = { between: [String(socket.userId), String(receiver)], seconds };
        emitToUser(socket.userId, 'timerChanged', data);
        emitToUser(receiver, 'timerChanged', data);
        cb({ ok: true });
      } catch (e) {
        console.error('Error setting timer:', e);
        cb({ ok: false, message: 'Error setting timer' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket ID ${socket.id} disconnected`);
      const socketIds = userSocketMap.get(socket.userId);
      if (socketIds) {
        const index = socketIds.indexOf(socket.id);
        if (index !== -1) socketIds.splice(index, 1);
        if (socketIds.length === 0) userSocketMap.delete(socket.userId);
      }
      broadcastPresence();
    });
  });

  // lets HTTP routes kick sockets (e.g. after account deletion)
  io.disconnectUser = (userId) => {
    const ids = userSocketMap.get(String(userId)) || [];
    ids.forEach((id) => io.sockets.sockets.get(id)?.disconnect(true));
  };

  return io;
};

module.exports = socketHandler;
