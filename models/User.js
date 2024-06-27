const mongoose = require('mongoose');
const Schema = mongoose.Schema


const userSchema = new Schema({
    username: {type: String, require: true, unique: true},
    password: {type: String, require: true},
    profilePic: {type: String, default: 'https://odin-blog-bucket.s3.eu-north-1.amazonaws.com/3683ee82d45b76e04341886e87616e8c'},
    joinedAt: {type: String, default: Date.now()},
    roles: { type: [String], default: [] }
})

module.exports = mongoose.model('User', userSchema)
