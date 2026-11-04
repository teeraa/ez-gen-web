import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compiled=ts.transpileModule(fs.readFileSync('src/lib/director-api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function client(responses){const requests=[];const context={exports:{},URL,Response,location:{origin:'http://localhost:3000'},fetch:async(url,init)=>{requests.push({url,init});return responses.shift()}};vm.runInNewContext(compiled,context);return {...context.exports,requests}}
const p={id:'project',revision:1,name:'Film',step:'idea',idea:{prompt:'idea',characterAssetIds:[]},story:{status:'idle'},storyboard:{status:'idle'},estimates:{},scenes:[]};
test('normal conditional poll accepts304; media refresh omitsIfNoneMatch and obtains freshURLs',async()=>{
 const old={...p,coverImageUrl:'https://owned.test/old'};const fresh={...p,coverImageUrl:'https://owned.test/new'};
 const {directorApi,requests}=client([Response.json({data:old},{headers:{ETag:'W/"1-1"'}}),new Response(null,{status:304}),Response.json({data:fresh},{headers:{ETag:'W/"1-1"'}})]);
 assert.equal((await directorApi.get('project')).coverImageUrl,old.coverImageUrl);
 assert.equal((await directorApi.get('project',undefined,true)).coverImageUrl,old.coverImageUrl);
 assert.equal(requests[1].init.headers['If-None-Match'],'W/"1-1"');
 assert.equal((await directorApi.get('project')).coverImageUrl,fresh.coverImageUrl);assert.equal(requests[2].init.headers['If-None-Match'],undefined);
});
test('points andrate errors retain actionable details requestID and RetryAfter',async()=>{
 const {directorApi,errorMessage}=client([Response.json({code:'INSUFFICIENT_POINTS',message:'พอยต์ไม่พอ',details:{required:3,balance:1},requestId:'safe-id'},{status:402}),Response.json({code:'RATE_LIMITED',message:'รอสักครู่'},{status:429,headers:{'Retry-After':'60'}})]);
 await assert.rejects(directorApi.mutate('project','/cover','POST',{}),error=>error.status===402&&errorMessage(error).includes('3 pt')&&errorMessage(error).includes('safe-id'));
 await assert.rejects(directorApi.mutate('project','/cover','POST',{}),error=>error.retryAfter==='60'&&errorMessage(error).includes('60'));
});
test('untrustedmedia schemes and malformed project envelope are rejected',async()=>{
 const {directorApi,mediaUrl}=client([Response.json({data:{id:'x'}})]);
 assert.equal(mediaUrl('javascript:alert(1)'),undefined);assert.equal(mediaUrl('data:image/svg+xml,bad'),undefined);assert.equal(mediaUrl('https://owned.test/media'),'https://owned.test/media');
 await assert.rejects(directorApi.get('project'),error=>error.code==='INVALID_RESPONSE');
});
test('poll work detection includes scene rewrite and individualshot even when aggregate complete',()=>{
 const {hasWork}=client([]);
 assert.equal(hasWork({...p,cover:null,scenes:[{status:'writing',shots:[]}]}),true);
 assert.equal(hasWork({...p,cover:null,scenes:[{status:'ready',shots:[{image:{status:'processing'}}]}]}),true);
 assert.equal(hasWork({...p,cover:null,scenes:[{status:'ready',shots:[{image:{status:'needs_attention'}}]}]}),false);
});
