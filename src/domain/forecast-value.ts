import { z } from "zod";
import { ForecastModelIdSchema, UtcInstantSchema } from "./forecast-model.ts";
import { hoursBetween } from "./instants.ts";
import { MAX_LEAD_TIME_H } from "./lead-time-bands.ts";
import { NumPosteSchema } from "./station.ts";
import { checkValueBounds } from "./value-checks.ts";

/** Variables whose catalogue semantics is `instant`: no period. */
export const instantForecastVariables = Object.freeze([
  "temperature_2m",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "cloud_cover",
  "pressure_msl",
] as const);

/** Variables that cover a period ending at `validTime` (`sum_preceding_1h`, `max_preceding_1h`). */
export const periodForecastVariables = Object.freeze(["precipitation", "wind_gusts_10m"] as const);

/**
 * Fields shared by every forecast value. The point is identified by (`model`, `initTime`,
 * `numPoste`). `leadTimeH` = `validTime` − `initTime` in whole hours, from 0 to the 72 h cap.
 * `value` is in the canonical unit, within bounds, `null` when missing (never 0).
 * `interpolated` is true when the value is not on a native step of the model.
 */
const valueBase = {
  model: ForecastModelIdSchema,
  initTime: UtcInstantSchema,
  numPoste: NumPosteSchema,
  validTime: UtcInstantSchema,
  leadTimeH: z.int().min(0).max(MAX_LEAD_TIME_H),
  value: z.number().nullable(),
  interpolated: z.boolean(),
};

/**
 * One forecast value. A period variable carries its period: `periodEnd` = `validTime`, and
 * `periodStart` the start of the model's window (3 h for an ECMWF IFS gust), or `null` when
 * that window is unknown (`gustWindowOf` returns `null`), never a guessed 1 h.
 */
export const ForecastValueSchema = z
  .discriminatedUnion("variable", [
    z.strictObject({ ...valueBase, variable: z.enum(instantForecastVariables) }),
    z.strictObject({
      ...valueBase,
      variable: z.enum(periodForecastVariables),
      periodStart: UtcInstantSchema.nullable(),
      periodEnd: UtcInstantSchema,
    }),
  ])
  .superRefine((forecast, ctx) => {
    checkValueBounds(ctx, forecast.variable, forecast.value, ["value"]);
    if (hoursBetween(forecast.initTime, forecast.validTime) !== forecast.leadTimeH) {
      ctx.addIssue({
        code: "custom",
        path: ["leadTimeH"],
        message: "leadTimeH must equal validTime - initTime",
      });
    }
    if ("periodEnd" in forecast) {
      checkForecastPeriod(ctx, forecast);
    }
  });

function checkForecastPeriod(
  ctx: z.RefinementCtx,
  forecast: { validTime: string; periodStart: string | null; periodEnd: string },
): void {
  if (forecast.periodEnd !== forecast.validTime) {
    ctx.addIssue({
      code: "custom",
      path: ["periodEnd"],
      message: "periodEnd must equal validTime",
    });
  }
  if (
    forecast.periodStart !== null &&
    hoursBetween(forecast.periodStart, forecast.periodEnd) <= 0
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["periodStart"],
      message: "periodStart must be before periodEnd",
    });
  }
}

export type ForecastValue = z.infer<typeof ForecastValueSchema>;
