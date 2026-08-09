
const errorHandler = (err, req, res, next) => {
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
};

module.exports = errorHandler;
