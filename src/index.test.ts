import { describe, expect, it } from "vitest";
import * as contracts from "./index.ts";

describe("package entry", () => {
  it("exposes the variable and forecast model catalogues, their schemas and helpers", () => {
    expect(Object.keys(contracts).sort()).toEqual(
      [
        "ForecastModelIdSchema",
        "TemporalSemanticsSchema",
        "VariableIdSchema",
        "countIndependentVotes",
        "forecastModelCatalogue",
        "forecastModelIds",
        "gridAt",
        "nativeStepAt",
        "openMeteoAttribution",
        "variableCatalogue",
        "variableIds",
        "variableValueSchema",
      ].sort(),
    );
  });
});
