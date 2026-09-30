/** A scene-local clock: cinema and visits to other scenes consume no decision time. */
export function createInteractionClock(wallNow: () => number = Date.now) {
  let elapsed = wallNow();
  let startedAt: number | null = null;
  return {
    now: () => elapsed + (startedAt === null ? 0 : wallNow() - startedAt),
    setActive(active: boolean) {
      if (active && startedAt === null) startedAt = wallNow();
      if (!active && startedAt !== null) {
        elapsed += wallNow() - startedAt;
        startedAt = null;
      }
    },
  };
}
