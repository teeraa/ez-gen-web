import test from 'node:test';
import assert from 'node:assert/strict';
import { manualTimelineRange } from '../src/components/ai-editor/manual-timeline.ts';

const add = (duration, count = 0, total = 0) => manualTimelineRange(duration, count, total, 20, 1200);
for (const duration of [120, 135.5]) {
  test(`manual add preserves the complete ${duration}s source`, () => {
    assert.deepEqual(add(duration), { start: 0, end: duration });
  });
}
test('unavailable or invalid metadata never creates a segment', () => {
  for (const duration of [undefined, null, NaN, 0, -1, Infinity, -Infinity]) assert.equal(add(duration), undefined);
});
test('segment count limit accepts the twentieth clip and rejects the twenty-first', () => {
  assert.deepEqual(add(120, 19), { start: 0, end: 120 });
  assert.equal(add(120, 20), undefined);
});
test('full source must fit the project duration; never truncate to remaining capacity', () => {
  assert.deepEqual(add(120, 1, 1080), { start: 0, end: 120 });
  assert.equal(add(120, 1, 1080.1), undefined);
  assert.equal(add(135.5, 1, 1100), undefined);
  assert.equal(add(1201), undefined);
});
