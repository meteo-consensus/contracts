import { describe, expect, it } from "vitest";
import { clamp } from "./clamp.ts";

describe("clamp", () => {
  it.each([
    { value: 5, expected: 5 },
    { value: -3, expected: 0 },
    { value: 12, expected: 10 },
    { value: 0, expected: 0 },
    { value: 10, expected: 10 },
  ])("keeps $value within [0, 10] as $expected", ({ value, expected }) => {
    expect(clamp(value, 0, 10)).toBe(expected);
  });

  it("rejects an empty interval", () => {
    expect(() => clamp(1, 2, 1)).toThrow(RangeError);
  });
});
