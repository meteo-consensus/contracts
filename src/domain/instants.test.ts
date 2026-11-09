import { describe, expect, it } from "vitest";
import { hoursBetween } from "./instants.ts";

describe("hoursBetween", () => {
  it.each([
    ["2026-11-09T00:00:00Z", "2026-11-09T00:00:00Z", 0],
    ["2026-11-09T00:00:00Z", "2026-11-12T00:00:00Z", 72],
    ["2026-11-09T00:00:00Z", "2026-11-09T00:10:00Z", 1 / 6],
    ["2026-11-09T01:00:00Z", "2026-11-09T00:00:00Z", -1],
    ["2026-10-25T00:00:00Z", "2026-10-25T06:00:00Z", 6],
  ])("counts %s to %s as %d h", (from, to, hours) => {
    expect(hoursBetween(from, to)).toBeCloseTo(hours, 12);
  });
});
