// Optional module loading helper for CommonJS
// Replaces the missing TypeScript version with a working JavaScript implementation

/**
 * Dynamically requires a module if it exists, otherwise returns undefined.
 * Useful for optional dependencies or development-only modules.
 * @param {string} modulePath - Absolute path recommended. Relative paths resolve from *this file* (lib/opt), not the caller.
 * @param {string} exportName - Optional name of the export to return. If not provided, the whole module is returned.
 * @returns {any} The module or its specified export, or undefined if not found.
 */
function optionalRequire(modulePath, exportName) {
  try {
    const resolvedPath = require.resolve(modulePath);
    const module = require(resolvedPath);
    return exportName ? module[exportName] : module;
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND' && !e.message.includes(`Cannot find module '${modulePath}'`)) {
      console.warn(`[optionalRequire] Error loading module ${modulePath}:`, e.message);
    }
    return undefined;
  }
}

/**
 * Returns a no-operation middleware function for Express.
 */
function noopMiddleware() {
  return (req, res, next) => next();
}

/**
 * Returns a no-operation Express Router instance.
 */
function noopRouter() {
  const express = require('express');
  const router = express.Router();
  return router;
}

module.exports = {
  optionalRequire,
  noopMiddleware,
  noopRouter
};
