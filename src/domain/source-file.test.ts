import { describe, expect, it } from "vitest";
import { ObservationSourceSchema, SourceFileKeySchema, SourceFileSchema } from "./source-file.ts";

// Times and ETag are synthetic; the URL follows the BDClim file naming in the factory's
// docs/sources.md (H_<dep>_latest-<AAAA-1>-<AAAA>.csv.gz, read 09/11/2026).
const sourceFile = {
  source: "bdclim_hourly",
  fileKey: "33",
  url: "https://meteofrance.s3.sbg.io.cloud.ovh.net/data/synchro_ftp/BASE/HOR/H_33_latest-2025-2026.csv.gz",
  lastModified: "2026-11-09T06:44:51Z",
  etag: '"0123456789abcdef"',
  fetchedAt: "2026-11-09T11:30:00Z",
  ingestedAt: "2026-11-09T11:32:10Z",
};

const accepted = (input: unknown) => SourceFileSchema.safeParse(input).success;

describe("ObservationSourceSchema", () => {
  it("lists the observation sources", () => {
    expect(ObservationSourceSchema.options).toEqual(["bdclim_hourly"]);
  });
});

describe("SourceFileKeySchema", () => {
  it.each(["01", "09", "10", "20", "33", "90", "95"])(
    "accepts the metropolitan department %s",
    (key) => {
      expect(SourceFileKeySchema.parse(key)).toBe(key);
    },
  );

  it.each(["00", "1", "96", "99", "2A", "2B", "971", "033", " 33", "", 33])("rejects %j", (key) => {
    expect(SourceFileKeySchema.safeParse(key).success).toBe(false);
  });
});

describe("SourceFileSchema", () => {
  it("accepts an ingested file", () => {
    expect(SourceFileSchema.parse(sourceFile)).toEqual(sourceFile);
  });

  it("accepts a file with no ETag, not ingested yet", () => {
    const pending = { ...sourceFile, etag: null, ingestedAt: null };
    expect(SourceFileSchema.parse(pending)).toEqual(pending);
  });

  it("accepts a fetch time before the Last-Modified time (upstream clock)", () => {
    const skewed = { ...sourceFile, lastModified: "2026-11-09T11:30:05Z" };
    expect(accepted(skewed)).toBe(true);
  });

  it("accepts an ingestion at the fetch time", () => {
    expect(accepted({ ...sourceFile, ingestedAt: sourceFile.fetchedAt })).toBe(true);
  });

  it.each([
    ["an unknown source", { source: "bdclim_daily" }],
    ["a 3-digit file key", { fileKey: "971" }],
    ["the Corsica key 2A", { fileKey: "2A" }],
    ["the key 99", { fileKey: "99" }],
    ["a non-UTC Last-Modified", { lastModified: "2026-11-09T07:44:51+01:00" }],
    ["a local fetch time", { fetchedAt: "2026-11-09T11:30:00" }],
    ["a fractional ingestion time", { ingestedAt: "2026-11-09T11:32:10.500Z" }],
    ["a Last-Modified in HTTP date format", { lastModified: "Mon, 09 Nov 2026 06:44:51 GMT" }],
    ["an empty ETag", { etag: "" }],
    ["an ETag over 1024 characters", { etag: "a".repeat(1025) }],
    ["an ingestion before the fetch", { ingestedAt: "2026-11-09T11:29:59Z" }],
    ["a missing ETag field", { etag: undefined }],
    ["an unknown field", { size: 12_041_520 }],
  ])("rejects %s", (_name, patch) => {
    expect(accepted({ ...sourceFile, ...patch })).toBe(false);
  });

  it.each([
    "http://meteofrance.s3.sbg.io.cloud.ovh.net/data/synchro_ftp/BASE/HOR/H_33_latest-2025-2026.csv.gz",
    "https://meteofrance.s3.sbg.io.cloud.ovh.net/H_33.csv.gz?X-Amz-Signature=secret",
    "https://user:pass@meteofrance.s3.sbg.io.cloud.ovh.net/H_33.csv.gz",
    "meteofrance.s3.sbg.io.cloud.ovh.net/H_33.csv.gz",
    `https://meteofrance.s3.sbg.io.cloud.ovh.net/${"a".repeat(2048)}`,
  ])("rejects the URL %j: a bare https URL only", (url) => {
    expect(accepted({ ...sourceFile, url })).toBe(false);
  });
});
