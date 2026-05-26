export function parseSandboxState(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function explanationFromCompatibilityText(raw: unknown): { sections: Array<Record<string, unknown>> } {
  if (typeof raw === 'string') {
    return {
      sections: [{ sectionId: 'community', title: 'Community artifact', text: raw }],
    };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as { short?: unknown; long?: unknown; bullets?: unknown };
    const short = typeof obj.short === 'string' ? obj.short : '';
    const long = typeof obj.long === 'string' ? obj.long : '';
    const bullets = Array.isArray(obj.bullets) ? obj.bullets.map((b) => String(b)) : [];
    const text = [short, long].filter(Boolean).join('\n\n');
    return {
      sections: [{ sectionId: 'community', title: 'Community artifact', text, bullets }],
    };
  }
  return {
    sections: [{ sectionId: 'community', title: 'Community artifact', text: '' }],
  };
}

export function librarySourceLabel(source: unknown): string {
  const s = String(source || '').trim();
  if (s === 'community_relationship') return 'Relationship artifact';
  if (s === 'community_group') return 'Group relationship artifact';
  if (s === 'community_relational_weather') return 'Connection reading';
  if (s === 'profile_active') return 'Current transit';
  if (s === 'profile_identity') return 'Identity';
  return s || '—';
}
