import { z } from "zod";

/** Collected horizon cap, in hours (décision du propriétaire du 09/11/2026). */
export const MAX_LEAD_TIME_H = 72;

/**
 * Fixed lead time bands used to aggregate scores: `[0, 6]`, then `]6, 12]`, `]12, 24]`,
 * `]24, 36]`, `]36, 48]` and `]48, 72]` hours. Only the first band is closed on the left.
 */
export const leadTimeBandIds = Object.freeze([
  "0-6",
  "6-12",
  "12-24",
  "24-36",
  "36-48",
  "48-72",
] as const);

export type LeadTimeBand = (typeof leadTimeBandIds)[number];

export const LeadTimeBandSchema = z.enum(leadTimeBandIds);

/** Inclusive upper bound of each band, in the order of `leadTimeBandIds`. */
const upperBoundsH = [6, 12, 24, 36, 48, MAX_LEAD_TIME_H] as const;

export interface LeadTimeOutOfRange {
  readonly code: "lead_time_out_of_range";
  readonly leadTimeH: number;
}

export type LeadTimeBandResult =
  | { readonly ok: true; readonly band: LeadTimeBand }
  | { readonly ok: false; readonly error: LeadTimeOutOfRange };

/** Band of a lead time in hours; a negative, non-finite or over-72 h lead is a typed error. */
export function leadTimeBandOf(leadTimeH: number): LeadTimeBandResult {
  if (leadTimeH >= 0) {
    const index = upperBoundsH.findIndex((upper) => leadTimeH <= upper);
    const band = leadTimeBandIds[index];
    if (band !== undefined) {
      return { ok: true, band };
    }
  }
  return { ok: false, error: { code: "lead_time_out_of_range", leadTimeH } };
}
