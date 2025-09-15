export type Degree = number;

export const norm = (d:Degree):Degree => ((d % 360) + 360) % 360;
export const delta = (a:Degree,b:Degree):Degree => {
  const d = norm(a - b);
  return d > 180 ? 360 - d : d;
};
export const between = (x:Degree, a:Degree, b:Degree):boolean => {
  const X = norm(x), A = norm(a), B = norm(b);
  return A <= B ? (X >= A && X <= B) : (X >= A || X <= B);
};
