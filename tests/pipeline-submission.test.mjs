import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/pipeline-submission.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
const {restorePipelineRequest:restore,pipelineSource:source}=context.exports;
const base={characterPrompt:'ตัวละคร',scenePrompt:'ฉาก',visualStyle:'cinematic_realistic',aspectRatio:'9:16',durationSeconds:5,modelId:'violet-motion-2',quality:'standard',idempotencyKey:'immutable-key'};
test('all three persisted source requests replay exactly, preserving unknown fields and key',()=>{
 for(const extra of [{referenceImageId:'upload'},{},{characterAssetId:'asset',characterPrompt:''}]){
  const original={...base,...extra,dialogue:'  บทพูดเดิม  '};const restored=restore(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(restored,original);assert.equal(source(restored),extra.characterAssetId?'library':extra.referenceImageId?'upload':'text');
 }
});
test('unsafe partial/mutually exclusive pending requests are not replayed',()=>{
 for(const bad of [null,{}, {...base,referenceImageId:'upload',characterAssetId:'asset'}, {...base,durationSeconds:'5'}, {...base,dialogue:3},{...base,characterPrompt:''},{...base,characterAssetId:42},{...base,referenceImageId:''}])assert.equal(restore(bad),null);
});


test('draft intent survives immutable pending submission and invalid draft types are rejected',()=>{
 for(const draft of [true,false,undefined]){const original={...base,...(draft===undefined?{}:{draft})};assert.deepEqual(restore(JSON.parse(JSON.stringify(original))),original);}
 for(const draft of ['true',1,null,{}])assert.equal(restore({...base,draft}),null);
});
test('final recovery accepts complete UUID identity and never forwards stored extra settings',()=>{
 const {restorePipelineFinal}=context.exports;
 const original={sourceId:'12345678-1234-4234-8234-123456789abc',idempotencyKey:'22345678-1234-4234-8234-123456789abc'};
 assert.deepEqual(JSON.parse(JSON.stringify(restorePipelineFinal({...original,prompt:'must not repeat',draft:true}))),original);
 for(const bad of [null,{}, {...original,sourceId:'bad'}, {...original,idempotencyKey:4},{sourceId:original.sourceId}])assert.equal(restorePipelineFinal(bad),null);
});
