-- Default maintenance mode setting (safe for production seed).
-- Requires site_settings table (created by footer CMS migration).

INSERT INTO site_settings (key, value, updated_at)
VALUES ('maintenance_mode', '{"enabled":false}'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
