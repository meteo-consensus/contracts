import { describe, expect, it } from "vitest";
import { NumPosteSchema, StationNetworkSchema, StationSchema } from "./station.ts";

// Synthetic input shaped like a BDClim row (NUM_POSTE, NOM_USUEL, LAT, LON, ALTI), not real data.
const station = {
  numPoste: "13000001",
  name: "STATION TEST",
  latitude: 43.5,
  longitude: 5.25,
  elevationM: 10,
  network: "meteo_france",
  validFrom: "2026-11-09T00:00:00Z",
  validTo: null,
};

describe("NumPosteSchema", () => {
  it("accepts an 8-digit station number, leading zero included", () => {
    expect(NumPosteSchema.parse("13000001")).toBe("13000001");
    expect(NumPosteSchema.parse("01014002")).toBe("01014002");
  });

  it.each(["1300000", "130000011", "1300000a", " 13000001", "", 13000001])(
    "rejects %j",
    (value) => {
      expect(NumPosteSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("StationNetworkSchema", () => {
  it("lists the observation networks", () => {
    expect(StationNetworkSchema.options).toEqual(["meteo_france"]);
  });
});

describe("StationSchema", () => {
  it("accepts the current version of a station", () => {
    expect(StationSchema.parse(station)).toEqual(station);
  });

  it("accepts a closed version", () => {
    const closed = { ...station, validTo: "2026-12-01T00:00:00Z" };
    expect(StationSchema.parse(closed)).toEqual(closed);
  });

  it.each([{ numPoste: "1300000" }, { numPoste: "130000011" }])(
    "rejects a station number that is not 8 digits: $numPoste",
    (patch) => {
      expect(StationSchema.safeParse({ ...station, ...patch }).success).toBe(false);
    },
  );

  it.each([
    { name: "" },
    { latitude: 91 },
    { longitude: -181 },
    { elevationM: 9500 },
    { network: "netatmo" },
    { validFrom: "2026-11-09T01:00:00+01:00" },
    { validTo: "2026-12-01T00:00:00" },
  ])("rejects %j", (patch) => {
    expect(StationSchema.safeParse({ ...station, ...patch }).success).toBe(false);
  });

  it.each(["2026-11-09T00:00:00Z", "2026-11-08T23:00:00Z"])(
    "rejects a version that ends at %s, not after it starts",
    (validTo) => {
      expect(StationSchema.safeParse({ ...station, validTo }).success).toBe(false);
    },
  );

  it("rejects an unknown field", () => {
    expect(StationSchema.safeParse({ ...station, department: "13" }).success).toBe(false);
  });
});
