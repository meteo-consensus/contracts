import { describe, expect, it } from "vitest";
import {
  TemporalSemanticsSchema,
  VariableIdSchema,
  variableCatalogue,
  variableIds,
  variableValueSchema,
} from "./variables.ts";

describe("variable catalogue", () => {
  it("contains exactly the eight collected variables", () => {
    expect([...variableIds].sort()).toEqual(
      [
        "cloud_cover",
        "precipitation",
        "pressure_msl",
        "relative_humidity_2m",
        "temperature_2m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "wind_speed_10m",
      ].sort(),
    );
    expect(Object.keys(variableCatalogue).sort()).toEqual([...variableIds].sort());
  });

  it("keys every definition by its own id", () => {
    for (const id of variableIds) {
      expect(variableCatalogue[id].id).toBe(id);
    }
  });

  it.each([
    { id: "temperature_2m", unit: "°C", heightM: 2, temporal: "instant" },
    { id: "relative_humidity_2m", unit: "%", heightM: 2, temporal: "instant" },
    { id: "precipitation", unit: "mm", heightM: 0, temporal: "sum_preceding_1h" },
    { id: "wind_speed_10m", unit: "m/s", heightM: 10, temporal: "instant" },
    { id: "wind_direction_10m", unit: "°", heightM: 10, temporal: "instant" },
    { id: "wind_gusts_10m", unit: "m/s", heightM: 10, temporal: "max_preceding_1h" },
    { id: "cloud_cover", unit: "%", heightM: null, temporal: "instant" },
    { id: "pressure_msl", unit: "hPa", heightM: null, temporal: "instant" },
  ] as const)("defines $id in $unit, $temporal", ({ id, unit, heightM, temporal }) => {
    const definition = variableCatalogue[id];
    expect(definition.unit).toBe(unit);
    expect(definition.heightM).toBe(heightM);
    expect(definition.temporal).toBe(temporal);
  });

  it.each([
    { id: "relative_humidity_2m", min: 0, max: 100 },
    { id: "cloud_cover", min: 0, max: 100 },
    { id: "wind_direction_10m", min: 0, max: 360 },
  ] as const)("bounds $id by its definition to [$min, $max]", ({ id, min, max }) => {
    expect(variableCatalogue[id].bounds).toEqual({ min, max });
  });

  it("gives every variable a non-empty interval and a known temporal semantics", () => {
    for (const id of variableIds) {
      const { bounds, temporal } = variableCatalogue[id];
      expect(bounds.min).toBeLessThan(bounds.max);
      expect(TemporalSemanticsSchema.safeParse(temporal).success).toBe(true);
    }
  });

  it("is read-only all the way down", () => {
    expect(Object.isFrozen(variableIds)).toBe(true);
    expect(Object.isFrozen(variableCatalogue)).toBe(true);
    for (const id of variableIds) {
      expect(Object.isFrozen(variableCatalogue[id])).toBe(true);
      expect(Object.isFrozen(variableCatalogue[id].bounds)).toBe(true);
    }
  });
});

describe("VariableIdSchema", () => {
  it("accepts a catalogued id", () => {
    expect(VariableIdSchema.parse("pressure_msl")).toBe("pressure_msl");
  });

  it.each(["snowfall", "Temperature_2m", "", 2])("rejects the unknown id %j", (id) => {
    expect(VariableIdSchema.safeParse(id).success).toBe(false);
  });
});

describe("TemporalSemanticsSchema", () => {
  it("lists the four temporal semantics", () => {
    expect(TemporalSemanticsSchema.options).toEqual([
      "instant",
      "sum_preceding_1h",
      "max_preceding_1h",
      "mean_preceding_10min",
    ]);
  });
});

describe("variableValueSchema", () => {
  it("accepts null as a missing value", () => {
    expect(variableValueSchema("precipitation").parse(null)).toBeNull();
  });

  it("accepts zero precipitation", () => {
    expect(variableValueSchema("precipitation").parse(0)).toBe(0);
  });

  it("rejects negative precipitation", () => {
    expect(variableValueSchema("precipitation").safeParse(-0.1).success).toBe(false);
  });

  it("accepts both bounds and rejects values just outside them", () => {
    for (const id of variableIds) {
      const { min, max } = variableCatalogue[id].bounds;
      const schema = variableValueSchema(id);
      expect(schema.safeParse(min).success).toBe(true);
      expect(schema.safeParse(max).success).toBe(true);
      expect(schema.safeParse(min - 0.1).success).toBe(false);
      expect(schema.safeParse(max + 0.1).success).toBe(false);
    }
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, "12", undefined])(
    "rejects the non-number %j",
    (value) => {
      expect(variableValueSchema("temperature_2m").safeParse(value).success).toBe(false);
    },
  );
});
