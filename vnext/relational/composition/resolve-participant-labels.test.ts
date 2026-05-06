/**
 * Run: npm run vnext:build && node --test dist/vnext/vnext/relational/composition/resolve-participant-labels.test.js
 */
import assert from 'node:assert';
import test from 'node:test';
import type { Chart } from '../../compat/types';
import { participantLabelsFromCharts } from './resolve-participant-labels';

function makeChart(partial: Partial<Chart> & Pick<Chart, 'id' | 'label'>): Chart {
  return {
    date: '1990-01-01',
    time: '12:00',
    lat: 0,
    lon: 0,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

test('neutral labels from chart names when no owner context', () => {
  const ids = ['a', 'b'] as const;
  const charts = [
    makeChart({ id: 'a', label: 'Alice', ownerId: 'u1' }),
    makeChart({ id: 'b', label: 'Bob', ownerId: 'u2' }),
  ];
  const labels = participantLabelsFromCharts(ids, charts, {});
  assert.deepStrictEqual(
    labels.map((x) => ({ slotIndex: x.slotIndex, label: x.label, isViewer: x.isViewer })),
    [
      { slotIndex: 0, label: 'Alice', isViewer: false },
      { slotIndex: 1, label: 'Bob', isViewer: false },
    ]
  );
});

test('YOUR when viewer + owner match single owned slot', () => {
  const ids = ['a', 'b'] as const;
  const charts = [
    makeChart({ id: 'a', label: 'Mine', ownerId: 'u1' }),
    makeChart({ id: 'b', label: 'Other', ownerId: 'u2' }),
  ];
  const labels = participantLabelsFromCharts(ids, charts, {
    viewerChartId: 'a',
    labelResolutionOwnerId: 'u1',
  });
  assert.strictEqual(labels[0].label, 'YOUR');
  assert.strictEqual(labels[0].isViewer, true);
  assert.strictEqual(labels[1].label, 'Other');
});

test('ambiguous multi-owned without viewer → neutral names, no YOUR', () => {
  const ids = ['a', 'b', 'c'] as const;
  const charts = [
    makeChart({ id: 'a', label: 'First', ownerId: 'u1' }),
    makeChart({ id: 'b', label: 'Second', ownerId: 'u1' }),
    makeChart({ id: 'c', label: 'Third', ownerId: 'u2' }),
  ];
  const labels = participantLabelsFromCharts(ids, charts, { labelResolutionOwnerId: 'u1' });
  assert.strictEqual(labels[0].isViewer, false);
  assert.strictEqual(labels[1].isViewer, false);
  assert.strictEqual(labels[0].label, 'First');
  assert.strictEqual(labels[1].label, 'Second');
});

test('birth-only slot uses Person N', () => {
  const ids = ['a', null, 'b'] as const;
  const charts = [
    makeChart({ id: 'a', label: 'A', ownerId: 'u1' }),
    undefined,
    makeChart({ id: 'b', label: '', ownerId: 'u2' }),
  ];
  const labels = participantLabelsFromCharts(ids, charts, {});
  assert.strictEqual(labels[0].label, 'A');
  assert.strictEqual(labels[1].label, 'Person 1');
  assert.match(labels[2].label, /^Person \d+$/);
});
