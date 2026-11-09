import { describe, expect, it } from "vitest";
import { ObservationSchema } from "./observation.ts";
import { variableIds } from "./variables.ts";

// Synthetic inputs, not real data. Every period ends at 06:00 UTC.
const end = "2026-11-09T06:00:00Z";
const starts = {
  instant: end,
  tenMinutes: "2026-11-09T05:50:00Z",
  hour: "2026-11-09T05:00:00Z",
  threeHours: "2026-11-09T03:00:00Z",
};
const base = { numPoste: "13000001", periodEnd: end, quality: 1 };
const temperature = { ...base, periodStart: starts.instant, variable: "temperature_2m", value: 9 };
const precipitation = {
  ...base,
  periodStart: starts.hour,
  variable: "precipitation",
  value: 0.4,
  periodUnverified: true,
};
const windSpeed = {
  ...base,
  periodStart: starts.tenMinutes,
  variable: "wind_speed_10m",
  value: 4.2,
  periodUnverified: true,
};
const gustFxi = { ...base, periodStart: starts.hour, variable: "wind_gusts_10m", value: 12.1 };

const accepted = (input: unknown) => ObservationSchema.safeParse(input).success;

describe("observation period length", () => {
  it("accepts an observation of every catalogued variable over its own period", () => {
    const shapes: Record<string, object> = {
      temperature_2m: { periodStart: starts.instant },
      relative_humidity_2m: { periodStart: starts.instant },
      pressure_msl: { periodStart: starts.instant },
      cloud_cover: { periodStart: starts.instant, skyObscured: false },
      wind_speed_10m: { periodStart: starts.tenMinutes, periodUnverified: true },
      wind_direction_10m: { periodStart: starts.tenMinutes, periodUnverified: true },
      precipitation: { periodStart: starts.hour, periodUnverified: true },
      wind_gusts_10m: { periodStart: starts.hour, gustSource: "FXI" },
    };
    for (const variable of variableIds) {
      expect(accepted({ ...base, variable, value: null, ...shapes[variable] }), variable).toBe(
        true,
      );
    }
  });

  const fxi = { ...gustFxi, gustSource: "FXI" };
  it.each([
    {
      name: "an instant temperature (06:00 → 06:00)",
      obs: temperature,
      start: starts.instant,
      ok: true,
    },
    {
      name: "an hourly temperature (05:00 → 06:00)",
      obs: temperature,
      start: starts.hour,
      ok: false,
    },
    {
      name: "a temperature ending before it starts",
      obs: temperature,
      start: "2026-11-09T06:00:01Z",
      ok: false,
    },
    {
      name: "an hourly precipitation (05:00 → 06:00)",
      obs: precipitation,
      start: starts.hour,
      ok: true,
    },
    {
      name: "a 10-minute precipitation (05:50 → 06:00)",
      obs: precipitation,
      start: starts.tenMinutes,
      ok: false,
    },
    {
      name: "a 10-minute wind (05:50 → 06:00)",
      obs: windSpeed,
      start: starts.tenMinutes,
      ok: true,
    },
    { name: "an instant wind (06:00 → 06:00)", obs: windSpeed, start: starts.instant, ok: false },
    { name: "an hourly wind (05:00 → 06:00)", obs: windSpeed, start: starts.hour, ok: false },
    { name: "an hourly FXI gust (05:00 → 06:00)", obs: fxi, start: starts.hour, ok: true },
    { name: "a 3-hour FXI gust (03:00 → 06:00)", obs: fxi, start: starts.threeHours, ok: false },
  ])("$name: accepted $ok", ({ obs, start, ok }) => {
    expect(accepted({ ...obs, periodStart: start })).toBe(ok);
  });
});

describe("period flags (BDC-6, BDC-7)", () => {
  it.each([true, false])("accepts periodUnverified %j on wind speed and direction", (flag) => {
    expect(accepted({ ...windSpeed, periodUnverified: flag })).toBe(true);
    expect(
      accepted({
        ...windSpeed,
        variable: "wind_direction_10m",
        value: 360,
        periodUnverified: flag,
      }),
    ).toBe(true);
  });

  it("requires periodUnverified on wind speed and direction", () => {
    const { periodUnverified: _flag, ...withoutFlag } = windSpeed;
    expect(accepted(withoutFlag)).toBe(false);
    expect(accepted({ ...withoutFlag, variable: "wind_direction_10m" })).toBe(false);
  });

  it("accepts a precipitation with periodUnverified true", () => {
    expect(accepted(precipitation)).toBe(true);
  });

  it("rejects a precipitation without periodUnverified", () => {
    const { periodUnverified: _flag, ...withoutFlag } = precipitation;
    expect(accepted(withoutFlag)).toBe(false);
  });

  it.each([
    ["temperature_2m", { ...temperature, periodUnverified: true }],
    ["wind_gusts_10m", { ...gustFxi, gustSource: "FXI", periodUnverified: true }],
  ])("rejects periodUnverified on %s", (_name, observation) => {
    expect(accepted(observation)).toBe(false);
  });
});
