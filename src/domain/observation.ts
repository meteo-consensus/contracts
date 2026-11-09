import { z } from "zod";
import { UtcInstantSchema } from "./forecast-model.ts";
import { NumPosteSchema } from "./station.ts";
import { checkPeriodOrder, checkValueBounds } from "./value-checks.ts";

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
 * Fields shared by every observation. The period is in UTC, `periodStart` ≤ `periodEnd`; an
 * instant observation has `periodStart` = `periodEnd`. `value` is in the variable's canonical
 * unit, within its bounds, `null` when missing (never 0).
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
  variable: z.enum(["temperature_2m", "relative_humidity_2m", "precipitation", "pressure_msl"]),
});

/**
 * `periodUnverified`: the position of the 10-minute window of BDClim `FF` and `DD` in the hour
 * is established empirically only for some stations (BDC-7, factory#22). `true` while it is not
 * verified for this observation; scores read it observation by observation.
 */
const windObservation = z.strictObject({
  ...observationBase,
  variable: z.enum(["wind_speed_10m", "wind_direction_10m"]),
  periodUnverified: z.boolean(),
});

/**
 * `skyObscured`: BDClim `N=9` (sky invisible because of fog or another phenomenon). It is not
 * 100 %: the value is `null` and the flag is `true`.
 */
const cloudObservation = z.strictObject({
  ...observationBase,
  variable: z.literal("cloud_cover"),
  skyObscured: z.boolean(),
});

/** `fxi3sComputed`: `STATUS_FXI3S` = 1, the FXI3S value was computed by a transfer function. */
const gustObservation = z.discriminatedUnion("gustSource", [
  z.strictObject({
    ...observationBase,
    variable: z.literal("wind_gusts_10m"),
    gustSource: z.literal("FXI3S"),
    fxi3sComputed: z.boolean(),
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
    windObservation,
    cloudObservation,
    gustObservation,
  ])
  .superRefine((observation, ctx) => {
    checkValueBounds(ctx, observation.variable, observation.value, ["value"]);
    checkPeriodOrder(ctx, observation);
    if (
      observation.variable === "cloud_cover" &&
      observation.skyObscured &&
      observation.value !== null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "an obscured sky has no cloud cover value",
      });
    }
  });

export type Observation = z.infer<typeof ObservationSchema>;
