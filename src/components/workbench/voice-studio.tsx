"use client";
import { useState } from "react";
import { AudioLines, Mic, Music, Pause, Play, Sparkles, Waves, Upload, Download, Trash2 } from "lucide-react";
import w from "./workbench.module.css";
import { NOT_CONNECTED, Wave, WorkbenchHead, useToast } from "./workbench-ui";

type Tab = "tts" | "music" | "sfx";

const TABS: { id: Tab; label: string; icon: typeof Mic }[] = [
  { id: "tts", label: "พากย์เสียง", icon: Mic },
  { id: "music", label: "เพลงประกอบ", icon: Music },
  { id: "sfx", label: "เอฟเฟกต์เสียง", icon: Waves },
];

const VOICES = [
  { id: "nara", name: "นารา", desc: "หญิง · อบอุ่น · เล่าเรื่อง", color: "#e06c9f" },
  { id: "krit", name: "กฤต", desc: "ชาย · หนักแน่น · โฆษณา", color: "#3d7bd9" },
  { id: "ploy", name: "พลอย", desc: "หญิง · สดใส · วัยรุ่น", color: "#f0a23b" },
  { id: "tawan", name: "ตะวัน", desc: "ชาย · นุ่มลึก · สารคดี", color: "#3aa17e" },
  { id: "mali", name: "มะลิ", desc: "หญิง · สุภาพ · ข่าว", color: "#8b6cf0" },
  { id: "chai", name: "ชัย", desc: "ชาย · ร่าเริง · การ์ตูน", color: "#d9553d" },
];

const EMOTIONS = ["ปกติ", "ตื่นเต้น", "อบอุ่น", "จริงจัง", "เศร้า", "กระซิบ"];
const GENRES = ["ซีเนมาติก", "ป๊อป", "โลไฟ", "อิเล็กทรอนิกส์", "อะคูสติก", "ไทยร่วมสมัย"];
const MOODS = ["มีพลัง", "ผ่อนคลาย", "ลึกลับ", "อบอุ่น", "ตื่นเต้น"];
const SFX = ["เสียงฝนตก", "ประตูเปิด", "ฝีเท้าบนพื้นไม้", "ฝูงชนในตลาด", "วูช / ทรานซิชัน", "เสียงคลื่นทะเล"];

const SAMPLES: Record<Tab, { title: string; meta: string }[]> = {
  tts: [
    { title: "เปิดเรื่อง — ร้านหนังสือเก่า", meta: "นารา · 0:18" },
    { title: "โฆษณาน้ำหอม 15 วินาที", meta: "กฤต · 0:15" },
  ],
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
  const placeholder = tab === "tts"
    ? "พิมพ์บทพากย์ เช่น “ในร้านหนังสือเก่าที่ไม่มีใครแวะเวียน มีแมวตัวหนึ่งที่พูดได้…”"
    : tab === "music"
      ? "อธิบายเพลงที่ต้องการ เช่น เปียโนเบา ๆ ค่อย ๆ ไต่ระดับ จบด้วยสตริงอลังการ"
      : "อธิบายเสียงที่ต้องการ เช่น เสียงฝนตกบนหลังคาสังกะสี มีฟ้าร้องไกล ๆ";
  const maxLength = tab === "tts" ? 3000 : 500;

  return (
    <div className={w.page}>
      <WorkbenchHead icon={<AudioLines aria-hidden />} title="เสียง" description="สร้างเสียงพากย์ เพลงประกอบ และเอฟเฟกต์เสียง แล้วนำไปใช้ใน AI ตัดต่อ" />
      <div className={w.tabs} role="tablist" aria-label="ประเภทเสียง">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setText(""); }}>
            <Icon aria-hidden />{label}
          </button>
        ))}
      </div>

      <div className={w.split}>
        <form className={`${w.panel} ${w.panelSticky}`} onSubmit={(e) => { e.preventDefault(); toast.show(NOT_CONNECTED); }}>
          <label className={w.field}>
            <span className={w.fieldRow}>{tab === "tts" ? "บทพากย์" : "คำอธิบาย"}<span className={w.counter}>{text.length}/{maxLength}</span></span>
            <textarea value={text} maxLength={maxLength} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
          </label>

          {tab === "tts" && <>
            <div className={w.field}>
              <span>เสียงที่เลือก</span>
              <div className={w.row} style={{ cursor: "default" }}>
                {(() => { const v = VOICES.find((x) => x.id === voice)!; return <>
                  <span className={w.avatar} style={{ background: v.color }}>{v.name[0]}</span>
                  <span><b>{v.name}</b><span>{v.desc}</span></span>
                  <span className={w.tag}>เลือกจากคลังด้านขวา</span>
                </>; })()}
              </div>
            </div>
            <fieldset className={w.field} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 6 }}>อารมณ์</legend>
              <div className={w.chips}>
                {EMOTIONS.map((e) => <button key={e} type="button" aria-pressed={emotion === e} onClick={() => setEmotion(e)}>{e}</button>)}
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

          <button className={`${w.primary} ${w.block}`} disabled={text.trim().length < 2}>
            <Sparkles aria-hidden />{tab === "tts" ? "สร้างเสียงพากย์" : tab === "music" ? "สร้างเพลงประกอบ" : "สร้างเอฟเฟกต์เสียง"}
          </button>
          <p className={w.note}>ตัวอย่าง UI · ยังไม่มีการสร้างเสียงจริงและไม่ใช้เครดิต</p>
        </form>

        <div className={w.stage}>
          {tab === "tts" && <>
            <div className={w.toolbar} style={{ justifyContent: "space-between" }}>
              <h2 className={w.sectionTitle}>คลังเสียง</h2>
              <button type="button" className={w.secondary} onClick={() => toast.show(NOT_CONNECTED)}><Upload aria-hidden />โคลนเสียงของคุณ</button>
            </div>
            <div className={w.list} role="listbox" aria-label="คลังเสียง">
              {VOICES.map((v) => (
                <div key={v.id} role="option" aria-selected={voice === v.id} tabIndex={0} className={`${w.row} ${voice === v.id ? w.rowOn : ""}`}
                  onClick={() => setVoice(v.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setVoice(v.id); } }}>
                  <span className={w.avatar} style={{ background: v.color }}>{v.name[0]}</span>
                  <span><b>{v.name}</b><span>{v.desc}</span></span>
                  <button type="button" className={w.play} aria-label={`ฟังตัวอย่างเสียง${v.name}`}
                    onClick={(e) => { e.stopPropagation(); setPlaying(playing === v.id ? null : v.id); toast.show("ตัวอย่างเสียงจะพร้อมเมื่อเชื่อมต่อระบบ"); }}>
                    {playing === v.id ? <Pause aria-hidden /> : <Play aria-hidden />}
                  </button>
                </div>
              ))}
            </div>
          </>}

          <h2 className={w.sectionTitle}>ที่สร้างล่าสุด</h2>
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
        </div>
      </div>
      {toast.node}
    </div>
  );
}
