const { Server } = require('socket.io');
const Message = require('../models/Message');
const { authenticateToken } = require('../middleware/authMiddleware');

const userSocketMap = new Map() // e.g: userId:  socketId,


const socketHandler = (server) => {
    const io = new Server( server, {
        cors:{
            origin: ['http://localhost:5173']
        }
    });
 
    io.on('connection', (socket) => {
        console.log('New client connected!');

        socket.on('register', userId  => {
            userSocketMap.set(userId, socket.id);
        })  

        socket.on('sendMessage', async (message, senderId, receiverId) => {

           try {
            const newMessage = new Message({
                sender: senderId,
                receiver: receiverId,
                content: message,
            })

            await newMessage.save();
            const receiverSocketId = userSocketMap.get(receiverId);

            if (receiverSocketId) {
                socket.to(receiverSocketId).emit('receiveMessage', newMessage)

            }
        } catch(error) {
            console.error('Error sending message:', error);
            socket.emit('errorMessage', { message: 'Error sending message' });
        }
        });

        socket.on('disconnect', () => {
            
            for (const [userId, socketId] of userSocketMap.entries()){

                if (socketId === socket.id) {
                    userSocketMap.delete(userId);
                    break;
                }
            }

        });
    

    });


} 

module.exports = socketHandler;
