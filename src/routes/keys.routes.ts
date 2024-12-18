/**
 * @file Keys Routes
 * @description Cryptographic key management endpoints
 */

import { Router } from 'express';
import * as keysController from '../controllers/keys.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { body, param } from 'express-validator';

const router = Router();

/**
 * @route   POST /api/keys
 * @desc    Register public key on blockchain
 * @access  Private
 */
router.post(
  '/',
  authenticateToken,
  [
    body('publicKey')
      .matches(/^0x04[a-fA-F0-9]{128}$/)
      .withMessage('Valid secp256k1 public key required (65 bytes, uncompressed)'),
    validate,
  ],
  keysController.registerKey
);

/**
 * @route   PUT /api/keys
 * @desc    Rotate public key to new key
 * @access  Private
 */
router.put(
  '/',
  authenticateToken,
  [
    body('newPublicKey')
      .matches(/^0x04[a-fA-F0-9]{128}$/)
      .withMessage('Valid secp256k1 public key required (65 bytes, uncompressed)'),
    validate,
  ],
  keysController.rotateKey
);

/**
 * @route   DELETE /api/keys
 * @desc    Revoke public key (emergency)
 * @access  Private
 */
router.delete('/', authenticateToken, keysController.revokeKey);

/**
 * @route   GET /api/keys/me
 * @desc    Get current user's key info
 * @access  Private
 */
router.get('/me', authenticateToken, keysController.getMyKey);

/**
 * @route   GET /api/keys/:address
 * @desc    Get public key for any user
 * @access  Public
 */
router.get(
  '/:address',
  [
    param('address')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid Ethereum address required'),
    validate,
  ],
  keysController.getPublicKey
);

/**
 * @route   POST /api/keys/batch
 * @desc    Batch get public keys for multiple addresses
 * @access  Public
 */
router.post(
  '/batch',
  [
    body('addresses').isArray({ min: 1, max: 50 }).withMessage('Addresses array required (max 50)'),
    body('addresses.*')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid Ethereum addresses required'),
    validate,
  ],
  keysController.batchGetPublicKeys
);

/**
 * @route   GET /api/keys/:address/history
 * @desc    Get key rotation history for user
 * @access  Public
 */
router.get(
  '/:address/history',
  [
    param('address')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid Ethereum address required'),
    validate,
  ],
  keysController.getKeyHistory
);

export default router;
