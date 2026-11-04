"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, Fragment, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Blend, ChevronLeft, ImageIcon, CloudCheck, Crop, Download, Film, Gauge, Layers, Magnet, Music, Palette, RotateCcw, Pause, Play, Plus, Redo2, Scan, Scissors, Search, SkipBack, SkipForward, SlidersHorizontal, Sparkles, Trash2, Type, Undo2, Upload, Volume2, VolumeX, X, ZoomIn, ZoomOut } from "lucide-react";
import styles from "./ai-editor.module.css";
import { connectMediaPlayback, playbackTimeline, playbackWindowAt, segmentLength, segmentSpeed } from "./media-playback";
import { canSplitTimelineItem, splitTimelineItem, type TrimItem, type TrimKind } from "./timeline-editing";
import { TimelineTrimHandles } from "./timeline-trim-handles";
import { manualTimelineRange } from "./manual-timeline";
import { frameAt } from "./video-thumbnails";
import { useEditorProject, type Asset, type AudioClip, type ImageLayer, type Segment, type TextLayer } from "./use-editor-project";
import type { EditorProject, EditorResolution } from "@/lib/video-editor-api";
import { AiAssistantPanel, type EditorTranscripts } from "./ai-assistant-panel";
import { TRACK_LIMITS, adjustAudioClip, adjustImageLayer, adjustTextLayer, audioClipRange, newImageLayer, newTextLayer, styleTextLayer, type TrackTextLayer, type TrackTextStyle } from "./tracks";
import { TextOverlay } from "./text-overlay";
import { buildSubtitleLayers, hasUsableTranscript, isSubtitleId } from "./subtitles";
import { useAudioPreview } from "./use-audio-preview";
import { AudioAdjust, AudioTab, FadeFields, NumberField, TextAdjust, TextTab, type TextPreset } from "./track-panels";
import { LOOK_PRESETS, MIN_TRANSITION, SPEED_PRESETS, TRANSITIONS, clampFades, fitTransitions, maxTransition, transitionFrame, clampSpeed, fadeGain, frameRect, hasColour, hasFrame, lookColour, patchLook, snapShift, type ClipLook } from "./clip-effects";
import { AUDIO_ASSET_MIME, IMAGE_ASSET_MIME, VIDEO_ASSET_MIME, packLanes } from "./lanes";
import { ImageAdjust, ImageOverlay, ImageTab } from "./image-layers";

const fmt = (time: number) => `${Math.floor(Math.max(0, time) / 60)}:${(Math.max(0, time) % 60).toFixed(1).padStart(4, "0")}`;
const durationOf = (segments: Segment[]) => playbackTimeline(segments).at(-1)?.timelineEnd ?? 0;
const SNAP_PX = 8;
const speedLabel = (speed: number) => `${Number(speed.toFixed(2))}×`;
/** Fades must fit their item after any trim, split or speed change: keep the fade-in, shrink the fade-out. */
function fitFades<T extends { fadeIn?: number; fadeOut?: number }>(item: T, length: number): T {
  const fadeIn = item.fadeIn ?? 0, fadeOut = item.fadeOut ?? 0;
  if (fadeIn + fadeOut <= length + 1e-6) return item;
  const fitted = clampFades({ fadeIn, fadeOut }, length, "fadeIn");
  return { ...item, fadeIn: fitted.fadeIn || undefined, fadeOut: fitted.fadeOut || undefined };
}
type EditorState = { segments: Segment[]; audioClips: AudioClip[]; textLayers: TextLayer[]; imageLayers: ImageLayer[] };
type LibraryTab = "media" | "audio" | "text" | "image" | "ai";
const LIBRARY_TABS: { value: LibraryTab; label: string; title: string; icon: typeof Film }[] = [
  { value: "media", label: "วิดีโอ", title: "คลังวิดีโอ", icon: Film },
  { value: "audio", label: "เสียง", title: "เพลงและเสียง", icon: Music },
  { value: "text", label: "ข้อความ", title: "ข้อความ", icon: Type },
  { value: "image", label: "รูปภาพ", title: "รูปภาพและสติกเกอร์", icon: ImageIcon },
  { value: "ai", label: "AI", title: "ผู้ช่วย AI", icon: Sparkles },
];
const RATIO_OPTIONS = [{ value: "9/16", label: "9:16", hint: "แนวตั้ง" }, { value: "16/9", label: "16:9", hint: "แนวนอน" }, { value: "1/1", label: "1:1", hint: "สี่เหลี่ยม" }];
// Below this width the library and inspector become drawers over the editor.
const isNarrow = () => window.matchMedia("(max-width: 1100px)").matches;
type TrackDrag = { id: string; kind: "audio" | "text" | "image"; origin: number; startX: number; pointer: number; moved: boolean; value: number };

export function AiEditor({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [history, setHistory] = useState<EditorState[]>([]);
  const [future, setFuture] = useState<EditorState[]>([]);
  const [historyProject, setHistoryProject] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [resolution, setResolution] = useState<EditorResolution>("720p");
  const [time, setPlaybackTime] = useState(0);
  const [seekRevision, setSeekRevision] = useState(0);
  const setTime = useCallback((value: React.SetStateAction<number>) => { setPlaybackTime(value); setSeekRevision(revision => revision + 1); }, []);
  const [playing, setPlaying] = useState(false);
  const [, setScrubbing] = useState(false);
  const [safeArea, setSafeArea] = useState(false);
  const [zoom, setZoom] = useState(22);
  const [timelineHeight, setTimelineHeight] = useState(270);
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<"library" | "inspector" | null>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("media");
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [layerMenu, setLayerMenu] = useState(false);
  const [dropLane, setDropLane] = useState<"video" | "audio" | "image" | null>(null);
  const [snapping, setSnapping] = useState(true);
  // Ripple: deleting a video clip pulls later audio/text left with the picture, like a magnetic main track.
  const [ripple, setRipple] = useState(true);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [snapGuide, setSnapGuide] = useState<number | null>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const outgoingRef = useRef<HTMLVideoElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  // Per-frame preview work (fades, transitions) runs from the decoder clock; the latest closure lives here.
  const frameWork = useRef<(value: number) => void>(() => {});
  const layerMenuRef = useRef<HTMLDivElement>(null);
  const [transcripts, setTranscripts] = useState<EditorTranscripts | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [trimEpoch, setTrimEpoch] = useState(0);
  const [trimDraft, setTrimDraft] = useState<{ kind: TrimKind; id: string; value: TrimItem } | null>(null);
  const [trackDrag, setTrackDrag] = useState<{ id: string; value: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const trackDragRef = useRef<TrackDrag | null>(null);
  const coalesce = useRef<{ key: string; at: number } | null>(null);
  const dragClick = useRef(false);
  const [toast, setToast] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const playbackPosition = useRef({ time: 0, seekRevision: 0 });
  const playbackIdentity = useRef("");
  const lanesRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<{ pointer: number; cleanup: () => void } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const cleanups = useRef<Set<() => void>>(new Set());
  const resetEditor = useCallback(() => { setTrimEpoch(value => value + 1); setTrimDraft(null); setHistory([]); setFuture([]); setHistoryProject(null); setSelected(null); setTime(0); setPlaying(false); setScrubbing(false); }, [setTime]);
  const persistence = useEditorProject(resetEditor, projectId);
  const { assets, segments, setSegments, audioClips, setAudioClips, textLayers, setTextLayers, imageLayers, setImageLayers, maxImageLayers, title, setTitle, dirty, setDirty, ratio, setRatio, project, loading, saving, uploadCount, maxSegments, maxDuration, maxAudioClips, maxTextLayers } = persistence;
  const timeline = useMemo(() => playbackTimeline(segments), [segments]);
  const total = timeline.at(-1)?.timelineEnd ?? 0;
  const current = playbackWindowAt(timeline, time);
  const currentAsset = assets.find(asset => asset.id === current?.asset);
  const selectedSegment = segments.find(segment => segment.id === selected);
  const selectedAsset = assets.find(asset => asset.id === selectedSegment?.asset);
  const selectedAudio = audioClips.find(clip => clip.id === selected);
  const selectedText = textLayers.find(layer => layer.id === selected);
  const selectedImage = imageLayers.find(layer => layer.id === selected);
  const videoAssets = useMemo(() => assets.filter(asset => asset.kind === "video"), [assets]);
  const audioAssets = useMemo(() => assets.filter(asset => asset.kind === "audio"), [assets]);
  const imageAssets = useMemo(() => assets.filter(asset => asset.kind === "image"), [assets]);
  const notify = useCallback((message: string) => setToast(message), []);
  function adoptAiProject(item: EditorProject, expectedEpoch: number, expectedRevision: number) {
    const before = persistence.snapshot();
    const accepted = persistence.acceptAiProject(item, expectedEpoch, expectedRevision);
    if (accepted && before.project && before.project.revision < item.revision) {
      setHistory([{ segments: before.segments, audioClips: before.audioClips, textLayers: before.textLayers, imageLayers: before.imageLayers }]);setFuture([]);setHistoryProject(item.id);notify("นำแผนไปใช้กับ timeline แล้ว");
    }
    return accepted;
  }

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 3000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => () => { cleanups.current.forEach(cleanup => cleanup()); }, []);
  useEffect(() => { playbackPosition.current = { time, seekRevision }; }, [time, seekRevision]);
  const currentId = current?.id;
  const currentStart = current?.start ?? 0;
  const currentEnd = current?.end ?? 0;
  const currentAt = current?.at ?? 0;
  const currentTimelineEnd = current?.timelineEnd ?? 0;
  const currentVolume = current?.volume ?? 1;
  const currentSpeed = current ? segmentSpeed(current) : 1;
  const currentFadeIn = current?.fadeIn ?? 0;
  const currentFadeOut = current?.fadeOut ?? 0;
  const currentUrl = currentAsset?.url;
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentId || !currentUrl) { playbackIdentity.current = ""; return; }
    const identity = `${currentId}:${currentUrl}:${currentStart}:${currentEnd}:${currentAt}:${currentSpeed}:${seekRevision}`;
    const seek = playbackIdentity.current !== identity;
    playbackIdentity.current = identity;
    let lastClockUpdate = 0;
    return connectMediaPlayback(video, { start: currentStart, end: currentEnd, at: currentAt, timelineEnd: currentTimelineEnd, speed: currentSpeed }, playbackPosition.current.time, playing, seek,
      value => {
        playbackPosition.current.time = value;
        // Fades and transitions run on the decoder clock like the playhead, so they stay smooth between 10 Hz renders.
        frameWork.current(value);
        if (playheadRef.current) playheadRef.current.style.left = `${value * zoom}px`;
        const now = performance.now();
        // Keep decoder-paced motion outside the expensive editor tree.
        if (!playing || value >= currentTimelineEnd || now - lastClockUpdate >= 100) {
          lastClockUpdate = now;
          setPlaybackTime(value);
        }
      },
      () => { if (currentTimelineEnd >= total) setPlaying(false); },
      () => { setPlaying(false); notify("เล่นคลิปไม่ได้ กรุณาลองอีกครั้งหรือตรวจสอบไฟล์สื่อ"); });
  }, [currentId, currentUrl, currentStart, currentEnd, currentAt, currentTimelineEnd, currentSpeed, currentFadeIn, currentFadeOut, currentVolume, playing, seekRevision, total, notify, zoom]);
  const previewGain = fadeGain(time - currentAt, currentTimelineEnd - currentAt, { fadeIn: currentFadeIn, fadeOut: currentFadeOut });
  // The clip blending out of the current one (or about to, within 2 s) plays in a second video above it.
  const currentIndex = timeline.findIndex(item => item.id === currentId);
  const nextWindow = timeline[currentIndex + 1];
  const blend = current?.transition && currentIndex > 0 && time < current.at + (current.transitionDuration ?? 0) ? { from: timeline[currentIndex - 1], to: current, active: true }
    : nextWindow?.transition && time >= nextWindow.at - 2 && current ? { from: current, to: nextWindow, active: false } : undefined;
  const blendAsset = blend ? assets.find(asset => asset.id === blend.from.asset) : undefined;
  useEffect(() => {
    frameWork.current = value => {
      const main = videoRef.current, outgoing = outgoingRef.current, cover = coverRef.current;
      const gain = fadeGain(value - currentAt, currentTimelineEnd - currentAt, { fadeIn: currentFadeIn, fadeOut: currentFadeOut });
      if (fadeRef.current) fadeRef.current.style.opacity = String(1 - gain);
      const active = blend?.active && value < blend.to.at + (blend.to.transitionDuration ?? 0);
      const progress = active && blend ? (value - blend.to.at) / (blend.to.transitionDuration ?? 1) : 1;
      const frame = active && blend?.to.transition ? transitionFrame(blend.to.transition, progress) : undefined;
      if (main) {
        main.volume = Math.max(0, Math.min(1, currentVolume * gain * (active ? progress : 1)));
        main.style.transform = frame?.to.transform ?? ""; main.style.clipPath = frame?.to.clipPath ?? ""; main.style.zIndex = frame?.to.zIndex ? String(frame.to.zIndex) : "";
      }
      if (cover) { cover.style.opacity = String(frame?.cover?.opacity ?? 0); cover.style.background = frame?.cover?.color ?? "transparent"; }
      if (outgoing && blend) {
        const expected = blend.from.start + (value - blend.from.at) * segmentSpeed(blend.from);
        if (outgoing.readyState >= 1 && Math.abs(outgoing.currentTime - expected) > .3) outgoing.currentTime = Math.max(blend.from.start, Math.min(blend.from.end, expected));
        if (outgoing.playbackRate !== segmentSpeed(blend.from)) outgoing.playbackRate = segmentSpeed(blend.from);
        if (playing && outgoing.paused) void outgoing.play().catch(() => {});
        if (!playing && !outgoing.paused) outgoing.pause();
        outgoing.volume = active ? Math.max(0, Math.min(1, blend.from.volume * (1 - progress))) : 0;
        outgoing.style.visibility = active ? "visible" : "hidden";
        outgoing.style.opacity = frame?.from.opacity === undefined ? "" : String(frame.from.opacity);
        outgoing.style.transform = frame?.from.transform ?? ""; outgoing.style.clipPath = frame?.from.clipPath ?? ""; outgoing.style.zIndex = String(frame?.from.zIndex ?? 1);
      }
    };
    frameWork.current(playbackPosition.current.time);
  });
  const previewAudio = useMemo(() => audioClips.map(clip => ({ ...clip, url: assets.find(asset => asset.id === clip.assetId && asset.status === "ready")?.url })), [audioClips, assets]);
  const audioBlocked = useCallback(() => notify("เบราว์เซอร์ไม่ยอมเล่นเสียงประกอบ กดเล่นอีกครั้ง หรือตรวจไฟล์เสียง"), [notify]);
  useAudioPreview(previewAudio, playing, time, seekRevision, total, audioBlocked);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setFrameSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const activeText = textLayers.filter(layer => total > 0 && time >= layer.start && time < Math.min(layer.end, total));

  const historyIsCurrent = historyProject === (project?.id ?? null);
  // One history entry covers all three tracks; `key` coalesces rapid edits of one field (typing, sliders).
  const commitState = useCallback((patch: Partial<EditorState>, key?: string) => {
    if (loading || saving) return false;
    const merged: EditorState = { segments, audioClips, textLayers, imageLayers, ...patch };
    const next: EditorState = { ...merged, segments: fitTransitions(merged.segments.map(item => fitFades(item, segmentLength(item))), segmentLength), audioClips: merged.audioClips.map(item => fitFades(item, item.end - item.start)) };
    if (next.segments.length > maxSegments || durationOf(next.segments) > maxDuration) { notify(`รองรับสูงสุด ${maxSegments} ช่วงคลิป ความยาวรวมไม่เกิน ${maxDuration / 60} นาที`); return false; }
    if (next.audioClips.length > maxAudioClips) { notify(`ใส่เสียงได้สูงสุด ${maxAudioClips} คลิป`); return false; }
    if (next.textLayers.length > maxTextLayers) { notify(`ใส่ข้อความได้สูงสุด ${maxTextLayers} ชั้น`); return false; }
    if (next.imageLayers.length > maxImageLayers) { notify(`ใส่รูปได้สูงสุด ${maxImageLayers} ชั้น`); return false; }
    const now = performance.now();
    const current = historyProject === (project?.id ?? null);
    const merge = Boolean(key && current && history.length && coalesce.current?.key === key && now - coalesce.current.at < 1500);
    coalesce.current = key ? { key, at: now } : null;
    if (!merge) { setHistory(value => [...(current ? value.slice(-49) : []), { segments, audioClips, textLayers, imageLayers }]); setHistoryProject(project?.id ?? null); }
    setFuture([]); setSegments(next.segments); setAudioClips(next.audioClips); setTextLayers(next.textLayers); setImageLayers(next.imageLayers); setDirty(true); setPlaying(false); setTime(value => Math.min(value, durationOf(next.segments)));
    return true;
  }, [segments, audioClips, textLayers, imageLayers, loading, saving, maxSegments, maxDuration, maxAudioClips, maxTextLayers, maxImageLayers, history.length, historyProject, project, notify, setSegments, setAudioClips, setTextLayers, setImageLayers, setDirty, setTime]);
  const commit = useCallback((next: Segment[]) => { commitState({ segments: next }); }, [commitState]);
  const restore = useCallback((state: EditorState) => { setTrimEpoch(value => value + 1); setTrimDraft(null); setSegments(state.segments); setAudioClips(state.audioClips); setTextLayers(state.textLayers); setImageLayers(state.imageLayers ?? []); coalesce.current = null; setSelected(null); setTime(0); setPlaying(false); setDirty(true); }, [setSegments, setAudioClips, setTextLayers, setImageLayers, setDirty, setTime]);
  const undo = useCallback(() => { if (!historyIsCurrent || !history.length || loading || saving) return; const previous = history[history.length - 1]; setFuture(value => [...value, { segments, audioClips, textLayers, imageLayers }]); setHistory(value => value.slice(0, -1)); restore(previous); }, [historyIsCurrent, history, segments, audioClips, textLayers, imageLayers, loading, saving, restore]);
  const redo = useCallback(() => { if (!historyIsCurrent || !future.length || loading || saving) return; const next = future[future.length - 1]; setHistory(value => [...value, { segments, audioClips, textLayers, imageLayers }]); setFuture(value => value.slice(0, -1)); restore(next); }, [historyIsCurrent, future, segments, audioClips, textLayers, imageLayers, loading, saving, restore]);
  const remove = useCallback(() => {
    if (!selected) return;
    const removedVideo = ripple ? timeline.find(item => item.id === selected) : undefined;
    const rippled = removedVideo ? (() => {
      // Shift by how much the video actually got shorter (a transition overlap is not removed time).
      const length = total - durationOf(segments.filter(item => item.id !== selected)), after = removedVideo.timelineEnd - 1e-3;
      const shift = (value: number) => Math.round(Math.max(0, value - length) * 1000) / 1000;
      return { audioClips: audioClips.map(clip => clip.at >= after ? { ...clip, at: shift(clip.at) } : clip), textLayers: textLayers.map(layer => layer.start >= after ? { ...layer, start: shift(layer.start), end: shift(layer.end) } : layer), imageLayers: imageLayers.map(layer => layer.start >= after ? { ...layer, start: shift(layer.start), end: shift(layer.end) } : layer) };
    })() : {};
    const done = segments.some(item => item.id === selected) ? commitState({ segments: segments.filter(item => item.id !== selected), ...rippled })
      : audioClips.some(item => item.id === selected) ? commitState({ audioClips: audioClips.filter(item => item.id !== selected) })
      : textLayers.some(item => item.id === selected) ? commitState({ textLayers: textLayers.filter(item => item.id !== selected) })
      : imageLayers.some(item => item.id === selected) ? commitState({ imageLayers: imageLayers.filter(item => item.id !== selected) }) : true;
    if (done) setSelected(null);
  }, [selected, segments, audioClips, textLayers, imageLayers, commitState, ripple, timeline, total]);
  const toggle = useCallback(() => { if (!total) return; const position = playbackPosition.current.time; if (position >= total) setTime(0); else setPlaybackTime(position); setPlaying(value => !value || position >= total); }, [total, setTime]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.closest("input,textarea,select,[contenteditable=true]") || dialogRef.current?.open || drawer)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") { event.preventDefault(); shortcuts.current.split(); }
      else if (event.key === " " && !(target instanceof HTMLButtonElement) && !(target instanceof HTMLAnchorElement)) { event.preventDefault(); toggle(); }
      // Delete only when focus is on the timeline (lanes/clips/toolbar) or nowhere in particular (body).
      else if ((event.key === "Delete" || event.key === "Backspace") && (target === document.body || target === document.documentElement || (target instanceof Element && target.closest("[data-delete-scope]")))) { event.preventDefault(); remove(); }
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, [drawer, remove, redo, toggle, undo]);
  // Ctrl+S works even while typing in the title; the latest handlers are read through a ref.
  const shortcuts = useRef({ split: () => {}, save: () => {} });
  useEffect(() => { shortcuts.current = { split, save: saveProject }; });
  useEffect(() => { const keydown = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); shortcuts.current.save(); } }; window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown); }, []);
  useEffect(() => {
    if (!drawer) return;
    const panel = drawerRef.current;
    const trigger = drawerTriggerRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>("button:not([disabled]),input,textarea,select,a[href],[tabindex='0']") ?? []);
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawer(null); if (event.key !== "Tab") return; const list = focusable(); const first = list[0]; const last = list[list.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } };
    document.addEventListener("keydown", keydown); return () => { document.removeEventListener("keydown", keydown); trigger?.focus(); };
  }, [drawer]);

  const splitTarget = selectedSegment ? { item: selectedSegment, kind: "video" as const, count: segments.length, max: maxSegments, at: timeline.find(item => item.id === selected)?.at ?? 0 } : selectedAudio ? { item: selectedAudio, kind: "audio" as const, count: audioClips.length, max: maxAudioClips, at: 0 } : selectedText ? { item: selectedText, kind: "text" as const, count: textLayers.length, max: maxTextLayers, at: 0 } : selectedImage ? { item: selectedImage, kind: "image" as const, count: imageLayers.length, max: maxImageLayers, at: 0 } : null;
  const canSplit = Boolean(splitTarget && canSplitTimelineItem(splitTarget.item, splitTarget.kind, time, splitTarget.count, splitTarget.max, splitTarget.at));
  function split() {
    if (!splitTarget || loading || saving) return;
    const parts = splitTimelineItem(splitTarget.item, splitTarget.kind, playbackPosition.current.time, crypto.randomUUID(), splitTarget.count, splitTarget.max, splitTarget.at);
    if (!parts) return;
    const [first, second] = parts;
    // The left part keeps the fade-in, the right part the fade-out.
    const patch = splitTarget.kind === "video" ? { segments: segments.flatMap(item => item.id === selected ? [{ ...item, end: first.end, fadeOut: undefined }, { ...item, id: second.id, start: second.start, fadeIn: undefined, transition: undefined, transitionDuration: undefined }] : [item]) }
      : splitTarget.kind === "audio" ? { audioClips: audioClips.flatMap(item => item.id === selected ? [{ ...item, end: first.end, fadeOut: undefined }, { ...item, id: second.id, start: second.start, at: playbackPosition.current.time, fadeIn: undefined }] : [item]) }
      : splitTarget.kind === "image" ? { imageLayers: imageLayers.flatMap(item => item.id === selected ? [{ ...item, end: first.end }, { ...item, id: second.id, start: second.start }] : [item]) }
      : { textLayers: textLayers.flatMap(item => item.id === selected ? [{ ...item, end: first.end }, { ...item, id: second.id, start: second.start }] : [item]) };
    if (commitState(patch)) { setSelected(second.id); notify("แยกที่ตำแหน่งเล่นแล้ว"); }
  }
  function applyTrim(kind: TrimKind, id: string, value: TrimItem) {
    if (kind === "video") commitState({ segments: segments.map(item => item.id === id ? { ...item, start: value.start, end: value.end } : item) });
    else if (kind === "audio") commitState({ audioClips: audioClips.map(item => item.id === id ? { ...item, start: value.start, end: value.end, at: value.at ?? item.at } : item) });
    else if (kind === "image") commitState({ imageLayers: imageLayers.map(item => item.id === id ? { ...item, start: value.start, end: value.end } : item) });
    else commitState({ textLayers: textLayers.map(item => item.id === id ? { ...item, start: value.start, end: value.end } : item) });
  }
  function trimHandles(kind: TrimKind, item: TrimItem, at: number, source: number) {
    const shown = trimDraft?.kind === kind && trimDraft.id === item.id ? trimDraft.value : item;
    return <TimelineTrimHandles key={`${kind}:${item.id}:${trimEpoch}`} kind={kind} item={item} shown={shown} at={at} source={source} total={total} maxTimeline={maxDuration} zoom={zoom} selected={selected === item.id} disabled={loading || saving}
      onSelect={() => { setPlaying(false); setSelected(item.id); }}
      onPreview={value => setTrimDraft(value ? { kind, id: item.id, value } : null)} onCommit={value => applyTrim(kind, item.id, value)}
      snapPoints={snapping ? snapPointsFor(item.id, time) : undefined} onGuide={guide => setSnapGuide(guide ?? null)} />;
  }
  function adjust(field: "start" | "end" | "volume" | "speed" | "fadeIn" | "fadeOut", value: number) {
    if (!selectedSegment || !selectedAsset || !Number.isFinite(value)) return;
    let next: Segment = { ...selectedSegment };
    if (field === "start") next.start = Math.max(0, Math.min(next.end - .1, value));
    if (field === "end") next.end = Math.max(next.start + .1, Math.min(selectedAsset.duration, value));
    if (field === "volume") next.volume = Math.max(0, Math.min(1, value));
    if (field === "speed") next.speed = clampSpeed(value) === 1 ? undefined : clampSpeed(value);
    if (field === "fadeIn" || field === "fadeOut") { const fades = clampFades({ fadeIn: next.fadeIn, fadeOut: next.fadeOut, [field]: value }, segmentLength(next), field); next = { ...next, fadeIn: fades.fadeIn || undefined, fadeOut: fades.fadeOut || undefined }; }
    commitState({ segments: segments.map(segment => segment.id === next.id ? next : segment) }, field === "volume" || field.startsWith("fade") ? `${next.id}:${field}` : undefined);
  }
  const selectedIndex = segments.findIndex(segment => segment.id === selected);
  const selectedRoom = selectedIndex > 0 ? Math.floor(maxTransition(segmentLength(segments[selectedIndex - 1]), segmentLength(segments[selectedIndex])) * 10) / 10 : 0;
  function setTransition(type: string | undefined, duration?: number) {
    if (!selectedSegment) return;
    const next = type ? { ...selectedSegment, transition: type, transitionDuration: Math.min(duration ?? selectedSegment.transitionDuration ?? Math.min(.5, selectedRoom), selectedRoom) } : { ...selectedSegment, transition: undefined, transitionDuration: undefined };
    commitState({ segments: segments.map(segment => segment.id === next.id ? next : segment) }, duration !== undefined ? `${next.id}:transition` : undefined);
  }
  function adjustLook(patch: Partial<ClipLook>, key?: string) {
    if (!selectedSegment) return;
    const next = patchLook(selectedSegment, patch);
    commitState({ segments: segments.map(segment => segment.id === next.id ? next : segment) }, key ? `${next.id}:${key}` : undefined);
  }
  // Remembers the level a clip had before muting so un-muting restores it.
  const unmuted = useRef(new Map<string, number>());
  function toggleMute() {
    if (!selectedSegment) return;
    const muted = selectedSegment.volume === 0;
    if (!muted) unmuted.current.set(selectedSegment.id, selectedSegment.volume);
    adjust("volume", muted ? unmuted.current.get(selectedSegment.id) ?? 1 : 0);
  }
  function detachAudio() {
    if (!selectedSegment || !selectedAsset) return;
    if (segmentSpeed(selectedSegment) !== 1) { notify("แยกเสียงได้เฉพาะคลิปความเร็ว 1× ตั้งความเร็วกลับเป็น 1× ก่อน"); return; }
    if (audioClips.length >= maxAudioClips) { notify(`ใส่เสียงได้สูงสุด ${maxAudioClips} คลิป`); return; }
    const at = timeline.find(item => item.id === selectedSegment.id)?.at ?? 0;
    const clip: AudioClip = { id: crypto.randomUUID(), assetId: selectedAsset.id, at, start: selectedSegment.start, end: selectedSegment.end, volume: selectedSegment.volume || 1 };
    // The clip's own sound is muted so the detached copy is the only one heard.
    if (commitState({ audioClips: [...audioClips, clip], segments: segments.map(item => item.id === selectedSegment.id ? { ...item, volume: 0 } : item) })) { setSelected(clip.id); notify("แยกเสียงออกเป็นเลเยอร์เสียงแล้ว ลากย้ายหรือตัดแยกจากภาพได้"); }
  }
  function editTrack(id: string, seek?: number) {
    setSelected(id);
    if (seek !== undefined) setTime(Math.min(seek, Math.max(0, total)));
    if (drawer) setDrawer("inspector");
  }
  function addAudio(asset: Asset, at = playbackPosition.current.time) {
    const range = audioClipRange(at, asset.duration, audioClips.length, maxAudioClips, TRACK_LIMITS.maxTimeline);
    if (!range) { notify(audioClips.length >= maxAudioClips ? `ใส่เสียงได้สูงสุด ${maxAudioClips} คลิป` : "วางเสียงที่ตำแหน่งนี้ไม่ได้ กรุณาเลื่อนตำแหน่งเล่น"); return; }
    const clip: AudioClip = { id: crypto.randomUUID(), assetId: asset.id, ...range, volume: 1 };
    if (commitState({ audioClips: [...audioClips, clip] })) { setSelected(clip.id); notify(range.end < asset.duration ? "เพิ่มเสียงแล้ว (ตัดท้ายให้อยู่ในความยาวสูงสุด 20 นาที)" : "เพิ่มเสียงลง timeline แล้ว"); }
  }
  function adjustAudio(field: "at" | "start" | "end" | "volume" | "fadeIn" | "fadeOut", value: number, clip = selectedAudio) {
    if (!clip) return;
    if (field === "fadeIn" || field === "fadeOut") {
      const fades = clampFades({ fadeIn: clip.fadeIn, fadeOut: clip.fadeOut, [field]: value }, clip.end - clip.start, field);
      commitState({ audioClips: audioClips.map(item => item.id === clip.id ? { ...item, fadeIn: fades.fadeIn || undefined, fadeOut: fades.fadeOut || undefined } : item) }, `${clip.id}:${field}`);
      return;
    }
    const asset = assets.find(item => item.id === clip.assetId);
    const next = adjustAudioClip(clip, field, value, asset?.duration ?? clip.end, TRACK_LIMITS.maxTimeline);
    if (next) commitState({ audioClips: audioClips.map(item => item.id === next.id ? next : item) }, `${clip.id}:${field}`);
  }
  function addText(preset: TextPreset = {}) {
    if (textLayers.length >= maxTextLayers) { notify(`ใส่ข้อความได้สูงสุด ${maxTextLayers} ชั้น`); return; }
    const layer = styleTextLayer({ ...newTextLayer(crypto.randomUUID(), playbackPosition.current.time, total, TRACK_LIMITS.maxTimeline), ...preset }, {});
    if (commitState({ textLayers: [...textLayers, layer] })) { editTrack(layer.id, layer.start); notify("เพิ่มข้อความแล้ว แก้ไขได้ที่แผงปรับแต่งด้านขวา"); }
  }
  function adjustText(field: keyof Omit<TrackTextLayer, "id">, value: string | number, layer = selectedText) {
    if (!layer) return;
    if (field === "start" || field === "end") {
      const number = Number(value);
      if (field === "start" && Number.isFinite(number) && number >= layer.end) { const length = layer.end - layer.start; const start = Math.max(0, Math.min(number, TRACK_LIMITS.maxTimeline - length)); commitState({ textLayers: textLayers.map(item => item.id === layer.id ? { ...item, start, end: start + length } : item) }, `${layer.id}:${field}`); return; }
    }
    const next = adjustTextLayer(layer, field, value, TRACK_LIMITS.maxTimeline);
    if (next) commitState({ textLayers: textLayers.map(item => item.id === next.id ? next : item) }, `${layer.id}:${field}`);
  }
  function styleText(patch: Partial<TrackTextStyle>, key?: string) {
    if (!selectedText) return;
    const next = styleTextLayer(selectedText, patch);
    commitState({ textLayers: textLayers.map(item => item.id === next.id ? next : item) }, key ? `${next.id}:${key}` : undefined);
  }
  function addImage(asset: Asset, at = playbackPosition.current.time) {
    if (imageLayers.length >= maxImageLayers) { notify(`ใส่รูปได้สูงสุด ${maxImageLayers} ชั้น`); return; }
    const layer = newImageLayer(crypto.randomUUID(), asset.id, at, total, TRACK_LIMITS.maxTimeline);
    if (commitState({ imageLayers: [...imageLayers, layer] })) { setSelected(layer.id); notify("เพิ่มรูปแล้ว ลากบนพรีวิวเพื่อย้ายหรือย่อ/ขยาย"); }
  }
  function adjustImage(patch: Partial<Omit<ImageLayer, "id" | "assetId">>, key?: string, layer = selectedImage) {
    if (!layer) return;
    const next = adjustImageLayer(layer, patch, TRACK_LIMITS.maxTimeline);
    commitState({ imageLayers: imageLayers.map(item => item.id === next.id ? next : item) }, key ? `${next.id}:${key}` : undefined);
  }
  function moveText(layer: TextLayer, start: number) {
    const length = layer.end - layer.start;
    const at = Math.round(Math.max(0, Math.min(start, TRACK_LIMITS.maxTimeline - length)) * 10) / 10;
    commitState({ textLayers: textLayers.map(item => item.id === layer.id ? { ...item, start: at, end: Math.round((at + length) * 1000) / 1000 } : item) });
  }
  const timelineTranscripts = transcripts && transcripts.projectId === project?.id ? transcripts.transcripts : [];
  const canSubtitle = hasUsableTranscript(timelineTranscripts, timeline);
  const subtitleHint = !timelineTranscripts.length ? "ยังไม่มีบทพูดจาก AI วิเคราะห์คลิปในแท็บผู้ช่วย AI ก่อน แล้วกลับมาสร้างซับ" : !canSubtitle ? "บทพูดที่มีไม่ตรงกับช่วงคลิปบน timeline ตอนนี้" : "ใช้บทพูดที่ AI เรียบเรียง (ถ้าคำไม่ชัดใช้ต้นฉบับ) วางตามช่วงคลิปบน timeline";
  function generateSubtitles() {
    if (!canSubtitle) return;
    const previous = textLayers.filter(layer => isSubtitleId(layer.id));
    if (previous.length && !window.confirm(`แทนที่ซับเดิม ${previous.length} ชั้นด้วยซับใหม่จากบทพูดหรือไม่? ข้อความที่เพิ่มเองยังอยู่`)) return;
    const kept = textLayers.filter(layer => !isSubtitleId(layer.id));
    const frameRatio = ratio === "9/16" ? 9 / 16 : ratio === "16/9" ? 16 / 9 : 1;
    const { layers, dropped } = buildSubtitleLayers(timelineTranscripts, timeline, { ratio: frameRatio, capacity: Math.max(0, maxTextLayers - kept.length), makeId: () => crypto.randomUUID(), maxTimeline: TRACK_LIMITS.maxTimeline });
    if (!layers.length) { notify(kept.length >= maxTextLayers ? `ข้อความเต็ม ${maxTextLayers} ชั้นแล้ว ลบบางชั้นก่อนสร้างซับ` : "ไม่พบบทพูดในช่วงคลิปบน timeline"); return; }
    if (commitState({ textLayers: [...kept, ...layers] })) notify(`สร้างซับ ${layers.length} ชั้นแล้ว${dropped ? ` · ข้าม ${dropped} ช่วงเพราะเกิน ${maxTextLayers} ชั้น` : ""}`);
  }
  /** Edges an item can snap to: timeline start, playhead, video cuts, and every other audio/text edge. */
  function snapPointsFor(id: string, playhead: number) {
    const points = [0, playhead, ...timeline.flatMap(item => [item.at, item.timelineEnd])];
    for (const clip of audioClips) if (clip.id !== id) points.push(clip.at, clip.at + clip.end - clip.start);
    for (const layer of textLayers) if (layer.id !== id) points.push(layer.start, layer.end);
    for (const layer of imageLayers) if (layer.id !== id) points.push(layer.start, layer.end);
    return points;
  }
  function startTrackDrag(event: ReactPointerEvent<HTMLButtonElement>, id: string, kind: "audio" | "text" | "image", origin: number) {
    if (!event.isPrimary || event.button !== 0 || loading || saving) return;
    trackDragRef.current = { id, kind, origin, startX: event.clientX, pointer: event.pointerId, moved: false, value: origin };
  }
  function moveTrackDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = trackDragRef.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (!drag.moved) { if (Math.abs(delta) < 5) return; drag.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
    let value = Math.max(0, drag.origin + delta / zoom);
    if (snapping) {
      const item = drag.kind === "audio" ? audioClips.find(clip => clip.id === drag.id) : drag.kind === "image" ? imageLayers.find(layer => layer.id === drag.id) : textLayers.find(layer => layer.id === drag.id);
      const length = item ? item.end - item.start : 0;
      const snap = snapShift([value, value + length], snapPointsFor(drag.id, playbackPosition.current.time), SNAP_PX / zoom);
      value = Math.max(0, value + snap.shift);
      setSnapGuide(snap.guide ?? null);
      if (snap.guide === undefined) value = Math.round(value * 10) / 10;
    } else value = Math.round(value * 10) / 10;
    drag.value = Math.round(value * 1000) / 1000;
    setTrackDrag({ id: drag.id, value: drag.value });
  }
  function endTrackDrag(event: ReactPointerEvent<HTMLButtonElement>, commitMove: boolean) {
    const drag = trackDragRef.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    trackDragRef.current = null; setTrackDrag(null); setSnapGuide(null);
    if (!drag.moved || !commitMove) return;
    dragClick.current = true;
    if (drag.kind === "audio") { const clip = audioClips.find(item => item.id === drag.id); if (clip) adjustAudio("at", drag.value, clip); }
    else if (drag.kind === "image") { const layer = imageLayers.find(item => item.id === drag.id); if (layer) { const length = layer.end - layer.start; adjustImage({ start: drag.value, end: drag.value + length }, undefined, layer); } }
    else { const layer = textLayers.find(item => item.id === drag.id); if (layer) moveText(layer, drag.value); }
    setSelected(drag.id);
  }
  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    const startY = event.clientY; const initial = timelineHeight; const target = event.currentTarget; target.setPointerCapture(event.pointerId);
    const move = (pointer: PointerEvent) => setTimelineHeight(Math.max(160, Math.min(window.innerHeight * .5, initial + startY - pointer.clientY)));
    const end = () => { target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", end); target.removeEventListener("pointercancel", end); cleanups.current.delete(end); };
    cleanups.current.add(end); target.addEventListener("pointermove", move); target.addEventListener("pointerup", end); target.addEventListener("pointercancel", end);
  }
  function seekFromPointer(clientX: number) {
    const rect = lanesRef.current?.getBoundingClientRect();
    if (!rect || !total) return;
    const next = Math.max(0, Math.min(total, (clientX - rect.left) / zoom));
    const edges = [...timeline.map(segment => segment.at), total];
    setTime(edges.find(edge => Math.abs(edge - next) * zoom < 6) ?? next);
  }
  function startScrub(event: ReactPointerEvent<HTMLDivElement>) {
    if (!total || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    scrubRef.current?.cleanup();
    const target = event.currentTarget;
    const pointer = event.pointerId;
    if (target.getAttribute("role") === "slider") target.focus({ preventScroll: true });
    target.setPointerCapture(pointer);
    const cleanup = () => {
      scrubRef.current = null;
      cleanups.current.delete(cleanup);
      if (target.hasPointerCapture(pointer)) target.releasePointerCapture(pointer);
    };
    scrubRef.current = { pointer, cleanup };
    cleanups.current.add(cleanup);
    setPlaying(false);
    setScrubbing(true);
    seekFromPointer(event.clientX);
  }
  function moveScrub(event: ReactPointerEvent<HTMLDivElement>) {
    if (scrubRef.current?.pointer !== event.pointerId) return;
    event.preventDefault();
    seekFromPointer(event.clientX);
  }
  function endScrub(event: ReactPointerEvent<HTMLDivElement>) {
    if (scrubRef.current?.pointer !== event.pointerId) return;
    scrubRef.current.cleanup();
    setScrubbing(false);
  }
  function openLibrary(next: LibraryTab, trigger: HTMLButtonElement | null) {
    setLayerMenu(false);
    if (isNarrow()) { drawerTriggerRef.current = trigger; setDrawer(drawer === "library" && libraryTab === next ? null : "library"); setLibraryTab(next); return; }
    if (libraryOpen && libraryTab === next) setLibraryOpen(false); else { setLibraryTab(next); setLibraryOpen(true); }
  }
  function openInspector(trigger: HTMLButtonElement) { drawerTriggerRef.current = trigger; setDrawer(value => value === "inspector" ? null : "inspector"); }
  function backToProjects() {
    if (uploadCount > 0 && !window.confirm("กำลังอัปโหลดไฟล์อยู่ ถ้าออกตอนนี้การอัปโหลดจะหยุด ต้องการออกหรือไม่?")) return;
    if (!uploadCount && dirty && !window.confirm("มีการแก้ไขที่ยังไม่บันทึก ต้องการออกโดยไม่บันทึกหรือไม่?")) return;
    router.push("/studio/ai-editor");
  }
  function saveProject() { if (loading || saving || uploadCount > 0 || persistence.conflict) return; void persistence.save().then(() => notify("บันทึกโปรเจกต์แล้ว")).catch(() => {}); }
  function addVideo(asset: Asset) {
    const range = manualTimelineRange(asset.duration, segments.length, total, maxSegments, maxDuration);
    if (!range) { notify(`รองรับสูงสุด ${maxSegments} ช่วงคลิป ความยาวรวมไม่เกิน ${maxDuration / 60} นาที`); return; }
    commit([...segments, { id: crypto.randomUUID(), asset: asset.id, ...range, volume: 1 }]); notify("เพิ่มคลิปลง timeline แล้ว");
  }
  const laneMime = (lane: "video" | "audio" | "image") => lane === "video" ? VIDEO_ASSET_MIME : lane === "audio" ? AUDIO_ASSET_MIME : IMAGE_ASSET_MIME;
  function laneDragOver(event: React.DragEvent<HTMLDivElement>, lane: "video" | "audio" | "image") {
    if (!event.dataTransfer.types.includes(laneMime(lane))) return;
    event.preventDefault(); event.dataTransfer.dropEffect = "copy"; if (dropLane !== lane) setDropLane(lane);
  }
  function laneDrop(event: React.DragEvent<HTMLDivElement>, lane: "video" | "audio" | "image") {
    setDropLane(null);
    const id = event.dataTransfer.getData(laneMime(lane));
    const asset = assets.find(item => item.id === id && item.status === "ready");
    if (!asset || loading || saving) return;
    event.preventDefault();
    if (lane === "video") { addVideo(asset); return; }
    const rect = lanesRef.current?.getBoundingClientRect();
    if (lane === "image") { addImage(asset, rect ? Math.max(0, Math.round((event.clientX - rect.left) / zoom * 10) / 10) : playbackPosition.current.time); return; }
    addAudio(asset, rect ? Math.max(0, Math.round((event.clientX - rect.left) / zoom * 10) / 10) : playbackPosition.current.time);
  }
  function libraryDrop(event: React.DragEvent<HTMLElement>) {
    if (!event.dataTransfer.files.length || (libraryTab !== "media" && libraryTab !== "audio" && libraryTab !== "image")) return;
    event.preventDefault(); setDragOver(false);
    void persistence.importFiles(event.dataTransfer.files, libraryTab === "audio" ? "audio" : libraryTab === "image" ? "image" : "video");
  }
  useEffect(() => {
    if (!layerMenu) return;
    const close = (event: PointerEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === "Escape" : !layerMenuRef.current?.contains(event.target as Node)) setLayerMenu(false); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [layerMenu]);
  const visibleAssets = videoAssets.filter(asset => asset.name.toLowerCase().includes(query.trim().toLowerCase()));

  const laneEnd = Math.max(total, ...audioClips.map(clip => clip.at + clip.end - clip.start), ...textLayers.map(layer => layer.end), ...imageLayers.map(layer => layer.end));
  const rulerTicks = useMemo(() => Array.from({ length: Math.ceil(Math.max(laneEnd + 10, 600 / zoom) / Math.max(1, Math.round(60 / zoom))) }, (_, index) => { const second = index * Math.max(1, Math.round(60 / zoom)); return <span key={second} style={{ left: second * zoom }}>{`${Math.floor(second / 60)}:${String(second % 60).padStart(2, "0")}`}</span>; }), [laneEnd, zoom]);
  const displayTimeline = playbackTimeline(trimDraft?.kind === "video" ? segments.map(item => item.id === trimDraft.id ? { ...item, start: trimDraft.value.start, end: trimDraft.value.end } : item) : segments);
  // Layers come from committed positions so a clip being dragged never jumps rows mid-gesture.
  const audioLanes = useMemo(() => { const lanes = packLanes(audioClips, clip => clip.at, clip => clip.at + clip.end - clip.start); return lanes.length ? lanes : [[]]; }, [audioClips]);
  const imageLanes = useMemo(() => { const lanes = packLanes(imageLayers, layer => layer.start, layer => layer.end); return lanes.length || !persistence.imagesSupported ? lanes : [[]]; }, [imageLayers, persistence.imagesSupported]);
  const textLanes = useMemo(() => { const lanes = packLanes(textLayers, layer => layer.start, layer => layer.end); return lanes.length ? lanes : [[]]; }, [textLayers]);
  const busy = loading || saving;
  const videoTrack = <div className={styles.track} data-kind="video" data-drop={dropLane === "video" || undefined} aria-label="แทร็กวิดีโอ" onDragOver={event => laneDragOver(event, "video")} onDragLeave={() => setDropLane(null)} onDrop={event => laneDrop(event, "video")}>
    {loading && !segments.length && <div className={styles.laneSkeleton} aria-hidden="true">{[38, 22, 30].map((width, index) => <span key={index} className={styles.skeleton} style={{ width: `${width}%` }} />)}</div>}
    {!loading && !segments.length && <button className={styles.lanePlaceholder} onClick={event => openLibrary("media", event.currentTarget)}><Plus />ลากวิดีโอจากคลังมาวางที่นี่ หรือคลิกเพื่อเลือกคลิป</button>}
    {displayTimeline.map(segment => { const asset = assets.find(item => item.id === segment.asset); const count = Math.max(1, Math.min(80, Math.ceil(segmentLength(segment) * zoom / 56))); return <Fragment key={segment.id}><button data-video-clip={segment.id} draggable onDragStart={event => event.dataTransfer.setData("text/plain", segment.id)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); const source = segments.find(item => item.id === id); if (!source || source.id === segment.id) return; const next = segments.filter(item => item.id !== id); next.splice(next.findIndex(item => item.id === segment.id), 0, source); commit(next); }} className={styles.clip} aria-pressed={selected === segment.id} aria-label={`${asset?.name} ${fmt(segmentLength(segment))}${segmentSpeed(segment) !== 1 ? ` ความเร็ว ${speedLabel(segmentSpeed(segment))}` : ""}${segment.volume === 0 ? " ปิดเสียง" : ""}`} style={{ left: segment.at * zoom, width: segmentLength(segment) * zoom }} onClick={() => { setSelected(segment.id); setTime(segment.at); }}><span className={styles.filmstrip} aria-hidden="true">{Array.from({ length: count }, (_, index) => { const sourceTime = segment.start + (segment.end - segment.start) * index / count; const frame = frameAt(asset?.frames ?? [], sourceTime, segment.start, segment.end); return <span key={index} className={styles.filmstripFrame} data-source-time={sourceTime.toFixed(3)} data-frame-time={frame?.time.toFixed(3)} style={{ backgroundImage: frame ? `url("${frame.url}")` : undefined }} />; })}</span>{(segment.fadeIn ?? 0) > 0 && <span className={styles.fadeMark} data-edge="in" style={{ width: (segment.fadeIn ?? 0) * zoom }} aria-hidden="true" />}{(segment.fadeOut ?? 0) > 0 && <span className={styles.fadeMark} data-edge="out" style={{ width: (segment.fadeOut ?? 0) * zoom }} aria-hidden="true" />}<span className={styles.clipLabel}>{segment.volume === 0 && <VolumeX className={styles.inlineIcon} />}{asset?.name}<small>{fmt(segmentLength(segment))}{segmentSpeed(segment) !== 1 && <b className={styles.speedBadge}>{speedLabel(segmentSpeed(segment))}</b>}</small></span></button>{trimHandles("video", segments.find(item => item.id === segment.id) ?? segment, segment.at, asset?.duration ?? segment.end)}</Fragment>; })}
    {persistence.clipStyles && displayTimeline.slice(1).map(segment => <button key={`join:${segment.id}`} className={styles.junction} data-set={segment.transition ? true : undefined} style={{ left: (segment.at + (segment.transitionDuration ?? 0) / 2) * zoom }} title={segment.transition ? `ทรานซิชัน ${TRANSITIONS.find(item => item.id === segment.transition)?.label ?? ""} ${segment.transitionDuration?.toFixed(1)} วิ` : "เพิ่มทรานซิชัน"} aria-label={segment.transition ? "แก้ทรานซิชัน" : "เพิ่มทรานซิชัน"} onClick={() => { setSelected(segment.id); setPlaying(false); }}><Blend /></button>)}
  </div>;
  const renderAudio = (clip: AudioClip) => { const asset = assets.find(item => item.id === clip.assetId); const shown = trimDraft?.kind === "audio" && trimDraft.id === clip.id ? { ...clip, ...trimDraft.value } : clip; const at = trackDrag?.id === clip.id ? trackDrag.value : shown.at; const length = shown.end - shown.start; return <Fragment key={clip.id}><button data-audio-clip={clip.id} className={`${styles.clip} ${styles.audioClip}`} data-beyond={at + length > total + .05 || undefined} aria-pressed={selected === clip.id} aria-label={`เสียง ${asset?.name ?? ""} เริ่ม ${fmt(clip.at)} ยาว ${fmt(length)} ระดับเสียง ${Math.round(clip.volume * 100)}%`} style={{ left: at * zoom, width: Math.max(6, length * zoom) }} onPointerDown={event => startTrackDrag(event, clip.id, "audio", clip.at)} onPointerMove={moveTrackDrag} onPointerUp={event => endTrackDrag(event, true)} onPointerCancel={event => endTrackDrag(event, false)} onClick={() => { if (dragClick.current) { dragClick.current = false; return; } setSelected(clip.id); }}>{(clip.fadeIn ?? 0) > 0 && <span className={styles.fadeMark} data-edge="in" style={{ width: (clip.fadeIn ?? 0) * zoom }} aria-hidden="true" />}{(clip.fadeOut ?? 0) > 0 && <span className={styles.fadeMark} data-edge="out" style={{ width: (clip.fadeOut ?? 0) * zoom }} aria-hidden="true" />}<span className={styles.wave} aria-hidden="true" /><span className={styles.clipLabel}><Music className={styles.inlineIcon} />{asset?.name ?? "ไฟล์เสียง"}<small>{fmt(length)} · {Math.round(clip.volume * 100)}%</small></span></button>{trimHandles("audio", clip, at, asset?.duration ?? clip.end)}</Fragment>; };
  const renderText = (layer: TextLayer) => { const shown = trimDraft?.kind === "text" && trimDraft.id === layer.id ? { ...layer, ...trimDraft.value } : layer; const start = trackDrag?.id === layer.id ? trackDrag.value : shown.start; const length = shown.end - shown.start; return <Fragment key={layer.id}><button data-text-clip={layer.id} className={`${styles.clip} ${styles.textClip}`} data-beyond={start >= total || undefined} aria-pressed={selected === layer.id} aria-label={`ข้อความ ${layer.text.split("\n")[0]} ${fmt(layer.start)}–${fmt(layer.end)}`} style={{ left: start * zoom, width: Math.max(6, length * zoom) }} onPointerDown={event => startTrackDrag(event, layer.id, "text", layer.start)} onPointerMove={moveTrackDrag} onPointerUp={event => endTrackDrag(event, true)} onPointerCancel={event => endTrackDrag(event, false)} onClick={() => { if (dragClick.current) { dragClick.current = false; return; } setSelected(layer.id); if (total) setTime(Math.min(layer.start, total)); }}><span className={styles.clipLabel}><Type className={styles.inlineIcon} />{layer.text.split("\n")[0] || "(ว่าง)"}<small>{fmt(length)}</small></span></button>{trimHandles("text", layer, start, maxDuration)}</Fragment>; };
  const renderImage = (layer: ImageLayer) => { const asset = assets.find(item => item.id === layer.assetId); const shown = trimDraft?.kind === "image" && trimDraft.id === layer.id ? { ...layer, ...trimDraft.value } : layer; const start = trackDrag?.id === layer.id ? trackDrag.value : shown.start; const length = shown.end - shown.start; const picture = asset?.url ?? asset?.frames[0]?.url; return <Fragment key={layer.id}><button data-image-clip={layer.id} className={`${styles.clip} ${styles.imageClip}`} data-beyond={start >= total || undefined} aria-pressed={selected === layer.id} aria-label={`รูป ${asset?.name ?? ""} ${fmt(layer.start)}–${fmt(layer.end)}`} style={{ left: start * zoom, width: Math.max(6, length * zoom) }} onPointerDown={event => startTrackDrag(event, layer.id, "image", layer.start)} onPointerMove={moveTrackDrag} onPointerUp={event => endTrackDrag(event, true)} onPointerCancel={event => endTrackDrag(event, false)} onClick={() => { if (dragClick.current) { dragClick.current = false; return; } setSelected(layer.id); if (total) setTime(Math.min(layer.start, total)); }}>{picture && <span className={styles.imageClipThumb} style={{ backgroundImage: `url("${picture}")` }} aria-hidden="true" />}<span className={styles.clipLabel}><ImageIcon className={styles.inlineIcon} />{asset?.name ?? "รูปภาพ"}<small>{fmt(length)}</small></span></button>{trimHandles("image", layer, start, maxDuration)}</Fragment>; };
  const activeImages = imageLayers.filter(layer => total > 0 && time >= layer.start && time < Math.min(layer.end, total));
  const libraryTitle = LIBRARY_TABS.find(item => item.value === libraryTab)?.title;
  const lookFilterId = "ez-editor-look";
  const outgoingRect = blend && hasFrame(blend.from) ? frameRect(blend.from, videoSize, frameSize) : undefined;
  const outgoingStyle: CSSProperties = outgoingRect ? { left: outgoingRect.left, top: outgoingRect.top, width: outgoingRect.width, height: outgoingRect.height, objectFit: "fill" } : {};
  const previewColour = lookColour(current ?? {});
  const previewRect = current && hasFrame(current) ? frameRect(current, videoSize, frameSize) : undefined;
  const previewStyle: CSSProperties | undefined = current && (previewRect || hasColour(current)) ? {
    ...(previewRect ? { position: "absolute", left: previewRect.left, top: previewRect.top, width: previewRect.width, height: previewRect.height, maxWidth: "none", objectFit: "fill" } : {}),
    ...(hasColour(current) ? { filter: `url(#${lookFilterId})` } : {}),
  } : undefined;
  const selectionKind = selectedSegment ? "คลิปวิดีโอ" : selectedAudio ? "เสียง" : selectedText ? "ข้อความ" : selectedImage ? "รูปภาพ" : "โปรเจกต์";
  const saveState = saving ? { label: "กำลังบันทึก…", tone: "busy" } : dirty ? { label: "ยังไม่บันทึก", tone: "dirty" } : { label: "บันทึกแล้ว", tone: "saved" };

  return <div className={styles.editor} data-library={libraryOpen ? "open" : "closed"}>
    <header className={styles.toolbar}>
      <button className={styles.back} onClick={backToProjects} aria-label="กลับไปหน้าโปรเจกต์" title="โปรเจกต์ทั้งหมด"><ChevronLeft /><span>โปรเจกต์</span></button>
      {loading && !project ? <span className={`${styles.skeleton} ${styles.skTitle}`} aria-hidden="true" /> : <input className={styles.title} aria-label="ชื่อโปรเจกต์" maxLength={200} disabled={busy} value={title} onChange={event => { setTitle(event.target.value); setDirty(true); }} />}
      <span className={styles.save} data-tone={saveState.tone} role="status">{saveState.tone === "saved" ? <CloudCheck /> : <i />}{saveState.label}</span>
      <span className={styles.spacer} />
      <button className={styles.iconButton} onClick={undo} disabled={!historyIsCurrent || !history.length || busy} aria-label="ย้อนกลับ" title="ย้อนกลับ (Ctrl+Z)"><Undo2 /></button>
      <button className={styles.iconButton} onClick={redo} disabled={!historyIsCurrent || !future.length || busy} aria-label="ทำซ้ำ" title="ทำซ้ำ (Ctrl+Shift+Z)"><Redo2 /></button>
      <button className={styles.saveButton} aria-label="บันทึกโปรเจกต์" title="บันทึก (Ctrl+S)" disabled={busy || uploadCount > 0 || persistence.conflict} onClick={saveProject}>{saving ? "กำลังบันทึก…" : "บันทึก"}</button>
      <button className={styles.primary} onClick={() => dialogRef.current?.showModal()}><Download />ส่งออก</button>
    </header>
    {persistence.error && <div className={`${styles.projectAlert} ${styles.error}`} role="alert"><span>{persistence.error}</span>{persistence.conflict ? <div className={styles.chips}><button onClick={persistence.recover}>เก็บฉบับในเครื่อง</button><button onClick={() => { if (project && window.confirm("โหลดฉบับล่าสุดจะเปลี่ยนงานในหน้าจอนี้ ต้องการดำเนินการต่อหรือไม่?")) void persistence.load(project.id, true); }}>โหลดฉบับล่าสุด</button></div> : <button aria-label="ปิดข้อความแจ้งเตือน" onClick={() => persistence.setError("")}><X /></button>}</div>}
    {drawer && <div className={styles.backdrop} onClick={() => setDrawer(null)} aria-hidden="true" />}
    <div className={styles.workspace}>
      <nav className={styles.rail} aria-label="เครื่องมือ">{LIBRARY_TABS.map(item => <button key={item.value} className={styles.railButton} aria-label={item.label} aria-pressed={libraryTab === item.value} data-open={(libraryOpen || drawer === "library") && libraryTab === item.value || undefined} onClick={event => openLibrary(item.value, event.currentTarget)}><item.icon /><span aria-hidden="true">{item.label}</span></button>)}</nav>
      <aside ref={element => { if (drawer === "library") drawerRef.current = element; }} className={`${styles.panel} ${styles.media} ${drawer === "library" ? styles.open : ""}`} role={drawer === "library" ? "dialog" : undefined} aria-modal={drawer === "library" || undefined} aria-label={libraryTitle}
        onDragOver={event => { if (event.dataTransfer.types.includes("Files") && (libraryTab === "media" || libraryTab === "audio" || libraryTab === "image")) { event.preventDefault(); setDragOver(true); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false); }} onDrop={libraryDrop}>
        <div className={styles.panelHead}><b>{libraryTitle}</b><button className={styles.closeDrawer} aria-label="ปิดแผง" onClick={() => { setDrawer(null); setLibraryOpen(false); }}><X /></button></div>
        <div className={styles.panelBody}>
          {dragOver && <div className={styles.dropOverlay} aria-hidden="true"><Upload />วางไฟล์เพื่ออัปโหลด</div>}
          {libraryTab === "audio" ? <AudioTab assets={audioAssets} clips={audioClips} maxClips={maxAudioClips} formats={persistence.audioFormats} supported={persistence.tracksSupported} busy={busy} loading={loading} unavailable={persistence.capabilities?.available === false} playhead={time} canAdd={asset => Boolean(audioClipRange(time, asset.duration, audioClips.length, maxAudioClips, TRACK_LIMITS.maxTimeline))} onImport={files => void persistence.importFiles(files, "audio")} onRetry={persistence.retryUpload} onAdd={asset => addAudio(asset)} onEdit={id => { const clip = audioClips.find(item => item.id === id); editTrack(id, clip?.at); }} />
          : libraryTab === "image" ? <ImageTab assets={imageAssets} layers={imageLayers} maxLayers={maxImageLayers} supported={persistence.imagesSupported} busy={busy} loading={loading} onImport={files => void persistence.importFiles(files, "image")} onRetry={persistence.retryUpload} onAdd={asset => addImage(asset)} />
          : libraryTab === "text" ? <TextTab layers={textLayers} maxLayers={maxTextLayers} supported={persistence.tracksSupported} busy={busy} textOverlays={persistence.textOverlays} canSubtitle={canSubtitle} subtitleHint={subtitleHint} playhead={time} effects={persistence.clipStyles} onAdd={addText} onSubtitles={generateSubtitles} onEdit={id => { const layer = textLayers.find(item => item.id === id); editTrack(id, layer?.start); }} />
          : libraryTab === "media" ? <>
            <input ref={inputRef} type="file" accept="video/*,.mov,.mp4" multiple hidden onChange={event => { if (event.target.files) void persistence.importFiles(event.target.files); event.target.value = ""; }} />
            <button className={styles.importButton} disabled={busy || persistence.capabilities?.available === false} onClick={() => inputRef.current?.click()}><Upload /><span><b>นำเข้าวิดีโอ</b><small>MP4, MOV, WebM · ไม่เกิน 50 MB</small></span></button>
            {videoAssets.length > 3 && <label className={styles.search}><Search /><input placeholder="ค้นหาคลิป" aria-label="ค้นหาสื่อ" value={query} onChange={event => setQuery(event.target.value)} /></label>}
            <div className={styles.mediaGrid}>
              {loading && !videoAssets.length && Array.from({ length: 6 }, (_, index) => <div key={index} className={styles.mediaCard} aria-hidden="true"><span className={`${styles.mediaThumb} ${styles.skeleton}`} /><span className={`${styles.skeleton} ${styles.skLine}`} /></div>)}
              {visibleAssets.map(asset => { const ready = asset.status === "ready"; const canAdd = ready && !busy && Boolean(manualTimelineRange(asset.duration, segments.length, total, maxSegments, maxDuration)); return <div className={styles.mediaCard} key={asset.id} data-status={asset.status} draggable={ready} onDragStart={event => { event.dataTransfer.setData(VIDEO_ASSET_MIME, asset.id); event.dataTransfer.effectAllowed = "copy"; }} onDoubleClick={() => { if (canAdd) addVideo(asset); }} title={ready ? "ลากลง timeline หรือดับเบิลคลิกเพื่อเพิ่ม" : undefined}>
                <div className={`${styles.mediaThumb} ${ready && asset.thumbnails === "loading" && !asset.frames[0] ? styles.skeleton : ""}`}>
                  {asset.frames[0] ? <span className={styles.libraryFrame} style={{ backgroundImage: `url("${asset.frames[0].url}")` }} /> : asset.thumbnails !== "loading" && <Film />}
                  {ready && <span className={styles.duration}>{fmt(asset.duration)}</span>}
                  {asset.status === "loading" && <span className={styles.mediaOverlay}><small>{asset.progress !== undefined && asset.progress < 100 ? `อัปโหลด ${asset.progress}%` : "กำลังเตรียมคลิป"}</small><span className={styles.progress}><i style={{ width: `${asset.progress ?? 100}%` }} data-indeterminate={asset.progress === undefined || asset.progress === 100 || undefined} /></span></span>}
                  {asset.status === "error" && <span className={`${styles.mediaOverlay} ${styles.mediaError}`}><small>อัปโหลดไม่สำเร็จ</small><button onClick={() => persistence.retryUpload(asset)} aria-label={`ลองอัปโหลด ${asset.name} อีกครั้ง`}>ลองใหม่</button></span>}
                  {ready && <button className={styles.addButton} disabled={!canAdd} aria-label={`เพิ่ม ${asset.name} ลง timeline`} title="เพิ่มต่อท้าย timeline" onClick={() => addVideo(asset)}><Plus /></button>}
                </div>
                <strong title={asset.failure || asset.name}>{asset.name}</strong>
              </div>; })}
            </div>
            {!loading && !videoAssets.length && <button className={styles.drop} disabled={busy || persistence.capabilities?.available === false} onClick={() => inputRef.current?.click()}><Film /><b>ยังไม่มีวิดีโอ</b><span>ลากไฟล์มาวางที่นี่ หรือคลิกเพื่ออัปโหลด</span></button>}
            {!loading && videoAssets.length > 0 && !visibleAssets.length && <p className={styles.hint}>ไม่พบคลิปที่ตรงกับคำค้น</p>}
            {persistence.capabilities?.available === false && <p className={`${styles.alert} ${styles.warning}`}>{persistence.capabilities.unavailableReason || "ระบบประมวลผลสื่อยังไม่พร้อมใช้งาน"}</p>}
          </> : null}
          <div className={styles.aiHost} hidden={libraryTab !== "ai"}><AiAssistantPanel key={project?.id ?? "empty-project"} persistence={persistence} onApply={adoptAiProject} onTranscripts={setTranscripts} onPreviewStart={() => setPlaying(false)} /></div>
        </div>
      </aside>
      <section className={styles.stage} aria-label="พรีวิว">
        <div className={styles.view}><div ref={frameRef} className={`${styles.frame} ${loading && !currentAsset ? styles.skeleton : ""}`} style={{ aspectRatio: ratio, "--frame-ratio": ratio === "9/16" ? 9 / 16 : ratio === "16/9" ? 16 / 9 : 1 } as CSSProperties}>
          {current && hasColour(current) && <svg className={styles.filterDefs} aria-hidden="true"><filter id={lookFilterId} colorInterpolationFilters="sRGB"><feComponentTransfer>{(["feFuncR", "feFuncG", "feFuncB"] as const).map(Func => <Func key={Func} type="linear" slope={previewColour.slope} intercept={previewColour.intercept} />)}</feComponentTransfer><feColorMatrix type="saturate" values={String(previewColour.saturate)} /></filter></svg>}
          {currentAsset?.url ? <video ref={videoRef} key={currentAsset.url} src={currentAsset.url} playsInline preload="auto" onLoadedMetadata={event => setVideoSize({ width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight })} style={previewStyle} /> : !loading && <div className={styles.fill}><span className={styles.emptyPreview}><Film />ยังไม่มีคลิปบน timeline</span></div>}
          {blendAsset?.url && blend && <video ref={outgoingRef} key={`${blend.from.id}:${blendAsset.url}`} className={styles.outgoing} src={blendAsset.url} playsInline preload="auto" aria-hidden="true" style={{ ...outgoingStyle, visibility: "hidden" }} onLoadedMetadata={() => frameWork.current(playbackPosition.current.time)} />}
          <div ref={coverRef} className={styles.transitionCover} aria-hidden="true" />
          {activeImages.map(layer => { const url = assets.find(asset => asset.id === layer.assetId && asset.status === "ready")?.url; return url ? <ImageOverlay key={layer.id} layer={layer} url={url} frame={frameSize} selected={selected === layer.id} disabled={busy} onSelect={() => { setSelected(layer.id); setPlaying(false); }} onCommit={geometry => adjustImage(geometry, undefined, layer)} /> : null; })}
          {activeText.map(layer => <TextOverlay key={layer.id} layer={layer} frame={frameSize} selected={selected === layer.id} disabled={busy} resizable={persistence.capabilities?.textTransforms === true} time={time} onSelect={() => { setSelected(layer.id); setPlaying(false); }} onCommit={geometry => commitState({ textLayers: textLayers.map(item => item.id === layer.id ? { ...item, ...geometry } : item) })} />)}
          <div ref={fadeRef} className={styles.fadeOverlay} style={{ opacity: 1 - previewGain }} aria-hidden="true" />
          {safeArea && <div className={styles.safe} />}
        </div></div>
        <div className={styles.controls}>
          <span className={styles.time}><b>{fmt(time)}</b> / {fmt(total)}</span>
          <div className={styles.transport}>
            <button className={styles.iconButton} onClick={() => setTime(0)} aria-label="ไปต้นคลิป" disabled={!total}><SkipBack /></button>
            <button className={styles.playButton} aria-label={playing && time < total ? "หยุด" : "เล่น"} disabled={!total} onClick={toggle}>{playing && time < total ? <Pause /> : <Play />}</button>
            <button className={styles.iconButton} onClick={() => { setPlaying(false); setTime(total); }} aria-label="ไปท้ายคลิป" disabled={!total}><SkipForward /></button>
          </div>
          <button className={styles.iconButton} aria-pressed={safeArea} aria-label="แสดงขอบปลอดภัย" title="ขอบปลอดภัย (Safe area)" onClick={() => setSafeArea(value => !value)}><Scan /></button>
        </div>
      </section>
      <aside ref={element => { if (drawer === "inspector") drawerRef.current = element; }} className={`${styles.panel} ${styles.assistant} ${drawer === "inspector" ? styles.open : ""}`} role={drawer === "inspector" ? "dialog" : undefined} aria-modal={drawer === "inspector" || undefined} aria-label="ปรับแต่ง">
        <div className={styles.panelHead}><b>{selected ? `ปรับแต่ง${selectionKind}` : "ตั้งค่าโปรเจกต์"}</b><button className={styles.closeDrawer} aria-label="ปิดแผงปรับแต่ง" onClick={() => setDrawer(null)}><X /></button></div>
        <div className={styles.panelBody}>
          {loading && !project ? <div className={styles.skeletonStack} aria-hidden="true"><span className={`${styles.skeleton} ${styles.skLine}`} /><span className={`${styles.skeleton} ${styles.skBlock}`} /><span className={`${styles.skeleton} ${styles.skRow}`} /><span className={`${styles.skeleton} ${styles.skRow}`} /></div>
          : selectedSegment && selectedAsset ? <>
            <b className={styles.inspectorName}><Film className={styles.inlineIcon} />{selectedAsset.name}</b>
            <div className={styles.row2}><label>เริ่ม (วินาที)<NumberField className={styles.input} min={0} max={selectedSegment.end - .1} step={.1} value={Number(selectedSegment.start.toFixed(2))} onCommit={value => adjust("start", value)} /></label><label>จบ (วินาที)<NumberField className={styles.input} min={selectedSegment.start + .1} max={selectedAsset.duration} step={.1} value={Number(selectedSegment.end.toFixed(2))} onCommit={value => adjust("end", value)} /></label></div>
            {persistence.clipEffects && <>
              <span className={styles.sectionLabel}><Gauge className={styles.inlineIcon} />ความเร็ว {speedLabel(segmentSpeed(selectedSegment))}</span>
              <div className={styles.speedChips} role="group" aria-label="ความเร็วคลิป">{SPEED_PRESETS.map(value => <button key={value} disabled={busy} aria-pressed={segmentSpeed(selectedSegment) === value} onClick={() => adjust("speed", value)}>{speedLabel(value)}</button>)}</div>
              <input type="range" aria-label="ปรับความเร็วละเอียด" disabled={busy} min={.25} max={4} step={.05} value={segmentSpeed(selectedSegment)} onChange={event => adjust("speed", Number(event.target.value))} />
            </>}
            <span className={styles.sectionLabel}>เสียง</span>
            <div className={styles.volumeRow}>
              <button className={styles.iconButton} disabled={busy} aria-pressed={selectedSegment.volume === 0} aria-label={selectedSegment.volume === 0 ? "เปิดเสียงคลิป" : "ปิดเสียงคลิป"} title={selectedSegment.volume === 0 ? "เปิดเสียง" : "ปิดเสียง"} onClick={toggleMute}>{selectedSegment.volume === 0 ? <VolumeX /> : <Volume2 />}</button>
              <label>ระดับเสียง {Math.round(selectedSegment.volume * 100)}%<input type="range" min={0} max={1} step={.05} value={selectedSegment.volume} onChange={event => adjust("volume", Number(event.target.value))} /></label>
            </div>
            {persistence.clipEffects && persistence.tracksSupported && <button disabled={busy || selectedAsset.hasAudio === false || audioClips.length >= maxAudioClips} title={selectedAsset.hasAudio === false ? "คลิปนี้ไม่มีเสียง" : "ย้ายเสียงของคลิปไปเป็นเลเยอร์เสียงแยก"} onClick={detachAudio}><AudioLines />แยกเสียงออกจากวิดีโอ</button>}
            {persistence.clipEffects && <><span className={styles.sectionLabel}>เฟดจาก/ไปจอดำ</span><FadeFields fadeIn={selectedSegment.fadeIn ?? 0} fadeOut={selectedSegment.fadeOut ?? 0} length={segmentLength(selectedSegment)} busy={busy} onChange={(field, value) => adjust(field, value)} /></>}
            {persistence.clipStyles && <>
              <span className={styles.sectionLabel}><Palette className={styles.inlineIcon} />ปรับสี</span>
              <div className={styles.lookPresets} role="group" aria-label="ฟิลเตอร์สี">{LOOK_PRESETS.map(preset => { const active = (["brightness", "contrast", "saturation"] as const).every(key => (selectedSegment[key] ?? 0) === (preset.look[key] ?? 0)); return <button key={preset.id} data-preset={preset.id} disabled={busy} aria-pressed={active} onClick={() => adjustLook({ brightness: preset.look.brightness ?? 0, contrast: preset.look.contrast ?? 0, saturation: preset.look.saturation ?? 0 })}><span aria-hidden="true" />{preset.label}</button>; })}</div>
              {([["brightness", "ความสว่าง"], ["contrast", "คอนทราสต์"], ["saturation", "ความอิ่มสี"]] as const).map(([key, label]) => <label key={key}>{label} {Math.round((selectedSegment[key] ?? 0) * 100)}<input type="range" disabled={busy} min={-1} max={1} step={.01} value={selectedSegment[key] ?? 0} onChange={event => adjustLook({ [key]: Number(event.target.value) }, key)} /></label>)}
              <span className={styles.sectionLabel}><Crop className={styles.inlineIcon} />จัดเฟรม</span>
              <div className={styles.row2} role="group" aria-label="การวางภาพในกรอบ"><button disabled={busy} aria-pressed={selectedSegment.fit !== "cover"} onClick={() => adjustLook({ fit: undefined })}>พอดีกรอบ</button><button disabled={busy} aria-pressed={selectedSegment.fit === "cover"} onClick={() => adjustLook({ fit: "cover" })}>เต็มกรอบ</button></div>
              <label>ซูม {Math.round((selectedSegment.zoom ?? 1) * 100)}%<input type="range" disabled={busy} min={1} max={3} step={.01} value={selectedSegment.zoom ?? 1} onChange={event => adjustLook({ zoom: Number(event.target.value) }, "zoom")} /></label>
              {hasFrame(selectedSegment) && <div className={styles.row2}>
                <label>เลื่อนซ้าย–ขวา<input type="range" disabled={busy} min={-1} max={1} step={.01} value={selectedSegment.panX ?? 0} onChange={event => adjustLook({ panX: Number(event.target.value) }, "panX")} /></label>
                <label>เลื่อนบน–ล่าง<input type="range" disabled={busy} min={-1} max={1} step={.01} value={selectedSegment.panY ?? 0} onChange={event => adjustLook({ panY: Number(event.target.value) }, "panY")} /></label>
              </div>}
              {(hasColour(selectedSegment) || hasFrame(selectedSegment) || selectedSegment.panX || selectedSegment.panY) && <button disabled={busy} onClick={() => adjustLook({ brightness: 0, contrast: 0, saturation: 0, fit: undefined, zoom: 1, panX: 0, panY: 0 })}><RotateCcw />รีเซ็ตสีและเฟรม</button>}
            </>}
            {persistence.clipStyles && selectedIndex > 0 && <>
              <span className={styles.sectionLabel}><Blend className={styles.inlineIcon} />ทรานซิชันจากคลิปก่อนหน้า</span>
              {selectedRoom < MIN_TRANSITION ? <small className={styles.muted}>คลิปนี้หรือคลิปก่อนหน้าสั้นเกินไปสำหรับทรานซิชัน</small> : <>
                <div className={styles.transitionGrid} role="group" aria-label="ทรานซิชัน"><button disabled={busy} aria-pressed={!selectedSegment.transition} onClick={() => setTransition(undefined)}>ไม่มี</button>{TRANSITIONS.map(item => <button key={item.id} data-transition={item.id} disabled={busy} aria-pressed={selectedSegment.transition === item.id} onClick={() => setTransition(item.id)}><span aria-hidden="true" />{item.label}</button>)}</div>
                {selectedSegment.transition && <label>ความยาว {(selectedSegment.transitionDuration ?? .5).toFixed(1)} วิ<input type="range" disabled={busy} min={MIN_TRANSITION} max={selectedRoom} step={.1} value={Math.min(selectedSegment.transitionDuration ?? .5, selectedRoom)} onChange={event => setTransition(selectedSegment.transition, Number(event.target.value))} /></label>}
              </>}
            </>}
            <small className={styles.muted}>ไฟล์ต้นฉบับยาว {fmt(selectedAsset.duration)} · ใช้ช่วง {fmt(selectedSegment.end - selectedSegment.start)}{segmentSpeed(selectedSegment) !== 1 ? ` · บน timeline ${fmt(segmentLength(selectedSegment))}` : ""}</small>
            <div className={styles.row2}><button disabled={segments[0]?.id === selected} onClick={() => { const index = segments.findIndex(segment => segment.id === selected); const next = [...segments]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; commit(next); }}>← ย้ายก่อนหน้า</button><button disabled={segments[segments.length - 1]?.id === selected} onClick={() => { const index = segments.findIndex(segment => segment.id === selected); const next = [...segments]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; commit(next); }}>ย้ายถัดไป →</button></div>
            <button disabled={busy} onClick={remove}><Trash2 />ลบคลิปนี้</button>
          </> : selectedAudio ? <AudioAdjust clip={selectedAudio} asset={assets.find(asset => asset.id === selectedAudio.assetId)} total={total} busy={busy} effects={persistence.clipEffects} onChange={(field, value) => adjustAudio(field, value)} onDelete={remove} />
          : selectedImage ? <ImageAdjust layer={selectedImage} asset={assets.find(asset => asset.id === selectedImage.assetId)} total={total} busy={busy} onChange={(patch, key) => adjustImage(patch, key)} onDelete={remove} />
          : selectedText ? <TextAdjust layer={selectedText} transforms={persistence.capabilities?.textTransforms === true} total={total} busy={busy} effects={persistence.clipStyles} onChange={(field, value) => adjustText(field, value)} onStyle={styleText} onDelete={remove} />
          : <>
            <span className={styles.sectionLabel}>สัดส่วนวิดีโอ</span>
            <div className={styles.ratioGrid} role="group" aria-label="สัดส่วน">{RATIO_OPTIONS.map(option => <button key={option.value} aria-pressed={ratio === option.value} disabled={busy} onClick={() => { setRatio(option.value); setDirty(true); }}><span className={styles.ratioShape} data-ratio={option.value} /><b>{option.label}</b><small>{option.hint}</small></button>)}</div>
            <span className={styles.sectionLabel}>ภาพรวม</span>
            <dl className={styles.stats}><div><dt>ความยาว</dt><dd>{fmt(total)}</dd></div><div><dt>คลิปวิดีโอ</dt><dd>{segments.length}/{maxSegments}</dd></div><div><dt>เสียง</dt><dd>{audioClips.length} คลิป · {audioLanes.filter(lane => lane.length).length} เลเยอร์</dd></div><div><dt>ข้อความ</dt><dd>{textLayers.length} ชั้น · {textLanes.filter(lane => lane.length).length} เลเยอร์</dd></div>{project && <div><dt>ฉบับที่</dt><dd>{project.revision}</dd></div>}</dl>
            <p className={styles.hint}>คลิกคลิป เสียง หรือข้อความบน timeline เพื่อปรับแต่ง</p>
          </>}
        </div>
      </aside>
    </div>
    <section className={styles.timeline} data-delete-scope aria-label="Timeline" style={{ "--timeline-height": `${timelineHeight}px` } as CSSProperties}>
      <div className={styles.grip} onPointerDown={startResize} title="ลากเพื่อปรับความสูง" aria-hidden="true" />
      <div className={styles.timelineToolbar}>
        <button disabled={busy || !canSplit} title="แยกที่ตำแหน่งเล่น (Ctrl+B)" onClick={split}><Scissors /><span>แยกคลิป</span></button>
        <button disabled={busy || !selected} title="ลบ (Delete)" onClick={remove} aria-label="ลบ"><Trash2 /><span>ลบ</span></button>
        <span className={styles.divider} />
        <div className={styles.layerMenu} ref={layerMenuRef}>
          <button aria-haspopup="menu" aria-expanded={layerMenu} disabled={busy} onClick={() => setLayerMenu(value => !value)}><Layers /><span>เพิ่มเลเยอร์</span></button>
          {layerMenu && <div className={styles.menu} role="menu">
            <button role="menuitem" onClick={event => openLibrary("media", event.currentTarget)}><Film />วิดีโอ<small>จากคลังสื่อ</small></button>
            <button role="menuitem" onClick={event => openLibrary("audio", event.currentTarget)}><Music />เพลง / เสียง<small>วางเป็นเลเยอร์เสียง</small></button>
            <button role="menuitem" disabled={!persistence.tracksSupported} onClick={() => { setLayerMenu(false); addText(); }}><Type />ข้อความ<small>ที่ตำแหน่งเล่น {fmt(time)}</small></button>
            <button role="menuitem" disabled={!persistence.imagesSupported} onClick={event => openLibrary("image", event.currentTarget)}><ImageIcon />รูป / สติกเกอร์ / โลโก้<small>{persistence.imagesSupported ? "จากคลังรูปภาพ" : "รอ migration 028"}</small></button>
          </div>}
        </div>
        <button aria-pressed={snapping} title="ดูดติดขอบคลิปและตำแหน่งเล่นเวลาลาก" onClick={() => setSnapping(value => !value)}><Magnet /><span>Snap</span></button>
        <button aria-pressed={ripple} title="ลบคลิปวิดีโอแล้วเลื่อนเสียงและข้อความที่อยู่หลังคลิปตามมาด้วย" onClick={() => setRipple(value => !value)}><Layers /><span>ดึงชิด</span></button>
        <button className={styles.inspectorToggle} disabled={!selected} onClick={event => openInspector(event.currentTarget)}><SlidersHorizontal /><span>ปรับแต่ง</span></button>
        <span className={styles.spacer} />
        <div className={styles.zoom}><button className={styles.iconButton} aria-label="ซูมออก" onClick={() => setZoom(value => Math.max(8, value - 6))}><ZoomOut /></button><input type="range" aria-label="ซูม timeline" min={8} max={60} value={zoom} onChange={event => setZoom(Number(event.target.value))} /><button className={styles.iconButton} aria-label="ซูมเข้า" onClick={() => setZoom(value => Math.min(60, value + 6))}><ZoomIn /></button></div>
      </div>
      <div className={styles.timelineScroll}>
        <div className={styles.trackLabels}>
          <div className={styles.corner} />
          {[...imageLanes].reverse().map((_, index) => <div key={`i${index}`} data-kind="image"><ImageIcon />รูป {imageLanes.length - index}</div>)}
          {[...textLanes].reverse().map((_, index) => <div key={`t${index}`} data-kind="text"><Type />ข้อความ {textLanes.length - index}</div>)}
          <div data-kind="video"><Film />วิดีโอหลัก</div>
          {audioLanes.map((_, index) => <div key={`a${index}`} data-kind="audio"><Music />เสียง {index + 1}</div>)}
        </div>
        <div ref={lanesRef} className={styles.lanes} style={{ width: Math.max((laneEnd + 10) * zoom, 600), "--px": `${zoom}px` } as CSSProperties}>
          <div className={styles.ruler} onPointerDown={startScrub} onPointerMove={moveScrub} onPointerUp={endScrub} onPointerCancel={endScrub} onLostPointerCapture={endScrub}>{rulerTicks}</div>
          {[...imageLanes].reverse().map((lane, index) => <div key={`i${index}`} className={styles.track} data-kind="image" data-drop={dropLane === "image" || undefined} aria-label={`แทร็กรูป ${imageLanes.length - index}`} onDragOver={event => laneDragOver(event, "image")} onDragLeave={() => setDropLane(null)} onDrop={event => laneDrop(event, "image")}>{lane.map(renderImage)}{!lane.length && !loading && <button className={styles.lanePlaceholder} onClick={event => openLibrary("image", event.currentTarget)}><Plus />เพิ่มรูป / โลโก้</button>}</div>)}
          {[...textLanes].reverse().map((lane, index) => <div key={`t${index}`} className={styles.track} data-kind="text" aria-label={`แทร็กข้อความ ${textLanes.length - index}`}>{lane.map(renderText)}{!lane.length && !loading && <button className={styles.lanePlaceholder} disabled={busy || !persistence.tracksSupported} onClick={() => addText()}><Plus />เพิ่มข้อความ</button>}</div>)}
          {videoTrack}
          {audioLanes.map((lane, index) => <div key={`a${index}`} className={styles.track} data-kind="audio" data-drop={dropLane === "audio" || undefined} aria-label={`แทร็กเสียง ${index + 1}`} onDragOver={event => laneDragOver(event, "audio")} onDragLeave={() => setDropLane(null)} onDrop={event => laneDrop(event, "audio")}>{lane.map(renderAudio)}{!lane.length && !loading && <button className={styles.lanePlaceholder} onClick={event => openLibrary("audio", event.currentTarget)}><Plus />เพิ่มเพลงหรือเสียง</button>}</div>)}
          {snapGuide !== null && <div className={styles.snapGuide} style={{ left: snapGuide * zoom }} aria-hidden="true" />}
          <div ref={playheadRef} className={styles.playhead} style={{ left: time * zoom }} role="slider" tabIndex={total ? 0 : -1} aria-label="ตำแหน่งเล่น" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Number(time.toFixed(2))} aria-valuetext={fmt(time)} aria-disabled={!total} aria-orientation="horizontal" onPointerDown={startScrub} onPointerMove={moveScrub} onPointerUp={endScrub} onPointerCancel={endScrub} onLostPointerCapture={endScrub} onKeyDown={event => {
            if (!total || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            setPlaying(false);
            setTime(value => event.key === "Home" ? 0 : event.key === "End" ? total : Math.max(0, Math.min(total, value + (event.key === "ArrowRight" ? 1 : -1))));
          }} />
        </div>
      </div>
    </section>
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="ai-editor-export-title"><div className={styles.dialogHead}><h2 id="ai-editor-export-title">ส่งออก MP4</h2><button className={styles.iconButton} aria-label="ปิด" onClick={() => dialogRef.current?.close()}><X /></button></div><p className={styles.muted}>ความยาว {fmt(total)} · อัตราส่วน {ratio.replace("/", ":")} · ส่งออกจากฉบับที่บันทึกแล้ว</p><label>ความละเอียด<select value={resolution} onChange={event => setResolution(event.target.value as EditorResolution)} disabled={persistence.exporting}>{(persistence.capabilities?.resolutions ?? ["720p", "1080p"]).map(value => <option key={value}>{value}</option>)}</select></label>{textLayers.length > 0 && persistence.textOverlays === false && <p role="status" className={`${styles.alert} ${styles.warning}`}>ระบบส่งออกยังใส่ข้อความลงวิดีโอไม่ได้ ลบข้อความทั้งหมดเพื่อส่งออก หรือรอระบบพร้อม</p>}{(audioClips.length > 0 || textLayers.length > 0) && <p className={styles.muted}>รวมเสียง {audioClips.length} คลิป · ข้อความ {textLayers.length} ชั้น (ส่วนที่เกินความยาววิดีโอจะถูกตัด)</p>}<button className={styles.primary} disabled={!total || busy || uploadCount > 0 || persistence.exporting || persistence.conflict || persistence.capabilities?.available === false || (textLayers.length > 0 && persistence.textOverlays === false)} onClick={() => void persistence.startExport(resolution)}><Download />{persistence.exporting ? "กำลังเตรียมส่งออก…" : "เริ่มส่งออก"}</button>{persistence.error && <p role="alert" className={styles.uploadError}>{persistence.error}</p>}<div className={styles.exportList}>{persistence.exports.map(item => <div className={styles.exportItem} key={item.id}><b>{item.resolution} · ฉบับที่ {item.revision}</b><span role="status" className={`${styles.status} ${item.status === "completed" ? styles.success : item.status === "failed" ? styles.error : styles.warning}`}>{{ queued: "รอส่งออก", processing: "กำลังส่งออก", completed: "ส่งออกสำเร็จ", failed: "ส่งออกไม่สำเร็จ" }[item.status]}</span><small>{fmt(item.duration)} · {item.aspectRatio}</small>{item.failureMessage && <small className={styles.uploadError}>{item.failureMessage}</small>}{item.status === "completed" && <button onClick={() => void persistence.download(item.id)}><Download />ดาวน์โหลด MP4</button>}{item.status === "failed" && item.canRetry && <button onClick={() => void persistence.retryExport(item.id)}>ลองส่งออกอีกครั้ง</button>}</div>)}</div></dialog>
    {toast && <div className={styles.toast} role="status">{toast}</div>}
  </div>;
}
