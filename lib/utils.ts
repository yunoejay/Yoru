/**
 * Minimal class-name joiner.
 *
 * The project has no `clsx`/`tailwind-merge` installed and only ever needs to
 * merge a couple of static + conditional class strings (see
 * components/ImageStreamHero.tsx), so a dependency-free filter+join is enough.
 * Falsy values (`false`, `null`, `undefined`, `""`) are dropped.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

const DAY_MS = 86_400_000;

/**
 * Short relative timestamp for chapter rows ("2 months ago", "last year").
 *
 * Accepts an explicit `now` so the series page can keep the label deterministic
 * between the server render and hydration (the same rule `formatUpdatedLabel`
 * in lib/series-card.ts follows for series cards).
 */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const days = Math.floor((now.getTime() - then.getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;

  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }

  const years = Math.floor(days / 365);
  return years === 1 ? "last year" : `${years} years ago`;
}

