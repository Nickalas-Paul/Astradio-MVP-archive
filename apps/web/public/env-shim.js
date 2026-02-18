/**
 * Environment Variable Shim for Browser
 * Handles process.env references in browser context
 */

const read = (k, def) => {
  // 1) Node-style (SSR) if present
  const b = (typeof process !== 'undefined' && process.env && process.env[k]) || undefined;
  // 2) Window-injected config if you add <script> setting globals
  const c = (typeof globalThis !== 'undefined' && globalThis.__CONF__ && globalThis.__CONF__[k]) || undefined;
  return (b ?? c ?? def);
};

const ML_ASSIST_ENABLED = String(read('NEXT_PUBLIC_ML_ASSIST', '1')) === '1';
const ML_ASSIST_ALPHA   = Number(read('NEXT_PUBLIC_ML_ASSIST_ALPHA', 0.25));

// Export for browser
if (typeof window !== 'undefined') {
  window.ML_ASSIST_ENABLED = ML_ASSIST_ENABLED;
  window.ML_ASSIST_ALPHA = ML_ASSIST_ALPHA;
}
