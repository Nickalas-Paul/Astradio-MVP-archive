/**
 * Mirrors CampaignDailyClient initialDate(): local calendar YYYY-MM-DD (not UTC slice).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

function localCalendarDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('local calendar date (Campaign daily default)', () => {
  it('formats a fixed local date without UTC shift', () => {
    const d = new Date(2026, 3, 15, 23, 30, 0);
    assert.strictEqual(localCalendarDate(d), '2026-04-15');
  });
});
