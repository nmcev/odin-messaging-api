const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const globalMessageSchema = new Schema({
    content: { type: String, required: true },
    sendAt: { type: Date, default: Date.now },
    sender: {type: Schema.Types.ObjectId, ref: 'User'},
});

module.exports = mongoose.model('GlobalMessage', globalMessageSchema);
