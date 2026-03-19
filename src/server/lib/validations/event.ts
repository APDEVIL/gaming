import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  gameName: z.string().min(2, "Game name must be at least 2 characters."),
  description: z.string().optional(),
  prize: z.string().optional(),
  teamSize: z.number().int().default(5),
  maxTeams: z.number().int().min(2, "There must be at least 2 teams."),
  leaderboardCriteria: z
    .enum(["points", "wins", "goal_difference"])
    .default("points"),
  registrationDeadline: z.date().optional(),
  startTime: z.date(),
  endTime: z.date(),
});

export const updateEventSchema = z.object({
  eventId: z.string(),
  title: z.string().min(3).optional(),
  gameName: z.string().min(2).optional(),
  description: z.string().optional(),
  prize: z.string().optional(),
  maxTeams: z.number().int().min(2).optional(),
  leaderboardCriteria: z
    .enum(["points", "wins", "goal_difference"])
    .optional(),
  registrationDeadline: z.date().optional(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  status: z
    .enum([
      "draft",
      "open",
      "registration_closed",
      "ongoing",
      "completed",
      "cancelled",
    ])
    .optional(),
});

export const declareWinnerSchema = z.object({
  eventId: z.string(),
  winnerTeamId: z.string(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type DeclareWinnerInput = z.infer<typeof declareWinnerSchema>;