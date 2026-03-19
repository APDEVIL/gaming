import { and, eq, not } from "drizzle-orm";
import { type DB } from "@/server/db";
import { participants, events } from "@/server/db/schema";

export async function checkTimeConflict({
  db,
  userId,
  startTime,
  endTime,
  excludeEventId,
}: {
  db: DB;
  userId: string;
  startTime: Date;
  endTime: Date;
  excludeEventId?: string;
}): Promise<boolean> {
  const rows = await db
    .select({
      eventId: events.id,
      status: events.status,
      startTime: events.startTime,
      endTime: events.endTime,
    })
    .from(participants)
    .innerJoin(events, eq(participants.eventId, events.id))
    .where(
      and(
        eq(participants.userId, userId),
        eq(participants.status, "accepted"),
        excludeEventId
          ? not(eq(participants.eventId, excludeEventId))
          : undefined,
      ),
    );

  for (const row of rows) {
    if (row.status === "completed" || row.status === "cancelled") continue;

    const overlaps = startTime < row.endTime && endTime > row.startTime;

    if (overlaps) return true;
  }

  return false;
}