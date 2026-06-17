-- Community post attachments: image URL and library audio export reference.

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_export_id TEXT,
  ADD COLUMN IF NOT EXISTS audio_label TEXT;
