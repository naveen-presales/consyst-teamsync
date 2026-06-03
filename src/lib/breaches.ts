export type BreachOpp = { revision_count: number; breach_ignored?: boolean | null };

/** A breach actively impacts the architect's score (revisions > 2 and not ignored by a VP). */
export const isActiveBreach = (o: BreachOpp) => (o.revision_count ?? 0) > 2 && !o.breach_ignored;

/** Opportunity has historically breached (revisions > 2), regardless of ignore state. */
export const isAnyBreach = (o: BreachOpp) => (o.revision_count ?? 0) > 2;

export const isIgnoredBreach = (o: BreachOpp) => (o.revision_count ?? 0) > 2 && !!o.breach_ignored;
