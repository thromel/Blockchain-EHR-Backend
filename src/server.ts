/**
 * @file Server Entry Point
 * @description Starts the Express server
 */

import app from './app';
import config from './config';
import { testConnection } from './services/database';

const PORT = config.port;

async function startServer() {
  try {
    // Test database connection
    console.log('🔄 Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('❌ Database connection failed. Server not started.');
      process.exit(1);
    }

    // Start server
    app.listen(PORT, () => {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 Blockchain EHR Backend v2.0.0');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${config.env}`);
      console.log(`🔗 API endpoint: http://localhost:${PORT}${config.apiPrefix}`);
      console.log(`🏥 Health check: http://localhost:${PORT}${config.apiPrefix}/health`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();
