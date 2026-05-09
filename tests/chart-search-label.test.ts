import { describe, expect, test } from '@jest/globals';
import { formatSandboxChartSearchLabel } from '../vnext/compat/chart-search-label';

describe('formatSandboxChartSearchLabel', () => {
  test('uses display name and normalizes handle with @', () => {
    expect(
      formatSandboxChartSearchLabel(
        { label: 'Me', date: '1988-05-15' },
        { displayName: 'Nickster', handle: 'nickster' }
      )
    ).toBe('Nickster (@nickster) · 1988-05-15');
  });

  test('uses stripped handle as name when display name absent', () => {
    expect(formatSandboxChartSearchLabel({ label: 'Chart', date: '1990-03-21' }, { handle: '@qa_user' })).toBe(
      'qa_user (@qa_user) · 1990-03-21'
    );
  });
});
