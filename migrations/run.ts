/**
 * @file Migration Runner
 * @description Run database migrations
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import db from '../src/services/database';

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...\n');

    // Read migration file
    const migrationPath = join(__dirname, '001_create_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Execute migration
    await db.none(migrationSQL);

    console.log('✅ Migration 001: Created tables successfully');
    console.log('\n📊 Database schema initialized');
    console.log('  ✓ users');
    console.log('  ✓ records');
    console.log('  ✓ permissions');
    console.log('  ✓ access_logs');
    console.log('  ✓ emergency_grants');
    console.log('  ✓ sessions');
    console.log('  ✓ audit_log');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

runMigrations();
