const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const GlobalMessage = require('../models/GlobalMessage');
const User = require('../models/User');
const ConversationSettings = require('../models/ConversationSetting');
require('dotenv').config();

const ALLOWED_TYPES = ['text', 'image', 'location'];
const ALLOWED_TIMERS = [0, 3600, 86400, 604800]; // off, 1h, 1d, 1w (seconds)

const userSocketMap = new Map();

const pairKey = (a, b) => [String(a), String(b)].sort().join(':');

const socketHandler = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'https://talkmate-odin.netlify.app'],
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

  const emitOnlineUsers = async () => {
    const onlineUsers = Array.from(userSocketMap.keys());


    const onlineUsersPopulated = await Promise.all(
      onlineUsers.map(async (userId) => {
        return await User.findById(userId).select('-password');
      })
    );

    io.emit('onlineUsers', onlineUsersPopulated);
  };

  const emitOfflineUsers = async () => {
    const allUsers = await User.find().select('-password');
    const offlineUsers = allUsers.filter((user) => !userSocketMap.has(user._id.toString()));
    io.emit('offlineUsers', offlineUsers);
  };


  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('unauthorized'));
    }

    try {
      const decoded = jwt.verify(token, process.env.SECRET);
      socket.userId = decoded.userId;
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
    emitOnlineUsers();
    emitOfflineUsers();

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

        if (!mongoose.isValidObjectId(receiver)) {
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

    socket.on('sendGlobalMessage', async ({ content }) => {

      try {
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
        if (!mongoose.isValidObjectId(receiver)) return cb({ ok: false });

        const s = await ConversationSettings.findOne({
          pairKey: pairKey(socket.userId, receiver),
        }).lean();
        cb({ ok: true, seconds: s?.disappearAfter ?? 0 });
      } catch (e) {
        cb({ ok: false });
      }
    });

    socket.on('setTimer', async (payload, cb) => {
      try {
        const { receiver, seconds } = payload || {};
        if (!mongoose.isValidObjectId(receiver) || !ALLOWED_TIMERS.includes(seconds)) {
          return cb?.({ ok: false, message: 'Invalid timer' });
        }

        await ConversationSettings.findOneAndUpdate(
          { pairKey: pairKey(socket.userId, receiver) },
          { disappearAfter: seconds, updatedBy: socket.userId },
          { upsert: true }
        );

        const data = { between: [String(socket.userId), String(receiver)], seconds };
        emitToUser(socket.userId, 'timerChanged', data);
        emitToUser(receiver, 'timerChanged', data);
        cb?.({ ok: true });
      } catch (e) {
        console.error('Error setting timer:', e);
        cb?.({ ok: false, message: 'Error setting timer' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket ID ${socket.id} disconnected`);
      for (const [userId, socketIds] of userSocketMap.entries()) {
        const index = socketIds.indexOf(socket.id);
        if (index !== -1) {
          socketIds.splice(index, 1);
          if (socketIds.length === 0) {
            userSocketMap.delete(userId);
          } else {
            userSocketMap.set(userId, socketIds);
          }
          break;
        }
      }
      emitOnlineUsers();
      emitOfflineUsers();
    });
  });
};

module.exports = socketHandler;
