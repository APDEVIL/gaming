import { pgTable, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./user";
import { events } from "./event";

export const notificationTypeEnum = pgEnum("notification_type", [
  "event_invite",
  "event_update",
  "event_cancelled",
  "registration_closing_soon",
  "winner_declared",
  "rank_achieved",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "accepted",
  "rejected",
  "time_over",
  "read",
]);

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventId: text("event_id").references(() => events.id, {
    onDelete: "cascade",
  }),
  type: notificationTypeEnum("type").notNull(),
  status: notificationStatusEnum("status").notNull().default("pending"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;