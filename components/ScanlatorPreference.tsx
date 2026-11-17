'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ScanlatorOption } from '@/lib/content';

interface ScanlatorPreferenceProps {
  /** Public series id (slug or uuid), the same value used in /series/[id]. */
  seriesId: string;
  /** Server-seeded session state so the control is correct on first paint. */
  isSignedIn: boolean;
  /** Every scanlator that covers this title, for the dropdown. */
  scanlators: ScanlatorOption[];
  /** The user's saved preference, or null for automatic selection. */
  initialGroupName: string | null;
}

const AUTO = '';

function optionLabel(group: ScanlatorOption): string {
  const name = `${group.groupName}${group.official ? ' (official)' : ''}`;
  const latest = group.maxNumber === null ? '' : ` · up to ch. ${group.maxNumber}`;
  return `${name} — ${group.count} chapter${group.count === 1 ? '' : 's'}${latest}`;
}

/**
 * Per-series scanlator picker. The choice drives the reading order on the server
 * (lib/content.ts -> buildReadingOrder): Yoru follows the chosen group, then
 * automatically switches to whichever group is ahead when the preferred one has
 * not published the newest chapters. After saving we router.refresh() so the
 * server re-renders the chapter list in the new order.
 *
 * Signed-in readers are saved to their account (synced across devices);
 * signed-out readers are saved to a browser cookie and see a "saved in this
 * browser" note. Both use the same endpoint, which picks the right store.
 */
export default function ScanlatorPreference({
  seriesId,
  isSignedIn,
  scanlators,
  initialGroupName,
}: ScanlatorPreferenceProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialGroupName ?? AUTO);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reconcile with the server after a refresh (or if the preference changes
  // elsewhere) without clobbering an in-flight optimistic selection.
  useEffect(() => {
    if (!pending) setValue(initialGroupName ?? AUTO);
  }, [initialGroupName, pending]);

  async function handleChange(next: string) {
    if (pending) return;
    const previous = value;
    setValue(next); // optimistic
    setPending(true);
    setError(null);

    try {
      const url = `/api/series/${encodeURIComponent(seriesId)}/scanlator-preference`;
      let res: Response;
      if (next === AUTO) {
        res = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
      } else {
        const match = scanlators.find(group => group.groupName === next);
        res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          // credentials so a signed-out reader's Set-Cookie is stored by the browser.
          credentials: 'same-origin',
          body: JSON.stringify({ groupName: next, groupId: match?.groupId ?? null }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setValue(previous);
        setError(typeof data?.error === 'string' ? data.error : 'Could not save your choice.');
        return;
      }
      // Re-render the server components so the chapter list follows the new order.
      router.refresh();
    } catch {
      setValue(previous);
      setError('Network error; please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor="scanlator-pref" className="field-label">
        Preferred scanlator (reading order)
      </label>
      <select
        id="scanlator-pref"
        value={value}
        disabled={pending}
        onChange={event => handleChange(event.target.value)}
        className="field-input cursor-pointer disabled:opacity-60"
      >
        <option value={AUTO}>Auto — follow the most complete group</option>
        {scanlators.map(group => (
          <option key={group.groupName} value={group.groupName}>
            {optionLabel(group)}
          </option>
        ))}
      </select>
      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
        {pending
          ? 'Saving…'
          : value === AUTO
            ? 'Yoru follows whichever scanlator has the most chapters and switches to whoever is ahead.'
            : `Following ${value}. If it hasn’t released a chapter yet, Yoru automatically reads it from whichever group is ahead. Use the tabs above the chapter list to browse one scanlator’s own releases.`}
      </p>
      {!isSignedIn && !pending ? (
        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          Saved in this browser only.{' '}
          <Link href="/login" className="font-medium text-brand underline dark:text-brand-accent">
            Log in
          </Link>{' '}
          to sync your choices across devices.
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-500 dark:text-red-300">{error}</p> : null}
    </div>
  );
}
