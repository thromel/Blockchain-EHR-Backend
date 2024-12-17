-- Migration 001: Create initial database schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    wallet_address VARCHAR(42) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    patient_contract_address VARCHAR(42),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Records metadata table
CREATE TABLE IF NOT EXISTS records (
    id SERIAL PRIMARY KEY,
    patient_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    record_id INTEGER NOT NULL,
    storage_pointer TEXT NOT NULL,
    content_digest VARCHAR(66) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(patient_wallet, record_id)
);

CREATE INDEX idx_records_patient ON records(patient_wallet);
CREATE INDEX idx_records_digest ON records(content_digest);

-- Permissions cache table (mirrors on-chain state for quick lookup)
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    patient_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    grantee_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    record_id INTEGER NOT NULL,
    permission_id INTEGER,
    wrapped_key TEXT,
    expiration TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    granted_at TIMESTAMP DEFAULT NOW(),
    nonce VARCHAR(66) UNIQUE,
    transaction_hash VARCHAR(66)
);

CREATE INDEX idx_permissions_patient ON permissions(patient_wallet);
CREATE INDEX idx_permissions_grantee ON permissions(grantee_wallet);
CREATE INDEX idx_permissions_expiration ON permissions(expiration);
CREATE INDEX idx_permissions_revoked ON permissions(revoked);

-- Access logs table (optional feature)
CREATE TABLE IF NOT EXISTS access_logs (
    id SERIAL PRIMARY KEY,
    record_id INTEGER NOT NULL,
    accessor_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    accessed_at TIMESTAMP DEFAULT NOW(),
    details_hash VARCHAR(66),
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE INDEX idx_access_logs_record ON access_logs(record_id);
CREATE INDEX idx_access_logs_accessor ON access_logs(accessor_wallet);
CREATE INDEX idx_access_logs_time ON access_logs(accessed_at);

-- Emergency grants table
CREATE TABLE IF NOT EXISTS emergency_grants (
    grant_id VARCHAR(66) PRIMARY KEY,
    patient_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    record_id INTEGER NOT NULL,
    physician1_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
    physician2_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
    justification_code SMALLINT NOT NULL CHECK (justification_code BETWEEN 1 AND 3),
    wrapped_key TEXT,
    expiration TIMESTAMP NOT NULL,
    confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_emergency_patient ON emergency_grants(patient_wallet);
CREATE INDEX idx_emergency_physicians ON emergency_grants(physician1_wallet, physician2_wallet);
CREATE INDEX idx_emergency_confirmed ON emergency_grants(confirmed);

-- Session tokens table (for JWT refresh tokens)
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_wallet ON sessions(wallet_address);
CREATE INDEX idx_sessions_token ON sessions(refresh_token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Audit log table (blockchain transaction tracking)
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    action VARCHAR(100) NOT NULL,
    transaction_hash VARCHAR(66),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_wallet ON audit_log(wallet_address);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_time ON audit_log(created_at);
CREATE INDEX idx_audit_details ON audit_log USING GIN(details);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_records_updated_at BEFORE UPDATE ON records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts (patients, doctors, admins)';
COMMENT ON TABLE records IS 'Health records metadata (storage pointers)';
COMMENT ON TABLE permissions IS 'Access permissions cache (mirrors blockchain)';
COMMENT ON TABLE access_logs IS 'Optional access tracking logs';
COMMENT ON TABLE emergency_grants IS 'Emergency access requests (2-physician approval)';
COMMENT ON TABLE sessions IS 'User session management';
COMMENT ON TABLE audit_log IS 'Blockchain transaction audit trail';
