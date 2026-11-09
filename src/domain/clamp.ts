/** Restricts a value to the closed interval [min, max]. Placeholder proving the toolchain; replace with real domain code. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) throw new RangeError(`clamp: min ${min} is greater than max ${max}`);
  return Math.min(Math.max(value, min), max);
}
