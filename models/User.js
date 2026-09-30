const mongoose = require('mongoose');
const Schema = mongoose.Schema


const userSchema = new Schema({
    username: {type: String, required: true, unique: true},
    password: { type: String, required: true, select: false,},
    profilePic: {type: String, default: 'https://res.cloudinary.com/dwwfi7a2x/image/upload/v1790789438/uploads/file-1790789437809.webp'},
    joinedAt: {type: String, default: Date.now},
})

module.exports = mongoose.model('User', userSchema)
