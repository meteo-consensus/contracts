const MS_PER_HOUR = 3_600_000;

/**
 * Signed duration in hours from `from` to `to`, two instants already validated by
 * `UtcInstantSchema` (UTC, so no daylight saving shift can bend the count).
 */
export function hoursBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / MS_PER_HOUR;
}
