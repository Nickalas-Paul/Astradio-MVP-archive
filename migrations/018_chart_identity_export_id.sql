-- Profile Identity audio: persist Lyria/export id on chart row (natal surface).
ALTER TABLE astradio_charts ADD COLUMN IF NOT EXISTS identity_export_id TEXT NULL;
