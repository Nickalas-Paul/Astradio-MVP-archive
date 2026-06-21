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
  if (s === 'community_relationship') return 'Connection reading';
  if (s === 'community_group') return 'Group reading';
  if (s === 'community_relational_weather') return 'Connection reading';
  if (s === 'profile_active') return 'Transit reading';
  if (s === 'profile_identity') return 'Identity';
  if (s === 'community_post_audio') return 'Community audio';
  if (s === 'sandbox') return 'Sandbox reading';
  if (s === 'sky') return "Today's Sky";
  return s ? s.replace(/_/g, ' ') : 'Saved reading';
}

export function formatLibraryCreatedAt(createdAt: unknown): string {
  if (createdAt == null || createdAt === '') return '';
  const d = new Date(String(createdAt));
  if (Number.isNaN(d.getTime())) return String(createdAt);
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function chartNamesFromRow(row: Record<string, unknown>): string[] {
  const names: string[] = [];
  const ps = parseSandboxState(row.sandbox_state);
  const report =
    row.report && typeof row.report === 'object' && !Array.isArray(row.report)
      ? (row.report as Record<string, unknown>)
      : null;

  const groupName = typeof report?.groupName === 'string' ? report.groupName.trim() : '';
  if (groupName) names.push(groupName);

  const compositionInput = ps?.composition_input;
  if (compositionInput && typeof compositionInput === 'object' && !Array.isArray(compositionInput)) {
    const slots = (compositionInput as { slots?: unknown }).slots;
    if (Array.isArray(slots)) {
      for (const slot of slots) {
        if (!slot || typeof slot !== 'object' || Array.isArray(slot)) continue;
        const displayName = (slot as { chart_display_name?: unknown }).chart_display_name;
        if (typeof displayName === 'string' && displayName.trim()) {
          names.push(displayName.trim());
        }
      }
    }
  }

  return names;
}

function formatChartNameList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function libraryChartDetailSuffix(row: Record<string, unknown>): string {
  const compositionType = String(row.composition_type ?? '').trim();
  if (compositionType === 'A') return '';

  const names = chartNamesFromRow(row);
  if (names.length > 0) {
    return ` · ${formatChartNameList(names)}`;
  }

  if (compositionType === 'A+B') return ' · 2 charts';
  if (compositionType === 'A+B+N') {
    const source = String(row.source ?? '').trim();
    if (source === 'community_group') return ' · Group reading';
    return ' · 3 charts';
  }

  return '';
}

function formatLibraryDateValue(value: unknown): string {
  if (value == null || value === '') return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value).trim();
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function sameCalendarDay(a: unknown, b: unknown): boolean {
  const da = new Date(String(a));
  const db = new Date(String(b));
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function libraryRowSummary(row: Record<string, unknown>): string {
  const customLabel = String(row.display_label ?? '').trim();
  if (customLabel) return customLabel;

  const source = String(row.source ?? '').trim();
  const ps = parseSandboxState(row.sandbox_state);
  const createdDate = formatLibraryCreatedAt(row.created_at);

  if (source === 'sky' || ps?.kind === 'sky_summary') {
    const skyDate =
      typeof ps?.date === 'string' && ps.date.trim()
        ? formatLibraryDateValue(ps.date)
        : createdDate;
    return skyDate ? `Today's Sky · ${skyDate}` : "Today's Sky";
  }

  let displayDate = createdDate;
  if (source === 'profile_active' || ps?.kind === 'profile_active') {
    const calendarDate = typeof ps?.calendarDate === 'string' ? ps.calendarDate.trim() : '';
    if (calendarDate && row.created_at != null && !sameCalendarDay(calendarDate, row.created_at)) {
      const transitDate = formatLibraryDateValue(calendarDate);
      if (transitDate) displayDate = transitDate;
    }
  }

  const label = librarySourceLabel(row.source);
  const suffix = libraryChartDetailSuffix(row);
  return [displayDate, label].filter(Boolean).join(' · ') + suffix;
}
