/**
 * Compatibility intent cluster form — scope + canonical intent only (no client-side facet weights).
 */

import type { RelationalIntent } from './relational-intent';

export type ScopeType = 'my_groups' | 'this_group' | 'global';

export const SCOPE_OPTIONS: { value: ScopeType; label: string }[] = [
  { value: 'my_groups', label: 'My groups' },
  { value: 'this_group', label: 'This group' },
  { value: 'global', label: 'Global' },
];

export type BackendScopeType = 'my_groups' | 'group' | 'global';

export function toBackendScope(scope: ScopeType): BackendScopeType {
  return scope === 'this_group' ? 'group' : scope;
}

export { RELATIONAL_INTENT_OPTIONS, RELATIONAL_INTENT_LABELS } from './relational-intent';
export type { RelationalIntent } from './relational-intent';

export function bandLabel(band: string): string {
  switch (band) {
    case 'ease':
      return 'Easy conversation';
    case 'spark':
      return 'Creative spark';
    case 'growth':
      return 'Growth edge';
    case 'complex':
      return 'Complex blend';
    default:
      return band;
  }
}
