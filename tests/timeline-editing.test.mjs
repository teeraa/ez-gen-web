import test from 'node:test';
import assert from 'node:assert/strict';
import {trimTimelineItem,canSplitTimelineItem,splitTimelineItem} from '../src/components/ai-editor/timeline-editing.ts';

test('video trim changes source bounds, allows extension and enforces packed total room',()=>{
 const clip={id:'v',start:2,end:8,volume:.4};
 assert.deepEqual(trimTimelineItem(clip,'video','head',1,10,20),{...clip,start:3});
 assert.equal(trimTimelineItem(clip,'video','head',-99,10,20).start,0);
 assert.equal(trimTimelineItem(clip,'video','tail',99,10,20).end,10);
 assert.equal(trimTimelineItem(clip,'video','head',99,10,20).start,7.9);
 assert.equal(trimTimelineItem(clip,'video','tail',-99,10,20).end,2.1);
 assert.equal(trimTimelineItem(clip,'video','tail',99,10,1199).end,9);
 assert.equal(trimTimelineItem(clip,'video','head',-99,10,1200).start,2);
 assert.equal(trimTimelineItem(clip,'video','tail',NaN,10,20),undefined);
});
test('audio head keeps source alignment and fixed tail; extends only to source or timeline zero',()=>{
 const clip={id:'a',at:5,start:2,end:8,volume:.7};
 const next=trimTimelineItem(clip,'audio','head',1,10,20);
 assert.deepEqual(next,{...clip,at:6,start:3});assert.equal(next.at+next.end-next.start,11);
 assert.deepEqual(trimTimelineItem(clip,'audio','head',-99,10,20),{...clip,at:3,start:0});
 assert.deepEqual(trimTimelineItem({...clip,at:1},'audio','head',-99,10,20),{...clip,at:0,start:1});
 assert.equal(trimTimelineItem({...clip,at:1195},'audio','tail',99,30,20).end,7);
 assert.equal(trimTimelineItem(clip,'audio','tail',99,10,20).end,10);
 assert.equal(trimTimelineItem(clip,'audio','head',99,10,20).start,7.9);
});
test('text trim retains geometry while respecting absolute bounds and minimum duration',()=>{
 const text={id:'t',start:2,end:8,x:.4,scaleX:1.8};
 assert.deepEqual(trimTimelineItem(text,'text','head',-99,1200,20),{...text,start:0});
 assert.deepEqual(trimTimelineItem(text,'text','tail',9999,1200,20),{...text,end:1200});
 assert.equal(trimTimelineItem(text,'text','head',99,1200,20).start,7.9);
 assert.equal(trimTimelineItem(text,'text','tail',-99,1200,20).end,2.1);
});
test('split uses the exact timeline playhead on each track and preserves all metadata',()=>{
 const video={id:'v',start:2,end:8,asset:'asset',volume:.8};
 assert.deepEqual(splitTimelineItem(video,'video',13,'v2',1,20,10),[{...video,end:5},{...video,id:'v2',start:5}]);
 const audio={id:'a',at:10,start:2,end:8,assetId:'asset',volume:.3};
 assert.deepEqual(splitTimelineItem(audio,'audio',13,'a2',1,20),[{...audio,end:5},{...audio,id:'a2',start:5,at:13}]);
 const text={id:'t',start:10,end:16,text:'ไทย',scaleX:2,scaleY:.5,x:.7,y:.2};
 assert.deepEqual(splitTimelineItem(text,'text',13,'t2',1,50),[{...text,end:13},{...text,id:'t2',start:13}]);
});
test('split never falls back to midpoint and respects count/minimum constraints',()=>{
 const clip={id:'v',start:2,end:8};
 for(const at of [0,9.99,10,10.05,15.95,16,17,NaN])assert.equal(canSplitTimelineItem(clip,'video',at,1,20,10),false);
 assert.equal(canSplitTimelineItem(clip,'video',10.1,1,20,10),true);
 assert.equal(canSplitTimelineItem(clip,'video',13,20,20,10),false);
 assert.equal(splitTimelineItem(clip,'video',0,'new',1,20,10),undefined);
 assert.equal(canSplitTimelineItem({id:'a',at:4,start:0,end:2},'audio',5,20,20),false);
 assert.equal(canSplitTimelineItem({id:'t',start:0,end:2},'text',1,50,50),false);
});

test('fractional audio playhead preserves the exact shared source and timeline boundary',()=>{
 const clip={id:'a',at:.25,start:2.5,end:8};const at=3.123456789;
 const [left,right]=splitTimelineItem(clip,'audio',at,'b',1,20);
 assert.equal(left.end,right.start);assert.equal(right.at,at);
 assert(Math.abs(left.at+left.end-left.start-at)<1e-12);
 assert(Math.abs((right.start-clip.start)-(at-clip.at))<1e-12);
});
