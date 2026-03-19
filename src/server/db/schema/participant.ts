import { pgTable, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./user";
import { events } from "./event";

export const participantStatusEnum = pgEnum("participant_status", [
  "pending",
  "accepted",
  "rejected",
  "left",
  "time_over",
]);

export const participants = pgTable("participants", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: participantStatusEnum("status").notNull().default("pending"),
  isRemovedFromList: boolean("is_removed_from_list").notNull().default(false),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;