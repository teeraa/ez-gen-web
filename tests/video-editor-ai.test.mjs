import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import {readAiIntents,sameAiDraft,aiDurationNotice} from '../src/lib/video-editor-ai-state.ts';

const originalFetch=globalThis.fetch;
const source=fs.readFileSync(new URL('../src/lib/video-editor-ai-api.ts',import.meta.url),'utf8');
const dependency=pathToFileURL(path.resolve('src/lib/video-editor-api.ts')).href;
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('from "./video-editor-api"',`from "${dependency}"`);
const {videoEditorAiApi,parseAiJob}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const segment={id:'segment-1',assetId:'asset-1',start:0,end:2,volume:0,title:'Opening',reason:'Source evidence',evidenceId:'window-1'};
const create={requestId:'stable-create',revision:3,assetIds:['asset-1'],brief:'Cafe',targetDuration:15,style:'warm',audioMode:'keep',removeSilence:true,cloudConsent:true};
const job={id:'job-1',projectId:'project-1',sourceRevision:3,phase:'analysis',status:'queued',stage:'queued',assetIds:['asset-1'],brief:'Cafe',targetDuration:15,style:'warm',audioMode:'keep',removeSilence:true,progress:{completedAssets:0,totalAssets:1},transcripts:[],visuals:[],concepts:[],selectedConceptId:null,draft:null,failureCode:'',failureMessage:'',canRetry:false,retryAt:null,cloudCallsUsed:0,cloudCallsLimit:6,createdAt:'2026-10-27T00:00:00Z',updatedAt:'2026-10-27T00:00:00Z',appliedRevision:null};

test('restored request intents are isolated by authenticated owner and project',()=>{
 const saved=JSON.stringify({version:1,ownerId:'owner-a',projectId:'project-1',create});
 assert.deepEqual(readAiIntents(saved,'owner-a','project-1').create,create);
 assert.equal(readAiIntents(saved,'owner-b','project-1').create,undefined);
 assert.equal(readAiIntents(saved,'owner-a','project-2').create,undefined);
 assert.equal(readAiIntents('{broken','owner-a','project-1').create,undefined);
});
test('intent restoration keeps original paid-action identity and drops unexpected source credentials',()=>{
 const apply={jobId:'job-1',body:{requestId:'original-apply',revision:3,draftRevision:2,approvedSegmentIds:['segment-1']}};
 const restored=readAiIntents(JSON.stringify({version:1,ownerId:'owner-a',projectId:'project-1',create:{...create,sourceKey:'private-storage',apiKey:'never-forward'},apply}),'owner-a','project-1');
 assert.deepEqual(restored.apply,apply);
 assert.deepEqual(restored.create,create);
 assert.equal('apiKey' in restored.create,false);
});
test('draft reconciliation compares order, trim and volume instead of only matching IDs',()=>{
 const second={...segment,id:'segment-2',start:4,end:6,volume:1};
 assert.equal(sameAiDraft([segment,second],[{...segment},{...second}]),true);
 assert.equal(sameAiDraft([segment,second],[second,segment]),false);
 assert.equal(sameAiDraft([segment],[{...segment,volume:1}]),false);
 assert.equal(sameAiDraft([segment],[{...segment,end:3}]),false);
 const stored=readAiIntents(JSON.stringify({version:1,ownerId:'owner-a',projectId:'project-1',localDraft:{jobId:'job-1',revision:2,segments:[{...segment,end:NaN}]}}),'owner-a','project-1');
 assert.equal(stored.localDraft,undefined);
});
test('provider quota errors remain failures and do not trigger automatic requests or fallback',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({code:'AI_RATE_LIMITED',message:'Wait for quota'},{status:429});};
 try{await assert.rejects(videoEditorAiApi.create('project-1',create),error=>error.code==='AI_RATE_LIMITED'&&error.status===429);assert.equal(calls,1);}finally{globalThis.fetch=originalFetch;}
});
test('explicit retry can submit exactly the original create body after an unknown transport outcome',async()=>{
 const bodies=[];globalThis.fetch=async(url,options)=>{bodies.push(JSON.parse(options.body));if(bodies.length===1)throw new TypeError('response lost');return Response.json({data:job},{status:202});};
 try{await assert.rejects(videoEditorAiApi.create('project-1',create),error=>error.code==='NETWORK_ERROR');const result=await videoEditorAiApi.create('project-1',create);assert.equal(result.id,job.id);assert.deepEqual(bodies,[create,create]);}finally{globalThis.fetch=originalFetch;}
});
test('apply preserves both revision guards and the exact approved set',async()=>{
 let body;globalThis.fetch=async(url,options)=>{body=JSON.parse(options.body);return Response.json({data:{id:'project-1',revision:4}});};
 try{const request={requestId:'same-apply',revision:3,draftRevision:2,approvedSegmentIds:['segment-1']};await videoEditorAiApi.apply('job-1',request);assert.deepEqual(body,request);}finally{globalThis.fetch=originalFetch;}
});
test('invalid job states and missing evidence lists do not become renderable success',()=>{
 assert.equal(parseAiJob(job).status,'queued');
 assert.throws(()=>parseAiJob({...job,status:'pretend_completed'}),error=>error.code==='INVALID_RESPONSE');
 assert.throws(()=>parseAiJob({...job,transcripts:null}),error=>error.code==='INVALID_RESPONSE');
 assert.throws(()=>parseAiJob({...job,draft:{revision:1,segments:null}}),error=>error.code==='INVALID_RESPONSE');
});
const rawTranscript={assetId:'asset-1',language:'th',hasSpeech:true,text:'วันนี้ กาแฟ หอม',segments:[{start:1,end:3,text:'วันนี้ กาแฟ',words:[]},{start:4,end:5,text:'หอม',words:[]}]};
const refinement={text:'วันนี้กาแฟ หอม',segments:[{segmentIndex:0,text:'วันนี้กาแฟ',uncertain:false},{segmentIndex:1,text:'หอม',uncertain:true}]};
test('refined transcript preserves raw source and indexed times while legacy and silent remain valid',()=>{
 const result=parseAiJob({...job,stage:'visual_analysis',status:'processing',transcripts:[{...rawTranscript,refinement}]});
 assert.deepEqual(result.transcripts[0],{...rawTranscript,refinement});
 assert.equal(parseAiJob({...job,transcripts:[rawTranscript]}).transcripts[0].refinement,undefined);
 assert.equal(parseAiJob({...job,transcripts:[{...rawTranscript,refinement:null}]}).transcripts[0].refinement,null);
 assert.equal(parseAiJob({...job,transcripts:[{assetId:'asset-1',language:'',hasSpeech:false,text:'',segments:[]}]}).transcripts[0].hasSpeech,false);
});
test('malformed refinement cannot render mislabeled, uncertain or incorrectly timed speech',()=>{
 const rejects=value=>assert.throws(()=>parseAiJob({...job,transcripts:[{...rawTranscript,refinement:value}]}),error=>error.code==='INVALID_RESPONSE');
 for(const value of [{}, {...refinement,segments:null}, {...refinement,segments:[refinement.segments[0]]}, {...refinement,segments:[refinement.segments[0],refinement.segments[0]]}, {...refinement,segments:[refinement.segments[0],{...refinement.segments[1],segmentIndex:2}]}, {...refinement,segments:[refinement.segments[0],{...refinement.segments[1],segmentIndex:0.5}]}, {...refinement,segments:[refinement.segments[0],{...refinement.segments[1],text:'invented'}]}, {...refinement,segments:[refinement.segments[0],{...refinement.segments[1],uncertain:'yes'}]}])rejects(value);
 assert.throws(()=>parseAiJob({...job,transcripts:[{...rawTranscript,segments:[null]}]}),error=>error.code==='INVALID_RESPONSE');
});

const durationConcept={id:'concept-1',title:'เรื่องต่อเนื่อง',summary:'เรื่องจากต้นฉบับ',duration:30,durationReason:'ช่วงเสียงที่เชื่อมกันได้มีขอบเขต 30 วินาที'};
test('duration explanations are optional for legacy but malformed notices cannot enter the UI',()=>{
 assert.equal(parseAiJob({...job,targetDuration:60,concepts:[durationConcept]}).concepts[0].durationReason,durationConcept.durationReason);
 assert.equal(parseAiJob({...job,concepts:[{...durationConcept,durationReason:undefined}]}).concepts[0].durationReason,undefined);
 const draft={revision:1,duration:30,segments:[{...segment,end:30}],durationReason:'เลือกช่วงต่อเนื่องที่สั้นกว่าเป้า'};
 assert.equal(parseAiJob({...job,targetDuration:60,draft}).draft.durationReason,draft.durationReason);
 assert.equal(parseAiJob({...job,draft:{...draft,durationReason:undefined}}).draft.durationReason,undefined);
 assert.equal(parseAiJob({...job,concepts:[{...durationConcept,durationReason:'😀'.repeat(2000)}]}).concepts[0].durationReason,'😀'.repeat(2000));
 for(const reason of [null,4,{},'x'.repeat(2001),'😀'.repeat(2001)]) {
  assert.throws(()=>parseAiJob({...job,concepts:[{...durationConcept,durationReason:reason}]}),error=>error.code==='INVALID_RESPONSE');
  assert.throws(()=>parseAiJob({...job,draft:{...draft,durationReason:reason}}),error=>error.code==='INVALID_RESPONSE');
 }
});
test('shortfall notices remain informational and use live draft length without stale explanations',()=>{
 assert.equal(aiDurationNotice(60,30,durationConcept.durationReason),durationConcept.durationReason);
 assert.equal(aiDurationNotice(60,57,durationConcept.durationReason),null);
 assert.equal(aiDurationNotice(60,60),null);
 assert.match(aiDurationNotice(60,30),/ไม่มีรายละเอียดเหตุผล/);
 assert.doesNotMatch(aiDurationNotice(60,30,'มีฟุตเทจไม่พอ',true),/ฟุตเทจไม่พอ/);
 assert.match(aiDurationNotice(60,30,'มีฟุตเทจไม่พอ',true),/คุณปรับ/);
});

test('auto-compose pending request keeps its original opt-in across transport retry',()=>{
 const auto={...create,autoCompose:true};
 assert.deepEqual(readAiIntents(JSON.stringify({version:1,ownerId:'owner-a',projectId:'project-1',create:auto}),'owner-a','project-1').create,auto);
});
test('composed drafts accept legacy omissions and validate new audio/text ownership and bounds',()=>{
 const originJobId='da49c216-075b-49b4-b695-5e1633d02763';
 const text={id:'t',text:'สรุปไฮไลต์',start:0,end:2,x:.5,y:.8,fontSize:48,color:'#FFFFFF',align:'center',scaleX:1.2,originJobId};
 const audio={id:'a',assetId:'music',at:0,start:1,end:3,volume:.2,originJobId};
 const composed={revision:1,duration:2,segments:[segment],textLayers:[text],audioClips:[audio],compositionNotes:['ใช้เสียงต้นฉบับ']};
 assert.equal(parseAiJob({...job,autoCompose:true,draft:composed}).draft.textLayers[0].originJobId,originJobId);
 assert.equal(parseAiJob({...job,draft:{revision:1,segments:[segment]}}).draft.audioClips,undefined);
 for(const patch of [{audioClips:[{...audio,at:NaN}]},{audioClips:[{...audio,originJobId:'bad'}]},{textLayers:[{...text,scaleX:20}]},{textLayers:[{...text,end:-1}]},{compositionNotes:[null]}])assert.throws(()=>parseAiJob({...job,draft:{...composed,...patch}}),e=>e.code==='INVALID_RESPONSE');
 assert.throws(()=>parseAiJob({...job,autoCompose:'true'}),e=>e.code==='INVALID_RESPONSE');
});
