import { describe, expect, it } from "vitest";
import { isBareHttpsUrl } from "./urls.ts";

describe("isBareHttpsUrl", () => {
  it.each([
    "https://api.open-meteo.com/v1/forecast",
    "https://meteofrance.s3.sbg.io.cloud.ovh.net/data/synchro_ftp/BASE/HOR/H_33_latest-2025-2026.csv.gz",
  ])("accepts %s", (value) => {
    expect(isBareHttpsUrl(value)).toBe(true);
  });

  it.each([
    "http://api.open-meteo.com/v1/forecast",
    "https://api.open-meteo.com/v1/forecast?apikey=secret",
    "https://user:pass@api.open-meteo.com/v1/forecast",
    "https://api.open-meteo.com/v1/forecast#hourly",
    " https://api.open-meteo.com/v1/forecast",
    "HTTPS://api.open-meteo.com/v1/forecast",
    "api.open-meteo.com/v1/forecast",
    "",
  ])("rejects %j: canonical https only, no credentials, query or fragment", (value) => {
    expect(isBareHttpsUrl(value)).toBe(false);
  });
});
