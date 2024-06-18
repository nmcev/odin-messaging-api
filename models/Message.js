const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    sender: {type: Schema.Types.ObjectId, ref: 'User'},
    receiver: {type: Schema.Types.ObjectId, ref: 'User'},
    content: {type: String, require: true},
    sendAt: {type: Date, default: Date.now},
    readAt: {type: Date}
})

    module.exports = mongoose.model('Message', messageSchema)