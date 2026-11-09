import { z } from "zod";
import { UtcInstantSchema } from "./forecast-model.ts";
import { NumPosteSchema } from "./station.ts";
import { checkPeriodLength, checkValueBounds } from "./value-checks.ts";
import type { VariableId } from "./variables.ts";

/**
 * BDClim quality code `Q<param>`: `0` protected, `1` validated, `2` doubtful, `9` filtered only
 * (factory `docs/sources.md`). `null` is an empty Q in the source file, whether the value is
 * filled or empty. Any other code is rejected.
 */
export const QualityCodeSchema = z.literal([0, 1, 2, 9]).nullable();

export type QualityCode = z.infer<typeof QualityCodeSchema>;

/**
 * Source of a `wind_gusts_10m` observation: `FXI3S` (maximum of the 3-second mean in the hour)
 * or `FXI` (maximum instantaneous wind in the hour). Both are stored; `scoring` picks one.
 */
export const GustSourceSchema = z.enum(["FXI3S", "FXI"]);

export type GustSource = z.infer<typeof GustSourceSchema>;

/**
 * Exact length of an observation period, in minutes, per variable: `0` for an instant
 * (`periodStart` = `periodEnd`), 10 for the BDClim `FF` and `DD` window
 * [HH h − 10 min ; HH h], 60 for the hour ]HH − 1 h ; HH h] of `RR1`, `FXI` and `FXI3S`.
 */
export const observationPeriodMinutes: { readonly [K in VariableId]: number } = Object.freeze({
  temperature_2m: 0,
  relative_humidity_2m: 0,
  pressure_msl: 0,
  cloud_cover: 0,
  wind_speed_10m: 10,
  wind_direction_10m: 10,
  precipitation: 60,
  wind_gusts_10m: 60,
});

/**
 * Fields shared by every observation. The period is in UTC, `]periodStart, periodEnd]`, and lasts
 * exactly `observationPeriodMinutes[variable]`. `value` is in the variable's canonical unit
 * (m/s for wind, as BDClim reports it), within its bounds, `null` when missing (never 0).
 */
const observationBase = {
  numPoste: NumPosteSchema,
  periodStart: UtcInstantSchema,
  periodEnd: UtcInstantSchema,
  value: z.number().nullable(),
  quality: QualityCodeSchema,
};

const plainObservation = z.strictObject({
  ...observationBase,
  variable: z.enum(["temperature_2m", "relative_humidity_2m", "pressure_msl"]),
});

/**
 * `periodUnverified`: the period of the source field is not verified for this observation.
 * Wind speed and direction: the position of the 10-minute window of BDClim `FF` and `DD` in the
 * hour is established empirically only for some stations (BDC-7, factory#22). Precipitation:
 * `RR1` is assumed to cover the hour ending at `HH` (BDC-6, factory#16, open). When the flag is
 * `true`, `periodStart` still carries the assumed window; only the flag marks the doubt, and
 * scores read it observation by observation.
 */
const periodFlaggedObservation = z.strictObject({
  ...observationBase,
  variable: z.enum(["precipitation", "wind_speed_10m", "wind_direction_10m"]),
  periodUnverified: z.boolean(),
});

/**
 * `skyObscured`: BDClim `N=9`, stored as `value: null` with the flag `true`, never as 100 %. The
 * `N` field is not yet described in factory `docs/sources.md`: the octas to % conversion
 * (× 12.5) and the meaning of `N=9` (sky invisible because of fog or another phenomenon) are
 * « à vérifier » there.
 */
const cloudObservation = z.strictObject({
  ...observationBase,
  variable: z.literal("cloud_cover"),
  skyObscured: z.boolean(),
});

/**
 * `fxi3sComputed`: from `STATUS_FXI3S`, `true` when the FXI3S value was computed by a transfer
 * function. `null` exactly when the value is missing: an empty value has no status.
 */
const gustObservation = z.discriminatedUnion("gustSource", [
  z.strictObject({
    ...observationBase,
    variable: z.literal("wind_gusts_10m"),
    gustSource: z.literal("FXI3S"),
    fxi3sComputed: z.boolean().nullable(),
  }),
  z.strictObject({
    ...observationBase,
    variable: z.literal("wind_gusts_10m"),
    gustSource: z.literal("FXI"),
  }),
]);

/** One station observation of one variable over one period. */
export const ObservationSchema = z
  .discriminatedUnion("variable", [
    plainObservation,
    periodFlaggedObservation,
    cloudObservation,
    gustObservation,
  ])
  .superRefine((observation, ctx) => {
    checkValueBounds(ctx, observation.variable, observation.value, ["value"]);
    checkPeriodLength(ctx, observation, observationPeriodMinutes[observation.variable]);
    checkFlagsAgainstValue(ctx, observation);
  });

export type Observation = z.infer<typeof ObservationSchema>;

function checkFlagsAgainstValue(ctx: z.RefinementCtx, observation: Observation): void {
  const missing = observation.value === null;
  if (observation.variable === "cloud_cover" && observation.skyObscured && !missing) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: "an obscured sky has no cloud cover value",
    });
  }
  if ("fxi3sComputed" in observation && (observation.fxi3sComputed === null) !== missing) {
    ctx.addIssue({
      code: "custom",
      path: ["fxi3sComputed"],
      message: "fxi3sComputed is null exactly when the value is missing",
    });
  }
}
