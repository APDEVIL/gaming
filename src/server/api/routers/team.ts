import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
} from "@/server/api/trpc";
import { teams, teamMembers, events, participants, users, teamPoints } from "@/server/db/schema";

export const teamRouter = createTRPCRouter({
  create: managerProcedure
    .input(
      z.object({
        eventId: z.string(),
        name: z.string().min(2, "Team name must be at least 2 characters."),
        leaderId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db
        .select()
        .from(events)
        .where(eq(events.id, input.eventId))
        .then((rows) => rows[0]);

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

      const existingTeams = await ctx.db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.eventId, input.eventId));

      if (existingTeams.length >= event.maxTeams) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This event has reached the maximum number of teams (${event.maxTeams}).`,
        });
      }

      const leaderParticipation = await ctx.db
        .select()
        .from(participants)
        .where(
          and(
            eq(participants.eventId, input.eventId),
            eq(participants.userId, input.leaderId),
          ),
        )
        .then((rows) => rows[0]);

      if (!leaderParticipation || leaderParticipation.status !== "accepted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The team leader must be an accepted participant of this event.",
        });
      }

      const [team] = await ctx.db
        .insert(teams)
        .values({
          id: nanoid(),
          name: input.name,
          eventId: input.eventId,
          leaderId: input.leaderId,
        })
        .returning();

      if (!team) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create team. Please try again.",
        });
      }

      await ctx.db.insert(teamMembers).values({
        teamId: team.id,
        userId: input.leaderId,
      });

      return team;
    }),

  addMember: managerProcedure
    .input(
      z.object({
        teamId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db
        .select()
        .from(teams)
        .where(eq(teams.id, input.teamId))
        .then((rows) => rows[0]);

      if (!team) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team not found.",
        });
      }

      const event = await ctx.db
        .select()
        .from(events)
        .where(eq(events.id, team.eventId))
        .then((rows) => rows[0]);

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

      const existingMembers = await ctx.db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, input.teamId));

      if (existingMembers.length >= event.teamSize) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This team is full. Maximum team size is ${event.teamSize} members.`,
        });
      }

      const alreadyMember = existingMembers.some(
        (m) => m.userId === input.userId,
      );
      if (alreadyMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This user is already a member of this team.",
        });
      }

      const participation = await ctx.db
        .select()
        .from(participants)
        .where(
          and(
            eq(participants.eventId, team.eventId),
            eq(participants.userId, input.userId),
          ),
        )
        .then((rows) => rows[0]);

      if (!participation || participation.status !== "accepted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This user must be an accepted participant of the event before being added to a team.",
        });
      }

      await ctx.db.insert(teamMembers).values({
        teamId: input.teamId,
        userId: input.userId,
      });

      return { success: true, message: "Member added to team successfully." };
    }),

  removeMember: managerProcedure
    .input(
      z.object({
        teamId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db
        .select()
        .from(teams)
        .where(eq(teams.id, input.teamId))
        .then((rows) => rows[0]);

      if (!team) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team not found.",
        });
      }

      const event = await ctx.db
        .select()
        .from(events)
        .where(eq(events.id, team.eventId))
        .then((rows) => rows[0]);

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

      if (team.leaderId === input.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove the team leader. Assign a new leader first.",
        });
      }

      await ctx.db
        .delete(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, input.teamId),
            eq(teamMembers.userId, input.userId),
          ),
        );

      return { success: true, message: "Member removed from team." };
    }),

  getByEvent: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const teamsData = await ctx.db
        .select()
        .from(teams)
        .where(eq(teams.eventId, input.eventId));

      const result = await Promise.all(
        teamsData.map(async (team) => {
          const members = await ctx.db
            .select({
              userId: users.id,
              name: users.name,
              email: users.email,
            })
            .from(teamMembers)
            .innerJoin(users, eq(teamMembers.userId, users.id))
            .where(eq(teamMembers.teamId, team.id));

          const points = await ctx.db
            .select()
            .from(teamPoints)
            .where(
              and(
                eq(teamPoints.teamId, team.id),
                eq(teamPoints.eventId, input.eventId),
              ),
            )
            .then((rows) => rows[0] ?? null);

          return { ...team, members, points };
        }),
      );

      return result;
    }),
});