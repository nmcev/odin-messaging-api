const { Server } = require('socket.io');
const Message = require('../models/Message');
const GlobalMessage = require('../models/GlobalMessage');
const User = require('../models/User');
require('dotenv').config();

const userSocketMap = new Map();

const socketHandler = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'https://talkmate.muha.tech'],
    },
  });

  const emitOnlineUsers = async () => {
    const onlineUsers = Array.from(userSocketMap.keys());

    // Populate online users
    const onlineUsersPopulated = await Promise.all(
      onlineUsers.map(async (userId) => {
        return await User.findById(userId);
      })
    );

    io.emit('onlineUsers', onlineUsersPopulated);
  };

  const emitOfflineUsers = async () => {
    const allUsers = await User.find();
    const offlineUsers = allUsers.filter((user) => !userSocketMap.has(user._id.toString()));
    io.emit('offlineUsers', offlineUsers);
  };

  io.on('connection', (socket) => {
    console.log('New client connected!');

    socket.on('register', (userId) => {
      console.log(`Registering user ${userId} with socket ID ${socket.id}`);
      if (userSocketMap.has(userId)) {
        userSocketMap.get(userId).push(socket.id);
      } else {
        userSocketMap.set(userId, [socket.id]);
      }
      emitOnlineUsers();
      emitOfflineUsers();
    });

    socket.on('sendMessage', async ({ content, sender, receiver }) => {
      try {
        const newMessage = new Message({
          sender,
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

    socket.on('sendGlobalMessage', async ({ content, sender }) => {

      try {
        const newGlobalMessage = new GlobalMessage({
          content,
          sender,
        });

        await newGlobalMessage.save();
        await newGlobalMessage.populate('sender').execPopulate();

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
