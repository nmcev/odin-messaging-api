const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    type: { type: String, enum: ['text', 'image', 'location'], default: 'text' },
    location: {
        lat: { type: Number },
        lng: { type: Number }
    },

    imageUrl: { type: String },
    sender: {type: Schema.Types.ObjectId, ref: 'User'},
    receiver: {type: Schema.Types.ObjectId, ref: 'User'},
    content: {type: String, required: true},
    sendAt: {type: Date, default: Date.now},
    readAt: { type: Date },
    expiresAt: { type: Date }
})

messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    module.exports = mongoose.model('Message', messageSchema)