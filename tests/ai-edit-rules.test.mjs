import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {compareTimelines,draftEffectBadges,formatClock,instructionEditError,instructionIssue,instructionLength,patchDraftRange,removeDraftEffect,toolLabel,INSTRUCTION_MAX} from '../src/components/ai-editor/ai-edit-rules.ts';
import {readAiIntents,sameAiDraft,staleJobUpdate} from '../src/lib/video-editor-ai-state.ts';

const originalFetch=globalThis.fetch;
const source=fs.readFileSync(new URL('../src/lib/video-editor-ai-api.ts',import.meta.url),'utf8');
const dependency=pathToFileURL(path.resolve('src/lib/video-editor-api.ts')).href;
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('from "./video-editor-api"',`from "${dependency}"`);
const {videoEditorAiApi,parseAiEditPreview}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));

const base={id:'s1',assetId:'a1',start:0,end:4,volume:1,title:'เปิดเรื่อง',reason:'model reason',evidenceId:'w1'};
const proposal={title:'โปรเจกต์',aspectRatio:'9:16',segments:[{id:'s1',assetId:'a1',start:0,end:4,volume:1,speed:1.5}],audioClips:[],textLayers:[{id:'t1',text:'สวัสดี',start:0,end:2,x:.5,y:.8,fontSize:48,color:'#FFFFFF',align:'center'}],imageLayers:[]};
const preview={baseRevision:7,summary:'เร่งฉากแรกและเพิ่มข้อความเปิด',operations:[{tool:'set_segment',target:'s1',description:'เร่งฉากแรกเป็น 1.5 เท่า'}],proposal};

test('clock rounds to tenths before splitting minutes (no 0:60.0)',()=>{
  assert.equal(formatClock(59.96),'1:00.0');
  assert.equal(formatClock(61.24),'1:01.2');
  assert.equal(formatClock(-3),'0:00.0');
  assert.equal(formatClock(Number.NaN),'0:00.0');
});

test('draft effect badges are Thai, skip defaults and can be removed one group at a time',()=>{
  const segment={...base,speed:1.5,fadeIn:.5,transition:'fade',transitionDuration:.4,saturation:.3,zoom:1.2};
  const badges=draftEffectBadges(segment,id=>id==='fade'?'ครอสเฟด':undefined);
  assert.deepEqual(badges.map(item=>item.label),['1.5×','เฟดเข้า 0.5 วิ','ครอสเฟด 0.4 วิ','ปรับสี','ซูม 120%']);
  assert.deepEqual(draftEffectBadges({...base,speed:1,zoom:1,brightness:0}),[]);
  const withoutTransition=removeDraftEffect(segment,'transition');
  assert.equal('transition' in withoutTransition,false);assert.equal('transitionDuration' in withoutTransition,false);
  assert.equal(withoutTransition.speed,1.5,'other effects stay');
  assert.equal(segment.transition,'fade','input is not mutated');
  const plain=removeDraftEffect(removeDraftEffect(removeDraftEffect(removeDraftEffect(withoutTransition,'speed'),'fadeIn'),'look'),'frame');
  assert.deepEqual(plain,base);
});

test('draft range edits stay inside the source and ignore non-numbers',()=>{
  assert.deepEqual(patchDraftRange({start:2,end:5},'start',9,10),{start:4.9,end:5});
  assert.deepEqual(patchDraftRange({start:2,end:5},'end',12,10),{start:2,end:10});
  assert.deepEqual(patchDraftRange({start:2,end:5},'end',0,10),{start:2,end:2.1});
  assert.equal(patchDraftRange({start:2,end:5},'start',Number.NaN,10),undefined);
});

test('instruction length counts characters, not UTF-16 units, and enforces 1-500',()=>{
  assert.equal(instructionLength('  ตัดฉากแรก  '),9);
  assert.equal(instructionLength('😀'),1);
  assert.match(instructionIssue('   '),/พิมพ์/);
  assert.equal(instructionIssue('ก'.repeat(INSTRUCTION_MAX)),null);
  assert.match(instructionIssue('ก'.repeat(INSTRUCTION_MAX+1)),/500/);
});

test('instruction errors map contract statuses to Thai guidance',()=>{
  const error=(status,code,message='server text')=>Object.assign(new Error(message),{status,code});
  assert.match(instructionEditError(error(422,'AI_EDIT_NO_CHANGES','AI ไม่พบการแก้ไขที่ใช้ได้จากคำสั่งนี้')),/ไม่พบสิ่งที่แก้ได้/,'generic server text becomes the Thai hint');
  assert.match(instructionEditError(error(422,'AI_EDIT_NO_CHANGES','')),/ไม่พบสิ่งที่แก้ได้/);
  assert.equal(instructionEditError(error(422,'AI_EDIT_NO_CHANGES','ไม่มีคลิปเสียงให้ปรับ')),'AI แก้ไม่ได้: ไม่มีคลิปเสียงให้ปรับ','the model reason is shown');
  assert.match(instructionEditError(error(429,'AI_DAILY_LIMIT')),/ครบโควตาวันนี้/);
  assert.match(instructionEditError(error(429,'AI_RATE_LIMITED')),/รอสักครู่/);
  assert.equal(instructionEditError(error(429,'SOMETHING_NEW','รอ 1 นาที')),'รอ 1 นาที','unknown codes use the server message');
  assert.match(instructionEditError(error(503,'AI_UNAVAILABLE')),/ยังไม่พร้อม/);
  assert.match(instructionEditError(error(503,'AI_PROVIDER_UNAVAILABLE')),/เชื่อมต่อผู้ให้บริการ/);
  assert.match(instructionEditError(error(422,'AI_INVALID_RESULT')),/รูปแบบที่ใช้ไม่ได้/);
  assert.match(instructionEditError(error(422,'AI_INPUT_TOO_LARGE')),/มากเกิน/);
  assert.equal(instructionEditError(error(422,'OTHER_422','ข้อความจากเซิร์ฟเวอร์')),'ข้อความจากเซิร์ฟเวอร์');
  assert.match(instructionEditError(error(409,'REVISION_CONFLICT')),/ฉบับใหม่/);
  assert.match(instructionEditError(error(404,'NOT_FOUND')),/ไม่พบโปรเจกต์/);
  assert.equal(instructionEditError(error(400,'VALIDATION_ERROR','คำสั่งยาวเกินไป')),'คำสั่งยาวเกินไป');
  assert.equal(toolLabel('delete_segment'),'ลบคลิป');assert.equal(toolLabel('unknown_tool'),'แก้ไข');
});

test('a proposal without imageLayers is accepted and counted as unchanged image layers',()=>{
  const {imageLayers,...withoutImages}=proposal;
  const parsed=parseAiEditPreview({...preview,proposal:withoutImages});
  assert.equal('imageLayers' in parsed.proposal,false,'absent stays absent so PUT keeps stored image layers');
  assert.equal(JSON.stringify({...parsed.proposal,revision:7}).includes('imageLayers'),false);
  const rows=compareTimelines({segments:[1],textLayers:[],imageLayers:[1,2]},5,withoutImages,5);
  assert.deepEqual(rows.find(row=>row.label==='รูปภาพ'),{label:'รูปภาพ',before:'2 ชั้น',after:'2 ชั้น',changed:false});
  assert.equal(imageLayers.length,0);
});

test('before/after rows flag only what changed and use the caller duration',()=>{
  const rows=compareTimelines({segments:[1,2],textLayers:[],imageLayers:[1]},10,{segments:[1,2],textLayers:[1],imageLayers:[1]},8.04);
  assert.deepEqual(rows.map(row=>[row.label,row.before,row.after,row.changed]),[['คลิปวิดีโอ','2 ช่วง','2 ช่วง',false],['ข้อความ','0 ชั้น','1 ชั้น',true],['รูปภาพ','1 ชั้น','1 ชั้น',false],['ความยาว','0:10.0','0:08.0',true]]);
});

test('draft identity includes effects so removing a badge is a saved edit',()=>{
  assert.equal(sameAiDraft([{...base,speed:2}],[{...base,speed:2}]),true);
  assert.equal(sameAiDraft([{...base,speed:2}],[base]),false);
  assert.equal(sameAiDraft([{...base,transition:'fade',transitionDuration:.5}],[base]),false);
  assert.equal(sameAiDraft([{...base,zoom:1.5}],[{...base,fit:'cover',zoom:1.5}]),false);
});

test('restored local drafts keep typed effects and drop unknown or mistyped fields',()=>{
  const localDraft={jobId:'job-1',revision:2,segments:[{...base,speed:1.5,transition:'fade',transitionDuration:.5,fit:'cover',zoom:'2',signedUrl:'https://x'}]};
  const restored=readAiIntents(JSON.stringify({version:1,ownerId:'o',projectId:'p',localDraft}),'o','p');
  assert.deepEqual(restored.localDraft.segments,[{...base,speed:1.5,transition:'fade',transitionDuration:.5,fit:'cover'}]);
});

test('an older poll response cannot roll back the shown job',()=>{
  const shown={id:'j',updatedAt:'2026-11-08T10:00:05Z',draft:{revision:3}};
  assert.equal(staleJobUpdate(shown,{id:'j',updatedAt:'2026-11-08T10:00:01Z',draft:{revision:3}}),true);
  assert.equal(staleJobUpdate(shown,{id:'j',updatedAt:'2026-11-08T10:00:05Z',draft:{revision:2}}),true);
  assert.equal(staleJobUpdate(shown,{id:'j',updatedAt:'2026-11-08T10:00:09Z',draft:{revision:4}}),false);
  assert.equal(staleJobUpdate(shown,{id:'other',updatedAt:'2026-11-08T09:00:00Z',draft:null}),false);
  assert.equal(staleJobUpdate(null,shown),false);
});

test('instruction preview client posts the contract body and validates the proposal',async()=>{
  const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,method:options.method,body:JSON.parse(options.body)});return Response.json({data:preview});};
  try{
    const result=await videoEditorAiApi.previewEdit('p/1',{instruction:'เร่งฉากแรก',revision:7});
    assert.deepEqual(calls,[{url:'/api/proxy/video-editor/projects/p%2F1/ai-edits/preview',method:'POST',body:{instruction:'เร่งฉากแรก',revision:7}}]);
    assert.equal(result.baseRevision,7);assert.equal(result.proposal.segments[0].speed,1.5);
  }finally{globalThis.fetch=originalFetch;}
  for(const broken of [{...preview,baseRevision:1.5},{...preview,operations:[{tool:'x'}]},{...preview,proposal:{...proposal,textLayers:undefined}},{...preview,proposal:{...proposal,imageLayers:'none'}},{...preview,proposal:{...proposal,aspectRatio:'4:3'}},{...preview,proposal:{...proposal,segments:[{id:'s1',start:0,end:1}]}}])
    assert.throws(()=>parseAiEditPreview(broken),error=>error.code==='INVALID_RESPONSE');
});

test('instruction preview errors keep status and code for the UI',async()=>{
  for(const [status,code] of [[422,'AI_EDIT_NO_CHANGES'],[429,'AI_DAILY_LIMIT'],[503,'AI_PROVIDER_UNAVAILABLE'],[503,'AI_UNAVAILABLE'],[409,'REVISION_CONFLICT']]){
    globalThis.fetch=async()=>Response.json({code,message:'x'},{status});
    try{await assert.rejects(videoEditorAiApi.previewEdit('p',{instruction:'ก',revision:1}),error=>error.status===status&&error.code===code);}finally{globalThis.fetch=originalFetch;}
  }
});

test('capabilities reject a non-boolean instructionEdits flag and accept its absence',async()=>{
  const caps={available:true,unavailableReason:'',connectionMode:'configured',supportedOptions:{}};
  for(const [value,ok] of [[undefined,true],[true,true],['yes',false]]){
    globalThis.fetch=async()=>Response.json({data:{...caps,...(value===undefined?{}:{instructionEdits:value})}});
    try{if(ok)assert.equal((await videoEditorAiApi.capabilities()).instructionEdits,value);else await assert.rejects(videoEditorAiApi.capabilities(),error=>error.code==='INVALID_RESPONSE');}finally{globalThis.fetch=originalFetch;}
  }
});
