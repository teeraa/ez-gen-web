"use client";
// Add or edit one film element (character, location or prop). Characters also pick their voice here.
import { useEffect, useState } from "react";
import { Check, LoaderCircle, Search, X } from "lucide-react";
import { ShotArt } from "@/components/director/shot-art";
import { CreateModal } from "@/components/director/modal";
import { CharacterVoicePicker } from "@/components/voice/character-voice-picker";
import { sameVoiceInput, voiceInputOf, type CharacterVoiceInput } from "@/lib/voice-api";
import { definiteRejection, finishSubmission, prepareSubmission } from "@/lib/director-submission";
import { FilmError, KIND_LABEL, filmApi, filmErrorMessage, type ElementKind, type FilmElement, type LibraryAsset } from "@/lib/film-api";
import f from "./film.module.css";
import x from "./film-work.module.css";

/** The element being edited, or only its kind when adding a new one. */
export type ElementEditorTarget = { kind: ElementKind; element?: FilmElement };

export function ElementEditor({ seriesId, editor, onClose, onSaved }: { seriesId: string; editor: ElementEditorTarget; onClose: () => void; onSaved: (el: FilmElement, created: boolean) => void }) {
  const { kind, element } = editor;
  const [name, setName] = useState(element?.name ?? "");
  const [spec, setSpec] = useState(element?.spec ?? "");
  const [assetId, setAssetId] = useState("");
  const [library, setLibrary] = useState<LibraryAsset[] | null>(null);
  // Characters only. On create, leaving it untouched lets a library character keep its own voice.
  const initialVoice = voiceInputOf(element?.voice);
  const [voice, setVoice] = useState<CharacterVoiceInput>(initialVoice);
  const voiceChanged = kind === "character" && !sameVoiceInput(voice, initialVoice);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scope = `film-element:${seriesId}:${kind}`;

  useEffect(() => {
    if (element) return;
    const controller = new AbortController();
    void filmApi.library(kind, controller.signal).then((v) => setLibrary(v.items), () => setLibrary([]));
    return () => controller.abort();
  }, [kind, element]);

  const submit = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (element) {
        onSaved(await filmApi.updateElement(element.id, { revision: element.revision, name: name.trim(), spec: spec.trim(), ...(voiceChanged ? { voice } : {}) }), false);
      } else {
        const submission = prepareSubmission(scope, { name: name.trim(), spec: spec.trim(), assetId, voice: voiceChanged ? voice : null });
        try {
          const el = await filmApi.createElement(seriesId, { kind, name: String(submission.body.name), spec: String(submission.body.spec), ...(submission.body.assetId ? { assetId: String(submission.body.assetId) } : {}), ...(submission.body.voice ? { voice: submission.body.voice as CharacterVoiceInput } : {}), idempotencyKey: submission.key });
          finishSubmission(scope);
          onSaved(el, true);
        } catch (cause) {
          if (cause instanceof FilmError && definiteRejection(cause)) finishSubmission(scope);
          throw cause;
        }
      }
    } catch (cause) {
      setError(filmErrorMessage(cause));
    } finally { setBusy(false); }
  };

  const placeholder = kind === "character" ? "เช่น ชายไทยอายุ 32 ผิวคล้ำแดด ผมมวยสั้น ผ้าคาดเอวแดงเข้ม ถือดาบไทย นิ่งขรึม" : kind === "location" ? "เช่น แนวค่ายไม้บนเนินนอกพระนคร รุ่งสาง หมอกและควันลอย รั้วไม้ปลายแหลม" : "เช่น ดาบไทยด้ามเดียว ฝักไม้แยก ด้ามพันผ้าแดง ยาวราวแขน";
  return (
    <CreateModal onClose={() => { if (!busy) onClose(); }}>
      <form className={x.modal} role="dialog" aria-modal="true" aria-labelledby="film-element-title" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <header className={x.modalHead}>
          <h2 id="film-element-title">{element ? `แก้${KIND_LABEL[kind]}` : `เพิ่ม${KIND_LABEL[kind]}`}</h2>
          <button type="button" className={x.icon} aria-label="ปิด" disabled={busy} onClick={onClose}><X size={16} /></button>
        </header>
        {error && <p role="alert" className={x.error}>{error}</p>}
        <label className={x.field}>ชื่อ (ใช้อ้างอิงในช็อต)
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "character" ? "ขุนอินทร์" : kind === "location" ? "แนวค่ายอยุธยา" : "ดาบไทย"} />
        </label>
        <label className={x.field}>คำบรรยายหน้าตา / ลักษณะ
          <textarea rows={4} maxLength={1200} value={spec} onChange={(e) => setSpec(e.target.value)} placeholder={placeholder} />
          <small className={x.counter}>{spec.length}/1200 · ยิ่งละเอียด ภาพและวิดีโอยิ่งตรงทุกช็อต</small>
        </label>
        {kind === "character" && <CharacterVoicePicker value={voice} onChange={setVoice} disabled={busy} />}
        {kind === "character" && !element && assetId && !voiceChanged && <small className={x.counter}>ถ้าไม่เลือก จะใช้เสียงที่ผูกไว้กับตัวละครในคลัง (ถ้ามี)</small>}
        {!element && (
          <div className={x.field}>
            <span className={x.libHead}>ใช้ภาพจากคลังผลงาน (ไม่บังคับ)
              {library && library.length > 6 && (
                <span className={x.libSearch}><Search size={13} /><input aria-label="ค้นหาในคลัง" value={query} placeholder="ค้นหา" onChange={(e) => setQuery(e.target.value)} /></span>
              )}
            </span>
            {/* Fixed-height area so the dialog does not grow and move its buttons when the list loads. */}
            <div className={x.library}>
              {library === null ? <small className={x.counter}>กำลังโหลด…</small> : library.length === 0 ? <small className={x.counter}>ยังไม่มี{KIND_LABEL[kind]}ในคลัง สร้างภาพใหม่ได้หลังบันทึก</small> : (
                library.filter((a) => !query.trim() || a.name.toLowerCase().includes(query.trim().toLowerCase())).map((a) => (
                  <button key={a.id} type="button" className={x.libItem} aria-pressed={assetId === a.id} onClick={() => { setAssetId(assetId === a.id ? "" : a.id); if (!name.trim()) setName(a.name); if (!spec.trim() && a.description) setSpec(a.description.slice(0, 1200)); }}>
                    <span className={x.libArt}><ShotArt url={a.mediaUrl} label={a.name} /></span>
                    <span>{a.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        <div className={x.modalActions}>
          <button type="button" className={f.secondary} disabled={busy} onClick={onClose}>ยกเลิก</button>
          <button className={f.primary} disabled={busy || !name.trim()}>{busy ? <LoaderCircle size={16} className={f.spin} /> : <Check size={16} />} {element ? "บันทึก" : "เพิ่ม"}</button>
        </div>
      </form>
    </CreateModal>
  );
}
