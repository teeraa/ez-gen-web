import test from 'node:test';
import assert from 'node:assert/strict';
import {connectMediaPlayback,playbackTimeline,playbackWindowAt} from '../src/components/ai-editor/media-playback.ts';
class Media extends EventTarget {
  readyState=4; seeking=false; paused=true; time=0; seeks=0; plays=0;
  get currentTime(){return this.time;} set currentTime(value){this.time=value;this.seeks++;}
  play(){this.plays++;this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
  emit(name){this.dispatchEvent(new Event(name));}
}
let queue=new Map(), id=0;
globalThis.requestAnimationFrame=fn=>{queue.set(++id,fn);return id;};
globalThis.cancelAnimationFrame=key=>queue.delete(key);
const tick=()=>{const jobs=[...queue.values()];queue.clear();jobs.forEach(fn=>fn());};
const window={start:2,end:4,at:0,timelineEnd:2};
test('media stalls freeze the timeline and never cause drift seeks or repeated play',async()=>{
 const media=new Media(), times=[];const cleanup=connectMediaPlayback(media,window,0,true,true,t=>times.push(t),()=>{},()=>{});
 await Promise.resolve();assert.equal(media.seeks,1);assert.equal(media.plays,1);
 media.time=2.5;tick();assert.equal(times.at(-1),.5);
 media.emit('waiting');for(let i=0;i<100;i++)tick();assert.equal(times.at(-1),.5);assert.equal(media.seeks,1);
 media.emit('playing');media.time=3;tick();assert.equal(times.at(-1),1);assert.equal(media.plays,1);cleanup();assert.equal(queue.size,0);
});
test('seek freezes samples, boundary and ended complete once, cleanup fences late events',async()=>{
 const media=new Media();let finished=0;const times=[];
 const cleanup=connectMediaPlayback(media,window,.5,true,true,t=>times.push(t),()=>finished++,()=>{});await Promise.resolve();
 media.seeking=true;media.time=3;media.emit('seeking');media.emit('timeupdate');assert.equal(times.length,0);
 media.seeking=false;media.emit('seeked');media.time=4.1;tick();media.emit('ended');assert.equal(finished,1);assert.equal(times.at(-1),2);
 cleanup();media.emit('ended');assert.equal(finished,1);
});
test('same asset transition seeks once, pause does not seek, explicit scrub and replay do',()=>{
 const media=new Media();let cleanup=connectMediaPlayback(media,window,0,true,true,()=>{},()=>{},()=>{});cleanup();
 cleanup=connectMediaPlayback(media,{start:7,end:9,at:2,timelineEnd:4},2,true,true,()=>{},()=>{},()=>{});assert.equal(media.currentTime,7);assert.equal(media.seeks,2);cleanup();
 cleanup=connectMediaPlayback(media,{start:7,end:9,at:2,timelineEnd:4},2,false,false,()=>{},()=>{},()=>{});assert.equal(media.seeks,2);assert.equal(media.paused,true);cleanup();
 cleanup=connectMediaPlayback(media,window,1,false,true,()=>{},()=>{},()=>{});assert.equal(media.currentTime,3);cleanup();
 cleanup=connectMediaPlayback(media,window,0,true,true,()=>{},()=>{},()=>{});assert.equal(media.currentTime,2);cleanup();
});
test('errors and rejected play stop intent, disposed rejection cannot affect a replacement',async()=>{
 const media=new Media();let failures=0;media.play=()=>Promise.reject(new Error('blocked'));
 let cleanup=connectMediaPlayback(media,window,0,true,true,()=>{},()=>{},()=>failures++);await new Promise(resolve=>setImmediate(resolve));assert.equal(failures,1);cleanup();
 cleanup=connectMediaPlayback(media,window,0,true,true,()=>{},()=>{},()=>failures++);cleanup();await new Promise(resolve=>setImmediate(resolve));assert.equal(failures,1);
});

test('decimal trim boundaries visit all four clips instead of falling through to the last', () => {
 const segments=[{id:'A',start:0,end:.1},{id:'B',start:.2,end:.4},{id:'C',start:0,end:1},{id:'D',start:0,end:1}];
 const timeline=playbackTimeline(segments);
 const visited=[];let time=0;
 for(let i=0;i<segments.length;i++){
  const current=playbackWindowAt(timeline,time);
  visited.push(current.id);const media=new Media();const cleanup=connectMediaPlayback(media,current,time,true,true,value=>time=value,()=>{},()=>{});media.time=current.end;media.emit('timeupdate');cleanup();
 }
 assert.deepEqual(visited,['A','B','C','D']);
 assert.equal(time,timeline.at(-1).timelineEnd);
 assert.equal(playbackWindowAt(timeline,time).id,'D');
 assert.equal(playbackWindowAt(timeline,-1),undefined);
});
