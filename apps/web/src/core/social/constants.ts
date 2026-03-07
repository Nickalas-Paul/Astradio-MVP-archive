/**
 * Community/compat constants. Used to treat default placeholder chart as "no real chart"
 * so the UI never presents it as the user's natal chart.
 */
export const DEFAULT_PROFILE_CHART_ID = 'chart_profile_default';

export function hasRealChart(
  primaryChart: { id: string } | null | undefined
): primaryChart is { id: string } {
  return !!primaryChart && primaryChart.id !== DEFAULT_PROFILE_CHART_ID;
}
