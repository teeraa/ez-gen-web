import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
const source = ts.transpileModule(fs.readFileSync('src/lib/director-submission.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function fixture() {
 const storage = {};
 const sessionStorage = { getItem: key => storage[key] ?? null, setItem: (key,value) => {storage[key]=value}, removeItem: key => {delete storage[key]} };
 const context={ exports:{},sessionStorage,structuredClone, crypto:{randomUUID:()=> 'c6d9a213-6884-4a23-857e-8f8a2e6c1111'},Map };
 vm.runInNewContext(source,context);
 return { api:context.exports,storage,sessionStorage,context };
}
test('uncertain paid request freezes its revision and inputs across edits and reload',()=>{
 const {api,storage}=fixture();
 const first=api.prepareSubmission('project:story',{revision:3,replace:false,prompt:'Original'});
 const retried=api.prepareSubmission('project:story',{revision:8,replace:true,prompt:'Edited'});
 assert.equal(retried.key,first.key);assert.equal(retried.body.revision,3);assert.equal(retried.body.prompt,'Original');
 const reloaded=api.restoreSubmission(Object.values(storage)[0]);assert.equal(reloaded.key,first.key);assert.equal(reloaded.body.replace,false);
 api.finishSubmission('project:story');assert.equal(api.pendingSubmission('project:story'),null);
});
test('server or network uncertainty never releases an idempotency key',()=>{
 const {api}=fixture();
 for(const status of [0,200,500,502,503])assert.equal(api.definiteRejection({status,code:'NETWORK_ERROR'}),false);
 for(const status of [400,402,404,409,429])assert.equal(api.definiteRejection({status,code:'VALIDATION_ERROR'}),true);
 assert.equal(api.definiteRejection({status:502,code:'INVALID_RESPONSE'}),false);
 for (const status of [400,402,409,429]) assert.equal(api.definiteRejection({status,code:'VALIDATION_ERROR'},true),false);
 assert.equal(api.definiteRejection({status:402},false),true);
});
test('malformed persisted submissions are rejected instead of replayed',()=>{
 const {api}=fixture();
 assert.equal(api.restoreSubmission('{bad'),null);assert.equal(api.restoreSubmission(JSON.stringify({key:'invalid',body:{revision:1}})),null);
 assert.equal(api.restoreSubmission(JSON.stringify({key:'c6d9a213-6884-4a23-857e-8f8a2e6c1111',body:[]})),null);
});
test('logout clears Director persisted requests and fallback memory',()=>{
 const {api,sessionStorage,context,storage}=fixture();
 api.prepareSubmission('create',{name:'Private prompt'});
 const wrapped=new Proxy(sessionStorage,{ownKeys:()=>Object.keys(storage),getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})});
 const cleanup=ts.transpileModule(fs.readFileSync('src/lib/studio-session-storage.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const cleanupContext={exports:{},sessionStorage:wrapped,require:()=>api};vm.runInNewContext(cleanup,cleanupContext);
 cleanupContext.exports.clearStudioSessionStorage();assert.equal(Object.keys(storage).length,0);assert.equal(api.pendingSubmission('create'),null);
 context.sessionStorage={getItem:()=>{throw new Error('denied')},setItem:()=>{throw new Error('denied')},removeItem:()=>{throw new Error('denied')}};
 api.prepareSubmission('fallback',{name:'Private fallback'});api.clearDirectorSubmissionMemory();assert.equal(api.pendingSubmission('fallback'),null);
});
