import test from 'node:test';
import assert from 'node:assert/strict';
import {clampFades,clampSpeed,fadeGain,snapShift,SPEED_PRESETS} from '../src/components/ai-editor/clip-effects.ts';
import {playbackTimeline,segmentLength} from '../src/components/ai-editor/media-playback.ts';
import {canSplitTimelineItem,splitTimelineItem,trimTimelineItem} from '../src/components/ai-editor/timeline-editing.ts';
import {buildSubtitleLayers} from '../src/components/ai-editor/subtitles.ts';

test('speed changes timeline length and positions',()=>{
  const timeline=playbackTimeline([{id:'a',start:0,end:4,speed:2},{id:'b',start:2,end:3,speed:.5},{id:'c',start:0,end:1}]);
  assert.deepEqual(timeline.map(item=>[item.at,item.timelineEnd]),[[0,2],[2,4],[4,5]]);
  assert.equal(segmentLength({start:0,end:3}),3);
  assert.equal(segmentLength({start:0,end:3,speed:0}),3,'invalid speed falls back to 1x');
});

test('trimming a sped-up clip converts timeline seconds to source seconds',()=>{
  const item={id:'v',start:2,end:6,speed:2};
  // Dragging the tail 1 s left on screen removes 2 source seconds.
  assert.equal(trimTimelineItem(item,'video','tail',-1,10,2,1200).end,4);
  assert.equal(trimTimelineItem(item,'video','head',.5,10,2,1200).start,3);
  // 1x keeps the old behaviour.
  assert.equal(trimTimelineItem({id:'v',start:2,end:6},'video','tail',-1,10,4,1200).end,5);
});

test('splitting a sped-up clip cuts at the matching source time',()=>{
  const item={id:'v',start:2,end:6,speed:2};
  assert.equal(canSplitTimelineItem(item,'video',1.9,1,20,0),true);
  assert.equal(canSplitTimelineItem(item,'video',2,1,20,0),false,'the clip lasts 2 timeline seconds');
  const [first,second]=splitTimelineItem(item,'video',1,'v2',1,20,0);
  assert.deepEqual([first.start,first.end,second.start,second.end,second.speed],[2,4,4,6,2]);
});

test('subtitles follow sped-up clips',()=>{
  const timeline=playbackTimeline([{asset:'a',start:0,end:10,speed:2}]);
  const {layers}=buildSubtitleLayers([{assetId:'a',hasSpeech:true,segments:[{start:4,end:6,text:'สวัสดี'}]}],timeline,{ratio:16/9,capacity:10,makeId:()=>'x',maxTimeline:1200});
  assert.deepEqual(layers.map(layer=>[layer.start,layer.end]),[[2,3]]);
});

test('speed is clamped to the supported range',()=>{
  assert.deepEqual([clampSpeed(.1),clampSpeed(9),clampSpeed(1.234),clampSpeed(NaN)],[.25,4,1.23,1]);
  assert.deepEqual(SPEED_PRESETS,[.25,.5,1,1.5,2,3,4]);
});

test('fades stay within 0-10 s and inside the clip',()=>{
  assert.deepEqual(clampFades({fadeIn:3,fadeOut:1},2,'fadeIn'),{fadeIn:2,fadeOut:0});
  assert.deepEqual(clampFades({fadeIn:1,fadeOut:5},4,'fadeOut'),{fadeIn:0,fadeOut:4});
  assert.deepEqual(clampFades({fadeIn:12},30,'fadeIn'),{fadeIn:10,fadeOut:0});
  assert.deepEqual(clampFades({fadeIn:-1,fadeOut:1},4,'fadeIn'),{fadeIn:0,fadeOut:1});
});

test('fade gain ramps linearly at both ends',()=>{
  const fades={fadeIn:1,fadeOut:2};
  assert.deepEqual([0,.5,1,3,4,5].map(t=>fadeGain(t,5,fades)),[0,.5,1,1,.5,0]);
  assert.equal(fadeGain(2,5,{}),1);
});

test('snap picks the closest point within the threshold',()=>{
  assert.deepEqual(snapShift([10,13],[0,12.9,20],.3),{shift:-.09999999999999964,guide:12.9});
  assert.deepEqual(snapShift([10,13],[5,20],.3),{shift:0});
  assert.deepEqual(snapShift([4.95],[5,4.8],.3),{shift:.04999999999999982,guide:5});
});

test('save body sends speed and fades only to clip-effect backends, omitting defaults',async()=>{
  const {saveRequestBody,normaliseAudioClips}=await import('../src/components/ai-editor/tracks.ts');
  const snapshot={title:'Demo',ratio:'9/16',segments:[{id:'s1',asset:'a',start:0,end:4,volume:1,speed:2,fadeIn:.5,fadeOut:0},{id:'s2',asset:'a',start:0,end:1,volume:1,speed:1}],audioClips:[{id:'c',assetId:'m',at:0,start:0,end:3,volume:1,fadeIn:1,fadeOut:0}],textLayers:[]};
  const on=saveRequestBody(snapshot,3,true,true);
  assert.deepEqual(on.segments,[{id:'s1',assetId:'a',start:0,end:4,volume:1,speed:2,fadeIn:.5},{id:'s2',assetId:'a',start:0,end:1,volume:1}]);
  assert.deepEqual(on.audioClips,[{id:'c',assetId:'m',at:0,start:0,end:3,volume:1,fadeIn:1}]);
  const off=saveRequestBody(snapshot,3,true,false);
  assert.deepEqual(off.segments[0],{id:'s1',assetId:'a',start:0,end:4,volume:1});
  assert.deepEqual(off.audioClips,[{id:'c',assetId:'m',at:0,start:0,end:3,volume:1}]);
  assert.deepEqual(normaliseAudioClips([{id:'c',assetId:'m',at:0,start:0,end:3,volume:1,fadeIn:1.5,fadeOut:-2}]),[{id:'c',assetId:'m',at:0,start:0,end:3,volume:1,fadeIn:1.5}]);
});

test('look colour matches the export eq mapping',async()=>{
  const {lookColour,hasColour,hasFrame}=await import('../src/components/ai-editor/clip-effects.ts');
  assert.deepEqual(lookColour({}),{slope:1,intercept:0,saturate:1});
  const c=lookColour({brightness:.5,contrast:-1,saturation:-1});
  assert.equal(c.slope,.5);assert.ok(Math.abs(c.intercept-(.25+.15))<1e-9);assert.equal(c.saturate,0);
  assert.equal(hasColour({fit:'cover'}),false);assert.equal(hasFrame({zoom:1}),false);assert.equal(hasFrame({fit:'cover'}),true);
});

test('frame rect mirrors scale, pad and crop',async()=>{
  const {frameRect}=await import('../src/components/ai-editor/clip-effects.ts');
  const video={width:1920,height:1080},frame={width:360,height:640};
  // Contain: letterboxed, centred vertically.
  assert.deepEqual(frameRect({},video,frame),{left:0,top:218.75,width:360,height:202.5});
  // Cover panned fully left shows the left edge; panned right shows the right edge.
  const left=frameRect({fit:'cover',panX:-1},video,frame), right=frameRect({fit:'cover',panX:1},video,frame);
  assert.equal(left.left,0);assert.ok(Math.abs(right.left-(360-right.width))<1e-9);assert.ok(Math.abs(left.height-640)<1e-9);
  // Zoom 2 in contain doubles the size and centres the overflow.
  const zoom=frameRect({zoom:2},video,frame);
  assert.deepEqual([zoom.width,zoom.height,zoom.left],[720,405,-180]);
  assert.equal(frameRect({},{width:0,height:0},frame),undefined);
});

test('patchLook clamps and drops defaults',async()=>{
  const {patchLook}=await import('../src/components/ai-editor/clip-effects.ts');
  assert.deepEqual(patchLook({id:'s'},{brightness:2,zoom:1,fit:undefined,panX:0}),{id:'s',brightness:1});
  assert.deepEqual(patchLook({id:'s',saturation:-1,fit:'cover'},{saturation:0,zoom:2.345}),{id:'s',fit:'cover',zoom:2.35});
});

test('text style keeps server rules and previews like the export',async()=>{
  const {styleTextLayer,textStylePreview,textAnimationAt,normaliseTextLayers,saveRequestBody,newTextLayer}=await import('../src/components/ai-editor/tracks.ts');
  const base=newTextLayer('t',0,10);
  assert.deepEqual(styleTextLayer(base,{outlineWidth:0,outlineColor:'#000000'}),base,'zero outline drops its colour');
  const styled=styleTextLayer(base,{outlineWidth:25,outlineColor:'#abcdef',boxOpacity:.555,boxColor:'#000000',animation:'slide'});
  assert.deepEqual([styled.outlineWidth,styled.outlineColor,styled.boxOpacity,styled.animation],[20,'#ABCDEF',.555,'slide']);
  assert.equal(styleTextLayer(base,{animation:'spin'}).animation,undefined);
  const css=textStylePreview({fontSize:100,outlineWidth:4,outlineColor:'#000000',boxOpacity:.5,boxColor:'#FF0000'},720);
  // font 67 px → pad round(67·0.3)=20 + outline round(4·720/1080)=3; matches drawtext boxborderw 23.
  assert.equal(css.boxShadow,'0 0 0 23px #FF000080');assert.equal(css.WebkitTextStroke,'6px #000000');
  assert.deepEqual(textAnimationAt({start:1,end:3,animation:'fade'},1),{opacity:0,rise:0});
  assert.deepEqual(textAnimationAt({start:1,end:3,animation:'fade'},2),{opacity:1,rise:0});
  const slide=textAnimationAt({start:1,end:3,animation:'slide'},1.15);
  assert.ok(Math.abs(slide.opacity-.5)<1e-9&&Math.abs(slide.rise-.02)<1e-9);
  assert.equal(normaliseTextLayers([{...base,boxOpacity:2,boxColor:'#000000',animation:'x'}])[0].boxOpacity,1);
  const snapshot={title:'t',ratio:'9/16',segments:[],audioClips:[],textLayers:[styled]};
  assert.equal(saveRequestBody(snapshot,1,true,false).textLayers[0].animation,undefined,'old backends get no style');
  assert.equal(saveRequestBody(snapshot,1,true,true).textLayers[0].boxColor,undefined,'styles need clipStyles, not only clipEffects');
  assert.equal(saveRequestBody(snapshot,1,true,true,false,true).textLayers[0].boxColor,'#000000');
});

test('transitions overlap clips on the timeline',async()=>{
  const {playbackTimeline,playbackWindowAt}=await import('../src/components/ai-editor/media-playback.ts');
  const timeline=playbackTimeline([{id:'a',start:0,end:4,transitionDuration:1},{id:'b',start:0,end:2,transitionDuration:1},{id:'c',start:0,end:3,speed:2,transitionDuration:.5}]);
  // The first clip ignores a stray transition; b starts 1 s early, c 0.5 s early.
  assert.deepEqual(timeline.map(w=>[w.at,w.timelineEnd]),[[0,4],[3,5],[4.5,6]]);
  assert.equal(playbackWindowAt(timeline,3.5).id,'b','the incoming clip drives the main video during a transition');
  assert.equal(playbackWindowAt(timeline,2.9).id,'a');
  assert.equal(playbackWindowAt(timeline,7).id,'c');
});

test('transition preview frames follow xfade directions',async()=>{
  const {transitionFrame,maxTransition}=await import('../src/components/ai-editor/clip-effects.ts');
  assert.deepEqual(transitionFrame('fade',.25),{from:{opacity:.75},to:{}});
  assert.deepEqual(transitionFrame('wipeleft',.5).from,{clipPath:'inset(0 50% 0 0)'});
  assert.deepEqual(transitionFrame('slideleft',.25),{from:{transform:'translateX(-25%)'},to:{transform:'translateX(75%)'}});
  assert.deepEqual(transitionFrame('fadeblack',.25).cover,{color:'#000',opacity:.5});
  assert.deepEqual(transitionFrame('fadeblack',.75),{from:{opacity:0},to:{},cover:{color:'#000',opacity:.5}});
  assert.equal(transitionFrame('circleopen',1).to.clipPath,'circle(70.8% at 50% 50%)');
  assert.deepEqual([maxTransition(10,10),maxTransition(1,3)],[2,.5]);
});

test('fitTransitions keeps transitions valid after edits',async()=>{
  const {fitTransitions}=await import('../src/components/ai-editor/clip-effects.ts');
  const len=s=>s.end-s.start;
  const out=fitTransitions([{id:'a',start:0,end:4,transition:'fade',transitionDuration:1},{id:'b',start:0,end:1,transition:'wipeleft',transitionDuration:1.5},{id:'c',start:0,end:6,transition:'spin',transitionDuration:1},{id:'d',start:0,end:.1,transition:'fade',transitionDuration:.5}],len);
  assert.deepEqual(out.map(s=>[s.transition,s.transitionDuration]),[[undefined,undefined],['wipeleft',.5],[undefined,undefined],[undefined,undefined]]);
  const same=[{id:'a',start:0,end:4},{id:'b',start:0,end:4,transition:'fade',transitionDuration:1}];
  assert.equal(fitTransitions(same,len)[1],same[1],'valid segments are returned unchanged');
});

test('image layers: kind detection, defaults, clamping and save gating',async()=>{
  const {mediaKindOf,newImageLayer,adjustImageLayer,normaliseImageLayers,saveRequestBody}=await import('../src/components/ai-editor/tracks.ts');
  const {splitTimelineItem,trimTimelineItem}=await import('../src/components/ai-editor/timeline-editing.ts');
  assert.equal(mediaKindOf({name:'logo.png',type:'image/png'}),'image');
  assert.equal(mediaKindOf({name:'logo.webp',type:''}),'image');
  assert.equal(mediaKindOf({name:'song.mp3',type:'audio/mpeg'}),'audio');
  const layer=newImageLayer('i','a',9,10);
  assert.deepEqual([layer.start,layer.end,layer.width,layer.opacity],[9,12,.3,1]);
  assert.deepEqual(newImageLayer('i','a',10,10).start,7,'pulled back inside the video');
  const moved=adjustImageLayer(layer,{x:2,width:.001,opacity:0,start:5,end:4});
  assert.deepEqual([moved.x,moved.width,moved.opacity,moved.start,moved.end],[1,.02,.05,5,5.1]);
  assert.deepEqual(normaliseImageLayers([{id:'i',assetId:'a',start:0,end:2,x:5,width:3,opacity:-1}])[0],{id:'i',assetId:'a',start:0,end:2,x:1,y:.5,width:1,opacity:.05});
  assert.deepEqual(trimTimelineItem({id:'i',start:1,end:4},'image','tail',-1,0,10).end,3);
  assert.deepEqual(splitTimelineItem({id:'i',start:1,end:4},'image',2,'j',1,20).map(p=>[p.start,p.end]),[[1,2],[2,4]]);
  const snapshot={title:'t',ratio:'9/16',segments:[],audioClips:[],textLayers:[],imageLayers:[layer]};
  assert.equal('imageLayers' in saveRequestBody(snapshot,1,true,true,false),false,'not sent before migration 028');
  assert.deepEqual(saveRequestBody(snapshot,1,true,true,true).imageLayers,[layer]);
});

test('segment looks and transitions are sent only to clipStyles backends',async()=>{
  const {saveRequestBody}=await import('../src/components/ai-editor/tracks.ts');
  const snapshot={title:'t',ratio:'9/16',segments:[{id:'a',asset:'x',start:0,end:2,volume:1},{id:'b',asset:'x',start:0,end:2,volume:1,speed:2,saturation:-1,fit:'cover',zoom:1,transition:'fade',transitionDuration:.5}],audioClips:[],textLayers:[]};
  assert.deepEqual(saveRequestBody(snapshot,1,true,true,false,false).segments[1],{id:'b',assetId:'x',start:0,end:2,volume:1,speed:2},'an effects-only server keeps speed but never receives looks it would drop');
  assert.deepEqual(saveRequestBody(snapshot,1,true,true,false,true).segments[1],{id:'b',assetId:'x',start:0,end:2,volume:1,speed:2,saturation:-1,fit:'cover',transition:'fade',transitionDuration:.5});
});
