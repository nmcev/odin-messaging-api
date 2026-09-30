const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const GlobalMessage = require('../models/GlobalMessage');
const User = require('../models/User');
require('dotenv').config();

const userSocketMap = new Map();

const socketHandler = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'https://talkmate-odin.netlify.app'],
    },
  });

  // Verify the JWT once, when the socket connects. After this, socket.userId
  // is the only source of truth for who this connection belongs to.
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

  const emitOnlineUsers = async () => {
    const onlineUsers = Array.from(userSocketMap.keys());

    // Populate online users
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

  io.on('connection', (socket) => {
    console.log(`New client connected! (user ${socket.userId})`);

    // Registration is automatic now — socket.userId came from the verified
    // token in io.use above, so there's nothing left for the client to claim.
    if (userSocketMap.has(socket.userId)) {
      userSocketMap.get(socket.userId).push(socket.id);
    } else {
      userSocketMap.set(socket.userId, [socket.id]);
    }
    emitOnlineUsers();
    emitOfflineUsers();

    socket.on('sendMessage', async ({ content, receiver }) => {
      try {
        if (typeof content !== 'string' || !content.trim() || content.length > 2000) {
          return socket.emit('errorMessage', { message: 'Invalid message content' });
        }

        const newMessage = new Message({
          sender: socket.userId,
          receiver,
          content,
        });

        await newMessage.save();

        const receiverSocketIds = userSocketMap.get(receiver);

        if (receiverSocketIds) {
          receiverSocketIds.forEach((receiverSocketId) => {
            socket.to(receiverSocketId).emit('receiveMessage', newMessage);
          });
        }
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('errorMessage', { message: 'Error sending message' });
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
