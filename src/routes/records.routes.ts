/**
 * @file Records Routes
 * @description Health record management endpoints
 */

import { Router } from 'express';
import * as recordsController from '../controllers/records.controller';
import { authenticateToken, requirePatient } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();

/**
 * @route   POST /api/records
 * @desc    Add new health record
 * @access  Private (Patient only)
 */
router.post(
  '/',
  authenticateToken,
  requirePatient,
  [
    body('fhirData').isObject().withMessage('FHIR data must be an object'),
    body('fhirData.resourceType').trim().notEmpty().withMessage('FHIR resourceType required'),
    body('recipientPublicKeys')
      .optional()
      .isArray()
      .withMessage('Recipient public keys must be an array'),
    validate,
  ],
  recordsController.addRecord
);

/**
 * @route   GET /api/records/:recordId
 * @desc    Get single record with decryption
 * @access  Private (Patient or authorized user)
 */
router.get(
  '/:recordId',
  authenticateToken,
  [
    param('recordId').isInt({ min: 0 }).withMessage('Record ID must be non-negative integer'),
    query('patientAddress')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid patient address required'),
    validate,
  ],
  recordsController.getRecord
);

/**
 * @route   GET /api/records
 * @desc    List all accessible records
 * @access  Private
 */
router.get(
  '/',
  authenticateToken,
  [
    query('patientAddress')
      .optional()
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Invalid patient address'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    validate,
  ],
  recordsController.listRecords
);

/**
 * @route   GET /api/records/:recordId/access-history
 * @desc    Get record access history
 * @access  Private (Patient or Admin)
 */
router.get(
  '/:recordId/access-history',
  authenticateToken,
  [
    param('recordId').isInt({ min: 0 }).withMessage('Record ID must be non-negative integer'),
    query('patientAddress')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid patient address required'),
    validate,
  ],
  recordsController.getRecordAccessHistory
);

/**
 * @route   GET /api/records/search
 * @desc    Search records by FHIR resource type
 * @access  Private
 */
router.get(
  '/search',
  authenticateToken,
  [
    query('patientAddress')
      .optional()
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Invalid patient address'),
    query('resourceType').optional().trim().notEmpty().withMessage('Resource type required'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    validate,
  ],
  recordsController.searchRecords
);

export default router;
