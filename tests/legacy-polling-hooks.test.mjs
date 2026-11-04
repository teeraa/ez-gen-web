import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(path,hookName,resourceKey){
 const rows=[],effects=[],requests=[];let cursor=0,latest;
 const react={useState(initial){const i=cursor++;if(!(i in rows))rows[i]=initial;return[rows[i],value=>{rows[i]=value}]},useRef(initial){const i=cursor++;if(!(i in rows))rows[i]={current:initial};return rows[i]},useEffect(fn,deps){const i=cursor++;const old=rows[i];if(!old||deps.some((d,n)=>d!==old[n])){rows[i]=deps;effects.push(fn)}}};
 const api={get:(id,signal)=>{requests.push({id,signal});return Promise.resolve({})}};
 const require=name=>name==='react'?react:name==='@/lib/api'?{jobsApi:api,exportsApi:api}:name==='@/lib/refresh-polling'?{earliestExpiry:()=>undefined}:name==='@/hooks/use-refresh-polling'?{useRefreshPolling:(key,options)=>{latest={key,...options}}}:name==='@/types/api'?{TERMINAL_STATUSES:['succeeded','failed','cancelled'],EXPORT_TERMINAL_STATUSES:['succeeded','failed']}:(()=>{throw new Error(name)})();
 const context={exports:{},require,Error};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText,context);
 return{render(id,onTerminal){cursor=0;context.exports[hookName]({[resourceKey]:id,onTerminal});while(effects.length)effects.shift()();return latest},rows,requests};
}
for(const [file,hook,key,responseKey] of [['use-polling','useJobPolling','jobId','jobId'],['use-export-polling','useExportPolling','exportId','exportId']]){
 test(`${hook} retains terminal callback once per resource and stops on errors while forwarding cancellation`,async()=>{
  const h=harness(`src/hooks/${file}.ts`,hook,key);let completed=0;
  const first=h.render('one',()=>completed++);assert.equal(first.key,'one');assert.equal(first.onData({[responseKey]:'one',status:'processing'}).poll,true);
  assert.equal(first.onData({[responseKey]:'one',status:'succeeded'}).poll,false);first.onData({[responseKey]:'one',status:'succeeded'});assert.equal(completed,1);
  first.onError(new Error('offline'));assert.equal(h.rows[1],false);assert.equal(h.rows[2],'offline');
  const same=h.render('one',()=>completed++);same.onData({[responseKey]:'one',status:'succeeded'});assert.equal(completed,1,'focus/visible refresh must not repeat completion action');
  const next=h.render('two',()=>completed++);next.onData({[responseKey]:'two',status:'failed'});assert.equal(completed,2);
  const abort=new AbortController();await next.fetch(abort.signal);assert.equal(h.requests[0].id,'two');assert.equal(h.requests[0].signal,abort.signal);
 });
}
