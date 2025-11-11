/**
 * @file Emergency Controller
 * @description Handles emergency access requests (2-physician approval)
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import db from '../services/database';
import { AppError } from '../middleware/errorHandler';
import { PatientRecordsService } from '../services/blockchain/PatientRecordsService';
import * as ecies from '../utils/ecies';
import { KeyRegistryService } from '../services/blockchain/KeyRegistryService';

/**
 * Request emergency access
 * First physician initiates emergency access request
 */
export async function requestEmergencyAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress, role } = req.user!;
    const { patientAddress, recordId, justificationCode } = req.body;

    // Only doctors can request emergency access
    if (role !== 'doctor') {
      throw new AppError('Only doctors can request emergency access', 403, 'FORBIDDEN');
    }

    // Validate justification code (1=Trauma, 2=Unconscious, 3=Critical)
    if (![1, 2, 3].includes(justificationCode)) {
      throw new AppError('Invalid justification code (1-3)', 400, 'INVALID_JUSTIFICATION');
    }

    // Get patient contract address
    const patient = await db.oneOrNone(
      'SELECT patient_contract_address FROM users WHERE wallet_address = $1',
      [patientAddress]
    );

    if (!patient?.patient_contract_address) {
      throw new AppError('Patient contract not found', 404, 'CONTRACT_NOT_FOUND');
    }

    // Generate unique grant ID
    const grantId = '0x' + crypto.randomBytes(32).toString('hex');

    // Calculate expiration (default: 1 hour from now)
    const expirationTime = Math.floor(Date.now() / 1000) + 3600;

    // Store request in database (pending second physician approval)
    await db.none(
      `INSERT INTO emergency_grants (grant_id, patient_wallet, record_id, physician1_wallet, justification_code, expiration, confirmed)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6), FALSE)`,
      [grantId, patientAddress, recordId, walletAddress, justificationCode, expirationTime]
    );

    // Log audit trail
    await db.none(
      `INSERT INTO audit_log (wallet_address, action, details)
       VALUES ($1, $2, $3)`,
      [
        walletAddress,
        'emergency_access_requested',
        {
          grantId,
          patientAddress,
          recordId,
          justificationCode,
        },
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Emergency access requested (awaiting second physician approval)',
      data: {
        grantId,
        patientAddress,
        recordId,
        requestedBy: walletAddress,
        justificationCode,
        expirationTime,
        status: 'pending',
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve emergency access
 * Second physician approves and triggers blockchain grant
 */
export async function approveEmergencyAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress, role } = req.user!;
    const { grantId } = req.params;

    // Only doctors can approve emergency access
    if (role !== 'doctor') {
      throw new AppError('Only doctors can approve emergency access', 403, 'FORBIDDEN');
    }

    // Get grant request
    const grant = await db.oneOrNone(
      `SELECT grant_id, patient_wallet, record_id, physician1_wallet, physician2_wallet,
              justification_code, wrapped_key, expiration, confirmed
       FROM emergency_grants
       WHERE grant_id = $1`,
      [grantId]
    );

    if (!grant) {
      throw new AppError('Emergency grant not found', 404, 'GRANT_NOT_FOUND');
    }

    if (grant.confirmed) {
      throw new AppError('Grant already confirmed', 400, 'ALREADY_CONFIRMED');
    }

    // Cannot approve own request
    if (grant.physician1_wallet.toLowerCase() === walletAddress.toLowerCase()) {
      throw new AppError('Cannot approve your own request', 403, 'SELF_APPROVAL');
    }

    // Check if grant expired
    if (new Date(grant.expiration) < new Date()) {
      throw new AppError('Grant request expired', 400, 'GRANT_EXPIRED');
    }

    // Get patient contract address
    const patient = await db.one(
      'SELECT patient_contract_address FROM users WHERE wallet_address = $1',
      [grant.patient_wallet]
    );

    if (!patient.patient_contract_address) {
      throw new AppError('Patient contract not found', 404, 'CONTRACT_NOT_FOUND');
    }

    const patientRecordsService = new PatientRecordsService(patient.patient_contract_address);
    const keyRegistryService = new KeyRegistryService();

    // Get public keys for both physicians
    const physician1Key = await keyRegistryService.getPublicKey(grant.physician1_wallet);
    const physician2Key = await keyRegistryService.getPublicKey(walletAddress);

    // For emergency access, we need to get the AES key somehow
    // In a real system, this would involve:
    // 1. Patient having pre-authorized emergency key escrow
    // 2. Or using threshold encryption
    // For this implementation, we'll use a placeholder
    const emergencyAesKey = Buffer.from('a'.repeat(64), 'hex'); // Placeholder

    // Wrap key for both physicians
    const physician1PublicKey = Buffer.from(physician1Key.publicKey.replace('0x', ''), 'hex');
    const physician2PublicKey = Buffer.from(physician2Key.publicKey.replace('0x', ''), 'hex');
    const wrappedKeyPhysician1 = await ecies.wrapKey(physician1PublicKey, emergencyAesKey);
    const wrappedKeyPhysician2 = await ecies.wrapKey(physician2PublicKey, emergencyAesKey);

    // Request emergency access on blockchain
    const result = await patientRecordsService.requestEmergencyAccess(
      req.wallet!,
      grant.physician1_wallet,
      walletAddress, // physician2
      [grant.record_id], // recordIds as array
      grant.justification_code,
      wrappedKeyPhysician1 // Using physician1's wrapped key for now
    );

    // Update grant in database
    await db.none(
      `UPDATE emergency_grants
       SET physician2_wallet = $1, wrapped_key = $2, confirmed = TRUE
       WHERE grant_id = $3`,
      [walletAddress, wrappedKeyPhysician1, grantId]
    );

    // Log audit trail
    await db.none(
      `INSERT INTO audit_log (wallet_address, action, transaction_hash, details)
       VALUES ($1, $2, $3, $4)`,
      [
        walletAddress,
        'emergency_access_approved',
        result.transactionHash,
        {
          grantId,
          physician1: grant.physician1_wallet,
          physician2: walletAddress,
          recordId: grant.record_id,
          justificationCode: grant.justification_code,
        },
      ]
    );

    res.json({
      success: true,
      message: 'Emergency access granted successfully',
      data: {
        grantId,
        patientAddress: grant.patient_wallet,
        recordId: grant.record_id,
        physician1: grant.physician1_wallet,
        physician2: walletAddress,
        justificationCode: grant.justification_code,
        expirationTime: Math.floor(new Date(grant.expiration).getTime() / 1000),
        emergencyId: result.emergencyId,
        transactionHash: result.transactionHash,
        status: 'confirmed',
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reject emergency access request
 * Second physician rejects the request
 */
export async function rejectEmergencyAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress, role } = req.user!;
    const { grantId } = req.params;
    const { reason } = req.body;

    // Only doctors can reject emergency access
    if (role !== 'doctor') {
      throw new AppError('Only doctors can reject emergency access', 403, 'FORBIDDEN');
    }

    // Get grant request
    const grant = await db.oneOrNone(
      'SELECT grant_id, physician1_wallet, confirmed FROM emergency_grants WHERE grant_id = $1',
      [grantId]
    );

    if (!grant) {
      throw new AppError('Emergency grant not found', 404, 'GRANT_NOT_FOUND');
    }

    if (grant.confirmed) {
      throw new AppError('Grant already confirmed', 400, 'ALREADY_CONFIRMED');
    }

    // Cannot reject own request
    if (grant.physician1_wallet.toLowerCase() === walletAddress.toLowerCase()) {
      throw new AppError('Cannot reject your own request', 403, 'SELF_REJECTION');
    }

    // Delete grant request
    await db.none('DELETE FROM emergency_grants WHERE grant_id = $1', [grantId]);

    // Log audit trail
    await db.none(
      `INSERT INTO audit_log (wallet_address, action, details)
       VALUES ($1, $2, $3)`,
      [
        walletAddress,
        'emergency_access_rejected',
        {
          grantId,
          reason,
        },
      ]
    );

    res.json({
      success: true,
      message: 'Emergency access request rejected',
      data: {
        grantId,
        rejectedBy: walletAddress,
        reason,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List pending emergency access requests
 * Shows all pending requests awaiting approval
 */
export async function listPendingRequests(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { role } = req.user!;

    // Only doctors can view pending requests
    if (role !== 'doctor') {
      throw new AppError('Only doctors can view pending requests', 403, 'FORBIDDEN');
    }

    // Get pending requests
    const requests = await db.manyOrNone(
      `SELECT eg.grant_id, eg.patient_wallet, eg.record_id, eg.physician1_wallet,
              eg.justification_code, eg.expiration, eg.created_at,
              u1.name AS physician1_name, u2.name AS patient_name
       FROM emergency_grants eg
       JOIN users u1 ON eg.physician1_wallet = u1.wallet_address
       JOIN users u2 ON eg.patient_wallet = u2.wallet_address
       WHERE eg.confirmed = FALSE AND eg.expiration > NOW()
       ORDER BY eg.created_at DESC`
    );

    res.json({
      success: true,
      data: {
        requests,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List emergency access history
 * Shows all emergency grants (for patient or admin)
 */
export async function listEmergencyHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress, role } = req.user!;
    const { patientAddress } = req.query;

    // Patients can only view their own history
    if (role === 'patient' && (!patientAddress || patientAddress !== walletAddress)) {
      throw new AppError('Patients can only view their own history', 403, 'FORBIDDEN');
    }

    // Admins can view any patient's history
    if (role === 'admin' && !patientAddress) {
      throw new AppError('Patient address required for admin', 400, 'MISSING_PATIENT_ADDRESS');
    }

    const targetPatient = (patientAddress as string) || walletAddress;

    // Get emergency access history
    const history = await db.manyOrNone(
      `SELECT eg.grant_id, eg.record_id, eg.physician1_wallet, eg.physician2_wallet,
              eg.justification_code, eg.expiration, eg.confirmed, eg.created_at,
              u1.name AS physician1_name, u2.name AS physician2_name
       FROM emergency_grants eg
       LEFT JOIN users u1 ON eg.physician1_wallet = u1.wallet_address
       LEFT JOIN users u2 ON eg.physician2_wallet = u2.wallet_address
       WHERE eg.patient_wallet = $1
       ORDER BY eg.created_at DESC
       LIMIT 100`,
      [targetPatient]
    );

    res.json({
      success: true,
      data: {
        patientAddress: targetPatient,
        history,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get emergency grant details
 */
export async function getEmergencyGrant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { grantId } = req.params;

    // Get grant details
    const grant = await db.oneOrNone(
      `SELECT eg.grant_id, eg.patient_wallet, eg.record_id, eg.physician1_wallet, eg.physician2_wallet,
              eg.justification_code, eg.expiration, eg.confirmed, eg.created_at,
              u1.name AS physician1_name, u2.name AS physician2_name, u3.name AS patient_name
       FROM emergency_grants eg
       LEFT JOIN users u1 ON eg.physician1_wallet = u1.wallet_address
       LEFT JOIN users u2 ON eg.physician2_wallet = u2.wallet_address
       JOIN users u3 ON eg.patient_wallet = u3.wallet_address
       WHERE eg.grant_id = $1`,
      [grantId]
    );

    if (!grant) {
      throw new AppError('Emergency grant not found', 404, 'GRANT_NOT_FOUND');
    }

    res.json({
      success: true,
      data: grant,
    });
  } catch (error) {
    next(error);
  }
}
