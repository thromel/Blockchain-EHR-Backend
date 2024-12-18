/**
 * @file Authentication Middleware
 * @description JWT authentication and authorization
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Wallet } from 'ethers';
import config from '../config';

interface JWTPayload {
  walletAddress: string;
  email: string;
  role: string;
  privateKey?: string;
}

/**
 * Verify JWT token and attach user to request
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Authentication token required',
        code: 'AUTH_TOKEN_MISSING',
      },
    });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;

    // Attach user info to request
    req.user = {
      walletAddress: payload.walletAddress,
      email: payload.email,
      role: payload.role,
    };

    // If private key is in payload, create wallet instance
    if (payload.privateKey) {
      req.wallet = new Wallet(payload.privateKey);
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Token expired',
          code: 'AUTH_TOKEN_EXPIRED',
        },
      });
      return;
    }

    res.status(403).json({
      success: false,
      error: {
        message: 'Invalid token',
        code: 'AUTH_TOKEN_INVALID',
      },
    });
  }
}

/**
 * Require specific role(s)
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Insufficient permissions',
          code: 'AUTH_FORBIDDEN',
          details: {
            required: allowedRoles,
            current: req.user.role,
          },
        },
      });
      return;
    }

    next();
  };
}

/**
 * Require patient role
 */
export const requirePatient = requireRole('patient');

/**
 * Require doctor role
 */
export const requireDoctor = requireRole('doctor');

/**
 * Require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Require patient or doctor role
 */
export const requirePatientOrDoctor = requireRole('patient', 'doctor');

/**
 * Require patient or admin role
 */
export const requirePatientOrAdmin = requireRole('patient', 'admin');

/**
 * Optional authentication (attach user if token present, but don't fail if missing)
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;

    req.user = {
      walletAddress: payload.walletAddress,
      email: payload.email,
      role: payload.role,
    };

    if (payload.privateKey) {
      req.wallet = new Wallet(payload.privateKey);
    }
  } catch (error) {
    // Silently fail for optional auth
  }

  next();
}

/**
 * Generate JWT token
 */
export function generateToken(payload: JWTPayload, expiresIn?: string): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: expiresIn || config.jwt.expiry,
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiry,
  });
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, config.jwt.secret) as JWTPayload;
}
