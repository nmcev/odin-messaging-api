const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const MessagesController = require("../controllers/MessagesController");
const router = express.Router();

// get messages of a chat
router.get('/messages/:otherUserId', authenticateToken, MessagesController.messages_get )

// get all global messages
router.get('/global-messages', authenticateToken, MessagesController.globalMessages_get );

module.exports = router;