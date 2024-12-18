/**
 * @file Validation Middleware
 * @description Request validation using express-validator
 */

import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * Check validation results
 */
export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  next();
}

/**
 * Validation rules for user signup
 */
export const signupValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 255 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
  body('role').isIn(['patient', 'doctor']).withMessage('Role must be patient or doctor'),
  body('publicKey')
    .matches(/^0x04[a-fA-F0-9]{128}$/)
    .withMessage('Invalid public key format (must be 65-byte uncompressed secp256k1)'),
  validate,
];

/**
 * Validation rules for user signin
 */
export const signinValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

/**
 * Validation rules for adding a record
 */
export const addRecordValidation = [
  body('fhirResource').isObject().withMessage('FHIR resource must be an object'),
  body('fhirResource.resourceType').notEmpty().withMessage('FHIR resourceType is required'),
  body('metadata').optional().isObject(),
  validate,
];

/**
 * Validation rules for granting permission
 */
export const grantPermissionValidation = [
  body('grantedTo')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid Ethereum address'),
  body('recordIds')
    .isArray({ min: 1 })
    .withMessage('At least one record ID required'),
  body('recordIds.*').isInt({ min: 0 }).withMessage('Record IDs must be non-negative integers'),
  body('expirationTime')
    .isInt({ min: Date.now() / 1000 })
    .withMessage('Expiration must be in the future'),
  body('signature').optional().matches(/^0x[a-fA-F0-9]{130}$/),
  validate,
];

/**
 * Validation rules for revoking permission
 */
export const revokePermissionValidation = [
  param('permissionId').isInt({ min: 0 }).withMessage('Invalid permission ID'),
  validate,
];

/**
 * Validation rules for emergency access
 */
export const emergencyAccessValidation = [
  body('physician1')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid physician1 address'),
  body('physician2')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid physician2 address'),
  body('recordIds')
    .isArray({ min: 1 })
    .withMessage('At least one record ID required'),
  body('justificationCode')
    .isInt({ min: 1, max: 3 })
    .withMessage('Justification code must be 1 (Trauma), 2 (Unconscious), or 3 (Critical)'),
  validate,
];

/**
 * Validation rules for record ID param
 */
export const recordIdValidation = [
  param('recordId').isInt({ min: 0 }).withMessage('Invalid record ID'),
  validate,
];

/**
 * Validation rules for wallet address param
 */
export const walletAddressValidation = [
  param('address')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid Ethereum address'),
  validate,
];

/**
 * Validation rules for pagination
 */
export const paginationValidation = [
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validate,
];
