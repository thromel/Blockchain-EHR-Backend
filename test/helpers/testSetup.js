/**
 * @file Test Setup Helpers
 * @description Utilities for setting up integration tests
 */

const { ethers } = require('hardhat');
const crypto = require('crypto');

// Mock database for testing
const mockDb = {
  users: new Map(),
  records: new Map(),
  permissions: new Map(),
  sessions: new Map(),
  auditLog: [],

  // Mock pg-promise methods
  none: async function(query, params) {
    // Mock INSERT/UPDATE/DELETE
    if (query.includes('INSERT INTO users')) {
      const [walletAddress, name, email, passwordHash, role, patientContract] = params;
      this.users.set(walletAddress, { walletAddress, name, email, passwordHash, role, patientContract });
    } else if (query.includes('INSERT INTO sessions')) {
      const [walletAddress, refreshToken, expiresAt] = params;
      this.sessions.set(walletAddress, { walletAddress, refreshToken, expiresAt });
    } else if (query.includes('INSERT INTO audit_log')) {
      this.auditLog.push({ walletAddress: params[0], action: params[1], details: params[2] });
    }
  },

  one: async function(query, params) {
    // Mock SELECT that returns one row
    if (query.includes('FROM users WHERE wallet_address')) {
      return this.users.get(params[0]) || null;
    } else if (query.includes('FROM users WHERE email')) {
      for (const [_, user] of this.users) {
        if (user.email === params[0]) return user;
      }
      return null;
    }
    throw new Error('No data');
  },

  oneOrNone: async function(query, params) {
    try {
      return await this.one(query, params);
    } catch {
      return null;
    }
  },

  manyOrNone: async function(query, params) {
    return [];
  },

  reset: function() {
    this.users.clear();
    this.records.clear();
    this.permissions.clear();
    this.sessions.clear();
    this.auditLog = [];
  }
};

// Test user generator
function generateTestUser(role = 'patient') {
  const wallet = ethers.Wallet.createRandom();

  return {
    wallet,
    walletAddress: wallet.address,
    privateKey: wallet.privateKey,
    publicKey: wallet.publicKey,
    name: `Test ${role}`,
    email: `test-${Date.now()}-${Math.random()}@example.com`,
    password: 'TestPass123',
    role,
  };
}

// Generate mock FHIR data
function generateFhirObservation() {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'vital-signs',
        display: 'Vital Signs',
      }],
    }],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: '85354-9',
        display: 'Blood pressure',
      }],
      text: 'Blood Pressure',
    },
    valueQuantity: {
      value: 120,
      unit: 'mmHg',
      system: 'http://unitsofmeasure.org',
      code: 'mm[Hg]',
    },
    effectiveDateTime: new Date().toISOString(),
  };
}

// Deploy test contracts
async function deployTestContracts() {
  const KeyRegistry = await ethers.getContractFactory('KeyRegistry');
  const keyRegistry = await KeyRegistry.deploy();
  await keyRegistry.deployed();

  const Factory = await ethers.getContractFactory('PatientRecordsFactory');
  const factory = await Factory.deploy(keyRegistry.address, true);
  await factory.deployed();

  return { keyRegistry, factory };
}

// Mock storage service
const mockStorage = {
  stored: new Map(),

  store: async function(blob, options) {
    const pointer = 'Qm' + crypto.randomBytes(22).toString('hex');
    this.stored.set(pointer, blob);
    return { pointer, digest: options?.contentDigest };
  },

  retrieve: async function(pointer, expectedDigest) {
    const blob = this.stored.get(pointer);
    if (!blob) throw new Error('Not found');
    return blob;
  },

  reset: function() {
    this.stored.clear();
  }
};

// Create mock environment for controllers
function createMockEnv(contracts) {
  // Mock config
  process.env.KEY_REGISTRY_ADDRESS = contracts?.keyRegistry?.address || '0x' + '1'.repeat(40);
  process.env.FACTORY_CONTRACT_ADDRESS = contracts?.factory?.address || '0x' + '2'.repeat(40);
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.JWT_EXPIRY = '24h';
  process.env.JWT_REFRESH_EXPIRY = '7d';
}

module.exports = {
  mockDb,
  generateTestUser,
  generateFhirObservation,
  deployTestContracts,
  mockStorage,
  createMockEnv,
};
