// middleware/validation.js - Input validation middleware
import { body, param, query, validationResult } from 'express-validator';
import { Types } from 'mongoose';
import loggerModule from '../utils/logger.js';

const { logger } = loggerModule;


/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    logger.warn('Validation failed', {
      errors: errorMessages,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errorMessages
    });
  }
  
  next();
};

/**
 * Custom validator for MongoDB ObjectId
 */
const isValidObjectId = (value) => {
  return Types.ObjectId.isValid(value);
};

/**
 * Custom validator for strong password
 */
const isStrongPassword = (value) => {
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongPasswordRegex.test(value);
};

/**
 * Custom validator for goal categories
 */
const isValidGoalCategory = (value) => {
  const validCategories = ['fitness', 'career', 'personal', 'learning', 'relationships', 'finance', 'health'];
  return validCategories.includes(value);
};

/**
 * Custom validator for goal types
 */
const isValidGoalType = (value) => {
  const validTypes = ['short-term', 'long-term'];
  return validTypes.includes(value);
};

/**
 * Custom validator for coaching styles
 */
const isValidCoachingStyle = (value) => {
  const validStyles = ['supportive', 'direct', 'analytical'];
  return validStyles.includes(value);
};

// ============================================================================
// AUTHENTICATION VALIDATIONS
// ============================================================================

const validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
    
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  body('password')
    .custom(isStrongPassword)
    .withMessage('Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
    
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
    
  handleValidationErrors
];

const validatePasswordReset = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  handleValidationErrors
];

const validatePasswordUpdate = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
    
  body('newPassword')
    .custom(isStrongPassword)
    .withMessage('New password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
    
  handleValidationErrors
];

// ============================================================================
// GOAL VALIDATIONS
// ============================================================================

const validateCreateGoal = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Goal title must be between 3 and 200 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
    
  body('category')
    .custom(isValidGoalCategory)
    .withMessage('Invalid goal category'),
    
  body('type')
    .custom(isValidGoalType)
    .withMessage('Goal type must be either "short-term" or "long-term"'),
    
  body('targetDate')
    .optional()
    .isISO8601()
    .withMessage('Target date must be a valid date')
    .custom((value) => {
      const targetDate = new Date(value);
      const today = new Date();
      if (targetDate <= today) {
        throw new Error('Target date must be in the future');
      }
      return true;
    }),
    
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
    
  body('milestones')
    .optional()
    .isArray()
    .withMessage('Milestones must be an array'),
    
  body('milestones.*.text')
    .if(body('milestones').exists())
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Milestone text must be between 3 and 200 characters'),
    
  body('milestones.*.dueDate')
    .if(body('milestones').exists())
    .optional()
    .isISO8601()
    .withMessage('Milestone due date must be a valid date'),
    
  handleValidationErrors
];

const validateUpdateGoal = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('Invalid goal ID'),
    
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Goal title must be between 3 and 200 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
    
  body('category')
    .optional()
    .custom(isValidGoalCategory)
    .withMessage('Invalid goal category'),
    
  body('status')
    .optional()
    .isIn(['active', 'paused', 'completed', 'archived'])
    .withMessage('Invalid goal status'),
    
  body('targetDate')
    .optional()
    .isISO8601()
    .withMessage('Target date must be a valid date'),
    
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
    
  handleValidationErrors
];

const validateUpdateProgress = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('Invalid goal ID'),
    
  body('progress')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Progress must be a number between 0 and 100'),
    
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters'),
    
  handleValidationErrors
];

const validateGoalCheckIn = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('Invalid goal ID'),
    
  body('mood')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Mood must be an integer between 1 and 5'),
    
  body('confidence')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Confidence must be an integer between 1 and 5'),
    
  body('obstacles')
    .optional()
    .isArray()
    .withMessage('Obstacles must be an array'),
    
  body('obstacles.*')
    .if(body('obstacles').exists())
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Each obstacle must be between 1 and 200 characters'),
    
  body('wins')
    .optional()
    .isArray()
    .withMessage('Wins must be an array'),
    
  body('wins.*')
    .if(body('wins').exists())
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Each win must be between 1 and 200 characters'),
    
  body('note')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Note cannot exceed 1000 characters'),
    
  handleValidationErrors
];

// ============================================================================
// CHAT VALIDATIONS
// ============================================================================

const validateChatMessage = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
    
  body('conversationId')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Conversation ID must be between 1 and 100 characters'),
    
  handleValidationErrors
];

const validateChatFeedback = [
  body('messageId')
    .custom(isValidObjectId)
    .withMessage('Invalid message ID'),
    
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5'),
    
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Feedback cannot exceed 500 characters'),
    
  handleValidationErrors
];

// ============================================================================
// USER PROFILE VALIDATIONS
// ============================================================================

const validateUpdateProfile = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
    
  body('preferences.coachingStyle')
    .optional()
    .custom(isValidCoachingStyle)
    .withMessage('Invalid coaching style'),
    
  body('preferences.reminderFrequency')
    .optional()
    .isIn(['daily', 'weekly', 'biweekly'])
    .withMessage('Reminder frequency must be daily, weekly, or biweekly'),
    
  body('preferences.focusAreas')
    .optional()
    .isArray()
    .withMessage('Focus areas must be an array'),
    
  body('preferences.focusAreas.*')
    .if(body('preferences.focusAreas').exists())
    .isLength({ min: 1, max: 50 })
    .withMessage('Each focus area must be between 1 and 50 characters'),
    
  handleValidationErrors
];

// ============================================================================
// QUERY VALIDATIONS
// ============================================================================

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  handleValidationErrors
];

const validateGoalQuery = [
  query('status')
    .optional()
    .isIn(['active', 'paused', 'completed', 'archived'])
    .withMessage('Invalid status filter'),
    
  query('category')
    .optional()
    .custom(isValidGoalCategory)
    .withMessage('Invalid category filter'),
    
  query('type')
    .optional()
    .custom(isValidGoalType)
    .withMessage('Invalid type filter'),
    
  ...validatePagination
];

const validateChatHistory = [
  query('conversationId')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Invalid conversation ID'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  handleValidationErrors
];

// ============================================================================
// FILE UPLOAD VALIDATIONS
// ============================================================================

const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type. Only JPEG, PNG, and GIF are allowed.'
    });
  }

  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      error: 'File too large. Maximum size is 5MB.'
    });
  }

  next();
};

export default {
  // Authentication
  validateRegister,
  validateLogin,
  validatePasswordReset,
  validatePasswordUpdate,
  
  // Goals
  validateCreateGoal,
  validateUpdateGoal,
  validateUpdateProgress,
  validateGoalCheckIn,
  
  // Chat
  validateChatMessage,
  validateChatFeedback,
  
  // User Profile
  validateUpdateProfile,
  
  // Queries
  validatePagination,
  validateGoalQuery,
  validateChatHistory,
  
  // File Upload
  validateFileUpload,
  
  // Utility
  handleValidationErrors,
  isValidObjectId,
  isStrongPassword
};