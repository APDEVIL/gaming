import { z } from "zod";

export const markAsReadSchema = z.object({
  notificationId: z.string(),
});

export const sendCustomNotificationSchema = z.object({
  eventId: z.string(),
  title: z.string().min(3, "Title must be at least 3 characters."),
  message: z.string().min(5, "Message must be at least 5 characters."),
  type: z.enum([
    "event_update",
    "event_cancelled",
    "registration_closing_soon",
  ]),
});

export const expireDeadlinesSchema = z.object({
  eventId: z.string(),
});

export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;
export type SendCustomNotificationInput = z.infer<typeof sendCustomNotificationSchema>;
export type ExpireDeadlinesInput = z.infer<typeof expireDeadlinesSchema>;