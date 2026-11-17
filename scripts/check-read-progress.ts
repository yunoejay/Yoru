#!/usr/bin/env node
/**
 * Verify the pure reading-progress helpers that back the series page's
 * "read" checkboxes and the "Continue reading" button.
 *
 * Run with:  npm run check:read-progress
 *
 * No database is needed: this exercises lib/read-progress-core.ts, the exact
 * module the client components import, so a pass means "first unread chapter"
 * behaves the way the UI assumes.
 */
import assert from 'node:assert/strict';
import { countReadChapters, pickNextUnread, pickResumeChapter } from '../lib/read-progress-core';

const chapters = [1, 2, 3, 4, 5].map(number => ({ id: `ch-${number}`, number }));

let passed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, `${label}\n  expected: ${String(expected)}\n  actual:   ${String(actual)}`);
  console.log(`  ok  ${label} -> ${String(actual)}`);
  passed += 1;
}

console.log('Scenario A — nothing read yet');
check('first unread is chapter 1', pickNextUnread(chapters, [])?.number ?? null, 1);
check('read count is zero', countReadChapters(chapters, []), 0);

console.log('\nScenario B — partway through');
check('first unread skips read chapters', pickNextUnread(chapters, [1, 2])?.number ?? null, 3);
check('read count counts only listed chapters', countReadChapters(chapters, new Set([1, 2])), 2);
check('out-of-order ticks resume at the first gap', pickNextUnread(chapters, [1, 2, 4])?.number ?? null, 3);

console.log('\nScenario C — everything caught up');
check('no next unread chapter', pickNextUnread(chapters, [1, 2, 3, 4, 5]), null);
check('read count equals the list', countReadChapters(chapters, [1, 2, 3, 4, 5]), 5);

console.log('\nScenario D — edges');
check('empty series has no next chapter', pickNextUnread([], []), null);
check('fractional numbers work (12.5)', pickNextUnread([{ number: 12.5 }, { number: 13 }], [])?.number ?? null, 12.5);
check('scalar read numbers are accepted', countReadChapters([{ number: 1 }, { number: 2 }], [1]), 1);

console.log('\nScenario E — where "Continue reading" lands');
check('nothing read -> first chapter', pickResumeChapter(chapters, [])?.number ?? null, 1);
check('read up to 2 -> chapter 3', pickResumeChapter(chapters, [1, 2])?.number ?? null, 3);
check('skipped prologue does not rewind', pickResumeChapter([{ number: 0 }, ...chapters], [1])?.number ?? null, 2);
check('sparse ticks resume after the furthest one', pickResumeChapter(chapters, [1, 4])?.number ?? null, 5);
check('last chapter read -> caught up', pickResumeChapter(chapters, [1, 2, 3, 4, 5]), null);
check('empty series -> null', pickResumeChapter([], []), null);

console.log(`\n${passed} checks passed.`);
