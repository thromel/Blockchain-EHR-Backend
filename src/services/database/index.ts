/**
 * @file Database Service
 * @description PostgreSQL connection pool and query utilities
 */

import pgPromise from 'pg-promise';
import config from '../../config';

// Initialize pg-promise
const pgp = pgPromise({
  // Initialization options
  capSQL: true,
});

// Create connection configuration
const connectionConfig = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: 30, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create database instance
const db = pgp(connectionConfig);

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await db.connect();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', (error as Error).message);
    return false;
  }
}

/**
 * Close database connection
 */
export async function closeConnection(): Promise<void> {
  pgp.end();
}

export { db, pgp };
export default db;
