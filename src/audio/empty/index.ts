// Empty House System - Main exports
export * from './EmptyHouseEngine';
export * from './color/SignColor';
export * from './utils/density';

// Behavior exports
export { classical } from './behaviors/classical';
export { jazz } from './behaviors/jazz';
export { electronic } from './behaviors/electronic';
export { house } from './behaviors/house';
export { lofi } from './behaviors/lofi';
export { ambient } from './behaviors/ambient';

// Re-export main function for convenience
export { renderEmptyHouse as renderEmpty } from './EmptyHouseEngine';
