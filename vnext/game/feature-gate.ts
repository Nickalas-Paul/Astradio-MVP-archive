/** Feature gate for Phase 3 combat. */
export function isGameCombatEnabled(): boolean {
  return process.env.GAME_COMBAT_ENABLED === '1';
}
