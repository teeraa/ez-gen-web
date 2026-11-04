import test from 'node:test';import assert from 'node:assert/strict';
import {previewCompositionTracks,approvalIdsForApply} from '../src/components/ai-editor/ai-composition.ts';
test('complete draft preview preserves manual tracks and replaces previous AI tracks',()=>{
 const manual={id:'manual'},oldAi={id:'old-ai',originJobId:'old-job'},nextAi={id:'new-ai',originJobId:'new-job'};
 assert.deepEqual(previewCompositionTracks([manual,oldAi],[nextAi]),[manual,nextAi]);
 assert.deepEqual(previewCompositionTracks([manual],undefined),[manual]);
});
test('one click auto apply approves the exact current draft without asynchronous approval state',()=>{
 assert.deepEqual(approvalIdsForApply(['a','b'],[],true,true),['a','b']);
 assert.throws(()=>approvalIdsForApply(['a','b'],[],false,true));
 assert.throws(()=>approvalIdsForApply(['a','b'],['a'],true,false));
 assert.throws(()=>approvalIdsForApply([],[],true,true));
 assert.deepEqual(approvalIdsForApply(['b','a'],['a','b'],false,false),['a','b']);
});
