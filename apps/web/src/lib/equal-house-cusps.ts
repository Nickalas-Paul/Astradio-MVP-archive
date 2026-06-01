/**
 * Equal-house cusp longitudes (ecliptic degrees) from an Ascendant longitude.
 * House 1 cusp = ASC; each subsequent cusp +30°.
 */
export function equalHouseCuspsFromAscendant(ascLonDeg: number): number[] {
  const asc = ((ascLonDeg % 360) + 360) % 360;
  return Array.from({ length: 12 }, (_, i) => (asc + i * 30) % 360);
}
