-- 013_auth_otp_and_sessions.sql
-- Ensure email verification OTPs and user sessions persist in PostgreSQL

ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS otp VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_email_verif_otp ON email_verifications(user_id, otp);

ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS otp VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_password_resets_otp ON password_resets(user_id, otp);

ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;

