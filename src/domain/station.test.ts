import { describe, expect, it } from "vitest";
import {
  NumPosteSchema,
  STATION_NAME_MAX_LENGTH,
  StationNetworkSchema,
  StationSchema,
} from "./station.ts";

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

  // Synthetic names in the shape of real French place names, not BDClim extracts.
  it.each([
    "MARSEILLE-MARIGNANE",
    "L'ÎLE-D'YEU",
    "Saint-Étienne-de-Tinée",
    "Saint-Martin-d’Hères",
    "Montélimar – Ancône",
    "A".repeat(STATION_NAME_MAX_LENGTH),
  ])("accepts the name %j", (name) => {
    expect(StationSchema.parse({ ...station, name }).name).toBe(name);
  });

  it("rejects a name longer than the maximum", () => {
    const name = "A".repeat(STATION_NAME_MAX_LENGTH + 1);
    expect(StationSchema.safeParse({ ...station, name }).success).toBe(false);
  });

  it.each(["\u0000", "\t", "\n", "\r", "\u001B", "\u001F", "\u007F", "\u0085"])(
    "rejects a name with the control character %j",
    (control) => {
      expect(StationSchema.safeParse({ ...station, name: `STATION${control}TEST` }).success).toBe(
        false,
      );
    },
  );

  it.each([" STATION", "STATION ", "\u00A0STATION", "STATION\u2003", " "])(
    "rejects the name %j, which starts or ends with whitespace",
    (name) => {
      expect(StationSchema.safeParse({ ...station, name }).success).toBe(false);
    },
  );

  it.each([
    ["Cf, right-to-left override", "STATION\u202ETEST"],
    ["Cf, left-to-right isolate", "STATION\u2066TEST"],
    ["Cf, pop directional isolate", "STATION\u2069TEST"],
    ["Cf, zero-width space", "STATION\u200BTEST"],
    ["Cf, leading zero-width space", "\u200BSTATION"],
    ["Cf, byte order mark", "STATION\uFEFFTEST"],
    ["Zl, line separator", "STATION\u2028TEST"],
    ["Zp, paragraph separator", "STATION\u2029TEST"],
    ["Co, private use", "STATION\uE000TEST"],
    ["Co, supplementary private use", "STATION\u{F0000}TEST"],
    ["Cn, unassigned", "STATION\u0378TEST"],
    ["Cn, noncharacter", "STATION\uFFFFTEST"],
    ["U+FFFD replacement", "STATION\uFFFDTEST"],
  ])("rejects a name with a %s character", (_category, name) => {
    expect(StationSchema.safeParse({ ...station, name }).success).toBe(false);
  });

  it.each([
    ["lone high surrogate", "STATION\uD800TEST"],
    ["lone low surrogate", "STATION\uDC00TEST"],
    ["trailing high surrogate", "STATION\uD83D"],
    ["reversed surrogate pair", "STATION\uDE00\uD83D"],
  ])("rejects a malformed name with a %s", (_case, name) => {
    expect(StationSchema.safeParse({ ...station, name }).success).toBe(false);
  });

  it("accepts a well-formed surrogate pair of an assigned character", () => {
    const name = "STATION \u{1D400}";
    expect(StationSchema.parse({ ...station, name }).name).toBe(name);
  });

  it("rejects an unknown field", () => {
    expect(StationSchema.safeParse({ ...station, department: "13" }).success).toBe(false);
  });
});
