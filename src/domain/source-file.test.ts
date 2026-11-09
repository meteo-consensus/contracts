import { describe, expect, it } from "vitest";
import { ObservationSourceSchema, SourceFileKeySchema, SourceFileSchema } from "./source-file.ts";

// Real values: S3 response headers of H_33_latest-2025-2026.csv.gz, 09/11/2026 16:05:36 UTC
// (Last-Modified, ETag, Date as fetchedAt, Content-Length 12 041 520 bytes). ingestedAt is our
// own clock, derived from fetchedAt (+2 min), not an upstream value.
const H33_URL =
  "https://meteofrance.s3.sbg.io.cloud.ovh.net/data/synchro_ftp/BASE/HOR/H_33_latest-2025-2026.csv.gz";
const H33_CONTENT_LENGTH = 12_041_520;
const sourceFile = {
  source: "bdclim_hourly",
  fileKey: "33",
  url: H33_URL,
  lastModified: "2026-11-09T06:44:51Z",
  etag: '"a88e9de5467e4fd71bfe705af5500b0e-2"',
  fetchedAt: "2026-11-09T16:05:36Z",
  ingestedAt: "2026-11-09T16:07:36Z",
};

/** The H_33 URL padded in its directory part to exactly `length` characters. */
function h33UrlOfLength(length: number): string {
  const prefix = "https://meteofrance.s3.sbg.io.cloud.ovh.net/";
  const file = "/H_33_latest-2025-2026.csv.gz";
  return `${prefix}${"a".repeat(length - prefix.length - file.length)}${file}`;
}

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
    // fetchedAt derived from the real lastModified minus 1 s, as a skewed upstream clock would give.
    const skewed = { ...sourceFile, fetchedAt: "2026-11-09T06:44:50Z", ingestedAt: null };
    expect(accepted(skewed)).toBe(true);
  });

  it.each([
    ["the real strong ETag", '"a88e9de5467e4fd71bfe705af5500b0e-2"'],
    ["a weak ETag", 'W/"x"'],
    ["an empty quoted ETag", '""'],
    ["an ETag of exactly 1024 characters", `"${"a".repeat(1022)}"`],
  ])("accepts %s", (_name, etag) => {
    expect(accepted({ ...sourceFile, etag })).toBe(true);
  });

  it("accepts a URL of exactly 2048 characters", () => {
    expect(accepted({ ...sourceFile, url: h33UrlOfLength(2048) })).toBe(true);
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
    ["a local fetch time", { fetchedAt: "2026-11-09T16:05:36" }],
    ["a fractional ingestion time", { ingestedAt: "2026-11-09T16:07:36.500Z" }],
    ["a Last-Modified in HTTP date format", { lastModified: "Mon, 09 Nov 2026 06:44:51 GMT" }],
    ["an empty ETag", { etag: "" }],
    ["an unquoted ETag", { etag: "a88e9de5467e4fd71bfe705af5500b0e-2" }],
    ["an ETag with an embedded quote", { etag: '"a88e9de5"467e"' }],
    ["an ETag with a space", { etag: '"a88e9de5 467e"' }],
    ["an ETag with a control character", { etag: '"a88e9de5467e"' }],
    ["an ETag with a lower-case weak prefix", { etag: 'w/"a88e9de5"' }],
    ["a URL of another department's file", { url: H33_URL.replace("H_33_", "H_13_") }],
    ["a URL whose file has no department key", { url: H33_URL.replace("H_33_", "H_") }],
    [
      "a key matching a directory, not the file",
      { url: H33_URL.replace("/HOR/H_33_", "/H_33_x/H_13_") },
    ],
    ["an ETag over 1024 characters", { etag: `"${"a".repeat(1023)}"` }],
    ["an ingestion before the fetch", { ingestedAt: "2026-11-09T16:05:35Z" }],
    ["a missing ETag field", { etag: undefined }],
    ["an unknown field", { size: H33_CONTENT_LENGTH }],
  ])("rejects %s", (_name, patch) => {
    expect(accepted({ ...sourceFile, ...patch })).toBe(false);
  });

  it.each([
    "http://meteofrance.s3.sbg.io.cloud.ovh.net/data/synchro_ftp/BASE/HOR/H_33_latest-2025-2026.csv.gz",
    "https://meteofrance.s3.sbg.io.cloud.ovh.net/H_33.csv.gz?X-Amz-Signature=secret",
    "https://user:pass@meteofrance.s3.sbg.io.cloud.ovh.net/H_33.csv.gz",
    "meteofrance.s3.sbg.io.cloud.ovh.net/H_33.csv.gz",
    h33UrlOfLength(2049),
  ])("rejects the URL %j: a bare https URL only", (url) => {
    expect(accepted({ ...sourceFile, url })).toBe(false);
  });
});
