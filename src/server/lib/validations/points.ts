import { z } from "zod";

export const logMatchSchema = z.object({
  eventId: z.string(),
  teamAId: z.string(),
  teamBId: z.string(),
  teamAScore: z.number().int().min(0, "Score cannot be negative."),
  teamBScore: z.number().int().min(0, "Score cannot be negative."),
  matchNumber: z.number().int().min(1, "Match number must be at least 1."),
  playedAt: z.date().optional(),
});

export const overridePointsSchema = z.object({
  eventId: z.string(),
  teamId: z.string(),
  overridePoints: z.number().int().min(0, "Points cannot be negative."),
});

export type LogMatchInput = z.infer<typeof logMatchSchema>;
export type OverridePointsInput = z.infer<typeof overridePointsSchema>;