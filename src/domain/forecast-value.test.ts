import { describe, expect, it } from "vitest";
import {
  ForecastValueSchema,
  instantForecastVariables,
  periodForecastVariables,
} from "./forecast-value.ts";
import { variableCatalogue, variableIds } from "./variables.ts";

// Synthetic inputs, not real data.
const temperature = {
  model: "arome_france",
  initTime: "2026-11-09T06:00:00Z",
  numPoste: "13000001",
  variable: "temperature_2m",
  validTime: "2026-11-09T12:00:00Z",
  leadTimeH: 6,
  value: 14.2,
  interpolated: false,
};
const precipitation = {
  ...temperature,
  variable: "precipitation",
  value: 0.2,
  periodStart: "2026-11-09T11:00:00Z",
  periodEnd: "2026-11-09T12:00:00Z",
};
const ecmwfGust = {
  ...precipitation,
  model: "ecmwf_ifs",
  variable: "wind_gusts_10m",
  value: 9.5,
  periodStart: "2026-11-09T09:00:00Z",
};

const accepted = (input: unknown) => ForecastValueSchema.safeParse(input).success;

describe("forecast value variables", () => {
  it("gives a period exactly to the variables that cover the preceding hour", () => {
    for (const id of variableIds) {
      const covers = ["sum_preceding_1h", "max_preceding_1h"].includes(
        variableCatalogue[id].temporal,
      );
      expect(
        periodForecastVariables.some((v) => v === id),
        id,
      ).toBe(covers);
      expect(
        instantForecastVariables.some((v) => v === id),
        id,
      ).toBe(!covers);
    }
  });
});

describe("ForecastValueSchema", () => {
  it.each([
    ["an instant value", temperature],
    ["an hourly precipitation sum with its period", precipitation],
    ["an ECMWF gust over its 3 h window", ecmwfGust],
    ["a gust whose window is unknown", { ...ecmwfGust, model: "gfs", periodStart: null }],
    ["a missing value", { ...temperature, value: null }],
    ["an interpolated value", { ...temperature, interpolated: true }],
    ["the analysis hour", { ...temperature, validTime: "2026-11-09T06:00:00Z", leadTimeH: 0 }],
    ["the 72 h cap", { ...temperature, validTime: "2026-11-12T06:00:00Z", leadTimeH: 72 }],
  ])("accepts %s", (_name, input) => {
    expect(ForecastValueSchema.parse(input)).toEqual(input);
  });

  it.each([
    ["an unknown variable", { variable: "snowfall" }],
    ["a value out of bounds", { value: 70.1 }],
    ["a non-UTC valid time", { validTime: "2026-11-09T13:00:00+01:00" }],
    ["a lead that does not match the times", { leadTimeH: 5 }],
    ["a fractional lead", { leadTimeH: 6.5 }],
    ["a missing interpolated flag", { interpolated: undefined }],
    ["a period on an instant variable", { periodStart: "2026-11-09T11:00:00Z" }],
    ["an unknown field", { unit: "°C" }],
  ])("rejects %s", (_name, patch) => {
    expect(accepted({ ...temperature, ...patch })).toBe(false);
  });

  it.each([
    ["a negative lead", "2026-11-09T05:00:00Z", -1],
    ["a lead over 72 h", "2026-11-12T07:00:00Z", 73],
  ])("rejects %s", (_name, validTime, leadTimeH) => {
    expect(accepted({ ...temperature, validTime, leadTimeH })).toBe(false);
  });

  it.each([
    ["no period start", { periodStart: undefined }],
    ["no period end", { periodEnd: undefined }],
    ["a period that does not end at the valid time", { periodEnd: "2026-11-09T11:00:00Z" }],
    ["an empty period", { periodStart: "2026-11-09T12:00:00Z" }],
    ["a period start after its end", { periodStart: "2026-11-09T13:00:00Z" }],
    ["a non-UTC period start", { periodStart: "2026-11-09T12:00:00+01:00" }],
    ["a negative precipitation", { value: -0.1 }],
  ])("rejects a precipitation with %s", (_name, patch) => {
    expect(accepted({ ...precipitation, ...patch })).toBe(false);
  });
});
