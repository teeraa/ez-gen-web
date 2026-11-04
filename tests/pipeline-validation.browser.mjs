import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:13016',dir=process.env.ARTIFACT_DIR||'/tmp/pipeline-validation-web';fs.mkdirSync(dir,{recursive:true});
const fixture=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:{id:'fixture-user',displayName:'Fixture',email:'fixture@example.invalid',plan:'free'}}));});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const copy='รายละเอียดฉากและบทพูดรวมกันยาวเกินขีดจำกัด กรุณาย่อฉากหรือบทพูดแล้วลองอีกครั้ง';
let browser;
try{
 await new Promise((resolve,reject)=>{fixture.once('error',reject);fixture.listen(18096,'127.0.0.1',resolve);});
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.addCookies([{name:'ezgen_session',value:'local-only-fixture',url:base}]);const page=await context.newPage(),posts=[],errors=[];let responseMode='validation';page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/api/proxy/**',async route=>{const request=route.request(),path=new URL(request.url()).pathname.replace('/api/proxy/','');let data;
  if(path==='studio-pipeline-capabilities')data={enabled:true,textEnabled:true,libraryEnabled:true,supportsDialogue:true,aspectRatios:['9:16'],durations:[5],libraryAspectRatios:['9:16'],libraryDurations:[5]};
  else if(path==='uploads')data={uploadId:'12345678-1234-4234-8234-123456789abc'};
  else if(path==='studio-pipelines'&&request.method()==='POST'){
   const body=request.postDataJSON();posts.push(body);
   if(responseMode!=='success')return route.fulfill({status:responseMode==='validation'?400:500,json:{code:responseMode==='validation'?'VALIDATION_ERROR':'INTERNAL_ERROR',message:'raw-provider-private',details:[{field:'scenePrompt',reason:'prompt_budget',message:'<script>raw-provider-private</script>'}]}});
   data={...body,id:'fixture-job',sourceMode:'upload',status:'succeeded',stage:'done',canRetry:false,characterAssetId:null,videoAssetId:null,createdAt:'2026-10-26T01:00:00Z'};
  }else if(path==='studio-pipelines')data={items:[],total:0,page:1,limit:20};else throw new Error('Unexpected fixture '+path);
  return route.fulfill({json:{data}});
 });
 await page.goto(base+'/studio');await page.getByText('ยังไม่มีงาน เริ่มสร้างวิดีโอแรกของคุณได้เลย').waitFor();await page.locator('#pipeline-image').setInputFiles({name:'reference.png',mimeType:'image/png',buffer:png});await page.getByText('reference.png',{exact:true}).waitFor();await page.getByLabel('ลักษณะตัวละคร (จำเป็น)').fill('ตัวละคร');await page.getByLabel('ฉากและการเคลื่อนไหว (จำเป็น)').fill('ก'.repeat(1500));await page.getByLabel('บทพูด (ไม่บังคับ)').fill('สวัสดีครับทุกคน');
 await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).click();await page.getByRole('alert').filter({hasText:copy}).waitFor();assert.equal(posts.length,1);assert.equal(posts[0].referenceImageId,'12345678-1234-4234-8234-123456789abc');assert.equal(await page.evaluate(()=>sessionStorage.getItem('violet-pipeline-submission')),null);assert(!(await page.getByLabel('ฉากและการเคลื่อนไหว (จำเป็น)').isDisabled()));assert(!(await page.locator('body').innerText()).includes('raw-provider-private'));await page.screenshot({path:`dir/validation.png`.replace('dir/',dir+'/')});
 responseMode='internal';await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).click();await page.getByText('ยังยืนยันคำขอไม่ได้ คุณสามารถส่งคำขอเดิมอีกครั้งโดยไม่เปลี่ยนรายละเอียด',{exact:true}).waitFor();const frozen=posts.at(-1);assert(await page.getByLabel('ฉากและการเคลื่อนไหว (จำเป็น)').isDisabled());assert(!(await page.locator('body').innerText()).includes('raw-provider-private'));assert.equal(await page.getByRole('alert').filter({hasText:copy}).count(),0);responseMode='success';await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).click();await page.waitForFunction(()=>!sessionStorage.getItem('violet-pipeline-submission'));assert.deepEqual(posts.at(-1),frozen);assert.deepEqual(errors,[]);
 fs.writeFileSync(`${dir}/browser-results.json`,JSON.stringify({status:'PASS',base,viewport:1440,posts:posts.length,recognized400:'fixed Thai copy; fields unlocked; pending cleared',internal500:'generic uncertainty; locked; identical retry key/body; raw provider text absent',errors,boundary:'isolated Next dev server + local auth and browser API fixtures; no provider call'},null,2));console.log('PASS validation400 and immutable500 browser regression');
}finally{await browser?.close();fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));}
