// routes/users.js - User management routes
import { Router } from 'express';
const router = Router();
import User from '../../models/User.js';
import Auth from '../../../middleware/auth.js';
import Validation from '../../../middleware/validation.js';
import Logger from '../../../utils/logger.js';
import Multer from 'multer';
import Path from 'path';
import Fs from 'fs';

// Configure multer for file uploads
const storage = Multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = Path.join(__dirname, '../../../uploads/avatars');
    if (!Fs.existsSync(uploadDir)) {
      Fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.user._id + '-' + uniqueSuffix + Path.extname(file.originalname));
  }
});

const upload = Multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(Path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// GET /api/users/profile - Get current user profile
router.get('/profile', Auth.auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

// PATCH /api/users/profile - Update user profile
router.patch('/profile', Auth.auth, Validation.validateUpdateProfile, async (req, res) => {
  try {
    const allowedUpdates = ['name', 'preferences'];
    const updates = Object.keys(req.body);
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).json({
        success: false,
        error: 'Invalid updates'
      });
    }

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update user fields
    updates.forEach(update => {
      if (update === 'preferences') {
        user.preferences = { ...user.preferences, ...req.body.preferences };
      } else {
        user[update] = req.body[update];
      }
    });

    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    Logger.userLogger.profileUpdated(user._id, updates);

    res.json({
      success: true,
      user: userResponse,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// PATCH /api/users/password - Update password
router.patch('/password', Auth.auth, Validation.validatePasswordUpdate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      Logger.authLogger.passwordChangeFailed(user._id, req.ip);
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    Logger.authLogger.passwordChanged(user._id, req.ip);

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update password'
    });
  }
});

// POST /api/users/avatar - Upload avatar
router.post('/avatar', Auth.auth, upload.single('avatar'), Validation.validateFileUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Delete old avatar if exists
    if (user.avatar) {
      const oldAvatarPath = Path.join(__dirname, '../uploads/avatars', Path.basename(user.avatar));
      if (Fs.existsSync(oldAvatarPath)) {
        Fs.unlinkSync(oldAvatarPath);
      }
    }

    // Update user avatar
    user.avatar = `/uploads/avatars/${req.file.filename}`;
    await user.save();

    Logger.userLogger.avatarUpdated(user._id, req.file.filename);

    res.json({
      success: true,
      avatar: user.avatar,
      message: 'Avatar updated successfully'
    });

  } catch (error) {
    console.error('Upload avatar error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      const filePath = req.file.path;
      if (Fs.existsSync(filePath)) {
        Fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to upload avatar'
    });
  }
});

// DELETE /api/users/avatar - Remove avatar
router.delete('/avatar', Auth.auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Delete avatar file
    if (user.avatar) {
      const avatarPath = Path.join(__dirname, '../uploads/avatars', Path.basename(user.avatar));
      if (Fs.existsSync(avatarPath)) {
        Fs.unlinkSync(avatarPath);
      }
    }

    // Remove avatar from user
    user.avatar = null;
    await user.save();

    Logger.userLogger.avatarRemoved(user._id);

    res.json({
      success: true,
      message: 'Avatar removed successfully'
    });

  } catch (error) {
    console.error('Remove avatar error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove avatar'
    });
  }
});

// GET /api/users/stats - Get user statistics
router.get('/stats', Auth.auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('metrics');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Calculate additional stats
    const Goal = require('../models/Goal');
    const Message = require('../models/Message');

    const [goalStats, messageStats] = await Promise.all([
      Goal.aggregate([
        { $match: { userId: user._id } },
        {
          $group: {
            _id: null,
            totalGoals: { $sum: 1 },
            completedGoals: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            activeGoals: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            averageProgress: { $avg: '$progress' }
          }
        }
      ]),
      Message.countDocuments({ userId: user._id, type: 'user' })
    ]);

    const stats = {
      ...user.metrics,
      goals: goalStats[0] || {
        totalGoals: 0,
        completedGoals: 0,
        activeGoals: 0,
        averageProgress: 0
      },
      totalMessages: messageStats,
      accountAge: Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)) // days
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics'
    });
  }
});

// DELETE /api/users/profile - Delete user account
router.delete('/profile', Auth.auth, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify password before deletion
    if (password) {
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid password'
        });
      }
    }

    // Delete user's avatar
    if (user.avatar) {
      const avatarPath = Path.join(__dirname, '../uploads/avatars', Path.basename(user.avatar));
      if (Fs.existsSync(avatarPath)) {
        Fs.unlinkSync(avatarPath);
      }
    }

    // Delete related data
    const Goal = require('../models/Goal');
    const Message = require('../models/Message');
    
    await Promise.all([
      Goal.deleteMany({ userId: user._id }),
      Message.deleteMany({ userId: user._id }),
      User.findByIdAndDelete(user._id)
    ]);

    Logger.userLogger.accountDeleted(user._id, user.email);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
});

// GET /api/users/export - Export user data
router.get('/export', Auth.auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get all user data
    const Goal = require('../models/Goal');
    const Message = require('../models/Message');

    const [goals, messages] = await Promise.all([
      Goal.find({ userId: user._id }).lean(),
      Message.find({ userId: user._id }).lean()
    ]);

    const exportData = {
      user: user.toObject(),
      goals,
      messages,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=lifecoach-data-${user._id}.json`);
    
    res.json({
      success: true,
      data: exportData
    });

  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export data'
    });
  }
});

export default router;