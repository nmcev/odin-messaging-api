const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const indexRoute = require('./routes/index')
const morgan = require("morgan");

const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false}))

// dotenv
require('dotenv').config();

// set up morgan middleware
app.use(morgan("tiny"));

// mongo connection 
const mongoose = require('mongoose');
const { debug } = require('console');
const socketHandler = require('./lib/socketHandler');
const mongoDB = process.env.MONGO_URI

async function connectMongo() {
    await mongoose.connect(mongoDB);
    debug('Connected Successfully to DB!');
}

connectMongo().catch((err) => console.log(err));

// routes 
app.use('/api', indexRoute.login);
app.use('/api', indexRoute.profile);
app.use('/api', indexRoute.imgUpload);

//initialize socket connection
const io = socketHandler(server);

// Error handler middleware
app.use((err, req, res, next) => {
   debug('Error:', err);

    let statusCode = 500;
    let message = 'Internal Server Error';

    if (err.name === 'ValidationError') {
        statusCode = 400; 
        message = err.message;
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401; 
        message = 'Unauthorized Access';
    }
    
    res.status(statusCode).json({ error: message });
});


const PORT = 3000;
server.listen(PORT, () =>  {
   debug(`server running on port ${PORT}`);
})