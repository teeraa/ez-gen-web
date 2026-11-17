"use client";
import { useEffect, useRef, useState } from "react";
import { FileAudio, Loader2, Mic, Pause, PenLine, Play, Plus, Square, Trash2, Upload, X } from "lucide-react";
import w from "./workbench.module.css";
import { voiceApi, type VoiceCapabilities, type VoiceProfile } from "@/lib/voice-api";

type Mode = "reference" | "design";

// A short, phonetically varied Thai passage gives the model more of the voice to copy than free talk.
const READ_ALOUD = "สวัสดีครับ วันนี้อากาศแจ่มใส ผมกำลังเดินไปร้านกาแฟเล็ก ๆ ริมแม่น้ำ ที่นั่นมีขนมปังอบใหม่ กลิ่นหอมไปทั่วทั้งซอย ใครผ่านมาก็ต้องแวะชิมสักชิ้น แล้วนั่งฟังเสียงน้ำไหลไปเรื่อย ๆ อย่างสบายใจ";
const DESIGN_IDEAS = [
  "ผู้ชายอายุ 50 เสียงแหบเล็กน้อย พูดช้า สำเนียงเหนือ อบอุ่นเป็นกันเอง",
  "ผู้หญิงวัย 30 เสียงใส พูดเร็ว มั่นใจ แบบพิธีกรรายการท่องเที่ยว",
  "เด็กผู้ชายอายุ 8 ขวบ เสียงสดใส ซุกซน ตื่นเต้นง่าย",
  "ชายสูงวัยเสียงทุ้มลึก พูดช้าและนิ่ง แบบผู้บรรยายนิทานพื้นบ้าน",
];
const PROFILE_COLORS = ["#5b8def", "#d9653d", "#2f9e77", "#b55bd6", "#c99a1e", "#e0577b"];

export function profileColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PROFILE_COLORS[h % PROFILE_COLORS.length];
}

function recorderType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function extFor(type: string): string {
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4")) return "m4a";
  return "webm";
}

interface Props {
  caps: VoiceCapabilities | null;
  profiles: VoiceProfile[];
  selected: string;
  onSelect: (id: string) => void;
  onCreated: (p: VoiceProfile) => void;
  onDeleted: (id: string) => void;
  notify: (message: string) => void;
}

/** "My voices": the user's own voices from a recording/upload or a written description. */
export function MyVoices({ caps, profiles, selected, onSelect, onCreated, onDeleted, notify }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("reference");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clip, setClip] = useState<{ blob: Blob; filename: string; url: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const sample = useRef<HTMLAudioElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const minSeconds = caps?.referenceMinSeconds ?? 5;
  const maxSeconds = caps?.referenceMaxSeconds ?? 30;
  const maxProfiles = caps?.maxProfiles ?? 20;
  const referenceReady = caps?.referenceAvailable ?? false;
  const full = profiles.length >= maxProfiles;

  useEffect(() => () => {
    clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    sample.current?.pause();
  }, []);
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);

  const reset = () => {
    setName(""); setDescription(""); setClip(null); setConsent(false); setElapsed(0);
  };

  const startRecording = async () => {
    const type = recorderType();
    if (!type || !navigator.mediaDevices?.getUserMedia) { notify("เบราว์เซอร์นี้อัดเสียงไม่ได้ กรุณาอัปโหลดไฟล์แทน"); return; }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      notify("ไม่ได้รับสิทธิ์ใช้ไมโครโฟน กรุณาอนุญาตในเบราว์เซอร์แล้วลองใหม่");
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: type });
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      clearInterval(timer.current);
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      const blob = new Blob(chunks, { type });
      if (blob.size) setClip({ blob, filename: `recording.${extFor(type)}`, url: URL.createObjectURL(blob) });
    };
    recorder.current = rec;
    setClip(null);
    setElapsed(0);
    const started = Date.now();
    timer.current = setInterval(() => {
      const s = (Date.now() - started) / 1000;
      setElapsed(s);
      // The server keeps at most maxSeconds; stop just before so nothing the user said is cut.
      if (s >= maxSeconds - 0.5 && rec.state === "recording") rec.stop();
    }, 200);
    rec.start(250);
    setRecording(true);
  };

  const stopRecording = () => { if (recorder.current?.state === "recording") recorder.current.stop(); };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (caps && file.size > caps.referenceMaxBytes * 3) { notify("ไฟล์ใหญ่เกิน 30 MB"); return; }
    setClip({ blob: file, filename: file.name, url: URL.createObjectURL(file) });
    if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, "").slice(0, 40));
  };

  const recordedTooShort = clip?.filename.startsWith("recording.") && elapsed > 0 && elapsed < minSeconds;
  const canSave = !saving && !full && name.trim().length > 0 && (mode === "design"
    ? description.trim().length >= 5
    : !!clip && consent && !recording && !recordedTooShort && referenceReady);

  // Why the save button is disabled, in the order the user should fix it.
  const blocker = saving ? "" : full ? `มีเสียงครบ ${maxProfiles} เสียงแล้ว กรุณาลบเสียงที่ไม่ใช้ก่อน`
    : !name.trim() ? "ตั้งชื่อเสียงก่อน"
    : mode === "design" ? (description.trim().length < 5 ? "บรรยายลักษณะเสียงอย่างน้อย 5 ตัวอักษร" : "")
    : !referenceReady ? "เซิร์ฟเวอร์ยังไม่พร้อมรับคลิปเสียง"
    : recording ? "กดหยุดอัดก่อน"
    : !clip ? "อัดเสียงหรืออัปโหลดไฟล์ก่อน"
    : recordedTooShort ? `อัดใหม่ให้ยาวอย่างน้อย ${minSeconds} วินาที`
    : !consent ? "ติ๊กยืนยันความเป็นเจ้าของเสียงก่อน" : "";

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const p = mode === "design"
        ? await voiceApi.createDesign(name.trim(), description.trim())
        : await voiceApi.createReference(name.trim(), clip!.blob, clip!.filename, consent);
      onCreated(p);
      onSelect(p.id);
      notify(`สร้างเสียง “${p.name}” แล้ว เลือกใช้อยู่ตอนนี้`);
      reset();
      setOpen(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "สร้างเสียงไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const playSample = (p: VoiceProfile) => {
    if (playing === p.id) { sample.current?.pause(); setPlaying(null); return; }
    sample.current?.pause();
    const el = new Audio(p.sampleUrl);
    sample.current = el;
    el.onended = () => setPlaying(null);
    el.onerror = () => { setPlaying(null); notify("ลิงก์คลิปหมดอายุ กรุณารีเฟรชหน้า"); };
    setPlaying(p.id);
    el.play().catch(() => setPlaying(null));
  };

  const remove = async (p: VoiceProfile) => {
    setDeleting(p.id);
    try {
      await voiceApi.removeProfile(p.id);
      if (playing === p.id) { sample.current?.pause(); setPlaying(null); }
      onDeleted(p.id);
    } catch (e) {
      notify(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className={w.toolbar} style={{ justifyContent: "space-between" }}>
        <h2 className={w.sectionTitle}>เสียงของฉัน <span className={w.counter}>{profiles.length}/{maxProfiles}</span></h2>
        <button type="button" className={w.secondary} disabled={full && !open} aria-expanded={open} onClick={() => { setOpen(!open); if (open) reset(); }}>
          {open ? <><X aria-hidden />ปิด</> : <><Plus aria-hidden />สร้างเสียงของฉัน</>}
        </button>
      </div>

      {open && (
        <div className={w.panel} style={{ display: "grid", gap: 12 }}>
          <div className={w.chips} aria-label="วิธีสร้างเสียง">
            <button type="button" aria-pressed={mode === "reference"} onClick={() => setMode("reference")}><Mic aria-hidden /> จากเสียงจริง</button>
            <button type="button" aria-pressed={mode === "design"} onClick={() => setMode("design")}><PenLine aria-hidden /> จากคำบรรยาย</button>
          </div>

          <label className={w.field}>
            <span className={w.fieldRow}>ชื่อเสียง<span className={w.counter}>{name.length}/40</span></span>
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={mode === "design" ? "เช่น ลุงเหนือ" : "เช่น เสียงของฉัน"} />
          </label>

          {mode === "reference" ? <>
            {!referenceReady && <p className={w.note} role="alert">เซิร์ฟเวอร์ยังไม่พร้อมรับคลิปเสียง (ต้องตั้งค่า API key และติดตั้ง FFmpeg)</p>}
            <div className={w.field}>
              <span>อ่านข้อความนี้ให้ต่อเนื่อง {minSeconds}–{maxSeconds} วินาที ในที่เงียบ (แนะนำ 10–20 วินาที)</span>
              <p className={w.note} style={{ margin: 0, lineHeight: 1.7 }}>“{READ_ALOUD}”</p>
            </div>
            <div className={w.toolbar}>
              {recording
                ? <button type="button" className={w.primary} onClick={stopRecording}><Square aria-hidden />หยุดอัด · {elapsed.toFixed(0)}/{maxSeconds} วิ</button>
                : <button type="button" className={w.secondary} disabled={saving} onClick={() => void startRecording()}><Mic aria-hidden />{clip ? "อัดใหม่" : "อัดเสียง"}</button>}
              <button type="button" className={w.secondary} disabled={recording || saving} onClick={() => fileInput.current?.click()}><Upload aria-hidden />อัปโหลดไฟล์</button>
              <input ref={fileInput} type="file" accept="audio/*,.m4a,.wav,.mp3,.ogg,.webm" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            {clip && !recording && (
              <div className={w.field}>
                <span className={w.fieldRow}><span><FileAudio aria-hidden style={{ width: 14, verticalAlign: -2 }} /> {clip.filename}</span></span>
                <audio controls src={clip.url} style={{ width: "100%" }} />
                {recordedTooShort && <small role="alert">อัดสั้นเกินไป ต้องยาวอย่างน้อย {minSeconds} วินาที</small>}
                {!clip.filename.startsWith("recording.") && <small>ถ้าไฟล์ยาวเกิน {maxSeconds} วินาที ระบบจะใช้แค่ {maxSeconds} วินาทีแรก</small>}
              </div>
            )}
            <label className={w.fieldRow} style={{ justifyContent: "flex-start", gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
              <span>ฉันยืนยันว่านี่เป็นเสียงของฉันเอง หรือได้รับอนุญาตจากเจ้าของเสียงแล้ว และจะไม่ใช้เสียงนี้แอบอ้างหรือหลอกลวงผู้อื่น</span>
            </label>
          </> : <>
            <label className={w.field}>
              <span className={w.fieldRow}>บรรยายลักษณะเสียง<span className={w.counter}>{description.length}/300</span></span>
              <textarea value={description} maxLength={300} rows={3} onChange={(e) => setDescription(e.target.value)} placeholder="เพศ อายุ โทนเสียง จังหวะการพูด สำเนียง บุคลิก" />
            </label>
            <div className={w.chips}>
              {DESIGN_IDEAS.map((idea) => <button key={idea} type="button" aria-pressed={description === idea} onClick={() => setDescription(idea)}>{idea}</button>)}
            </div>
            <p className={w.note}>เสียงจากคำบรรยายจะออกมาใกล้เคียงกันในแต่ละครั้ง แต่ไม่เหมือนกันทุกครั้ง</p>
          </>}

          <button type="button" className={`${w.primary} ${w.block}`} disabled={!canSave} onClick={() => void save()}>
            {saving ? <Loader2 aria-hidden className={w.spin} /> : <Plus aria-hidden />}
            {saving ? (mode === "reference" ? "กำลังประมวลผลคลิป…" : "กำลังบันทึก…") : "บันทึกเสียงนี้"}
          </button>
          {blocker && <p className={w.note} role="status" style={{ margin: 0 }}>{blocker}</p>}
        </div>
      )}

      {profiles.length > 0 ? (
        <div className={w.list} role="listbox" aria-label="เสียงของฉัน">
          {profiles.map((p) => (
            <div key={p.id} role="option" aria-selected={selected === p.id} tabIndex={0} className={`${w.row} ${selected === p.id ? w.rowOn : ""}`}
              onClick={() => onSelect(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.id); } }}>
              <span className={w.avatar} style={{ background: profileColor(p.id) }}>{p.name[0]}</span>
              <span><b>{p.name}</b><span>{p.kind === "reference" ? `เสียงจริง · คลิป ${p.audioSeconds.toFixed(0)} วิ` : p.description}</span></span>
              <span className={w.cardActions}>
                {selected === p.id && <span className={w.tag}>ใช้อยู่</span>}
                {p.kind === "reference" && p.sampleUrl && (
                  <button type="button" className={w.play} aria-label={playing === p.id ? `หยุดคลิป ${p.name}` : `ฟังคลิปต้นฉบับ ${p.name}`} onClick={(e) => { e.stopPropagation(); playSample(p); }}>
                    {playing === p.id ? <Pause aria-hidden /> : <Play aria-hidden />}
                  </button>
                )}
                <button type="button" className={w.ghost} aria-label={`ลบเสียง ${p.name}`} disabled={deleting === p.id} onClick={(e) => { e.stopPropagation(); void remove(p); }}><Trash2 aria-hidden /></button>
              </span>
            </div>
          ))}
        </div>
      ) : !open && <p className={w.note}>ยังไม่มีเสียงของคุณ อัดเสียงตัวเองหรือบรรยายเสียงที่ต้องการ แล้วใช้พากย์ได้เหมือนเสียงในคลัง</p>}
    </>
  );
}
