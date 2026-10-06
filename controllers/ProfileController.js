const mongoose = require("mongoose");
const joinedAt = require("../lib/joinedAt");
const User = require("../models/User");
const Messages = require('../models/Message');

module.exports = {

    profile_get: async function (req, res, next) {
        const { userId } = req.user;

        try {
            const user = await User.findById(userId).select('-password');

            if (!user) {
                return res.status(404).json({ message: "User Not Found!" })
            }

            const joinedDisplay = joinedAt(user);

            res.json({ user, joinedAt: joinedDisplay });

        } catch (error) {
            next(error);
        }
    },

    profileUsername_get: async function (req, res, next) {
        const username = req.params.username.toLowerCase();

        try {

            const user = await User.findOne({ username }).select('-password');

            if (!user) {
                return res.status(404).json({ message: "User Not Found!" })
            }

            const joinedDisplay = joinedAt(user);

            res.json({ user, joinedAt: joinedDisplay });

        } catch (error) {
            next(error)
        }
    },

    profile_put: async function (req, res, next) {

        const { userId } = req.user;

        try {

            const { profilePic } = req.body;

            if (!profilePic) {
                return res.status(400).json({ message: "No changes provided." });
            }

            const cloudinaryPrefix = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`;
            if (typeof profilePic !== 'string' || !profilePic.startsWith(cloudinaryPrefix)) {
                return res.status(400).json({ message: "Invalid profile picture URL." });
            }

            const currentUser = await User.findById(userId).select('-password');


            const updatedInfo = {
                profilePic: profilePic || currentUser.profilePic,
            };


            const updatedUser = await User.findByIdAndUpdate(userId, updatedInfo, { new: true }).select('-password');

            res.status(200).json({ message: "New changes saved!", user: updatedUser });

        } catch (error) {
            next(error)
        }

    },

    profile_delete: async function (req, res, next) {

        const { userId } = req.user;

        try {

            const deletedUser = await User.findByIdAndDelete(userId).select('-password');

            if (!deletedUser) {
                return res.status(404).json({ message: "User not found or already deleted!" });
            }

            res.status(200).json({ message: "Account deleted successfully!" });

        } catch (error) {
            next(error);
        }
    },
    search_get: async (req, res, next) => {

        const { query } = req.query;

        try {
            if (typeof query !== 'string' || !query.trim()) {
                return res.json([]);
            }

            const trimmedQuery = query.trim().slice(0, 30).toLowerCase();

            const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const results = await User.find({ username: { $regex: '^' + escapedQuery } })
                .select('-password')
                .limit(10);

            res.json(results);

        } catch (error) {
            next(error);
        }
    },
    chats_get: async (req, res, next) => {
        try {
            const { userId } = req.params;
            const userObjectId = new mongoose.Types.ObjectId(userId);
            
            const lastMessagesByPartner = await Messages.aggregate([
                { $match: { $or: [{ sender: userObjectId }, { receiver: userObjectId }] } },
                { $sort: { sendAt: -1 } },
                {
                    $addFields: {
                        partnerId: {
                            $cond: [{ $eq: ['$sender', userObjectId] }, '$receiver', '$sender']
                        }
                    }
                },
                {
                    $group: {
                        _id: '$partnerId',
                        lastMessage: { $first: '$content' },
                        lastMessageSendAt: { $first: '$sendAt' }
                    }
                }
            ]);

            const distinctUserIds = lastMessagesByPartner.map((entry) => entry._id);
            const users = await User.find({ _id: { $in: distinctUserIds } }, 'username profilePic');
            const usersById = new Map(users.map((user) => [user._id.toString(), user]));

            const usersWithLastMessages = lastMessagesByPartner.map((entry) => {
                const user = usersById.get(entry._id.toString());
                return {
                    _id: entry._id,
                    username: user ? user.username : '',
                    profilePic: user ? user.profilePic : '',
                    lastMessage: entry.lastMessage || '',
                    lastMessageSendAt: entry.lastMessageSendAt || ''
                };
            });

            usersWithLastMessages.sort((a, b) => new Date(b.lastMessageSendAt) - new Date(a.lastMessageSendAt));

            res.json(usersWithLastMessages);
        } catch (error) {
            next(error);
        }
    }

}