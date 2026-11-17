import {createRequire} from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
// Same harness as video-editor-ai-duration.browser.mjs: mocked proxy JSON, real Next components in Chrome.
const load=createRequire(import.meta.url);
const {chromium}=load(process.env.PLAYWRIGHT_MODULE || '/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:13199',dir=process.env.ARTIFACT_DIR||'/private/tmp/ezgen-instruction-web';
fs.mkdirSync(dir,{recursive:true});
const stamp='2026-11-08T00:00:00Z';
const asset={id:'a1',projectId:'p1',clientUploadId:'u1',kind:'video',name:'คลิปทดสอบ.mp4',status:'ready',duration:10,width:100,height:100,hasAudio:true,sizeBytes:100,previewUrl:null,frames:[],expiresAt:null,failureCode:'',failureMessage:''};
const segment={id:'s1',assetId:'a1',start:0,end:6,volume:1};
const project={id:'p1',title:'แก้ด้วยคำสั่ง',aspectRatio:'9:16',revision:4,createdAt:stamp,updatedAt:stamp,segments:[segment],assets:[asset],audioClips:[],textLayers:[]};
const caps={available:true,unavailableReason:'',instructionEdits:true,autoCompose:true,transcriptionAvailable:true,analysisAvailable:true,maxAssets:8,maxSourceDuration:600,maxFrames:24,maxTargetDuration:120,maxSegments:20,maxJobsPerDay:20,maxCloudCalls:6,cloudNotice:'Local fixture only',connectionMode:'fixture',supportedOptions:{removeSilence:true,filler:false,shaky:false,subtitles:true,music:true}};
// No imageLayers: a server without image-layer support omits it, and the PUT must omit it too.
const proposal={title:project.title,aspectRatio:'9:16',segments:[{...segment,speed:1.5}],audioClips:[],textLayers:[{id:'t1',text:'โปรโมชันวันนี้',start:0,end:2,x:.5,y:.8,fontSize:48,color:'#FFFFFF',align:'center'}]};
const preview={baseRevision:4,summary:'เร่งฉากแรกและเพิ่มข้อความเปิด',operations:[{tool:'set_segment',target:'s1',description:'เร่งฉากแรกเป็น 1.5 เท่า'},{tool:'add_text',target:'t1',description:'เพิ่มข้อความเปิด'}],proposal};
const fixture=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({success:true,payload:{id:'owner1',displayName:'Fixture',email:'fixture@example.invalid',plan:'fixture'}}));});
(async()=>{await new Promise((r,j)=>{fixture.once('error',j);fixture.listen(18199,'127.0.0.1',r)});const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const results=[];
try{for(const width of [1440,375]){const context=await browser.newContext({viewport:{width,height:1000}});await context.addCookies([{name:'ezgen_session',value:'local-instruction-fixture',url:base}]);const page=await context.newPage(),errors=[],puts=[];let current=structuredClone(project),previewReply={status:200,json:{success:true,payload:preview}};page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/proxy/**',async route=>{const request=route.request(),path=new URL(request.url()).pathname.replace('/api/proxy/','');let data;
if(path==='auth/me')data={id:'owner1'};else if(path==='video-editor/capabilities')data={available:true,unavailableReason:'',maxUploadBytes:52428800,maxSegments:20,maxDuration:1200,aspectRatios:['9:16'],resolutions:['720p'],maxAudioClips:20,maxTextLayers:50,clipEffects:true,clipStyles:true};else if(path==='video-editor/ai-capabilities')data=caps;else if(path==='video-editor/projects')data={items:[current],total:1,page:1,limit:20};
else if(path==='video-editor/projects/p1'&&request.method()==='PUT'){const body=request.postDataJSON();puts.push(body);current={...current,...body,revision:current.revision+1,assets:[asset]};delete current.imageLayers;data=current;}
else if(path==='video-editor/projects/p1')data=current;else if(path==='video-editor/projects/p1/assets')data={items:[asset]};else if(path==='video-editor/projects/p1/exports')data={items:[]};else if(path==='video-editor/projects/p1/ai-jobs')data={items:[]};
else if(path==='video-editor/projects/p1/ai-edits/preview'){assert.deepEqual(request.postDataJSON(),{instruction:'เร่งฉากแรกเป็น 1.5 เท่า',revision:current.revision});return route.fulfill(previewReply);}
else return route.fulfill({status:404,json:{message:'Unexpected fixture path '+path}});await route.fulfill({json:{data}});});
await page.goto(base+'/studio/ai-editor?project=p1',{waitUntil:'domcontentloaded'});await page.getByLabel('ชื่อโปรเจกต์').waitFor();await page.getByRole('button',{name:'AI',exact:true}).click();
const instruct=page.getByRole('button',{name:'แก้ด้วยคำสั่ง',exact:true});await instruct.waitFor();assert.equal(await instruct.getAttribute('aria-pressed'),'true','timeline with clips defaults to instruction mode');
await page.getByRole('button',{name:'ตัดต่อจากคลิป',exact:true}).click();await page.getByText('1. เลือกคลิป',{exact:true}).waitFor();await instruct.click();
await page.getByText(/ไม่ส่งภาพ วิดีโอ หรือบทพูด/).waitFor();
const box=page.getByLabel('บอกสิ่งที่อยากเปลี่ยน');previewReply={status:422,json:{success:false,message:'x',payload:{errorCode:'AI_EDIT_NO_CHANGES'}}};await box.fill('เร่งฉากแรกเป็น 1.5 เท่า');await page.getByText('23/500 ตัวอักษร',{exact:true}).waitFor();await page.getByRole('button',{name:'ดูตัวอย่างการแก้',exact:true}).click();await page.getByRole('alert').filter({hasText:'AI ไม่พบสิ่งที่แก้ได้'}).waitFor();
previewReply={status:200,json:{success:true,payload:preview}};await page.getByRole('button',{name:'ดูตัวอย่างการแก้',exact:true}).click();const region=page.getByRole('region',{name:'ตัวอย่างการแก้'});await region.getByText('เร่งฉากแรกและเพิ่มข้อความเปิด',{exact:true}).waitFor();
assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'เร่งฉากแรกและเพิ่มข้อความเปิด','focus moves to the summary');
assert(await region.getByText('เพิ่มข้อความ',{exact:true}).isVisible());const rows=await region.locator('tbody tr').allTextContents();assert.deepEqual(rows,['คลิปวิดีโอ1 ช่วง1 ช่วง','ข้อความ0 ชั้น1 ชั้น','รูปภาพ0 ชั้น0 ชั้น','ความยาว0:06.00:04.0']);
await page.screenshot({path:dir+`/preview-${width}.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await region.getByRole('button',{name:'นำไปใช้',exact:true}).click();await page.getByText(/นำการแก้ไปใช้กับ timeline แล้ว/).waitFor();
assert.equal(puts.length,1);assert.equal(puts[0].revision,4);assert.equal('imageLayers' in puts[0],false,'absent imageLayers stays absent');assert.equal(puts[0].segments[0].speed,1.5);
assert.equal(await page.locator('[data-text-clip]').count(),1);assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'TEXTAREA','focus returns to the instruction');
await page.keyboard.press('Control+z');assert.equal(await page.locator('[data-text-clip]').count(),0,'apply can be undone');
assert.deepEqual(errors,[]);results.push({width,scenarios:['default instruction mode','mode switch','privacy notice','422 no changes','preview summary focus','before/after rows','apply PUT baseRevision without imageLayers','focus return','undo'],boundary:'Mock HTTP API/auth with real Next components and Chrome; no provider or real API persistence asserted'});await context.close();}
fs.writeFileSync(dir+'/browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({status:'PASS',results}));}finally{await browser.close();fixture.close();}})().catch(e=>{console.error(e);fixture.close();process.exitCode=1});
