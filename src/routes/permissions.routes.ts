/**
 * @file Permissions Routes
 * @description Access permission management endpoints
 */

import { Router } from 'express';
import * as permissionsController from '../controllers/permissions.controller';
import { authenticateToken, requirePatient } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();

/**
 * @route   POST /api/permissions
 * @desc    Grant permission to access records
 * @access  Private (Patient only)
 */
router.post(
  '/',
  authenticateToken,
  requirePatient,
  [
    body('grantedTo')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid grantee address required'),
    body('recordIds').isArray({ min: 1 }).withMessage('Record IDs array required'),
    body('recordIds.*').isInt({ min: 0 }).withMessage('Record IDs must be non-negative integers'),
    body('expirationTime')
      .isInt({ min: Math.floor(Date.now() / 1000) })
      .withMessage('Expiration time must be future timestamp'),
    body('wrappedKey').trim().notEmpty().withMessage('Wrapped key required'),
    validate,
  ],
  permissionsController.grantPermission
);

/**
 * @route   POST /api/permissions/signature
 * @desc    Grant permission with EIP-712 signature
 * @access  Public (signature-based)
 */
router.post(
  '/signature',
  [
    body('patientAddress')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid patient address required'),
    body('grantedTo')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid grantee address required'),
    body('recordIds').isArray({ min: 1 }).withMessage('Record IDs array required'),
    body('recordIds.*').isInt({ min: 0 }).withMessage('Record IDs must be non-negative integers'),
    body('wrappedKey').trim().notEmpty().withMessage('Wrapped key required'),
    body('expirationTime')
      .isInt({ min: Math.floor(Date.now() / 1000) })
      .withMessage('Expiration time must be future timestamp'),
    body('nonce').trim().notEmpty().withMessage('Nonce required'),
    body('signature').trim().notEmpty().withMessage('Signature required'),
    validate,
  ],
  permissionsController.grantPermissionWithSignature
);

/**
 * @route   DELETE /api/permissions/:permissionId
 * @desc    Revoke permission
 * @access  Private (Patient only)
 */
router.delete(
  '/:permissionId',
  authenticateToken,
  requirePatient,
  [
    param('permissionId').isInt({ min: 0 }).withMessage('Permission ID must be non-negative integer'),
    validate,
  ],
  permissionsController.revokePermission
);

/**
 * @route   GET /api/permissions/check/:recordId
 * @desc    Check if user has access to record
 * @access  Private
 */
router.get(
  '/check/:recordId',
  authenticateToken,
  [
    param('recordId').isInt({ min: 0 }).withMessage('Record ID must be non-negative integer'),
    query('patientAddress')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid patient address required'),
    validate,
  ],
  permissionsController.checkAccess
);

/**
 * @route   GET /api/permissions/granted
 * @desc    List all permissions granted by patient
 * @access  Private (Patient only)
 */
router.get(
  '/granted',
  authenticateToken,
  requirePatient,
  permissionsController.listGrantedPermissions
);

/**
 * @route   GET /api/permissions/received
 * @desc    List all permissions received by user
 * @access  Private
 */
router.get('/received', authenticateToken, permissionsController.listReceivedPermissions);

/**
 * @route   GET /api/permissions/:permissionId
 * @desc    Get permission details
 * @access  Private
 */
router.get(
  '/:permissionId',
  authenticateToken,
  [
    param('permissionId').isInt({ min: 0 }).withMessage('Permission ID must be non-negative integer'),
    query('patientAddress')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid patient address required'),
    validate,
  ],
  permissionsController.getPermission
);

/**
 * @route   POST /api/permissions/batch
 * @desc    Batch grant permissions to multiple users
 * @access  Private (Patient only)
 */
router.post(
  '/batch',
  authenticateToken,
  requirePatient,
  [
    body('grants').isArray({ min: 1 }).withMessage('Grants array required'),
    body('grants.*.grantedTo')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid grantee address required'),
    body('grants.*.recordIds')
      .isArray({ min: 1 })
      .withMessage('Record IDs array required'),
    body('grants.*.expirationTime')
      .isInt({ min: Math.floor(Date.now() / 1000) })
      .withMessage('Expiration time must be future timestamp'),
    validate,
  ],
  permissionsController.batchGrantPermissions
);

export default router;
