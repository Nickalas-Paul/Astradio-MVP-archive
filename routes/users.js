const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, optionalAuth } = require('../lib/authentication');
const { getRow, getRows, update } = require('../lib/database');
const multer = require('multer');
const { uploadAvatar } = require('../lib/storage');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Validation middleware
const validateProfileUpdate = [
  body('display_name').optional().trim().isLength({ min: 1, max: 100 }),
  body('username').optional().trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_-]+$/),
  body('bio').optional().trim().isLength({ max: 500 }),
  body('location').optional().trim().isLength({ max: 100 }),
];

const validateBirthData = [
  body('birth_datetime').optional().isISO8601(),
  body('birth_lat').optional().isFloat({ min: -90, max: 90 }),
  body('birth_lon').optional().isFloat({ min: -180, max: 180 }),
  body('privacy_level').optional().isIn(['public', 'friends', 'private']),
  body('compare_opt_in').optional().isBoolean(),
];

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await getRow(
      `SELECT u.id, u.email, u.email_verified_at, u.display_name, u.username, 
              u.avatar_url, u.bio, u.location, u.created_at, u.updated_at,
              p.birth_datetime, p.birth_lat, p.birth_lon, p.privacy_level, p.compare_opt_in
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Update current user profile
router.patch('/me', validateProfileUpdate, authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { display_name, username, bio, location } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(display_name);
    }

    if (username !== undefined) {
      // Check if username is already taken
      const existingUser = await getRow(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, req.user.id]
      );
      if (existingUser) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      updates.push(`username = $${paramCount++}`);
      values.push(username);
    }

    if (bio !== undefined) {
      updates.push(`bio = $${paramCount++}`);
      values.push(bio);
    }

    if (location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(location);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.user.id);
    const query = `
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = now()
      WHERE id = $${paramCount}
      RETURNING id, email, display_name, username, avatar_url, bio, location, updated_at
    `;

    const user = await update(query, values);

    res.json({ user });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Update birth data and privacy settings
router.patch('/me/profile', validateBirthData, authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { birth_datetime, birth_lat, birth_lon, privacy_level, compare_opt_in } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (birth_datetime !== undefined) {
      updates.push(`birth_datetime = $${paramCount++}`);
      values.push(birth_datetime);
    }

    if (birth_lat !== undefined) {
      updates.push(`birth_lat = $${paramCount++}`);
      values.push(birth_lat);
    }

    if (birth_lon !== undefined) {
      updates.push(`birth_lon = $${paramCount++}`);
      values.push(birth_lon);
    }

    if (privacy_level !== undefined) {
      updates.push(`privacy_level = $${paramCount++}`);
      values.push(privacy_level);
    }

    if (compare_opt_in !== undefined) {
      updates.push(`compare_opt_in = $${paramCount++}`);
      values.push(compare_opt_in);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.user.id);
    const query = `
      UPDATE profiles 
      SET ${updates.join(', ')}, updated_at = now()
      WHERE user_id = $${paramCount}
      RETURNING user_id, birth_datetime, birth_lat, birth_lon, privacy_level, compare_opt_in, updated_at
    `;

    const profile = await update(query, values);

    res.json({ profile });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload avatar
router.post('/me/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to S3
    const avatarUrl = await uploadAvatar(req.user.id, req.file.buffer, 'jpg');

    // Update user record
    const user = await update(
      'UPDATE users SET avatar_url = $1, updated_at = now() WHERE id = $2 RETURNING avatar_url',
      [avatarUrl, req.user.id]
    );

    res.json({ avatar_url: user.avatar_url });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Get public user profile
router.get('/:username', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;

    const user = await getRow(
      `SELECT u.id, u.display_name, u.username, u.avatar_url, u.bio, u.location, 
              u.created_at, p.privacy_level, p.compare_opt_in
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.username = $1`,
      [username]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check privacy settings
    if (user.privacy_level === 'private') {
      return res.status(403).json({ error: 'Profile is private' });
    }

    // If user is authenticated, check if they're following this user
    let isFollowing = false;
    if (req.user) {
      const follow = await getRow(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2',
        [req.user.id, user.id]
      );
      isFollowing = !!follow;
    }

    // Get recent tracks (public only)
    const tracks = await getRows(
      `SELECT t.id, t.mode, t.genre, t.source, t.duration_sec, t.key_signature, t.bpm,
              t.waveform_url, t.preview_url, t.created_at
       FROM tracks t
       WHERE t.owner_id = $1
       ORDER BY t.created_at DESC
       LIMIT 10`,
      [user.id]
    );

    // Get follower/following counts
    const followerCount = await getRow(
      'SELECT COUNT(*) as count FROM follows WHERE followee_id = $1',
      [user.id]
    );

    const followingCount = await getRow(
      'SELECT COUNT(*) as count FROM follows WHERE follower_id = $1',
      [user.id]
    );

    res.json({
      user: {
        id: user.id,
        display_name: user.display_name,
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
        location: user.location,
        created_at: user.created_at,
        privacy_level: user.privacy_level,
        compare_opt_in: user.compare_opt_in,
        follower_count: parseInt(followerCount.count),
        following_count: parseInt(followingCount.count),
        is_following: isFollowing,
      },
      tracks,
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Get user's tracks
router.get('/:username/tracks', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20, mode, genre } = req.query;
    const offset = (page - 1) * limit;

    // Get user
    const user = await getRow(
      'SELECT u.id, p.privacy_level FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.username = $1',
      [username]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check privacy
    if (user.privacy_level === 'private') {
      return res.status(403).json({ error: 'Profile is private' });
    }

    // Build query
    let query = `
      SELECT t.id, t.mode, t.genre, t.source, t.duration_sec, t.key_signature, t.bpm,
             t.waveform_url, t.preview_url, t.created_at
      FROM tracks t
      WHERE t.owner_id = $1
    `;
    const values = [user.id];
    let paramCount = 2;

    if (mode) {
      query += ` AND t.mode = $${paramCount++}`;
      values.push(mode);
    }

    if (genre) {
      query += ` AND t.genre = $${paramCount++}`;
      values.push(genre);
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(parseInt(limit), offset);

    const tracks = await getRows(query, values);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM tracks WHERE owner_id = $1';
    const countValues = [user.id];

    if (mode) {
      countQuery += ' AND mode = $2';
      countValues.push(mode);
    }

    if (genre) {
      countQuery += ` AND genre = $${countValues.length + 1}`;
      countValues.push(genre);
    }

    const countResult = await getRow(countQuery, countValues);
    const totalCount = parseInt(countResult.count);

    res.json({
      tracks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get user tracks error:', error);
    res.status(500).json({ error: 'Failed to get user tracks' });
  }
});

module.exports = router;
