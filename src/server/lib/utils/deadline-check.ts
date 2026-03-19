export function isDeadlinePassed(deadline: Date | null): boolean {
  if (!deadline) return false;
  return deadline < new Date();
}

export function getDeadlineStatus(deadline: Date | null): {
  isPassed: boolean;
  hoursRemaining: number | null;
  label: string;
} {
  if (!deadline) {
    return { isPassed: false, hoursRemaining: null, label: "No deadline set" };
  }

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs <= 0) {
    return { isPassed: true, hoursRemaining: 0, label: "Registration closed" };
  }

  if (diffHours < 1) {
    const minutes = Math.ceil(diffMs / (1000 * 60));
    return {
      isPassed: false,
      hoursRemaining: diffHours,
      label: `Closes in ${minutes} minute(s)`,
    };
  }

  if (diffHours < 24) {
    return {
      isPassed: false,
      hoursRemaining: diffHours,
      label: `Closes in ${Math.ceil(diffHours)} hour(s)`,
    };
  }

  const days = Math.ceil(diffHours / 24);
  return {
    isPassed: false,
    hoursRemaining: diffHours,
    label: `Closes in ${days} day(s)`,
  };
}