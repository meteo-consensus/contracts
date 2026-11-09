import { z } from "zod";
import { UtcInstantSchema } from "./forecast-model.ts";
import { GustSourceSchema, QualityCodeSchema } from "./observation.ts";
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
  /** When the change was detected, in UTC. */
  revisedAt: UtcInstantSchema,
};

/** A change of value or quality code of a stored observation, kept append-only. */
export const ObservationRevisionSchema = z
  .discriminatedUnion("variable", [
    z.strictObject({
      ...revisionBase,
      variable: VariableIdSchema.exclude(["wind_gusts_10m"]),
      gustSource: z.null(),
    }),
    z.strictObject({
      ...revisionBase,
      variable: z.literal("wind_gusts_10m"),
      gustSource: GustSourceSchema,
    }),
  ])
  .superRefine((revision, ctx) => {
    checkValueBounds(ctx, revision.variable, revision.oldValue, ["oldValue"]);
    checkValueBounds(ctx, revision.variable, revision.newValue, ["newValue"]);
  });

export type ObservationRevision = z.infer<typeof ObservationRevisionSchema>;
