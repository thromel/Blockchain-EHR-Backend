/**
 * @file Express Application
 * @description Main Express application setup with middleware and routes
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// API routes
app.use(config.apiPrefix, routes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Blockchain EHR Backend API',
    version: '2.0.0',
    documentation: '/api/health',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND',
      path: req.path,
    },
  });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
