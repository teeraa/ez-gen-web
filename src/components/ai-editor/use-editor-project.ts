"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {EditorApiError, videoEditorApi, type EditorCapabilities, type EditorExport, type EditorMedia, type EditorProject, type EditorProjectSummary, type EditorRatio, type EditorResolution} from "@/lib/video-editor-api";
import type {VideoFrame} from "./video-thumbnails";
import {AUDIO_EXTENSIONS, MAX_IMAGE_LAYERS, TRACK_LIMITS, incomingTracks, normaliseImageLayers, type TrackImageLayer, keepPendingExport, mediaKindOf, normaliseAudioClips, normaliseTextLayers, saveRequestBody, trackProblem, type TrackAudioClip, type TrackTextLayer} from "./tracks";
export type Segment = {id: string; asset: string; start: number; end: number; volume: number; speed?: number; fadeIn?: number; fadeOut?: number; brightness?: number; contrast?: number; saturation?: number; fit?: "cover"; zoom?: number; panX?: number; panY?: number; transition?: string; transitionDuration?: number};
export type AudioClip = TrackAudioClip;
export type TextLayer = TrackTextLayer;
export type ImageLayer = TrackImageLayer;
export type Asset = {id: string; clientUploadId: string; kind: "video" | "audio" | "image"; name: string; duration: number; url?: string; frames: VideoFrame[]; thumbnails: "loading" | "ready" | "error"; status: "ready" | "loading" | "error"; progress?: number; failure?: string; expiresAt?: string | null; hasAudio?: boolean};
const fromMedia = (asset: EditorMedia): Asset => ({id:asset.id,clientUploadId:asset.clientUploadId,kind:asset.kind==="audio"||asset.kind==="image"?asset.kind:"video",name:asset.name,duration:asset.duration,url:asset.previewUrl??undefined,frames:asset.frames??[],thumbnails:asset.status==="ready"?"ready":asset.status==="failed"?"error":"loading",status:asset.status==="ready"?"ready":asset.status==="failed"?"error":"loading",expiresAt:asset.expiresAt,failure:asset.failureMessage,hasAudio:asset.hasAudio});
const message = (error: unknown) => error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่";
const limits = {maxUploadBytes:52428800,maxSegments:20,maxDuration:1200};
export function useEditorProject(onOpen: () => void, initialProjectId?: string) {
  const [assets,setAssets]=useState<Asset[]>([]),[segments,setSegments]=useState<Segment[]>([]),[audioClips,setAudioClips]=useState<AudioClip[]>([]),[textLayers,setTextLayers]=useState<TextLayer[]>([]),[imageLayers,setImageLayers]=useState<ImageLayer[]>([]),[title,setTitle]=useState("โปรเจกต์ไม่มีชื่อ"),[ratio,setRatio]=useState("9/16"),[dirty,setRawDirty]=useState(false);
  const [project,setProject]=useState<EditorProjectSummary|null>(null),[projects,setProjects]=useState<EditorProjectSummary[]>([]),[projectTotal,setProjectTotal]=useState(0),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[conflict,setConflict]=useState(false),[exports,setExports]=useState<EditorExport[]>([]),[exporting,setExporting]=useState(false),[capabilities,setCapabilities]=useState<EditorCapabilities|null>(null),[uploadCount,setUploadCount]=useState(0);
  const alive=useRef(true),projectRef=useRef<EditorProjectSummary|null>(null),draft=useRef({title:"โปรเจกต์ไม่มีชื่อ",ratio:"9/16",segments:[] as Segment[],audioClips:[] as AudioClip[],textLayers:[] as TextLayer[],imageLayers:[] as ImageLayer[]}),epoch=useRef(0),navigation=useRef(0),pendingCreate=useRef<{id:string;promise:Promise<EditorProject>}|null>(null),createIntent=useRef<{id:string;title:string}|null>(null),newRequestId=useRef<string|null>(null),saveLock=useRef(false),exportLock=useRef(false),dirtyRef=useRef(false);
  const pendingFiles=useRef(new Map<string,{file:File;projectId:string}>()),queue=useRef<Array<()=>Promise<void>>>([]),running=useRef(0),controllers=useRef(new Set<AbortController>()),pendingExport=useRef<{projectId:string;requestId:string;revision:number;resolution:EditorResolution}|null>(null);
  useEffect(()=>{draft.current={title,ratio,segments,audioClips,textLayers,imageLayers};},[title,ratio,segments,audioClips,textLayers,imageLayers]);
  // Older backends omit the track capabilities; never send fields they may reject.
  const tracksSupported=typeof capabilities?.maxAudioClips==="number"||typeof capabilities?.maxTextLayers==="number";
  const tracksSupportedRef=useRef(false);useEffect(()=>{tracksSupportedRef.current=tracksSupported;},[tracksSupported]);
  // Image layers need migration 028 on the server; until then the field is never sent.
  const imagesSupported=capabilities?.imageLayers===true;
  const imagesSupportedRef=useRef(false);useEffect(()=>{imagesSupportedRef.current=imagesSupported;},[imagesSupported]);
  const audioFormats=capabilities?.audioFormats?.length?capabilities.audioFormats.map(value=>value.toLowerCase()):AUDIO_EXTENSIONS;
  // A local edit invalidates the saved revision a stored export request was bound to.
  const setDirty=useCallback((value:boolean)=>{if(value){epoch.current++;pendingExport.current=null;}dirtyRef.current=value;setRawDirty(value);},[]);
  const updateSummary=useCallback((item:EditorProjectSummary)=>{setProjects(previous=>[item,...previous.filter(value=>value.id!==item.id)]);},[]);
  const apply=useCallback((item:EditorProject)=>{
    // Same project on a track-capable backend: a response that omits a track field must not wipe local tracks.
    const keepTracks=projectRef.current?.id===item.id&&tracksSupportedRef.current;
    onOpen();projectRef.current=item;setProject(item);setTitle(item.title);setRatio(item.aspectRatio.replace(":","/"));setSegments((item.segments??[]).map(segment=>({...segment,asset:segment.assetId})));setAudioClips(incomingTracks(item.audioClips,draft.current.audioClips,keepTracks,normaliseAudioClips));setTextLayers(incomingTracks(item.textLayers,draft.current.textLayers,keepTracks,normaliseTextLayers));setImageLayers(incomingTracks(item.imageLayers,draft.current.imageLayers,keepTracks&&imagesSupportedRef.current,normaliseImageLayers));setAssets((item.assets??[]).map(fromMedia));setDirty(false);setConflict(false);setError("");epoch.current++;pendingExport.current=null;updateSummary(item);
    const url=new URL(window.location.href);url.searchParams.set("project",item.id);window.history.replaceState(null,"",url);
  },[onOpen,setDirty,updateSummary]);
  const refreshAssets=useCallback(async(id:string,signal?:AbortSignal)=>{
    const result=await videoEditorApi.assets(id,signal);if(!alive.current||projectRef.current?.id!==id)return result.items;
    for(const asset of result.items??[])if(asset.status==="ready")pendingFiles.current.delete(asset.clientUploadId);
    setAssets(previous=>{const fresh=(result.items??[]).map(fromMedia);return [...fresh,...previous.filter(asset=>pendingFiles.current.has(asset.clientUploadId)&&!fresh.some(item=>item.clientUploadId===asset.clientUploadId))];});
    return result.items;
  },[]);
  const refreshExports=useCallback(async(id:string,signal?:AbortSignal)=>{const result=await videoEditorApi.exports(id,signal);if(alive.current&&projectRef.current?.id===id)setExports(result.items??[]);},[]);
  const load=useCallback(async(id:string,force=false)=>{
    if(uploadCount>0){setError("รออัปโหลดให้เสร็จก่อนเปลี่ยนโปรเจกต์");return;}
    if(!force&&dirtyRef.current&&!window.confirm("มีการแก้ไขที่ยังไม่บันทึก ต้องการออกจากฉบับนี้หรือไม่?"))return;
    const ticket=++navigation.current;setLoading(true);setError("");
    try{const item=await videoEditorApi.project(id);if(!alive.current||ticket!==navigation.current)return;apply(item);setExports([]);await refreshExports(id);}catch(error){if(alive.current&&ticket===navigation.current)setError(message(error));}finally{if(alive.current&&ticket===navigation.current)setLoading(false);}
  },[apply,refreshExports,uploadCount]);
  useEffect(()=>{
    alive.current=true;const controller=new AbortController(),activeControllers=controllers.current,files=pendingFiles.current;activeControllers.add(controller);
    void(async()=>{try{const [caps,list]=await Promise.all([videoEditorApi.capabilities(controller.signal),videoEditorApi.projects(1,controller.signal)]);if(controller.signal.aborted)return;setCapabilities(caps);setProjects(list.items??[]);setProjectTotal(list.total);const id=initialProjectId||new URL(window.location.href).searchParams.get("project")||list.items?.[0]?.id;
      if(id){const item=await videoEditorApi.project(id,controller.signal);if(controller.signal.aborted)return;apply(item);await refreshExports(id,controller.signal);}
    }catch(error){if(!controller.signal.aborted)setError(message(error));}finally{controllers.current.delete(controller);if(!controller.signal.aborted)setLoading(false);}})();
    return()=>{alive.current=false;queue.current=[];activeControllers.forEach(value=>value.abort());activeControllers.clear();files.clear();};
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the entry id is read once on mount; later navigation goes through load().
  },[apply,refreshExports]);
  useEffect(()=>{const before=(event:BeforeUnloadEvent)=>{if(dirty||uploadCount>0){event.preventDefault();event.returnValue="";}};window.addEventListener("beforeunload",before);return()=>window.removeEventListener("beforeunload",before);},[dirty,uploadCount]);
  const projectId = project?.id;
  const pollFast = assets.some(asset => asset.status === "loading") || exports.some(item => ["queued", "processing"].includes(item.status));
  const pollFastRef = useRef(false);
  useEffect(() => { pollFastRef.current = pollFast; }, [pollFast]);
  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    let inFlight = false;
    let completedAt = Date.now();
    const tick = async (force = false) => {
      if (controller.signal.aborted || inFlight || (!force && !pollFastRef.current && Date.now() - completedAt < 60000)) return;
      inFlight = true;
      const results = await Promise.allSettled([refreshExports(projectId, controller.signal), refreshAssets(projectId, controller.signal)]);
      if (!controller.signal.aborted && alive.current) {
        const failed = results.find(result => result.status === "rejected");
        if (failed?.status === "rejected") setError(message(failed.reason));
      }
      completedAt = Date.now();
      inFlight = false;
    };
    // The project lifetime owns cancellation; one refreshed list must not abort its sibling request.
    const interval = setInterval(() => { void tick(); }, 3000);
    const focus = () => { void tick(true); };
    window.addEventListener("focus", focus);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener("focus", focus); };
  }, [projectId, refreshAssets, refreshExports]);
  async function ensureProject() {
    if(projectRef.current)return projectRef.current;
    if(!pendingCreate.current){const intent=createIntent.current??{id:crypto.randomUUID(),title:draft.current.title.trim()||"โปรเจกต์ไม่มีชื่อ"};createIntent.current=intent;pendingCreate.current={id:intent.id,promise:videoEditorApi.create(intent.id,intent.title)};}
    try{const item=await pendingCreate.current.promise;if(!alive.current)throw new DOMException("Cancelled","AbortError");projectRef.current=item;setProject(item);updateSummary(item);const url=new URL(window.location.href);url.searchParams.set("project",item.id);window.history.replaceState(null,"",url);createIntent.current=null;return item;}finally{pendingCreate.current=null;}
  }
  async function newProject(){if(loading||saving||uploadCount)return;if(dirtyRef.current&&!window.confirm("มีการแก้ไขที่ยังไม่บันทึก ต้องการสร้างโปรเจกต์ใหม่หรือไม่?"))return;setLoading(true);try{const requestId=newRequestId.current??crypto.randomUUID();newRequestId.current=requestId;const item=await videoEditorApi.create(requestId,"โปรเจกต์ไม่มีชื่อ");newRequestId.current=null;if(alive.current){apply(item);setExports([]);setProjectTotal(value=>value+1);}}catch(error){if(alive.current)setError(message(error));}finally{if(alive.current)setLoading(false);}}
  async function moreProjects(){try{const list=await videoEditorApi.projects(Math.floor(projects.length/20)+1);if(alive.current){setProjects(previous=>[...previous,...list.items.filter(item=>!previous.some(value=>value.id===item.id))]);setProjectTotal(list.total);}}catch(error){setError(message(error));}}
  async function save(){
    if(saveLock.current)throw new Error("กำลังบันทึก กรุณารอสักครู่");saveLock.current=true;setSaving(true);setError("");
    try{if(conflict)throw new Error("โปรเจกต์มีฉบับใหม่ กรุณาเก็บฉบับในเครื่องแล้วโหลดฉบับล่าสุด");const item=await ensureProject(),snapshot=draft.current,version=epoch.current;if(!snapshot.title.trim())throw new Error("กรุณาตั้งชื่อโปรเจกต์");const problem=trackProblem(snapshot.audioClips,snapshot.textLayers,capabilities?.maxAudioClips??TRACK_LIMITS.maxAudioClips,capabilities?.maxTextLayers??TRACK_LIMITS.maxTextLayers);if(problem)throw new Error(problem);if(!tracksSupported&&(snapshot.audioClips.length||snapshot.textLayers.length))throw new Error("ระบบยังไม่รองรับการบันทึกเสียงและข้อความ");
      const body=saveRequestBody(snapshot,item.revision,tracksSupported,capabilities?.clipEffects===true,imagesSupported,capabilities?.clipStyles===true);const result=await videoEditorApi.save(item.id,{...body,aspectRatio:body.aspectRatio as EditorRatio});
      if(alive.current&&projectRef.current?.id===item.id){projectRef.current=result;setProject(result);updateSummary(result);if(version===epoch.current)setDirty(false);}return{project:result,unchanged:version===epoch.current};
    }catch(error){if(alive.current){if(error instanceof EditorApiError&&error.code==="REVISION_CONFLICT")setConflict(true);setError(message(error));}throw error;}finally{saveLock.current=false;if(alive.current)setSaving(false);}
  }
  async function runUpload(clientId:string){const entry=pendingFiles.current.get(clientId);if(!entry||!alive.current)return;const controller=new AbortController();controllers.current.add(controller);
    const patch=(change:Partial<Asset>)=>{if(alive.current&&projectRef.current?.id===entry.projectId)setAssets(previous=>previous.map(asset=>asset.clientUploadId===clientId?{...asset,...change}:asset));};patch({status:"loading",failure:undefined,progress:0});
    try{const result=await videoEditorApi.upload(entry.projectId,clientId,entry.file,progress=>patch({progress}),controller.signal);if(!controller.signal.aborted&&projectRef.current?.id===entry.projectId){setAssets(previous=>previous.map(asset=>asset.clientUploadId===clientId?fromMedia(result):asset));if(result.status==="ready")pendingFiles.current.delete(clientId);}}
    catch(error){if(!controller.signal.aborted){let found:EditorMedia|undefined;try{const fresh=await refreshAssets(entry.projectId,controller.signal);found=fresh?.find(asset=>asset.clientUploadId===clientId);}catch{}if(found?.status!=="ready"&&found?.status!=="processing")patch({status:"error",failure:message(error),progress:undefined});}}
    finally{controllers.current.delete(controller);if(alive.current)setUploadCount(value=>Math.max(0,value-1));}
  }
  function drain(){while(running.current<2&&queue.current.length){const next=queue.current.shift();if(!next)break;running.current++;void next().finally(()=>{running.current--;if(alive.current)drain();});}}
  async function importFiles(files:FileList|File[],expected:"video"|"audio"|"image"="video"){if(loading||saving)return;setError("");try{if(assets.length+files.length>100)throw new Error("แต่ละโปรเจกต์เก็บสื่อได้สูงสุด 100 ไฟล์");const accepted=Array.from(files);if(expected==="audio"&&!tracksSupported)throw new Error("ระบบยังไม่รองรับไฟล์เสียง กรุณาลองใหม่ภายหลัง");if(expected==="image"&&!imagesSupported)throw new Error("ระบบยังไม่รองรับรูปภาพ (ต้องอัปเดตฐานข้อมูล migration 028)");for(const file of accepted)if(!file.size||file.size>(capabilities?.maxUploadBytes??limits.maxUploadBytes)||mediaKindOf(file,audioFormats)!==expected)throw new Error(expected==="image"?`ไฟล์ ${file.name} ต้องเป็นรูป PNG, JPG หรือ WebP ขนาดไม่เกิน 50 MB`:expected==="audio"?`ไฟล์ ${file.name} ต้องเป็นเสียง ${audioFormats.map(value=>value.toUpperCase()).join(", ")} ขนาดไม่เกิน 50 MB`:`ไฟล์ ${file.name} ต้องเป็นวิดีโอ MP4, MOV หรือ WebM ขนาดไม่เกิน 50 MB`);const item=await ensureProject();for(const file of accepted){const clientUploadId=crypto.randomUUID();pendingFiles.current.set(clientUploadId,{file,projectId:item.id});setAssets(previous=>[...previous,{id:clientUploadId,clientUploadId,kind:expected,name:file.name,duration:0,frames:[],thumbnails:"loading",status:"loading",progress:0}]);setUploadCount(value=>value+1);queue.current.push(()=>runUpload(clientUploadId));}drain();}catch(error){if(alive.current)setError(message(error));}}
  function retryUpload(asset:Asset){if(!pendingFiles.current.has(asset.clientUploadId)){setError("กรุณาเลือกไฟล์ต้นฉบับอีกครั้งเพื่ออัปโหลดใหม่");return;}setUploadCount(value=>value+1);queue.current.push(()=>runUpload(asset.clientUploadId));drain();}
  async function startExport(resolution:EditorResolution){if(exportLock.current)return;exportLock.current=true;setExporting(true);setError("");try{
    let intent=pendingExport.current;if(!intent){const saved=await save();if(!saved.unchanged)throw new Error("มีการแก้ไขระหว่างบันทึก กรุณากดส่งออกอีกครั้ง");intent={projectId:saved.project.id,requestId:crypto.randomUUID(),revision:saved.project.revision,resolution};pendingExport.current=intent;}
    const result=await videoEditorApi.export(intent.projectId,intent.requestId,intent.revision,intent.resolution);pendingExport.current=null;if(alive.current&&projectRef.current?.id===intent.projectId)setExports(previous=>[result,...previous.filter(item=>item.id!==result.id)]);
  }catch(error){if(!keepPendingExport(error))pendingExport.current=null;if(alive.current){setError(message(error));if(error instanceof EditorApiError&&error.code==="REVISION_CONFLICT")setConflict(true);if(error instanceof EditorApiError&&error.code==="MEDIA_UNAVAILABLE")void videoEditorApi.capabilities().then(caps=>{if(alive.current)setCapabilities(caps);},()=>{});}}finally{exportLock.current=false;if(alive.current)setExporting(false);}}
  async function retryExport(id:string){try{const item=await videoEditorApi.retry(id);if(alive.current)setExports(previous=>previous.map(value=>value.id===id?item:value));}catch(error){setError(message(error));}}
  async function download(id:string){try{const result=await videoEditorApi.download(id);const url=new URL(result.downloadUrl);if(!["https:","http:"].includes(url.protocol))throw new Error("ลิงก์ดาวน์โหลดไม่ถูกต้อง");const anchor=document.createElement("a");anchor.href=url.href;anchor.download=result.filename;anchor.rel="noopener";document.body.append(anchor);anchor.click();anchor.remove();}catch(error){setError(message(error));}}
  function recover(){const blob=new Blob([JSON.stringify({projectId:project?.id,revision:project?.revision,...draft.current},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download="timeline-recovery.json";anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const snapshot = useCallback(() => ({project: projectRef.current, dirty: dirtyRef.current, epoch: epoch.current, segments: draft.current.segments, audioClips: draft.current.audioClips, textLayers: draft.current.textLayers, imageLayers: draft.current.imageLayers}), []);
  const acceptAiProject = useCallback((item: EditorProject, expectedEpoch: number, expectedRevision: number) => {
    const current = projectRef.current;
    if (!current || current.id !== item.id || !alive.current) return false;
    if (dirtyRef.current || epoch.current !== expectedEpoch || current.revision !== expectedRevision) {
      setConflict(true);setError("แผน AI ถูกบันทึกแล้ว แต่มีการแก้ไขในเครื่อง กรุณาเก็บฉบับในเครื่องก่อนโหลดฉบับล่าสุด");return false;
    }
    if (item.revision < current.revision) {setError("โปรเจกต์มีฉบับใหม่กว่าแผนนี้ กรุณาโหลดฉบับล่าสุด");return false;}
    if (item.revision === current.revision) return true;
    apply(item);return true;
  }, [apply]);
  const flagAiConflict = useCallback((message: string) => {setConflict(true);setError(message);}, []);
  return {clipStyles:capabilities?.clipStyles===true,imagesSupported,imageLayers,setImageLayers,maxImageLayers:capabilities?.maxImageLayers??MAX_IMAGE_LAYERS,clipEffects:capabilities?.clipEffects===true,assets,segments,setSegments,audioClips,setAudioClips,textLayers,setTextLayers,tracksSupported,textOverlays:capabilities?.textOverlays,audioFormats,maxAudioClips:capabilities?.maxAudioClips??TRACK_LIMITS.maxAudioClips,maxTextLayers:capabilities?.maxTextLayers??TRACK_LIMITS.maxTextLayers,title,setTitle,ratio,setRatio,dirty,setDirty,project,projects,projectTotal,loading,saving,error,setError,conflict,exports,exporting,capabilities,uploadCount,load,newProject,moreProjects,save,importFiles,retryUpload,startExport,retryExport,download,recover,snapshot,acceptAiProject,flagAiConflict,maxSegments:capabilities?.maxSegments??limits.maxSegments,maxDuration:capabilities?.maxDuration??limits.maxDuration};
}
