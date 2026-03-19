import { z } from "zod";

export const inviteParticipantsSchema = z.object({
  eventId: z.string(),
  userIds: z.array(z.string()).min(1, "Select at least one user to invite."),
});

export const respondToInviteSchema = z.object({
  eventId: z.string(),
  status: z.enum(["accepted", "rejected"]),
});

export const leaveEventSchema = z.object({
  eventId: z.string(),
});

export const removeFromListSchema = z.object({
  eventId: z.string(),
});

export type InviteParticipantsInput = z.infer<typeof inviteParticipantsSchema>;
export type RespondToInviteInput = z.infer<typeof respondToInviteSchema>;
export type LeaveEventInput = z.infer<typeof leaveEventSchema>;
export type RemoveFromListInput = z.infer<typeof removeFromListSchema>;