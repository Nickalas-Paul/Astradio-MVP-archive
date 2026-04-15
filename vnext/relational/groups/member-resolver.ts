/**
 * Phase 5 — Resolve chart IDs for a relational group.
 * Deterministic order: chart_id ASC. Fail-closed.
 * chart_id is stored on astradio_relational_group_members (source of truth).
 */

// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

// Path from dist/vnext/vnext/relational/groups/ -> repo root lib
// eslint-disable-next-line @typescript-eslint/no-var-requires
const relationalStore = require('../../../../../lib/relational-store');

/**
 * Resolve chart IDs for a group. Requires owner authorization.
 * Order: chart_id ASC (deterministic).
 * @throws If group not found, not owned by owner_id, or has zero members.
 */
export async function resolveGroupChartIds(
  groupId: string,
  ownerId: string
): Promise<string[]> {
  const group = await relationalStore.getRelationalGroupById(groupId);
  if (!group) {
    throw new Error(`Relational group not found: ${groupId}`);
  }
  if (group.ownerId !== ownerId) {
    throw new Error(`Unauthorized: group ${groupId} is not owned by ${ownerId}`);
  }

  const members = await relationalStore.listRelationalGroupMembers(groupId, ownerId);
  if (!members || members.length === 0) {
    throw new Error(`Relational group has no members: ${groupId}`);
  }

  const chartIds = members.map((m: { chartId: string }) => m.chartId).filter(Boolean) as string[];
  chartIds.sort((a, b) => a.localeCompare(b, 'en'));
  return chartIds;
}
