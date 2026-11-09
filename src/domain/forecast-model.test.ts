import { describe, expect, it } from "vitest";
import {
  ForecastModelIdSchema,
  forecastModelIds,
  ProviderFamilySchema,
  ProviderIdSchema,
  providerFamilies,
  providerIds,
  UtcInstantSchema,
} from "./forecast-model.ts";

describe("forecast model enums", () => {
  it.each([
    { name: "model ids", values: forecastModelIds, schema: ForecastModelIdSchema },
    { name: "provider ids", values: providerIds, schema: ProviderIdSchema },
    { name: "provider families", values: providerFamilies, schema: ProviderFamilySchema },
  ])("freezes the $name and accepts each of them", ({ values, schema }) => {
    expect(Object.isFrozen(values)).toBe(true);
    for (const value of values) {
      expect(schema.parse(value)).toBe(value);
    }
  });

  it("lists the four providers and five families", () => {
    expect([...providerIds].sort()).toEqual(["dwd", "ecmwf", "meteo_france", "noaa_ncep"]);
    expect([...providerFamilies].sort()).toEqual([
      "dwd_icon",
      "ecmwf_ifs",
      "meteo_france_arome",
      "meteo_france_arpege",
      "noaa_gfs",
    ]);
  });

  it.each(["dwd_icon_eu", "AROME_FRANCE", "", 1])("rejects the unknown model id %j", (id) => {
    expect(ForecastModelIdSchema.safeParse(id).success).toBe(false);
  });

  it.each(["meteofrance", "noaa", null])("rejects the unknown provider id %j", (id) => {
    expect(ProviderIdSchema.safeParse(id).success).toBe(false);
  });

  it.each(["arome", "dwd", "ICON"])("rejects the unknown family %j", (family) => {
    expect(ProviderFamilySchema.safeParse(family).success).toBe(false);
  });
});

describe("UtcInstantSchema", () => {
  it("accepts a UTC instant to the second with a Z suffix", () => {
    expect(UtcInstantSchema.parse("2026-11-30T00:00:00Z")).toBe("2026-11-30T00:00:00Z");
  });

  it.each([
    "garbageZ",
    "2026-11-30T00:00:00+01:00",
    "2026-11-30T00:00:00",
    "2026-11-30T00:00:00.000Z",
    "2026-11-30T00:00Z",
    "2026-13-30T00:00:00Z",
    "",
  ])("rejects %j", (value) => {
    expect(UtcInstantSchema.safeParse(value).success).toBe(false);
  });
});
