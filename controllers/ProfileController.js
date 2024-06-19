const joinedAt = require("../lib/joinedAt");
const User = require("../models/User");

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

            const { username, profilePic } = req.body;

            if (!username && !profilePic) {
                return res.status(400).json({ message: "No changes provided." });
            }

            const currentUser = await User.findById(userId);

            if (username && currentUser.username !== username) {
                const existingUser = await User.findOne({ username });
                if (existingUser) {
                    return res.status(400).json({ message: "Username already exists!" });
                }
            }

            const updatedInfo = {
                username: username || currentUser.username,
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
    }
}
