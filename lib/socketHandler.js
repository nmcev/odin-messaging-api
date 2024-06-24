const { Server } = require('socket.io');
const Message = require('../models/Message');
require('dotenv').config();

const userSocketMap = new Map();

const socketHandler = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'https://talkmate.muha.tech'],
    },
  });

  io.on('connection', (socket) => {
    console.log('New client connected!');

    socket.on('register', (userId) => {
      console.log(`Registering user ${userId} with socket ID ${socket.id}`);
      if (userSocketMap.has(userId)) {
        userSocketMap.get(userId).push(socket.id);
      } else {
        userSocketMap.set(userId, [socket.id]);
      }

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
    });
  });
};

module.exports = socketHandler;
