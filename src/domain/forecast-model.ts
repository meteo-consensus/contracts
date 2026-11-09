import { z } from "zod";
import type { VariableId } from "./variables.ts";

/**
 * Internal ids of the collected forecast models. They are part of the public contract and are
 * not the Open-Meteo `models=` ids (that mapping lives in collector): never rename one, add a
 * new id instead. `icon_eu` covers ICON-EU before and after its switch to the native grid.
 */
export const forecastModelIds = Object.freeze([
  "arome_france",
  "arome_france_hd",
  "arpege_europe",
  "ecmwf_ifs",
  "icon_eu",
  "gfs",
] as const);

export type ForecastModelId = (typeof forecastModelIds)[number];

export const ForecastModelIdSchema = z.enum(forecastModelIds);

/** The organisation that runs the model and owns its data. */
export type ProviderId = "meteo_france" | "ecmwf" | "dwd" | "noaa_ncep";

/**
 * Models of one family share their dynamics and physics, so their errors are correlated: they
 * count as one independent vote in a consensus (AROME France and AROME France HD). A grid change
 * never changes the family.
 */
export type ProviderFamily =
  | "meteo_france_arome"
  | "meteo_france_arpege"
  | "ecmwf_ifs"
  | "dwd_icon"
  | "noaa_gfs";

/** Horizontal grid as stated by the source. `degrees` is `null` for non lat-lon grids. */
export interface Grid {
  readonly label: string;
  readonly degrees: number | null;
  readonly approxKm: number | null;
}

/** A dated grid change. `grid: null` means the new grid is not known yet (« à vérifier »). */
export interface GridChange {
  /** ISO 8601 instant in UTC from which the new grid applies. */
  readonly effectiveFromUtc: string;
  readonly grid: Grid | null;
}

/**
 * One range of lead times sharing a native time step. Ranges are ordered and contiguous from
 * lead 0; `untilLeadHours` is the inclusive upper bound, `null` for the last, open-ended range.
 * `stepHours: null` means the step is not known (« à vérifier »).
 */
export interface StepRange {
  readonly untilLeadHours: number | null;
  readonly stepHours: number | null;
}

/** Forecast length of one run. `approximate` is true when the source gives an approximate value. */
export interface Horizon {
  readonly hours: number;
  readonly approximate: boolean;
}

/** One daily run, by its initialisation hour in UTC. `horizon: null` means « à vérifier ». */
export interface RunCycle {
  readonly utcHour: number;
  readonly horizon: Horizon | null;
}

/** `name: null` when the source links a licence without naming it (« à vérifier »). */
export interface Licence {
  readonly name: string | null;
  readonly url: string;
}

export interface Provider {
  readonly id: ProviderId;
  readonly name: string;
  /** Credit line to show with the data; `null` until the owner sets it (« à vérifier »). */
  readonly credit: string | null;
  readonly licence: Licence;
}

/** Attribution of the distributor the data is fetched from, separate from the provider credit. */
export interface DistributorAttribution {
  readonly text: string;
  readonly url: string;
  readonly licence: Licence;
}

export interface ForecastModelDefinition<Id extends ForecastModelId = ForecastModelId> {
  readonly id: Id;
  readonly label: string;
  readonly provider: Provider;
  readonly providerFamily: ProviderFamily;
  /** Grid in effect before the first entry of `gridChanges`. */
  readonly grid: Grid;
  /** Dated grid changes in ascending order; empty when the grid never changed. */
  readonly gridChanges: readonly GridChange[];
  /** Daily runs in ascending UTC hour. */
  readonly cycles: readonly RunCycle[];
  /** Lead times collected, capped for every model (owner decision, 09/11/2026). */
  readonly horizonCollectedHours: 72;
  readonly nativeSteps: readonly StepRange[];
  /** Hours covered by one `wind_gusts_10m` value (its preceding-max window); `null` if unknown. */
  readonly gustWindowHours: number | null;
  /** Catalogued variables this model does not provide; `null` when not known (« à vérifier »). */
  readonly unavailableVariables: readonly VariableId[] | null;
  readonly distributorAttribution: DistributorAttribution;
}

/** Native time step at a lead time, in hours, or `null` when the source does not give it. */
export function nativeStepAt(
  model: Pick<ForecastModelDefinition, "nativeSteps">,
  leadHours: number,
): number | null {
  if (!Number.isFinite(leadHours) || leadHours < 0) {
    throw new RangeError(`Lead time must be a finite number of hours >= 0, got ${leadHours}`);
  }
  const range = model.nativeSteps.find(
    ({ untilLeadHours }) => untilLeadHours === null || leadHours <= untilLeadHours,
  );
  return range?.stepHours ?? null;
}

/** Grid in effect at `at`, or `null` when that grid is not known yet. */
export function gridAt(
  model: Pick<ForecastModelDefinition, "grid" | "gridChanges">,
  at: Date,
): Grid | null {
  const time = at.getTime();
  if (Number.isNaN(time)) {
    throw new RangeError("Invalid date");
  }
  let grid: Grid | null = model.grid;
  for (const change of model.gridChanges) {
    if (Date.parse(change.effectiveFromUtc) <= time) {
      grid = change.grid;
    }
  }
  return grid;
}

/** Number of independent votes among `models`: one per distinct provider family. */
export function countIndependentVotes(
  models: readonly Pick<ForecastModelDefinition, "providerFamily">[],
): number {
  return new Set(models.map(({ providerFamily }) => providerFamily)).size;
}
