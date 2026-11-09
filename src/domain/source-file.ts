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

/** File name prefix each source gives the file of a key (`H_33_` for BDClim key `33`). */
const fileNamePrefix: Readonly<Record<ObservationSource, (key: SourceFileKey) => string>> = {
  bdclim_hourly: (key) => `H_${key}_`,
};

/** Last path segment of a URL, `""` when it does not parse (the `url` check reports that). */
function fileNameOf(url: string): string {
  const pathname = URL.parse(url)?.pathname ?? "";
  return pathname.slice(pathname.lastIndexOf("/") + 1);
}

/**
 * RFC 9110 §8.8.3 entity tag: optional `W/`, then a quoted string of `%x21 / %x23-7E` (no
 * `obs-text`). The collector maps a non-conforming `ETag` header to `null` (and then fetches with
 * a plain GET) rather than rejecting the file.
 */
const EntityTagSchema = z
  .string()
  .max(1024)
  .regex(/^(W\/)?"[\x21\x23-\x7E]*"$/);

/**
 * One downloaded observation source file and its last update date, which the Licence Ouverte
 * 2.0 requires next to the source wherever the data is reused. `lastModified` is the
 * `Last-Modified` header of the downloaded file (the data.gouv `last_modified` metadata lags it
 * by up to 3 days), converted to UTC. It is the upstream clock, so it is not compared with
 * `fetchedAt`, our clock. `etag` is the `ETag` header as received, `null` when the response has
 * none or a non-conforming one. The file name of `url` must carry `fileKey` (`H_33_…` for `33`).
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
    etag: EntityTagSchema.nullable(),
    fetchedAt: UtcInstantSchema,
    ingestedAt: UtcInstantSchema.nullable(),
  })
  .superRefine((file, ctx) => {
    if (!fileNameOf(file.url).startsWith(fileNamePrefix[file.source](file.fileKey))) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "url does not name the file of fileKey",
      });
    }
    if (file.ingestedAt !== null && hoursBetween(file.fetchedAt, file.ingestedAt) < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["ingestedAt"],
        message: "ingestedAt is before fetchedAt",
      });
    }
  });

export type SourceFile = z.infer<typeof SourceFileSchema>;
