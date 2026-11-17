#!/usr/bin/env node
/**
 * Verify that the home page's "Updates for you" rail leaves completed titles
 * out, in both senses the app tracks:
 *   - the reader's library status is `completed`
 *   - the series itself is published as `completed`
 *
 * Run with:  npm run check:updates-for-you
 *
 * No database is needed: this exercises lib/recommendations.ts — the exact
 * module app/page.tsx calls — with hand-built library entries.
 */
import assert from 'node:assert/strict';
import type { SeriesView } from '../lib/content';
import type { LibraryStatus } from '../lib/library-status';
import { pickUpdatesForYou, type UpdatesForYouEntry } from '../lib/recommendations';

function makeSeries(id: string, overrides: Partial<SeriesView> = {}): SeriesView {
  return {
    id,
    title: id,
    cover: `https://example.test/${id}.jpg`,
    description: '',
    tags: [],
    status: 'ongoing',
    chapters: [],
    chapterGroups: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    scanlatorLabels: [],
    scanlators: [],
    isStaticDemo: false,
    author: null,
    ...overrides,
  };
}

function entry(status: LibraryStatus, series: SeriesView): UpdatesForYouEntry {
  return { status, series };
}

const ids = (cards: { id: string }[]) => cards.map((card) => card.id);

let passed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, `${label}\n  expected: ${String(expected)}\n  actual:   ${String(actual)}`);
  console.log(`  ok  ${label} -> ${String(actual)}`);
  passed += 1;
}

const ongoingNewer = makeSeries('ongoing-newer', { updatedAt: '2026-03-10T00:00:00.000Z' });
const ongoingOlder = makeSeries('ongoing-older', { updatedAt: '2026-02-01T00:00:00.000Z' });
const hiatus = makeSeries('hiatus-title', { status: 'hiatus', updatedAt: '2026-03-05T00:00:00.000Z' });
const readerCompleted = makeSeries('reader-completed', { updatedAt: '2026-03-20T00:00:00.000Z' });
const publishedCompleted = makeSeries('published-completed', {
  status: 'completed',
  updatedAt: '2026-03-21T00:00:00.000Z',
});

console.log('Scenario A — unfinished bookmarks are listed newest first');
check(
  'ongoing bookmarks appear in activity order',
  ids(pickUpdatesForYou([entry('reading', ongoingOlder), entry('plan_to_read', ongoingNewer)], 10)),
  ['ongoing-newer', 'ongoing-older'],
);
check(
  'a hiatus title still updates',
  ids(pickUpdatesForYou([entry('on_hold', hiatus), entry('reading', ongoingOlder)], 10)),
  ['hiatus-title', 'ongoing-older'],
);

console.log('\nScenario B — completion is filtered out');
check(
  'a series the reader filed as Completed is dropped',
  ids(pickUpdatesForYou([entry('completed', readerCompleted)], 10)),
  [],
);
check(
  'a series published as Completed is dropped',
  ids(pickUpdatesForYou([entry('reading', publishedCompleted)], 10)),
  [],
);
check(
  'everything completed -> empty rail',
  ids(
    pickUpdatesForYou(
      [entry('completed', readerCompleted), entry('completed', publishedCompleted)],
      10,
    ),
  ),
  [],
);

console.log('\nScenario C — the rest of the library is untouched');
check(
  'only unfinished titles survive the filter',
  ids(
    pickUpdatesForYou(
      [
        entry('completed', readerCompleted),
        entry('reading', ongoingNewer),
        entry('plan_to_read', publishedCompleted),
        entry('dropped', ongoingOlder),
      ],
      10,
    ),
  ),
  ['ongoing-newer', 'ongoing-older'],
);
check(
  'limit applies after completed titles are removed',
  ids(
    pickUpdatesForYou(
      [
        entry('completed', readerCompleted),
        entry('reading', ongoingNewer),
        entry('reading', ongoingOlder),
      ],
      1,
    ),
  ),
  ['ongoing-newer'],
);

console.log('\nScenario D — edges');
check('empty library -> empty rail', pickUpdatesForYou([], 10), []);
check(
  'a dropped bookmark still counts as unfinished',
  ids(pickUpdatesForYou([entry('dropped', ongoingNewer)], 10)),
  ['ongoing-newer'],
);

console.log(`\n${passed} checks passed.`);
