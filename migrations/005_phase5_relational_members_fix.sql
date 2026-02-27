-- Phase 5 — Fix relational_group_members: member_type + UNIQUE
-- Additive. Run after 004.
-- Enforces platform vs non-platform via CHECK. Adds UNIQUE(group_id, chart_id).

-- Add member_type column
ALTER TABLE astradio_relational_group_members
  ADD COLUMN IF NOT EXISTS member_type TEXT NOT NULL DEFAULT 'platform';

-- Backfill non-platform where user_id is NULL (idempotent)
UPDATE astradio_relational_group_members SET member_type = 'non_platform' WHERE user_id IS NULL;

-- Drop default so new inserts must specify member_type
ALTER TABLE astradio_relational_group_members ALTER COLUMN member_type DROP DEFAULT;

-- Drop the previous CHECK (equivalent to chart_id NOT NULL only)
ALTER TABLE astradio_relational_group_members
  DROP CONSTRAINT IF EXISTS astradio_relational_group_members_check;

-- Enforce platform vs non-platform via member_type (idempotent: drop first if re-run)
ALTER TABLE astradio_relational_group_members
  DROP CONSTRAINT IF EXISTS astradio_relational_group_members_member_type_check;
ALTER TABLE astradio_relational_group_members
  ADD CONSTRAINT astradio_relational_group_members_member_type_check
  CHECK (
    (member_type = 'platform' AND user_id IS NOT NULL AND chart_id IS NOT NULL)
    OR
    (member_type = 'non_platform' AND user_id IS NULL AND chart_id IS NOT NULL)
  );

-- One chart per group (no duplicate chart_id in same group)
CREATE UNIQUE INDEX IF NOT EXISTS idx_relational_group_members_group_chart_unique
  ON astradio_relational_group_members(group_id, chart_id);
