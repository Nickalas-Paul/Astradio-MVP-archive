import express, { Request, Response } from 'express';
import { body, validationResult, ValidationChain } from 'express-validator';
import './types'; // Import shared type definitions
const authLib = require('../lib/authentication');
const dbLib = require('../lib/database');
const storageLib = require('../lib/storage');
const redisLib = require('../lib/redis');

const { authenticateToken, optionalAuth, checkRateLimit } = authLib;
const { getRow, getRows, insert, update, remove } = dbLib;
const { generateChartHash } = storageLib;
const redis = redisLib;

const router = express.Router();

// Validation middleware
const validateRenderRequest: ValidationChain[] = [
  body('chartData').isObject(),
  body('mode').isIn(['clusters', 'elemental', 'lunar']),
  body('genre').notEmpty(),
  body('source').isIn(['natal', 'transit', 'overlay']),
  body('duration_sec').optional().isInt({ min: 30, max: 300 }),
];

// Request track render
router.post('/render', validateRenderRequest, authenticateToken, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { chartData, mode, genre, source, duration_sec = 60 } = req.body;

    // Check rate limiting
    const rateLimitKey = `render:${req.user.id}`;
    const allowed = await checkRateLimit(rateLimitKey, 3, 3600000); // 3 per hour
    if (!allowed) {
      return res.status(429).json({ error: 'Too many render requests' });
    }

    // Generate chart hash
    const chartHash = generateChartHash(chartData);

    // Check if track already exists
    const existingTrack = await getRow(
      'SELECT id, waveform_url, preview_url, og_image_url FROM tracks WHERE owner_id = $1 AND chart_hash = $2 AND mode = $3 AND genre = $4',
      [req.user.id, chartHash, mode, genre]
    );

    if (existingTrack) {
      return res.json({
        track: existingTrack,
        message: 'Track already exists'
      });
    }

    // Create track record
    const track = await insert(
      `INSERT INTO tracks (owner_id, mode, genre, source, chart_hash, duration_sec, timeline_json) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, owner_id, mode, genre, source, chart_hash, duration_sec, created_at`,
      [req.user.id, mode, genre, source, chartHash, duration_sec, JSON.stringify([])]
    );

    // Enqueue render job
    const renderJob = {
      trackId: track.id,
      chartData,
      mode,
      genre,
      source,
      duration_sec,
      userId: req.user.id
    };

    const redisClient = await redis.getClient();
    await redisClient.lPush('render_queue', JSON.stringify(renderJob));

    res.status(202).json({
      track: {
        id: track.id,
        status: 'queued',
        message: 'Track rendering started'
      }
    });
  } catch (error) {
    console.error('Render request error:', error);
    res.status(500).json({ error: 'Failed to request render' });
  }
});

// Get track by ID
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const track = await getRow(
      `SELECT t.*, u.display_name, u.username, u.avatar_url,
              p.privacy_level
       FROM tracks t
       LEFT JOIN users u ON t.owner_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE t.id = $1`,
      [id]
    );

    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    // Check privacy
    if (track.privacy_level === 'private' && (!req.user || req.user.id !== track.owner_id)) {
      return res.status(403).json({ error: 'Track is private' });
    }

    // Check if current user has liked/saved this track
    let isLiked = false;
    let isSaved = false;
    if (req.user) {
      const like = await getRow(
        'SELECT 1 FROM likes WHERE user_id = $1 AND track_id = $2',
        [req.user.id, id]
      );
      isLiked = !!like;

      const saved = await getRow(
        'SELECT 1 FROM libraries WHERE user_id = $1 AND track_id = $2',
        [req.user.id, id]
      );
      isSaved = !!saved;
    }

    // Get like count
    const likeCount = await getRow(
      'SELECT COUNT(*) as count FROM likes WHERE track_id = $1',
      [id]
    );

    res.json({
      track: {
        ...track,
        is_liked: isLiked,
        is_saved: isSaved,
        like_count: parseInt(likeCount.count)
      }
    });
  } catch (error) {
    console.error('Get track error:', error);
    res.status(500).json({ error: 'Failed to get track' });
  }
});

// Get tracks with filters
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { 
      owner, 
      mode, 
      genre, 
      source, 
      page = 1, 
      limit = 20,
      q 
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT t.*, u.display_name, u.username, u.avatar_url,
             p.privacy_level
      FROM tracks t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE 1=1
    `;
    const values: any[] = [];
    let paramCount = 1;

    // Apply filters
    if (owner) {
      query += ` AND u.username = $${paramCount++}`;
      values.push(owner);
    }

    if (mode) {
      query += ` AND t.mode = $${paramCount++}`;
      values.push(mode);
    }

    if (genre) {
      query += ` AND t.genre = $${paramCount++}`;
      values.push(genre);
    }

    if (source) {
      query += ` AND t.source = $${paramCount++}`;
      values.push(source);
    }

    // Privacy filter - only show public tracks or user's own tracks
    if (!req.user) {
      query += ` AND (p.privacy_level = 'public' OR p.privacy_level IS NULL)`;
    } else {
      query += ` AND (p.privacy_level = 'public' OR p.privacy_level IS NULL OR t.owner_id = $${paramCount++})`;
      values.push(req.user.id);
    }

    // Search query
    if (q) {
      query += ` AND (u.display_name ILIKE $${paramCount++} OR u.username ILIKE $${paramCount++} OR t.genre ILIKE $${paramCount++})`;
      const searchTerm = `%${q}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(parseInt(limit as string), offset);

    const tracks = await getRows(query, values);

    // Get like counts and user interactions
    if (req.user) {
      for (let track of tracks) {
        const like = await getRow(
          'SELECT 1 FROM likes WHERE user_id = $1 AND track_id = $2',
          [req.user.id, track.id]
        );
        track.is_liked = !!like;

        const saved = await getRow(
          'SELECT 1 FROM libraries WHERE user_id = $1 AND track_id = $2',
          [req.user.id, track.id]
        );
        track.is_saved = !!saved;
      }
    }

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as count
      FROM tracks t
      LEFT JOIN users u ON t.owner_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE 1=1
    `;
    const countValues: any[] = [];
    paramCount = 1;

    if (owner) {
      countQuery += ` AND u.username = $${paramCount++}`;
      countValues.push(owner);
    }

    if (mode) {
      countQuery += ` AND t.mode = $${paramCount++}`;
      countValues.push(mode);
    }

    if (genre) {
      countQuery += ` AND t.genre = $${paramCount++}`;
      countValues.push(genre);
    }

    if (source) {
      countQuery += ` AND t.source = $${paramCount++}`;
      countValues.push(source);
    }

    if (!req.user) {
      countQuery += ` AND (p.privacy_level = 'public' OR p.privacy_level IS NULL)`;
    } else {
      countQuery += ` AND (p.privacy_level = 'public' OR p.privacy_level IS NULL OR t.owner_id = $${paramCount++})`;
      countValues.push(req.user.id);
    }

    if (q) {
      countQuery += ` AND (u.display_name ILIKE $${paramCount++} OR u.username ILIKE $${paramCount++} OR t.genre ILIKE $${paramCount++})`;
      const searchTerm = `%${q}%`;
      countValues.push(searchTerm, searchTerm, searchTerm);
    }

    const countResult = await getRow(countQuery, countValues);
    const totalCount = parseInt(countResult.count);

    res.json({
      tracks,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get tracks error:', error);
    res.status(500).json({ error: 'Failed to get tracks' });
  }
});

// Save track to library
router.post('/:id/save', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if track exists
    const track = await getRow('SELECT id, owner_id FROM tracks WHERE id = $1', [id]);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    // Check if already saved
    const existing = await getRow(
      'SELECT 1 FROM libraries WHERE user_id = $1 AND track_id = $2',
      [req.user.id, id]
    );

    if (existing) {
      return res.status(409).json({ error: 'Track already saved' });
    }

    // Save to library
    await insert(
      'INSERT INTO libraries (user_id, track_id) VALUES ($1, $2)',
      [req.user.id, id]
    );

    res.json({ message: 'Track saved to library' });
  } catch (error) {
    console.error('Save track error:', error);
    res.status(500).json({ error: 'Failed to save track' });
  }
});

// Remove track from library
router.delete('/:id/save', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await remove(
      'DELETE FROM libraries WHERE user_id = $1 AND track_id = $2',
      [req.user.id, id]
    );

    if (!result) {
      return res.status(404).json({ error: 'Track not found in library' });
    }

    res.json({ message: 'Track removed from library' });
  } catch (error) {
    console.error('Remove track error:', error);
    res.status(500).json({ error: 'Failed to remove track' });
  }
});

// Like track
router.post('/:id/like', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if track exists
    const track = await getRow('SELECT id FROM tracks WHERE id = $1', [id]);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    // Check if already liked
    const existing = await getRow(
      'SELECT 1 FROM likes WHERE user_id = $1 AND track_id = $2',
      [req.user.id, id]
    );

    if (existing) {
      return res.status(409).json({ error: 'Track already liked' });
    }

    // Like track
    await insert(
      'INSERT INTO likes (user_id, track_id) VALUES ($1, $2)',
      [req.user.id, id]
    );

    res.json({ message: 'Track liked' });
  } catch (error) {
    console.error('Like track error:', error);
    res.status(500).json({ error: 'Failed to like track' });
  }
});

// Unlike track
router.delete('/:id/like', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await remove(
      'DELETE FROM likes WHERE user_id = $1 AND track_id = $2',
      [req.user.id, id]
    );

    if (!result) {
      return res.status(404).json({ error: 'Track not found in likes' });
    }

    res.json({ message: 'Track unliked' });
  } catch (error) {
    console.error('Unlike track error:', error);
    res.status(500).json({ error: 'Failed to unlike track' });
  }
});

// Get share card data
router.get('/:id/share-card', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const track = await getRow(
      `SELECT t.*, u.display_name, u.username
       FROM tracks t
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE t.id = $1`,
      [id]
    );

    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const shareUrl = `${process.env.FRONTEND_URL}/t/${id}`;
    const ogImageUrl = track.og_image_url || `${process.env.API_BASE_URL}/tracks/${id}/og-image`;

    res.json({
      share_url: shareUrl,
      og_image_url: ogImageUrl,
      title: `${track.display_name}'s ${track.mode} ${track.genre} track`,
      description: `Listen to this astrological music generated from ${track.display_name}'s chart`,
    });
  } catch (error) {
    console.error('Get share card error:', error);
    res.status(500).json({ error: 'Failed to get share card' });
  }
});

export default router;
