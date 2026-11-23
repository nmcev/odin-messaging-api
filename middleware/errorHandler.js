const debug = require('debug')('app:error');

const errorHandler = (err, req, res, next) => {
    debug('Error:', err);
    console.error(err);

    let statusCode = 500;
    let message = 'Internal Server Error';

    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message;
    } else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid id';
    } else if (err.code === 11000) {
        statusCode = 409;
        message = 'Duplicate value';
    } else if (err.name === 'MulterError') {
        statusCode = 400;
        message = err.message;
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized Access';
    }

    res.status(statusCode).json({ error: message });
};

module.exports = errorHandler;