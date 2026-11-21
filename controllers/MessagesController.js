const Messages = require('../models/Message');
const GlobalMessages = require('../models/GlobalMessage');

module.exports = {

    messages_get: async (req, res, next) => {
        try {

            const { userId } = req.user;
            const otherUserId = req.params.otherUserId;

            if (!userId || !otherUserId) {
                return res.status(400).json({ error: 'Missing userId or otherUserId' });
            }

            const notExpired = {
                $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } }
                ]
            };

            const messages = await Messages.find({
                $and: [
                    {
                        $or: [
                            { sender: userId, receiver: otherUserId },
                            { sender: otherUserId, receiver: userId }
                        ]
                    },
                    notExpired
                ]
            }).sort({ sendAt: 1 }).limit(200);

            res.status(200).json(messages);
        } catch (error) {
            next(error);
        }
    },
    globalMessages_get: async (req, res, next) => {
        try {
            const recentMessages = await GlobalMessages.find().sort({ sendAt: -1 }).limit(200).populate('sender');
            const messages = recentMessages.reverse();

            res.status(200).json(messages);
        } catch (error) {
            next(error);
        }
    }
}

