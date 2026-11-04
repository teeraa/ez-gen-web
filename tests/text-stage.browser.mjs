import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:13321',out='/private/tmp/ai-editor-stage-text';
const media=fs.readFileSync(`${out}/fixture.mp4`);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
try {
for (const width of [1440,768,375]) {
const page=await browser.newPage({viewport:{width,height:1000}});await page.context().addCookies([{name:'ezgen_session',value:'local-fixture',url:base}]);
const asset={id:'a1',projectId:'p1',clientUploadId:'u1',kind:'video',name:'Fixture.mp4',status:'ready',duration:6,width:640,height:360,hasAudio:true,sizeBytes:media.length,previewUrl:'/fixture.mp4',frames:[]};
let project={id:'p1',title:'Stage text fixture',aspectRatio:'16:9',revision:1,segments:[{id:'s1',assetId:'a1',start:0,end:6,volume:1}],audioClips:[],textLayers:[{id:'t1',text:'ข้อความ ทดสอบ',start:0,end:6,x:.5,y:.5,fontSize:120,color:'#FFFFFF',align:'center'}],assets:[asset],createdAt:'2026-11-02T00:00:00Z',updatedAt:'2026-11-02T00:00:00Z'};
let supported=true,saveFailure=false;const saves=[];
await page.route('**/fixture.mp4',route=>route.fulfill({contentType:'video/mp4',body:media}));
await page.route('**/api/proxy/**',async route=>{const path=new URL(route.request().url()).pathname.replace('/api/proxy/','');let data;
if(path==='video-editor/capabilities')data={available:true,maxUploadBytes:52428800,maxSegments:20,maxDuration:1200,maxAudioClips:20,maxTextLayers:50,textOverlays:true,...(supported?{textTransforms:true}:{}),aspectRatios:['16:9'],resolutions:['720p']};
else if(path==='video-editor/ai-capabilities')data={available:false,supportedOptions:{}};
else if(path==='video-editor/projects')data={items:[project],total:1,page:1,limit:20};
else if(path==='video-editor/projects/p1'&&route.request().method()==='PUT'){if(saveFailure)return route.fulfill({status:503,json:{message:'บันทึกไม่ได้ในชุดทดสอบ'}});await new Promise(resolve=>setTimeout(resolve,300));const body=route.request().postDataJSON();saves.push(body);project={...project,...body,revision:project.revision+1};data=project;}
else if(path==='video-editor/projects/p1')data=project;
else if(path.endsWith('/assets'))data={items:[asset]};else if(path.endsWith('/exports')||path.endsWith('/ai-jobs'))data={items:[]};else return route.fulfill({status:404,json:{message:'fixture unknown '+path}});
return route.fulfill({json:{data}});});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/studio/ai-editor?project=p1');const overlay=page.locator('[data-text-layer=t1]');await overlay.waitFor({state:'visible'});
await overlay.click();assert.equal(await overlay.getAttribute('data-selected'),'true');
const initial=await overlay.boundingBox();
async function drag(target,dx,dy){const box=await target.boundingBox();assert(box);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:8});await page.mouse.up();}
await drag(overlay,20,-15);let moved=await overlay.boundingBox();assert(moved.x>initial.x+10);assert(moved.y<initial.y-5);
await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(50);assert(Math.abs((await overlay.boundingBox()).x-initial.x)<2);
await page.keyboard.press('ControlOrMeta+Shift+z');await overlay.click();
const beforeWidth=await overlay.boundingBox();await drag(overlay.locator('[data-resize=width]'),12,0);const wide=await overlay.boundingBox();assert(wide.width>beforeWidth.width+10);assert(Math.abs(wide.height-beforeWidth.height)<2);
await drag(overlay.locator('[data-resize=height]'),0,8);const tall=await overlay.boundingBox();assert(tall.height>wide.height+8);
await overlay.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowDown');
const stable=await overlay.boundingBox();const centre={x:stable.x+stable.width/2,y:stable.y+stable.height/2};await page.mouse.move(centre.x,centre.y);await page.mouse.down();await page.mouse.move(centre.x+20,centre.y+10);await page.keyboard.press('Escape');await page.mouse.up();assert(Math.abs((await overlay.boundingBox()).x-stable.x)<2);await page.mouse.move(centre.x,centre.y);await page.mouse.down();await page.mouse.move(centre.x+15,centre.y+8);await overlay.dispatchEvent('pointercancel',{pointerId:1,isPrimary:true,bubbles:true});await page.mouse.up();assert(Math.abs((await overlay.boundingBox()).x-stable.x)<2);
await page.getByRole('button',{name:'บันทึกโปรเจกต์',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-text-layer=t1]').getAttribute('aria-disabled')==='true');assert.equal(await overlay.evaluate(el=>getComputedStyle(el).pointerEvents),'none');await page.waitForTimeout(450);assert(saves.at(-1).textLayers[0].scaleX>1);assert(saves.at(-1).textLayers[0].scaleY>1);
const saved=structuredClone(project.textLayers[0]);await page.reload();await overlay.waitFor({state:'visible'});await overlay.click();const restored=await overlay.boundingBox();assert(Math.abs(restored.width-stable.width)<3);
const styles=await overlay.evaluate(el=>({pointerEvents:getComputedStyle(el).pointerEvents,touchAction:getComputedStyle(el).touchAction,outline:getComputedStyle(el).outlineStyle}));assert.equal(styles.pointerEvents,'auto');assert.equal(styles.touchAction,'none');
await page.screenshot({path:`${out}/stage-${width}.png`});
if(width===1440){saveFailure=true;await overlay.focus();await page.keyboard.press('ArrowLeft');await page.getByRole('button',{name:'บันทึกโปรเจกต์',exact:true}).click();await page.getByRole('alert').filter({hasText:'บันทึกไม่ได้ในชุดทดสอบ'}).waitFor();saveFailure=false;supported=false;await page.reload();await overlay.waitFor({state:'visible'});await overlay.click();assert.equal(await overlay.locator('[data-resize]').count(),0);project={...project,segments:[],textLayers:[]};await page.reload();await page.getByText('ยังไม่มีคลิปบน timeline',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'เล่น',exact:true}).isDisabled());}
assert.deepEqual(errors,[]);results.push({width,initial,moved,wide,tall,saved,styles,errors});await page.close();
}
fs.writeFileSync(`${out}/browser-results.json`,JSON.stringify({boundary:'Actual Next production route, synthetic local media, mocked HTTP API/auth. No production project data.',base,results},null,2));console.log(JSON.stringify({pass:true,viewports:results.map(r=>r.width),artifact:out}));
}finally{await browser.close();}
