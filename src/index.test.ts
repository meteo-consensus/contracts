import { describe, expect, it } from "vitest";
import * as contracts from "./index.ts";

describe("package entry", () => {
  it("exposes the variable catalogue and its schemas", () => {
    expect(Object.keys(contracts).sort()).toEqual([
      "TemporalSemanticsSchema",
      "VariableIdSchema",
      "variableCatalogue",
      "variableIds",
      "variableValueSchema",
    ]);
  });
});
