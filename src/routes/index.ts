/**
 * @file API Routes
 * @description Main router that mounts all API endpoints
 */

import { Router } from 'express';
import authRoutes from './auth.routes';
import recordsRoutes from './records.routes';
import permissionsRoutes from './permissions.routes';
import keysRoutes from './keys.routes';
import emergencyRoutes from './emergency.routes';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/records', recordsRoutes);
router.use('/permissions', permissionsRoutes);
router.use('/keys', keysRoutes);
router.use('/emergency', emergencyRoutes);

export default router;
