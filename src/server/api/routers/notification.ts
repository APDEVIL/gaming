import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, lt } from "drizzle-orm";
import { nanoid } from "nanoid";

import { createTRPCRouter, protectedProcedure, managerProcedure } from "@/server/api/trpc";
import { notifications, participants, events } from "@/server/db/schema";

export const notificationRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.notifications.findMany({
      where: eq(notifications.userId, ctx.session.user.id),
      with: {
        event: {
          columns: { id: true, title: true, gameName: true },
        },
      },
      orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
    });
  }),

  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.db.query.notifications.findFirst({
        where: and(
          eq(notifications.id, input.notificationId),
          eq(notifications.userId, ctx.session.user.id),
        ),
      });

      if (!notification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found.",
        });
      }

      await ctx.db
        .update(notifications)
        .set({ isRead: true, readAt: new Date(), updatedAt: new Date() })
        .where(eq(notifications.id, input.notificationId));

      return { success: true };
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(notifications.userId, ctx.session.user.id),
          eq(notifications.isRead, false),
        ),
      );

    return { success: true, message: "All notifications marked as read." };
  }),

  expireDeadlines: managerProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.eventId),
      });

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Event not found.",
        });
      }

      if (event.managerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not the manager of this event.",
        });
      }

      if (!event.registrationDeadline) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This event does not have a registration deadline set.",
        });
      }

      if (event.registrationDeadline > new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The registration deadline has not passed yet.",
        });
      }

      await ctx.db
        .update(participants)
        .set({ status: "time_over", updatedAt: new Date() })
        .where(
          and(
            eq(participants.eventId, input.eventId),
            eq(participants.status, "pending"),
          ),
        );

      await ctx.db
        .update(notifications)
        .set({
          status: "time_over",
          title: "Registration deadline passed",
          message: `The registration deadline for "${event.title}" has passed.`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(notifications.eventId, input.eventId),
            eq(notifications.status, "pending"),
          ),
        );

      return {
        success: true,
        message: "All pending participants marked as time over.",
      };
    }),

  sendCustom: managerProcedure
    .input(
      z.object({
        eventId: z.string(),
        title: z.string().min(3, "Title must be at least 3 characters."),
        message: z.string().min(5, "Message must be at least 5 characters."),
        type: z.enum([
          "event_update",
          "event_cancelled",
          "registration_closing_soon",
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.eventId),
      });

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Event not found.",
        });
      }

      if (event.managerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not the manager of this event.",
        });
      }

      const acceptedParticipants = await ctx.db.query.participants.findMany({
        where: and(
          eq(participants.eventId, input.eventId),
          eq(participants.status, "accepted"),
        ),
      });

      if (acceptedParticipants.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There are no accepted participants to notify.",
        });
      }

      await ctx.db.insert(notifications).values(
        acceptedParticipants.map((p) => ({
          id: nanoid(),
          userId: p.userId,
          eventId: input.eventId,
          type: input.type,
          title: input.title,
          message: input.message,
        })),
      );

      return {
        success: true,
        message: `Notification sent to ${acceptedParticipants.length} participant(s).`,
      };
    }),
});