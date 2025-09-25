import express, { Request, Response } from 'express';
import { body, validationResult, ValidationChain } from 'express-validator';
import './types'; // Import shared type definitions
const authLib = require('../lib/authentication');
const dbLib = require('../lib/database');
const storageLib = require('../lib/storage');
const redisLib = require('../lib/redis');

const { authenticateToken, optionalAuth } = authLib;
const { getRow, getRows, insert, remove, update } = dbLib;
const { generateChartHash } = storageLib;
const redis = redisLib;

const router = express.Router();

// Follow user
router.post('/follows/:username', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { username } = req.params;

    // Get target user
    const targetUser = await getRow('SELECT id FROM users WHERE username = $1', [username]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Can't follow yourself
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if already following
    const existingFollow = await getRow(
      'SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2',
      [req.user.id, targetUser.id]
    );

    if (existingFollow) {
      return res.status(409).json({ error: 'Already following this user' });
    }

    // Create follow relationship
    await insert(
      'INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)',
      [req.user.id, targetUser.id]
    );

    // Create notification
    await insert(
      `INSERT INTO notifications (user_id, type, payload) 
       VALUES ($1, 'follow', $2)`,
      [targetUser.id, JSON.stringify({
        follower_id: req.user.id,
        follower_name: req.user.display_name,
        follower_username: req.user.username
      })]
    );

    res.json({ message: 'User followed successfully' });
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow user
router.delete('/follows/:username', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { username } = req.params;

    // Get target user
    const targetUser = await getRow('SELECT id FROM users WHERE username = $1', [username]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove follow relationship
    const result = await remove(
      'DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2',
      [req.user.id, targetUser.id]
    );

    if (!result) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    res.json({ message: 'User unfollowed successfully' });
  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Get user's followers
router.get('/follows/:username/followers', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Get user
    const user = await getRow('SELECT id FROM users WHERE username = $1', [username]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get followers
    const followers = await getRows(
      `SELECT u.id, u.display_name, u.username, u.avatar_url, f.created_at
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       WHERE f.followee_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, parseInt(limit as string), offset]
    );

    // Check if current user is following each follower
    if (req.user) {
      for (let follower of followers) {
        const isFollowing = await getRow(
          'SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2',
          [req.user.id, follower.id]
        );
        follower.is_following = !!isFollowing;
      }
    }

    // Get total count
    const countResult = await getRow(
      'SELECT COUNT(*) as count FROM follows WHERE followee_id = $1',
      [user.id]
    );

    res.json({
      followers,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult.count),
        pages: Math.ceil(parseInt(countResult.count) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Failed to get followers' });
  }
});

// Get user's following
router.get('/follows/:username/following', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Get user
    const user = await getRow('SELECT id FROM users WHERE username = $1', [username]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get following
    const following = await getRows(
      `SELECT u.id, u.display_name, u.username, u.avatar_url, f.created_at
       FROM follows f
       JOIN users u ON f.followee_id = u.id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, parseInt(limit as string), offset]
    );

    // Check if current user is following each user
    if (req.user) {
      for (let followee of following) {
        const isFollowing = await getRow(
          'SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2',
          [req.user.id, followee.id]
        );
        followee.is_following = !!isFollowing;
      }
    }

    // Get total count
    const countResult = await getRow(
      'SELECT COUNT(*) as count FROM follows WHERE follower_id = $1',
      [user.id]
    );

    res.json({
      following,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult.count),
        pages: Math.ceil(parseInt(countResult.count) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Failed to get following' });
  }
});

// Request comparison with user
router.post('/compare/:username', [
  body('chartData').isObject(),
  body('mode').isIn(['clusters', 'elemental', 'lunar']),
  body('genre').notEmpty(),
], authenticateToken, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username } = req.params;
    const { chartData, mode, genre } = req.body;

    // Get target user
    const targetUser = await getRow(
      `SELECT u.id, u.display_name, u.username, p.privacy_level, p.compare_opt_in, p.birth_datetime, p.birth_lat, p.birth_lon
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.username = $1`,
      [username]
    );

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Can't compare with yourself
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot compare with yourself' });
    }

    // Check privacy settings
    if (targetUser.privacy_level === 'private') {
      return res.status(403).json({ error: 'User profile is private' });
    }

    // Check if comparison is allowed
    if (!targetUser.compare_opt_in) {
      return res.status(403).json({ error: 'User has disabled comparisons' });
    }

    // Check if user is following target (for friends-only privacy)
    if (targetUser.privacy_level === 'friends') {
      const isFollowing = await getRow(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2',
        [req.user.id, targetUser.id]
      );
      if (!isFollowing) {
        return res.status(403).json({ error: 'Must follow user to compare charts' });
      }
    }

    // Check if target user has birth data
    if (!targetUser.birth_datetime || !targetUser.birth_lat || !targetUser.birth_lon) {
      return res.status(400).json({ error: 'Target user has not set birth data' });
    }

    // Generate comparison chart hash
    const comparisonData = {
      requester: chartData,
      target: {
        birth_datetime: targetUser.birth_datetime,
        birth_lat: targetUser.birth_lat,
        birth_lon: targetUser.birth_lon
      }
    };
    const chartHash = generateChartHash(comparisonData);

    // Check if comparison already exists
    const existingComparison = await getRow(
      'SELECT id, result_track_id FROM comparisons WHERE requester_id = $1 AND target_id = $2 AND chart_hash = $3',
      [req.user.id, targetUser.id, chartHash]
    );

    if (existingComparison && existingComparison.result_track_id) {
      // Return existing comparison track
      const track = await getRow(
        'SELECT id, waveform_url, preview_url, og_image_url FROM tracks WHERE id = $1',
        [existingComparison.result_track_id]
      );
      return res.json({ track, message: 'Comparison already exists' });
    }

    // Create comparison record
    const comparison = await insert(
      `INSERT INTO comparisons (requester_id, target_id, chart_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      [req.user.id, targetUser.id, chartHash]
    );

    // Enqueue comparison render job
    const renderJob = {
      comparisonId: comparison.id,
      requesterId: req.user.id,
      targetId: targetUser.id,
      requesterChartData: chartData,
      targetChartData: {
        birth_datetime: targetUser.birth_datetime,
        birth_lat: targetUser.birth_lat,
        birth_lon: targetUser.birth_lon
      },
      mode,
      genre,
      source: 'overlay'
    };

    const redisClient = await redis.getClient();
    await redisClient.lPush('render_queue', JSON.stringify(renderJob));

    res.status(202).json({
      comparison: {
        id: comparison.id,
        status: 'queued',
        message: 'Comparison rendering started'
      }
    });
  } catch (error) {
    console.error('Comparison request error:', error);
    res.status(500).json({ error: 'Failed to request comparison' });
  }
});

// Get notifications
router.get('/notifications', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT id, type, payload, is_read, created_at
      FROM notifications
      WHERE user_id = $1
    `;
    const values: any[] = [req.user.id];
    let paramCount = 2;

    if (unread_only === 'true') {
      query += ` AND is_read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(parseInt(limit as string), offset);

    const notifications = await getRows(query, values);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1';
    const countValues = [req.user.id];

    if (unread_only === 'true') {
      countQuery += ' AND is_read = false';
    }

    const countResult = await getRow(countQuery, countValues);
    const totalCount = parseInt(countResult.count);

    res.json({
      notifications,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.post('/notifications/:id/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await update(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (!result) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.post('/notifications/read-all', authenticateToken, async (req: Request, res: Response) => {
  try {
    await update(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

export default router;
