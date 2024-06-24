const joinedAt = require("../lib/joinedAt");
const User = require("../models/User");
const Messages = require('../models/Message');

module.exports = {

    profile_get: async function (req, res, next) {
        const { userId } = req.user;
        
        try {
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({ message: "User Not Found!"})
            }

            const joinedDisplay = joinedAt(user);

            res.json({ user, joinedAt: joinedDisplay });

        } catch(error) {
            next(error);
        }
    },

    profileUsername_get: async function (req, res, next) {
        const username = req.params.username.toLowerCase();
        
        try {
            
            const user = await User.findOne({ username });

            if (!user) {
                return res.status(404).json({ message: "User Not Found!"})
            }

            const joinedDisplay = joinedAt(user);
            
            res.json({ user, joinedAt: joinedDisplay });

        } catch(error){
            next(error)
        }
    },

    profile_put: async function (req, res, next) {

        const { userId } = req.user;

        try {

            const {profilePic } = req.body;

            if (!profilePic) {
                return res.status(400).json({ message: "No changes provided." });
            }

            const currentUser = await User.findById(userId);


            const updatedInfo = {
                profilePic: profilePic || currentUser.profilePic,
            };

            
            const updatedUser = await User.findByIdAndUpdate(userId, updatedInfo, { new: true })

            res.status(200).json({ message: "New changes saved!", user: updatedUser });

        }  catch (error) {
            next(error)
        } 

    },

    profile_delete: async function (req, res, next) {

        const { userId } = req.user;

        try {

            const deletedUser = await User.findByIdAndDelete(userId);

            if (!deletedUser) {
                return res.status(404).json({ message: "User not found or already deleted!" });
            }

            res.status(200).json({ message: "Account deleted successfully!" });

        } catch(error) {
            next(error);
        }
    },
    search_get: async(req, res, next) => {

        const { query }  = req.query;

        try {
            const results = await User.find({ username: { $regex: new RegExp(query, 'i') } });

            res.json(results);

          } catch (error) {


            console.error('Error searching items:', error);
            res.status(500).json({ error: 'Internal Server Error' });
          }
    },
    chats_get:async (req, res, next) => {
        try {
          const { userId } = req.params;
      
          const receivedFromUserIds = await Messages.distinct('sender', { receiver: userId });
          const sentToUserIds = await Messages.distinct('receiver', { sender: userId });
          const distinctUserIds = Array.from(new Set([...receivedFromUserIds, ...sentToUserIds]));
      
          const users = await User.find({ _id: { $in: distinctUserIds } }, 'username profilePic');
      
          const usersWithLastMessages = await Promise.all(users.map(async (user) => {
            const lastMessage = await Messages.findOne(
              {
                $or: [
                  { sender: userId, receiver: user._id },
                  { sender: user._id, receiver: userId }
                ]
              },
              {
                content: 1,
                sendAt: 1
              },
              { sort: { sendAt: -1 } }
            );
      
            const lastMessageContent = lastMessage ? lastMessage.content : '';
            const lastMessageSendAt = lastMessage ? lastMessage.sendAt : '';
      
            return {
              _id: user._id,
              username: user.username,
              profilePic: user.profilePic,
              lastMessage: lastMessageContent,
                lastMessageSendAt

            };
          }));
      
          usersWithLastMessages.sort((a, b) => new Date(b.lastMessageSendAt) - new Date(a.lastMessageSendAt));

          res.json(usersWithLastMessages);
        } catch (error) {
          next(error); 
        }
      }
      
}
