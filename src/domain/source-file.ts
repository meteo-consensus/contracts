import { z } from "zod";
import { UtcInstantSchema } from "./forecast-model.ts";
import { hoursBetween } from "./instants.ts";
import { isBareHttpsUrl } from "./urls.ts";

/** Observation dataset a source file belongs to. Adding a source is a minor release. */
export const ObservationSourceSchema = z.enum(["bdclim_hourly"]);

export type ObservationSource = z.infer<typeof ObservationSourceSchema>;

/**
 * Key of a BDClim hourly file: the metropolitan department on 2 digits, `01` to `95`
 * (`<dep>` in `H_<dep>_latest-<AAAA-1>-<AAAA>.csv.gz`). Corsica is the single file `20`
 * (`H_2A_…` returns 404, factory `docs/sources.md`, 09/11/2026); overseas keys (3 digits) and
 * `99` are out of the metropolitan scope.
 */
export const SourceFileKeySchema = z.string().regex(/^(0[1-9]|[1-8]\d|9[0-5])$/);

export type SourceFileKey = z.infer<typeof SourceFileKeySchema>;

/**
 * One downloaded observation source file and its last update date, which the Licence Ouverte
 * 2.0 requires next to the source wherever the data is reused. `lastModified` is the
 * `Last-Modified` header of the downloaded file (the data.gouv `last_modified` metadata lags it
 * by up to 3 days), converted to UTC. It is the upstream clock, so it is not compared with
 * `fetchedAt`, our clock. `etag` is the raw `ETag` header, `null` when the response has none.
 * `ingestedAt` is `null` until the file's rows are stored, and never before `fetchedAt`.
 */
export const SourceFileSchema = z
  .strictObject({
    source: ObservationSourceSchema,
    fileKey: SourceFileKeySchema,
    url: z
      .string()
      .max(2048)
      .refine(isBareHttpsUrl, "url must be an https URL with no credentials, query or fragment"),
    lastModified: UtcInstantSchema,
    etag: z.string().min(1).max(1024).nullable(),
    fetchedAt: UtcInstantSchema,
    ingestedAt: UtcInstantSchema.nullable(),
  })
  .superRefine((file, ctx) => {
    if (file.ingestedAt !== null && hoursBetween(file.fetchedAt, file.ingestedAt) < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["ingestedAt"],
        message: "ingestedAt is before fetchedAt",
      });
    }
  });

export type SourceFile = z.infer<typeof SourceFileSchema>;
