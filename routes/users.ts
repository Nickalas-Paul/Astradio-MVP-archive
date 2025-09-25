// routes/users.ts
// TypeScript migration of users module (H3.1)
// Strangler pattern: maintains same API surface as users.js

import express, { Request, Response, NextFunction, Router } from 'express';
import { body, validationResult } from 'express-validator';
import './types'; // Import shared type definitions

const authLib = require('../lib/authentication');
const dbLib = require('../lib/database');
const redisLib = require('../lib/redis');
const multerLib = require('multer');
const storageLib = require('../lib/storage');

const { authenticateToken, optionalAuth } = authLib;
const { getRow, getRows, update, insert } = dbLib;
const redis = redisLib;
const multer = multerLib;
const { uploadAvatar } = storageLib;

const router: Router = express.Router();

// Types for user data
interface User {
  id: string;
  email: string;
  email_verified_at?: string;
  display_name?: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  created_at: string;
  updated_at: string;
}

interface Profile {
  user_id: string;
  birth_datetime?: string;
  birth_lat?: number;
  birth_lon?: number;
  privacy_level?: 'public' | 'friends' | 'private';
  compare_opt_in?: boolean;
  updated_at: string;
}

interface Track {
  id: string;
  mode: string;
  genre: string;
  source: string;
  duration_sec: number;
  key_signature?: string;
  bpm?: number;
  waveform_url?: string;
  preview_url?: string;
  created_at: string;
}

interface PublicUser {
  id: string;
  display_name?: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  created_at: string;
  privacy_level?: string;
  compare_opt_in?: boolean;
  follower_count: number;
  following_count: number;
  is_following: boolean;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
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
router.get('/me', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = await getRow(
      `SELECT u.id, u.email, u.email_verified_at, u.display_name, u.username, 
              u.avatar_url, u.bio, u.location, u.created_at, u.updated_at,
              p.birth_datetime, p.birth_lat, p.birth_lon, p.privacy_level, p.compare_opt_in
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [req.user.id]
    ) as User & Profile;

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
router.patch('/me', validateProfileUpdate, authenticateToken, async (req: any, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { display_name, username, bio, location } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
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

    const user = await update(query, values) as User;

    res.json({ user });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Update birth data and privacy settings
router.patch('/me/profile', validateBirthData, authenticateToken, async (req: any, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { birth_datetime, birth_lat, birth_lon, privacy_level, compare_opt_in } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
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

    const profile = await update(query, values) as Profile;

    res.json({ profile });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload avatar
router.post('/me/avatar', authenticateToken, upload.single('avatar'), async (req: any, res: Response, next: NextFunction) => {
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
    ) as { avatar_url: string };

    res.json({ avatar_url: user.avatar_url });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Get public user profile
router.get('/:username', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;

    const user = await getRow(
      `SELECT u.id, u.display_name, u.username, u.avatar_url, u.bio, u.location, 
              u.created_at, p.privacy_level, p.compare_opt_in
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.username = $1`,
      [username]
    ) as User & { privacy_level?: string; compare_opt_in?: boolean };

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
    ) as Track[];

    // Get follower/following counts
    const followerCount = await getRow(
      'SELECT COUNT(*) as count FROM follows WHERE followee_id = $1',
      [user.id]
    ) as { count: string };

    const followingCount = await getRow(
      'SELECT COUNT(*) as count FROM follows WHERE follower_id = $1',
      [user.id]
    ) as { count: string };

    const publicUser: PublicUser = {
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
    };

    res.json({
      user: publicUser,
      tracks,
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Get user's tracks
router.get('/:username/tracks', optionalAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20, mode, genre } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Get user
    const user = await getRow(
      'SELECT u.id, p.privacy_level FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.username = $1',
      [username]
    ) as { id: string; privacy_level?: string };

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
    const values: any[] = [user.id];
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
    values.push(parseInt(limit as string), offset);

    const tracks = await getRows(query, values) as Track[];

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM tracks WHERE owner_id = $1';
    const countValues: any[] = [user.id];

    if (mode) {
      countQuery += ' AND mode = $2';
      countValues.push(mode);
    }

    if (genre) {
      countQuery += ` AND genre = $${countValues.length + 1}`;
      countValues.push(genre);
    }

    const countResult = await getRow(countQuery, countValues) as { count: string };
    const totalCount = parseInt(countResult.count);

    res.json({
      tracks,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Get user tracks error:', error);
    res.status(500).json({ error: 'Failed to get user tracks' });
  }
});

// Daily overlay: deterministic per user/day, cached and bundled audio+text
router.get('/me/daily-overlay', authenticateToken, async (req: any, res: Response, next: NextFunction) => {
  try {
    // 1) Ensure natal is saved
    const user = await getRow(
      `SELECT u.id, u.display_name, u.username,
              p.birth_datetime, p.birth_lat, p.birth_lon
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [req.user.id]
    ) as User & { birth_datetime?: string; birth_lat?: number; birth_lon?: number };

    if (!user || !user.birth_datetime || user.birth_lat === null || user.birth_lon === null) {
      return res.status(428).json({
        error: 'natal_required',
        message: 'Please enter your birth date, time, and location to generate your daily overlay.'
      });
    }

    // 2) Build deterministic seed (user_id + YYYYMMDD UTC)
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(today.getUTCDate()).padStart(2, '0');
    const ymd = `${yyyy}${mm}${dd}`;
    const seed = `${req.user.id}:${ymd}`;

    // 3) Try Redis cache first
    let redisClient = null;
    try { redisClient = await redis.getClient?.(); } catch (_) {}
    const cacheKey = `overlay:${seed}`;
    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const payload = JSON.parse(cached);
        return res.json({
          source: 'cache',
          ...payload
        });
      }
    }

    // 4) Check DB for existing track for today
    const existingTrack = await getRow(
      `SELECT id, waveform_url, preview_url, og_image_url, timeline_json
       FROM tracks
       WHERE owner_id = $1 AND source = 'overlay' AND chart_hash = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id, seed]
    ) as { id: string; waveform_url?: string; preview_url?: string; og_image_url?: string; timeline_json?: string };

    if (existingTrack) {
      let reasoning = null;
      try { reasoning = existingTrack.timeline_json ? JSON.parse(existingTrack.timeline_json) : null; } catch (_) {}
      const response = {
        track: {
          id: existingTrack.id,
          audio_url: existingTrack.preview_url || existingTrack.waveform_url || null
        },
        text: reasoning?.reasoning?.text || reasoning?.text || null,
        reasoning
      };
      if (redisClient) await redisClient.set(cacheKey, JSON.stringify(response), { EX: 60 * 60 * 20 }); // ~20h
      return res.json({ source: 'db', ...response });
    }

    // 5) Generate new overlay using existing vNext compose for text/controls
    const natalDatetimeISO = new Date(user.birth_datetime).toISOString();
    const currentDatetimeISO = new Date(Date.UTC(yyyy, parseInt(mm, 10) - 1, parseInt(dd, 10), 12, 0, 0)).toISOString();

    const composeBody = {
      mode: 'overlay',
      overlayParams: {
        natalLatitude: Number(user.birth_lat),
        natalLongitude: Number(user.birth_lon),
        natalDatetime: natalDatetimeISO,
        currentLatitude: Number(user.birth_lat),
        currentLongitude: Number(user.birth_lon),
        currentDatetime: currentDatetimeISO
      }
    };

    const composeResp = await fetch(`${process.env.API_BASE_URL || ''}/api/compose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(composeBody)
    });

    if (!composeResp.ok) throw new Error(`Compose failed: HTTP ${composeResp.status}`);
    const composeJson = await composeResp.json();

    // Build vector from compose controls (same order as convertPayloadToFeatureVec)
    const c = composeJson.controls || {};
    const vector = [
      c.arc_shape,
      c.density_level,
      c.tempo_norm,
      c.step_bias,
      c.syncopation_bias,
      c.motif_rate
    ].map((v) => Math.max(0, Math.min(1, Number.isFinite(v) ? Number(v) : 0.45)));

    // Minimal chart context for render (elemental mode uses dominantElements)
    const dominant = (c.element_dominance || '').toString();
    const dominantElements: Record<string, number> = { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 };
    if (['fire','earth','air','water'].includes(dominant)) dominantElements[dominant] = 0.4;

    const renderBody = {
      chartContext: { dominantElements },
      mode: 'elemental',
      vector,
      format: 'wav',
      normalize: true,
      duration: 60
    };

    const renderResp = await fetch(`${process.env.API_BASE_URL || ''}/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(renderBody)
    });

    if (!renderResp.ok) throw new Error(`Render failed: HTTP ${renderResp.status}`);
    const renderJson = await renderResp.json();

    // 6) Persist track for today with reasoning bundled
    const reasoning = {
      reasoning: {
        text: composeJson.text,
        gate_report: composeJson.gate_report,
        artifacts: composeJson.artifacts,
        controls: composeJson.controls
      }
    };

    const track = await insert(
      `INSERT INTO tracks (owner_id, mode, genre, source, chart_hash, duration_sec, preview_url, timeline_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        req.user.id,
        'elemental',
        'daily',
        'overlay',
        seed,
        renderJson.duration || 60,
        renderJson.audioUrl || null,
        JSON.stringify(reasoning)
      ]
    ) as { id: string };

    const response = {
      track: { id: track.id, audio_url: renderJson.audioUrl || null },
      text: composeJson.text,
      reasoning
    };

    if (redisClient) await redisClient.set(cacheKey, JSON.stringify(response), { EX: 60 * 60 * 20 });
    return res.json({ source: 'generated', ...response });
  } catch (error) {
    console.error('Daily overlay error:', error);

    // Fallback: try yesterday's overlay
    try {
      const today = new Date();
      const y = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
      const yyyy = y.getUTCFullYear();
      const mm = String(y.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(y.getUTCDate()).padStart(2, '0');
      const seedY = `${req.user.id}:${yyyy}${mm}${dd}`;
      const yTrack = await getRow(
        `SELECT id, waveform_url, preview_url, timeline_json
         FROM tracks
         WHERE owner_id = $1 AND source = 'overlay' AND chart_hash = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [req.user.id, seedY]
      ) as { id: string; waveform_url?: string; preview_url?: string; timeline_json?: string };
      if (yTrack) {
        let reasoning = null;
        try { reasoning = yTrack.timeline_json ? JSON.parse(yTrack.timeline_json) : null; } catch (_) {}
        return res.status(200).json({
          source: 'fallback',
          banner: "Today's transit data unavailable. Playing yesterday's track.",
          track: { id: yTrack.id, audio_url: yTrack.preview_url || yTrack.waveform_url || null },
          text: reasoning?.reasoning?.text || reasoning?.text || null,
          reasoning
        });
      }
    } catch (_) {}

    return res.status(503).json({ error: 'overlay_unavailable', message: 'Unable to generate or fetch daily overlay.' });
  }
});

export default router;
