-- db/migrations/0002_active_stream.sql
-- Add active_stream_id + started_at to conversations so concurrent POSTs on the
-- same conversation can be rejected with 409 before any assistant rows are
-- appended. A stream is considered stale after 2 minutes (covers server crashes).

ALTER TABLE conversations
  ADD COLUMN active_stream_id TEXT,
  ADD COLUMN active_stream_started_at TIMESTAMPTZ;

CREATE INDEX idx_conv_active_stream ON conversations (id) WHERE active_stream_id IS NOT NULL;
