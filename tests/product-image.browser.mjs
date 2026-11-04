import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const load=createRequire(import.meta.url);
const {chromium}=load(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.BASE_URL || 'http://127.0.0.1:13002';
const port=Number(process.env.FIXTURE_PORT || 18082);
const artifacts=process.env.ARTIFACT_DIR || '/private/tmp/ezgen-product-web';
fs.mkdirSync(artifacts,{recursive:true});
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const fixture=http.createServer((req,res)=>{
 res.setHeader('Content-Type','application/json');
 res.end(JSON.stringify({data:req.url.endsWith('/auth/login')?{accessToken:'local-product-fixture',expiresAt:'2099-01-01T00:00:00Z'}:{id:'fixture-user',displayName:'Fixture user',email:'fixture@example.invalid',plan:'fixture'}}));
});
const observations=[];
let browser,activePage,lastSaves;
try {
 await new Promise(resolve=>fixture.listen(port,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [1440,768,375]) {
  console.log("viewport",width);
  const context=await browser.newContext({viewport:{width,height:1000}});
  const page=await context.newPage();activePage=page;page.setDefaultTimeout(20000);
  const jobs=new Map(),assets=[],posts=[],saves=[],queries=[],consoleErrors=[],pageErrors=[],httpErrors=[];
  lastSaves=saves;let failPost=false,assetState='success',counter=0,productSupported=true,slowJobLookup=false,failJobLookup=false;
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});
  await page.route('**/api/proxy/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/api/proxy/','');
   let data;
   if(path==='image-capabilities')data={enabled:true,model:'fixture',aspectRatios:['3:4','1:1'],supportsReferenceImage:true,...(productSupported?{categories:['character','product']}:{})};
   else if(path==='image-jobs') {
    const body=req.postDataJSON();posts.push(body);
    if(failPost){failPost=false;await route.abort('failed');return;}
    let job=[...jobs.values()].find(j=>j.idempotencyKey===body.idempotencyKey);
    if(!job){const jobId=`job-${++counter}`;job={jobId,status:'succeeded',imageCategory:body.category??'character',rawPrompt:body.prompt,compiledPrompt:'Compiled provider instructions '+ 'x'.repeat(3000),createdAt:new Date().toISOString(),result:{mediaType:'image',mediaUrl:png},idempotencyKey:body.idempotencyKey,...(body.category==='product'?{productDesign:{visualStyle:body.visualStyle,mood:body.mood}}:{characterDesign:{visualStyle:body.visualStyle,mood:body.mood,designFormat:body.designFormat}})};if(body.category==='character')delete job.imageCategory;jobs.set(jobId,job);}
    data={jobId:job.jobId,status:'queued'};
   } else if(path.startsWith('jobs/')){if(failJobLookup){await route.fulfill({status:503,json:{message:'Fixture job lookup unavailable'}});return;}if(slowJobLookup)await new Promise(resolve=>setTimeout(resolve,800));data=jobs.get(path.slice(5));}
   else if(path==='jobs')data={items:[...jobs.values()],total:jobs.size};
   else if(path==='assets'&&req.method()==='POST'){
    const body=req.postDataJSON();saves.push(body);data={...body,id:`asset-${saves.length}`,mediaUrl:png,createdAt:new Date().toISOString()};assets.push(data);
   } else if(path==='assets') {
    queries.push(Object.fromEntries(url.searchParams));
    if(assetState==='error'){await route.fulfill({status:503,json:{message:'Fixture library unavailable'}});return;}
    if(assetState==='loading')await new Promise(resolve=>setTimeout(resolve,1000));
    const items=assetState==='empty'?[]:assets.filter(a=>a.assetType===url.searchParams.get('type'));
    data={items,total:items.length,page:Number(url.searchParams.get('page')),limit:20};
   } else if(path==='uploads') {
    await new Promise(resolve=>setTimeout(resolve,1000));
    data={uploadId:'12345678-1234-1234-1234-123456789abc',expiresAt:'2099-01-01T00:00:00Z'};
   } else data={};
   await route.fulfill({json:{data}});
  });
  const modes=()=>page.getByRole('group',{name:'ประเภทภาพ'});
  const product=()=>modes().getByRole('button',{name:'สร้างสินค้า',exact:true});
  const character=()=>modes().getByRole('button',{name:'สร้างตัวละคร',exact:true});
  const pressed=async(button)=>{await button.waitFor();await page.waitForFunction(n=>n.getAttribute('aria-pressed')==='true',await button.elementHandle());assert.equal(await button.getAttribute('aria-pressed'),'true');};
  const layout=async(label)=>{
   const computed=await modes().getByRole('button').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent.trim(),height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width,pressed:n.getAttribute("aria-pressed"),minHeight:getComputedStyle(n).minHeight})));
   assert(computed.every(n=>n.height>=44),'mode controls must have44px targets');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
   observations.push({width,label,computed});
  };
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await product().click();await pressed(product());
  assert.equal(await page.locator('#character-design-format').count(),0);
  await page.getByLabel('อธิบายสินค้าของคุณ').fill('Glass perfume bottle with cream package');
  await page.getByRole('button',{name:'ดินปั้น',exact:true}).click();
  await page.getByRole('button',{name:'โดดเด่น',exact:true}).click();
  await product().focus();assert.equal(await product().evaluate(n=>document.activeElement===n),true);
  await layout('public-product');await page.screenshot({path:`${artifacts}/public-product-${width}.png`});
  await page.getByRole('button',{name:'เข้าสู่สตูดิโอ',exact:true}).click();
  await page.getByRole('textbox',{name:'อีเมล',exact:true}).fill('fixture@example.invalid');
  await page.getByLabel('รหัสผ่าน',{exact:true}).fill('fixture-password-only');
  await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();
  await page.waitForURL(`${base}/studio`);
  await pressed(product());assert.equal(await page.getByLabel('อธิบายสินค้าของคุณ').inputValue(),'Glass perfume bottle with cream package');
  await pressed(page.getByRole('button',{name:'โดดเด่น',exact:true}));
  await page.reload({waitUntil:'domcontentloaded'});await pressed(product());
  productSupported=false;await page.reload({waitUntil:'domcontentloaded'});await page.getByText('โหมดสร้างสินค้ายังไม่พร้อมใช้งาน',{exact:true}).waitFor();
  assert(await page.getByRole('button',{name:'สร้างภาพสินค้า',exact:true}).isDisabled());
  await page.locator('form.idea-composer').evaluate(form=>form.requestSubmit());assert.equal(posts.length,0,'old capabilities must block product POST');
  productSupported=true;await page.reload({waitUntil:'domcontentloaded'});await pressed(product());
  await page.getByRole('button',{name:'สร้างภาพสินค้า',exact:true}).click();
  await page.getByRole('heading',{name:'สินค้าของคุณเป็นรูปเป็นร่างแล้ว'}).waitFor();
  assert.equal(posts.at(-1).category,'product');assert.equal(Object.hasOwn(posts.at(-1),'designFormat'),false);
  await character().click();await pressed(character());
  await page.getByLabel('ชื่อสินค้า',{exact:true}).fill('Perfume fixture');
  await page.getByRole('button',{name:'บันทึกสินค้า',exact:true}).click();
  await page.getByRole('button',{name:'บันทึกลงคลังแล้ว',exact:true}).waitFor();
  assert.equal(saves.at(-1).assetType,'prop');assert.equal(saves.at(-1).prompt,'Glass perfume bottle with cream package');
  await page.screenshot({path:`${artifacts}/product-result-char-mode-${width}.png`});
  await page.getByLabel('อธิบายตัวละครของคุณ').fill('Silver explorer character');
  await page.getByRole('button',{name:'สร้างภาพตัวละครอีกแบบ',exact:true}).click();
  await page.getByRole('heading',{name:'ตัวละครของคุณเป็นรูปเป็นร่างแล้ว'}).waitFor();
  await product().click();await page.getByLabel('ชื่อตัวละคร',{exact:true}).fill('Explorer fixture');
  await page.getByRole('button',{name:'บันทึกตัวละคร',exact:true}).click();
  await page.getByRole('button',{name:'บันทึกลงคลังแล้ว',exact:true}).waitFor();assert.equal(saves.at(-1).assetType,'character');
  await page.getByLabel('อธิบายสินค้าของคุณ').fill('Uncertain product request');
  failPost=true;await page.getByRole('button',{name:'สร้างภาพสินค้าอีกแบบ',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'การเชื่อมต่อขัดข้อง'}).waitFor();const pending=posts.at(-1);
  assert.equal(await character().isDisabled(),true);
  failJobLookup=true;slowJobLookup=true;productSupported=false;await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await character().isDisabled(),true,'category remains locked during initial old-job lookup');await pressed(product());
  await page.getByRole('alert').filter({hasText:'ตรวจสอบคำขอก่อนหน้าไม่สำเร็จ'}).waitFor();
  await page.getByText('โหมดสร้างสินค้ายังไม่พร้อมใช้งาน',{exact:true}).waitFor();const blockedCount=posts.length;
  await page.locator('form.idea-composer').evaluate(form=>form.requestSubmit());assert.equal(posts.length,blockedCount,'old capabilities block immutable product replay');
  failJobLookup=false;slowJobLookup=false;productSupported=true;await page.reload({waitUntil:'domcontentloaded'});await pressed(product());
  await page.getByText('กำลังตรวจสอบคำขอก่อนหน้า',{exact:false}).waitFor();
  assert.equal(await character().isDisabled(),true,'older terminal result cannot unlock newer unknown request');
  await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).click();
  await page.getByRole('heading',{name:'สินค้าของคุณเป็นรูปเป็นร่างแล้ว'}).waitFor();
  assert.deepEqual(posts.at(-1),pending,'reloaded retry preserves category/options/key');
  await page.locator('#character-reference').setInputFiles({name:'product.png',mimeType:'image/png',buffer:Buffer.from(png.split(',')[1],'base64')});
  await page.getByText('กำลังอัปโหลดภาพ…',{exact:true}).waitFor();assert.equal(await character().isDisabled(),true);
  await page.getByText('product.png',{exact:true}).waitFor();
  await page.getByRole('button',{name:'สร้างภาพสินค้าอีกแบบ',exact:true}).click();
  await page.getByRole('button',{name:'สร้างภาพสินค้าอีกแบบ',exact:true}).waitFor();
  assert.equal(posts.at(-1).referenceImageId,'12345678-1234-1234-1234-123456789abc');assert.equal(Object.hasOwn(posts.at(-1),'designFormat'),false);
  await layout('signed-in-product');await page.screenshot({path:`${artifacts}/signed-product-${width}.png`});
  failJobLookup=true;await page.getByRole('button',{name:'สร้างภาพสินค้าอีกแบบ',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Fixture job lookup unavailable'}).waitFor();
  const confirmed=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('violet-character-submission')));
  assert.equal(typeof confirmed.jobId,'string');const confirmedBody=posts.at(-1);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('alert').filter({hasText:'ตรวจสอบคำขอก่อนหน้าไม่สำเร็จ'}).waitFor();
  assert.equal(await character().isDisabled(),true,'matching pending job lookup failure stays locked');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('violet-character-submission'))),confirmed);
  failJobLookup=false;await page.getByRole('button',{name:'ส่งคำขอเดิมอีกครั้ง',exact:true}).click();
  await page.waitForFunction(()=>!sessionStorage.getItem('violet-character-submission'));
  assert.deepEqual(posts.at(-1),confirmedBody,'matching pending retry uses exact accepted body/key');
  await page.goto(`${base}/studio/jobs`,{waitUntil:'domcontentloaded'});
  const firstProduct=page.locator('article').filter({hasText:'ภาพสินค้า'}).first();
  await firstProduct.getByRole('textbox').fill('Activity product');await firstProduct.getByRole('button',{name:'บันทึกสินค้า',exact:true}).click();
  await firstProduct.getByRole('button',{name:'บันทึกลงคลังแล้ว',exact:true}).waitFor();assert.equal(saves.at(-1).assetType,'prop');assert(saves.at(-1).description.length<=2000);
  await page.goto(`${base}/studio/library`,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Explorer fixture',exact:true}).waitFor();
  const propMode=page.getByRole('button',{name:'สินค้า/พร็อพ',exact:true});await propMode.click();await pressed(propMode);
  await page.getByRole('heading',{name:'Perfume fixture',exact:true}).waitFor();
  assert.equal(queries.at(-1).type,'prop');assert.equal(queries.at(-1).page,'1');assert.equal(await page.getByRole('link',{name:'ใช้สร้างวิดีโอ',exact:false}).count(),0);
  await page.screenshot({path:`${artifacts}/prop-library-${width}.png`});
  for(const state of ['empty','error','loading']){
   assetState=state;await page.getByRole('textbox',{name:'ค้นหาสินค้า/พร็อพ'}).fill(state);
   if(state==='empty'){await page.getByRole('heading',{name:'ไม่พบสินค้า/พร็อพที่ค้นหา'}).waitFor();assert.equal(await page.getByRole('link',{name:'สร้างภาพแรก',exact:false}).getAttribute('href'),'/studio/images?category=product');}
   if(state==='error')await page.getByRole('alert').filter({hasText:'Fixture library unavailable'}).waitFor();
   if(state==='loading')await page.getByRole('status').filter({hasText:'กำลังโหลดคลังผลงาน'}).waitFor();
   await page.screenshot({path:`${artifacts}/prop-library-${state}-${width}.png`});
  }
  assetState='empty';await page.getByRole('textbox',{name:'ค้นหาสินค้า/พร็อพ'}).fill('empty-again');
  await page.getByRole('heading',{name:'ไม่พบสินค้า/พร็อพที่ค้นหา'}).waitFor();
  await page.evaluate(()=>sessionStorage.setItem('violet-character-draft',JSON.stringify({version:1,category:'character',prompt:'Different character draft'})));
  await page.getByRole('link',{name:'สร้างภาพแรก',exact:false}).click();await pressed(product());
  assert.deepEqual(pageErrors,[]);observations.push({width,posts:posts.map(p=>({category:p.category,designFormat:p.designFormat,idempotencyKey:p.idempotencyKey})),saves:saves.map(s=>({assetType:s.assetType,jobId:s.jobId,prompt:s.prompt})),pageErrors,consoleErrors,httpErrors});
  await context.close();
 }
 console.log(JSON.stringify({status:'PASS',boundary:'loopback auth and browser API fixtures, generated image is1px fixture; no provider/media production checks',observations},null,2));
} catch(error) {console.error('fixture failure',error);console.error('saved fixture metadata',lastSaves);if(activePage){console.error(await activePage.locator('body').innerText());await activePage.screenshot({path:`${artifacts}/failure.png`});}throw error;} finally {await browser?.close();await new Promise(resolve=>fixture.close(resolve));}
