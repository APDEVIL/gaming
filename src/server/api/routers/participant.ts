import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
} from "@/server/api/trpc";
import { participants, events, notifications } from "@/server/db/schema";
import { checkTimeConflict } from "@/server/lib/utils/conflict-check";

export const participantRouter = createTRPCRouter({
  invite: managerProcedure
    .input(
      z.object({
        eventId: z.string(),
        userIds: z.array(z.string()).min(1, "Select at least one user to invite."),
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

      if (event.status !== "open") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitations can only be sent for open events.",
        });
      }

      if (event.registrationDeadline && event.registrationDeadline < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Registration deadline has passed for this event.",
        });
      }

      const existing = await ctx.db.query.participants.findMany({
        where: eq(participants.eventId, input.eventId),
      });

      const alreadyInvited = existing.map((p) => p.userId);
      const newInvites = input.userIds.filter(
        (id) => !alreadyInvited.includes(id),
      );

      if (newInvites.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "All selected users have already been invited to this event.",
        });
      }

      await ctx.db.insert(participants).values(
        newInvites.map((userId) => ({
          id: nanoid(),
          eventId: input.eventId,
          userId,
          status: "pending" as const,
        })),
      );

      await ctx.db.insert(notifications).values(
        newInvites.map((userId) => ({
          id: nanoid(),
          userId,
          eventId: input.eventId,
          type: "event_invite" as const,
          title: `You're invited to "${event.title}"`,
          message: `You have been invited to participate in "${event.title}". Please accept or reject before the deadline.`,
        })),
      );

      return {
        success: true,
        message: `${newInvites.length} invitation(s) sent successfully.`,
      };
    }),

  respond: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        status: z.enum(["accepted", "rejected"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const participant = await ctx.db.query.participants.findFirst({
        where: and(
          eq(participants.eventId, input.eventId),
          eq(participants.userId, ctx.session.user.id),
        ),
      });

      if (!participant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "You have not been invited to this event.",
        });
      }

      if (participant.status === "time_over") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The registration deadline has passed. You can no longer respond to this invitation.",
        });
      }

      if (
        participant.status === "accepted" ||
        participant.status === "rejected"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already responded to this invitation.",
        });
      }

      const event = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.eventId),
      });

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Event not found.",
        });
      }

      if (
        event.registrationDeadline &&
        event.registrationDeadline < new Date()
      ) {
        await ctx.db
          .update(participants)
          .set({ status: "time_over", updatedAt: new Date() })
          .where(eq(participants.id, participant.id));

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The registration deadline has passed. You can no longer respond to this invitation.",
        });
      }

      if (input.status === "accepted") {
        const hasConflict = await checkTimeConflict({
          db: ctx.db,
          userId: ctx.session.user.id,
          startTime: event.startTime,
          endTime: event.endTime,
          excludeEventId: input.eventId,
        });

        if (hasConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This event conflicts with another event you have already joined. Please leave the other event first.",
          });
        }
      }

      await ctx.db
        .update(participants)
        .set({
          status: input.status,
          respondedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(participants.id, participant.id));

      return {
        success: true,
        message:
          input.status === "accepted"
            ? "You have successfully joined the event."
            : "You have declined the invitation.",
      };
    }),

  leave: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const participant = await ctx.db.query.participants.findFirst({
        where: and(
          eq(participants.eventId, input.eventId),
          eq(participants.userId, ctx.session.user.id),
        ),
      });

      if (!participant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "You are not part of this event.",
        });
      }

      if (participant.status !== "accepted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can only leave an event you have accepted.",
        });
      }

      const event = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.eventId),
      });

      if (event?.status === "ongoing") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot leave an event that is currently ongoing.",
        });
      }

      await ctx.db
        .update(participants)
        .set({ status: "left", updatedAt: new Date() })
        .where(eq(participants.id, participant.id));

      return { success: true, message: "You have left the event." };
    }),

  removeFromList: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const participant = await ctx.db.query.participants.findFirst({
        where: and(
          eq(participants.eventId, input.eventId),
          eq(participants.userId, ctx.session.user.id),
        ),
      });

      if (!participant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This event was not found in your list.",
        });
      }

      if (participant.isRemovedFromList) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This event has already been removed from your list.",
        });
      }

      await ctx.db
        .update(participants)
        .set({ isRemovedFromList: true, updatedAt: new Date() })
        .where(eq(participants.id, participant.id));

      return {
        success: true,
        message: "Event removed from your list.",
      };
    }),

  getByEvent: managerProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
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

      return ctx.db.query.participants.findMany({
        where: eq(participants.eventId, input.eventId),
        with: {
          user: {
            columns: { id: true, name: true, email: true },
          },
        },
      });
    }),
});