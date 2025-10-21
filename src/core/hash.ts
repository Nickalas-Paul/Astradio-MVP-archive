export async function sha256Hex(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const data = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node path (SSR)
    const { createHash } = await import('crypto');
    return createHash('sha256').update(input).digest('hex');
  }
}

export function stableStringify(value: unknown): string {
  const seen = new WeakSet();
  const stringify = (val: any): any => {
    if (val && typeof val === 'object') {
      if (seen.has(val)) return null;
      seen.add(val);
      if (Array.isArray(val)) return val.map(stringify);
      return Object.keys(val).sort().reduce((acc: any, k) => {
        acc[k] = stringify(val[k]);
        return acc;
      }, {});
    }
    return val;
  };
  return JSON.stringify(stringify(value));
}


