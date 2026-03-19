import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { teamPoints, events, notifications, teamMembers, teams, users } from "@/server/db/schema";
import { calculateRankings } from "@/server/lib/utils/leaderboard-calc";

export const leaderboardRouter = createTRPCRouter({
  getByEvent: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
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

      const pointsData = await ctx.db
        .select({
          teamId: teamPoints.teamId,
          teamName: teams.name,
          matchPoints: teamPoints.matchPoints,
          overridePoints: teamPoints.overridePoints,
          isOverridden: teamPoints.isOverridden,
          wins: teamPoints.wins,
          losses: teamPoints.losses,
          draws: teamPoints.draws,
        })
        .from(teamPoints)
        .innerJoin(teams, eq(teamPoints.teamId, teams.id))
        .where(eq(teamPoints.eventId, input.eventId));

      const standings = pointsData.map((entry) => ({
        teamId: entry.teamId,
        teamName: entry.teamName,
        points: entry.isOverridden
          ? (entry.overridePoints ?? entry.matchPoints)
          : entry.matchPoints,
        wins: entry.wins,
        losses: entry.losses,
        draws: entry.draws,
        isOverridden: entry.isOverridden,
      }));

      const rankings = calculateRankings(standings, event.leaderboardCriteria);

      const rankingsWithMembers = await Promise.all(
        rankings.map(async (entry) => {
          const members = await ctx.db
            .select({
              userId: users.id,
              name: users.name,
            })
            .from(teamMembers)
            .innerJoin(users, eq(teamMembers.userId, users.id))
            .where(eq(teamMembers.teamId, entry.teamId));

          return { ...entry, members };
        }),
      );

      return {
        eventId: input.eventId,
        eventTitle: event.title,
        criteria: event.leaderboardCriteria,
        rankings: rankingsWithMembers,
        topThree: rankingsWithMembers.slice(0, 3),
      };
    }),

  notifyTopRank: protectedProcedure
    .input(z.object({ eventId: z.string() }))
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
          message: "Only the event manager can send rank notifications.",
        });
      }

      const pointsData = await ctx.db
        .select({
          teamId: teamPoints.teamId,
          matchPoints: teamPoints.matchPoints,
          overridePoints: teamPoints.overridePoints,
          isOverridden: teamPoints.isOverridden,
          wins: teamPoints.wins,
        })
        .from(teamPoints)
        .where(eq(teamPoints.eventId, input.eventId));

      if (pointsData.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No team points found for this event yet.",
        });
      }

      const sorted = pointsData
        .map((entry) => ({
          teamId: entry.teamId,
          points: entry.isOverridden
            ? (entry.overridePoints ?? entry.matchPoints)
            : entry.matchPoints,
          wins: entry.wins,
        }))
        .sort((a, b) =>
          event.leaderboardCriteria === "wins"
            ? b.wins - a.wins
            : b.points - a.points,
        );

      const topTeam = sorted[0];

      if (!topTeam) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not determine the top ranked team.",
        });
      }

      const topTeamMembers = await ctx.db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, topTeam.teamId));

      if (topTeamMembers.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Top team has no members to notify.",
        });
      }

      await ctx.db.insert(notifications).values(
        topTeamMembers.map((member) => ({
          id: nanoid(),
          userId: member.userId,
          eventId: input.eventId,
          type: "rank_achieved" as const,
          title: "You are rank #1!",
          message: `Your team is currently ranked 1st in "${event.title}". Keep it up!`,
        })),
      );

      return {
        success: true,
        message: "Rank notification sent to the top team.",
      };
    }),
});