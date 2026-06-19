export function equalHouseCuspsFromAscendant(ascLonDeg: number): number[] {
  const asc = ((ascLonDeg % 360) + 360) % 360;
  return Array.from({ length: 12 }, (_, i) => (asc + i * 30) % 360);
}
