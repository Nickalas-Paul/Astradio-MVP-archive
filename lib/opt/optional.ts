// Optional module loading helper
// Replaces repetitive try/catch patterns for optional dependencies

import * as path from 'path';

/**
 * Load a module optionally, returning undefined if not found
 */
export function optional<T = any>(name: string, loader: () => T): T | undefined {
  try {
    return loader();
  } catch (error: any) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      console.log(`Optional module '${name}' not available, continuing without it`);
      return undefined;
    }
    throw error;
  }
}

/**
 * Load a module from a specific path optionally
 */
export function optionalRequire<T = any>(modPath: string, name?: string): T | undefined {
  return optional(name || modPath, () => require(modPath));
}

/**
 * Load a compiled TypeScript module optionally
 */
export function optionalCompiled<T = any>(basePath: string, moduleName: string): T | undefined {
  const modPath = path.join(basePath, 'dist', moduleName);
  return optionalRequire<T>(modPath, moduleName);
}

/**
 * Create a no-op function for optional modules
 */
export function noop<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: any[]) => {
    console.warn(`Optional function '${fn.name}' called but module not available`);
    return undefined;
  }) as T;
}

/**
 * Create a no-op middleware for optional modules
 */
export function noopMiddleware() {
  return (req: any, res: any, next: any) => {
    if (next) next();
  };
}

/**
 * Create a no-op router for optional modules
 */
export function noopRouter() {
  const express = require('express');
  return express.Router();
}
