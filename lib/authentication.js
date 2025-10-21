const jwt = require('jsonwebtoken');
const { hashPassword: hashPasswordTS, verifyPassword: verifyPasswordTS, validatePassword: validatePasswordTS } = require('./auth/crypto');
const crypto = require('crypto');
const { ulid } = require('ulid');
const { getRow } = require('./database');
const redis = require('./redis');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Password hashing moved to lib/auth/crypto.ts

// Password validation moved to lib/auth/crypto.ts
function validatePassword(password) {
  return validatePasswordTS(password);
}

// Password hashing moved to lib/auth/crypto.ts
async function hashPassword(password) {
  return await hashPasswordTS(password);
}

async function comparePassword(password, hash) {
  return await verifyPasswordTS(hash, password);
}

// Generate secure random token
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// JWT token generation with proper claims
function generateAccessToken(userId, deviceId = null) {
  const jti = ulid(); // Unique token ID
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    aud: 'astradio-api', // Audience
    iss: 'astradio', // Issuer
    sub: userId.toString(), // Subject (user ID)
    jti, // JWT ID
    iat: now, // Issued at
    exp: now + (parseInt(JWT_EXPIRES_IN) * 60), // Expiration
    type: 'access',
    device_id: deviceId
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

function generateRefreshToken(userId, deviceId = null) {
  const jti = ulid();
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    aud: 'astradio-api',
    iss: 'astradio',
    sub: userId.toString(),
    jti,
    iat: now,
    exp: now + (parseInt(REFRESH_TOKEN_EXPIRES_IN) * 24 * 60 * 60), // Convert days to seconds
    type: 'refresh',
    device_id: deviceId
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

// JWT token verification with comprehensive checks
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      audience: 'astradio-api',
      issuer: 'astradio'
    });

    // Additional validation
    if (!decoded.sub || !decoded.jti || !decoded.type) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Token verification error:', error.message);
    return null;
  }
}

// Store refresh token in Redis with device tracking
async function storeRefreshToken(userId, refreshToken, deviceInfo = {}) {
  const jti = jwt.decode(refreshToken).jti;
  const key = `refresh_token:${userId}:${jti}`;
  
  const tokenData = {
    token: refreshToken,
    device_id: deviceInfo.deviceId,
    ip_address: deviceInfo.ip,
    user_agent: deviceInfo.userAgent,
    created_at: new Date().toISOString(),
    last_used: new Date().toISOString()
  };

  await redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify(tokenData)); // 7 days
}

// Verify refresh token and track usage
async function verifyRefreshToken(userId, refreshToken) {
  try {
    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return false;
    }

    const jti = decoded.jti;
    const key = `refresh_token:${userId}:${jti}`;
    const storedData = await redis.get(key);

    if (!storedData) {
      return false;
    }

    const tokenData = JSON.parse(storedData);
    
    // Update last used timestamp
    tokenData.last_used = new Date().toISOString();
    await redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify(tokenData));

    return true;
  } catch (error) {
    console.error('Refresh token verification error:', error);
    return false;
  }
}

// Invalidate refresh token
async function invalidateRefreshToken(userId, refreshToken) {
  try {
    const decoded = verifyToken(refreshToken);
    if (decoded && decoded.type === 'refresh') {
      const jti = decoded.jti;
      const key = `refresh_token:${userId}:${jti}`;
      await redis.del(key);
    }
  } catch (error) {
    console.error('Token invalidation error:', error);
  }
}

// Invalidate all refresh tokens for a user (global logout)
async function invalidateAllRefreshTokens(userId) {
  try {
    const pattern = `refresh_token:${userId}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Global logout error:', error);
  }
}

// Generate device ID from request
function generateDeviceId(req) {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection.remoteAddress;
  
  // Create a hash of IP + User-Agent for device identification
  const deviceString = `${ip}:${userAgent}`;
  return crypto.createHash('sha256').update(deviceString).digest('hex').substring(0, 16);
}

// Authentication middleware with device tracking
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyToken(token);
  if (!decoded || decoded.type !== 'access') {
    return res.status(403).json({ error: 'Invalid or expired access token' });
  }

  // Check if token is blacklisted
  const blacklistKey = `blacklist:${decoded.jti}`;
  const isBlacklisted = await redis.get(blacklistKey);
  if (isBlacklisted) {
    return res.status(403).json({ error: 'Token has been revoked' });
  }

  // Get user from database
  const user = await getRow(
    'SELECT id, email, display_name, username, avatar_url, is_active, two_factor_enabled FROM users WHERE id = $1',
    [decoded.sub]
  );

  if (!user || !user.is_active) {
    return res.status(403).json({ error: 'User not found or inactive' });
  }

  // Add device tracking
  const deviceId = decoded.device_id || generateDeviceId(req);
  
  req.user = user;
  req.deviceId = deviceId;
  req.tokenJti = decoded.jti;
  
  next();
}

// Optional authentication middleware (doesn't fail if no token)
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.type === 'access') {
      const user = await getRow(
        'SELECT id, email, display_name, username, avatar_url FROM users WHERE id = $1 AND is_active = true',
        [decoded.sub]
      );
      if (user) {
        req.user = user;
        req.deviceId = decoded.device_id || generateDeviceId(req);
      }
    }
  }
  
  next();
}

// Magic link token generation and verification
async function generateMagicLinkToken(email) {
  const token = generateSecureToken(32);
  const nonce = ulid();
  const expiresAt = Date.now() + (parseInt(process.env.MAGIC_LINK_EXPIRY) || 600000); // 10 minutes

  const tokenData = {
    email,
    nonce,
    expires_at: expiresAt,
    used: false
  };

  const key = `magic_link:${nonce}`;
  await redis.setex(key, 600, JSON.stringify(tokenData)); // 10 minutes TTL

  return { token, nonce };
}

async function verifyMagicLinkToken(nonce) {
  try {
    const key = `magic_link:${nonce}`;
    const storedData = await redis.get(key);

    if (!storedData) {
      return { valid: false, error: 'Token not found' };
    }

    const tokenData = JSON.parse(storedData);

    if (tokenData.used) {
      return { valid: false, error: 'Token already used' };
    }

    if (Date.now() > tokenData.expires_at) {
      await redis.del(key);
      return { valid: false, error: 'Token expired' };
    }

    // Mark as used
    tokenData.used = true;
    await redis.setex(key, 600, JSON.stringify(tokenData));

    return { valid: true, email: tokenData.email };
  } catch (error) {
    console.error('Magic link verification error:', error);
    return { valid: false, error: 'Token verification failed' };
  }
}

// Rate limiting with Redis
async function checkRateLimit(key, maxRequests, windowMs) {
  try {
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, Math.floor(windowMs / 1000));
    }
    
    return current <= maxRequests;
  } catch (error) {
    console.error('Rate limit check error:', error);
    return true; // Allow request if Redis fails
  }
}

// Blacklist token (for logout)
async function blacklistToken(jti, expiresIn = 900) { // 15 minutes default
  const key = `blacklist:${jti}`;
  await redis.setex(key, expiresIn, '1');
}

// Audit logging
async function logAuthEvent(userId, event, details = {}) {
  try {
    const auditData = {
      user_id: userId,
      event,
      details,
      timestamp: new Date().toISOString(),
      ip_address: details.ip,
      user_agent: details.userAgent,
      device_id: details.deviceId
    };

    // Store in Redis for immediate access
    const auditKey = `audit:${userId}:${ulid()}`;
    await redis.setex(auditKey, 24 * 60 * 60, JSON.stringify(auditData)); // 24 hours

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Auth Audit:', auditData);
    }
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

module.exports = {
  validatePassword,
  hashPassword,
  comparePassword,
  generateSecureToken,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  storeRefreshToken,
  verifyRefreshToken,
  invalidateRefreshToken,
  invalidateAllRefreshTokens,
  generateDeviceId,
  authenticateToken,
  optionalAuth,
  generateMagicLinkToken,
  verifyMagicLinkToken,
  checkRateLimit,
  blacklistToken,
  logAuthEvent
};
