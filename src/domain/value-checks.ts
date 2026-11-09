import type { z } from "zod";
import { minutesBetween } from "./instants.ts";
import { type VariableId, variableValueSchema } from "./variables.ts";

/** Adds an issue at `path` when `value` is outside the bounds of `variable` (null passes). */
export function checkValueBounds(
  ctx: z.RefinementCtx,
  variable: VariableId,
  value: number | null,
  path: readonly PropertyKey[],
): void {
  if (!variableValueSchema(variable).safeParse(value).success) {
    ctx.addIssue({
      code: "custom",
      path: [...path],
      message: `value out of the bounds of ${variable}`,
    });
  }
}

/** Adds an issue on `periodStart` unless the period lasts exactly `minutes`. */
export function checkPeriodLength(
  ctx: z.RefinementCtx,
  period: { readonly periodStart: string; readonly periodEnd: string },
  minutes: number,
): void {
  if (minutesBetween(period.periodStart, period.periodEnd) !== minutes) {
    ctx.addIssue({
      code: "custom",
      path: ["periodStart"],
      message: `the period must last exactly ${minutes} min`,
    });
  }
}
