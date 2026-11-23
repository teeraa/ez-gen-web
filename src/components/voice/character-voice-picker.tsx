"use client";

// Picks the voice bound to a character: none, a Voice-menu voice (preset or "My voices") with
// emotion/speed/pitch, or a template copied from one of the user's past Voice-menu generations.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Mic } from "lucide-react";
import { voiceApi, type CharacterVoiceInput, type VoiceCapabilities, type VoiceGeneration, type VoiceProfile } from "@/lib/voice-api";
import v from "./character-voice-picker.module.css";

type Mode = "none" | "voice" | "template";

const modeOf = (value: CharacterVoiceInput): Mode => value.templateId ? "template" : value.voiceId ? "voice" : "none";

export function CharacterVoicePicker({ value, onChange, disabled }: { value: CharacterVoiceInput; onChange: (next: CharacterVoiceInput) => void; disabled?: boolean }) {
  const [caps, setCaps] = useState<VoiceCapabilities | null>(null);
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [history, setHistory] = useState<VoiceGeneration[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<Mode>(modeOf(value));

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([voiceApi.capabilities(controller.signal), voiceApi.profiles(controller.signal), voiceApi.list(1, controller.signal)])
      .then(([c, p, h]) => { setCaps(c); setProfiles(p.items); setHistory(h.items); })
      .catch(() => { if (!controller.signal.aborted) { setLoadError(true); setHistory([]); } });
    return () => controller.abort();
  }, []);

  const firstVoice = caps?.voices[0]?.id ?? profiles[0]?.id ?? "";
  // A generation made with one of the user's uploaded (real) voices.
  const realVoice = (g: VoiceGeneration) => !!g.profileId && profiles.some((p) => p.id === g.profileId && p.kind === "reference");
  const profile = useMemo(() => profiles.find((p) => p.id === value.voiceId), [profiles, value.voiceId]);
  // A bound profile that is no longer listed was deleted in the Voice menu.
  const missing = mode === "voice" && !!value.voiceId && caps !== null && !caps.voices.some((p) => p.id === value.voiceId) && !profile;

  const pick = (next: Mode) => {
    setMode(next);
    if (next === "none") onChange({ voiceId: "" });
    if (next === "voice") {
      // Coming from a template keeps its settings so the user can fine-tune them.
      const t = value.templateId ? history?.find((g) => g.id === value.templateId) : undefined;
      onChange(t ? { voiceId: t.voiceId, emotion: t.emotion, speed: t.speed, pitch: t.pitch } : { voiceId: value.voiceId || firstVoice, emotion: value.emotion ?? "ปกติ", speed: value.speed ?? 1, pitch: value.pitch ?? 0 });
    }
    // Never pre-select a template: the newest one may be someone's real recorded voice.
    if (next === "template" && !value.templateId) onChange({ voiceId: "" });
  };

  return (
    <fieldset className={v.box} disabled={disabled}>
      <legend className={v.legend}><Mic size={14} aria-hidden /> เสียงของตัวละคร</legend>
      <div className={v.modes} role="radiogroup" aria-label="แหล่งเสียง">
        {([["none", "ไม่ใช้เสียง"], ["voice", "เลือกเสียง"], ["template", "จากเมนูเสียง"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k} className={v.mode} onClick={() => pick(k)}
            disabled={k === "template" && history !== null && history.length === 0}>{label}</button>
        ))}
      </div>

      {loadError && <small className={v.note}>โหลดรายการเสียงไม่สำเร็จ ลองเปิดหน้าต่างนี้ใหม่</small>}

      {mode === "voice" && (
        <div className={v.grid}>
          <label className={v.wide}>เสียง
            <select value={value.voiceId} onChange={(e) => onChange({ ...value, voiceId: e.target.value })}>
              {missing && <option value={value.voiceId}>เสียงที่ถูกลบแล้ว</option>}
              <optgroup label="เสียงสำเร็จรูป">
                {caps?.voices.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.description}</option>)}
              </optgroup>
              {profiles.length > 0 && (
                <optgroup label="เสียงของฉัน">
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.kind === "reference" ? "เสียงจริงที่อัปโหลด" : "เสียงจากคำบรรยาย"}</option>)}
                </optgroup>
              )}
            </select>
          </label>
          <label>อารมณ์
            <select value={value.emotion ?? "ปกติ"} onChange={(e) => onChange({ ...value, emotion: e.target.value })}>
              {(caps?.emotions ?? ["ปกติ"]).map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label>ความเร็ว {(value.speed ?? 1).toFixed(1)}x
            <input type="range" min={0.5} max={2} step={0.1} value={value.speed ?? 1} onChange={(e) => onChange({ ...value, speed: Number(e.target.value) })} />
          </label>
          <label>ระดับเสียง {value.pitch ?? 0}
            <input type="range" min={-12} max={12} step={1} value={value.pitch ?? 0} onChange={(e) => onChange({ ...value, pitch: Number(e.target.value) })} />
          </label>
          {missing && <small className={`${v.note} ${v.warn}`}>เสียงนี้ถูกลบจากเมนูเสียงแล้ว กรุณาเลือกเสียงใหม่</small>}
          {profile?.kind === "reference" && profile.sampleUrl && (
            <div className={v.wide}><small className={v.note}>ตัวอย่างเสียงต้นแบบ</small><audio controls preload="none" src={profile.sampleUrl} className={v.audio} /></div>
          )}
        </div>
      )}

      {mode === "template" && (
        <div className={v.history} role="radiogroup" aria-label="เสียงที่เคยสร้างในเมนูเสียง">
          {history === null ? <small className={v.note}>กำลังโหลด…</small> : history.map((g) => (
            <label key={g.id} className={v.item} data-on={value.templateId === g.id || undefined}>
              <input type="radio" name="voice-template" checked={value.templateId === g.id} onChange={() => onChange({ voiceId: g.voiceId, templateId: g.id })} />
              <span className={v.itemText}>
                <b>{g.voiceName} · {g.emotion} · {g.speed.toFixed(1)}x{g.pitch ? ` · ${g.pitch > 0 ? "+" : ""}${g.pitch}` : ""}{realVoice(g) && <span className={v.real}>เสียงจริง</span>}</b>
                <small>{g.text.length > 70 ? `${g.text.slice(0, 70)}…` : g.text}</small>
              </span>
              <audio controls preload="none" src={g.audioUrl} className={v.audio} />
            </label>
          ))}
          {history !== null && history.length > 0 && !value.templateId && <small className={`${v.note} ${v.warn}`}>ยังไม่ได้เลือก — ถ้าบันทึกตอนนี้ ตัวละครจะไม่มีเสียง</small>}
          {history !== null && <small className={v.note}>ใช้เสียง อารมณ์ ความเร็ว และระดับเสียงเดียวกับรายการที่เลือก แสดง 20 รายการล่าสุด</small>}
        </div>
      )}

      <Link href="/studio/voice" className={v.link} target="_blank">สร้างหรือจัดการเสียงในเมนูเสียง <ArrowUpRight size={12} aria-hidden /></Link>
    </fieldset>
  );
}
