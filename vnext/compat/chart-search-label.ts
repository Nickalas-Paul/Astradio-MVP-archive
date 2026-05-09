/**
 * Pre-formatted row label for Sandbox GET /api/charts/search results.
 */

export function formatSandboxChartSearchLabel(
  chart: { label: string; date: string },
  ownerUser: { displayName?: string; handle?: string } | null
): string {
  const name =
    ownerUser?.displayName?.trim() || ownerUser?.handle?.replace(/^@/, '') || chart.label || 'Unknown';
  let handlePart = '';
  if (ownerUser?.handle && ownerUser.handle.trim()) {
    const h = ownerUser.handle.trim().startsWith('@')
      ? ownerUser.handle.trim()
      : `@${ownerUser.handle.trim()}`;
    handlePart = ` (${h})`;
  }
  return `${name}${handlePart} · ${chart.date}`;
}
