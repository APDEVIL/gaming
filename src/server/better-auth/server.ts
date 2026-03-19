import { headers } from "next/headers";
import { cache } from "react";
import { auth } from ".";

export { auth };

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export type Session = Awaited<ReturnType<typeof getSession>>;