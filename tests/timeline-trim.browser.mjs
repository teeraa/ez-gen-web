import {createRequire} from 'node:module';import fs from 'node:fs';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:13322',out='/private/tmp/ai-editor-timeline-trim';fs.mkdirSync(out,{recursive:true});
const media=fs.readFileSync('/private/tmp/ai-editor-timeline-trim/fixture.mp4');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const results=[];
try{for(const width of [1440,375]){
 const page=await browser.newPage({viewport:{width,height:1000},hasTouch:width===375});await page.context().addCookies([{name:'ezgen_session',value:'local-fixture',url:base}]);
 const video={id:'av',projectId:'p1',clientUploadId:'u1',kind:'video',name:'Fixture.mp4',status:'ready',duration:12,width:640,height:360,hasAudio:true,sizeBytes:media.length,previewUrl:'/fixture.mp4',frames:[]},audio={...video,id:'aa',kind:'audio',name:'Tone.m4a'};
 let project={id:'p1',title:'Timeline trim fixture',aspectRatio:'16:9',revision:1,segments:[{id:'v1',assetId:'av',start:2,end:8,volume:.8},{id:'v2',assetId:'av',start:0,end:4,volume:1}],audioClips:[{id:'a1',assetId:'aa',at:1,start:2,end:8,volume:.5}],textLayers:[{id:'t1',text:'ข้อความ ทดสอบ',start:1,end:7,x:.5,y:.5,fontSize:100,color:'#FFFFFF',align:'center',scaleX:1.2,scaleY:.8}],assets:[video,audio],createdAt:'2026-11-02T00:00:00Z',updatedAt:'2026-11-02T00:00:00Z'};
 let latest;const errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.route('**/fixture.mp4',route=>route.fulfill({contentType:'video/mp4',body:media}));
 await page.route('**/api/proxy/**',route=>{const path=new URL(route.request().url()).pathname.replace('/api/proxy/','');let data;
 if(path==='video-editor/capabilities')data={available:true,maxUploadBytes:52428800,maxSegments:20,maxDuration:1200,maxAudioClips:20,maxTextLayers:50,textOverlays:true,textTransforms:true,aspectRatios:['16:9'],resolutions:['720p']};
 else if(path==='auth/me')data={id:'fixture',displayName:'Fixture'};
 else if(path==='video-editor/ai-capabilities')data={available:false,supportedOptions:{}};
 else if(path==='video-editor/projects')data={items:[project],total:1,page:1,limit:20};
 else if(path==='video-editor/projects/p1'&&route.request().method()==='PUT'){latest=route.request().postDataJSON();project={...project,...latest,revision:project.revision+1};data=project;}
 else if(path==='video-editor/projects/p1')data=project;
 else if(path.endsWith('/assets'))data={items:project.assets};else if(path.endsWith('/exports')||path.endsWith('/ai-jobs'))data={items:[]};else return route.fulfill({status:404,json:{message:'unknown fixture '+path}});
 return route.fulfill({json:{data}});});
 await page.goto(base+'/studio/ai-editor?project=p1');await page.locator('[data-video-clip=v1]').waitFor();
 const clip=(kind,id)=>page.locator(`[data-${kind}-clip="${id}"]`),handle=(kind,id,edge)=>page.locator(`[data-trim-kind=${kind}][data-trim-id=${id}][data-trim-edge=${edge}]`);
 async function save(){await page.getByRole('button',{name:'บันทึกโปรเจกต์',exact:true}).click();await page.waitForTimeout(160);assert(latest);return structuredClone(latest);}
 async function drag(kind,id,edge,dx,{cancel=false,touch=false}={}){const h=handle(kind,id,edge);const b=await h.boundingBox();assert(b);const x=b.x+b.width/2,y=b.y+b.height/2;
 if(touch){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y}]});await page.waitForTimeout(50);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
 else {await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y,{steps:5});await page.waitForTimeout(40);const live=await clip(kind,id).boundingBox();if(cancel)await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(40);if(!cancel){const committed=await clip(kind,id).boundingBox();assert(Math.abs(live.width-committed.width)<1);assert(Math.abs(live.x-committed.x)<1);}}
 }
 for(const [kind,id]of [['video','v1'],['audio','a1'],['text','t1']]){
  await clip(kind,id).click();const before=await clip(kind,id).boundingBox();await drag(kind,id,'head',22,{cancel:true});assert(Math.abs((await clip(kind,id).boundingBox()).width-before.width)<1);
  await drag(kind,id,'head',22,{touch:width===375});await drag(kind,id,'tail',-22,{touch:width===375});
 }
 const trimmed=await save();assert.deepEqual(trimmed.segments[0],{id:'v1',assetId:'av',start:3,end:7,volume:.8});assert.deepEqual(trimmed.audioClips[0],{id:'a1',assetId:'aa',at:2,start:3,end:7,volume:.5});assert.equal(trimmed.textLayers[0].start,2);assert.equal(trimmed.textLayers[0].end,6);
 // Keyboard trimming and one-step undo/redo preserve the complete gesture result.
 await handle('audio','a1','tail').focus();await page.keyboard.press('ArrowLeft');assert.equal((await save()).audioClips[0].end,6.9);await page.keyboard.press('ControlOrMeta+z');assert.equal((await save()).audioClips[0].end,7);await page.keyboard.press('ControlOrMeta+Shift+z');assert.equal((await save()).audioClips[0].end,6.9);await page.keyboard.press('ControlOrMeta+z');
 // Move bodies still move absolute tracks; cancellation restores trim without affecting the other lanes.
 const audioBox=await clip('audio','a1').boundingBox();await page.mouse.move(audioBox.x+audioBox.width/2,audioBox.y+audioBox.height/2);await page.mouse.down();await page.mouse.move(audioBox.x+audioBox.width/2+22,audioBox.y+audioBox.height/2,{steps:5});await page.mouse.up();assert.equal((await save()).audioClips[0].at,3);await page.keyboard.press('ControlOrMeta+z');
 async function seek(value){const slider=page.getByRole('slider',{name:'ตำแหน่งเล่น',exact:true});await slider.focus();await page.keyboard.press('Home');for(let i=0;i<value;i++)await page.keyboard.press('ArrowRight');await page.waitForTimeout(30);}
 for(const [kind,id]of [['video','v1'],['audio','a1'],['text','t1']]){
  await clip(kind,id).click();await seek(0);assert(await page.getByRole('button',{name:'แยกคลิป',exact:true}).isDisabled());await seek(3);assert(await page.getByRole('button',{name:'แยกคลิป',exact:true}).isEnabled(),JSON.stringify({kind,id,time:await page.getByRole('slider',{name:'ตำแหน่งเล่น',exact:true}).getAttribute('aria-valuenow'),selected:await page.locator('[aria-pressed=true][data-video-clip],[aria-pressed=true][data-audio-clip],[aria-pressed=true][data-text-clip]').evaluateAll(nodes=>nodes.map(n=>n.outerHTML))}));await page.getByRole('button',{name:'แยกคลิป',exact:true}).click();
 }
 const split=await save();assert.equal(split.segments.length,3);assert.deepEqual(split.segments.slice(0,2).map(v=>[v.start,v.end]),[[3,6],[6,7]]);assert.equal(split.audioClips.length,2);assert.deepEqual(split.audioClips.map(v=>[v.at,v.start,v.end]),[[2,3,4],[3,4,7]]);assert.deepEqual(split.textLayers.map(t=>[t.start,t.end]),[[2,3],[3,6]]);assert(split.textLayers.every(t=>t.scaleX===1.2&&t.scaleY===.8));for(const collection of [split.segments,split.audioClips,split.textLayers])assert.equal(new Set(collection.map(c=>c.id)).size,collection.length);
 await page.reload();await page.locator('[data-video-clip=v1]').waitFor();assert.equal(await page.locator('[data-video-clip]').count(),3);assert.equal(await page.locator('[data-audio-clip]').count(),2);assert.equal(await page.locator('[data-text-clip]').count(),2);
 await clip('video','v1').click();const computed=await handle('video','v1','tail').evaluate(el=>({cursor:getComputedStyle(el).cursor,touchAction:getComputedStyle(el).touchAction,opacity:getComputedStyle(el).opacity}));assert.deepEqual(computed,{cursor:'ew-resize',touchAction:'none',opacity:'1'});
 await drag('video','v1','tail',-1000);const minHead=await handle('video','v1','head').boundingBox(),minTail=await handle('video','v1','tail').boundingBox();assert(minHead.y+minHead.height<=minTail.y+.5);const minSaved=await save();assert(Math.abs(minSaved.segments[0].end-minSaved.segments[0].start-.1)<1e-8);await page.keyboard.press('ControlOrMeta+z');
 await page.screenshot({path:`${out}/timeline-${width}.png`});assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);results.push({width,touch:width===375,trimmed,split,computed,errors,consoleErrors});await page.close();
}fs.writeFileSync(`${out}/browser-results.json`,JSON.stringify({boundary:'Actual isolated Next production route, mocked API/auth and synthetic media. No real project changes.',base,results},null,2));console.log(JSON.stringify({pass:true,viewports:results.map(r=>r.width),artifact:out}));}finally{await browser.close();}
