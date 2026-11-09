import { describe, expect, it } from "vitest";
import {
  countIndependentVotes,
  type ForecastModelId,
  forecastModelIds,
  gridAt,
  nativeStepAt,
} from "./forecast-model.ts";
import { forecastModelCatalogue } from "./forecast-model-catalogue.ts";
import { openMeteoAttribution } from "./forecast-providers.ts";
import { VariableIdSchema } from "./variables.ts";

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

  it("gives AROME runs an approximate +52 h horizon and leaves the others unknown", () => {
    const arome: readonly ForecastModelId[] = ["arome_france", "arome_france_hd"];
    for (const model of models) {
      for (const cycle of model.cycles) {
        expect(cycle.horizon).toEqual(
          arome.includes(model.id) ? { hours: 52, approximate: true } : null,
        );
      }
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
    { id: "arome_france", lead: 52, step: 1 },
    { id: "arome_france_hd", lead: 52, step: 1 },
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
    expect(forecastModelCatalogue[id].gustWindowHours).toBe(window);
  });

  it("switches ICON-EU to an unknown native grid on 30/11/2026, in the same family", () => {
    const iconEu = forecastModelCatalogue.icon_eu;
    expect(gridAt(iconEu, new Date("2026-11-29T23:59:59Z"))).toEqual({
      label: "0.0625° (~7 km)",
      degrees: 0.0625,
      approxKm: 7,
    });
    expect(gridAt(iconEu, new Date("2026-11-30T00:00:00Z"))).toBeNull();
    expect(iconEu.providerFamily).toBe("dwd_icon");
  });

  it("records no grid change for the other models", () => {
    for (const model of models.filter(({ id }) => id !== "icon_eu")) {
      expect(model.gridChanges).toEqual([]);
    }
  });

  it("keeps cycles, step ranges and grid changes well-formed", () => {
    for (const model of models) {
      const hours = model.cycles.map(({ utcHour }) => utcHour);
      expect(hours).toEqual([...hours].sort((a, b) => a - b));
      expect(hours.every((hour) => Number.isInteger(hour) && hour >= 0 && hour < 24)).toBe(true);

      const bounds = model.nativeSteps.map(({ untilLeadHours }) => untilLeadHours);
      expect(bounds.at(-1)).toBeNull();
      const closed = bounds.slice(0, -1);
      expect(closed.every((bound) => bound !== null)).toBe(true);
      expect(closed).toEqual([...closed].sort((a, b) => Number(a) - Number(b)));

      const instants = model.gridChanges.map(({ effectiveFromUtc }) =>
        Date.parse(effectiveFromUtc),
      );
      expect(instants.every((instant) => !Number.isNaN(instant))).toBe(true);
      expect(instants).toEqual([...instants].sort((a, b) => a - b));
    }
  });

  it("only cites catalogued variables", () => {
    for (const model of models) {
      for (const variable of model.unavailableVariables ?? []) {
        expect(VariableIdSchema.safeParse(variable).success).toBe(true);
      }
    }
    expect(forecastModelCatalogue.arome_france_hd.unavailableVariables).toBeNull();
    expect(forecastModelCatalogue.ecmwf_ifs.unavailableVariables).toEqual([]);
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
    expect(Object.isFrozen(forecastModelIds)).toBe(true);
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
