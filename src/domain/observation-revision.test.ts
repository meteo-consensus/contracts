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
const gustRevision = { ...revision, variable: "wind_gusts_10m", gustSource: "FXI3S" };

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
});
