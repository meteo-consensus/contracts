import { z } from "zod";

/**
 * Ids of the collected variables. Names follow the Open-Meteo forecast API
 * (https://open-meteo.com/en/docs, checked 09/11/2026). Ids are part of the public
 * contract: never rename one, add a new id instead.
 */
export const variableIds = Object.freeze([
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "cloud_cover",
  "pressure_msl",
] as const);

export type VariableId = (typeof variableIds)[number];

export const VariableIdSchema = z.enum(variableIds);

/** What a timestamped value covers: the instant itself or the period preceding it. */
export const TemporalSemanticsSchema = z.enum([
  "instant",
  "sum_preceding_1h",
  "max_preceding_1h",
  "mean_preceding_10min",
]);

export type TemporalSemantics = z.infer<typeof TemporalSemanticsSchema>;

/** Canonical units: every value stored or served is in its variable's unit. */
export type CanonicalUnit = "°C" | "%" | "mm" | "m/s" | "°" | "hPa";

export interface VariableDefinition {
  readonly id: VariableId;
  readonly unit: CanonicalUnit;
  /** Height above ground in metres; `null` when no height applies (sea level, whole column). */
  readonly heightM: number | null;
  /** Closed interval of physically plausible values, in the canonical unit. */
  readonly bounds: { readonly min: number; readonly max: number };
  readonly temporal: TemporalSemantics;
}

function define(definition: VariableDefinition): VariableDefinition {
  return Object.freeze({ ...definition, bounds: Object.freeze({ ...definition.bounds }) });
}

/**
 * Bounds marked "plausibility" are deliberately wider than the observed world extremes:
 * they reject corrupt values (unit mix-ups, sentinels), not rare weather.
 */
export const variableCatalogue: Readonly<Record<VariableId, VariableDefinition>> = Object.freeze({
  temperature_2m: define({
    id: "temperature_2m",
    unit: "°C",
    heightM: 2,
    bounds: { min: -100, max: 70 }, // plausibility
    temporal: "instant",
  }),
  relative_humidity_2m: define({
    id: "relative_humidity_2m",
    unit: "%",
    heightM: 2,
    bounds: { min: 0, max: 100 },
    temporal: "instant",
  }),
  precipitation: define({
    id: "precipitation",
    unit: "mm",
    heightM: 0,
    bounds: { min: 0, max: 500 }, // plausibility, per hour
    temporal: "sum_preceding_1h",
  }),
  wind_speed_10m: define({
    id: "wind_speed_10m",
    unit: "m/s",
    heightM: 10,
    bounds: { min: 0, max: 150 }, // plausibility
    temporal: "instant",
  }),
  wind_direction_10m: define({
    id: "wind_direction_10m",
    unit: "°",
    heightM: 10,
    bounds: { min: 0, max: 360 },
    temporal: "instant",
  }),
  wind_gusts_10m: define({
    id: "wind_gusts_10m",
    unit: "m/s",
    heightM: 10,
    bounds: { min: 0, max: 150 }, // plausibility
    temporal: "max_preceding_1h",
  }),
  cloud_cover: define({
    id: "cloud_cover",
    unit: "%",
    heightM: null,
    bounds: { min: 0, max: 100 },
    temporal: "instant",
  }),
  pressure_msl: define({
    id: "pressure_msl",
    unit: "hPa",
    heightM: null,
    bounds: { min: 800, max: 1100 }, // plausibility
    temporal: "instant",
  }),
});

/** Schema of one value of `id`: a finite number within its bounds, or `null` when missing (never 0). */
export function variableValueSchema(id: VariableId): z.ZodNullable<z.ZodNumber> {
  const { min, max } = variableCatalogue[id].bounds;
  return z.number().min(min).max(max).nullable();
}
