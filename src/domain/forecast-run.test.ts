import { describe, expect, it } from "vitest";
import { openMeteoApiHosts } from "./forecast-providers.ts";
import { CellSelectionSchema, ForecastPointSchema, ForecastRunSchema } from "./forecast-run.ts";

// Synthetic inputs, not real data.
const run = {
  model: "arome_france",
  initTime: "2026-11-09T06:00:00Z",
  modificationTime: "2026-11-09T07:40:00Z",
  availabilityTime: "2026-11-09T07:45:00Z",
  fetchedAt: "2026-11-09T08:00:00Z",
  sourceApi: "https://api.open-meteo.com/v1/forecast",
};

const point = {
  model: "arome_france",
  initTime: "2026-11-09T06:00:00Z",
  numPoste: "13000001",
  requestedLatitude: 43.5,
  requestedLongitude: 5.25,
  gridLatitude: 43.49,
  gridLongitude: 5.26,
  gridElevationM: 12,
  elevationParamM: 10,
  cellSelection: "land",
  stationElevationM: 10,
};

const runAccepted = (input: unknown) => ForecastRunSchema.safeParse(input).success;
const pointAccepted = (input: unknown) => ForecastPointSchema.safeParse(input).success;

describe("ForecastRunSchema", () => {
  it("accepts a run with its metadata times", () => {
    expect(ForecastRunSchema.parse(run)).toEqual(run);
  });

  it.each([
    ["an unknown model", { model: "dwd_icon_eu" }],
    ["a non-UTC init time", { initTime: "2026-11-09T07:00:00+01:00" }],
    ["a local availability time", { availabilityTime: "2026-11-09T07:45:00" }],
    ["a fractional fetch time", { fetchedAt: "2026-11-09T08:00:00.123Z" }],
    ["a modification before the init", { modificationTime: "2026-11-09T05:59:59Z" }],
    ["an availability before the init", { availabilityTime: "2026-11-09T05:00:00Z" }],
    ["a fetch before the init", { fetchedAt: "2026-11-09T05:59:59Z" }],
    ["an unknown field", { runId: 1 }],
  ])("rejects %s", (_name, patch) => {
    expect(runAccepted({ ...run, ...patch })).toBe(false);
  });

  it.each([
    "http://api.open-meteo.com/v1/forecast",
    "https://api.open-meteo.com/v1/forecast?apikey=secret",
    "https://user:pass@api.open-meteo.com/v1/forecast",
    "https://api.open-meteo.com/v1/forecast#hourly",
    " https://api.open-meteo.com/v1/forecast",
    "api.open-meteo.com/v1/forecast",
    "",
  ])(
    "rejects the source API %j: a bare https URL only, never a query or credentials",
    (sourceApi) => {
      expect(runAccepted({ ...run, sourceApi })).toBe(false);
    },
  );
  it.each([...openMeteoApiHosts])("accepts the catalogued Open-Meteo host %s", (host) => {
    expect(runAccepted({ ...run, sourceApi: `https://${host}/v1/forecast` })).toBe(true);
  });

  it.each([
    "https://example.com/v1/forecast",
    "https://open-meteo.com/v1/forecast",
    "https://sub.api.open-meteo.com/v1/forecast",
    "https://api.open-meteo.com.evil.example/v1/forecast",
    "https://api.open-meteo.com:8443/v1/forecast",
    "https://203.0.113.10/v1/forecast",
  ])("rejects the source API %j: only a catalogued host may be named", (sourceApi) => {
    expect(runAccepted({ ...run, sourceApi })).toBe(false);
  });
});

describe("CellSelectionSchema", () => {
  it("lists the Open-Meteo cell_selection values", () => {
    expect(CellSelectionSchema.options).toEqual(["land", "sea", "nearest"]);
  });
});

describe("ForecastPointSchema", () => {
  it("accepts a point with its requested and grid coordinates", () => {
    expect(ForecastPointSchema.parse(point)).toEqual(point);
  });

  it.each([
    ["an unknown model", { model: "best_match" }],
    ["a non-UTC init time", { initTime: "2026-11-09T06:00:00" }],
    ["a 9-digit station number", { numPoste: "130000011" }],
    ["a requested latitude out of range", { requestedLatitude: 90.5 }],
    ["a grid longitude out of range", { gridLongitude: 181 }],
    ["an implausible grid elevation", { gridElevationM: 10000 }],
    ["a missing elevation parameter", { elevationParamM: null }],
    ["an unknown cell selection", { cellSelection: "ocean" }],
    ["an implausible station elevation", { stationElevationM: -600 }],
    ["an unknown field", { timezone: "GMT" }],
  ])("rejects %s", (_name, patch) => {
    expect(pointAccepted({ ...point, ...patch })).toBe(false);
  });
});
