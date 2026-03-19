import { z } from "zod";

export const createTeamSchema = z.object({
  eventId: z.string(),
  name: z.string().min(2, "Team name must be at least 2 characters."),
  leaderId: z.string(),
});

export const addMemberSchema = z.object({
  teamId: z.string(),
  userId: z.string(),
});

export const removeMemberSchema = z.object({
  teamId: z.string(),
  userId: z.string(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;