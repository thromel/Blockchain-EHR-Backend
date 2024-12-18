/**
 * @file Emergency Routes
 * @description Emergency access management endpoints (2-physician approval)
 */

import { Router } from 'express';
import * as emergencyController from '../controllers/emergency.controller';
import { authenticateToken, requireDoctor, requirePatientOrAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();

/**
 * @route   POST /api/emergency/request
 * @desc    Request emergency access to patient record
 * @access  Private (Doctor only)
 */
router.post(
  '/request',
  authenticateToken,
  requireDoctor,
  [
    body('patientAddress')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid patient address required'),
    body('recordId').isInt({ min: 0 }).withMessage('Record ID must be non-negative integer'),
    body('justificationCode')
      .isInt({ min: 1, max: 3 })
      .withMessage('Justification code must be 1 (Trauma), 2 (Unconscious), or 3 (Critical)'),
    validate,
  ],
  emergencyController.requestEmergencyAccess
);

/**
 * @route   POST /api/emergency/:grantId/approve
 * @desc    Approve emergency access request (second physician)
 * @access  Private (Doctor only)
 */
router.post(
  '/:grantId/approve',
  authenticateToken,
  requireDoctor,
  [
    param('grantId')
      .matches(/^0x[a-fA-F0-9]{64}$/)
      .withMessage('Valid grant ID required'),
    validate,
  ],
  emergencyController.approveEmergencyAccess
);

/**
 * @route   POST /api/emergency/:grantId/reject
 * @desc    Reject emergency access request
 * @access  Private (Doctor only)
 */
router.post(
  '/:grantId/reject',
  authenticateToken,
  requireDoctor,
  [
    param('grantId')
      .matches(/^0x[a-fA-F0-9]{64}$/)
      .withMessage('Valid grant ID required'),
    body('reason').optional().trim().notEmpty().withMessage('Reason must be non-empty'),
    validate,
  ],
  emergencyController.rejectEmergencyAccess
);

/**
 * @route   GET /api/emergency/pending
 * @desc    List all pending emergency access requests
 * @access  Private (Doctor only)
 */
router.get('/pending', authenticateToken, requireDoctor, emergencyController.listPendingRequests);

/**
 * @route   GET /api/emergency/history
 * @desc    List emergency access history
 * @access  Private (Patient or Admin)
 */
router.get(
  '/history',
  authenticateToken,
  requirePatientOrAdmin,
  [
    query('patientAddress')
      .optional()
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid patient address required'),
    validate,
  ],
  emergencyController.listEmergencyHistory
);

/**
 * @route   GET /api/emergency/:grantId
 * @desc    Get emergency grant details
 * @access  Private
 */
router.get(
  '/:grantId',
  authenticateToken,
  [
    param('grantId')
      .matches(/^0x[a-fA-F0-9]{64}$/)
      .withMessage('Valid grant ID required'),
    validate,
  ],
  emergencyController.getEmergencyGrant
);

export default router;
