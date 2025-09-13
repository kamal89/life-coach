// middleware/security.js - Security and rate limiting middleware
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import hpp from 'hpp';
import loggerModule from '../utils/logger.js';

const { logger } = loggerModule;

/**
 * Basic security middleware using Helmet
 */
const basicSecurity = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.openai.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false // Allow embedding for development
});

/**
 * General API rate limiting
 */
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 15 * 60
    });
  }
});

/**
 * Strict rate limiting for authentication endpoints
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60
  },
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      body: { email: req.body.email } // Log email but not password
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: 15 * 60
    });
  }
});

/**
 * Rate limiting for chat/AI endpoints (more restrictive)
 */
const chatRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

/**
 * Progressive delay for repeated requests
 */
const progressiveDelay = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 10, // allow 10 requests per windowMs without delay
  delayMs: () => 500, // Updated syntax
  validate: { delayMs: false }
});

/**
 * XSS Protection middleware
 */
const xssProtection = (req, res, next) => {
  // Clean request body
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    }
  }
  
  // Clean query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    }
  }
  
  next();
};

/**
 * IP Whitelist middleware for admin endpoints
 */
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      logger.warn('Blocked request from non-whitelisted IP', {
        ip: clientIP,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(403).json({
        success: false,
        error: 'Access denied from this IP address.'
      });
    }
    
    next();
  };
};

/**
 * Request size limiter
 */
const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length']);
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      logger.warn('Request size limit exceeded', {
        ip: req.ip,
        contentLength,
        maxBytes,
        endpoint: req.originalUrl
      });
      
      return res.status(413).json({
        success: false,
        error: 'Request entity too large.'
      });
    }
    
    next();
  };
};

/**
 * Parse size string to bytes
 */
const parseSize = (size) => {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  
  const match = size.toString().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmg]?b)$/);
  if (!match) return 0;
  
  return parseFloat(match[1]) * (units[match[2]] || 1);
};

/**
 * CORS configuration
 */
const corsOptions = {
  origin: (origin, callback) => {
    
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001'];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS BLOCKED:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Feature policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id,
    timestamp: new Date().toISOString()
  });
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?._id
    });
    
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Error logging middleware
 */
const errorLogger = (err, req, res, next) => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id,
    body: req.body
  });
  
  next(err);
};

/**
 * Suspicious activity detection
 */
const suspiciousActivityDetector = (req, res, next) => {
  const suspiciousPatterns = [
    /(\<script\>)|(\<\/script\>)/gi, // XSS attempts
    /(\bunion\b)|(\bselect\b)|(\bdrop\b)|(\binsert\b)|(\bdelete\b)/gi, // SQL injection
    /(\.\.\/)|(\.\.\\)/g, // Path traversal
    /(%3C)|(%3E)|(%22)|(%27)/gi, // URL encoded suspicious chars
  ];
  
  const checkString = JSON.stringify(req.body) + req.originalUrl + JSON.stringify(req.query);
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      logger.warn('Suspicious activity detected', {
        pattern: pattern.toString(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        body: req.body,
        query: req.query
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid request format.'
      });
    }
  }
  
  next();
};

/**
 * Brute force protection for specific endpoints
 */
const bruteForceProtection = (options = {}) => {
  const {
    maxAttempts = 5,
    windowMs = 15 * 60 * 1000, // 15 minutes
    blockDuration = 30 * 60 * 1000 // 30 minutes
  } = options;
  
  const attempts = new Map();
  const blocked = new Map();
  
  return (req, res, next) => {
    const key = req.ip + ':' + (req.body.email || req.body.username || 'unknown');
    const now = Date.now();
    
    // Check if IP is currently blocked
    if (blocked.has(key)) {
      const blockInfo = blocked.get(key);
      if (now < blockInfo.until) {
        const remainingTime = Math.ceil((blockInfo.until - now) / 1000);
        
        logger.warn('Blocked brute force attempt', {
          ip: req.ip,
          email: req.body.email,
          remainingTime
        });
        
        return res.status(429).json({
          success: false,
          error: 'Too many failed attempts. Account temporarily locked.',
          retryAfter: remainingTime
        });
      } else {
        // Block expired, remove it
        blocked.delete(key);
      }
    }
    
    // Track failed attempts
    res.on('finish', () => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        const attemptInfo = attempts.get(key) || { count: 0, firstAttempt: now };
        
        // Reset if window expired
        if (now - attemptInfo.firstAttempt > windowMs) {
          attemptInfo.count = 1;
          attemptInfo.firstAttempt = now;
        } else {
          attemptInfo.count++;
        }
        
        attempts.set(key, attemptInfo);
        
        // Block if max attempts reached
        if (attemptInfo.count >= maxAttempts) {
          blocked.set(key, { until: now + blockDuration });
          attempts.delete(key);
          
          logger.warn('IP blocked due to brute force', {
            ip: req.ip,
            email: req.body.email,
            attempts: attemptInfo.count,
            blockDuration: blockDuration / 1000
          });
        }
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        // Success, clear attempts
        attempts.delete(key);
      }
    });
    
    next();
  };
};

/**
 * API key validation middleware
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];
  
  if (validApiKeys.length > 0 && !validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempt', {
      ip: req.ip,
      providedKey: apiKey ? apiKey.substring(0, 8) + '...' : 'none',
      userAgent: req.get('User-Agent')
    });
    
    return res.status(401).json({
      success: false,
      error: 'Invalid API key.'
    });
  }
  
  next();
};

/**
 * Content type validation
 */
const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      const contentType = req.headers['content-type'];
      
      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        return res.status(415).json({
          success: false,
          error: 'Unsupported content type.'
        });
      }
    }
    
    next();
  };
};

/**
 * User agent validation (block known bots/scrapers)
 */
const validateUserAgent = (req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  
  const blockedPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /wget/i,
    /curl/i
  ];
  
  // Allow specific legitimate bots if needed
  const allowedBots = [
    /googlebot/i,
    /bingbot/i
  ];
  
  const isBlockedBot = blockedPatterns.some(pattern => pattern.test(userAgent));
  const isAllowedBot = allowedBots.some(pattern => pattern.test(userAgent));
  
  if (isBlockedBot && !isAllowedBot) {
    logger.warn('Blocked bot/scraper', {
      ip: req.ip,
      userAgent,
      url: req.originalUrl
    });
    
    return res.status(403).json({
      success: false,
      error: 'Access denied.'
    });
  }
  
  next();
};

/**
 * Clean up expired entries periodically
 */
const cleanupExpiredEntries = () => {
  // This should be called periodically (e.g., via cron job)
  // Clean up expired rate limit entries, blocks, etc.
  logger.info('Cleaning up expired security entries');
};

// Export all middleware
export default {
  // Basic security
  basicSecurity,
  securityHeaders,
  corsOptions,
  
  // Rate limiting
  generalRateLimit,
  authRateLimit,
  chatRateLimit,
  progressiveDelay,
  
  // Input protection
  xssProtection: [mongoSanitize(), hpp(), xssProtection],
  suspiciousActivityDetector,
  validateContentType,
  
  // Access control
  ipWhitelist,
  validateApiKey,
  validateUserAgent,
  bruteForceProtection,
  
  // Monitoring
  requestLogger,
  errorLogger,
  requestSizeLimit,
  
  // Utilities
  cleanupExpiredEntries
};