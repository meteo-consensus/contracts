import { z } from "zod";
import { ForecastModelIdSchema, UtcInstantSchema } from "./forecast-model.ts";
import { ElevationMSchema, LatitudeSchema, LongitudeSchema } from "./geo.ts";
import { hoursBetween } from "./instants.ts";
import { NumPosteSchema } from "./station.ts";
import { isBareHttpsUrl } from "./urls.ts";

/**
 * Endpoint that served the run (`https://api.open-meteo.com/v1/forecast`). Bare URL only: a
 * query string could carry an API key, so it is rejected rather than stored.
 */
export const SourceApiSchema = z
  .string()
  .max(2048)
  .refine(isBareHttpsUrl, "sourceApi must be an https URL with no credentials, query or fragment");

/**
 * One fetched run of a model. Times are UTC. `modificationTime` and `availabilityTime` are
 * Open-Meteo's `last_run_modification_time` (« the time when the data download and conversion
 * were completed ») and `last_run_availability_time` (« the time when the data is actually
 * accessible on the API server »), https://open-meteo.com/en/docs/model-updates, read
 * 09/11/2026. Both describe work on the run, so neither may precede `initTime`; the order
 * between them is not stated there (« à vérifier ») and is not enforced. `fetchedAt` is our
 * clock and may not precede `initTime` either.
 */
export const ForecastRunSchema = z
  .strictObject({
    model: ForecastModelIdSchema,
    initTime: UtcInstantSchema,
    modificationTime: UtcInstantSchema,
    availabilityTime: UtcInstantSchema,
    fetchedAt: UtcInstantSchema,
    sourceApi: SourceApiSchema,
  })
  .superRefine((run, ctx) => {
    for (const key of ["modificationTime", "availabilityTime", "fetchedAt"] as const) {
      if (hoursBetween(run.initTime, run[key]) < 0) {
        ctx.addIssue({ code: "custom", path: [key], message: `${key} is before initTime` });
      }
    }
  });

export type ForecastRun = z.infer<typeof ForecastRunSchema>;

/**
 * Open-Meteo `cell_selection` values (https://open-meteo.com/en/docs, read 09/11/2026): `land`
 * (default, a land cell of similar elevation), `sea`, `nearest`.
 */
export const CellSelectionSchema = z.enum(["land", "sea", "nearest"]);

export type CellSelection = z.infer<typeof CellSelectionSchema>;

/**
 * Where a run was sampled for one station. The run is identified by (`model`, `initTime`).
 * `requested*` are the coordinates sent, `grid*` the cell the upstream answered with (its
 * `latitude`, `longitude` and `elevation`). `elevationParamM` is the `elevation=` sent and
 * `stationElevationM` the station elevation at request time: the owner decided (09/11/2026)
 * that they are equal, both are kept so a change of rule stays visible in the data.
 */
export const ForecastPointSchema = z.strictObject({
  model: ForecastModelIdSchema,
  initTime: UtcInstantSchema,
  numPoste: NumPosteSchema,
  requestedLatitude: LatitudeSchema,
  requestedLongitude: LongitudeSchema,
  gridLatitude: LatitudeSchema,
  gridLongitude: LongitudeSchema,
  gridElevationM: ElevationMSchema,
  elevationParamM: ElevationMSchema,
  cellSelection: CellSelectionSchema,
  stationElevationM: ElevationMSchema,
});

export type ForecastPoint = z.infer<typeof ForecastPointSchema>;
