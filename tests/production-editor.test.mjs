import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
const source=ts.transpileModule(fs.readFileSync('src/lib/production-api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;
const context={exports:{},fetch:()=>{throw new Error('not called')}};
vm.runInNewContext(source,context);
const {validTrim}=context.exports;
test('trim validation rejects invalid or out of source bounds, accepts full-duration sentinel',()=>{
 for(const [start,end,duration] of [[0,0,5],[1,4,5],[0,5,5],[0,0,null]])assert.equal(validTrim(start,end,duration),true);
 for(const [start,end,duration] of [[-1,4,5],[2,1,5],[5,0,5],[0,6,5],[NaN,4,5],[0,Infinity,5]])assert.equal(validTrim(start,end,duration),false);
});
const editor=ts.transpileModule(fs.readFileSync('src/lib/production-editor.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;
const editContext={exports:{}};vm.runInNewContext(editor,editContext);
test('reopening draft preserves manual order, cuts and frozen version while adding new clips and removing deleted scenes',()=>{
 const clips=[{sceneId:'b',jobId:'old-b',trimStart:1,trimEnd:3,enabled:false},{sceneId:'deleted',trimStart:0,trimEnd:0,enabled:true},{sceneId:'a',jobId:'old-a',trimStart:0,trimEnd:2,enabled:true}];
 const scenes=[{id:'a',selectedJobId:'new-a'},{id:'b',selectedJobId:'new-b'},{id:'c',selectedJobId:'new-c'},{id:'d',selectedJobId:null}];
 const result=editContext.exports.reconcileClips(clips,scenes);
 assert.equal(JSON.stringify(result.map(c=>c.sceneId)),JSON.stringify(['b','a','c']));
 assert.equal(result[0].jobId,'old-b');assert.equal(result[0].trimStart,1);assert.equal(result[0].enabled,false);assert.equal(result[1].jobId,'old-a');assert.equal(result[2].jobId,'new-c');
});

test('fresh selected and pending responses replace older status/media outside the first page without duplicating jobs',()=>{
 const old=[{jobId:'selected',status:'processing',result:{mediaUrl:'old'}},{jobId:'pending',status:'processing'},{jobId:'retained',status:'succeeded'}];
 const fresh=[{jobId:'latest',status:'succeeded'},{jobId:'selected',status:'succeeded',result:{mediaUrl:'fresh'}},{jobId:'pending',status:'succeeded'}];
 const merged=context.exports.mergeVideoJobs(old,fresh);
 assert.equal(merged.find(j=>j.jobId==='selected').result.mediaUrl,'fresh');assert.equal(merged.find(j=>j.jobId==='pending').status,'succeeded');assert.equal(merged.length,4);
});
test('new reference defaults to appearance when supported while explicit first-frame intent survives replacement/model capability reads',()=>{
 const model={supportsReferenceImage:true,supportsImageToVideo:true};
 assert.equal(context.exports.referenceMode('text',model),'image_image');
 assert.equal(context.exports.referenceMode('image_video',model),'image_video');
 assert.equal(context.exports.referenceMode('image_image',model),'image_image');
 assert.equal(context.exports.referenceMode('image_image',{supportsReferenceImage:false,supportsImageToVideo:true}),'image_video');
});

test('off-page pending/selected and evicted known active jobs are deduped for direct lookup and terminal resolution',()=>{
 const first=[{jobId:'latest',status:'succeeded'}];
 const previous=[{jobId:'evicted',status:'processing'},{jobId:'old-terminal',status:'failed'}];
 const ids=context.exports.sceneJobRefreshIds(first,previous,'selected','pending');
 assert.deepEqual(Array.from(ids),['selected','pending','evicted']);
 const merged=context.exports.mergeVideoJobs(previous,[...first,...ids.map(jobId=>({jobId,status:'succeeded'}))]);
 assert.equal(merged.some(j=>!['succeeded','failed','cancelled'].includes(j.status)),false);
 assert.deepEqual(Array.from(context.exports.sceneJobRefreshIds(first,previous,'evicted','evicted')),['evicted']);
});
