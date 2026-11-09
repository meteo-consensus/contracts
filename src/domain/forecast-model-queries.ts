import type { ForecastModelDefinition, Grid, UtcInstant } from "./forecast-model.ts";

/*
 * Pure queries on catalogue entries. A `RangeError` here is a programmer error (a negative lead,
 * an invalid date), never an expected outcome: callers validate their inputs first.
 */

/** Native time step at a lead time, in hours, or `null` when the source does not give it. */
export function nativeStepAt(
  model: Pick<ForecastModelDefinition, "nativeSteps">,
  leadHours: number,
): number | null {
  if (!Number.isFinite(leadHours) || leadHours < 0) {
    throw new RangeError(`Lead time must be a finite number of hours >= 0, got ${leadHours}`);
  }
  const range = model.nativeSteps.find(
    ({ untilLeadHours }) => untilLeadHours === "open" || leadHours <= untilLeadHours,
  );
  return range?.stepHours ?? null;
}

/**
 * A grid period: runs between two grid changes. Scores never mix errors of two periods, even when
 * the grid of a period is unknown (`grid: null`).
 */
export interface GridPeriod {
  /** 0 for the base grid, then 1, 2… for each change in order. */
  readonly index: number;
  /** Initialisation time of the period's first run, or `"first_run"` for the base period. */
  readonly since: UtcInstant | "first_run";
  readonly grid: Grid | null;
}

/** Grid period of the run initialised at `runInitUtc`. */
export function gridPeriodAt(
  model: Pick<ForecastModelDefinition, "grid" | "gridChanges">,
  runInitUtc: Date,
): GridPeriod {
  const time = runInitUtc.getTime();
  if (Number.isNaN(time)) {
    throw new RangeError("Invalid run initialisation date");
  }
  let period: GridPeriod = { index: 0, since: "first_run", grid: model.grid };
  for (const [position, change] of model.gridChanges.entries()) {
    if (Date.parse(change.firstRunInitUtc) <= time) {
      period = { index: position + 1, since: change.firstRunInitUtc, grid: change.grid };
    }
  }
  return period;
}

/** Grid of the run initialised at `runInitUtc`, or `null` when that grid is not known yet. */
export function gridAt(
  model: Pick<ForecastModelDefinition, "grid" | "gridChanges">,
  runInitUtc: Date,
): Grid | null {
  return gridPeriodAt(model, runInitUtc).grid;
}

/** Number of independent votes among `models`: one per distinct provider family. */
export function countIndependentVotes(
  models: readonly Pick<ForecastModelDefinition, "providerFamily">[],
): number {
  return new Set(models.map(({ providerFamily }) => providerFamily)).size;
}
