import { z } from "zod";
import { ForecastModelIdSchema, UtcInstantSchema } from "./forecast-model.ts";
import { forecastModelCatalogue } from "./forecast-model-catalogue.ts";
import { gustWindowOf } from "./forecast-model-queries.ts";
import { hoursBetween, minutesBetween } from "./instants.ts";
import { MAX_LEAD_TIME_H } from "./lead-time-bands.ts";
import { NumPosteSchema } from "./station.ts";
import { checkPeriodLength, checkValueBounds } from "./value-checks.ts";

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
 * `value` is in the canonical unit, within bounds, `null` when missing (never 0). Wind speed
 * and gusts are in m/s: Open-Meteo defaults to km/h, so the collector requests
 * `wind_speed_unit=ms` or converts before validating.
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
 * Window of a period value in minutes, from the catalogues: 60 for `precipitation`
 * (`sum_preceding_1h`), the model's `gustWindowOf` for `wind_gusts_10m` (3 h for ECMWF IFS), or
 * `null` when that window is unknown.
 */
function windowMinutes(forecast: PeriodForecast): number | null {
  if (forecast.variable === "precipitation") {
    return 60;
  }
  const hours = gustWindowOf(forecastModelCatalogue[forecast.model]);
  return hours === null ? null : hours * 60;
}

const precipitationValue = z.strictObject({
  ...valueBase,
  variable: z.literal("precipitation"),
  periodStart: UtcInstantSchema,
  periodEnd: UtcInstantSchema,
});

const gustValue = z.strictObject({
  ...valueBase,
  variable: z.literal("wind_gusts_10m"),
  periodStart: UtcInstantSchema.nullable(),
  periodEnd: UtcInstantSchema,
});

type PeriodForecast = z.infer<typeof precipitationValue> | z.infer<typeof gustValue>;

/**
 * One forecast value. A period variable carries its period `]periodStart, periodEnd]`:
 * `periodEnd` = `validTime` and `periodStart` = `validTime` minus the window of
 * `windowMinutes` (1 h for precipitation, `gustWindowOf(model)` for gusts). A gust may have
 * `periodStart: null`, for any model: the window is not stored, and scoring never pairs that row.
 * A non-null gust start requires a known window and matches it, never a guessed 1 h. Allowing
 * `null` for every model keeps stored rows parseable when a catalogue window becomes known
 * later. A period that starts before
 * `initTime` is rejected (décision du propriétaire du 09/11/2026): the consumer drops such values
 * (precipitation at lead 0, an early gust window) before validating.
 */
export const ForecastValueSchema = z
  .discriminatedUnion("variable", [
    z.strictObject({ ...valueBase, variable: z.enum(instantForecastVariables) }),
    precipitationValue,
    gustValue,
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

export type ForecastValue = z.infer<typeof ForecastValueSchema>;

function checkForecastPeriod(ctx: z.RefinementCtx, forecast: PeriodForecast): void {
  if (forecast.periodEnd !== forecast.validTime) {
    ctx.addIssue({
      code: "custom",
      path: ["periodEnd"],
      message: "periodEnd must equal validTime",
    });
  }
  const minutes = windowMinutes(forecast);
  const { periodStart, periodEnd } = forecast;
  if (periodStart === null) {
    return;
  }
  if (minutes === null) {
    ctx.addIssue({
      code: "custom",
      path: ["periodStart"],
      message: "periodStart must be null when the model's window is unknown",
    });
    return;
  }
  checkPeriodLength(ctx, { periodStart, periodEnd }, minutes);
  if (minutesBetween(forecast.initTime, periodStart) < 0) {
    ctx.addIssue({
      code: "custom",
      path: ["periodStart"],
      message: "periodStart is before initTime",
    });
  }
}
