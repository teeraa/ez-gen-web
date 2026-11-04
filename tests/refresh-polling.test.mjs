import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
const source=ts.transpileModule(fs.readFileSync('src/lib/refresh-polling.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{},AbortController,Date,setTimeout,clearTimeout};vm.runInNewContext(source,context);
const {createRefreshController:create,earliestExpiry}=context.exports;
const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve()};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
function fakeClock(){let now=0,id=0;const timers=new Map();return{clock:{now:()=>now,setTimeout:(fn,delay)=>{timers.set(++id,{at:now+delay,fn});return id},clearTimeout:id=>timers.delete(id)},async advance(ms){const target=now+ms;for(;;){const due=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();await settle()}now=target;await settle()},size:()=>timers.size}}
test('completion scheduling never overlaps and terminal/empty plan stops all periodic requests',async()=>{
 const time=fakeClock(),first=deferred();let calls=0,applied=0;
 const c=create({clock:time.clock,intervalMs:4000,fetch:()=>{calls++;return calls===1?first.promise:Promise.resolve('done')},onData:data=>{applied++;return{poll:data!=='done'}}});
 await time.advance(12000);assert.equal(calls,1);assert.equal(await c.refresh('resume'),false);
 first.resolve('active');await settle();await time.advance(3999);assert.equal(calls,1);await time.advance(1);assert.equal(calls,2);await time.advance(60000);assert.equal(calls,2);assert.equal(applied,2);assert.equal(time.size(),0);c.dispose();
});
test('hidden aborts current context; stale response ignored and visible/focus burst performs one fresh request',async()=>{
 const time=fakeClock(),pending=deferred();let signal,calls=0;const applied=[];
 const c=create({clock:time.clock,intervalMs:4000,fetch:s=>{signal=s;calls++;return calls===1?pending.promise:Promise.resolve('visible')},onData:v=>{applied.push(v);return{poll:false}}});
 c.setVisible(false);assert(signal.aborted);await time.advance(10000);assert.equal(calls,1);c.setVisible(true);c.refresh('resume');pending.resolve('stale');await settle();assert.equal(calls,2);assert.deepEqual(applied,['visible']);await c.refresh('resume');await c.refresh('resume');assert.equal(calls,2);c.dispose();
});
test('dispose aborts old context and prevents late result/error/timer from mutating replacement context',async()=>{
 const time=fakeClock(),pending=deferred();let stale=0;const c=create({clock:time.clock,intervalMs:3000,fetch:()=>pending.promise,onData:()=>{stale++;return{poll:true}},onError:()=>stale++});c.dispose();pending.resolve('late');await settle();await time.advance(10000);assert.equal(stale,0);assert.equal(time.size(),0);
});
test('past/invalid/same expired deadlines and expiry errors never spin; only a new future deadline rearms',async()=>{
 assert.equal(earliestExpiry(['invalid',null]),undefined);
 const time=fakeClock();let calls=0;let expiry=-1;let fail=false;
 const c=create({clock:time.clock,intervalMs:4000,fetch:async()=>{calls++;if(fail)throw new Error('offline');return expiry},onData:expiresAt=>({poll:false,expiresAt}),onError:()=>{}});
 await settle();await time.advance(1000);assert.equal(calls,2);await time.advance(60000);assert.equal(calls,2);
 expiry=-2;await c.refresh();await time.advance(60000);assert.equal(calls,3,'another already-expired deadline cannot rearm');
 expiry=time.clock.now()+5000;await c.refresh();assert.equal(calls,4);fail=true;await time.advance(5000);assert.equal(calls,5);await time.advance(60000);assert.equal(calls,5);c.dispose();
});
test('manual media refresh is bounded and errors stop until explicit/resume refresh',async()=>{
 const time=fakeClock();let calls=0;const c=create({clock:time.clock,intervalMs:3000,initial:false,fetch:async()=>{calls++;throw new Error('offline')},onData:()=>({poll:true}),onError:()=>{}});
 await c.refresh('media');await c.refresh('media');assert.equal(calls,1);await time.advance(14999);assert.equal(calls,1);await time.advance(1);await c.refresh('media');assert.equal(calls,2);await time.advance(60000);assert.equal(calls,2);c.dispose();
});

test('rapid hide/show during resume cooldown keeps active polling live without an immediate extra request',async()=>{
 const time=fakeClock();let calls=0;const c=create({clock:time.clock,intervalMs:4000,visible:false,fetch:async()=>++calls,onData:()=>({poll:true})});
 c.setVisible(true);await settle();assert.equal(calls,1);await time.advance(100);c.setVisible(false);c.setVisible(true);await settle();assert.equal(calls,1);await time.advance(4000);assert.equal(calls,2);c.dispose();
});
test('an expired gallery deadline cannot mask another image future expiry; manual requests coalesce behind an in-flight fetch',async()=>{
 const time=fakeClock();let calls=0;const first=deferred();const c=create({clock:time.clock,intervalMs:4000,fetch:()=>{calls++;return calls===1?first.promise:Promise.resolve(null)},onData:()=>({expiresAt:[-1,5000]})});
 await c.refresh();await c.refresh();assert.equal(calls,1);first.resolve(null);await settle();assert.equal(calls,2);await time.advance(1000);assert.equal(calls,3);await time.advance(4000);assert.equal(calls,4);await time.advance(10000);assert.equal(calls,4);c.dispose();
});

test('far future expiry chunks native timer limits without refreshing before its deadline',async()=>{
 const time=fakeClock();const nativeClock={...time.clock,setTimeout:(fn,delay)=>time.clock.setTimeout(fn,delay>2147483647?1:delay)};let calls=0;
 const c=create({clock:nativeClock,intervalMs:4000,fetch:async()=>++calls,onData:()=>({expiresAt:3000000000})});
 await settle();await time.advance(1000);assert.equal(calls,1);await time.advance(2147482647);assert.equal(calls,1);await time.advance(852516353);assert.equal(calls,2);c.dispose();
});
