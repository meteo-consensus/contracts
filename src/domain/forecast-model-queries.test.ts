import { describe, expect, it } from "vitest";
import type { Grid, GridChange, ProviderFamily, StepRange } from "./forecast-model.ts";
import {
  countIndependentVotes,
  gridAt,
  gridPeriodAt,
  gustWindowOf,
  nativeStepAt,
} from "./forecast-model-queries.ts";

const tiered: { readonly nativeSteps: readonly StepRange[] } = {
  nativeSteps: [
    { untilLeadHours: 90, stepHours: 1 },
    { untilLeadHours: 144, stepHours: 3 },
    { untilLeadHours: "open", stepHours: 6 },
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
        { untilLeadHours: "open", stepHours: null },
      ],
    } as const;
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

const coarse: Grid = { kind: "lat_lon", label: "0.0625° (~7 km)", degrees: 0.0625, approxKm: 7 };
const fine: Grid = { kind: "lat_lon", label: "0.01° (~1 km)", degrees: 0.01, approxKm: 1 };
const switchover: GridChange = {
  id: "test_native",
  firstRunInitUtc: "2026-11-30T00:00:00Z",
  grid: null,
};
const switched = { grid: coarse, gridChanges: [switchover] };

describe("gridAt", () => {
  it("returns the base grid when the model has no grid change", () => {
    expect(gridAt({ grid: coarse, gridChanges: [] }, new Date("2030-01-01T00:00:00Z"))).toBe(
      coarse,
    );
  });

  it("keeps the old grid for a run initialised before the change, even past the change", () => {
    // Its leads valid after 30/11 00Z still come from the old grid: the run decides, not the lead.
    expect(gridAt(switched, new Date("2026-11-29T21:00:00Z"))).toBe(coarse);
  });

  it("returns the new grid, here unknown, for a run initialised at the change", () => {
    expect(gridAt(switched, new Date("2026-11-30T00:00:00Z"))).toBeNull();
    expect(gridAt(switched, new Date("2027-06-01T00:00:00Z"))).toBeNull();
  });

  it("applies the latest change in effect when there are several", () => {
    const model = {
      grid: coarse,
      gridChanges: [
        switchover,
        { id: "test_fine", firstRunInitUtc: "2027-01-01T00:00:00Z", grid: fine } as const,
      ],
    };
    expect(gridAt(model, new Date("2026-12-15T00:00:00Z"))).toBeNull();
    expect(gridAt(model, new Date("2027-01-01T00:00:00Z"))).toBe(fine);
  });

  it("rejects an invalid date", () => {
    expect(() => gridAt(switched, new Date("not a date"))).toThrow(RangeError);
  });
});

describe("gridPeriodAt", () => {
  it("puts runs before any change in the initial period, since the first run", () => {
    expect(gridPeriodAt(switched, new Date("2026-11-29T21:00:00Z"))).toEqual({
      id: "initial",
      since: "first_run",
      grid: coarse,
    });
  });

  it("opens a distinct period at a change even when the new grid is unknown", () => {
    expect(gridPeriodAt(switched, new Date("2026-11-30T00:00:00Z"))).toEqual({
      id: "test_native",
      since: "2026-11-30T00:00:00Z",
      grid: null,
    });
  });

  it("names each period by its change id, whatever its position", () => {
    const model = {
      grid: coarse,
      gridChanges: [
        switchover,
        { id: "test_fine", firstRunInitUtc: "2027-01-01T00:00:00Z", grid: fine } as const,
      ],
    };
    expect(gridPeriodAt(model, new Date("2027-02-01T00:00:00Z")).id).toBe("test_fine");
  });

  it("rejects an invalid date", () => {
    expect(() => gridPeriodAt(switched, new Date(Number.NaN))).toThrow(RangeError);
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

describe("gustWindowOf", () => {
  it("returns the model's own gust window", () => {
    expect(gustWindowOf({ gustWindowHours: 3 })).toBe(3);
  });

  it("returns null, never the 1 h variable default, when the window is unknown", () => {
    expect(gustWindowOf({ gustWindowHours: null })).toBeNull();
  });
});
