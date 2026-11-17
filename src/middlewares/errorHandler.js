function errorHandler(err, req, res, next) {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            status: 'fail',
            message: 'Invalid JSON payload',
        });
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Something went wrong';

    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message,
        ...(err.details && {
            details: err.details
        }),
    });
}

module.exports = errorHandler;