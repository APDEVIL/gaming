import { pgTable, text, timestamp, integer, pgEnum, boolean } from "drizzle-orm/pg-core";
import { users } from "./user";

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "open",
  "registration_closed",
  "ongoing",
  "completed",
  "cancelled",
]);

export const leaderboardCriteriaEnum = pgEnum("leaderboard_criteria", [
  "points",
  "wins",
  "goal_difference",
]);

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  gameName: text("game_name").notNull(),
  description: text("description"),
  prize: text("prize"),
  teamSize: integer("team_size").notNull().default(5),
  maxTeams: integer("max_teams").notNull(),
  status: eventStatusEnum("status").notNull().default("draft"),
  leaderboardCriteria: leaderboardCriteriaEnum("leaderboard_criteria")
    .notNull()
    .default("points"),
  registrationDeadline: timestamp("registration_deadline"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  winnerId: text("winner_id"),
  managerId: text("manager_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isWinnerDeclared: boolean("is_winner_declared").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;