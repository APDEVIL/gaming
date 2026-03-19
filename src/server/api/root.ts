import { createTRPCRouter } from "@/server/api/trpc";
import { authRouter } from "./routers/auth";
import { eventRouter } from "./routers/event";
import { participantRouter } from "./routers/participant";
import { teamRouter } from "./routers/team";
import { pointsRouter } from "./routers/points";
import { leaderboardRouter } from "./routers/leaderboard";
import { notificationRouter } from "./routers/notification";
import { searchRouter } from "./routers/search";
import { profileRouter } from "./routers/profile";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  event: eventRouter,
  participant: participantRouter,
  team: teamRouter,
  points: pointsRouter,
  leaderboard: leaderboardRouter,
  notification: notificationRouter,
  search: searchRouter,
  profile: profileRouter,
});

export type AppRouter = typeof appRouter;