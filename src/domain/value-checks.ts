import type { z } from "zod";
import { hoursBetween } from "./instants.ts";
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

/** Adds an issue on `periodStart` when the period ends before it starts. */
export function checkPeriodOrder(
  ctx: z.RefinementCtx,
  period: { readonly periodStart: string; readonly periodEnd: string },
): void {
  if (hoursBetween(period.periodStart, period.periodEnd) < 0) {
    ctx.addIssue({
      code: "custom",
      path: ["periodStart"],
      message: "periodStart must not be after periodEnd",
    });
  }
}
