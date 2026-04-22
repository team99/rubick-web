-- db/migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT,
  image_url    TEXT,
  role         TEXT NOT NULL CHECK (role IN ('admin','member')),
  status       TEXT NOT NULL CHECK (status IN ('invited','active','disabled')),
  invited_by   TEXT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS invites (
  email        TEXT PRIMARY KEY,
  invited_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'New chat',
  model      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conv_user_updated
  ON conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','tool','compaction')),
  content         TEXT,
  tool_calls      JSONB,
  tool_call_id    TEXT,
  tool_name       TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((role = 'tool') = (tool_call_id IS NOT NULL AND tool_name IS NOT NULL)),
  CHECK (tool_calls IS NULL OR role = 'assistant'),
  CHECK (pg_column_size(tool_calls) < 64 * 1024),
  CHECK (pg_column_size(metadata)   < 16 * 1024)
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, id ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_msg_tool_result
  ON messages(conversation_id, tool_call_id)
  WHERE tool_call_id IS NOT NULL;

-- Admin bootstrap: idempotent. Id will be a stable deterministic value.
INSERT INTO users (id, email, role, status, invited_by)
VALUES ('u_admin_bootstrap', 'erwin@99.co', 'admin', 'active', NULL)
ON CONFLICT (email) DO NOTHING;
