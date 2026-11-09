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

/**
 * What a timestamped value covers: the instant itself or the period ending at it.
 * `mean_preceding_10min` is for observations (station wind is a 10-minute mean).
 */
export const TemporalSemanticsSchema = z.enum([
  "instant",
  "sum_preceding_1h",
  "max_preceding_1h",
  "mean_preceding_10min",
]);

export type TemporalSemantics = z.infer<typeof TemporalSemanticsSchema>;

/** Canonical units: every value stored or served is in its variable's unit. */
export type CanonicalUnit = "°C" | "%" | "mm" | "m/s" | "°" | "hPa";

export interface VariableDefinition<Id extends VariableId = VariableId> {
  readonly id: Id;
  readonly unit: CanonicalUnit;
  /**
   * Height above ground in metres. `0` means the surface (`precipitation`). `null` means no
   * height above ground applies, for one of two reasons: the value is reduced to mean sea
   * level (`pressure_msl`), or it describes the whole atmospheric column (`cloud_cover`).
   */
  readonly heightM: number | null;
  /** Closed interval of physically plausible values, in the canonical unit. */
  readonly bounds: { readonly min: number; readonly max: number };
  /**
   * Semantics of the canonical forecast value at a timestamp. Observations carry their own
   * semantics in the observation schema, which is why `TemporalSemantics` also lists
   * `mean_preceding_10min`: station wind speed is reported as a 10-minute mean, while no
   * forecast variable here uses it.
   */
  readonly temporal: TemporalSemantics;
}

export type VariableCatalogue = { readonly [K in VariableId]: VariableDefinition<K> };

function define<Id extends VariableId>(definition: VariableDefinition<Id>): VariableDefinition<Id> {
  return Object.freeze({ ...definition, bounds: Object.freeze({ ...definition.bounds }) });
}

/**
 * Bounds marked "plausibility" are deliberately wider than the observed world extremes:
 * they reject corrupt values (unit mix-ups, sentinels), not rare weather.
 */
export const variableCatalogue: VariableCatalogue = Object.freeze({
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
  /**
   * Meteorological convention: the direction the wind comes from, in degrees clockwise from
   * north. `360` means north and `0` means calm (no direction), so consumers exclude `0` from
   * direction errors.
   */
  wind_direction_10m: define({
    id: "wind_direction_10m",
    unit: "°",
    heightM: 10,
    bounds: { min: 0, max: 360 },
    temporal: "instant",
  }),
  /**
   * `max_preceding_1h` is the default window. A forecast model's `gustWindowHours` overrides it
   * (3 h for ECMWF IFS): see the forecast model catalogue.
   */
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
