import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

import { createTRPCRouter, managerProcedure, protectedProcedure } from "@/server/api/trpc";
import { matches, teamPoints, teams, events } from "@/server/db/schema";

export const pointsRouter = createTRPCRouter({
  logMatch: managerProcedure
    .input(
      z.object({
        eventId: z.string(),
        teamAId: z.string(),
        teamBId: z.string(),
        teamAScore: z.number().int().min(0),
        teamBScore: z.number().int().min(0),
        matchNumber: z.number().int().min(1),
        playedAt: z.date().optional(),
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

      if (input.teamAId === input.teamBId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A team cannot play against itself.",
        });
      }

      const winnerId =
        input.teamAScore > input.teamBScore
          ? input.teamAId
          : input.teamBScore > input.teamAScore
            ? input.teamBId
            : null;

      const [match] = await ctx.db
        .insert(matches)
        .values({
          id: nanoid(),
          eventId: input.eventId,
          teamAId: input.teamAId,
          teamBId: input.teamBId,
          teamAScore: input.teamAScore,
          teamBScore: input.teamBScore,
          winnerId,
          matchNumber: input.matchNumber,
          playedAt: input.playedAt ?? new Date(),
        })
        .returning();

      await updateTeamPoints({
        db: ctx.db,
        eventId: input.eventId,
        teamAId: input.teamAId,
        teamBId: input.teamBId,
        teamAScore: input.teamAScore,
        teamBScore: input.teamBScore,
        winnerId,
        criteria: event.leaderboardCriteria,
      });

      return match;
    }),

  overridePoints: managerProcedure
    .input(
      z.object({
        eventId: z.string(),
        teamId: z.string(),
        overridePoints: z.number().int().min(0, "Points cannot be negative."),
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

      const existing = await ctx.db.query.teamPoints.findFirst({
        where: and(
          eq(teamPoints.eventId, input.eventId),
          eq(teamPoints.teamId, input.teamId),
        ),
      });

      if (!existing) {
        await ctx.db.insert(teamPoints).values({
          id: nanoid(),
          eventId: input.eventId,
          teamId: input.teamId,
          matchPoints: 0,
          overridePoints: input.overridePoints,
          isOverridden: true,
        });
      } else {
        await ctx.db
          .update(teamPoints)
          .set({
            overridePoints: input.overridePoints,
            isOverridden: true,
            updatedAt: new Date(),
          })
          .where(eq(teamPoints.id, existing.id));
      }

      await ctx.db
        .update(teams)
        .set({
          totalPoints: input.overridePoints,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, input.teamId));

      return {
        success: true,
        message: "Points overridden successfully.",
      };
    }),

  getByEvent: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.teamPoints.findMany({
        where: eq(teamPoints.eventId, input.eventId),
        with: {
          team: true,
        },
      });
    }),

  getMatchesByEvent: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.matches.findMany({
        where: eq(matches.eventId, input.eventId),
        with: {
          teamA: true,
          teamB: true,
          winner: true,
        },
        orderBy: (matches, { asc }) => [asc(matches.matchNumber)],
      });
    }),
});

async function updateTeamPoints({
  db,
  eventId,
  teamAId,
  teamBId,
  teamAScore,
  teamBScore,
  winnerId,
  criteria,
}: {
  db: any;
  eventId: string;
  teamAId: string;
  teamBId: string;
  teamAScore: number;
  teamBScore: number;
  winnerId: string | null;
  criteria: string;
}) {
  const isDraw = winnerId === null;

  for (const [teamId, score, opponentScore] of [
    [teamAId, teamAScore, teamBScore],
    [teamBId, teamBScore, teamAScore],
  ] as [string, number, number][]) {
    const isWinner = teamId === winnerId;
    const pointsEarned =
      criteria === "wins"
        ? isWinner ? 3 : isDraw ? 1 : 0
        : criteria === "goal_difference"
          ? score - opponentScore
          : isWinner ? 3 : isDraw ? 1 : 0;

    const existing = await db.query.teamPoints.findFirst({
      where: and(eq(teamPoints.eventId, eventId), eq(teamPoints.teamId, teamId)),
    });

    if (!existing) {
      await db.insert(teamPoints).values({
        id: nanoid(),
        eventId,
        teamId,
        matchPoints: pointsEarned,
        wins: isWinner ? 1 : 0,
        losses: !isWinner && !isDraw ? 1 : 0,
        draws: isDraw ? 1 : 0,
        isOverridden: false,
      });
    } else if (!existing.isOverridden) {
      await db
        .update(teamPoints)
        .set({
          matchPoints: existing.matchPoints + pointsEarned,
          wins: existing.wins + (isWinner ? 1 : 0),
          losses: existing.losses + (!isWinner && !isDraw ? 1 : 0),
          draws: existing.draws + (isDraw ? 1 : 0),
          updatedAt: new Date(),
        })
        .where(eq(teamPoints.id, existing.id));
    }

    const updated = await db.query.teamPoints.findFirst({
      where: and(eq(teamPoints.eventId, eventId), eq(teamPoints.teamId, teamId)),
    });

    await db
      .update(teams)
      .set({
        totalPoints: updated?.isOverridden
          ? (updated.overridePoints ?? updated.matchPoints)
          : updated?.matchPoints ?? 0,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId));
  }
}