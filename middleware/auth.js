// middleware/auth.js - JWT Authentication middleware
import Jsonwebtoken from 'jsonwebtoken';
import User from '../backend/models/User.js';
import loggerModule from '../utils/logger.js';

const { logger } = loggerModule;

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user to request object
 */
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access denied. No token provided.' 
      });
    }

    // Extract token (Bearer <token>)
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7, authHeader.length) 
      : authHeader;

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access denied. Invalid token format.' 
      });
    }

    // Jsonwebtoken.verify token
    const decoded = Jsonwebtoken.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token is valid but user not found.' 
      });
    }

    // Check if user account is active
    if (user.status === 'suspended' || user.status === 'deleted') {
      return res.status(403).json({
        success: false,
        error: 'Account has been suspended or deleted.'
      });
    }

    // Update last active timestamp
    user.metrics.lastActive = new Date();
    await user.save();

    // Attach user to request
    req.user = user;
    req.token = token;
    
    logger.info('User authenticated', {
      userId: user._id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token.' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token has expired.' 
      });
    }

    logger.error('Authentication error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });

    res.status(500).json({ 
      success: false, 
      error: 'Authentication failed.' 
    });
  }
};

/**
 * Optional Authentication Middleware
 * Attaches user if token is valid, but doesn't block request if not
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return next();
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7, authHeader.length) 
      : authHeader;

    if (!token) {
      return next();
    }

    const decoded = Jsonwebtoken.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user && user.status !== 'suspended' && user.status !== 'deleted') {
      req.user = user;
      req.token = token;
    }

    next();
  } catch (error) {
    // Log error but don't block request
    logger.warn('Optional auth failed', {
      error: error.message,
      ip: req.ip
    });
    next();
  }
};

/**
 * Admin Role Check Middleware
 * Requires user to be authenticated and have admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required.'
    });
  }

  next();
};

/**
 * Role-based Access Control
 * @param {Array} roles - Array of allowed roles
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Resource Owner Check
 * Ensures user can only access their own resources
 */
const requireOwnership = (resourceUserIdField = 'userId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required.'
        });
      }

      // Admin can access any resource
      if (req.user.role === 'admin') {
        return next();
      }

      // Check if user owns the resource
      const resourceUserId = req.params.userId || req.body[resourceUserIdField] || req.query.userId;
      
      if (resourceUserId && resourceUserId !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only access your own resources.'
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership check error', {
        error: error.message,
        userId: req.user?._id,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Authorization check failed.'
      });
    }
  };
};

export default {
  auth,
  optionalAuth,
  requireAdmin,
  requireRole,
  requireOwnership
};