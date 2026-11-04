import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const artifact=process.env.ARTIFACT_DIR || '/tmp/ai-editor-quality-20261028';
const source=ts.transpileModule(fs.readFileSync('src/components/ai-editor/media-playback.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const media=fs.readFileSync(process.env.FIXTURE_VIDEO || '/tmp/ai-editor-revision/changing-frames.mp4');
const server=http.createServer((req,res)=>{if(req.url==='/controller.js'){res.setHeader('Content-Type','text/javascript');res.end(source);}else if(req.url==='/video.mp4'){res.setHeader('Content-Type','video/mp4');res.setHeader('Accept-Ranges','bytes');const range=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');if(range){const start=Number(range[1]),end=range[2]?Number(range[2]):media.length-1;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${media.length}`,'Content-Length':end-start+1});res.end(media.subarray(start,end+1));}else{res.setHeader('Content-Length',media.length);res.end(media);}}else{res.setHeader('Content-Type','text/html');res.end('<video src="/video.mp4" muted playsinline style="max-width:100%"></video><button>Play fixture</button>');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result=[];
try{for(const width of [1440,375]){
const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
const observed=await page.evaluate(async()=>{
 const {connectMediaPlayback}=await import('/controller.js');const video=document.querySelector('video');let seeks=0,plays=0;video.addEventListener('seeking',()=>seeks++);const original=video.play.bind(video);video.play=()=>{plays++;return original();};let time=0,finished=0,failed=0;const until=async(fn)=>{const deadline=performance.now()+8000;while(!fn()){if(performance.now()>deadline)throw new Error('Media condition timeout '+JSON.stringify({time,finished,source:video.currentTime,ready:video.readyState,seeking:video.seeking,paused:video.paused}));await new Promise(resolve=>setTimeout(resolve,25));}};
 let cleanup=connectMediaPlayback(video,{start:1,end:2,at:0,timelineEnd:1},0,true,true,t=>time=t,()=>finished++,()=>failed++);
 await until(()=>time>.15);const moving=time;video.pause();video.dispatchEvent(new Event('waiting'));const frozen=time;await new Promise(resolve=>setTimeout(resolve,250));const afterWait=time;await video.play();
 await until(()=>finished===1);cleanup();const first={moving,frozen,afterWait,finished,failed,seeks,plays,time};
 cleanup=connectMediaPlayback(video,{start:3,end:3.5,at:1,timelineEnd:1.5},1,true,true,t=>time=t,()=>finished++,()=>failed++);await until(()=>finished===2);cleanup();
 const second={time,finished,seeks};
 cleanup=connectMediaPlayback(video,{start:1,end:2,at:0,timelineEnd:1},.5,false,true,t=>time=t,()=>finished++,()=>failed++);await until(()=>!video.seeking && Math.abs(video.currentTime-1.5)<.02);const scrub=video.currentTime;cleanup();return {first,second,scrub};
});
console.log(JSON.stringify({width,observed}));assert(observed.first.moving>0);assert.equal(observed.first.afterWait,observed.first.frozen);assert.equal(observed.first.finished,1);assert.equal(observed.first.seeks,1);assert.equal(observed.first.failed,0);assert.equal(observed.second.finished,2);assert(Math.abs(observed.second.time-1.5)<.01);assert(Math.abs(observed.scrub-1.5)<.02);assert.deepEqual(errors,[]);
await page.screenshot({path:`${artifact}/media-fixture-${width}.png`});result.push({width,observed,errors});await page.close();}
fs.writeFileSync(`${artifact}/media-browser-results.json`,JSON.stringify({boundary:'isolated real-video controller fixture; not authenticated app or user footage',result},null,2));console.log(JSON.stringify(result));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
