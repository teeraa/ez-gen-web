"use client";
import {useEffect, useMemo, useRef, useState} from "react";
import {Pause, Play, SkipBack} from "lucide-react";
import type {AiDraft} from "@/lib/video-editor-ai-api";
import type {Asset, AudioClip, TextLayer} from "./use-editor-project";
import {playbackTimeline, playbackWindowAt, connectMediaPlayback} from "./media-playback";
import {previewCompositionTracks} from "./ai-composition";
import {TextOverlay} from "./text-overlay";
import {useAudioPreview} from "./use-audio-preview";
import styles from "./ai-editor.module.css";
const nothing = () => {};

export function DraftCompositionPreview({draft,assets,ratio,manualAudio,manualText,onPlay}: {draft: AiDraft; assets: Asset[]; ratio: string; manualAudio: AudioClip[]; manualText: TextLayer[]; onPlay?:()=>void}) {
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[seek,setSeek]=useState(0),[error,setError]=useState("");
  const [size,setSize]=useState({width:0,height:0});
  const video=useRef<HTMLVideoElement>(null),frame=useRef<HTMLDivElement>(null),position=useRef(0);
  const timeline=useMemo(()=>playbackTimeline(draft.segments),[draft.segments]);
  const total=timeline.at(-1)?.timelineEnd??0,current=playbackWindowAt(timeline,time),asset=assets.find(asset=>asset.id===current?.assetId);
  const audio=useMemo(()=>previewCompositionTracks(manualAudio,draft.audioClips).map(item=>({...item,url:assets.find(asset=>asset.id===item.assetId)?.url})),[manualAudio,draft.audioClips,assets]);
  const texts=previewCompositionTracks(manualText,draft.textLayers);
  const currentId=current?.id,start=current?.start??0,end=current?.end??0,at=current?.at??0,until=current?.timelineEnd??0,volume=current?.volume??1,url=asset?.url;
  useEffect(()=>{position.current=time;},[time]);
  useEffect(()=>{const element=frame.current;if(!element)return;const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(element);return()=>observer.disconnect();},[]);
  useEffect(()=>{const element=video.current;if(!element||!url)return;element.volume=volume;return connectMediaPlayback(element,{start,end,at,timelineEnd:until},position.current,playing,true,value=>{position.current=value;setTime(value);},()=>{if(until>=total)setPlaying(false);},()=>{setPlaying(false);setError("เล่นฉบับร่างไม่ได้ กรุณาตรวจไฟล์สื่อแล้วลองอีกครั้ง");});},[currentId,url,start,end,at,until,volume,playing,seek,total]);
  useAudioPreview(audio,playing,time,seek,total,()=>setError("เบราว์เซอร์ยังเล่นเสียงประกอบไม่ได้ กดเล่นอีกครั้งหรือตรวจไฟล์เสียง"));
  function seekTo(value:number){position.current=value;setTime(value);setSeek(previous=>previous+1);}
  return <section className={styles.compositionPreview} aria-label="พรีวิวฉบับตัดต่อ AI">
    <b>ชมฉบับร่างพร้อมข้อความและเสียง</b>
    <div ref={frame} className={styles.compositionFrame} style={{aspectRatio:ratio,width:ratio==="9/16"?"min(100%, 180px)":ratio==="1/1"?"min(100%, 320px)":"100%"}}>
      {url?<video key={currentId} ref={video} src={url} playsInline preload="auto" aria-label="วิดีโอฉบับร่าง AI" />:<p>ไม่พบไฟล์สำหรับพรีวิว</p>}
      {texts.filter(item=>time>=item.start&&time<Math.min(item.end,total)).map(item=><TextOverlay key={item.id} layer={item} frame={size} selected={false} disabled resizable={false} time={time} onSelect={nothing} onCommit={nothing}/>)}
    </div>
    <div className={styles.chips}><button aria-label="กลับต้นฉบับร่าง" onClick={()=>{setPlaying(false);seekTo(0);}}><SkipBack/></button><button aria-label={playing?"หยุดฉบับร่าง":"เล่นฉบับร่าง"} disabled={!total||!url} onClick={()=>{if(!playing)onPlay?.();setError("");if(time>=total)seekTo(0);setPlaying(value=>!value);}}>{playing?<Pause/>:<Play/>}{playing?"หยุด":"เล่นฉบับร่าง"}</button><span>{time.toFixed(1)} / {total.toFixed(1)} วินาที</span></div>
    <input aria-label="ตำแหน่งฉบับร่าง AI" type="range" min={0} max={total} step={.1} value={time} onChange={event=>seekTo(Number(event.target.value))}/>
    {error&&<p role="alert" className={styles.aiError}>{error}</p>}
    <small className={styles.footnote}>พรีวิวนี้ยังไม่เปลี่ยน timeline เดิม · เสียงต้นฉบับตามระดับเสียงของแต่ละฉาก</small>
  </section>;
}
