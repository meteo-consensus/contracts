import { describe, expectTypeOf, it } from "vitest";
import type { ForecastModelDefinition } from "./forecast-model.ts";
import { forecastModelCatalogue } from "./forecast-model-catalogue.ts";

describe("forecast model catalogue types", () => {
  it("narrows each entry's id to its own key", () => {
    expectTypeOf(forecastModelCatalogue.icon_eu.id).toEqualTypeOf<"icon_eu">();
    expectTypeOf(forecastModelCatalogue.gfs).toEqualTypeOf<ForecastModelDefinition<"gfs">>();
  });

  it("caps the collected horizon at 72 hours in the type", () => {
    expectTypeOf(forecastModelCatalogue.ecmwf_ifs.horizonCollectedHours).toEqualTypeOf<72>();
  });
});
