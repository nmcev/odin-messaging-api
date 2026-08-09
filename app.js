const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const indexRoute = require('./routes/index')
const morgan = require("morgan");
const cors = require('cors');
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false}))

// dotenv
require('dotenv').config();

// set up morgan middleware
app.use(morgan("tiny"));

// cors setup
app.use(cors({
    origin: ['http://localhost:5173', 'https://talkmate-odin.netlify.app'],
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

connectMongo().catch((err) => console.log(err));

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

// Error handler middleware
app.use(errorHandler);


const PORT = 3000;
server.listen(PORT, () =>  {
   debug(`server running on port ${PORT}`);
})