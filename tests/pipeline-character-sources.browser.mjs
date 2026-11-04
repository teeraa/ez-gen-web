import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:13016';
const dir=process.env.ARTIFACT_DIR||'/tmp/character-sources-web';fs.mkdirSync(dir,{recursive:true});
const fixture=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:{id:'fixture-user',displayName:'Fixture',email:'fixture@example.invalid',plan:'free'}}));});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const character={id:'library-character',name:'ตัวละครหลัก',assetType:'character',jobId:'completed-image',uploadId:null,status:'ready',mediaUrl:'data:image/png;base64,'+png.toString('base64')};
let browser;const observations=[];
try{
 await new Promise((resolve,reject)=>{fixture.once('error',reject);fixture.listen(18096,'127.0.0.1',resolve);});
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [1440,768,375]){
  const context=await browser.newContext({viewport:{width,height:1100}});await context.addCookies([{name:'ezgen_session',value:'local-only-fixture',url:base}]);const page=await context.newPage();const errors=[],posts=[];let assetsMode='loading',drop=false,assetRequests=0,uploadDone,lastJob;
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/api/proxy/**',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname.replace('/api/proxy/','');let data;
   if(path==='studio-pipeline-capabilities')data={enabled:true,textEnabled:true,libraryEnabled:true,supportsDialogue:true,aspectRatios:['9:16','16:9'],durations:[5,10],libraryAspectRatios:['9:16'],libraryDurations:[5]};
   else if(path==='assets'){
    assetRequests++;if(assetsMode==='loading')await new Promise(resolve=>setTimeout(resolve,700));
    if(assetsMode==='error')return route.fulfill({status:503,json:{code:'UNAVAILABLE'}});
    const pageNumber=Number(url.searchParams.get('page'));data={items:assetsMode==='empty'?[]:[{...character,id:pageNumber===1?'library-character':'library-character-2',name:pageNumber===1?'ตัวละครหลัก':'ตัวละครหน้าสอง'},{...character,id:'uploaded',jobId:null,uploadId:'upload'},{...character,id:'pending',status:'pending'}],total:assetsMode==='empty'?0:21,page:pageNumber,limit:20};
   }else if(path==='uploads'){await new Promise(resolve=>{uploadDone=resolve;setTimeout(resolve,500)});data={uploadId:'reference-upload'};}
   else if(path==='studio-pipelines'&&request.method()==='POST'){
    const body=request.postDataJSON();posts.push(body);if(drop){drop=false;return route.abort('failed');}
    data={...body,id:'job-'+posts.length,sourceMode:body.characterAssetId?'library':body.referenceImageId?'upload':'text',status:'processing',stage:body.characterAssetId?'video':'image',canRetry:false,characterAssetId:body.characterAssetId??null,videoAssetId:null,createdAt:'2026-10-26T01:00:00Z'};lastJob=data;
   }else if(path.startsWith('studio-pipelines/'))data=lastJob;
   else if(path==='studio-pipelines')data={items:[],total:0,page:1,limit:20};
   else throw new Error('Unexpected fixture path '+path);
   await route.fulfill({json:{data}});
  });
  await page.goto(base+'/studio');await page.getByText('ยังไม่มีงาน เริ่มสร้างวิดีโอแรกของคุณได้เลย').waitFor();
  await page.getByLabel('ลักษณะตัวละคร (จำเป็น)').fill('ตัวละครใหม่');await page.getByLabel('ฉากและการเคลื่อนไหว (จำเป็น)').fill('เดินในสวน');
  // No attachment means text-to-image, no empty identifier sent.
  await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).click();await page.getByText('ออกจากหน้านี้ได้ งานจะดำเนินต่อและเก็บไว้ในประวัติ').waitFor();assert(!('referenceImageId'in posts.at(-1)));assert(!('characterAssetId'in posts.at(-1)));
  await page.getByRole('radio',{name:'จากคลัง',exact:true}).check();
  const openPicker=async()=>{await page.getByRole('button',{name:/^(เลือกตัวละครจากคลัง|เปลี่ยนตัวละคร)$/}).click();await page.getByRole('dialog',{name:'เลือกตัวละครจากคลัง',exact:true}).waitFor();};
  const close=page.getByRole('button',{name:'ปิดหน้าต่างเลือกตัวละคร'});
  const choose=name=>page.getByRole('button',{name:'เลือกตัวละคร '+name,exact:true});
  const before=posts.length;await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).click();await page.getByText('กรุณาเลือกตัวละครจากคลัง',{exact:true}).waitFor();assert.equal(posts.length,before);
  await openPicker();await page.getByText('กำลังโหลดตัวละคร…').waitFor();assert(await close.evaluate(el=>el===document.activeElement));assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await page.screenshot({path:`${dir}/modal-loading-${width}.png`});
  await choose('ตัวละครหลัก').waitFor();await choose('ตัวละครหลัก').locator('img').dispatchEvent('error');await page.getByText('ไม่มีภาพตัวอย่าง',{exact:true}).waitFor();assert.equal(await choose('pending').count(),0);assert.equal(await page.locator('#pipeline-character').count(),0);
  // Native modal keeps keyboard focus inside, Escape/backdrop restore opener.
  await page.getByRole('button',{name:'หน้าถัดไป'}).focus();await page.keyboard.press('Tab');assert(await close.evaluate(el=>el===document.activeElement));await page.keyboard.press('Shift+Tab');assert(await page.getByRole('button',{name:'หน้าถัดไป'}).evaluate(el=>el===document.activeElement));
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});assert(await page.getByRole('button',{name:'เลือกตัวละครจากคลัง',exact:true}).evaluate(el=>el===document.activeElement));assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  await openPicker();await choose('ตัวละครหลัก').waitFor();await page.mouse.click(2,2);await page.getByRole('dialog').waitFor({state:'detached'});assert(await page.getByRole('button',{name:'เลือกตัวละครจากคลัง',exact:true}).evaluate(el=>el===document.activeElement));
  await openPicker();await page.getByRole('button',{name:'หน้าถัดไป'}).click();await choose('ตัวละครหน้าสอง').click();await page.getByRole('dialog').waitFor({state:'detached'});assert(await page.getByRole('button',{name:'เปลี่ยนตัวละคร',exact:true}).evaluate(el=>el===document.activeElement));await page.getByText('ตัวละครหน้าสอง',{exact:true}).waitFor();
  await openPicker();await choose('ตัวละครหน้าสอง').waitFor();assert.equal(await choose('ตัวละครหน้าสอง').getAttribute('aria-pressed'),'true');await page.keyboard.press('Escape');await page.getByText('ตัวละครหน้าสอง',{exact:true}).waitFor();
  await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).click();await page.getByText('ตัวละครอยู่ในคลังแล้ว',{exact:true}).waitFor();assert.equal(posts.at(-1).characterAssetId,'library-character-2');assert.equal(posts.at(-1).characterPrompt,'');assert(!('referenceImageId'in posts.at(-1)));
  await page.getByRole('button',{name:'นำตัวละครออก'}).click();await openPicker();await choose('ตัวละครหน้าสอง').click();
  await page.getByRole('radio',{name:'แนบใหม่',exact:true}).check();assert.equal(await page.getByLabel('ลักษณะตัวละคร (จำเป็น)').inputValue(),'ตัวละครใหม่');
  await page.locator('#pipeline-image').setInputFiles({name:'reference.png',mimeType:'image/png',buffer:png});await page.getByText('กำลังอัปโหลดภาพ…',{exact:true}).waitFor();assert(await page.getByRole('radio',{name:'จากคลัง',exact:true}).isDisabled());assert(await page.getByRole('button',{name:'เริ่มใหม่ (คำขอใหม่)',exact:true}).isDisabled());await page.getByRole('button',{name:'เริ่มใหม่ (คำขอใหม่)',exact:true}).evaluate(el=>el.click());uploadDone?.();await page.getByText('reference.png',{exact:true}).waitFor();assert.equal(await page.getByLabel('ฉากและการเคลื่อนไหว (จำเป็น)').inputValue(),'เดินในสวน');
  await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).click();await page.waitForFunction(()=>!sessionStorage.getItem('violet-pipeline-submission'));assert.equal(posts.at(-1).referenceImageId,'reference-upload');assert(!('characterAssetId'in posts.at(-1)));
  assetsMode='error';await page.reload();await page.getByRole('radio',{name:'จากคลัง',exact:true}).check();await openPicker();await page.getByText('โหลดตัวละครไม่สำเร็จ',{exact:false}).waitFor();await page.screenshot({path:`${dir}/modal-error-${width}.png`});assetsMode='empty';await page.getByRole('button',{name:'โหลดตัวละครอีกครั้ง'}).click();await page.getByText('ยังไม่มีตัวละครที่พร้อมใช้ในหน้านี้',{exact:false}).waitFor();await page.screenshot({path:`${dir}/modal-empty-${width}.png`});await close.click();
  assetsMode='ready';await openPicker();await choose('ตัวละครหลัก').click();
  drop=true;await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).click();await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).waitFor();const frozen=posts.at(-1);assert(await page.getByRole('radio',{name:'แนบใหม่',exact:true}).isDisabled());assert(await page.getByRole('button',{name:'นำตัวละครออก'}).isDisabled());assert(await page.getByRole('button',{name:'เปลี่ยนตัวละคร',exact:true}).isDisabled());
  await page.reload();await page.getByText('ตัวละครจากคลัง: library-character',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'เลือกตัวละครจากคลัง',exact:true}).isDisabled());await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).click();await page.waitForFunction(()=>!sessionStorage.getItem('violet-pipeline-submission'));assert.deepEqual(posts.at(-1),frozen);
  // Keyboard radio navigation and touch targets; keep existing result-first ordering.
  const libraryRadio=page.getByRole('radio',{name:'จากคลัง',exact:true});await libraryRadio.focus();await page.keyboard.press('ArrowRight');assert(await page.getByRole('radio',{name:'แนบใหม่',exact:true}).isChecked());
  const computed=await page.locator('fieldset').evaluate(el=>({height:getComputedStyle(el.querySelector('label')).height,grid:getComputedStyle(el).gridTemplateColumns,borderRadius:getComputedStyle(el.querySelector('label')).borderRadius,fontFamily:getComputedStyle(el).fontFamily}));assert(parseFloat(computed.height)>=44);assert.equal(computed.borderRadius,'10px');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('radio',{name:'จากคลัง',exact:true}).check();await openPicker();await choose('ตัวละครหลัก').waitFor();const modalComputed=await page.getByRole('dialog').evaluate(el=>({width:el.getBoundingClientRect().width,maxHeight:getComputedStyle(el).maxHeight,scroll:getComputedStyle(el.querySelector('[class*=dialogContent]')).overflowY,modal:el.matches(':modal')}));assert(modalComputed.width<=width-24);assert.equal(modalComputed.scroll,'auto');assert(modalComputed.modal);await page.screenshot({path:`${dir}/modal-success-${width}.png`});await choose('ตัวละครหลัก').click();await page.screenshot({path:`${dir}/summary-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);observations.push({width,computed,modalComputed,posts:posts.length,assetRequests,errors,boundary:'isolated Next server, loopback auth fixture, browser-route API fixtures; no provider calls'});await context.close();
 }
 fs.writeFileSync(`${dir}/browser-results.json`,JSON.stringify({status:'PASS',base,observations},null,2));console.log(JSON.stringify({status:'PASS',base,viewports:observations.map(item=>item.width)}));
}finally{await browser?.close();fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));}
