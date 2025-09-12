// utils/logger.js - Simple logger
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = join(__dirname, '../logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// Simple logger class
class SimpleLogger {
  constructor() {
    this.logFile = join(logsDir, 'app.log');
  }

  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };

    // Console output with colors
    const colors = {
      error: '\x1b[31m',
      warn: '\x1b[33m',
      info: '\x1b[36m',
      debug: '\x1b[37m',
      reset: '\x1b[0m'
    };

    const color = colors[level] || colors.reset;
    console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
    
    if (Object.keys(meta).length > 0) {
      console.log('  ', JSON.stringify(meta, null, 2));
    }

    // Write to file (optional)
    try {
      appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      // Ignore file write errors
    }
  }

  error(message, meta = {}) { this.log('error', message, meta); }
  warn(message, meta = {}) { this.log('warn', message, meta); }
  info(message, meta = {}) { this.log('info', message, meta); }
  debug(message, meta = {}) { 
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, meta);
    }
  }
  http(message, meta = {}) { this.log('http', message, meta); }
}

// Create logger instance
const logger = new SimpleLogger();

// HTTP request logger middleware
const httpLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  next();
};

// Specialized loggers
const goalLogger = {
  created: (goalData, userId) => logger.info('Goal created', { goalId: goalData._id, userId }),
  updated: (goalId, changes, userId) => logger.info('Goal updated', { goalId, changes, userId }),
  progressUpdated: (goalId, oldProgress, newProgress, userId) => logger.info('Goal progress updated', { goalId, oldProgress, newProgress, userId }),
  completed: (goalId, userId) => logger.info('Goal completed', { goalId, userId })
};

const chatLogger = {
  messageReceived: (messageData, userId) => logger.info('Chat message received', { messageId: messageData._id, userId }),
  aiResponse: (responseData, processingTime, userId) => logger.info('AI response generated', { responseId: responseData._id, userId }),
  feedback: (messageId, rating, userId) => logger.info('Chat feedback received', { messageId, rating, userId })
};

const authLogger = {
  login: (userId, email, ip) => logger.info('User login', { userId, email, ip }),
  loginFailed: (email, reason, ip) => logger.warn('Login failed', { email, reason, ip }),
  register: (userId, email, ip) => logger.info('User registered', { userId, email, ip }),
  logout: (userId, ip) => logger.info('User logout', { userId, ip }),
  passwordChanged: (userId, ip) => logger.info('Password changed', { userId, ip }),
  passwordChangeFailed: (userId, ip) => logger.warn('Password change failed', { userId, ip })
};

const userLogger = {
  profileUpdated: (userId, changes) => logger.info('Profile updated', { userId, changes }),
  avatarUpdated: (userId, filename) => logger.info('Avatar updated', { userId, filename }),
  avatarRemoved: (userId) => logger.info('Avatar removed', { userId }),
  accountDeleted: (userId, email) => logger.info('Account deleted', { userId, email })
};

const securityLogger = {
  suspiciousActivity: (activity, details, ip, userAgent) => logger.warn('Suspicious activity', { activity, details, ip }),
  rateLimitExceeded: (ip, endpoint, userAgent) => logger.warn('Rate limit exceeded', { ip, endpoint }),
  bruteForceAttempt: (ip, email, attemptCount) => logger.warn('Brute force attempt', { ip, email, attemptCount })
};

const performanceLogger = {
  dbQuery: (query, duration) => { if (duration > 1000) logger.warn('Slow query', { query, duration }); },
  apiCall: (service, endpoint, duration, statusCode) => logger.debug('API call', { service, endpoint, duration, statusCode })
};

const metricsLogger = {
  dataExported: (userId, format) => logger.info('Data exported', { userId, format })
};

export default {
  logger,
  httpLogger,
  goalLogger,
  chatLogger,
  authLogger,
  userLogger,
  securityLogger,
  performanceLogger,
  metricsLogger
};