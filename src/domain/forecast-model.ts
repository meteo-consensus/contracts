import { z } from "zod";
import type { VariableId } from "./variables.ts";

/*
 * Rule for the whole catalogue: `null` always means « unknown, à vérifier » (the source does not
 * give the value, or the owner has not decided it). It never means « not applicable »: that case
 * gets its own literal (`"open"`, `"first_run"`) or variant (`Grid["kind"]`).
 */

/**
 * Internal ids of the collected forecast models. They are part of the public contract and are
 * not the Open-Meteo `models=` ids (that mapping lives in collector): never rename one, add a
 * new id instead (a minor release with a changelog note). `icon_eu` covers ICON-EU before and
 * after its switch to the native grid.
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

/** The organisations that run the models and own their data. */
export const providerIds = Object.freeze(["meteo_france", "ecmwf", "dwd", "noaa_ncep"] as const);

export type ProviderId = (typeof providerIds)[number];

export const ProviderIdSchema = z.enum(providerIds);

/**
 * Models of one family share their dynamics and physics, so their errors are correlated: they
 * count as one independent vote in a consensus. AROME France and AROME France HD are the same
 * run on two output grids, never two opinions. A grid change never changes the family.
 *
 * AROME and ARPEGE are separate families, but their independence is only partial: AROME takes its
 * lateral boundary conditions from ARPEGE (citation à vérifier). The owner confirms this split
 * (5 independent votes for 6 models, against 4 if they were merged) before release 0.1.0.
 */
export const providerFamilies = Object.freeze([
  "meteo_france_arome",
  "meteo_france_arpege",
  "ecmwf_ifs",
  "dwd_icon",
  "noaa_gfs",
] as const);

export type ProviderFamily = (typeof providerFamilies)[number];

export const ProviderFamilySchema = z.enum(providerFamilies);

/**
 * Horizontal grid as labelled by the source; `approxKm` is the source's own approximate figure.
 * A reduced Gaussian grid has no single spacing in degrees.
 */
export type Grid =
  | {
      readonly kind: "lat_lon";
      readonly label: string;
      readonly degrees: number;
      readonly approxKm: number;
    }
  | { readonly kind: "reduced_gaussian"; readonly label: string; readonly approxKm: number };

/** ISO 8601 instant written in UTC to the second with a `Z` suffix, never with an offset. */
export type UtcInstant = `${string}Z`;

/** Validates a `UtcInstant` (`2026-11-30T00:00:00Z`): no offset, no fraction, no local time. */
export const UtcInstantSchema = z.iso.datetime({ precision: 0 });

/**
 * A dated grid change. A grid applies by run initialisation time: every lead of a run comes from
 * the grid in effect when that run was initialised, even leads valid after the change.
 */
export interface GridChange {
  /**
   * Stable id of the grid period this change opens (`"initial"` is reserved for the base grid).
   * Scores are keyed on it: it never changes, even if `firstRunInitUtc` is corrected.
   */
  readonly id: string;
  /**
   * Initialisation time of the first run on the new grid. Correcting it moves runs between
   * periods: it is a re-scoring event for the affected runs.
   */
  readonly firstRunInitUtc: UtcInstant;
  /** The new grid; `null` while it is not known (« à vérifier »). */
  readonly grid: Grid | null;
}

/**
 * One range of lead times sharing a native time step. Ranges are ordered and contiguous from
 * lead 0; `untilLeadHours` is the inclusive upper bound, `"open"` for the last range.
 * `stepHours: null` means the step is not known (« à vérifier »).
 */
export interface StepRange {
  readonly untilLeadHours: number | "open";
  readonly stepHours: number | null;
}

/**
 * Forecast length of one run, in hours (last lead). `basis` says whether this cycle's horizon was
 * observed at a source, or extrapolated from the observed cycles of the same model.
 */
export interface Horizon {
  readonly hours: number;
  readonly basis: "observed" | "extrapolated";
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
  /** Grid of the runs initialised before the first entry of `gridChanges`. */
  readonly grid: Grid;
  /** Dated grid changes in ascending order; empty when the grid never changed. */
  readonly gridChanges: readonly GridChange[];
  /** Daily runs in ascending UTC hour. */
  readonly cycles: readonly RunCycle[];
  /**
   * Lead times collected (owner decision, 09/11/2026: 72 h; a number, not a literal, so raising
   * the cap is not a breaking change). The effective cap of a run is the smaller of this value
   * and its cycle horizon. When the cycle horizon is unknown, so is the effective cap:
   * completeness is measured on the leads actually received, never against an assumed 72 h.
   */
  readonly horizonCollectedHours: number;
  readonly nativeSteps: readonly StepRange[];
  /**
   * Hours covered by one `wind_gusts_10m` value of this model (its preceding-max window). It
   * overrides the variable's catalogue semantics (`max_preceding_1h`). `null` means the window is
   * unknown: no gust pairing for this model (« données insuffisantes »), never the 1 h default.
   * One window per model is valid only within the 72 h cap: past it, native steps change.
   */
  readonly gustWindowHours: number | null;
  /** Catalogued variables this model does not provide; `null` when not known (« à vérifier »). */
  readonly unavailableVariables: readonly VariableId[] | null;
  readonly distributorAttribution: DistributorAttribution;
}
