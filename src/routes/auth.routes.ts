/**
 * @file Auth Routes
 * @description Authentication and user management endpoints
 */

import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';
import { signupValidation, signinValidation, validate } from '../middleware/validation';
import { body } from 'express-validator';

const router = Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Register new user account
 * @access  Public
 */
router.post('/signup', signupValidation, authController.signup);

/**
 * @route   POST /api/auth/signin
 * @desc    Sign in user and get tokens
 * @access  Public
 */
router.post('/signin', signinValidation, authController.signin);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post(
  '/refresh',
  [body('refreshToken').trim().notEmpty().withMessage('Refresh token required'), validate],
  authController.refreshAccessToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout and invalidate refresh token
 * @access  Private
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, authController.getProfile);

export default router;
