const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    type: { type: String, enum: ['text', 'image', 'location'], default: 'text' },
    location: {
        latitude: { type: Number },
        longitude: { type: Number }
    },

    imageUrl: { type: String },
    sender: {type: Schema.Types.ObjectId, ref: 'User'},
    receiver: {type: Schema.Types.ObjectId, ref: 'User'},
    content: {type: String, required: true},
    sendAt: {type: Date, default: Date.now},
    readAt: {type: Date}
})

    module.exports = mongoose.model('Message', messageSchema)