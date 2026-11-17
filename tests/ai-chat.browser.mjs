import {createRequire} from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
// Same harness as video-editor-ai-instruction.browser.mjs: mocked proxy JSON/SSE, real Next components in Chrome.
// Start the web app with NEXT_PUBLIC_AI_CHAT_EDITOR=true (build-time flag) and API_URL=http://127.0.0.1:18199.
const load=createRequire(import.meta.url);
const {chromium}=load(process.env.PLAYWRIGHT_MODULE || '/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:13199',dir=process.env.ARTIFACT_DIR||'/private/tmp/ezgen-ai-chat-web';
fs.mkdirSync(dir,{recursive:true});
const stamp='2026-11-09T00:00:00Z';
const asset={id:'a1',projectId:'p1',clientUploadId:'u1',kind:'video',name:'คลิปทดสอบ.mp4',status:'ready',duration:10,width:100,height:100,hasAudio:true,sizeBytes:100,previewUrl:null,frames:[],expiresAt:null,failureCode:'',failureMessage:''};
const segment={id:'s1',assetId:'a1',start:0,end:6,volume:1};
const project={id:'p1',title:'แชทตัดต่อ',aspectRatio:'9:16',revision:4,createdAt:stamp,updatedAt:stamp,segments:[segment],assets:[asset],audioClips:[],textLayers:[]};
const caps={available:true,unavailableReason:'',instructionEdits:true,autoCompose:true,transcriptionAvailable:true,analysisAvailable:true,maxAssets:8,maxSourceDuration:600,maxFrames:24,maxTargetDuration:120,maxSegments:20,maxJobsPerDay:20,maxCloudCalls:6,cloudNotice:'Local fixture only',connectionMode:'fixture',supportedOptions:{removeSilence:true,filler:false,shaky:false,subtitles:true,music:true}};
const text={id:'t1',text:'โปรโมชันวันนี้',start:0,end:2,x:.5,y:.8,fontSize:48,color:'#FFFFFF',align:'center'};
const proposalOf=(status)=>({baseRevision:4,summary:'ใส่ข้อความเปิดแล้ว',operations:[{tool:'add_text',target:'t1',description:'เพิ่มข้อความเปิด'}],proposal:{title:project.title,aspectRatio:'9:16',segments:[segment],audioClips:[],textLayers:[text]},status});
const old={id:'m0',role:'assistant',content:'',createdAt:stamp,tools:[],error:'AI_TIMEOUT'};
const userMsg={id:'m1',role:'user',content:'ใส่ข้อความเปิดว่า โปรโมชันวันนี้',createdAt:stamp,tools:[]};
const reply={id:'m2',role:'assistant',content:'ใส่ข้อความเปิดให้แล้ว กดนำไปใช้ได้เลย',createdAt:stamp,tools:[{name:'edit_timeline',label:'แก้ timeline',ok:true}],proposal:proposalOf('pending')};
const sse=(...events)=>events.map(e=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
const fixture=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({success:true,payload:{id:'owner1',displayName:'Fixture',email:'fixture@example.invalid',plan:'fixture'}}));});
(async()=>{await new Promise((r,j)=>{fixture.once('error',j);fixture.listen(18199,'127.0.0.1',r)});const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const results=[];
try{for(const width of [1440,375]){const context=await browser.newContext({viewport:{width,height:1000}});await context.addCookies([{name:'ezgen_session',value:'local-chat-fixture',url:base}]);const page=await context.newPage(),errors=[],sent=[];
let current=structuredClone(project),messages=[old],threadGate=null,threadFails=1,applyReply=null,clears=0;page.on('pageerror',e=>errors.push(e.message));
const thread=()=>({available:true,provider:'gemini',model:'fixture',cloudNotice:'ข้อความจะถูกส่งไปยังผู้ให้บริการ AI (fixture)',maxMessageLength:2000,messages});
await page.route('**/api/proxy/**',async route=>{const request=route.request(),path=new URL(request.url()).pathname.replace('/api/proxy/','');let data;
if(path==='auth/me')data={id:'owner1'};else if(path==='video-editor/capabilities')data={available:true,unavailableReason:'',maxUploadBytes:52428800,maxSegments:20,maxDuration:1200,aspectRatios:['9:16'],resolutions:['720p'],maxAudioClips:20,maxTextLayers:50,clipEffects:true,clipStyles:true};else if(path==='video-editor/ai-capabilities')data=caps;else if(path==='video-editor/projects')data={items:[current],total:1,page:1,limit:20};
else if(path==='video-editor/projects/p1')data=current;else if(path==='video-editor/projects/p1/assets')data={items:[asset]};else if(path==='video-editor/projects/p1/exports')data={items:[]};else if(path==='video-editor/projects/p1/ai-jobs')data={items:[]};
else if(path==='video-editor/projects/p1/ai-chat'){if(threadGate)await threadGate;if(threadFails>0){threadFails--;return route.fulfill({status:500,json:{success:false,message:'โหลดไม่ได้ (fixture)',payload:{errorCode:'INTERNAL'}}});}if(request.method()==='DELETE'){clears++;messages=[];}data=thread();}
else if(path==='video-editor/projects/p1/ai-chat/messages'){const body=request.postDataJSON();sent.push(body);assert.deepEqual(body,{message:userMsg.content,cloudConsent:true});messages=[old,userMsg,reply];
  return route.fulfill({status:200,contentType:'text/event-stream; charset=utf-8',body:sse({type:'status',tool:'thinking',label:'กำลังคิด'},{type:'status',tool:'edit_timeline',label:'แก้ timeline'},{type:'message',message:reply})});}
else if(path==='video-editor/projects/p1/ai-chat/messages/m2/apply'){if(applyReply)return route.fulfill(applyReply);current={...current,textLayers:[text],revision:5};const applied={...reply,proposal:{...proposalOf('applied'),appliedRevision:5}};messages=[old,userMsg,applied];data={message:applied,project:current};}
else return route.fulfill({status:404,json:{message:'Unexpected fixture path '+path}});await route.fulfill({json:{data}});});
await page.goto(base+'/studio/ai-editor?project=p1',{waitUntil:'domcontentloaded'});await page.getByLabel('ชื่อโปรเจกต์').waitFor();
// 1) skeleton while the thread loads, then a retry after a failed load
let open;threadGate=new Promise(r=>open=r);await page.getByRole('button',{name:'แชท',exact:true}).click();
await page.getByTestId('ai-chat-skeleton').waitFor();await page.screenshot({path:dir+`/skeleton-${width}.png`});threadGate=null;open();
await page.getByRole('button',{name:'ลองใหม่',exact:true}).click();await page.getByTestId('ai-chat-skeleton').waitFor({state:'detached'});
// 2) opening the project starts a new conversation: the stored thread is cleared, old messages are gone
await page.getByText('บอก AI ว่าอยากได้วิดีโอแบบไหน',{exact:true}).waitFor();assert(clears>=1,'thread cleared on open');assert.equal(await page.getByText(/AI ตอบไม่ทันเวลา|AI_TIMEOUT/).count(),0,'old messages are not shown');
// 3) consent, then a streamed reply with a proposal card
const box=page.getByLabel('ข้อความถึง AI');await box.fill(userMsg.content);await page.getByRole('button',{name:'ส่ง',exact:true}).click();
const consent=page.getByRole('dialog',{name:'ยินยอมส่งข้อมูล'});await consent.waitFor();assert.equal(sent.length,0,'nothing is sent before consent');await consent.getByRole('button',{name:'ยอมรับและส่ง'}).click();
const card=page.getByLabel('ข้อเสนอการแก้ timeline');await card.getByText('เพิ่มข้อความเปิด').waitFor();assert.equal(sent.length,1);assert.equal(await card.getByText('รอยืนยัน',{exact:true}).count(),1);
await page.screenshot({path:dir+`/proposal-${width}.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
// 4) apply after another tab already used the proposal: own message, no revision-conflict wording
applyReply={status:409,json:{success:false,message:'ข้อเสนอนี้ถูกใช้ ยกเลิก หรือหมดอายุแล้ว',payload:{errorCode:'AI_PROPOSAL_NOT_PENDING'}}};await card.getByRole('button',{name:'นำไปใช้'}).click();
await page.getByRole('alert').filter({hasText:'ข้อเสนอนี้ถูกใช้หรือยกเลิกไปแล้ว'}).waitFor();
// 5) a normal apply lands on the timeline and can be undone
applyReply=null;await card.getByRole('button',{name:'นำไปใช้'}).click();await card.getByText('ใช้แล้ว',{exact:true}).waitFor();
assert.equal(await page.locator('[data-text-clip]').count(),1,'applied text layer is on the timeline');
await page.keyboard.press('Control+z');assert.equal(await page.locator('[data-text-clip]').count(),0,'apply can be undone');
assert.deepEqual(errors,[]);results.push({width,scenarios:['thread skeleton','load failure retry','reopen clears history','consent before send','SSE status + stored reply','proposal card','409 AI_PROPOSAL_NOT_PENDING message','apply to timeline','undo'],boundary:'Mock HTTP API/auth with real Next components and Chrome; no provider, DB or real SSE server asserted'});await context.close();}
fs.writeFileSync(dir+'/browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({status:'PASS',results}));}finally{await browser.close();fixture.close();}})().catch(e=>{console.error(e);fixture.close();process.exitCode=1});
