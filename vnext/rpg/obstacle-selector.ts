import { OBSTACLE_POOLS, type ObstacleEntry } from './obstacle-pools';

export function selectObstacle(house: number, calendarDate: string, campaignId: string): ObstacleEntry {
  const pool = OBSTACLE_POOLS[house] ?? OBSTACLE_POOLS[1]!;
  const seed = calendarDate + campaignId;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % pool.length;
  return pool[index]!;
}
