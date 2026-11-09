import { describe, expect, it } from "vitest";
import { ElevationMSchema, LatitudeSchema, LongitudeSchema } from "./geo.ts";

describe("LatitudeSchema and LongitudeSchema", () => {
  it.each([-90, 0, 43.3, 90])("accept the latitude %d", (value) => {
    expect(LatitudeSchema.parse(value)).toBe(value);
  });

  it.each([-90.1, 90.1, Number.NaN, "43.3"])("reject the latitude %j", (value) => {
    expect(LatitudeSchema.safeParse(value).success).toBe(false);
  });

  it.each([-180, 5.4, 180])("accept the longitude %d", (value) => {
    expect(LongitudeSchema.parse(value)).toBe(value);
  });

  it.each([-180.1, 180.1, Number.POSITIVE_INFINITY])("reject the longitude %j", (value) => {
    expect(LongitudeSchema.safeParse(value).success).toBe(false);
  });
});

describe("ElevationMSchema", () => {
  it.each([-500, 0, 4808, 9000])("accepts %d m", (value) => {
    expect(ElevationMSchema.parse(value)).toBe(value);
  });

  it.each([-501, 9001, Number.NaN])("rejects %j m", (value) => {
    expect(ElevationMSchema.safeParse(value).success).toBe(false);
  });
});
