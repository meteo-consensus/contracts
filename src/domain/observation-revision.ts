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
 * A change of value, quality code or FXI3S status of a stored observation, kept append-only.
 * A revision that changes nothing is rejected. `periodUnverified` and `skyObscured` are not
 * revised here: the first is set by `collector` rules, the second follows the value.
 * `oldFxi3sComputed` and `newFxi3sComputed` follow the observation rule: `null` exactly when the
 * matching value is missing.
 */
export const ObservationRevisionSchema = z
  .discriminatedUnion("variable", [
    z.strictObject({
      ...revisionBase,
      variable: VariableIdSchema.exclude(["wind_gusts_10m"]),
      gustSource: z.null(),
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
    if (!changesSomething(revision)) {
      ctx.addIssue({ code: "custom", path: [], message: "a revision must change something" });
    }
  });

export type ObservationRevision = z.infer<typeof ObservationRevisionSchema>;

function changesSomething(revision: ObservationRevision): boolean {
  const statusChanged =
    "oldFxi3sComputed" in revision && revision.oldFxi3sComputed !== revision.newFxi3sComputed;
  return (
    revision.oldValue !== revision.newValue ||
    revision.oldQuality !== revision.newQuality ||
    statusChanged
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
