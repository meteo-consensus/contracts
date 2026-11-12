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
 * Upper bound of a station name, in UTF-16 code units. The maximum length of BDClim
 * `NOM_USUEL` is not documented in the sources read so far (« à vérifier »), so this is a
 * generous bound that keeps a stored and served value small, not an upstream fact.
 */
export const STATION_NAME_MAX_LENGTH = 100;

/**
 * Station name (`NOM_USUEL`), stored and then served by `api` and `web`: 1 to
 * {@link STATION_NAME_MAX_LENGTH} characters, well-formed UTF-16 (no lone surrogate, which
 * node-postgres would silently store as U+FFFD), no leading or trailing whitespace, and none of:
 * control (`Cc`), format (`Cf`: bidirectional controls, zero-width characters), line or paragraph
 * separator (`Zl`, `Zp`), private-use (`Co`) or unassigned (`Cn`) characters, nor U+FFFD, the
 * trace of a failed decoding. The value is validated as is, never trimmed: cleaning is the
 * caller's job.
 */
const StationNameSchema = z
  .string()
  .min(1)
  .max(STATION_NAME_MAX_LENGTH)
  .refine((name) => name.isWellFormed(), "name must be well-formed UTF-16 (no lone surrogate)")
  .regex(
    /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cn}\u{FFFD}]*$/u,
    "name must not contain control, format, line or paragraph separator, private-use, unassigned or replacement characters",
  )
  .regex(/^(?!\s)[\s\S]*(?<!\s)$/, "name must not start or end with whitespace");

/**
 * One version of a station. A change of any attribute closes the current version
 * (`validTo`) and opens a new one; `validTo: null` marks the current version. The period is
 * `[validFrom, validTo[`.
 */
export const StationSchema = z
  .strictObject({
    numPoste: NumPosteSchema,
    name: StationNameSchema,
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
