import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { events } from "./event";
import { teams } from "./team";

export const matches = pgTable("matches", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  teamAId: text("team_a_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  teamBId: text("team_b_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  teamAScore: integer("team_a_score").notNull().default(0),
  teamBScore: integer("team_b_score").notNull().default(0),
  winnerId: text("winner_id").references(() => teams.id, {
    onDelete: "set null",
  }),
  matchNumber: integer("match_number").notNull(),
  playedAt: timestamp("played_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const teamPoints = pgTable("team_points", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  matchPoints: integer("match_points").notNull().default(0),
  overridePoints: integer("override_points"),
  isOverridden: boolean("is_overridden").notNull().default(false),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type TeamPoints = typeof teamPoints.$inferSelect;
export type NewTeamPoints = typeof teamPoints.$inferInsert;