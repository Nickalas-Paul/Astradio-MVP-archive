const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const hpp = require('hpp');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const requestId = require('express-request-id');
const compression = require('compression');

// Security configuration
const securityConfig = {
  // Helmet configuration with strict CSP
  helmet: {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "https:", "data:"],
        "media-src": ["'self'", "https:"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
        "worker-src": ["'self'", "blob:"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "connect-src": ["'self'", "https:"],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "object-src": ["'none'"],
        "upgrade-insecure-requests": []
      }
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "deny" },
    hsts: { 
      maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000, 
      includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS === 'true', 
      preload: process.env.HSTS_PRELOAD === 'true' 
    },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
    ieNoOpen: true,
    permittedCrossDomainPolicies: true
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 600 // 10 minutes
  },

  // Rate limiting configurations
  rateLimits: {
    // Global rate limit
    global: rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      message: { error: 'Too many requests from this IP, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.ip,
      skip: (req) => req.path.startsWith('/health')
    }),

    // Authentication endpoints
    auth: rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 60 * 1000, // 1 minute
      max: parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 10,
      message: { error: 'Too many authentication attempts, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.ip,
      skip: (req) => req.path === '/health'
    }),

    // Daily auth limit
    authDaily: rateLimit({
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      max: parseInt(process.env.RATE_LIMIT_AUTH_DAILY_MAX) || 100,
      message: { error: 'Daily authentication limit exceeded.' },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.ip
    }),

    // Render endpoints
    render: rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_RENDER_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
      max: parseInt(process.env.RATE_LIMIT_RENDER_MAX) || 3,
      message: { error: 'Render limit exceeded. Please upgrade your plan for more renders.' },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user ? req.user.id : req.ip
    }),

    // Social actions (likes, follows, shares)
    social: rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_SOCIAL_WINDOW_MS) || 60 * 1000, // 1 minute
      max: parseInt(process.env.RATE_LIMIT_SOCIAL_MAX) || 60,
      message: { error: 'Too many social actions, please slow down.' },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user ? req.user.id : req.ip
    }),

    // Magic link rate limiting
    magicLink: rateLimit({
      windowMs: parseInt(process.env.MAGIC_LINK_RATE_WINDOW) || 60 * 60 * 1000, // 1 hour
      max: parseInt(process.env.MAGIC_LINK_RATE_LIMIT) || 5,
      message: { error: 'Too many magic link requests, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.ip
    })
  },

  // Slow down configuration (relaxed for development)
  slowDown: slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 200, // Allow 200 requests per 15 minutes, then...
    delayMs: () => 100 // Begin adding 100ms of delay per request above 200
  })
};

// Security middleware setup function
function setupSecurityMiddleware(app) {
  // Add request ID for tracking
  app.use(requestId());

  // Compression
  app.use(compression());

  // Cookie parser
  app.use(cookieParser(process.env.SESSION_SECRET));

  // Security headers
  app.use(helmet(securityConfig.helmet));

  // CORS
  app.use(cors(securityConfig.cors));

  // Prevent parameter pollution
  app.use(hpp());

  // Sanitize data
  app.use(xss());
  app.use(mongoSanitize());

  // Rate limiting
  app.use(securityConfig.rateLimits.global);
  app.use(securityConfig.slowDown);

  // Additional security headers
  app.use((req, res, next) => {
    // Remove X-Powered-By header
    res.removeHeader('X-Powered-By');
    
    // Add custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    
    next();
  });
}

// Route-specific rate limiting middleware
function getRateLimitMiddleware(type) {
  return securityConfig.rateLimits[type] || securityConfig.rateLimits.global;
}

// Input validation and sanitization
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // Remove null bytes
  input = input.replace(/\0/g, '');
  
  // Remove control characters except newlines and tabs
  input = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Trim whitespace
  input = input.trim();
  
  return input;
}

// URL validation to prevent SSRF
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    
    // Block private IP ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];
    
    const hostname = parsed.hostname;
    
    // Check for private IP ranges
    for (const range of privateRanges) {
      if (range.test(hostname)) {
        return false;
      }
    }
    
    // Only allow HTTP and HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// File type validation
function isValidFileType(mimeType, allowedTypes) {
  const allowed = allowedTypes ? allowedTypes.split(',') : [
    'image/jpeg',
    'image/png', 
    'image/webp',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg'
  ];
  
  return allowed.includes(mimeType);
}

// File size validation
function isValidFileSize(size, maxSize) {
  const max = maxSize || parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB default
  return size <= max;
}

module.exports = {
  setupSecurityMiddleware,
  getRateLimitMiddleware,
  sanitizeInput,
  isValidUrl,
  isValidFileType,
  isValidFileSize,
  securityConfig
};
