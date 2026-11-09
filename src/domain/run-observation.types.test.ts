import { describe, expectTypeOf, it } from "vitest";
import type {
  ForecastValue,
  instantForecastVariables,
  periodForecastVariables,
} from "./forecast-value.ts";
import type { Observation } from "./observation.ts";
import type { ObservationRevision } from "./observation-revision.ts";
import type { VariableId } from "./variables.ts";

type InstantVariable = (typeof instantForecastVariables)[number];
type PeriodVariable = (typeof periodForecastVariables)[number];
type Has<T, K extends PropertyKey> = K extends keyof T ? true : false;

describe("inferred run and observation types", () => {
  it("splits every variable between instant and period forecast values", () => {
    expectTypeOf<InstantVariable | PeriodVariable>().toEqualTypeOf<VariableId>();
  });

  it("gives a period only to period forecast values", () => {
    type Period = Extract<ForecastValue, { variable: PeriodVariable }>;
    type Instant = Extract<ForecastValue, { variable: InstantVariable }>;
    expectTypeOf<Period["periodStart"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Has<Instant, "periodStart">>().toEqualTypeOf<false>();
  });

  it("narrows observation flags by variable and gust source", () => {
    type Fxi3s = Extract<Observation, { gustSource: "FXI3S" }>;
    type Fxi = Extract<Observation, { gustSource: "FXI" }>;
    type Wind = Extract<Observation, { variable: "wind_speed_10m" | "wind_direction_10m" }>;
    type Cloud = Extract<Observation, { variable: "cloud_cover" }>;
    expectTypeOf<Fxi3s["fxi3sComputed"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Has<Fxi, "fxi3sComputed">>().toEqualTypeOf<false>();
    expectTypeOf<Wind["periodUnverified"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Cloud["skyObscured"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Observation["quality"]>().toEqualTypeOf<0 | 1 | 2 | 9 | null>();
  });

  it("keys a revision by its gust source, null outside gusts", () => {
    type Gust = Extract<ObservationRevision, { variable: "wind_gusts_10m" }>;
    type Other = Exclude<ObservationRevision, Gust>;
    expectTypeOf<Other["gustSource"]>().toEqualTypeOf<null>();
    expectTypeOf<Gust["gustSource"]>().toEqualTypeOf<"FXI3S" | "FXI">();
  });
});
