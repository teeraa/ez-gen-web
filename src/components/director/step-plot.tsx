"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ImageIcon, LoaderCircle, RefreshCw } from "lucide-react";
import { active, statusLabel, type Capabilities, type Character, type Project, type Scene } from "@/lib/director-api";
import type { DirectorMutation } from "@/hooks/use-director-project";
import { Bar, CastChips, Counter, Stages, type StageState } from "./director-ui";
import d from "./director.module.css";
import st from "./studio.module.css";
export function StepPlot({ project: p, capabilities: cap, characters, mutate, saving, onBack, onGoBoard, onDirtyChange }: { project: Project; capabilities: Capabilities; characters: Character[]; mutate: DirectorMutation; saving: boolean; onBack: () => void; onGoBoard: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sceneDirty, setSceneDirty] = useState(false);
  const reportDirty = useCallback((dirty: boolean) => { setSceneDirty(dirty); onDirtyChange(dirty); }, [onDirtyChange]);
  const selectScene = (id: string) => { if (id === selectedId) return; if (sceneDirty && !window.confirm("ทิ้งการแก้ไขฉากที่ยังไม่บันทึกหรือไม่?")) return; setSelectedId(id); };
  const selected = p.scenes.find(s => s.id === selectedId);
  const generating = active(p.story.status);
  const boardBusy = active(p.storyboard.status);
  const anyWriting = p.scenes.some(s => s.status === "writing" || s.status === "pending");
  const image = cap.models.image.find(m => m.id === p.storyboard.imageModelId);
  const video = cap.models.video.find(m => m.id === p.storyboard.videoModelId);
  const run = (promise: Promise<unknown>) => { void promise.catch(() => {}); };
  const generate = () => { if (sceneDirty) return; const replace = p.scenes.some(s => s.shots.length > 0); if (replace && !window.confirm("สร้างสตอรี่บอร์ดใหม่ทั้งหมด? ภาพ shot เดิมจะถูกแทนที่")) return; run(mutate("/storyboard", "POST", { replace }, true)); };
  const stage = (i: number): StageState => { const at = p.story.phase === "analyzing" ? 0 : p.story.phase === "writing" ? 1 : 2; return p.story.status === "succeeded" ? "done" : i < at ? "done" : i === at ? "active" : "todo"; };
  return <div className={st.body}>
    <aside className={`${st.panel} ${st.left}`} aria-label="ตั้งค่าสตอรี่บอร์ด"><div className={st.panelHead}>เนื้อเรื่อง<small>ขั้นที่ 2 จาก 3</small></div><div className={st.scroll}>
      <div className={`${st.status} ${p.story.status === "succeeded" ? st.statusOk : ""}`} aria-live="polite"><div className={st.statusHead}>{generating ? <LoaderCircle className="spin" aria-hidden /> : <CheckCircle2 aria-hidden />}{generating ? p.story.phase === "analyzing" ? "กำลังวิเคราะห์ไอเดีย…" : p.story.phase === "reviewing" ? "กำลังตรวจความต่อเนื่อง…" : `กำลังเขียนฉาก ${p.story.completedScenes}/${p.story.totalScenes}` : `เนื้อเรื่อง · ${statusLabel(p.story.status)}`}</div>{generating && <><Bar value={p.story.completedScenes / Math.max(1, p.story.totalScenes) * 100} label="ความคืบหน้าการเขียนเนื้อเรื่อง" /><Stages items={[{ label: "วิเคราะห์ไอเดีย", state: stage(0) }, { label: `เขียนฉาก ${p.story.completedScenes}/${p.story.totalScenes}`, state: stage(1) }, { label: "ตรวจความต่อเนื่อง", state: stage(2) }]} />{p.story.estimatedSecondsRemaining !== null && <span className={st.muted}>เหลือประมาณ {p.story.estimatedSecondsRemaining} วินาที</span>}</>}{p.story.failureMessage && <p role="alert">{p.story.failureMessage}</p>}{p.story.status === "needs_attention" && <p>กรุณาติดต่อผู้ดูแลเพื่อตรวจสอบคำขอ</p>}</div>
      <div className={st.section}><label className={st.label} htmlFor="image-model">โมเดลสร้างภาพ</label><select id="image-model" className={st.select} value={p.storyboard.imageModelId} disabled={boardBusy || saving} onChange={e => run(mutate("/storyboard-settings", "PATCH", { imageModelId: e.target.value }))}>{cap.models.image.map(m => <option key={m.id} value={m.id}>{m.name} — {m.note}</option>)}</select>{image && <span className={st.muted}>{image.speedHint} · {image.pointsPerUnit} pt ต่อภาพ</span>}</div>
      <div className={st.section}><label className={st.label} htmlFor="video-model">โมเดลสร้างวิดีโอ</label><select id="video-model" className={st.select} value={p.storyboard.videoModelId} disabled={boardBusy || saving} onChange={e => run(mutate("/storyboard-settings", "PATCH", { videoModelId: e.target.value }))}>{!cap.models.video.length && <option value="">ยังไม่มีโมเดลวิดีโอ</option>}{cap.models.video.map(m => <option key={m.id} value={m.id}>{m.name} — {m.note}</option>)}</select>{video && <span className={st.muted}>{video.pointsPerUnit} pt ต่อ shot · วิดีโอจะเปิดในระยะถัดไป</span>}</div>
      <dl className={st.kv}><div><dt>ฉาก</dt><dd>{p.scenes.length}</dd></div><div><dt>Shot ที่จะสร้าง</dt><dd>{p.scenes.reduce((n, s) => n + s.shotCount, 0)}</dd></div><div><dt>อ้างอิงโทนภาพ</dt><dd>{p.cover?.status === "succeeded" && p.cover.source === "generated" && !p.idea.characterAssetIds.length ? "ภาพปกเรื่อง" : cap.styles.find(s => s.value === p.style)?.label ?? p.style}</dd></div><div><dt>วิดีโอ (ภายหลัง)</dt><dd>{p.estimates.video} pt</dd></div></dl>
    </div><div className={st.foot}><div className={st.cost}><span>ประมาณการสร้างสตอรี่บอร์ด</span><b>{p.estimates.storyboard} pt</b></div>{sceneDirty && <p role="status" className={st.note}>บันทึกการแก้ไขฉากก่อนสร้างสตอรี่บอร์ด</p>}<button type="button" className={st.go} disabled={sceneDirty || !cap.enabled || saving || generating || anyWriting || boardBusy || p.story.status !== "succeeded" || p.scenes.some(s => s.status !== "ready")} onClick={generate}><ImageIcon aria-hidden />{p.storyboard.status === "idle" ? "สร้างสตอรี่บอร์ด" : "สร้างสตอรี่บอร์ดใหม่"}</button><div className={st.row}><button type="button" className={st.ghost} disabled={saving} onClick={onBack}><ArrowLeft aria-hidden />แก้ไอเดีย</button>{p.storyboard.status !== "idle" && <button type="button" className={st.ghost} disabled={saving} onClick={onGoBoard}>ไปสตอรี่บอร์ด <ArrowRight aria-hidden /></button>}</div></div></aside>
    <section className={st.stage} aria-label="เนื้อเรื่อง"><div className={st.stageScroll} style={{ paddingTop: 20 }}><div className={st.script}><div className={st.logline}><small>เรื่องย่อ</small>{p.story.logline ? <p>{p.story.logline}</p> : generating ? <div className={d.skeleton} style={{ height: 40 }} /> : <p>ยังไม่มีเรื่องย่อ</p>}<CastChips ids={p.idea.characterAssetIds} characters={characters} /></div>{p.scenes.map(s => <button key={s.id} type="button" className={st.beat} aria-pressed={selectedId === s.id} aria-busy={s.status === "pending" || s.status === "writing"} onClick={() => selectScene(s.id)}><span className={st.beatNum}>{s.index}</span><span className={st.beatCard}>{s.status === "ready" ? <><b>{s.title}</b><p>{s.summary}</p><span className={st.beatMeta}><span className={`${st.pill} ${st.pillAccent}`}>{s.shotCount} shot</span>{s.mood && <span className={st.pill}>{s.mood}</span>}<CastChips ids={s.characterAssetIds} characters={characters} /></span></> : <span role="status" className={st.writing}>{s.status === "writing" && <LoaderCircle className="spin" aria-hidden />}{s.status === "failed" ? s.failureMessage ?? "เขียนฉากไม่สำเร็จ" : s.status === "writing" ? `กำลังเขียนฉากที่ ${s.index}…` : "รอคิว"}</span>}</span></button>)}</div></div></section>
    <aside className={`${st.panel} ${st.right}`} aria-label="แก้ไขฉาก"><div className={st.panelHead}>{selected ? `ฉากที่ ${selected.index}` : "แก้ไขฉาก"}<small>คลิกฉากเพื่อแก้ไข</small></div>{selected ? <SceneEditor key={selected.id} scene={selected} project={p} cap={cap} mutate={mutate} saving={saving} onDirtyChange={reportDirty} /> : <div className={st.emptyInspector}>เลือกฉากตรงกลางเพื่อแก้ไข</div>}</aside>
  </div>;
}
function SceneEditor({ scene: s, project: p, cap, mutate, saving, onDirtyChange }: { scene: Scene; project: Project; cap: Capabilities; mutate: DirectorMutation; saving: boolean; onDirtyChange: (dirty: boolean) => void }) {
  const [title, setTitle] = useState(s.title);
  const [summary, setSummary] = useState(s.summary);
  const [count, setCount] = useState(s.shotCount);
  const [changed, setChanged] = useState(false);
  const editVersion = useRef(0);
  useEffect(() => { onDirtyChange(changed); }, [changed, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const markChanged = () => { editVersion.current += 1; setChanged(true); };
  const saveScene = () => {
    const atVersion = editVersion.current;
    run(mutate(`/scenes/${s.id}`, "PATCH", { title, summary, shotCount: count }).then(() => { if (editVersion.current === atVersion) setChanged(false); }));
  };
  const blocked = s.status !== "ready" || active(p.storyboard.status);
  const run = (promise: Promise<unknown>) => { void promise.catch(() => {}); };
  const rewrite = () => { if (changed && !window.confirm("ทิ้งการแก้ไขที่ยังไม่บันทึก แล้วให้ AI เขียนฉากนี้ใหม่หรือไม่?")) return; run(mutate(`/scenes/${s.id}/rewrite`, "POST", {}, true).then(() => setChanged(false))); };
  return <div className={st.scroll}>
    {!changed && s.status === "ready" && <p className={st.muted}>{s.title}</p>}
    <div className={st.section}><label className={st.label} htmlFor="scene-title">ชื่อฉาก</label><input id="scene-title" className={st.select} value={changed ? title : s.title} disabled={blocked} maxLength={cap.limits.nameMaxLength} onChange={e => { if (!changed) { setSummary(s.summary); setCount(s.shotCount); } setTitle(e.target.value); markChanged(); }} /></div>
    <div className={st.section}><label className={st.label} htmlFor="scene-summary">เนื้อเรื่อง</label><textarea id="scene-summary" className={st.textarea} style={{ minHeight: 160 }} value={changed ? summary : s.summary} disabled={blocked} maxLength={cap.limits.sceneSummaryMaxLength} onChange={e => { if (!changed) { setTitle(s.title); setCount(s.shotCount); } setSummary(e.target.value); markChanged(); }} /></div>
    <div className={st.section}><span className={st.label}>จำนวน shot</span><Counter label="จำนวน shot" value={changed ? count : s.shotCount} min={cap.limits.minShotsPerScene} max={cap.limits.maxShotsPerScene} disabled={blocked} onChange={value => { if (!changed) { setTitle(s.title); setSummary(s.summary); } setCount(value); markChanged(); }} /><span className={st.muted}>ใช้กับการสร้างสตอรี่บอร์ดครั้งถัดไป</span></div>
    <button type="button" className={st.go} disabled={blocked || saving || !changed || !title.trim() || !summary.trim()} onClick={saveScene}>บันทึกฉาก</button>
    <button type="button" className={st.soft} disabled={!cap.enabled || saving || active(p.storyboard.status) || p.scenes.some(scene => scene.status === "writing") || !(s.status === "ready" || (s.status === "failed" && s.canRetry))} onClick={rewrite}><RefreshCw aria-hidden />เขียนฉากนี้ใหม่ · {Math.ceil(p.estimates.story / Math.max(1, p.scenes.length))} pt</button>
    {s.failureMessage && <p role="alert">{s.failureMessage}</p>}{s.pointsRefunded > 0 && <p className={st.muted}>คืนพอยต์แล้ว {s.pointsRefunded} pt</p>}
  </div>;
}
