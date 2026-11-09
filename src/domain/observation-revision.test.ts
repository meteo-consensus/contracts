import { describe, expect, it } from "vitest";
import { ObservationRevisionSchema } from "./observation-revision.ts";

// Synthetic input, not real data: RR1 0.4 Q9 revised to 0.6 Q1.
const revision = {
  numPoste: "13000001",
  variable: "precipitation",
  periodEnd: "2026-11-09T06:00:00Z",
  gustSource: null,
  oldValue: 0.4,
  newValue: 0.6,
  oldQuality: 9,
  newQuality: 1,
  revisedAt: "2026-11-10T02:42:00Z",
};
const gustRevision = { ...revision, variable: "wind_gusts_10m", gustSource: "FXI" };
const fxi3sRevision = {
  ...gustRevision,
  gustSource: "FXI3S",
  oldFxi3sComputed: false,
  newFxi3sComputed: false,
};

const accepted = (input: unknown) => ObservationRevisionSchema.safeParse(input).success;

describe("ObservationRevisionSchema", () => {
  it.each([
    ["a value and quality revision", revision],
    ["a gust revision with its source", gustRevision],
    ["a value that becomes missing", { ...revision, newValue: null, newQuality: null }],
    ["a quality that was empty", { ...revision, oldQuality: null }],
  ])("accepts %s", (_name, input) => {
    expect(ObservationRevisionSchema.parse(input)).toEqual(input);
  });

  it.each([
    ["a gust revision without source", { ...gustRevision, gustSource: null }],
    ["a gust source on another variable", { ...revision, gustSource: "FXI" }],
    ["a missing gust source key", { ...revision, gustSource: undefined }],
    ["an old value out of bounds", { ...revision, oldValue: -0.1 }],
    ["a new value out of bounds", { ...revision, newValue: 500.1 }],
    ["an unknown quality code", { ...revision, newQuality: 3 }],
    ["a non-UTC revision date", { ...revision, revisedAt: "2026-11-10T03:42:00+01:00" }],
    ["a non-UTC period end", { ...revision, periodEnd: "2026-11-09T06:00:00" }],
    ["an unknown variable", { ...revision, variable: "snowfall" }],
    ["an unknown field", { ...revision, reason: "late" }],
  ])("rejects %s", (_name, input) => {
    expect(accepted(input)).toBe(false);
  });

  describe("FXI3S status", () => {
    it.each([
      ["a value revision with an unchanged status", fxi3sRevision],
      [
        "a status-only revision",
        { ...fxi3sRevision, newValue: 0.4, newQuality: 9, newFxi3sComputed: true },
      ],
      [
        "a value that becomes missing",
        { ...fxi3sRevision, newValue: null, newQuality: null, newFxi3sComputed: null },
      ],
    ])("accepts %s", (_name, input) => {
      expect(ObservationRevisionSchema.parse(input)).toEqual(input);
    });

    it.each([
      ["an FXI3S revision without status", { ...gustRevision, gustSource: "FXI3S" }],
      ["a status on an FXI revision", { ...gustRevision, oldFxi3sComputed: false }],
      ["a status on another variable", { ...revision, newFxi3sComputed: true }],
      ["a null status on a filled value", { ...fxi3sRevision, newFxi3sComputed: null }],
      ["a status on a missing value", { ...fxi3sRevision, oldValue: null }],
    ])("rejects %s", (_name, input) => {
      expect(accepted(input)).toBe(false);
    });
  });

  describe("consistency", () => {
    it.each([
      ["a revision that changes nothing", { ...revision, newValue: 0.4, newQuality: 9 }],
      [
        "a missing value that stays missing",
        { ...revision, oldValue: null, newValue: null, newQuality: 9 },
      ],
      [
        "an FXI3S revision that changes nothing",
        { ...fxi3sRevision, newValue: 0.4, newQuality: 9 },
      ],
      [
        "a revision before the end of its period",
        { ...revision, revisedAt: "2026-11-09T05:59:59Z" },
      ],
      ["a periodUnverified flag", { ...revision, periodUnverified: true }],
      ["a skyObscured flag", { ...revision, variable: "cloud_cover", skyObscured: true }],
    ])("rejects %s", (_name, input) => {
      expect(accepted(input)).toBe(false);
    });

    it("accepts a revision at the end of its period", () => {
      expect(accepted({ ...revision, revisedAt: revision.periodEnd })).toBe(true);
    });
  });

  describe("obscured sky", () => {
    const cloud = {
      ...revision,
      variable: "cloud_cover",
      oldValue: null,
      newValue: null,
      oldQuality: 9,
      newQuality: 9,
      oldSkyObscured: false,
      newSkyObscured: true,
    };

    it.each([
      ["an empty N that becomes N=9 (null/false → null/true)", cloud],
      [
        "N=9 that becomes 5 octas (null/true → 62.5/false)",
        { ...cloud, newValue: 62.5, oldSkyObscured: true, newSkyObscured: false },
      ],
    ])("accepts %s", (_name, input) => {
      expect(ObservationRevisionSchema.parse(input)).toEqual(input);
    });

    it.each([
      ["an unchanged pair", { ...cloud, oldSkyObscured: true }],
      ["an obscured sky with a value", { ...cloud, newValue: 100 }],
      ["a missing sky flag", { ...cloud, newSkyObscured: undefined }],
      ["a sky flag on another variable", { ...revision, oldSkyObscured: false }],
    ])("rejects %s", (_name, input) => {
      expect(accepted(input)).toBe(false);
    });
  });
});
