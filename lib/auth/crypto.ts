// Single source of truth for password hashing
// Uses Argon2id for secure password storage

import argon2 from 'argon2';

const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: parseInt(process.env.ARGON2_MEMORY_COST || '65536'),
  timeCost: parseInt(process.env.ARGON2_TIME_COST || '3'),
  parallelism: parseInt(process.env.ARGON2_PARALLELISM || '1'),
  saltLength: parseInt(process.env.ARGON2_SALT_LENGTH || '16'),
  hashLength: parseInt(process.env.ARGON2_HASH_LENGTH || '32'),
};

/**
 * Hash password with Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, ARGON2_CONFIG);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return await argon2.verify(hash, password);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH || '12');
  
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
  
  if (process.env.PASSWORD_REQUIRE_SYMBOLS === 'true' && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one symbol');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
