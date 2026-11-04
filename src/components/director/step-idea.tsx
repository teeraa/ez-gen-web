"use client";
import { useRef, useState } from "react";
import { ArrowRight, Check, Circle, ImageIcon, Lightbulb, LoaderCircle, Plus, Sparkles, Users, Wand2, X } from "lucide-react";
import Link from "next/link";
import w from "@/components/workbench/workbench.module.css";
import { active, errorMessage, type Capabilities, type Character, type Idea, type Project } from "@/lib/director-api";
import { creativeApi, CreativeApiError } from "@/lib/creative-api";
import { jobsApi } from "@/lib/api";
import { useRefreshPolling } from "@/hooks/use-refresh-polling";
import type { JobDTO } from "@/types/api";
import { definiteRejection, finishSubmission, pendingSubmission, prepareSubmission } from "@/lib/director-submission";
import type { DirectorMutation } from "@/hooks/use-director-project";
import { Bar, Counter } from "./director-ui";
import { ShotArt } from "./shot-art";
import { CreateModal } from "./director-hub";
import d from "./director.module.css";
import st from "./studio.module.css";

const EXAMPLES = ["อัศวินผู้โดดเดี่ยวต้องร่วมมือกับจอมเวทเพื่อปกป้องหมู่บ้านจากความมืด", "เด็กชายพบแมวพูดได้ในร้านหนังสือเก่า แล้วพากันออกตามหาหนังสือเล่มสุดท้าย", "โฆษณากาแฟเย็นสำหรับคนทำงาน ตั้งแต่เช้าที่ง่วงจนถึงเย็นที่สดชื่น"];
export function StepIdea({ project, capabilities: cap, characters, changeIdea, mutate, saving, onCharacter, onGenerate, onGoPlot, onMediaError, castError, hasMoreCast, onLoadCast, onRetryCast, onCastMediaError }: {
  project: Project; capabilities: Capabilities; characters: Character[]; changeIdea: (patch: Partial<Idea>, immediate?: boolean) => void;
  mutate: DirectorMutation; saving: boolean; onCharacter: (c: Character) => void; onGenerate: () => void; onGoPlot: () => void; onMediaError: () => void;
  castError: string | null; hasMoreCast: boolean; onLoadCast: () => void; onRetryCast: () => void; onCastMediaError: () => void;
}) {
  const { idea } = project;
  const [creating, setCreating] = useState(false);
  const locked = active(project.story.status);
  const set = (patch: Partial<Idea>, immediate = true) => changeIdea(patch, immediate);
  const cast = idea.characterAssetIds.map(id => characters.find(c => c.id === id)).filter((c): c is Character => !!c);
  const coverBusy = active(project.cover?.status);
  const coverReady = project.cover?.status === "succeeded";
  const style = cap.styles.find(s => s.value === project.style);
  const storyModel = cap.models.story.find(m => m.id === idea.storyModelId);
  const checks = [{ label: "ไอเดียอย่างน้อย 10 ตัวอักษร", done: idea.prompt.trim().length >= 10 }, { label: "รูปแบบเนื้อเรื่อง", done: !!idea.genre }, { label: "อารมณ์อย่างน้อย 1 แบบ", done: idea.moods.length > 0 }];
  const ready = checks.every(c => c.done);
  const run = (promise: Promise<unknown>) => { void promise.catch(() => {}); };
  const generate = () => { if (project.story.status !== "idle" && !window.confirm("เขียนเนื้อเรื่องใหม่ทั้งหมด? เนื้อเรื่องและสตอรี่บอร์ดเดิมจะถูกแทนที่")) return; onGenerate(); };
  return <div className={st.body}>
    <aside className={`${st.panel} ${st.left}`} aria-label="ตั้งค่าไอเดีย">
      <div className={st.panelHead}>ไอเดียของเรื่อง<small>ขั้นที่ 1 จาก 3</small></div>
      <div className={st.scroll}>
        <div className={st.section}><label className={st.label} htmlFor="idea-prompt">ไอเดีย<span>{idea.prompt.length}/{cap.limits.ideaMaxLength}</span></label><textarea id="idea-prompt" className={st.textarea} disabled={locked} value={idea.prompt} maxLength={cap.limits.ideaMaxLength} onChange={e => set({ prompt: e.target.value }, false)} placeholder="ใคร ที่ไหน เกิดอะไรขึ้น จบอย่างไร" /><div className={st.ideaChips}>{EXAMPLES.map(e => <button key={e} type="button" disabled={locked} title={e} onClick={() => set({ prompt: e })}><Lightbulb aria-hidden />{e.slice(0, 22)}…</button>)}</div></div>
        <div className={st.section} role="radiogroup" aria-labelledby="idea-genre"><span className={st.label} id="idea-genre">รูปแบบเนื้อเรื่อง</span><div className={st.grid2}>{cap.genres.map(g => <button key={g.value} type="button" role="radio" aria-checked={idea.genre === g.value} className={st.tile} disabled={locked} onClick={() => set({ genre: g.value })}>{g.label}<small>{g.hint}</small></button>)}</div></div>
        <div className={st.section}><span className={st.label}>ความรู้สึกและอารมณ์<span>{idea.moods.length}/{cap.limits.maxMoods}</span></span><div className={st.chips}>{cap.moods.map(m => <button key={m} type="button" aria-pressed={idea.moods.includes(m)} disabled={locked || (!idea.moods.includes(m) && idea.moods.length >= cap.limits.maxMoods)} onClick={() => set({ moods: idea.moods.includes(m) ? idea.moods.filter(x => x !== m) : [...idea.moods, m] })}>{m}</button>)}</div></div>
        <div className={st.section}><span className={st.label}>จำนวนฉาก</span><Counter small label="จำนวนฉาก" value={idea.sceneCount} min={cap.limits.minScenes} max={cap.limits.maxScenes} unit="ฉาก" disabled={locked} onChange={sceneCount => set({ sceneCount })} /></div>
        <div className={st.section}><label className={st.label} htmlFor="story-model">โมเดลเขียนเนื้อเรื่อง</label><select id="story-model" className={st.select} value={idea.storyModelId} disabled={locked} onChange={e => set({ storyModelId: e.target.value })}>{cap.models.story.map(m => <option key={m.id} value={m.id}>{m.name} — {m.note}</option>)}</select>{storyModel && <span className={st.muted}>{storyModel.speedHint} · {storyModel.pointsPerUnit} pt ต่อเรื่อง</span>}</div>
        <ProjectSettings project={project} cap={cap} mutate={mutate} saving={saving} />
      </div>
      <div className={st.foot}><div className={st.cost}><span>ประมาณการเนื้อเรื่อง</span><b>{project.estimates.story} pt</b></div><button type="button" className={st.go} disabled={!ready || !cap.enabled || saving || locked || active(project.storyboard.status)} onClick={generate}><Sparkles aria-hidden />{project.story.status === "idle" ? "สร้างเนื้อเรื่อง" : "เขียนเนื้อเรื่องใหม่"}</button>{project.story.status !== "idle" && <button type="button" className={st.soft} disabled={saving} onClick={onGoPlot}>ไปที่เนื้อเรื่องเดิม <ArrowRight aria-hidden /></button>}</div>
    </aside>
    <section className={st.stage} aria-label="ตัวอย่างเรื่อง"><div className={st.stageCenter}>
      <div className={st.fit}><div className={st.poster} style={{ aspectRatio: project.aspectRatio.replace(":", " / "), width: `min(100cqw, calc(100cqh * ${project.aspectRatio.replace(":", " / ")}), 980px)` }} aria-busy={coverBusy}>
        <div className={st.posterArt}><ShotArt url={coverReady ? project.cover?.imageUrl : style?.sampleImageUrl} label={coverReady ? "ภาพปกเรื่อง" : `ภาพตัวอย่างสไตล์ ${style?.label ?? ""}`} onError={onMediaError} /></div>
        {coverBusy && <div className={d.skeleton} style={{ position: "absolute", inset: 0, borderRadius: 0, opacity: 0.85 }} />}<div className={st.posterShade} />
        <span className={st.posterSource}>{coverReady ? <><Sparkles aria-hidden />{project.cover?.source === "shot" ? "ภาพปกจาก shot" : "ภาพปกจาก AI"}</> : coverBusy ? <><LoaderCircle className="spin" aria-hidden />กำลังสร้างภาพปก {project.cover?.progress ?? 0}%</> : <><ImageIcon aria-hidden />ภาพตัวอย่างสไตล์ {style?.label}</>}</span>
        {!coverReady && cast.length > 0 && <div className={st.posterCast} aria-label="ตัวละคร">{cast.map(c => <span key={c.id} title={c.name} style={{ position: "relative" }}><ShotArt url={c.mediaUrl} label={c.name} onError={onCastMediaError} /></span>)}</div>}
        <div className={st.posterCopy}><small>{cap.genres.find(g => g.value === idea.genre)?.label} · {style?.label}</small><h2>{project.name}</h2><p>{idea.prompt.trim() || "พิมพ์ไอเดียทางซ้าย แล้วดูภาพรวมเรื่องของคุณ"}</p><div className={st.posterMeta}>{cast.map(c => <span key={c.id} className={st.glass}>{c.name}</span>)}{idea.moods.map(m => <span key={m} className={st.glass}>{m}</span>)}</div>{coverBusy && <Bar value={project.cover?.progress ?? 0} label="ความคืบหน้าการสร้างภาพปก" />}</div>
      </div></div>
      {project.cover?.failureMessage && <p role="alert" className={st.note}>{project.cover.failureMessage}{project.cover.status === "needs_attention" && " · กรุณาติดต่อผู้ดูแลเพื่อตรวจสอบคำขอ"}</p>}
      <div className={st.coverActions}><button type="button" className={st.soft} disabled={coverBusy || saving || !cap.enabled || idea.prompt.trim().length < 10 || (project.cover?.status === "needs_attention" && !project.cover.canRetry)} onClick={() => run(mutate("/cover", "POST", {}, true))}><Wand2 aria-hidden />{coverBusy ? "กำลังสร้างภาพปก…" : coverReady ? "สร้างภาพปกใหม่" : "สร้างภาพปกเรื่อง"}<span className={st.muted}>· {project.estimates.cover} pt</span></button>{project.cover && <button type="button" className={st.ghost} disabled={saving} onClick={() => run(mutate("/cover", "DELETE"))}><X aria-hidden />ใช้ภาพตัวอย่างสไตล์</button>}</div>
      <div className={st.slots} aria-label={`${idea.sceneCount} ฉาก`}>{Array.from({ length: idea.sceneCount }, (_, i) => <span key={i} className={st.slot}>ฉาก {i + 1}</span>)}</div><ul className={d.checklist} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: "4px 16px" }}>{checks.map(c => <li key={c.label} data-done={c.done}>{c.done ? <Check aria-hidden /> : <Circle aria-hidden />}{c.label}</li>)}</ul>
    </div></section>
    <aside className={`${st.panel} ${st.right}`} aria-label="ตัวละคร"><div className={st.panelHead}><span><Users aria-hidden />ตัวละคร</span><small>{idea.characterAssetIds.length}/{cap.limits.maxCast} · ไม่บังคับ</small></div><div className={st.scroll}><button type="button" className={st.addCast} disabled={locked} onClick={() => setCreating(true)}><Plus aria-hidden />สร้างตัวละครใหม่</button><span className={st.muted}>เลือกภาพอ้างอิงจากคลังตัวละครของคุณ</span>{castError && <div role="alert">{castError}<button type="button" className={st.soft} onClick={onRetryCast}>โหลดตัวละครใหม่</button></div>}{!characters.length && !castError && <p className={st.muted}>ยังไม่มีตัวละครในคลัง เริ่มเรื่องได้โดยไม่เลือกตัวละคร</p>}<div className={st.castGrid}>{characters.map(c => { const on = idea.characterAssetIds.includes(c.id); return <button key={c.id} type="button" className={st.cast} aria-pressed={on} disabled={locked || (!on && idea.characterAssetIds.length >= cap.limits.maxCast)} title={c.description} onClick={() => set({ characterAssetIds: on ? idea.characterAssetIds.filter(x => x !== c.id) : [...idea.characterAssetIds, c.id] })}><span className={st.castArt} style={{ position: "relative" }}><ShotArt url={c.mediaUrl} label={c.name} onError={onCastMediaError} /></span>{on && <span className={st.tick}><Check aria-hidden /></span>}<b>{c.name}</b><small>{c.description}</small></button>; })}</div>{hasMoreCast && <button type="button" className={st.soft} onClick={onLoadCast}>โหลดตัวละครเพิ่มเติม</button>}</div></aside>
    {creating && <CreateCharacter projectId={project.id} onClose={() => setCreating(false)} onCreate={c => { onCharacter(c); if (idea.characterAssetIds.length < cap.limits.maxCast) set({ characterAssetIds: [...idea.characterAssetIds, c.id] }); setCreating(false); }} />}
  </div>;
}
function ProjectSettings({ project: p, cap, mutate, saving }: { project: Project; cap: Capabilities; mutate: DirectorMutation; saving: boolean }) {
  const [name, setName] = useState(p.name);
  const frozen = p.storyboard.status !== "idle";
  const save = (value: Record<string, unknown>) => { void mutate("", "PATCH", value).catch(() => {}); };
  return <details className={st.section}><summary className={st.label}>ตั้งค่าโปรเจกต์</summary><label className={st.label} htmlFor="project-name">ชื่อโปรเจกต์</label><input id="project-name" className={st.select} value={name} maxLength={cap.limits.nameMaxLength} onChange={e => setName(e.target.value)} /><button type="button" className={st.soft} disabled={saving || !name.trim() || name === p.name} onClick={() => save({ name: name.trim() })}>บันทึกชื่อ</button><label className={st.label} htmlFor="project-ratio">ขนาดวิดีโอ</label><select id="project-ratio" className={st.select} disabled={frozen || saving} value={p.aspectRatio} onChange={e => save({ aspectRatio: e.target.value })}>{cap.aspectRatios.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select><label className={st.label} htmlFor="project-style">สไตล์ภาพ</label><select id="project-style" className={st.select} disabled={frozen || saving} value={p.style} onChange={e => save({ style: e.target.value })}>{cap.styles.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select><label className={st.label} htmlFor="project-resolution">ความคมชัด</label><select id="project-resolution" className={st.select} disabled={frozen || saving} value={p.resolution} onChange={e => save({ resolution: e.target.value })}>{cap.resolutions.map(r => <option key={r.value} value={r.value} disabled={!r.available}>{r.label}</option>)}</select>{frozen && <span className={st.muted}>ขนาด สไตล์ และความคมชัดล็อกหลังเริ่มสตอรี่บอร์ด</span>}</details>;
}
function CreateCharacter({ projectId, onClose, onCreate }: { projectId: string; onClose: () => void; onCreate: (c: Character) => void }) {
  const scope = `${projectId}:character`;
  const [name, setName] = useState(() => { const body = pendingSubmission(scope)?.body; return typeof body?.name === "string" ? body.name : ""; });
  const [desc, setDesc] = useState(() => { const body = pendingSubmission(scope)?.body; return typeof body?.prompt === "string" ? body.prompt : ""; });
  const [job, setJob] = useState<JobDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const poll = useRefreshPolling(job?.jobId ?? null, { intervalMs: 2000, fetch: () => jobsApi.get(job?.jobId ?? ""), onData: result => { setJob(result); return { poll: !["succeeded", "failed", "cancelled", "needs_attention"].includes(result.status) }; }, onError: cause => setError(errorMessage(cause)) });
  const generate = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    const previous = pendingSubmission(scope);
    if (previous && !window.confirm("ส่งคำขอสร้างตัวละครเดิมที่ยังไม่ยืนยันผลอีกครั้ง? ระบบจะใช้ชื่อและรูปลักษณ์เดิม")) { lock.current = false; setBusy(false); return; }
    const submission = prepareSubmission(scope, { name: name.trim(), prompt: desc.trim(), category: "character", aspectRatio: "3:4", designFormat: "full_body" });
    let accepted = false;
    try {
      const { prompt } = submission.body;
      if (typeof prompt !== "string") throw new Error("ข้อมูลคำขอตัวละครไม่สมบูรณ์");
      const result = await creativeApi.generate({ prompt, category: "character", aspectRatio: "3:4", designFormat: "full_body", idempotencyKey: submission.key });
      accepted = true;
      setJob(await jobsApi.get(result.jobId));
    } catch (cause) {
      const rejected = cause instanceof CreativeApiError && definiteRejection(cause, accepted);
      if (rejected) finishSubmission(scope);
      setError(`${errorMessage(cause)} · ${rejected ? "แก้ไขข้อมูลแล้วลองใหม่ได้" : "สามารถลองคำขอเดิมอีกครั้งได้"}`);
    }
    finally { lock.current = false; setBusy(false); }
  };
  const save = async () => {
    if (!job || job.status !== "succeeded" || lock.current) return;
    lock.current = true; setBusy(true);
    const submission = pendingSubmission(scope);
    try {
      const asset = await creativeApi.addAsset({ name: String(submission?.body.name ?? name).trim(), assetType: "character", description: String(submission?.body.prompt ?? desc), prompt: String(submission?.body.prompt ?? desc), scope: "personal", jobId: job.jobId });
      finishSubmission(scope); onCreate({ id: asset.id, name: asset.name, description: asset.description ?? "", mediaUrl: asset.mediaUrl ?? "" });
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  const working = !!job && !["succeeded", "failed", "cancelled", "needs_attention"].includes(job.status);
  return <CreateModal onClose={onClose}><form className={d.modal} style={{ width: "min(100%, 520px)" }} role="dialog" aria-modal="true" aria-labelledby="new-cast-title" onSubmit={e => { e.preventDefault(); void (job?.status === "succeeded" ? save() : generate()); }}><div className={d.modalHead}><div><h2 id="new-cast-title">สร้างตัวละคร</h2><p>สร้างภาพอ้างอิงและบันทึกลงคลังตัวละคร</p></div><button type="button" className={w.ghost} aria-label="ปิด" onClick={onClose}><X aria-hidden /></button></div>{error && <p role="alert">{error}<button type="button" className={st.soft} onClick={() => { void poll(); }}>ตรวจสถานะ</button></p>}<div style={{ position: "relative", aspectRatio: "3 / 4", width: 140, margin: "auto" }}><ShotArt url={job?.result?.mediaUrl} label={name} /></div>{working && <><p role="status">กำลังออกแบบตัวละคร {job.progress}%</p><Bar value={job.progress} label="ความคืบหน้าการสร้างตัวละคร" /></>}{job?.error && <p role="alert">{job.error.message}</p>}<label className={w.field}>ชื่อตัวละคร<input required maxLength={40} disabled={busy || working || !!pendingSubmission(scope)} value={name} onChange={e => setName(e.target.value)} /></label><label className={w.field}>รูปลักษณ์<textarea required minLength={5} maxLength={300} disabled={busy || working || !!pendingSubmission(scope)} value={desc} onChange={e => setDesc(e.target.value)} /></label><p className={d.hint}>ใช้ระบบสร้างตัวละครของ Character Studio · <Link href="/studio/images">ดูตัวเลือกการสร้างภาพ</Link></p><div className={d.modalActions}>{job && ["failed", "cancelled"].includes(job.status) && <button type="button" className={w.secondary} onClick={() => { finishSubmission(scope); setJob(null); setError(null); }}>เริ่มคำขอใหม่</button>}<button className={w.primary} disabled={busy || working || !name.trim() || desc.trim().length < 5 || String(job?.status) === "needs_attention"}>{job?.status === "succeeded" ? "ใช้ตัวละครนี้" : pendingSubmission(scope) && !job ? "ลองคำขอเดิมอีกครั้ง" : "สร้างภาพตัวละคร"}</button></div></form></CreateModal>;
}
