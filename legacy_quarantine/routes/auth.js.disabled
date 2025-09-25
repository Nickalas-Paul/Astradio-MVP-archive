const express = require('express');
const { body, validationResult } = require('express-validator');
const { 
  validatePassword,
  hashPassword, 
  comparePassword, 
  generateAccessToken, 
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  invalidateRefreshToken,
  invalidateAllRefreshTokens,
  generateMagicLinkToken,
  verifyMagicLinkToken,
  checkRateLimit,
  blacklistToken,
  logAuthEvent,
  generateDeviceId
} = require('../lib/authentication');
const { getRow, insert, update } = require('../lib/database');
const { getRateLimitMiddleware } = require('../lib/security');
const redis = require('../lib/redis');

const router = express.Router();

// Validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail().trim(),
  body('password').custom((value) => {
    const validation = validatePassword(value);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }
    return true;
  }),
  body('display_name').trim().isLength({ min: 1, max: 100 }).escape(),
  body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_-]+$/).escape(),
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().trim(),
  body('password').notEmpty(),
];

const validatePasswordReset = [
  body('email').isEmail().normalizeEmail().trim(),
];

// Register new user
router.post('/register', 
  getRateLimitMiddleware('auth'),
  validateRegistration, 
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, display_name, username } = req.body;

      // Check rate limiting
      const rateLimitKey = `register:${req.ip}`;
      const allowed = await checkRateLimit(rateLimitKey, 5, 3600000); // 5 per hour
      if (!allowed) {
        return res.status(429).json({ error: 'Too many registration attempts' });
      }

      // Check if email already exists
      const existingUser = await getRow('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Check if username already exists
      const existingUsername = await getRow('SELECT id FROM users WHERE username = $1', [username]);
      if (existingUsername) {
        return res.status(409).json({ error: 'Username already taken' });
      }

      // Hash password with Argon2id
      const passwordHash = await hashPassword(password);

      // Create user
      const user = await insert(
        `INSERT INTO users (email, password_hash, display_name, username, is_active) 
         VALUES ($1, $2, $3, $4, true) 
         RETURNING id, email, display_name, username, created_at`,
        [email, passwordHash, display_name, username]
      );

      // Generate device ID
      const deviceId = generateDeviceId(req);

      // Generate tokens
      const accessToken = generateAccessToken(user.id, deviceId);
      const refreshToken = generateRefreshToken(user.id, deviceId);
      
      // Store refresh token with device info
      await storeRefreshToken(user.id, refreshToken, {
        deviceId,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Create profile
      await insert(
        'INSERT INTO profiles (user_id) VALUES ($1)',
        [user.id]
      );

      // Log registration event
      await logAuthEvent(user.id, 'registration', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        deviceId
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          username: user.username,
        },
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Login
router.post('/login', 
  getRateLimitMiddleware('auth'),
  validateLogin, 
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Check rate limiting
      const rateLimitKey = `login:${req.ip}`;
      const allowed = await checkRateLimit(rateLimitKey, 10, 60000); // 10 per minute
      if (!allowed) {
        return res.status(429).json({ error: 'Too many login attempts' });
      }

      // Get user
      const user = await getRow(
        'SELECT id, email, password_hash, display_name, username, is_active, two_factor_enabled FROM users WHERE email = $1',
        [email]
      );

      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        // Log failed login attempt
        await logAuthEvent(user.id, 'login_failed', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          reason: 'invalid_password'
        });
        
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate device ID
      const deviceId = generateDeviceId(req);

      // Generate tokens
      const accessToken = generateAccessToken(user.id, deviceId);
      const refreshToken = generateRefreshToken(user.id, deviceId);
      
      // Store refresh token with device info
      await storeRefreshToken(user.id, refreshToken, {
        deviceId,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Log successful login
      await logAuthEvent(user.id, 'login_success', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        deviceId
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          username: user.username,
          two_factor_enabled: user.two_factor_enabled
        },
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = require('jsonwebtoken').decode(refresh_token);
    if (!decoded || !decoded.sub) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const isValid = await verifyRefreshToken(decoded.sub, refresh_token);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Generate new tokens
    const deviceId = decoded.device_id || generateDeviceId(req);
    const accessToken = generateAccessToken(decoded.sub, deviceId);
    const newRefreshToken = generateRefreshToken(decoded.sub, deviceId);

    // Store new refresh token
    await storeRefreshToken(decoded.sub, newRefreshToken, {
      deviceId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Invalidate old refresh token
    await invalidateRefreshToken(decoded.sub, refresh_token);

    // Log token refresh
    await logAuthEvent(decoded.sub, 'token_refresh', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId
    });

    res.json({
      access_token: accessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = require('jsonwebtoken').decode(token);
      if (decoded && decoded.jti) {
        // Blacklist the access token
        await blacklistToken(decoded.jti);
        
        // Log logout event
        if (decoded.sub) {
          await logAuthEvent(decoded.sub, 'logout', {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            deviceId: decoded.device_id
          });
        }
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Global logout (invalidate all sessions)
router.post('/logout-all', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = require('jsonwebtoken').decode(token);
    if (!decoded || !decoded.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Invalidate all refresh tokens
    await invalidateAllRefreshTokens(decoded.sub);
    
    // Blacklist current token
    if (decoded.jti) {
      await blacklistToken(decoded.jti);
    }

    // Log global logout
    await logAuthEvent(decoded.sub, 'global_logout', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: decoded.device_id
    });

    res.json({ message: 'All sessions logged out successfully' });
  } catch (error) {
    console.error('Global logout error:', error);
    res.status(500).json({ error: 'Global logout failed' });
  }
});

// Request password reset (magic link)
router.post('/forgot-password', 
  getRateLimitMiddleware('magicLink'),
  validatePasswordReset,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      // Check if user exists
      const user = await getRow('SELECT id, email FROM users WHERE email = $1 AND is_active = true', [email]);
      if (!user) {
        // Don't reveal if email exists or not
        return res.json({ message: 'If the email exists, a reset link has been sent' });
      }

      // Generate magic link
      const { token, nonce } = await generateMagicLinkToken(email);

      // TODO: Send email with magic link
      // For now, just return the token (in production, send via email)
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${nonce}`;

      // Log password reset request
      await logAuthEvent(user.id, 'password_reset_requested', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({ 
        message: 'If the email exists, a reset link has been sent',
        // Remove this in production - only for development
        resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ error: 'Password reset request failed' });
    }
  }
);

// Reset password with magic link
router.post('/reset-password', 
  getRateLimitMiddleware('auth'),
  [
    body('token').notEmpty(),
    body('password').custom((value) => {
      const validation = validatePassword(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      return true;
    })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, password } = req.body;

      // Verify magic link token
      const verification = await verifyMagicLinkToken(token);
      if (!verification.valid) {
        return res.status(400).json({ error: verification.error });
      }

      // Get user
      const user = await getRow('SELECT id, email FROM users WHERE email = $1 AND is_active = true', [verification.email]);
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }

      // Hash new password
      const passwordHash = await hashPassword(password);

      // Update password
      await update(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, user.id]
      );

      // Invalidate all refresh tokens (force re-login)
      await invalidateAllRefreshTokens(user.id);

      // Log password reset
      await logAuthEvent(user.id, 'password_reset_completed', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Password reset failed' });
    }
  }
);

module.exports = router;
