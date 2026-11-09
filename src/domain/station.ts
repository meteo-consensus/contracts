import { z } from "zod";
import { UtcInstantSchema } from "./forecast-model.ts";
import { ElevationMSchema, LatitudeSchema, LongitudeSchema } from "./geo.ts";
import { hoursBetween } from "./instants.ts";

/**
 * Météo-France station number (`NUM_POSTE` in BDClim): exactly 8 digits, kept as a string so
 * the leading zero of departments `01` to `09` is never lost.
 */
export const NumPosteSchema = z.string().regex(/^\d{8}$/);

export type NumPoste = z.infer<typeof NumPosteSchema>;

/** Network that operates the station. Adding a network is a minor release. */
export const StationNetworkSchema = z.enum(["meteo_france"]);

export type StationNetwork = z.infer<typeof StationNetworkSchema>;

/**
 * One version of a station. A change of any attribute closes the current version
 * (`validTo`) and opens a new one; `validTo: null` marks the current version. The period is
 * `[validFrom, validTo[`.
 */
export const StationSchema = z
  .strictObject({
    numPoste: NumPosteSchema,
    name: z.string().min(1),
    latitude: LatitudeSchema,
    longitude: LongitudeSchema,
    /** Elevation of the shelter, or of the rain gauge when there is no shelter (`ALTI`). */
    elevationM: ElevationMSchema,
    network: StationNetworkSchema,
    validFrom: UtcInstantSchema,
    validTo: UtcInstantSchema.nullable(),
  })
  .superRefine((station, ctx) => {
    if (station.validTo !== null && hoursBetween(station.validFrom, station.validTo) <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "validTo must be after validFrom",
      });
    }
  });

export type Station = z.infer<typeof StationSchema>;
