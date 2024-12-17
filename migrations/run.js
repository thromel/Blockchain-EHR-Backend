"use strict";
/**
 * @file Migration Runner
 * @description Run database migrations
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const database_1 = __importDefault(require("../src/services/database"));
async function runMigrations() {
    try {
        console.log('🔄 Running database migrations...\n');
        // Read migration file
        const migrationPath = (0, path_1.join)(__dirname, '001_create_tables.sql');
        const migrationSQL = (0, fs_1.readFileSync)(migrationPath, 'utf-8');
        // Execute migration
        await database_1.default.none(migrationSQL);
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
    }
    catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}
runMigrations();
//# sourceMappingURL=run.js.map