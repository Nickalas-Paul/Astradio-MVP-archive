// lib/hash/chartHash.ts
// NOTE: This file intentionally inlines stableStringify + sha256Hex so vnext builds
// do not depend on app-specific helpers (e.g. apps/web/src/core/hash) that may not
// exist in the Render build context.

import crypto from "crypto";

type JSONObject = { [k: string]: any };

function stableStringify(value: any): string {
  const seen = new WeakSet<object>();

  const stringify = (v: any): any => {
    if (v === null) return null;
    const t = typeof v;

    if (t === "number" || t === "boolean" || t === "string") return v;
    if (t === "bigint") return v.toString();
    if (t === "undefined" || t === "function" || t === "symbol") return null;

    if (Array.isArray(v)) return v.map(stringify);

    if (t === "object") {
      if (seen.has(v)) return "[Circular]";
      seen.add(v);

      const obj = v as JSONObject;
      const keys = Object.keys(obj).sort();
      const out: JSONObject = {};
      for (const k of keys) out[k] = stringify(obj[k]);
      return out;
    }

    return String(v);
  };

  return JSON.stringify(stringify(value));
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Generates a stable chart hash from chart input.
 * Keep deterministic, stable stringify order, no Date.now, no Math.random.
 */
export function generateChartHash(chart: any): string {
  return sha256Hex(stableStringify(chart));
}

export function generateChartHashSync(chart: any): string {
  return sha256Hex(stableStringify(chart));
}
