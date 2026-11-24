const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const indexRoute = require('./routes/index')
const morgan = require("morgan");
const cors = require('cors');
const server = http.createServer(app);
const helmet = require('helmet');

app.use(express.json());
app.use(express.urlencoded({ extended: false}))

// helmet
app.use(helmet()); // for security headers

// trust proxy
app.set('trust proxy', 1); // trust first proxy

// dotenv
require('dotenv').config();

// set up morgan middleware
app.use(morgan("tiny"));

// cors setup
const allowedOrigins = require('./config/origins');
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}))
// mongo connection 
const mongoose = require('mongoose');
const { debug } = require('console');
const socketHandler = require('./lib/socketHandler');
const errorHandler = require('./middleware/errorHandler');
const mongoDB = process.env.MONGO_URI

async function connectMongo() {
    await mongoose.connect(mongoDB);
    debug('Connected Successfully to DB!');
}

connectMongo().catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
});

// pictures stored on this machine (UPLOAD_STORAGE=local, e.g. an offline demo)
const uploadsConfig = require('./config/uploads');
if (uploadsConfig.LOCAL) {
    app.use('/uploads', express.static(uploadsConfig.LOCAL_DIR, {
        maxAge: '7d',
        immutable: true,
        // helmet defaults to same-origin; the app runs on another port, so allow it to embed these
        setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
    }));
}

// routes 
app.get('/', (req, res) => {
    res.json({ message: 'Messaging app API'});
})
app.use('/api',
    indexRoute.login,
    indexRoute.profile,
    indexRoute.imgUpload,
    indexRoute.messages
);

//initialize socket connection
const io = socketHandler(server);
app.set('io', io);

// Error handler middleware
app.use(errorHandler);


const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>  {
   debug(`server running on port ${PORT}`);
})
