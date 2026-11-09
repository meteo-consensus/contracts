import { describe, expect, it } from "vitest";
import {
  countIndependentVotes,
  ForecastModelIdSchema,
  type Grid,
  type GridChange,
  gridAt,
  nativeStepAt,
  type ProviderFamily,
  type StepRange,
} from "./forecast-model.ts";

const tiered: { readonly nativeSteps: readonly StepRange[] } = {
  nativeSteps: [
    { untilLeadHours: 90, stepHours: 1 },
    { untilLeadHours: 144, stepHours: 3 },
    { untilLeadHours: null, stepHours: 6 },
  ],
};

describe("nativeStepAt", () => {
  it.each([
    { lead: 0, step: 1 },
    { lead: 90, step: 1 },
    { lead: 93, step: 3 },
    { lead: 144, step: 3 },
    { lead: 150, step: 6 },
    { lead: 10_000, step: 6 },
  ])("returns $step h at lead $lead h", ({ lead, step }) => {
    expect(nativeStepAt(tiered, lead)).toBe(step);
  });

  it("returns null where the step is unknown", () => {
    const partlyKnown = {
      nativeSteps: [
        { untilLeadHours: 72, stepHours: 1 },
        { untilLeadHours: null, stepHours: null },
      ],
    };
    expect(nativeStepAt(partlyKnown, 72)).toBe(1);
    expect(nativeStepAt(partlyKnown, 73)).toBeNull();
  });

  it("returns null past the last range when no range is open-ended", () => {
    const closed = { nativeSteps: [{ untilLeadHours: 48, stepHours: 1 }] };
    expect(nativeStepAt(closed, 49)).toBeNull();
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects the lead %d h", (lead) => {
    expect(() => nativeStepAt(tiered, lead)).toThrow(RangeError);
  });
});

const coarse: Grid = { label: "0.0625° (~7 km)", degrees: 0.0625, approxKm: 7 };
const switchover: GridChange = { effectiveFromUtc: "2026-11-30T00:00:00Z", grid: null };

describe("gridAt", () => {
  it("returns the base grid when the model has no grid change", () => {
    const model = { grid: coarse, gridChanges: [] };
    expect(gridAt(model, new Date("2030-01-01T00:00:00Z"))).toBe(coarse);
  });

  it("returns the base grid before the first change", () => {
    const model = { grid: coarse, gridChanges: [switchover] };
    expect(gridAt(model, new Date("2026-11-29T23:59:59Z"))).toBe(coarse);
  });

  it("returns the changed grid from the change instant onwards", () => {
    const model = { grid: coarse, gridChanges: [switchover] };
    expect(gridAt(model, new Date("2026-11-30T00:00:00Z"))).toBeNull();
    expect(gridAt(model, new Date("2027-06-01T00:00:00Z"))).toBeNull();
  });

  it("applies the latest change in effect when there are several", () => {
    const fine: Grid = { label: "0.01° (~1 km)", degrees: 0.01, approxKm: 1 };
    const model = {
      grid: coarse,
      gridChanges: [switchover, { effectiveFromUtc: "2027-01-01T00:00:00Z", grid: fine }],
    };
    expect(gridAt(model, new Date("2026-12-15T00:00:00Z"))).toBeNull();
    expect(gridAt(model, new Date("2027-01-01T00:00:00Z"))).toBe(fine);
  });

  it("rejects an invalid date", () => {
    const model = { grid: coarse, gridChanges: [switchover] };
    expect(() => gridAt(model, new Date("not a date"))).toThrow(RangeError);
  });
});

describe("countIndependentVotes", () => {
  const of = (...families: ProviderFamily[]) =>
    families.map((providerFamily) => ({ providerFamily }));

  it("counts zero votes for no model", () => {
    expect(countIndependentVotes([])).toBe(0);
  });

  it("counts models of the same family as one vote", () => {
    expect(countIndependentVotes(of("meteo_france_arome", "meteo_france_arome"))).toBe(1);
  });

  it("counts one vote per distinct family", () => {
    expect(
      countIndependentVotes(
        of("meteo_france_arome", "ecmwf_ifs", "meteo_france_arome", "noaa_gfs"),
      ),
    ).toBe(3);
  });
});

describe("ForecastModelIdSchema", () => {
  it("accepts a catalogued id", () => {
    expect(ForecastModelIdSchema.parse("arome_france_hd")).toBe("arome_france_hd");
  });

  it.each(["dwd_icon_eu", "AROME_FRANCE", "", 1])("rejects the unknown id %j", (id) => {
    expect(ForecastModelIdSchema.safeParse(id).success).toBe(false);
  });
});
