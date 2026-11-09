import { describe, expectTypeOf, it } from "vitest";
import { type VariableCatalogue, type VariableDefinition, variableCatalogue } from "./variables.ts";

describe("variable catalogue types", () => {
  it("narrows each entry's id to its own key", () => {
    expectTypeOf(variableCatalogue.precipitation.id).toEqualTypeOf<"precipitation">();
    expectTypeOf(variableCatalogue.pressure_msl).toEqualTypeOf<
      VariableDefinition<"pressure_msl">
    >();
  });

  it("rejects a definition filed under another variable's key", () => {
    const precipitation: VariableDefinition<"precipitation"> = variableCatalogue.precipitation;
    const misfiled: VariableCatalogue = {
      ...variableCatalogue,
      // @ts-expect-error a precipitation definition cannot sit under the pressure_msl key
      pressure_msl: precipitation,
    };
    expectTypeOf(misfiled.pressure_msl.id).toEqualTypeOf<"pressure_msl">();
  });
});
