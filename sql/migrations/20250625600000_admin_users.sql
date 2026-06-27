-- Admin users table (database-backed CMS authentication).

CREATE TABLE IF NOT EXISTS admin_users (
  id bigserial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true,
  session_version integer NOT NULL DEFAULT 1,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_users_username_idx ON admin_users (username);
CREATE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users (email);

-- One-time bootstrap admin (password stored as bcrypt hash only).
INSERT INTO admin_users (email, username, password_hash, full_name, role)
SELECT
  'admin@venesia.local',
  'admin',
  '$2b$12$EX4L16AlQJ6DZNGXnwbtBO/RW7PoA4foBsytxxGwNQGXyQyKEV7HK',
  'Administrator',
  'admin'
WHERE NOT EXISTS (SELECT 1 FROM admin_users LIMIT 1);
