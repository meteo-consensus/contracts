import { z } from "zod";

/** Latitude in decimal degrees (WGS 84). */
export const LatitudeSchema = z.number().min(-90).max(90);

/** Longitude in decimal degrees (WGS 84). */
export const LongitudeSchema = z.number().min(-180).max(180);

/**
 * Elevation in metres above sea level. Plausibility bounds, wider than the lowest and highest
 * land points on Earth: they catch unit mix-ups and sentinels, not real places.
 */
export const ElevationMSchema = z.number().min(-500).max(9000);
