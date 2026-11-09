import { describe, expect, it } from "vitest";
import * as contracts from "./index.ts";

describe("package entry", () => {
  it("exposes the catalogues, the run, station and observation schemas and their helpers", () => {
    expect(Object.keys(contracts).sort()).toEqual(
      [
        "CellSelectionSchema",
        "ElevationMSchema",
        "ForecastModelIdSchema",
        "ForecastPointSchema",
        "ForecastRunSchema",
        "ForecastValueSchema",
        "GustSourceSchema",
        "LatitudeSchema",
        "LeadTimeBandSchema",
        "LongitudeSchema",
        "MAX_LEAD_TIME_H",
        "NumPosteSchema",
        "ObservationRevisionSchema",
        "ObservationSchema",
        "QualityCodeSchema",
        "SourceApiSchema",
        "StationNetworkSchema",
        "StationSchema",
        "instantForecastVariables",
        "leadTimeBandIds",
        "leadTimeBandOf",
        "periodForecastVariables",
        "ProviderFamilySchema",
        "ProviderIdSchema",
        "TemporalSemanticsSchema",
        "UtcInstantSchema",
        "VariableIdSchema",
        "countIndependentVotes",
        "forecastModelCatalogue",
        "forecastModelIds",
        "gridAt",
        "gridPeriodAt",
        "gustWindowOf",
        "nativeStepAt",
        "openMeteoAttribution",
        "providerFamilies",
        "providerIds",
        "variableCatalogue",
        "variableIds",
        "variableValueSchema",
      ].sort(),
    );
  });
});
