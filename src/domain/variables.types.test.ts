import { describe, expectTypeOf, it } from "vitest";
import { type VariableDefinition, variableCatalogue } from "./variables.ts";

describe("variable catalogue types", () => {
  it("narrows each entry's id to its own key", () => {
    expectTypeOf(variableCatalogue.precipitation.id).toEqualTypeOf<"precipitation">();
    expectTypeOf(variableCatalogue.pressure_msl).toEqualTypeOf<
      VariableDefinition<"pressure_msl">
    >();
  });
});
