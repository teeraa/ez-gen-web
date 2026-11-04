import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:13014';
const artifacts=process.env.ARTIFACT_DIR||'/private/tmp/studio-oneclick-fe';
fs.mkdirSync(artifacts,{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const generated='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#ccddee"/><circle cx="150" cy="100" r="50" fill="#334455"/></svg>');
const fixture=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:req.url.endsWith('/auth/login')?{accessToken:'local-oneclick-fixture',expiresAt:'2099-01-01T00:00:00Z'}:{id:'fixture-user',displayName:'Fixture',email:'fixture@example.invalid',plan:'fixture'}}));});
let browser;
const observations=[];
try{
 await new Promise(r=>fixture.listen(18094,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [1440,768,375]){
  const context=await browser.newContext({viewport:{width,height:1100}});let page=await context.newPage();
  const jobs=new Map(),posts=[],childPosts=[],errors=[];let failList=false,failPoll=false,drop=false,reject=false,capDialogue=true,retries=0,assetGets=0,assetListGets=0,allPosts=0,failMediaRefresh=false;
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/api/proxy/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname.replace('/api/proxy/','');let data={};if(request.method()==='POST')allPosts++;
   if(path==='studio-pipeline-capabilities')data={enabled:true,textEnabled:true,libraryEnabled:true,libraryAspectRatios:['9:16','16:9'],libraryDurations:[5,10],supportsDialogue:capDialogue,unavailableReason:null,aspectRatios:['9:16','16:9'],durations:[5,10]};
   else if(path==='uploads'){await new Promise(r=>setTimeout(r,200));data={uploadId:'12345678-1234-4234-8234-123456789abc',filename:'reference.png',sizeBytes:png.length,mimeType:'image/png',expiresAt:'2099-01-01T00:00:00Z'};}
   else if(path==='studio-pipelines'&&request.method()==='POST'){
    const body=request.postDataJSON();posts.push(body);if(reject){reject=false;return route.fulfill({status:422,json:{code:"VALIDATION_ERROR",message:"fixture invalid"}});}
    let job=[...jobs.values()].find(job=>job.key===body.idempotencyKey);
    if(!job){job={...body,key:body.idempotencyKey,id:'pipeline-'+(jobs.size+1),status:'processing',stage:'image',canRetry:false,characterAssetId:null,videoAssetId:null,characterMediaUrl:null,videoMediaUrl:null,characterMediaUrlExpiresAt:null,videoMediaUrlExpiresAt:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};jobs.set(job.id,job);}
    if(drop){drop=false;return route.abort('failed');}data=job;
   }
   else if(path==='studio-pipelines'){
    if(failList)return route.fulfill({status:503,json:{message:'fixture unavailable'}});
    data={items:[...jobs.values()],total:jobs.size,page:1,limit:20};
   }
   else if(path.startsWith('studio-pipelines/')){
    const id=path.split('/')[1];if(request.method()==='POST'){retries++;const job=jobs.get(id);Object.assign(job,{status:'succeeded',stage:'done',canRetry:false,videoAssetId:'saved-video',videoMediaUrl:'/media/studio-landscape.mp4'});}
    if(failPoll&&request.method()==='GET')return route.fulfill({status:503,json:{message:'fixture offline'}});
    data=jobs.get(id);
   }
   else if(path.startsWith('assets/')){
    assert.equal(request.method(),'GET');assetGets++;await new Promise(resolve=>setTimeout(resolve,150));
    if(failMediaRefresh)return route.fulfill({status:503,json:{message:'fixture media refresh unavailable'}});
    const job=[...jobs.values()][0];data={id:job.videoAssetId,assetType:'video',name:'วิดีโอทดสอบ',description:job.scenePrompt,mediaUrl:job.videoMediaUrl+'?refresh='+assetGets,createdAt:job.createdAt};
   }
   else if(path==='assets'){
    assetListGets++;
    const type=new URL(request.url()).searchParams.get('type');data={items:[...jobs.values()].flatMap(job=>type==='video'&&job.videoAssetId?[{id:job.videoAssetId,assetType:'video',name:'วิดีโอทดสอบ',description:job.scenePrompt,mediaUrl:job.videoMediaUrl,createdAt:job.createdAt}]:type==='character'&&job.characterAssetId?[{id:job.characterAssetId,assetType:'character',name:'ตัวละครทดสอบ',description:job.characterPrompt,mediaUrl:generated,createdAt:job.createdAt}]:[]),total:1,page:1,limit:20};
   } else if(request.method()==='POST')childPosts.push(path);
   await route.fulfill({json:{data}});
  });
  await page.goto(base+'/signin');await page.getByRole('textbox',{name:'อีเมล',exact:true}).fill('fixture@example.invalid');await page.getByLabel('รหัสผ่าน',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL(base+'/studio');
  await page.getByText('ยังไม่มีงาน เริ่มสร้างวิดีโอแรกของคุณได้เลย').waitFor();
  const traversed=[];await page.locator('body').click({position:{x:1,y:1}});for(let i=0;i<45;i++){await page.keyboard.press('Tab');traversed.push(await page.evaluate(()=>({tag:document.activeElement?.tagName,id:document.activeElement?.id,text:document.activeElement?.textContent?.slice(0,60)})));}
  assert(traversed.some(item=>item.id==='pipeline-image'));assert(traversed.some(item=>item.id==='pipeline-character'));assert(traversed.some(item=>item.id==='pipeline-scene'));assert(traversed.some(item=>item.id==='pipeline-dialogue'));
  await page.locator('#pipeline-image').setInputFiles({name:'original.png',mimeType:'image/png',buffer:png});await page.getByText('กำลังอัปโหลดภาพ…',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).isDisabled());await page.getByText('original.png',{exact:true}).waitFor();
  await page.getByLabel('ลักษณะตัวละคร (จำเป็น)').fill('ตัวละครสังเคราะห์ ใบหน้าและทรงผมตามภาพ');await page.getByLabel('ฉากและการเคลื่อนไหว (จำเป็น)').fill('เดินในสวนยามเช้า');const dialogue='  สวัสดี นี่คือเรื่องราวของฉัน  ';await page.getByLabel('บทพูด (ไม่บังคับ)').fill(dialogue);
  await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).click();await page.getByText('ออกจากหน้านี้ได้ งานจะดำเนินต่อและเก็บไว้ในประวัติ').waitFor();assert.equal(posts.length,1);assert.equal(posts[0].dialogue,dialogue);assert(posts[0].referenceImageId);assert.deepEqual(childPosts,[]);
  const job=[...jobs.values()][0];Object.assign(job,{status:'failed',stage:'video',canRetry:true,characterAssetId:'saved-character',characterMediaUrl:generated});
  await page.getByRole('button',{name:'ตรวจสอบสถานะอีกครั้ง',exact:true}).click();await page.getByText('ตัวละครบันทึกแล้ว แต่ขั้นตอนถัดไปยังไม่สำเร็จ',{exact:true}).waitFor();await page.getByRole('link',{name:'ดูในคลังตัวละคร'}).waitFor();assert.notEqual(await page.getByAltText('ตัวละครสังเคราะห์',{exact:true}).getAttribute('src'),await page.getByAltText('ภาพต้นฉบับ · ใช้สร้างตัวละคร').getAttribute('src'));
  await page.screenshot({path:`${artifacts}/partial-${width}.png`,fullPage:true});const beforeMedia=posts.length;await page.getByAltText('ตัวละครสังเคราะห์',{exact:true}).dispatchEvent('error');await page.getByRole('button',{name:'โหลดลิงก์สื่อใหม่'}).click();assert.equal(posts.length,beforeMedia);
  await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/studio');await page.getByText('ตัวละครบันทึกแล้ว แต่ขั้นตอนถัดไปยังไม่สำเร็จ',{exact:true}).waitFor();assert.equal(posts.length,1);await page.getByRole('button',{name:'ดำเนินการต่อจากงานเดิม'}).click();await page.getByRole('link',{name:'ดูในคลังวิดีโอ'}).waitFor();assert.equal(retries,1);assert.equal(job.characterAssetId,'saved-character');
  const computed=await page.locator('form').last().evaluate(n=>({fontFamily:getComputedStyle(n).fontFamily,grid:getComputedStyle(n.parentElement).gridTemplateColumns,background:getComputedStyle(n).backgroundColor,borderRadius:getComputedStyle(n).borderRadius,width:getComputedStyle(n).width}));assert.equal(computed.borderRadius,'13px');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${artifacts}/success-${width}.png`,fullPage:true});await page.getByRole('link',{name:'ดูในคลังวิดีโอ'}).click();const libraryVideo=page.getByLabel('วิดีโอทดสอบ',{exact:true});await libraryVideo.waitFor();assert(await libraryVideo.getAttribute('controls')!==null);await libraryVideo.evaluate(async video=>{video.muted=true;await video.play();});await page.waitForFunction(()=>[...document.querySelectorAll('video')].some(video=>video.currentTime>0));await libraryVideo.evaluate(video=>video.pause());
  const selectedVideoGets=assetListGets;await page.getByRole('button',{name:'วิดีโอ',exact:true}).click();await page.waitForTimeout(700);assert.equal(assetListGets,selectedVideoGets);assert.equal(await page.getByText('กำลังโหลดคลังผลงาน…',{exact:true}).count(),0);assert(await libraryVideo.isVisible());
  const postsBeforeMedia=allPosts,originalVideoUrl=await libraryVideo.getAttribute('src');failMediaRefresh=true;await libraryVideo.dispatchEvent('error');const mediaRefresh=page.getByRole('button',{name:'โหลดลิงก์วิดีโอใหม่ วิดีโอทดสอบ',exact:true});await mediaRefresh.waitFor();await mediaRefresh.click();await page.getByText('โหลดลิงก์วิดีโอใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง',{exact:true}).waitFor();assert.equal(assetGets,1);assert.equal(await libraryVideo.getAttribute('src'),originalVideoUrl);assert(await page.getByText('วิดีโอทดสอบ',{exact:true}).isVisible());assert.equal(allPosts,postsBeforeMedia);
  failMediaRefresh=false;await mediaRefresh.click();await page.waitForFunction(()=>document.querySelector('video[aria-label="วิดีโอทดสอบ"]')?.getAttribute('src')?.includes('?refresh=2'));await libraryVideo.evaluate(async video=>{video.muted=true;await video.play();});await page.waitForFunction(()=>document.querySelector('video[aria-label="วิดีโอทดสอบ"]')?.currentTime>0);await libraryVideo.evaluate(video=>video.pause());assert.equal(assetGets,2);assert.equal(allPosts,postsBeforeMedia);await page.screenshot({path:`${artifacts}/library-recovered-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'ตัวละคร',exact:true}).click();await page.getByText('ตัวละครทดสอบ',{exact:true}).waitFor();const selectedCharacterGets=assetListGets;await page.getByRole('button',{name:'ตัวละคร',exact:true}).click();await page.waitForTimeout(700);assert.equal(assetListGets,selectedCharacterGets);assert.equal(await page.getByText('กำลังโหลดคลังผลงาน…',{exact:true}).count(),0);assert(await page.getByText('ตัวละครทดสอบ',{exact:true}).isVisible());await page.screenshot({path:`${artifacts}/library-${width}.png`,fullPage:true});
  await page.goto(base+'/studio');await page.getByRole('button',{name:'เริ่มใหม่ (คำขอใหม่)'}).click();await page.locator('#pipeline-image').setInputFiles({name:'original.png',mimeType:'image/png',buffer:png});await page.getByText('original.png',{exact:true}).waitFor();await page.getByLabel('ลักษณะตัวละคร (จำเป็น)').fill('คำขอใหม่');await page.getByLabel('ฉากและการเคลื่อนไหว (จำเป็น)').fill('ฉากใหม่');reject=true;await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).click();await page.getByRole('alert').filter({hasText:'คำขอไม่ได้รับการยอมรับ'}).waitFor();assert(!await page.locator('#pipeline-character').isDisabled());assert.equal(await page.evaluate(()=>sessionStorage.getItem('violet-pipeline-submission')),null);drop=true;await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).click();await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).waitFor();const unknown=posts.at(-1);await page.reload();await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).click();await page.waitForFunction(()=>!sessionStorage.getItem('violet-pipeline-submission'));assert.deepEqual(posts.at(-1),unknown);assert.equal(jobs.size,2);
  failPoll=true;await page.getByRole('button',{name:'ตรวจสอบสถานะอีกครั้ง',exact:true}).click();await page.getByText('ตรวจสอบสถานะไม่สำเร็จ งานอาจยังดำเนินอยู่',{exact:false}).waitFor();assert.equal(jobs.get('pipeline-2').status,'processing');failPoll=false;
  Object.assign(jobs.get('pipeline-2'),{status:'needs_attention',canRetry:false});await page.getByRole('button',{name:'ตรวจสอบสถานะอีกครั้ง',exact:true}).click();assert.equal(await page.getByRole('button',{name:'ดำเนินการต่อจากงานเดิม'}).count(),0);
  failList=true;await page.reload();await page.getByText('โหลดงานไม่สำเร็จ',{exact:false}).waitFor();assert.equal(await page.getByText('ยังไม่มีงาน เริ่มสร้างวิดีโอแรกของคุณได้เลย').count(),0);failList=false;
  assert.deepEqual(errors,[]);assert.deepEqual(childPosts,[]);observations.push({width,computed,traversed,posts:posts.length,retries,assetGets,assetListGets,libraryRegressions:"selected tabs stay visible without redundant GET; media GET refresh failure retains source/card; successful refresh plays new URL without POST",consoleErrors:errors,boundary:'production Next server + loopback auth fixture + browser route API fixtures; no real backend/provider calls'});await context.close();
 }
 fs.writeFileSync(`${artifacts}/browser-results.json`,JSON.stringify({status:'PASS',observations},null,2));console.log(JSON.stringify({status:'PASS',viewports:observations.map(o=>o.width)}));
}finally{await browser?.close();await new Promise(r=>fixture.close(r));}
