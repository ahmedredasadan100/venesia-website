-- Admin audit log (authentication and user management events).

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id bigserial PRIMARY KEY,
  actor_admin_user_id bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_username text NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id bigint,
  entity_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx
  ON admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_created_at_idx
  ON admin_audit_logs (actor_admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_action_created_at_idx
  ON admin_audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_entity_idx
  ON admin_audit_logs (entity_type, entity_id);
