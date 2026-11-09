import { describe, expect, it } from "vitest";
import {
  LeadTimeBandSchema,
  leadTimeBandIds,
  leadTimeBandOf,
  MAX_LEAD_TIME_H,
} from "./lead-time-bands.ts";

describe("lead time bands", () => {
  it("lists the six fixed bands in order, frozen", () => {
    expect(leadTimeBandIds).toEqual(["0-6", "6-12", "12-24", "24-36", "36-48", "48-72"]);
    expect(Object.isFrozen(leadTimeBandIds)).toBe(true);
    expect(LeadTimeBandSchema.options).toEqual([...leadTimeBandIds]);
  });

  it("caps the collected lead time at 72 h", () => {
    expect(MAX_LEAD_TIME_H).toBe(72);
  });

  it.each([
    [0, "0-6"],
    [6, "0-6"],
    [6.5, "6-12"],
    [12, "6-12"],
    [13, "12-24"],
    [24, "12-24"],
    [36, "24-36"],
    [48, "36-48"],
    [49, "48-72"],
    [72, "48-72"],
  ] as const)("puts a %d h lead in band %s", (leadTimeH, band) => {
    expect(leadTimeBandOf(leadTimeH)).toEqual({ ok: true, band });
  });

  it.each([-1, -0.5, 72.5, 73, Number.NaN, Number.POSITIVE_INFINITY])(
    "returns a typed error for the lead %d h",
    (leadTimeH) => {
      expect(leadTimeBandOf(leadTimeH)).toEqual({
        ok: false,
        error: { code: "lead_time_out_of_range", leadTimeH },
      });
    },
  );
});
