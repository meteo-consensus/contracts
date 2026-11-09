import { describe, expect, it } from "vitest";
import { ForecastValueSchema } from "./forecast-value.ts";

// Synthetic inputs, not real data. Run initialised at 06:00 UTC, valid at 12:00 UTC.
const base = {
  initTime: "2026-11-09T06:00:00Z",
  numPoste: "13000001",
  validTime: "2026-11-09T12:00:00Z",
  leadTimeH: 6,
  periodEnd: "2026-11-09T12:00:00Z",
  interpolated: false,
};
const precipitation = { ...base, model: "arome_france", variable: "precipitation", value: 0.2 };
const gust = { ...base, variable: "wind_gusts_10m", value: 9.5 };

const accepted = (input: unknown) => ForecastValueSchema.safeParse(input).success;

describe("forecast period start tied to the catalogue", () => {
  it.each([
    {
      name: "ecmwf_ifs gust, 3 h window",
      model: "ecmwf_ifs",
      start: "2026-11-09T09:00:00Z",
      ok: true,
    },
    {
      name: "ecmwf_ifs gust, 1 h window",
      model: "ecmwf_ifs",
      start: "2026-11-09T11:00:00Z",
      ok: false,
    },
    { name: "ecmwf_ifs gust, unknown window", model: "ecmwf_ifs", start: null, ok: false },
    {
      name: "arome_france gust, 1 h window",
      model: "arome_france",
      start: "2026-11-09T11:00:00Z",
      ok: true,
    },
    {
      name: "gfs gust, guessed 1 h window",
      model: "gfs",
      start: "2026-11-09T11:00:00Z",
      ok: false,
    },
    { name: "gfs gust, unknown window", model: "gfs", start: null, ok: true },
  ])("$name: accepted $ok", ({ model, start, ok }) => {
    expect(accepted({ ...gust, model, periodStart: start })).toBe(ok);
  });

  it.each([
    { name: "the preceding hour", start: "2026-11-09T11:00:00Z", ok: true },
    { name: "a null start", start: null, ok: false },
    { name: "a 3 h period", start: "2026-11-09T09:00:00Z", ok: false },
  ])("precipitation with $name: accepted $ok", ({ start, ok }) => {
    expect(accepted({ ...precipitation, periodStart: start })).toBe(ok);
  });
});

// Décision du propriétaire du 09/11/2026: a period that starts before the run is rejected; the
// collector drops those values before validating.
describe("forecast period inside the run", () => {
  const init = "2026-11-09T12:00:00Z";

  it("rejects a precipitation at lead 0 (its hour precedes the run)", () => {
    const atInit = {
      ...precipitation,
      initTime: init,
      validTime: init,
      periodEnd: init,
      leadTimeH: 0,
      periodStart: "2026-11-09T11:00:00Z",
    };
    expect(accepted(atInit)).toBe(false);
  });

  it("accepts a precipitation over the first hour of the run", () => {
    const firstHour = {
      ...precipitation,
      initTime: init,
      validTime: "2026-11-09T13:00:00Z",
      periodEnd: "2026-11-09T13:00:00Z",
      leadTimeH: 1,
      periodStart: init,
    };
    expect(accepted(firstHour)).toBe(true);
  });

  it("rejects an ecmwf_ifs gust whose 3 h window starts before the run", () => {
    const early = {
      ...gust,
      model: "ecmwf_ifs",
      initTime: init,
      validTime: "2026-11-09T14:00:00Z",
      periodEnd: "2026-11-09T14:00:00Z",
      leadTimeH: 2,
      periodStart: "2026-11-09T11:00:00Z",
    };
    expect(accepted(early)).toBe(false);
  });
});
