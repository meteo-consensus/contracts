import { describe, expect, it } from "vitest";
import { forecastModelIds, UtcInstantSchema } from "./forecast-model.ts";
import { forecastModelCatalogue, lastLeadFromDataEnd } from "./forecast-model-catalogue.ts";
import {
  countIndependentVotes,
  gridAt,
  gridPeriodAt,
  gustWindowOf,
  nativeStepAt,
} from "./forecast-model-queries.ts";
import { openMeteoAttribution } from "./forecast-providers.ts";
import { VariableIdSchema, variableCatalogue } from "./variables.ts";

const models = forecastModelIds.map((id) => forecastModelCatalogue[id]);

describe("forecast model catalogue", () => {
  it("contains exactly the six collected models, keyed by their own id", () => {
    expect([...forecastModelIds].sort()).toEqual(
      ["arome_france", "arome_france_hd", "arpege_europe", "ecmwf_ifs", "gfs", "icon_eu"].sort(),
    );
    expect(Object.keys(forecastModelCatalogue).sort()).toEqual([...forecastModelIds].sort());
    for (const id of forecastModelIds) {
      expect(forecastModelCatalogue[id].id).toBe(id);
    }
  });

  it.each([
    { id: "arome_france", provider: "meteo_france", family: "meteo_france_arome" },
    { id: "arome_france_hd", provider: "meteo_france", family: "meteo_france_arome" },
    { id: "arpege_europe", provider: "meteo_france", family: "meteo_france_arpege" },
    { id: "ecmwf_ifs", provider: "ecmwf", family: "ecmwf_ifs" },
    { id: "icon_eu", provider: "dwd", family: "dwd_icon" },
    { id: "gfs", provider: "noaa_ncep", family: "noaa_gfs" },
  ] as const)("runs $id by $provider in the $family family", ({ id, provider, family }) => {
    expect(forecastModelCatalogue[id].provider.id).toBe(provider);
    expect(forecastModelCatalogue[id].providerFamily).toBe(family);
  });

  it("counts AROME France and AROME France HD as one independent vote", () => {
    const { arome_france, arome_france_hd } = forecastModelCatalogue;
    expect(countIndependentVotes([arome_france, arome_france_hd])).toBe(1);
    expect(countIndependentVotes(models)).toBe(5);
  });

  it("collects 72 hours of every model", () => {
    for (const model of models) {
      expect(model.horizonCollectedHours).toBe(72);
    }
  });

  it.each([
    { id: "arome_france", hours: [0, 3, 6, 9, 12, 15, 18, 21] },
    { id: "arome_france_hd", hours: [0, 3, 6, 9, 12, 15, 18, 21] },
    { id: "arpege_europe", hours: [0, 6, 12, 18] },
    { id: "ecmwf_ifs", hours: [0, 6, 12, 18] },
    { id: "icon_eu", hours: [0, 3, 6, 9, 12, 15, 18, 21] },
    { id: "gfs", hours: [0, 6, 12, 18] },
  ] as const)("runs $id at $hours UTC", ({ id, hours }) => {
    expect(forecastModelCatalogue[id].cycles.map(({ utcHour }) => utcHour)).toEqual(hours);
  });

  it("reads the last lead as the hour before the metadata data_end_time", () => {
    // 09 UTC AROME run of 09/11/2026: data_end_time is the first hour after the last step.
    expect(lastLeadFromDataEnd(1794214800, 1794402000)).toBe(51);
  });

  it.each([
    { init: 1794214800, end: 1794214800 },
    { init: 1794214800, end: 1794211200 },
    { init: 1794214800, end: 1794402030 },
    { init: 1794214801, end: 1794402000 },
  ])("rejects metadata init $init and end $end", ({ init, end }) => {
    expect(() => lastLeadFromDataEnd(init, end)).toThrow(RangeError);
  });

  it.each([
    { id: "arome_france", observed: [9] },
    { id: "arome_france_hd", observed: [6, 9] },
  ] as const)("gives $id a +51 h horizon, observed at $observed UTC", ({ id, observed }) => {
    for (const { utcHour, horizon } of forecastModelCatalogue[id].cycles) {
      const basis = (observed as readonly number[]).includes(utcHour) ? "observed" : "extrapolated";
      expect(horizon).toEqual({ hours: 51, basis });
    }
  });

  it("leaves the horizon of the other models unknown", () => {
    const others = models.filter(({ providerFamily }) => providerFamily !== "meteo_france_arome");
    for (const model of others) {
      expect(model.cycles.every(({ horizon }) => horizon === null)).toBe(true);
    }
  });

  it.each([
    { lead: 90, step: 1 },
    { lead: 93, step: 3 },
    { lead: 144, step: 3 },
    { lead: 150, step: 6 },
  ])("gives ECMWF IFS a native step of $step h at lead $lead h", ({ lead, step }) => {
    expect(nativeStepAt(forecastModelCatalogue.ecmwf_ifs, lead)).toBe(step);
  });

  it.each([
    { id: "arome_france", lead: 51, step: 1 },
    { id: "arome_france_hd", lead: 51, step: 1 },
    { id: "arpege_europe", lead: 72, step: 1 },
    { id: "arpege_europe", lead: 73, step: null },
    { id: "icon_eu", lead: 78, step: 1 },
    { id: "icon_eu", lead: 79, step: 3 },
    { id: "gfs", lead: 120, step: 1 },
    { id: "gfs", lead: 123, step: 3 },
  ] as const)("gives $id a native step of $step h at lead $lead h", ({ id, lead, step }) => {
    expect(nativeStepAt(forecastModelCatalogue[id], lead)).toBe(step);
  });

  it.each([
    { id: "arome_france", window: 1 },
    { id: "arome_france_hd", window: null },
    { id: "arpege_europe", window: 1 },
    { id: "ecmwf_ifs", window: 3 },
    { id: "icon_eu", window: 1 },
    { id: "gfs", window: null },
  ] as const)("gives $id a gust window of $window h", ({ id, window }) => {
    expect(gustWindowOf(forecastModelCatalogue[id])).toBe(window);
  });

  it("keeps the 0.0625° grid for the ICON-EU run of 29/11 21 UTC, all leads included", () => {
    const iconEu = forecastModelCatalogue.icon_eu;
    expect(gridAt(iconEu, new Date("2026-11-29T21:00:00Z"))).toEqual({
      kind: "lat_lon",
      label: "0.0625° (~7 km)",
      degrees: 0.0625,
      approxKm: 7,
    });
  });

  it("opens a new ICON-EU grid period, grid unknown, from the run of 30/11 00 UTC", () => {
    const iconEu = forecastModelCatalogue.icon_eu;
    expect(gridPeriodAt(iconEu, new Date("2026-11-29T21:00:00Z")).id).toBe("initial");
    expect(gridPeriodAt(iconEu, new Date("2026-11-30T00:00:00Z"))).toEqual({
      id: "icon_eu_native_2026",
      since: "2026-11-30T00:00:00Z",
      grid: null,
    });
    expect(iconEu.providerFamily).toBe("dwd_icon");
  });

  it("records no grid change for the other models", () => {
    for (const model of models.filter(({ id }) => id !== "icon_eu")) {
      expect(model.gridChanges).toEqual([]);
    }
  });

  it("writes grid changes as strictly ascending UTC instants, with unique stable ids", () => {
    for (const model of models) {
      const times = model.gridChanges.map(({ firstRunInitUtc }) =>
        Date.parse(UtcInstantSchema.parse(firstRunInitUtc)),
      );
      for (const [position, time] of times.entries()) {
        expect(time).toBeGreaterThan(times[position - 1] ?? Number.NEGATIVE_INFINITY);
      }
      const ids = model.gridChanges.map(({ id }) => id);
      expect(new Set([...ids, "initial"]).size).toBe(ids.length + 1);
    }
  });

  it("keeps cycles and step ranges well-formed", () => {
    for (const model of models) {
      const hours = model.cycles.map(({ utcHour }) => utcHour);
      expect(hours).toEqual([...hours].sort((a, b) => a - b));
      expect(hours.every((hour) => Number.isInteger(hour) && hour >= 0 && hour < 24)).toBe(true);

      const bounds = model.nativeSteps.map(({ untilLeadHours }) => untilLeadHours);
      expect(bounds.at(-1)).toBe("open");
      const closed = bounds.slice(0, -1);
      expect(closed.every((bound) => typeof bound === "number")).toBe(true);
      expect(closed).toEqual([...closed].sort((a, b) => Number(a) - Number(b)));
    }
  });

  it("only cites catalogued variables", () => {
    const cited = models.flatMap((model) => [
      ...(model.unavailableVariables ?? []),
      // gustWindowHours qualifies this variable
      ...(model.gustWindowHours === null ? [] : ["wind_gusts_10m"]),
    ]);
    expect(cited.length).toBeGreaterThan(0);
    for (const variable of cited) {
      expect(VariableIdSchema.safeParse(variable).success).toBe(true);
    }
    expect(variableCatalogue.wind_gusts_10m.temporal).toBe("max_preceding_1h");
  });

  it("does not know which variables AROME France HD lacks", () => {
    expect(forecastModelCatalogue.arome_france_hd.unavailableVariables).toBeNull();
  });

  it("keeps the Open-Meteo attribution separate from the provider credit", () => {
    expect(openMeteoAttribution).toEqual({
      text: "Weather data by Open-Meteo.com",
      url: "https://open-meteo.com/",
      licence: { name: "CC BY 4.0", url: "https://open-meteo.com/en/licence" },
    });
    for (const model of models) {
      expect(model.distributorAttribution).toBe(openMeteoAttribution);
      expect(model.provider.licence.url).toMatch(/^https:\/\//);
    }
    expect(forecastModelCatalogue.arome_france.provider.credit).toBe("Données Météo-France");
  });

  it("is read-only all the way down", () => {
    expect(Object.isFrozen(forecastModelCatalogue)).toBe(true);
    expect(Object.isFrozen(openMeteoAttribution.licence)).toBe(true);
    for (const model of models) {
      expect(Object.isFrozen(model)).toBe(true);
      expect(Object.isFrozen(model.provider.licence)).toBe(true);
      expect(Object.isFrozen(model.cycles)).toBe(true);
      expect(model.cycles.every((cycle) => Object.isFrozen(cycle))).toBe(true);
      expect(Object.isFrozen(model.nativeSteps)).toBe(true);
      expect(Object.isFrozen(model.gridChanges)).toBe(true);
      expect(Object.isFrozen(model.grid)).toBe(true);
    }
  });
});
