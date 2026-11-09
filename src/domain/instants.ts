const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

/**
 * Signed duration in hours from `from` to `to`, two instants already validated by
 * `UtcInstantSchema` (UTC, so no daylight saving shift can bend the count).
 */
export function hoursBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / MS_PER_HOUR;
}

/** Signed duration in minutes from `from` to `to`; whole minutes compare exactly. */
export function minutesBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / MS_PER_MINUTE;
}
