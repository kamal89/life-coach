// src/utils/constants.js - Application constants and configuration

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  WS_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:5000',
  TIMEOUT: parseInt(process.env.REACT_APP_API_TIMEOUT) || 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// Application Information
export const APP_INFO = {
  NAME: process.env.REACT_APP_NAME || 'AI Life Coach',
  VERSION: process.env.REACT_APP_VERSION || '1.0.0',
  DESCRIPTION: process.env.REACT_APP_DESCRIPTION || 'Your personal AI-powered life coach',
  AUTHOR: 'AI Life Coach Team',
  SUPPORT_EMAIL: 'support@ai-lifecoach.com',
};

// Goal Categories
export const GOAL_CATEGORIES = {
  FITNESS: 'fitness',
  CAREER: 'career',
  PERSONAL: 'personal',
  LEARNING: 'learning',
  RELATIONSHIPS: 'relationships',
  FINANCE: 'finance',
  HEALTH: 'health',
  CREATIVITY: 'creativity',
  TRAVEL: 'travel',
  SPIRITUALITY: 'spirituality',
};

export const GOAL_CATEGORY_LABELS = {
  [GOAL_CATEGORIES.FITNESS]: 'Fitness & Exercise',
  [GOAL_CATEGORIES.CAREER]: 'Career & Professional',
  [GOAL_CATEGORIES.PERSONAL]: 'Personal Development',
  [GOAL_CATEGORIES.LEARNING]: 'Learning & Education',
  [GOAL_CATEGORIES.RELATIONSHIPS]: 'Relationships & Social',
  [GOAL_CATEGORIES.FINANCE]: 'Finance & Money',
  [GOAL_CATEGORIES.HEALTH]: 'Health & Wellness',
  [GOAL_CATEGORIES.CREATIVITY]: 'Creativity & Arts',
  [GOAL_CATEGORIES.TRAVEL]: 'Travel & Adventure',
  [GOAL_CATEGORIES.SPIRITUALITY]: 'Spirituality & Mindfulness',
};

export const GOAL_CATEGORY_ICONS = {
  [GOAL_CATEGORIES.FITNESS]: '💪',
  [GOAL_CATEGORIES.CAREER]: '💼',
  [GOAL_CATEGORIES.PERSONAL]: '🎯',
  [GOAL_CATEGORIES.LEARNING]: '📚',
  [GOAL_CATEGORIES.RELATIONSHIPS]: '❤️',
  [GOAL_CATEGORIES.FINANCE]: '💰',
  [GOAL_CATEGORIES.HEALTH]: '🏥',
  [GOAL_CATEGORIES.CREATIVITY]: '🎨',
  [GOAL_CATEGORIES.TRAVEL]: '✈️',
  [GOAL_CATEGORIES.SPIRITUALITY]: '🧘',
};

export const GOAL_CATEGORY_COLORS = {
  [GOAL_CATEGORIES.FITNESS]: 'bg-red-100 text-red-800',
  [GOAL_CATEGORIES.CAREER]: 'bg-blue-100 text-blue-800',
  [GOAL_CATEGORIES.PERSONAL]: 'bg-purple-100 text-purple-800',
  [GOAL_CATEGORIES.LEARNING]: 'bg-green-100 text-green-800',
  [GOAL_CATEGORIES.RELATIONSHIPS]: 'bg-pink-100 text-pink-800',
  [GOAL_CATEGORIES.FINANCE]: 'bg-yellow-100 text-yellow-800',
  [GOAL_CATEGORIES.HEALTH]: 'bg-teal-100 text-teal-800',
  [GOAL_CATEGORIES.CREATIVITY]: 'bg-orange-100 text-orange-800',
  [GOAL_CATEGORIES.TRAVEL]: 'bg-cyan-100 text-cyan-800',
  [GOAL_CATEGORIES.SPIRITUALITY]: 'bg-indigo-100 text-indigo-800',
};

// Goal Types
export const GOAL_TYPES = {
  SHORT_TERM: 'short-term',
  LONG_TERM: 'long-term',
};

export const GOAL_TYPE_LABELS = {
  [GOAL_TYPES.SHORT_TERM]: 'Short-term (< 6 months)',
  [GOAL_TYPES.LONG_TERM]: 'Long-term (6+ months)',
};

// Goal Status
export const GOAL_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

export const GOAL_STATUS_LABELS = {
  [GOAL_STATUS.ACTIVE]: 'Active',
  [GOAL_STATUS.PAUSED]: 'Paused',
  [GOAL_STATUS.COMPLETED]: 'Completed',
  [GOAL_STATUS.ARCHIVED]: 'Archived',
};

export const GOAL_STATUS_COLORS = {
  [GOAL_STATUS.ACTIVE]: 'text-green-600 bg-green-50 border-green-200',
  [GOAL_STATUS.PAUSED]: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  [GOAL_STATUS.COMPLETED]: 'text-blue-600 bg-blue-50 border-blue-200',
  [GOAL_STATUS.ARCHIVED]: 'text-gray-600 bg-gray-50 border-gray-200',
};

// Goal Priority
export const GOAL_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

export const GOAL_PRIORITY_LABELS = {
  [GOAL_PRIORITY.LOW]: 'Low Priority',
  [GOAL_PRIORITY.MEDIUM]: 'Medium Priority',
  [GOAL_PRIORITY.HIGH]: 'High Priority',
};

export const GOAL_PRIORITY_COLORS = {
  [GOAL_PRIORITY.LOW]: 'text-gray-600 bg-gray-100',
  [GOAL_PRIORITY.MEDIUM]: 'text-yellow-600 bg-yellow-100',
  [GOAL_PRIORITY.HIGH]: 'text-red-600 bg-red-100',
};

// Progress Thresholds
export const PROGRESS_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 70,
  FAIR: 50,
  NEEDS_IMPROVEMENT: 30,
  POOR: 10,
};

export const PROGRESS_LABELS = {
  EXCELLENT: 'Excellent Progress',
  GOOD: 'Good Progress',
  FAIR: 'Fair Progress',
  NEEDS_IMPROVEMENT: 'Needs Improvement',
  POOR: 'Poor Progress',
};

export const PROGRESS_COLORS = {
  EXCELLENT: 'text-green-600 bg-green-100',
  GOOD: 'text-blue-600 bg-blue-100',
  FAIR: 'text-yellow-600 bg-yellow-100',
  NEEDS_IMPROVEMENT: 'text-orange-600 bg-orange-100',
  POOR: 'text-red-600 bg-red-100',
};

// Message Types
export const MESSAGE_TYPES = {
  USER: 'user',
  AI: 'ai',
  SYSTEM: 'system',
};

// Coaching Styles
export const COACHING_STYLES = {
  SUPPORTIVE: 'supportive',
  DIRECT: 'direct',
  ANALYTICAL: 'analytical',
};

export const COACHING_STYLE_LABELS = {
  [COACHING_STYLES.SUPPORTIVE]: 'Supportive & Encouraging',
  [COACHING_STYLES.DIRECT]: 'Direct & Straightforward',
  [COACHING_STYLES.ANALYTICAL]: 'Analytical & Data-driven',
};

export const COACHING_STYLE_DESCRIPTIONS = {
  [COACHING_STYLES.SUPPORTIVE]: 'Gentle encouragement with empathy and positive reinforcement',
  [COACHING_STYLES.DIRECT]: 'Clear, honest feedback with actionable steps',
  [COACHING_STYLES.ANALYTICAL]: 'Data-driven insights with metrics and trends',
};

// Reminder Frequencies
export const REMINDER_FREQUENCIES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
  NEVER: 'never',
};

export const REMINDER_FREQUENCY_LABELS = {
  [REMINDER_FREQUENCIES.DAILY]: 'Daily',
  [REMINDER_FREQUENCIES.WEEKLY]: 'Weekly',
  [REMINDER_FREQUENCIES.BIWEEKLY]: 'Bi-weekly',
  [REMINDER_FREQUENCIES.MONTHLY]: 'Monthly',
  [REMINDER_FREQUENCIES.NEVER]: 'Never',
};

// Time Periods
export const TIME_PERIODS = {
  TODAY: 'today',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
  ALL_TIME: 'all_time',
};

export const TIME_PERIOD_LABELS = {
  [TIME_PERIODS.TODAY]: 'Today',
  [TIME_PERIODS.WEEK]: 'This Week',
  [TIME_PERIODS.MONTH]: 'This Month',
  [TIME_PERIODS.QUARTER]: 'This Quarter',
  [TIME_PERIODS.YEAR]: 'This Year',
  [TIME_PERIODS.ALL_TIME]: 'All Time',
};

// Date Formats
export const DATE_FORMATS = {
  SHORT: 'MMM d',
  MEDIUM: 'MMM d, yyyy',
  LONG: 'MMMM d, yyyy',
  FULL: 'EEEE, MMMM d, yyyy',
  TIME: 'h:mm a',
  DATETIME: 'MMM d, yyyy h:mm a',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
};

// Validation Rules
export const VALIDATION_RULES = {
  GOAL_TITLE: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 200,
  },
  GOAL_DESCRIPTION: {
    MAX_LENGTH: 1000,
  },
  USER_NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true,
  },
  CHAT_MESSAGE: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 2000,
  },
  MILESTONE_TEXT: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 200,
  },
};

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: {
    IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    DOCUMENT: ['application/pdf', 'text/plain'],
  },
  AVATAR_MAX_SIZE: 2 * 1024 * 1024, // 2MB
};

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'token',
  USER_PREFERENCES: 'userPreferences',
  THEME: 'theme',
  DARK_MODE: 'darkMode',
  LAST_VISIT: 'lastVisit',
  ONBOARDING_COMPLETED: 'onboardingCompleted',
  CHAT_SETTINGS: 'chatSettings',
  GOAL_FILTERS: 'goalFilters',
};

// Notification Types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

// Analytics Events
export const ANALYTICS_EVENTS = {
  GOAL_CREATED: 'goal_created',
  GOAL_COMPLETED: 'goal_completed',
  GOAL_UPDATED: 'goal_updated',
  PROGRESS_UPDATED: 'progress_updated',
  MESSAGE_SENT: 'message_sent',
  FEEDBACK_PROVIDED: 'feedback_provided',
  PROFILE_UPDATED: 'profile_updated',
  LOGIN: 'login',
  LOGOUT: 'logout',
  SIGNUP: 'signup',
};

// Feature Flags
export const FEATURES = {
  ANALYTICS: process.env.REACT_APP_ENABLE_ANALYTICS === 'true',
  PWA: process.env.REACT_APP_ENABLE_PWA === 'true',
  OFFLINE: process.env.REACT_APP_ENABLE_OFFLINE === 'true',
  NOTIFICATIONS: process.env.REACT_APP_ENABLE_NOTIFICATIONS === 'true',
  DEBUG: process.env.REACT_APP_DEBUG_MODE === 'true',
  DARK_MODE: process.env.REACT_APP_ENABLE_DARK_MODE === 'true',
};

// UI Constants
export const UI = {
  HEADER_HEIGHT: 64,
  SIDEBAR_WIDTH: 320,
  SIDEBAR_COLLAPSED_WIDTH: 80,
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
  DESKTOP_BREAKPOINT: 1280,
  MAX_CONTENT_WIDTH: 1200,
  ANIMATION_DURATION: 200,
  TOAST_DURATION: 4000,
  DEBOUNCE_DELAY: 300,
  INFINITE_SCROLL_THRESHOLD: 100,
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You need to log in to access this feature.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  TIMEOUT: 'Request timeout. Please try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  GOAL_CREATED: 'Goal created successfully!',
  GOAL_UPDATED: 'Goal updated successfully!',
  GOAL_DELETED: 'Goal deleted successfully!',
  PROGRESS_UPDATED: 'Progress updated successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  PASSWORD_CHANGED: 'Password changed successfully!',
  EMAIL_VERIFIED: 'Email verified successfully!',
  FEEDBACK_SENT: 'Thank you for your feedback!',
  COPIED_TO_CLIPBOARD: 'Copied to clipboard!',
  SETTINGS_SAVED: 'Settings saved successfully!',
};

// Quick Actions
export const QUICK_ACTIONS = [
  {
    id: 'check_progress',
    label: 'Check my progress',
    icon: '📊',
    message: 'How am I doing with my progress this week?',
  },
  {
    id: 'need_motivation',
    label: 'I need motivation',
    icon: '💪',
    message: "I'm feeling stuck and need motivation",
  },
  {
    id: 'set_goal',
    label: 'Set a new goal',
    icon: '🎯',
    message: 'Help me set a new goal',
  },
  {
    id: 'daily_checkin',
    label: 'Daily check-in',
    icon: '✅',
    message: 'Let me share how my day went',
  },
  {
    id: 'overcome_obstacle',
    label: 'Overcome obstacle',
    icon: '🚧',
    message: 'I need help overcoming a challenge',
  },
  {
    id: 'celebrate_win',
    label: 'Celebrate a win',
    icon: '🎉',
    message: 'I want to share a recent achievement',
  },
];

// Default Values
export const DEFAULTS = {
  GOAL: {
    category: GOAL_CATEGORIES.PERSONAL,
    type: GOAL_TYPES.SHORT_TERM,
    status: GOAL_STATUS.ACTIVE,
    priority: GOAL_PRIORITY.MEDIUM,
    progress: 0,
  },
  USER_PREFERENCES: {
    coachingStyle: COACHING_STYLES.SUPPORTIVE,
    reminderFrequency: REMINDER_FREQUENCIES.WEEKLY,
    theme: 'light',
    notifications: true,
    focusAreas: [],
  },
  PAGINATION: {
    page: 1,
    limit: 20,
  },
  CHART_COLORS: [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#10b981', // green
    '#f59e0b', // yellow
    '#ef4444', // red
    '#06b6d4', // cyan
    '#f97316', // orange
    '#84cc16', // lime
  ],
};

// Export all constants as default
export default {
  API_CONFIG,
  APP_INFO,
  GOAL_CATEGORIES,
  GOAL_CATEGORY_LABELS,
  GOAL_CATEGORY_ICONS,
  GOAL_CATEGORY_COLORS,
  GOAL_TYPES,
  GOAL_TYPE_LABELS,
  GOAL_STATUS,
  GOAL_STATUS_LABELS,
  GOAL_STATUS_COLORS,
  GOAL_PRIORITY,
  GOAL_PRIORITY_LABELS,
  GOAL_PRIORITY_COLORS,
  PROGRESS_THRESHOLDS,
  PROGRESS_LABELS,
  PROGRESS_COLORS,
  MESSAGE_TYPES,
  COACHING_STYLES,
  COACHING_STYLE_LABELS,
  COACHING_STYLE_DESCRIPTIONS,
  REMINDER_FREQUENCIES,
  REMINDER_FREQUENCY_LABELS,
  TIME_PERIODS,
  TIME_PERIOD_LABELS,
  DATE_FORMATS,
  VALIDATION_RULES,
  FILE_UPLOAD,
  STORAGE_KEYS,
  NOTIFICATION_TYPES,
  ANALYTICS_EVENTS,
  FEATURES,
  UI,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  QUICK_ACTIONS,
  DEFAULTS,
};