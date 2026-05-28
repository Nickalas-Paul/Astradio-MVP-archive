-- Fix discoverable_as default so new discoverable users appear in Discovery matching.

ALTER TABLE astradio_users ALTER COLUMN discoverable_as SET DEFAULT 'both';

UPDATE astradio_users
SET discoverable_as = 'both'
WHERE discoverable = true AND discoverable_as = 'none';
