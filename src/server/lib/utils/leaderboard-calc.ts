export type LeaderboardCriteria = "points" | "wins" | "goal_difference";

export type TeamStanding = {
  teamId: string;
  teamName: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  isOverridden: boolean;
};

export type RankedStanding = TeamStanding & {
  rank: number;
  badge: "gold" | "silver" | "bronze" | null;
};

export function calculateRankings(
  standings: TeamStanding[],
  criteria: LeaderboardCriteria,
): RankedStanding[] {
  const sorted = [...standings].sort((a, b) => {
    if (criteria === "wins") {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.points - a.points;
    }
    if (criteria === "goal_difference") {
      return b.points - a.points;
    }
    if (b.points !== a.points) return b.points - a.points;
    return b.wins - a.wins;
  });

  return sorted.map((team, index) => ({
    ...team,
    rank: index + 1,
    badge:
      index === 0
        ? "gold"
        : index === 1
          ? "silver"
          : index === 2
            ? "bronze"
            : null,
  }));
}