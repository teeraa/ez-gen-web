"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Loader2, Mic, Music, Pause, Play, Sparkles, Waves, Download, Trash2 } from "lucide-react";
import w from "./workbench.module.css";
import { NOT_CONNECTED, Wave, WorkbenchHead, useToast } from "./workbench-ui";
import { formatVoiceDuration, voiceApi, VoiceApiError, type VoiceCapabilities, type VoiceGeneration, type VoicePreset, type VoiceProfile } from "@/lib/voice-api";
import { MyVoices, profileColor } from "./my-voices";

type Tab = "tts" | "music" | "sfx";

const TABS: { id: Tab; label: string; icon: typeof Mic }[] = [
  { id: "tts", label: "พากย์เสียง", icon: Mic },
  { id: "music", label: "เพลงประกอบ", icon: Music },
  { id: "sfx", label: "เอฟเฟกต์เสียง", icon: Waves },
];

// Shown until /voice/capabilities answers; the server list is the source of truth.
const VOICES: VoicePreset[] = [
  { id: "nara", name: "นารา", description: "หญิง · อบอุ่น · เล่าเรื่อง", color: "#e06c9f" },
  { id: "krit", name: "กฤต", description: "ชาย · หนักแน่น · โฆษณา", color: "#3d7bd9" },
  { id: "ploy", name: "พลอย", description: "หญิง · สดใส · วัยรุ่น", color: "#f0a23b" },
  { id: "tawan", name: "ตะวัน", description: "ชาย · นุ่มลึก · สารคดี", color: "#3aa17e" },
  { id: "mali", name: "มะลิ", description: "หญิง · สุภาพ · ข่าว", color: "#8b6cf0" },
  { id: "chai", name: "ชัย", description: "ชาย · ร่าเริง · การ์ตูน", color: "#d9553d" },
];

const EMOTIONS = ["ปกติ", "ตื่นเต้น", "อบอุ่น", "จริงจัง", "เศร้า", "กระซิบ"];
const GENRES = ["ซีเนมาติก", "ป๊อป", "โลไฟ", "อิเล็กทรอนิกส์", "อะคูสติก", "ไทยร่วมสมัย"];
const MOODS = ["มีพลัง", "ผ่อนคลาย", "ลึกลับ", "อบอุ่น", "ตื่นเต้น"];
const SFX = ["เสียงฝนตก", "ประตูเปิด", "ฝีเท้าบนพื้นไม้", "ฝูงชนในตลาด", "วูช / ทรานซิชัน", "เสียงคลื่นทะเล"];

// Placeholder rows for the tabs that are not connected yet.
const SAMPLES: Record<"music" | "sfx", { title: string; meta: string }[]> = {
  music: [{ title: "ซีเนมาติก · ลึกลับ", meta: "0:30 · 96 BPM" }],
  sfx: [{ title: "เสียงฝนตกเบา ๆ", meta: "0:08" }],
};

export function VoiceStudio() {
  const [tab, setTab] = useState<Tab>("tts");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("nara");
  const [emotion, setEmotion] = useState("ปกติ");
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [genre, setGenre] = useState("ซีเนมาติก");
  const [mood, setMood] = useState("ลึกลับ");
  const [duration, setDuration] = useState(30);
  const [playing, setPlaying] = useState<string | null>(null);
  const toast = useToast();
  const [caps, setCaps] = useState<VoiceCapabilities | null>(null);
  const [history, setHistory] = useState<VoiceGeneration[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  // Reused while the same submission is retried so a lost response is not charged twice.
  const pending = useRef<{ key: string; id: string } | null>(null);

  const voices = caps?.voices.length ? caps.voices : VOICES;
  const emotions = caps?.emotions.length ? caps.emotions : EMOTIONS;
  const available = caps?.available ?? false;

  const loadHistory = useCallback(async (next: number, signal?: AbortSignal) => {
    const list = await voiceApi.list(next, signal);
    setHistory((prev) => next === 1 ? list.items : [...prev, ...list.items.filter((x) => !prev.some((p) => p.id === x.id))]);
    setTotal(list.total);
    setPage(next);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const c = await voiceApi.capabilities(ctrl.signal);
        setCaps(c);
        if (c.voices.length && !c.voices.some((v) => v.id === voice)) setVoice(c.voices[0].id);
        await loadHistory(1, ctrl.signal);
        // "My voices" needs migration 038; the rest of the page still works without it.
        voiceApi.profiles(ctrl.signal).then((r) => setProfiles(r.items)).catch(() => undefined);
        setLoadError("");
      } catch (e) {
        if (!ctrl.signal.aborted) setLoadError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [loadHistory]);

  useEffect(() => () => { audio.current?.pause(); }, []);

  const play = (item: VoiceGeneration) => {
    if (playing === item.id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    const el = new Audio(item.audioUrl);
    audio.current = el;
    el.onended = () => setPlaying((p) => (p === item.id ? null : p));
    el.onerror = () => {
      setPlaying(null);
      // Signed URLs last about an hour; refresh them and ask the user to press play again.
      toast.show("ลิงก์เสียงหมดอายุ กำลังโหลดใหม่ กรุณากดเล่นอีกครั้ง");
      loadHistory(1).catch(() => undefined);
    };
    setPlaying(item.id);
    el.play().catch(() => setPlaying(null));
  };

  const generate = async () => {
    const body = { text: text.trim(), voiceId: voice, emotion, speed: Math.round(speed * 10) / 10, pitch };
    const key = JSON.stringify(body);
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    try {
      const item = await voiceApi.generate({ requestId: pending.current.id, ...body });
      pending.current = null;
      setHistory((prev) => [item, ...prev.filter((x) => x.id !== item.id)]);
      setTotal((t) => (history.some((x) => x.id === item.id) ? t : t + 1));
      toast.show("สร้างเสียงพากย์เรียบร้อย");
      play(item);
    } catch (e) {
      // Input or idempotency errors will not succeed on retry with the same id.
      if (e instanceof VoiceApiError && e.status >= 400 && e.status < 500 && e.status !== 429) pending.current = null;
      toast.show(e instanceof Error ? e.message : "สร้างเสียงไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: VoiceGeneration) => {
    setDeleting(item.id);
    try {
      await voiceApi.remove(item.id);
      if (playing === item.id) { audio.current?.pause(); setPlaying(null); }
      setHistory((prev) => prev.filter((x) => x.id !== item.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(null);
    }
  };
  const placeholder = tab === "tts"
    ? "พิมพ์บทพากย์ เช่น “ในร้านหนังสือเก่าที่ไม่มีใครแวะเวียน มีแมวตัวหนึ่งที่พูดได้…”"
    : tab === "music"
      ? "อธิบายเพลงที่ต้องการ เช่น เปียโนเบา ๆ ค่อย ๆ ไต่ระดับ จบด้วยสตริงอลังการ"
      : "อธิบายเสียงที่ต้องการ เช่น เสียงฝนตกบนหลังคาสังกะสี มีฟ้าร้องไกล ๆ";
  const maxLength = tab === "tts" ? (caps?.maxChars ?? 1500) : 500;

  return (
    <div className={w.page}>
      <WorkbenchHead icon={<AudioLines aria-hidden />} title="เสียง" description="สร้างเสียงพากย์ เพลงประกอบ และเอฟเฟกต์เสียง แล้วนำไปใช้ใน AI ตัดต่อ" preview={tab !== "tts"} />
      <div className={w.tabs} role="tablist" aria-label="ประเภทเสียง">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setText(""); }}>
            <Icon aria-hidden />{label}
          </button>
        ))}
      </div>

      <div className={w.split}>
        <form className={`${w.panel} ${w.panelSticky}`} onSubmit={(e) => { e.preventDefault(); if (tab === "tts") { if (!busy) void generate(); } else toast.show(NOT_CONNECTED); }}>
          <label className={w.field}>
            <span className={w.fieldRow}>{tab === "tts" ? "บทพากย์" : "คำอธิบาย"}<span className={w.counter}>{text.length}/{maxLength}</span></span>
            <textarea value={text} maxLength={maxLength} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
          </label>

          {tab === "tts" && <>
            <div className={w.field}>
              <span>เสียงที่เลือก</span>
              <div className={w.row} style={{ cursor: "default" }}>
                {(() => {
                  const own = profiles.find((x) => x.id === voice);
                  const v = own
                    ? { name: own.name, color: profileColor(own.id), description: own.kind === "reference" ? "เสียงของฉัน · เสียงจริง" : `เสียงของฉัน · ${own.description}` }
                    : voices.find((x) => x.id === voice) ?? voices[0];
                  return <>
                  <span className={w.avatar} style={{ background: v.color }}>{v.name[0]}</span>
                  <span><b>{v.name}</b><span>{v.description}</span></span>
                  <span className={w.tag}>เลือกจากคลังด้านขวา</span>
                </>; })()}
              </div>
            </div>
            <fieldset className={w.field} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 6 }}>อารมณ์</legend>
              <div className={w.chips}>
                {emotions.map((e) => <button key={e} type="button" aria-pressed={emotion === e} onClick={() => setEmotion(e)}>{e}</button>)}
              </div>
            </fieldset>
            <label className={w.range}>ความเร็ว
              <input type="range" min={0.5} max={2} step={0.1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
              <output>{speed.toFixed(1)}×</output>
            </label>
            <label className={w.range}>ระดับเสียง
              <input type="range" min={-6} max={6} step={1} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
              <output>{pitch > 0 ? `+${pitch}` : pitch}</output>
            </label>
          </>}

          {tab === "music" && <>
            <fieldset className={w.field} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 6 }}>แนวเพลง</legend>
              <div className={w.chips}>{GENRES.map((g) => <button key={g} type="button" aria-pressed={genre === g} onClick={() => setGenre(g)}>{g}</button>)}</div>
            </fieldset>
            <fieldset className={w.field} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 6 }}>อารมณ์เพลง</legend>
              <div className={w.chips}>{MOODS.map((m) => <button key={m} type="button" aria-pressed={mood === m} onClick={() => setMood(m)}>{m}</button>)}</div>
            </fieldset>
            <label className={w.range}>ความยาว
              <input type="range" min={10} max={120} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
              <output>{duration} วิ</output>
            </label>
          </>}

          {tab === "sfx" && (
            <fieldset className={w.field} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 6 }}>ไอเดียเสียง</legend>
              <div className={w.chips}>{SFX.map((s) => <button key={s} type="button" aria-pressed={text === s} onClick={() => setText(s)}>{s}</button>)}</div>
            </fieldset>
          )}

          <button className={`${w.primary} ${w.block}`} disabled={text.trim().length < 2 || (tab === "tts" && (busy || !available))} aria-busy={tab === "tts" && busy}>
            {tab === "tts" && busy ? <Loader2 aria-hidden className={w.spin} /> : <Sparkles aria-hidden />}
            {tab === "tts" ? (busy ? "กำลังสร้างเสียง…" : "สร้างเสียงพากย์") : tab === "music" ? "สร้างเพลงประกอบ" : "สร้างเอฟเฟกต์เสียง"}
          </button>
          <p className={w.note}>
            {tab !== "tts" ? "ตัวอย่าง UI · ยังไม่มีการสร้างเสียงจริงและไม่ใช้เครดิต"
              : loading ? "กำลังตรวจสอบระบบสร้างเสียง…"
              : !available ? "ระบบสร้างเสียงยังไม่ได้ตั้งค่า (BYTEPLUS_VOICE_API_KEY) กรุณาติดต่อผู้ดูแลระบบ"
              : "สร้างด้วย seed-audio-1.0 · ความยาวเสียงไม่เกิน 120 วินาทีต่อครั้ง"}
          </p>
        </form>

        <div className={w.stage}>
          {tab === "tts" && <>
            <MyVoices caps={caps} profiles={profiles} selected={voice} onSelect={setVoice} notify={toast.show}
              onCreated={(p) => setProfiles((prev) => [p, ...prev])}
              onDeleted={(id) => { setProfiles((prev) => prev.filter((x) => x.id !== id)); if (voice === id) setVoice(voices[0].id); }} />
            <h2 className={w.sectionTitle}>คลังเสียง</h2>
            <div className={w.list} role="listbox" aria-label="คลังเสียง">
              {voices.map((v) => (
                <div key={v.id} role="option" aria-selected={voice === v.id} tabIndex={0} className={`${w.row} ${voice === v.id ? w.rowOn : ""}`}
                  onClick={() => setVoice(v.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setVoice(v.id); } }}>
                  <span className={w.avatar} style={{ background: v.color }}>{v.name[0]}</span>
                  <span><b>{v.name}</b><span>{v.description}</span></span>
                  {voice === v.id && <span className={w.tag}>ใช้อยู่</span>}
                </div>
              ))}
            </div>
          </>}

          <h2 className={w.sectionTitle}>ที่สร้างล่าสุด{tab === "tts" && total > 0 ? ` (${total})` : ""}</h2>
          {tab === "tts" ? (
            <div className={w.list}>
              {loading && <p className={w.note}>กำลังโหลดประวัติ…</p>}
              {!loading && loadError && <p className={w.note} role="alert">{loadError}</p>}
              {!loading && !loadError && history.length === 0 && <p className={w.note}>ยังไม่มีเสียงพากย์ ลองพิมพ์บทแล้วกด “สร้างเสียงพากย์”</p>}
              {history.map((item, i) => (
                <div key={item.id} className={w.row} style={{ gridTemplateColumns: "40px minmax(0,1fr) minmax(0,1.4fr) auto" }}>
                  <button type="button" className={w.play} aria-label={playing === item.id ? "หยุด" : "เล่น"} onClick={() => play(item)}>
                    {playing === item.id ? <Pause aria-hidden /> : <Play aria-hidden />}
                  </button>
                  <span title={item.text}><b>{item.text.length > 40 ? `${item.text.slice(0, 40)}…` : item.text}</b><span>{item.voiceName} · {item.emotion} · {formatVoiceDuration(item.duration)}</span></span>
                  <Wave seed={i + item.text.length} bars={36} on={playing === item.id} />
                  <span className={w.cardActions}>
                    <a className={w.ghost} aria-label="ดาวน์โหลด" href={item.downloadUrl} download><Download aria-hidden /></a>
                    <button type="button" className={w.ghost} aria-label="ลบ" disabled={deleting === item.id} onClick={() => void remove(item)}><Trash2 aria-hidden /></button>
                  </span>
                </div>
              ))}
              {history.length < total && (
                <button type="button" className={w.secondary} onClick={() => loadHistory(page + 1).catch((e) => toast.show(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"))}>โหลดเพิ่ม</button>
              )}
            </div>
          ) : (
          <div className={w.list}>
            {SAMPLES[tab].map((item, i) => (
              <div key={item.title} className={w.row} style={{ gridTemplateColumns: "40px minmax(0,1fr) minmax(0,1.4fr) auto" }}>
                <button type="button" className={w.play} aria-label={`เล่น ${item.title}`} onClick={() => toast.show("ไฟล์ตัวอย่าง ยังไม่มีเสียงจริง")}><Play aria-hidden /></button>
                <span><b>{item.title}</b><span>{item.meta}</span></span>
                <Wave seed={i + tab.length} bars={36} />
                <span className={w.cardActions}>
                  <button type="button" className={w.ghost} aria-label="ดาวน์โหลด" onClick={() => toast.show(NOT_CONNECTED)}><Download aria-hidden /></button>
                  <button type="button" className={w.ghost} aria-label="ลบ" onClick={() => toast.show(NOT_CONNECTED)}><Trash2 aria-hidden /></button>
                </span>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
      {toast.node}
    </div>
  );
}
