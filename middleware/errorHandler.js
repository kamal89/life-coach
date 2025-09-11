// middleware/errorHandler.js - Centralized error handling middleware
const logger = require('../utils/logger');

/**
 * Custom Application Error class
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async error wrapper
 * Wraps async functions to catch errors and pass to error handler
 */
const asyncWrapper = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle Mongoose Cast Errors (Invalid ObjectId)
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

/**
 * Handle Mongoose Duplicate Key Errors
 */
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field} '${value}' already exists. Please use another value.`;
  return new AppError(message, 400);
};

/**
 * Handle Mongoose Validation Errors
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Handle JWT Errors
 */
const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401);
};

/**
 * Handle JWT Expired Errors
 */
const handleJWTExpiredError = () => {
  return new AppError('Your token has expired. Please log in again.', 401);
};

/**
 * Handle OpenAI API Errors
 */
const handleOpenAIError = (err) => {
  let message = 'AI service temporarily unavailable. Please try again later.';
  let statusCode = 503;
  
  if (err.response) {
    switch (err.response.status) {
      case 400:
        message = 'Invalid request to AI service.';
        statusCode = 400;
        break;
      case 401:
        message = 'AI service authentication failed.';
        statusCode = 500; // Don't expose auth issues to client
        break;
      case 429:
        message = 'AI service rate limit exceeded. Please try again later.';
        statusCode = 429;
        break;
      case 500:
      case 502:
      case 503:
        message = 'AI service temporarily unavailable.';
        statusCode = 503;
        break;
    }
  }
  
  return new AppError(message, statusCode);
};

/**
 * Handle Database Connection Errors
 */
const handleDBConnectionError = (err) => {
  logger.error('Database connection error', {
    error: err.message,
    stack: err.stack
  });
  
  return new AppError('Database temporarily unavailable. Please try again later.', 503);
};

/**
 * Handle Rate Limit Errors
 */
const handleRateLimitError = (err) => {
  return new AppError(
    'Too many requests from this IP. Please try again later.',
    429
  );
};

/**
 * Send error response for development
 */
const sendErrorDev = (err, req, res) => {
  // API errors
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      stack: err.stack,
      details: err
    });
  }
  
  // Rendered website errors
  res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message,
    error: err
  });
};

/**
 * Send error response for production
 */
const sendErrorProd = (err, req, res) => {
  // API errors
  if (req.originalUrl.startsWith('/api')) {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        ...(err.statusCode === 429 && { retryAfter: err.retryAfter })
      });
    }
    
    // Programming or other unknown error: don't leak error details
    logger.error('Unexpected error', {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?._id
    });
    
    return res.status(500).json({
      success: false,
      error: 'Something went wrong on our end. Please try again later.'
    });
  }
  
  // Rendered website errors
  if (err.isOperational) {
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: err.message
    });
  }
  
  // Programming or other unknown error
  logger.error('Unexpected error', {
    error: err.message,
    stack: err.stack
  });
  
  res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: 'Please try again later.'
  });
};

/**
 * Global error handling middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    
    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      error = handleDBConnectionError(error);
    }
    if (error.type === 'RateLimitError') error = handleRateLimitError(error);
    if (error.response && error.response.status) error = handleOpenAIError(error);
    
    sendErrorProd(error, req, res);
  }
};

/**
 * Handle unhandled routes (404)
 */
const handleNotFound = (req, res, next) => {
  const err = new AppError(`Can't find ${req.originalUrl} on this server!`, 404);
  next(err);
};

/**
 * Validation error formatter
 */
const formatValidationErrors = (errors) => {
  return errors.map(error => ({
    field: error.path || error.param,
    message: error.msg || error.message,
    value: error.value
  }));
};

/**
 * Database error handler
 */
const handleDatabaseError = (err, req, res, next) => {
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    logger.error('Database error', {
      error: err.message,
      code: err.code,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?._id
    });
    
    // Don't expose database errors to client
    const error = new AppError('Database operation failed. Please try again.', 500);
    return next(error);
  }
  
  next(err);
};

/**
 * Log errors for monitoring
 */
const logErrors = (err, req, res, next) => {
  // Don't log 404s as errors
  if (err.statusCode === 404) {
    logger.warn('Route not found', {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return next(err);
  }
  
  // Log based on severity
  const logLevel = err.statusCode >= 500 ? 'error' : 'warn';
  
  logger[logLevel]('Request error', {
    error: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query
  });
  
  next(err);
};

/**
 * Create standardized error responses
 */
const createErrorResponse = (message, statusCode = 500, details = null) => {
  return {
    success: false,
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
    ...(details && { details })
  };
};

/**
 * Handle specific API errors
 */
const handleAPIError = (error, context = {}) => {
  const { endpoint, operation } = context;
  
  let message = 'An error occurred';
  let statusCode = 500;
  
  // Customize based on error type and context
  if (error.code === 'ECONNREFUSED') {
    message = 'External service unavailable';
    statusCode = 503;
  } else if (error.code === 'ETIMEDOUT') {
    message = 'Request timeout';
    statusCode = 408;
  } else if (error.name === 'ValidationError') {
    message = 'Invalid input data';
    statusCode = 400;
  }
  
  logger.error('API Error', {
    error: error.message,
    code: error.code,
    endpoint,
    operation,
    stack: error.stack
  });
  
  return new AppError(message, statusCode);
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = (server) => {
  return (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close((err) => {
      if (err) {
        logger.error('Error during server shutdown', { error: err.message });
        process.exit(1);
      }
      
      logger.info('Server closed successfully');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
};

/**
 * Process error handlers
 */
const setupProcessErrorHandlers = () => {
  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception! Shutting down...', {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection! Shutting down...', {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  });
  
  // Handle SIGTERM
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Starting graceful shutdown...');
    // Graceful shutdown logic here
  });
};

module.exports = {
  AppError,
  asyncWrapper,
  globalErrorHandler,
  handleNotFound,
  logErrors,
  handleDatabaseError,
  formatValidationErrors,
  createErrorResponse,
  handleAPIError,
  gracefulShutdown,
  setupProcessErrorHandlers
};