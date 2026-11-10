import { describe, expect, it } from "vitest";
import { providerIds } from "./forecast-model.ts";
import { openMeteoApiHosts, openMeteoAttribution, providers } from "./forecast-providers.ts";

describe("forecast providers", () => {
  it("defines every provider, keyed by its own id", () => {
    expect(Object.keys(providers).sort()).toEqual([...providerIds].sort());
    for (const id of providerIds) {
      expect(providers[id].id).toBe(id);
    }
  });

  it("credits Météo-France as the owner decided", () => {
    expect(providers.meteo_france.credit).toEqual({
      kind: "required",
      unmodified: { text: "Données Météo-France", notices: [] },
      derived: null,
    });
  });

  it("credits ECMWF with the wording its terms of use attach to services", () => {
    expect(providers.ecmwf.credit).toEqual({
      kind: "required",
      unmodified: {
        text: "This service is based on data and products of the European Centre for Medium-Range Weather Forecasts (ECMWF)",
        notices: [
          { kind: "source", text: "Source www.ecmwf.int", url: "https://www.ecmwf.int" },
          {
            kind: "licence",
            text: "This ECMWF data is published under a Creative Commons Attribution 4.0 International (CC BY 4.0).",
            url: "https://creativecommons.org/licenses/by/4.0/",
          },
          {
            kind: "disclaimer",
            text: "ECMWF does not accept any liability whatsoever for any error or omission in the data, their availability, or for any loss or damage arising from their use.",
          },
        ],
      },
      derived: null,
    });
  });

  it("credits DWD with its text source note for unmodified values", () => {
    expect(providers.dwd.credit).toEqual({
      kind: "required",
      unmodified: { text: "Quelle: Deutscher Wetterdienst", notices: [] },
      derived: null,
    });
  });

  it("leaves every derived wording to the owner (à vérifier)", () => {
    for (const id of providerIds) {
      const { credit } = providers[id];
      if (credit?.kind === "required") {
        expect(credit.derived).toBeNull();
      }
    }
  });

  it("records that NOAA requires no credit line", () => {
    expect(providers.noaa_ncep.credit).toEqual({ kind: "not_required" });
  });

  it.each([
    { id: "meteo_france", name: "Licence Ouverte / Etalab 2.0" },
    { id: "ecmwf", name: "CC BY 4.0" },
    { id: "dwd", name: "CC BY 4.0" },
    { id: "noaa_ncep", name: "Public domain" },
  ] as const)("licenses $id data under $name", ({ id, name }) => {
    expect(providers[id].licence.name).toBe(name);
    expect(providers[id].licence.url).toMatch(/^https:\/\//);
  });

  it("is read-only all the way down", () => {
    expect(Object.isFrozen(providers)).toBe(true);
    expect(Object.isFrozen(openMeteoAttribution)).toBe(true);
    for (const id of providerIds) {
      expect(Object.isFrozen(providers[id])).toBe(true);
      expect(Object.isFrozen(providers[id].credit)).toBe(true);
      const { credit } = providers[id];
      if (credit?.kind === "required") {
        expect(Object.isFrozen(credit.unmodified.notices)).toBe(true);
        expect(credit.unmodified.notices.every((notice) => Object.isFrozen(notice))).toBe(true);
      }
      expect(Object.isFrozen(providers[id].licence)).toBe(true);
    }
  });

  it("lists the Open-Meteo API hosts read on its documentation, frozen", () => {
    expect(openMeteoApiHosts).toEqual(["api.open-meteo.com", "customer-api.open-meteo.com"]);
    expect(Object.isFrozen(openMeteoApiHosts)).toBe(true);
  });
});
