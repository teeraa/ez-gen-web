"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Film, ImageIcon, LayoutGrid, LoaderCircle, Monitor, Pause, Play, Plus, RefreshCw, ScrollText, Trash2, X } from "lucide-react";
import { active, statusLabel, type Capabilities, type Character, type Project, type Shot } from "@/lib/director-api";
import type { DirectorMutation } from "@/hooks/use-director-project";
import { Bar, CastChips } from "./director-ui";
import { ShotArt, ShotVideo } from "./shot-art";
import { CreateModal } from "./director-hub";
import d from "./director.module.css";
import st from "./studio.module.css";
type Flat = { shot: Shot; sceneIndex: number; sceneId: string; sceneTitle: string };
const videoReady = (shot: Shot) => shot.video?.status === "succeeded" && !!shot.video.url;
const needsVideo = (shot: Shot) => !shot.video || shot.video.status !== "succeeded" || shot.video.stale;
function videoBlocker(p: Project, cap: Capabilities): string | null {
  if (!cap.videoEnabled) return "ยังไม่ได้ตั้งค่าบริการวิดีโอ กรุณาติดต่อผู้ดูแลระบบ";
  const model = cap.models.video.find(m => m.id === p.storyboard.videoModelId);
  if (!model) return "ยังไม่ได้เลือกโมเดลวิดีโอ เลือกได้ในขั้นเนื้อเรื่อง";
  if (model.aspectRatios && !model.aspectRatios.includes(p.aspectRatio)) return `โมเดล ${model.name} ไม่รองรับสัดส่วน ${p.aspectRatio} เลือกโมเดลอื่นในขั้นเนื้อเรื่อง`;
  return null;
}
function Thumb({ shot, onMediaError }: { shot: Shot; onMediaError: () => void }) {
  const busy = active(shot.image.status) || shot.image.status === "pending";
  return <><ShotArt url={shot.image.url} label={shot.description} onError={onMediaError} />{busy && <><span className={st.miniState}>{active(shot.image.status) ? `${shot.image.progress}%` : <Clock3 aria-hidden />}</span><span className={st.thumbBar}><i style={{ width: `${shot.image.progress}%` }} /></span></>}{["failed", "needs_attention"].includes(shot.image.status) && <span className={st.miniState}>{statusLabel(shot.image.status)}</span>}{!busy && active(shot.video?.status) && <span className={st.miniState}><Film aria-hidden />{shot.video?.progress}%</span>}{!busy && videoReady(shot) && !shot.video?.stale && <span className={st.miniState} aria-label="มีวิดีโอแล้ว"><Film aria-hidden /></span>}</>;
}
export function StepBoard({ project: p, capabilities: cap, characters, mutate, saving, onBack, onMediaError }: { project: Project; capabilities: Capabilities; characters: Character[]; mutate: DirectorMutation; saving: boolean; onBack: () => void; onMediaError: () => void }) {
  const [view, setView] = useState<"shot" | "grid" | "read">("shot");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [draftMode, setDraftMode] = useState(false);
  const flat: Flat[] = p.scenes.flatMap(s => s.shots.map(shot => ({ shot, sceneIndex: s.index, sceneId: s.id, sceneTitle: s.title })));
  const at = Math.max(0, flat.findIndex(f => f.shot.id === selectedId));
  const cur = flat[at];
  const playable = flat.filter(f => f.shot.image.status === "succeeded" && f.shot.image.url);
  const total = p.storyboard.totalShots;
  const done = p.storyboard.completedImages;
  const partial = flat.reduce((n, f) => n + (f.shot.image.status === "processing" ? f.shot.image.progress / 100 : 0), 0);
  const busy = active(p.storyboard.status) || flat.some(f => active(f.shot.image.status));
  const [a, b] = p.aspectRatio.split(":").map(Number);
  const videoModel = cap.models.video.find(m => m.id === p.storyboard.videoModelId);
  const videoDone = flat.filter(f => videoReady(f.shot) && !f.shot.video?.stale).length;
  const videoBusy = flat.some(f => active(f.shot.video?.status));
  const videoNeed = flat.filter(f => needsVideo(f.shot)).length;
  const imagesReady = flat.length > 0 && flat.every(f => f.shot.image.status === "succeeded");
  const blocker = videoBlocker(p, cap) ?? (!imagesReady && !busy ? "ภาพสตอรี่บอร์ดต้องสำเร็จครบทุก shot ก่อนสร้างวิดีโอ" : null);
  const draftAvailable = !!videoModel?.supportsDraft;
  const useDraft = draftAvailable && draftMode;
  const perShot = useDraft ? videoModel?.draftPointsPerUnit ?? 0 : videoModel?.pointsPerUnit ?? 0;
  const finalizable = flat.filter(f => f.shot.video?.canFinalize).length;
  const videoLabel = videoBusy ? `กำลังสร้างวิดีโอ ${videoDone}/${total}` : videoNeed === total ? "สร้างวิดีโอทั้งเรื่อง" : videoNeed ? `สร้างวิดีโอที่เหลือ ${videoNeed} shot` : "วิดีโอครบทุก shot แล้ว";
  const run = (promise: Promise<unknown>) => { void promise.catch(() => {}); };
  const step = (delta: number) => { if (flat.length) setSelectedId(flat[(at + delta + flat.length) % flat.length].shot.id); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { const target = event.target; if (target instanceof HTMLElement && (target.closest("input,textarea,select,button,[role=dialog]") || target.isContentEditable)) return; if (!flat.length) return; if (event.key === "ArrowRight") setSelectedId(flat[(at + 1) % flat.length].shot.id); if (event.key === "ArrowLeft") setSelectedId(flat[(at - 1 + flat.length) % flat.length].shot.id); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [flat, at]);
  const addShot = (sceneId: string, afterShotId?: string) => run(mutate(`/scenes/${sceneId}/shots`, "POST", afterShotId ? { afterShotId } : {}, true));
  return <div className={st.body}>
    <aside className={`${st.panel} ${st.left}`} aria-label="ฉากและ shot"><div className={st.panelHead}>สตอรี่บอร์ด<small>{p.scenes.length} ฉาก · {total} shot</small></div><div className={st.scroll} style={{ gap: 14 }}><div className={`${st.status} ${p.storyboard.status === "succeeded" ? st.statusOk : ""}`} aria-live="polite"><div className={st.statusHead}>{busy ? <LoaderCircle className="spin" aria-hidden /> : <CheckCircle2 aria-hidden />}{busy ? `กำลังสร้างภาพ ${done}/${total}` : `สตอรี่บอร์ด · ${statusLabel(p.storyboard.status)}`}</div><Bar value={(done + partial) / Math.max(1, total) * 100} label="ความคืบหน้าการสร้างสตอรี่บอร์ด" /><span className={st.muted}>{done}/{total} ภาพ{busy ? ` · ${Math.round((done + partial) / Math.max(1, total) * 100)}%` : ""} · {cap.models.image.find(m => m.id === p.storyboard.imageModelId)?.name}</span>{p.storyboard.estimatedSecondsRemaining !== null && <span className={st.muted}>เหลือประมาณ {p.storyboard.estimatedSecondsRemaining} วินาที</span>}{p.storyboard.status === "needs_attention" && <p>มีภาพที่ยังไม่สำเร็จ เลือก shot เพื่อตรวจสอบหรือลองใหม่</p>}</div>
      {p.scenes.map(s => <div key={s.id} className={st.navScene}><div className={st.navSceneHead}><span className={st.navSceneNum}>{s.index}</span><span title={s.title}>{s.title}</span></div>{s.shots.map(shot => <button key={shot.id} type="button" className={st.navShot} aria-current={cur?.shot.id === shot.id ? "true" : undefined} onClick={() => setSelectedId(shot.id)}><span className={st.mini} style={{ aspectRatio: `${a} / ${b}`, width: a >= b ? 64 : Math.round(40 * a / b), justifySelf: "center" }}><Thumb shot={shot} onMediaError={onMediaError} /></span><span><b>Shot {shot.index} · {shot.camera}</b><span>{shot.description || statusLabel(shot.image.status)}</span></span></button>)}</div>)}
    </div><div className={st.foot}><div className={st.cost}><span>ประมาณการวิดีโอ {videoNeed} shot</span><b>{videoNeed * perShot} pt</b></div>{draftAvailable && <label className={st.muted} style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={draftMode} disabled={videoBusy || saving} onChange={e => setDraftMode(e.target.checked)} />โหมด draft 480p · พรีวิวเร็ว {videoModel?.draftPointsPerUnit} pt/shot</label>}<button type="button" className={st.go} disabled={!!blocker || saving || busy || videoBusy || !videoNeed} onClick={() => run(mutate("/video", "POST", useDraft ? { draft: true } : {}, true))}>{videoBusy ? <LoaderCircle className="spin" aria-hidden /> : <Film aria-hidden />}{useDraft && !videoBusy ? `${videoLabel} (draft)` : videoLabel}</button>{finalizable > 0 && <button type="button" className={st.soft} disabled={!!blocker || saving || videoBusy} onClick={() => run(mutate("/video", "POST", { finalize: true }, true))}><Film aria-hidden />ทำฉบับเต็ม 1080p จาก draft {finalizable} shot · {finalizable * (videoModel?.pointsPerUnit ?? 0)} pt</button>}{videoBusy && <Bar value={videoDone / Math.max(1, total) * 100} label="ความคืบหน้าการสร้างวิดีโอ" />}<span className={st.muted} role="status">{blocker ?? `${videoDone}/${total} วิดีโอ · ${videoModel?.name ?? ""} · ${videoModel?.speedHint ?? ""}`}</span><button type="button" className={st.ghost} disabled={saving} onClick={onBack}><ChevronLeft aria-hidden />แก้เนื้อเรื่อง</button></div></aside>
    <section className={st.stage} aria-label="พรีวิว"><div className={st.stageBar}><div className={st.stageTabs} role="group" aria-label="มุมมอง">{([{ id: "shot", label: "ช็อต", icon: Monitor }, { id: "grid", label: "ภาพรวม", icon: LayoutGrid }, { id: "read", label: "อ่านทั้งเรื่อง", icon: ScrollText }] as const).map(item => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)}><item.icon aria-hidden />{item.label}</button>)}</div><span style={{ flex: 1 }} /><button type="button" className={st.soft} disabled={!playable.length} onClick={() => setPlaying(true)}><Play aria-hidden />เล่นสไลด์</button></div>
      {view === "shot" && cur && <div className={st.viewer}><div className={st.fit}><div className={st.viewerFrame} style={{ aspectRatio: `${a} / ${b}`, width: `min(100cqw, calc(100cqh * ${a} / ${b}))` }}><div className={st.viewerArt}>{videoReady(cur.shot) ? <ShotVideo url={cur.shot.video?.url} poster={cur.shot.image.url} label={`วิดีโอ ฉาก ${cur.sceneIndex} Shot ${cur.shot.index}`} onError={onMediaError} /> : <ShotArt url={cur.shot.image.url} label={cur.shot.description} onError={onMediaError} />}</div>{(active(cur.shot.image.status) || cur.shot.image.status === "pending") && <div className={st.viewerState} role="status">{cur.shot.image.status === "processing" ? <><b>{cur.shot.image.progress}%</b><span>กำลังสร้างภาพ · ประมาณการจากเวลาที่ใช้</span></> : <><Clock3 aria-hidden /><span>{cur.shot.image.status === "pending" ? "รอวางแผน shot" : "รอคิวสร้างภาพ"}</span></>}<Bar value={cur.shot.image.progress} label="ความคืบหน้าการสร้างภาพ" /></div>}{!active(cur.shot.image.status) && cur.shot.image.status !== "pending" && active(cur.shot.video?.status) && <div className={st.viewerState} role="status">{cur.shot.video?.status === "queued" ? <><Clock3 aria-hidden /><span>รอคิวสร้างวิดีโอ</span></> : <><b>{cur.shot.video?.progress ?? 0}%</b><span>กำลังสร้างวิดีโอ</span></>}<Bar value={cur.shot.video?.progress ?? 0} label="ความคืบหน้าการสร้างวิดีโอ" /></div>}<div className={st.viewerBadges}><span className={st.onImage}>ฉาก {cur.sceneIndex} · Shot {cur.shot.index}</span><span className={st.onImage}>{cur.shot.camera}</span>{cur.shot.image.stale && <span className={st.onImage}>คำบรรยายเปลี่ยนแล้ว · ควรสร้างภาพใหม่</span>}{cur.shot.video?.stale && <span className={st.onImage}>วิดีโอเป็นฉบับก่อนแก้</span>}{videoReady(cur.shot) && cur.shot.video?.draft && <span className={st.onImage}>Draft 480p</span>}{videoReady(cur.shot) && cur.shot.video?.usesLastFrame && <span className={st.onImage}>ต่อเนื่องถึง shot ถัดไป</span>}</div><button type="button" className={st.viewerNav} style={{ left: 10 }} aria-label="shot ก่อนหน้า" onClick={() => step(-1)}><ChevronLeft aria-hidden /></button><button type="button" className={st.viewerNav} style={{ right: 10 }} aria-label="shot ถัดไป" onClick={() => step(1)}><ChevronRight aria-hidden /></button></div></div><div className={st.caption}><small>{cur.sceneTitle}</small>{cur.shot.description}</div></div>}
      {view === "shot" && !cur && <div className={st.emptyInspector} role="status">ยังไม่มี shot</div>}
      {view === "grid" && <div className={st.stageScroll}>{p.scenes.map(s => <div key={s.id} className={st.gridScene}><h3><span className={st.navSceneNum}>{s.index}</span>{s.title}</h3><div className={st.gridShots} style={a < b ? { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" } : undefined}>{s.shots.map(shot => <button key={shot.id} type="button" className={st.gridShot} aria-label={`เปิดฉาก ${s.index} Shot ${shot.index}`} onClick={() => { setSelectedId(shot.id); setView("shot"); }}><div style={{ aspectRatio: `${a} / ${b}` }}><Thumb shot={shot} onMediaError={onMediaError} /><span className={st.viewerBadges}><span className={st.onImage}>Shot {shot.index}</span></span></div><p>{shot.description}</p></button>)}</div></div>)}</div>}
      {view === "read" && <div className={st.stageScroll}><div className={st.read}>{p.scenes.map(s => <section key={s.id}><header><small>ฉากที่ {s.index}</small><h2>{s.title}</h2><p>{s.summary}</p></header>{s.shots.map(shot => <div key={shot.id} className={st.readShot}><div style={{ aspectRatio: `${a} / ${b}` }}><Thumb shot={shot} onMediaError={onMediaError} /></div><div><span className={st.pill}>Shot {shot.index} · {shot.camera}</span><p>{shot.description}</p></div></div>)}</section>)}</div></div>}
      {view === "shot" && <div className={st.strip} aria-label="ไทม์ไลน์ shot">{p.scenes.map(s => <div key={s.id} className={st.stripScene}><span>ฉาก {s.index}</span><div className={st.stripShots}>{s.shots.map(shot => <button key={shot.id} type="button" className={st.thumb} style={{ width: Math.round(70 * a / b) }} aria-current={cur?.shot.id === shot.id ? "true" : undefined} aria-label={`ฉาก ${s.index} shot ${shot.index}`} onClick={() => setSelectedId(shot.id)}><Thumb shot={shot} onMediaError={onMediaError} /><em>{shot.index}</em></button>)}<button type="button" className={st.addThumb} aria-label={`เพิ่ม shot ในฉาก ${s.index}`} disabled={saving || !cap.enabled || s.shots.length >= cap.limits.maxShotsPerSceneAfterEdit || flat.length >= cap.limits.maxTotalShots} onClick={() => addShot(s.id)}><Plus aria-hidden /></button></div></div>)}</div>}
    </section>
    <aside className={`${st.panel} ${st.right}`} aria-label="รายละเอียด shot"><div className={st.panelHead}>{cur ? `ฉาก ${cur.sceneIndex} · Shot ${cur.shot.index}` : "รายละเอียด shot"}{cur && <small>{statusLabel(cur.shot.image.status)}</small>}</div>{cur ? <ShotEditor key={cur.shot.id} item={cur} project={p} cap={cap} characters={characters} mutate={mutate} saving={saving} draftVideo={useDraft} onAdd={() => addShot(cur.sceneId, cur.shot.id)} /> : <div className={st.emptyInspector}>ไม่มี shot</div>}</aside>
    {playing && playable.length > 0 && <Player items={playable} project={p} onClose={() => setPlaying(false)} onMediaError={onMediaError} />}
  </div>;
}
function ShotEditor({ item: f, project: p, cap, characters, mutate, saving, draftVideo, onAdd }: { item: Flat; project: Project; cap: Capabilities; characters: Character[]; mutate: DirectorMutation; saving: boolean; draftVideo: boolean; onAdd: () => void }) {
  const { shot } = f;
  const [draft, setDraft] = useState<{ description: string; camera: string } | null>(null);
  const draftRef = useRef(draft);
  const version = useRef(0);
  const inflight = useRef<{ signature: string; promise: Promise<unknown> } | null>(null);
  const save = useCallback(async () => {
    const input = draftRef.current;
    if (!input) return;
    const signature = JSON.stringify(input);
    if (inflight.current?.signature === signature) { await inflight.current.promise; return; }
    const atVersion = version.current;
    const operation = mutate(`/shots/${shot.id}`, "PATCH", input);
    inflight.current = { signature, promise: operation };
    try { await operation; if (version.current === atVersion) { draftRef.current = null; setDraft(null); } }
    finally { if (inflight.current?.signature === signature) inflight.current = null; }
  }, [mutate, shot.id]);
  useEffect(() => { if (!draft) return; const timer = setTimeout(() => { void save().catch(() => {}); }, 600); return () => clearTimeout(timer); }, [draft, save]);
  const edit = (patch: Partial<{ description: string; camera: string }>, immediate = false) => { const next = { ...(draftRef.current ?? { description: shot.description, camera: shot.camera }), ...patch }; version.current += 1; draftRef.current = next; setDraft(next); if (immediate) void save().catch(() => {}); };
  const run = (action: () => Promise<unknown>) => { void save().then(action).catch(() => {}); };
  const imageBusy = active(shot.image.status) || shot.image.status === "pending";
  const canGenerate = cap.enabled && !saving && !imageBusy && !(shot.image.status === "needs_attention" && !shot.image.canRetry);
  const video = shot.video;
  const videoBusy = active(video?.status);
  const videoModel = cap.models.video.find(m => m.id === p.storyboard.videoModelId);
  const videoPoints = (draftVideo ? videoModel?.draftPointsPerUnit : videoModel?.pointsPerUnit) ?? 0;
  const canVideo = !videoBlocker(p, cap) && !saving && !imageBusy && !videoBusy && shot.image.status === "succeeded" && !(video?.status === "needs_attention" && !video.canRetry);
  const remove = () => { if (window.confirm(`ลบ Shot ${shot.index} ของฉากที่ ${f.sceneIndex}?`)) run(() => mutate(`/shots/${shot.id}`, "DELETE")); };
  return <div className={st.scroll}>
    <div className={st.section}><label className={st.label} htmlFor="shot-desc">คำบรรยายภาพ<span>{(draft?.description ?? shot.description).length}/{cap.limits.shotDescriptionMaxLength}</span></label><textarea id="shot-desc" className={st.textarea} style={{ minHeight: 120 }} maxLength={cap.limits.shotDescriptionMaxLength} value={draft?.description ?? shot.description} onChange={e => edit({ description: e.target.value })} onBlur={() => { void save().catch(() => {}); }} /><span className={st.muted}>{draft ? "มีการแก้ไขที่ยังไม่บันทึก" : "บันทึกคำบรรยายแล้ว"}</span>{draft && <button type="button" className={st.soft} onClick={() => { void save().catch(() => {}); }}>บันทึกคำบรรยายอีกครั้ง</button>}</div>
    <div className={st.section}><span className={st.label}>มุมกล้อง</span><div className={st.chips}>{cap.cameras.map(camera => <button key={camera} type="button" aria-pressed={(draft?.camera ?? shot.camera) === camera} onClick={() => edit({ camera }, true)}>{camera}</button>)}</div></div>
    <div className={st.section}><span className={st.label}>ตัวละคร</span>{shot.characterAssetIds.length ? <CastChips ids={shot.characterAssetIds} characters={characters} /> : <span className={st.muted}>ไม่มี</span>}</div>
    {shot.image.stale && <p className={st.note}>คำบรรยายหรือมุมกล้องเปลี่ยนแล้ว ภาพนี้ยังเป็นฉบับเดิม</p>}
    {shot.image.failureMessage && <p role="alert">{shot.image.failureMessage}{!shot.image.canRetry && shot.image.status === "needs_attention" ? " · กรุณาติดต่อผู้ดูแลเพื่อตรวจสอบคำขอ" : ""}</p>}
    {shot.pointsRefunded > 0 && <p className={st.muted}>คืนพอยต์แล้ว {shot.pointsRefunded} pt</p>}
    {video?.canFinalize && <button type="button" className={st.soft} disabled={saving || videoBusy || !!videoBlocker(p, cap)} onClick={() => run(() => mutate("/video", "POST", { shotIds: [shot.id], finalize: true }, true))}><Film aria-hidden />ทำฉบับเต็ม 1080p จาก draft · {videoModel?.pointsPerUnit ?? 0} pt</button>}
    {video?.stale && <p className={st.note}>ภาพหรือคำบรรยายเปลี่ยนหลังสร้างวิดีโอ วิดีโอนี้ยังเป็นฉบับเดิม</p>}
    {video?.failureMessage && <p role="alert">วิดีโอ: {video.failureMessage}{!video.canRetry && video.status === "needs_attention" ? " · กรุณาติดต่อผู้ดูแลเพื่อตรวจสอบคำขอ" : ""}</p>}
    {!!video?.pointsRefunded && <p className={st.muted}>คืนพอยต์วิดีโอแล้ว {video.pointsRefunded} pt</p>}
    <button type="button" className={st.soft} disabled={!canGenerate} onClick={() => run(() => mutate(`/shots/${shot.id}/regenerate`, "POST", {}, true))}><RefreshCw aria-hidden />สร้างภาพใหม่จากคำบรรยายนี้ · {cap.models.image.find(m => m.id === p.storyboard.imageModelId)?.pointsPerUnit ?? p.estimates.cover} pt</button>
    {shot.image.canRetry && ["failed", "needs_attention"].includes(shot.image.status) && <button type="button" className={st.soft} disabled={!canGenerate} onClick={() => run(() => mutate(`/shots/${shot.id}/retry`, "POST", {}, true))}>ลองสร้างภาพอีกครั้ง</button>}
    <div className={st.actions}><button type="button" className={st.soft} disabled={saving || shot.image.status !== "succeeded"} onClick={() => run(() => mutate("/cover", "PUT", { shotId: shot.id }))}><ImageIcon aria-hidden />ใช้ภาพนี้เป็นปก</button><button type="button" className={st.soft} disabled={!canVideo} title={videoBlocker(p, cap) ?? "สร้างวิดีโอจากภาพของ shot นี้"} onClick={() => run(() => mutate("/video", "POST", draftVideo ? { shotIds: [shot.id], draft: true } : { shotIds: [shot.id] }, true))}>{videoBusy ? <LoaderCircle className="spin" aria-hidden /> : <Film aria-hidden />}{videoBusy ? `วิดีโอ ${video?.progress ?? 0}%` : video?.status === "succeeded" ? `วิดีโอใหม่ · ${videoPoints} pt` : `สร้างวิดีโอ · ${videoPoints} pt`}</button><button type="button" className={st.soft} disabled={saving || !cap.enabled || p.scenes.find(s => s.id === f.sceneId)?.shots.length === cap.limits.maxShotsPerSceneAfterEdit || p.scenes.reduce((n, s) => n + s.shots.length, 0) >= cap.limits.maxTotalShots} onClick={() => run(async () => onAdd())}><Plus aria-hidden />เพิ่ม shot</button><button type="button" className={`${st.soft} ${st.danger}`} disabled={saving || (p.scenes.find(s => s.id === f.sceneId)?.shots.length ?? 0) <= 1} onClick={remove}><Trash2 aria-hidden />ลบ shot</button></div>
    <div className={st.section}><span className={st.label}>ฉากที่ {f.sceneIndex}</span><b>{f.sceneTitle}</b><span className={st.muted}>{p.scenes.find(s => s.id === f.sceneId)?.summary}</span></div>
  </div>;
}
function Player({ items, project: p, onClose, onMediaError }: { items: Flat[]; project: Project; onClose: () => void; onMediaError: () => void }) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const next = useCallback(() => setIndex(i => (i + 1) % items.length), [items.length]);
  const prev = useCallback(() => setIndex(i => (i - 1 + items.length) % items.length), [items.length]);
  useEffect(() => { if (!auto) return; const timer = setInterval(next, 3500); return () => clearInterval(timer); }, [auto, next]);
  const item = items[Math.min(index, items.length - 1)];
  return <CreateModal onClose={onClose}><div className={d.player} role="dialog" aria-modal="true" aria-label="เล่นสตอรี่บอร์ด"><div className={d.playerTop}><span>{p.name} · ฉาก {item.sceneIndex} Shot {item.shot.index} ({index + 1}/{items.length})</span><button type="button" onClick={onClose} aria-label="ปิด"><X aria-hidden /></button></div><div className={d.playerStage}><div className={d.playerFrame} style={{ position: "relative", aspectRatio: p.aspectRatio.replace(":", " / "), width: "min(100%, 1100px)", maxHeight: "65dvh" }}><ShotArt url={item.shot.image.url} label={item.shot.description} onError={onMediaError} /></div></div><div className={d.playerCaption}><small>{item.sceneTitle} · {item.shot.camera}</small>{item.shot.description}</div><div className={d.playerNav}><button type="button" onClick={() => { setAuto(false); prev(); }} aria-label="ก่อนหน้า"><ChevronLeft aria-hidden /></button><button type="button" onClick={() => setAuto(!auto)}>{auto ? <><Pause aria-hidden />หยุด</> : <><Play aria-hidden />เล่นอัตโนมัติ</>}</button><button type="button" onClick={() => { setAuto(false); next(); }} aria-label="ถัดไป"><ChevronRight aria-hidden /></button></div></div></CreateModal>;
}
