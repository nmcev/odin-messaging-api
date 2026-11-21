const mongoose = require('mongoose');

const conversationSettingsSchema = new mongoose.Schema(
    {
        pairKey: { type: String, required: true, unique: true },
        disappearAfter: { type: Number, default: 0 }, // seconds, 0 = off
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);
const ConversationSettings = mongoose.model('ConversationSettings', conversationSettingsSchema);
module.exports = ConversationSettings;