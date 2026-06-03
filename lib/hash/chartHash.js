"use strict";
// lib/hash/chartHash.js — CJS runtime for chart hash (source of truth: chartHash.ts)
// Inlines stableStringify + sha256Hex; no app-specific imports.

const crypto = require("crypto");

function stableStringify(value) {
  const seen = new WeakSet();

  const stringify = (v) => {
    if (v === null) return null;
    const t = typeof v;

    if (t === "number" || t === "boolean" || t === "string") return v;
    if (t === "bigint") return v.toString();
    if (t === "undefined" || t === "function" || t === "symbol") return null;

    if (Array.isArray(v)) return v.map(stringify);

    if (t === "object") {
      if (seen.has(v)) return "[Circular]";
      seen.add(v);

      const keys = Object.keys(v).sort();
      const out = {};
      for (const k of keys) out[k] = stringify(v[k]);
      return out;
    }

    return String(v);
  };

  return JSON.stringify(stringify(value));
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function generateChartHash(chart) {
  return sha256Hex(stableStringify(chart));
}

function generateChartHashSync(chart) {
  return sha256Hex(stableStringify(chart));
}

module.exports = {
  generateChartHash,
  generateChartHashSync,
};
