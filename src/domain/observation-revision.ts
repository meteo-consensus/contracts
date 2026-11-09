import { z } from "zod";
import { UtcInstantSchema } from "./forecast-model.ts";
import { minutesBetween } from "./instants.ts";
import { QualityCodeSchema } from "./observation.ts";
import { NumPosteSchema } from "./station.ts";
import { checkValueBounds } from "./value-checks.ts";
import { VariableIdSchema } from "./variables.ts";

/**
 * Fields shared by every revision. The observation is identified by its logical key (station,
 * period end, variable, gust source), not by a row id. Values and quality codes are nullable
 * on both sides: a value or a Q can appear or vanish in a revised source file.
 */
const revisionBase = {
  numPoste: NumPosteSchema,
  periodEnd: UtcInstantSchema,
  oldValue: z.number().nullable(),
  newValue: z.number().nullable(),
  oldQuality: QualityCodeSchema,
  newQuality: QualityCodeSchema,
  /** When the change was detected, in UTC; never before the end of the observed period. */
  revisedAt: UtcInstantSchema,
};

/**
 * A change of value, quality code, FXI3S status or obscured sky flag of a stored observation,
 * kept append-only. A revision that changes nothing is rejected. `periodUnverified` is not
 * revised here: it is set by `collector` rules. The flags follow the observation rules on each
 * side: `oldFxi3sComputed` and `newFxi3sComputed` are `null` exactly when the matching value is
 * missing; `oldSkyObscured` and `newSkyObscured` (cloud cover only) being `true` require a
 * missing value. An empty `N` that becomes `N=9` keeps `null` values and is a revision through
 * its flag.
 */
export const ObservationRevisionSchema = z
  .discriminatedUnion("variable", [
    z.strictObject({
      ...revisionBase,
      variable: VariableIdSchema.exclude(["wind_gusts_10m", "cloud_cover"]),
      gustSource: z.null(),
    }),
    z.strictObject({
      ...revisionBase,
      variable: z.literal("cloud_cover"),
      gustSource: z.null(),
      oldSkyObscured: z.boolean(),
      newSkyObscured: z.boolean(),
    }),
    z.discriminatedUnion("gustSource", [
      z.strictObject({
        ...revisionBase,
        variable: z.literal("wind_gusts_10m"),
        gustSource: z.literal("FXI3S"),
        oldFxi3sComputed: z.boolean().nullable(),
        newFxi3sComputed: z.boolean().nullable(),
      }),
      z.strictObject({
        ...revisionBase,
        variable: z.literal("wind_gusts_10m"),
        gustSource: z.literal("FXI"),
      }),
    ]),
  ])
  .superRefine((revision, ctx) => {
    checkValueBounds(ctx, revision.variable, revision.oldValue, ["oldValue"]);
    checkValueBounds(ctx, revision.variable, revision.newValue, ["newValue"]);
    if (minutesBetween(revision.periodEnd, revision.revisedAt) < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["revisedAt"],
        message: "revisedAt is before periodEnd",
      });
    }
    checkFxi3sStatus(ctx, revision);
    checkSkyObscured(ctx, revision);
    if (!changesSomething(revision)) {
      ctx.addIssue({ code: "custom", path: [], message: "a revision must change something" });
    }
  });

export type ObservationRevision = z.infer<typeof ObservationRevisionSchema>;

function changesSomething(revision: ObservationRevision): boolean {
  const statusChanged =
    "oldFxi3sComputed" in revision && revision.oldFxi3sComputed !== revision.newFxi3sComputed;
  const skyChanged =
    "oldSkyObscured" in revision && revision.oldSkyObscured !== revision.newSkyObscured;
  return (
    revision.oldValue !== revision.newValue ||
    revision.oldQuality !== revision.newQuality ||
    statusChanged ||
    skyChanged
  );
}

function checkFxi3sStatus(ctx: z.RefinementCtx, revision: ObservationRevision): void {
  if (!("oldFxi3sComputed" in revision)) {
    return;
  }
  const sides = [
    ["oldFxi3sComputed", revision.oldFxi3sComputed, revision.oldValue],
    ["newFxi3sComputed", revision.newFxi3sComputed, revision.newValue],
  ] as const;
  for (const [key, status, value] of sides) {
    if ((status === null) !== (value === null)) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `${key} is null exactly when the value is missing`,
      });
    }
  }
}

function checkSkyObscured(ctx: z.RefinementCtx, revision: ObservationRevision): void {
  if (!("oldSkyObscured" in revision)) {
    return;
  }
  const sides = [
    ["oldSkyObscured", revision.oldSkyObscured, revision.oldValue],
    ["newSkyObscured", revision.newSkyObscured, revision.newValue],
  ] as const;
  for (const [key, obscured, value] of sides) {
    if (obscured && value !== null) {
      ctx.addIssue({ code: "custom", path: [key], message: "an obscured sky has no value" });
    }
  }
}
