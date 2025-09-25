const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../lib/authentication');
const { getRow, getRows, insert, update, remove } = require('../lib/database');

const router = express.Router();

// Validation middleware
const validatePlaylist = [
  body('title').trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('is_public').optional().isBoolean(),
];

// Get user's saved tracks
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const tracks = await getRows(
      `SELECT t.*, u.display_name, u.username, u.avatar_url, l.saved_at
       FROM libraries l
       JOIN tracks t ON l.track_id = t.id
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE l.user_id = $1
       ORDER BY l.saved_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), offset]
    );

    // Get total count
    const countResult = await getRow(
      'SELECT COUNT(*) as count FROM libraries WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      tracks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.count),
        pages: Math.ceil(parseInt(countResult.count) / limit),
      },
    });
  } catch (error) {
    console.error('Get saved tracks error:', error);
    res.status(500).json({ error: 'Failed to get saved tracks' });
  }
});

// Get user's liked tracks
router.get('/liked', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const tracks = await getRows(
      `SELECT t.*, u.display_name, u.username, u.avatar_url, l.created_at as liked_at
       FROM likes l
       JOIN tracks t ON l.track_id = t.id
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), offset]
    );

    // Get total count
    const countResult = await getRow(
      'SELECT COUNT(*) as count FROM likes WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      tracks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.count),
        pages: Math.ceil(parseInt(countResult.count) / limit),
      },
    });
  } catch (error) {
    console.error('Get liked tracks error:', error);
    res.status(500).json({ error: 'Failed to get liked tracks' });
  }
});

// Create playlist
router.post('/playlists', validatePlaylist, authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, is_public = true } = req.body;

    const playlist = await insert(
      `INSERT INTO playlists (owner_id, title, description, is_public) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, owner_id, title, description, is_public, created_at`,
      [req.user.id, title, description, is_public]
    );

    res.status(201).json({ playlist });
  } catch (error) {
    console.error('Create playlist error:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// Get user's playlists
router.get('/playlists', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const playlists = await getRows(
      `SELECT p.*, COUNT(pi.track_id) as track_count
       FROM playlists p
       LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
       WHERE p.owner_id = $1
       GROUP BY p.id
       ORDER BY p.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), offset]
    );

    // Get total count
    const countResult = await getRow(
      'SELECT COUNT(*) as count FROM playlists WHERE owner_id = $1',
      [req.user.id]
    );

    res.json({
      playlists,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.count),
        pages: Math.ceil(parseInt(countResult.count) / limit),
      },
    });
  } catch (error) {
    console.error('Get playlists error:', error);
    res.status(500).json({ error: 'Failed to get playlists' });
  }
});

// Get playlist by ID
router.get('/playlists/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const playlist = await getRow(
      `SELECT p.*, u.display_name, u.username
       FROM playlists p
       LEFT JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1 AND (p.owner_id = $2 OR p.is_public = true)`,
      [id, req.user.id]
    );

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Get playlist tracks
    const tracks = await getRows(
      `SELECT t.*, u.display_name, u.username, u.avatar_url, pi.position, pi.added_at
       FROM playlist_items pi
       JOIN tracks t ON pi.track_id = t.id
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE pi.playlist_id = $1
       ORDER BY pi.position ASC`,
      [id]
    );

    res.json({ playlist, tracks });
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({ error: 'Failed to get playlist' });
  }
});

// Update playlist
router.patch('/playlists/:id', validatePlaylist, authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { title, description, is_public } = req.body;

    // Check ownership
    const playlist = await getRow(
      'SELECT id FROM playlists WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (is_public !== undefined) {
      updates.push(`is_public = $${paramCount++}`);
      values.push(is_public);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const query = `
      UPDATE playlists 
      SET ${updates.join(', ')}, updated_at = now()
      WHERE id = $${paramCount}
      RETURNING id, owner_id, title, description, is_public, updated_at
    `;

    const updatedPlaylist = await update(query, values);

    res.json({ playlist: updatedPlaylist });
  } catch (error) {
    console.error('Update playlist error:', error);
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

// Delete playlist
router.delete('/playlists/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const playlist = await getRow(
      'SELECT id FROM playlists WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Delete playlist (cascade will delete playlist_items)
    await remove('DELETE FROM playlists WHERE id = $1', [id]);

    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Delete playlist error:', error);
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

// Add track to playlist
router.post('/playlists/:id/items', [
  body('track_id').notEmpty(),
  body('position').optional().isInt({ min: 0 }),
], authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { track_id, position } = req.body;

    // Check playlist ownership
    const playlist = await getRow(
      'SELECT id FROM playlists WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Check if track exists
    const track = await getRow('SELECT id FROM tracks WHERE id = $1', [track_id]);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    // Check if track is already in playlist
    const existing = await getRow(
      'SELECT 1 FROM playlist_items WHERE playlist_id = $1 AND track_id = $2',
      [id, track_id]
    );

    if (existing) {
      return res.status(409).json({ error: 'Track already in playlist' });
    }

    // Determine position
    let finalPosition = position;
    if (position === undefined) {
      const maxPosition = await getRow(
        'SELECT COALESCE(MAX(position), -1) as max_pos FROM playlist_items WHERE playlist_id = $1',
        [id]
      );
      finalPosition = parseInt(maxPosition.max_pos) + 1;
    }

    // Add track to playlist
    await insert(
      'INSERT INTO playlist_items (playlist_id, track_id, position) VALUES ($1, $2, $3)',
      [id, track_id, finalPosition]
    );

    res.json({ message: 'Track added to playlist' });
  } catch (error) {
    console.error('Add track to playlist error:', error);
    res.status(500).json({ error: 'Failed to add track to playlist' });
  }
});

// Remove track from playlist
router.delete('/playlists/:id/items/:trackId', authenticateToken, async (req, res) => {
  try {
    const { id, trackId } = req.params;

    // Check playlist ownership
    const playlist = await getRow(
      'SELECT id FROM playlists WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Remove track from playlist
    const result = await remove(
      'DELETE FROM playlist_items WHERE playlist_id = $1 AND track_id = $2',
      [id, trackId]
    );

    if (!result) {
      return res.status(404).json({ error: 'Track not found in playlist' });
    }

    res.json({ message: 'Track removed from playlist' });
  } catch (error) {
    console.error('Remove track from playlist error:', error);
    res.status(500).json({ error: 'Failed to remove track from playlist' });
  }
});

// Reorder playlist tracks
router.patch('/playlists/:id/reorder', [
  body('track_positions').isArray(),
  body('track_positions.*.track_id').notEmpty(),
  body('track_positions.*.position').isInt({ min: 0 }),
], authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { track_positions } = req.body;

    // Check playlist ownership
    const playlist = await getRow(
      'SELECT id FROM playlists WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Update positions in transaction
    for (const item of track_positions) {
      await update(
        'UPDATE playlist_items SET position = $1 WHERE playlist_id = $2 AND track_id = $3',
        [item.position, id, item.track_id]
      );
    }

    res.json({ message: 'Playlist reordered successfully' });
  } catch (error) {
    console.error('Reorder playlist error:', error);
    res.status(500).json({ error: 'Failed to reorder playlist' });
  }
});

module.exports = router;
