import { describe, expect, it } from "vitest";
import { GustSourceSchema, ObservationSchema, QualityCodeSchema } from "./observation.ts";
import { variableIds } from "./variables.ts";

// Synthetic inputs, not real data.
const hourly = {
  numPoste: "13000001",
  periodStart: "2026-11-09T05:00:00Z",
  periodEnd: "2026-11-09T06:00:00Z",
  quality: 1,
};
const instant = { ...hourly, periodStart: "2026-11-09T06:00:00Z" };
const temperature = { ...instant, variable: "temperature_2m", value: 12.3 };
const precipitation = { ...hourly, variable: "precipitation", value: 0.4 };
const windSpeed = {
  ...hourly,
  periodStart: "2026-11-09T05:50:00Z",
  variable: "wind_speed_10m",
  value: 4.2,
  periodUnverified: true,
};
const cloudCover = { ...instant, variable: "cloud_cover", value: 50, skyObscured: false };
const gustFxi3s = {
  ...hourly,
  variable: "wind_gusts_10m",
  value: 11.5,
  gustSource: "FXI3S",
  fxi3sComputed: false,
};
const gustFxi = { ...hourly, variable: "wind_gusts_10m", value: 12.1, gustSource: "FXI" };

const accepted = (input: unknown) => ObservationSchema.safeParse(input).success;

describe("QualityCodeSchema", () => {
  it.each([0, 1, 2, 9, null])("accepts %j", (code) => {
    expect(QualityCodeSchema.parse(code)).toBe(code);
  });

  it.each([3, 8, -1, 1.5, "1", undefined])("rejects %j", (code) => {
    expect(QualityCodeSchema.safeParse(code).success).toBe(false);
  });
});

describe("GustSourceSchema", () => {
  it("lists the two BDClim gust sources", () => {
    expect(GustSourceSchema.options).toEqual(["FXI3S", "FXI"]);
  });
});

describe("ObservationSchema", () => {
  it.each([
    ["an instant temperature", temperature],
    ["an hourly precipitation", precipitation],
    ["a 10-minute wind speed", windSpeed],
    ["a cloud cover", cloudCover],
    ["a measured FXI3S gust", gustFxi3s],
    ["an FXI gust", gustFxi],
  ])("accepts %s", (_name, observation) => {
    expect(ObservationSchema.parse(observation)).toEqual(observation);
  });

  it("accepts an observation of every catalogued variable", () => {
    const extras: Record<string, object> = {
      wind_speed_10m: { periodUnverified: true },
      wind_direction_10m: { periodUnverified: true },
      cloud_cover: { skyObscured: false },
      wind_gusts_10m: { gustSource: "FXI" },
    };
    for (const variable of variableIds) {
      expect(accepted({ ...hourly, variable, value: null, ...extras[variable] }), variable).toBe(
        true,
      );
    }
  });

  describe("missing values and quality codes", () => {
    it.each([
      ["a value with an empty Q", { ...precipitation, quality: null }],
      ["an empty value with an empty Q", { ...precipitation, value: null, quality: null }],
      ["an empty value with its Q", { ...precipitation, value: null, quality: 9 }],
    ])("accepts %s", (_name, observation) => {
      expect(accepted(observation)).toBe(true);
    });

    it.each([3, 8, "1"])("rejects the quality code %j", (quality) => {
      expect(accepted({ ...precipitation, quality })).toBe(false);
    });

    it("rejects a missing quality field", () => {
      const { quality: _quality, ...withoutQuality } = precipitation;
      expect(accepted(withoutQuality)).toBe(false);
    });
  });

  describe("time, variable and bounds", () => {
    it.each([
      ["a period start with an offset", { periodStart: "2026-11-09T06:00:00+01:00" }],
      ["a local period end", { periodEnd: "2026-11-09T06:00:00" }],
      ["a period that ends before it starts", { periodStart: "2026-11-09T06:00:01Z" }],
      ["an unknown variable", { variable: "snowfall" }],
      ["a value above the bounds", { value: 70.1 }],
      ["a value below the bounds", { value: -100.1 }],
      ["a non-finite value", { value: Number.NaN }],
      ["a station number of 7 digits", { numPoste: "1300000" }],
      ["an unknown field", { source: "bdclim" }],
    ])("rejects %s", (_name, patch) => {
      expect(accepted({ ...temperature, ...patch })).toBe(false);
    });

    it("checks the bounds of the observation's own variable", () => {
      expect(accepted({ ...precipitation, value: -0.1 })).toBe(false);
      expect(accepted({ ...cloudCover, value: 100.1 })).toBe(false);
      expect(accepted({ ...gustFxi, value: 150.1 })).toBe(false);
    });
  });

  describe("gusts", () => {
    it("rejects a gust without gustSource", () => {
      const { gustSource: _source, ...withoutSource } = gustFxi;
      expect(accepted(withoutSource)).toBe(false);
    });

    it("rejects an unknown gust source", () => {
      expect(accepted({ ...gustFxi, gustSource: "FXY" })).toBe(false);
    });

    it("rejects an FXI3S gust without fxi3sComputed", () => {
      const { fxi3sComputed: _computed, ...withoutStatus } = gustFxi3s;
      expect(accepted(withoutStatus)).toBe(false);
    });

    it("accepts a computed FXI3S gust", () => {
      expect(accepted({ ...gustFxi3s, fxi3sComputed: true })).toBe(true);
    });

    it("rejects fxi3sComputed on an FXI gust", () => {
      expect(accepted({ ...gustFxi, fxi3sComputed: false })).toBe(false);
    });

    it.each([
      ["gustSource on temperature_2m", { ...temperature, gustSource: "FXI" }],
      ["fxi3sComputed on temperature_2m", { ...temperature, fxi3sComputed: false }],
      ["gustSource on wind_speed_10m", { ...windSpeed, gustSource: "FXI" }],
    ])("rejects %s", (_name, observation) => {
      expect(accepted(observation)).toBe(false);
    });
  });

  describe("wind period flag (BDC-7)", () => {
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

    it.each([
      ["temperature_2m", { ...temperature, periodUnverified: true }],
      ["wind_gusts_10m", { ...gustFxi, periodUnverified: true }],
    ])("rejects periodUnverified on %s", (_name, observation) => {
      expect(accepted(observation)).toBe(false);
    });
  });

  describe("obscured sky", () => {
    it("accepts an obscured sky with no value", () => {
      expect(accepted({ ...cloudCover, value: null, skyObscured: true, quality: 9 })).toBe(true);
    });

    it("rejects an obscured sky with a value", () => {
      expect(accepted({ ...cloudCover, value: 100, skyObscured: true })).toBe(false);
    });

    it("requires skyObscured on cloud cover", () => {
      const { skyObscured: _flag, ...withoutFlag } = cloudCover;
      expect(accepted(withoutFlag)).toBe(false);
    });

    it("rejects skyObscured on another variable", () => {
      expect(accepted({ ...temperature, skyObscured: false })).toBe(false);
    });
  });
});
