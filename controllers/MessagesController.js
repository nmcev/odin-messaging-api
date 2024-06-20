const Messages = require('../models/Message');

module.exports = {

    messages_get: async (req, res, next)  => {
      
        try {

            const { userId } = req.user;
            const otherUserId = req.params.otherUserId;

            if (!userId || !otherUserId) {
                return res.status(400).json({ error: 'Missing userId or otherUserId' });

            }
            
            const messages = await Messages.find({
                $or: [
                    { sender: userId, receiver: otherUserId },
                    { sender: otherUserId, receiver: userId }
                ]          
            }).sort({ sendAt: -1});


            res.status(200).json(messages);

        } catch (error) {

            next(error);
        }


    }
}

