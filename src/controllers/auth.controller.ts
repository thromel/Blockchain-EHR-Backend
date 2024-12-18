/**
 * @file Auth Controller
 * @description Handles user authentication (signup, signin, token refresh)
 */

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { Wallet } from 'ethers';
import db from '../services/database';
import { generateToken, generateRefreshToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import config from '../config';
import { KeyRegistryService } from '../services/blockchain/KeyRegistryService';
import { FactoryService } from '../services/blockchain/FactoryService';

/**
 * User signup
 * Creates new user account and registers on blockchain
 */
export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, role, publicKey } = req.body;

    // Check if user already exists
    const existingUser = await db.oneOrNone(
      'SELECT wallet_address FROM users WHERE email = $1',
      [email]
    );

    if (existingUser) {
      throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

    // Generate wallet from private key or create new one
    let wallet: Wallet;
    if (req.body.privateKey) {
      wallet = new Wallet(req.body.privateKey);
    } else {
      wallet = Wallet.createRandom();
    }

    const walletAddress = wallet.address;

    // Register public key on blockchain
    const keyRegistryService = new KeyRegistryService();
    let keyTxHash: string | undefined;

    try {
      const keyResult = await keyRegistryService.registerKey(wallet, publicKey);
      keyTxHash = keyResult;
    } catch (error) {
      console.warn('⚠️ Key registration failed (may already exist):', (error as Error).message);
    }

    // Create patient contract if role is patient
    let patientContractAddress: string | null = null;
    if (role === 'patient') {
      const factoryService = new FactoryService();
      try {
        const result = await factoryService.createPatientContract(wallet, walletAddress);
        patientContractAddress = result.contractAddress;
      } catch (error) {
        console.warn('⚠️ Patient contract creation failed:', (error as Error).message);
      }
    }

    // Create user in database
    await db.none(
      `INSERT INTO users (wallet_address, name, email, password_hash, role, patient_contract_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [walletAddress, name, email, passwordHash, role, patientContractAddress]
    );

    // Log audit trail
    await db.none(
      `INSERT INTO audit_log (wallet_address, action, transaction_hash, details)
       VALUES ($1, $2, $3, $4)`,
      [
        walletAddress,
        'user_signup',
        keyTxHash,
        { email, role, patientContractAddress },
      ]
    );

    // Generate tokens
    const accessToken = generateToken({
      walletAddress,
      email,
      role,
      privateKey: wallet.privateKey, // TODO: Encrypt this in production
    });

    const refreshToken = generateRefreshToken({
      walletAddress,
      email,
      role,
    });

    // Store refresh token in sessions
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db.none(
      `INSERT INTO sessions (wallet_address, refresh_token, expires_at)
       VALUES ($1, $2, $3)`,
      [walletAddress, refreshToken, expiresAt]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        walletAddress,
        name,
        email,
        role,
        patientContractAddress,
        privateKey: wallet.privateKey, // Send only once at signup
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * User signin
 * Authenticates user and returns JWT tokens
 */
export async function signin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, privateKey } = req.body;

    // Get user from database
    const user = await db.oneOrNone(
      `SELECT wallet_address, name, email, password_hash, role, patient_contract_address
       FROM users WHERE email = $1`,
      [email]
    );

    if (!user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Verify privateKey if provided (optional but recommended)
    if (privateKey) {
      const wallet = new Wallet(privateKey);
      if (wallet.address.toLowerCase() !== user.wallet_address.toLowerCase()) {
        throw new AppError('Invalid private key', 401, 'INVALID_PRIVATE_KEY');
      }
    }

    // Generate tokens
    const accessToken = generateToken({
      walletAddress: user.wallet_address,
      email: user.email,
      role: user.role,
      privateKey: privateKey || undefined, // Include if provided
    });

    const refreshToken = generateRefreshToken({
      walletAddress: user.wallet_address,
      email: user.email,
      role: user.role,
    });

    // Store refresh token in sessions
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db.none(
      `INSERT INTO sessions (wallet_address, refresh_token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet_address)
       DO UPDATE SET refresh_token = $2, expires_at = $3`,
      [user.wallet_address, refreshToken, expiresAt]
    );

    // Log audit trail
    await db.none(
      `INSERT INTO audit_log (wallet_address, action, details)
       VALUES ($1, $2, $3)`,
      [user.wallet_address, 'user_signin', { email }]
    );

    res.json({
      success: true,
      message: 'Signin successful',
      data: {
        walletAddress: user.wallet_address,
        name: user.name,
        email: user.email,
        role: user.role,
        patientContractAddress: user.patient_contract_address,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh access token
 * Uses refresh token to get new access token
 */
export async function refreshAccessToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token required', 400, 'MISSING_REFRESH_TOKEN');
    }

    // Verify refresh token exists in sessions
    const session = await db.oneOrNone(
      `SELECT s.wallet_address, s.expires_at, u.email, u.role, u.name
       FROM sessions s
       JOIN users u ON s.wallet_address = u.wallet_address
       WHERE s.refresh_token = $1`,
      [refreshToken]
    );

    if (!session) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Check if refresh token expired
    if (new Date(session.expires_at) < new Date()) {
      // Delete expired session
      await db.none('DELETE FROM sessions WHERE refresh_token = $1', [refreshToken]);
      throw new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    // Generate new access token
    const accessToken = generateToken({
      walletAddress: session.wallet_address,
      email: session.email,
      role: session.role,
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        walletAddress: session.wallet_address,
        name: session.name,
        email: session.email,
        role: session.role,
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Logout
 * Invalidates refresh token
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { walletAddress } = req.user!;

    // Delete session
    await db.none('DELETE FROM sessions WHERE wallet_address = $1', [walletAddress]);

    // Log audit trail
    await db.none(
      `INSERT INTO audit_log (wallet_address, action)
       VALUES ($1, $2)`,
      [walletAddress, 'user_logout']
    );

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user profile
 */
export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { walletAddress } = req.user!;

    const user = await db.one(
      `SELECT wallet_address, name, email, role, patient_contract_address, created_at
       FROM users WHERE wallet_address = $1`,
      [walletAddress]
    );

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}
