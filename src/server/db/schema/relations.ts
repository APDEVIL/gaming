import { relations } from "drizzle-orm";
import { users } from "./user";
import { events } from "./event";
import { teams } from "./team";
import { teamMembers } from "./team-member";
import { participants } from "./participant";
import { matches, teamPoints } from "./points";
import { notifications } from "./notification";

export const usersRelations = relations(users, ({ many }) => ({
  managedEvents: many(events),
  teamMemberships: many(teamMembers),
  participations: many(participants),
  notifications: many(notifications),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  manager: one(users, {
    fields: [events.managerId],
    references: [users.id],
  }),
  winner: one(teams, {
    fields: [events.winnerId],
    references: [teams.id],
  }),
  teams: many(teams),
  participants: many(participants),
  matches: many(matches),
  teamPoints: many(teamPoints),
  notifications: many(notifications),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  event: one(events, {
    fields: [teams.eventId],
    references: [events.id],
  }),
  leader: one(users, {
    fields: [teams.leaderId],
    references: [users.id],
  }),
  members: many(teamMembers),
  matchesAsTeamA: many(matches, { relationName: "teamA" }),
  matchesAsTeamB: many(matches, { relationName: "teamB" }),
  points: many(teamPoints),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  event: one(events, {
    fields: [participants.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [participants.userId],
    references: [users.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  event: one(events, {
    fields: [matches.eventId],
    references: [events.id],
  }),
  teamA: one(teams, {
    fields: [matches.teamAId],
    references: [teams.id],
    relationName: "teamA",
  }),
  teamB: one(teams, {
    fields: [matches.teamBId],
    references: [teams.id],
    relationName: "teamB",
  }),
  winner: one(teams, {
    fields: [matches.winnerId],
    references: [teams.id],
    relationName: "matchWinner",
  }),
}));

export const teamPointsRelations = relations(teamPoints, ({ one }) => ({
  event: one(events, {
    fields: [teamPoints.eventId],
    references: [events.id],
  }),
  team: one(teams, {
    fields: [teamPoints.teamId],
    references: [teams.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [notifications.eventId],
    references: [events.id],
  }),
}));