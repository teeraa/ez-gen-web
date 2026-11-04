import assert from 'node:assert/strict';
import { packLanes } from '../src/components/ai-editor/lanes.ts';

const lanes = items => packLanes(items, item => item.s, item => item.e).map(lane => lane.map(item => item.id));
assert.deepEqual(lanes([]), []);
assert.deepEqual(lanes([{ id: 'a', s: 0, e: 3 }, { id: 'b', s: 3, e: 5 }]), [['a', 'b']]);
assert.deepEqual(lanes([{ id: 'a', s: 0, e: 4 }, { id: 'b', s: 2, e: 5 }, { id: 'c', s: 4, e: 6 }]), [['a', 'c'], ['b']]);
assert.deepEqual(lanes([{ id: 'c', s: 1, e: 2 }, { id: 'a', s: 0, e: 9 }, { id: 'b', s: 0, e: 1 }]), [['b', 'c'], ['a']]);
console.log('timeline lanes: ok');
