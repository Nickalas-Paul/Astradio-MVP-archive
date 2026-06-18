/**
 * Password hashing and validation for the Node engine (Render).
 * Mirrors lib/auth/crypto.ts — keep in sync when changing Argon2 policy.
 */

const argon2 = require('argon2');

const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: parseInt(process.env.ARGON2_MEMORY_COST || '65536', 10),
  timeCost: parseInt(process.env.ARGON2_TIME_COST || '3', 10),
  parallelism: parseInt(process.env.ARGON2_PARALLELISM || '1', 10),
  saltLength: parseInt(process.env.ARGON2_SALT_LENGTH || '16', 10),
  hashLength: parseInt(process.env.ARGON2_HASH_LENGTH || '32', 10),
};

async function hashPassword(password) {
  return argon2.hash(password, ARGON2_CONFIG);
}

async function verifyPassword(hash, password) {
  return argon2.verify(hash, password);
}

function validatePassword(password) {
  const errors = [];
  const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH || '12', 10);

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }

  if (process.env.PASSWORD_REQUIRE_UPPERCASE === 'true' && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (process.env.PASSWORD_REQUIRE_LOWERCASE === 'true' && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (process.env.PASSWORD_REQUIRE_NUMBERS === 'true' && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (
    process.env.PASSWORD_REQUIRE_SYMBOLS === 'true' &&
    !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
  ) {
    errors.push('Password must contain at least one symbol');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePassword,
};
