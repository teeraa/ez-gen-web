import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const load=createRequire(import.meta.url);
const {chromium}=load(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.BASE_URL || 'http://127.0.0.1:13003';
const artifacts=process.env.ARTIFACT_DIR || '/private/tmp/ezgen-polling-web';fs.mkdirSync(artifacts,{recursive:true});
const clip=fs.readFileSync(process.env.FIXTURE_MP4 || '../ez-gen-api/apps/tests/testdata/video.mp4');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const fixture=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:{id:'fixture',displayName:'Fixture user',email:'fixture@example.invalid',plan:'fixture'}}));});
let browser,page;
const observations=[];
try{
 await new Promise(resolve=>fixture.listen(Number(process.env.FIXTURE_PORT || 18083),'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [1440,375]){
  const context=await browser.newContext({viewport:{width,height:1000}});await context.addCookies([{name:'ezgen_session',value:'polling-fixture',url:base}]);
  page=await context.newPage();page.setDefaultTimeout(20000);
  let pendingComplete=width!==1440,reference='a1',mode='image_video',selectedReads=0,description='A character walks on a quiet beach',activityEmpty=false,failList=false,failActivity=false,slowList=false,exportStatus='succeeded';
  const counts={},posts=[],pageErrors=[],httpErrors=[];let inflight=0,maxInflight=0;
  const stamp=new Date().toISOString();
  const scene=()=>({id:'s1',title:'Scene fixture',description,referenceAssetId:reference,selectedJobId:'selected',videoSettings:{model:'fixture-model',mode,aspectRatio:'16:9',duration:5,quality:'standard',enhancePrompt:false},tags:[],characters:[],createdAt:stamp,updatedAt:stamp});
  const job=(id,status='succeeded')=>({jobId:id,sceneId:'s1',status,createdAt:stamp,result:status==='succeeded'?{mediaType:'video',mediaUrl:`${base}/fixture.mp4?v=${selectedReads}`,expiresAt:width===1440?'2000-01-01T00:00:00Z':null}:null,outputDurationMs:5000});
  const project=()=>({id:'p1',title:'Project fixture',brief:'Beach scene',aspectRatio:'16:9',revision:1,editDraft:{clips:[],audioVolume:1,textLayers:[]},scenes:[scene()],exports:[{exportId:'e1',status:exportStatus,createdAt:stamp,output:{resolution:'720p',aspectRatio:'16:9'}}]});
  const asset=id=>({id,name:id,description:'Character image fixture',assetType:'character',mediaUrl:png});
  const caps={available:true,models:[{id:'fixture-model',providerModel:'dreamina-seedance-2-0-fast-260128',name:'Fixture video',aspectRatios:['16:9'],minDuration:1,maxDuration:10,qualities:['standard'],supportsReferenceImage:true,supportsImageToVideo:true}],export:{available:true,resolutions:['720p'],aspectRatios:['16:9']}};
  page.on('pageerror',e=>pageErrors.push(e.message));page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()})});
  await page.route('**/fixture.mp4*',route=>route.fulfill({status:200,contentType:'video/mp4',body:clip}));
  await page.route('**/api/proxy/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/api/proxy/','');counts[path]=(counts[path]??0)+1;
   if(req.method()==='POST')posts.push({path,body:req.postData()?req.postDataJSON():null});
   let data;
   if(path==='video-capabilities')data=caps;
   else if(path==='projects/p1')data=project();
   else if(path==='projects/p1/editor')data=project();
   else if(path==='dna/scenes/s1'&&req.method()==='PUT'){const body=req.postDataJSON();reference=body.referenceAssetId;mode=body.videoSettings.mode;description=body.description;data=scene();}
   else if(path==='dna/scenes/s1/jobs'){
    inflight++;maxInflight=Math.max(maxInflight,inflight);
    if(slowList)await new Promise(resolve=>setTimeout(resolve,700));
    inflight--;
    if(failList){failList=false;await route.fulfill({status:503,json:{message:'Fixture scene refresh unavailable'}});return;}
    data={items:[job('latest')],total:22,page:1,limit:20};
   } else if(path.startsWith('jobs/')){
    const id=path.slice(5);if(id==='selected')selectedReads++;
    data=job(id,id==='pending'&&!pendingComplete?'processing':'succeeded');
   } else if(path==='jobs'){
    if(failActivity){failActivity=false;await new Promise(resolve=>setTimeout(resolve,700));await route.fulfill({status:503,json:{message:'Fixture activity unavailable'}});return;}
    data={items:activityEmpty?[]:[{...job('image'),imageCategory:'character',rawPrompt:'Fixture character',result:{mediaType:'image',mediaUrl:png,expiresAt:'2099-01-01T00:00:00Z'}}],total:activityEmpty?0:1};
   } else if(path==='assets')data={items:[asset('a1'),asset('a2')],total:2};
   else if(path.startsWith('assets/')){await new Promise(resolve=>setTimeout(resolve,800));data=asset(path.slice(7));}
   else if(path==='dna/scenes/s1/generate')data={jobId:'recovered',status:'queued'};
   else if(path==='exports/e1/download')data={url:`${base}/fixture.mp4?export=1`,expiresAt:'2099-01-01T00:00:00Z'};
   else data={};
   await route.fulfill({json:{data}});
  });
  await context.addInitScript(({width})=>{if(sessionStorage.getItem('fixture-pending-seeded'))return;sessionStorage.setItem('fixture-pending-seeded','1');sessionStorage.setItem('violet-video-submit:s1',JSON.stringify({key:'known-pending',jobId:'pending',body:{idempotencyKey:'known-pending',prompt:'Beach',model:'fixture-model',mode:'image_video',duration:5,aspectRatio:'16:9',quality:'standard',enhancePrompt:false}}));if(width!==1440)sessionStorage.removeItem('violet-video-submit:s1');},{width});
  const refresh=()=>page.getByRole('button',{name:'รีเฟรชสถานะ',exact:true});
  console.log('viewport',width);
  await page.goto(`${base}/studio/projects/p1?asset=a1`,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Scene fixture',exact:true}).waitFor();
  await page.getByText('ใช้ภาพนี้เป็นเฟรมเริ่มต้น จึงอาจคงฉากหลังจากภาพไว้',{exact:true}).waitFor();
  await page.getByText('ระบุสถานที่/ฉากหลังในคำอธิบายฉาก',{exact:true}).waitFor();
  await page.locator('video').waitFor();
  if(width===1440){
   assert.equal(await page.getByRole('button',{name:'เปลี่ยนเป็นอ้างอิงรูปลักษณ์',exact:true}).isDisabled(),true);
   await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'))});
   const hiddenCount=counts['dna/scenes/s1/jobs'];await page.waitForTimeout(4500);assert.equal(counts['dna/scenes/s1/jobs'],hiddenCount,'hidden pauses periodic scene GET');
   pendingComplete=true;
   await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'))});
   await page.getByRole('button',{name:'เปลี่ยนเป็นอ้างอิงรูปลักษณ์',exact:true}).waitFor({state:'visible'});
   await page.waitForFunction(()=>!sessionStorage.getItem('violet-video-submit:s1'));
   await page.waitForTimeout(1500);const idle=counts['dna/scenes/s1/jobs'];const oldExpiryReads=counts['jobs/selected'];await page.waitForTimeout(4500);
   assert.equal(counts['dna/scenes/s1/jobs'],idle,'terminal scene stops interval');assert.equal(counts['jobs/selected'],oldExpiryReads,'same expired signed URL cannot loop');
   assert(counts['jobs/pending']>=2,'known pending outside first20 is directly refreshed');
   const beforeFocus=counts['dna/scenes/s1/jobs'];await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'))});
   await page.waitForTimeout(300);assert.equal(counts['dna/scenes/s1/jobs'],beforeFocus+1,'focus burst deduped');
   failList=true;slowList=true;await refresh().focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'กำลังรีเฟรชสถานะ…',exact:true}).waitFor();assert(await page.locator('video').isVisible(),'loading keeps content');
   await page.getByRole('alert').filter({hasText:'Fixture scene refresh unavailable'}).waitFor();assert(await refresh().evaluate(n=>document.activeElement===n),'refresh error retains keyboard focus');assert(await page.locator('video').isVisible());
   await refresh().click();await page.waitForTimeout(900);slowList=false;
  }
  await page.getByText('ตั้งค่าขั้นสูง',{exact:true}).click();const modeSelect=page.getByLabel('การใช้ภาพอ้างอิง');assert.equal(await modeSelect.inputValue(),'image_video','legacy URL import retains first frame');
  await page.screenshot({path:`${artifacts}/first-frame-${width}.png`});
  await page.getByRole('button',{name:'เปลี่ยนเป็นอ้างอิงรูปลักษณ์',exact:true}).click();assert.equal(await modeSelect.inputValue(),'image_image');
  await page.getByLabel('ฉากนี้เกิดอะไรขึ้น?').fill('A character on a beach; background is a tropical sea');await page.getByRole('button',{name:'บันทึกฉาก',exact:true}).click();
  assert.equal(mode,'image_image');await page.getByRole('button',{name:'เปลี่ยนตัวละคร',exact:true}).click();const dialog=page.getByRole('dialog',{name:'เลือกตัวละครจากคลัง'});await dialog.getByRole('button',{name:/a2/}).click();
  await modeSelect.selectOption('image_video');await page.getByAltText('a2',{exact:true}).waitFor();assert.equal(await modeSelect.inputValue(),'image_video','late asset result cannot overwrite explicit mode');
  await page.getByRole('button',{name:'บันทึกฉาก',exact:true}).click();await page.goto(`${base}/studio/projects/p1?asset=a2`,{waitUntil:'domcontentloaded'});await page.getByText('ใช้ภาพนี้เป็นเฟรมเริ่มต้น จึงอาจคงฉากหลังจากภาพไว้',{exact:true}).waitFor();
  await page.getByRole('button',{name:'เปลี่ยนเป็นอ้างอิงรูปลักษณ์',exact:true}).click();await page.getByRole('button',{name:'บันทึกฉาก',exact:true}).click();
  assert.equal(mode,'image_image');await page.screenshot({path:`${artifacts}/appearance-${width}.png`});
  if(width===1440){
   await page.evaluate(()=>sessionStorage.setItem('violet-video-submit:s1',JSON.stringify({key:'unknown-request',body:{idempotencyKey:'unknown-request',model:'fixture-model',mode:'image_image',prompt:'Frozen beach prompt',aspectRatio:'16:9',duration:5,quality:'standard',enhancePrompt:false}})));
   await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).waitFor();assert.equal(posts.length,0,'polling never automatically generates');
   await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).click();await page.waitForFunction(()=>!sessionStorage.getItem('violet-video-submit:s1'));assert.equal(posts.length,1);assert.equal(posts[0].body.idempotencyKey,'unknown-request');assert.equal(posts[0].body.prompt,'Frozen beach prompt');
  }
  await page.getByRole('button',{name:'2 · ตัดต่อและส่งออก'}).click();await page.getByRole('heading',{name:'ส่งออกวิดีโอ',exact:true}).waitFor();const projectCount=counts['projects/p1'];
  if(width===1440){await page.waitForTimeout(4500);assert.equal(counts['projects/p1'],projectCount,'terminal export stops project polling');}
  await page.screenshot({path:`${artifacts}/assembly-${width}.png`});
  await page.goto(`${base}/studio/jobs`,{waitUntil:'domcontentloaded'});await page.getByRole('textbox',{name:'ชื่อตัวละคร',exact:true}).waitFor();const listCount=counts.jobs;
  if(width===1440){await page.waitForTimeout(5200);assert.equal(counts.jobs,listCount,'terminal activity stops polling');}
  const name=page.getByRole('textbox',{name:'ชื่อตัวละคร',exact:true});await name.fill('Unsaved name retained');failActivity=true;await refresh().focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'กำลังรีเฟรชสถานะ…',exact:true}).waitFor();assert.equal(await name.inputValue(),'Unsaved name retained');
  await page.getByRole('alert').filter({hasText:'Fixture activity unavailable'}).waitFor();assert.equal(await name.inputValue(),'Unsaved name retained');assert(await refresh().evaluate(n=>document.activeElement===n));
  await page.screenshot({path:`${artifacts}/activity-error-${width}.png`});await refresh().click();await page.getByRole('alert').filter({hasText:'Fixture activity unavailable'}).waitFor({state:'detached'});
  activityEmpty=true;await refresh().click();await page.getByRole('heading',{name:'เริ่มผลงานแรกของคุณที่นี่',exact:true}).waitFor();await page.screenshot({path:`${artifacts}/activity-empty-${width}.png`});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');assert.equal(maxInflight,1,'scene requests never overlap');assert.deepEqual(pageErrors,[]);
  observations.push({width,counts,maxInflight,generationPosts:posts,pageErrors,httpErrors,visibility:'headless fixture dispatches document visibility and window focus events; fake-clock tests cover scheduler timing',media:'valid local MP4; no deliberate404 or paid provider calls'});await context.close();
 }
 console.log(JSON.stringify({status:'PASS',observations},null,2));
}catch(error){console.error(error);if(page){console.error(await page.locator('body').innerText());await page.screenshot({path:`${artifacts}/failure.png`});}throw error;}finally{await browser?.close();await new Promise(resolve=>fixture.close(resolve));}
