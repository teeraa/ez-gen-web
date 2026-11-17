"use client";
// Concept: chat on the left builds the film; the result on the right fills in stage by stage
// (story → cast → elements → shots → film). All data is mock until the Director API is wired in.
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowUp, BookOpen, Check, Clapperboard, Clock, Download, Film, LoaderCircle, Lock, Mic, Music,
  Package, Pencil, Play, Plus, RefreshCw, Scissors, Sparkles, Users, X,
} from "lucide-react";
import {
  CAST, ELEMENTS, SAMPLE_PROMPT, SCENES, SHOT_COUNT, STAGES, STORY, TOTAL_SECONDS, clock, type StageId,
} from "./film-data";
import f from "./film.module.css";

type Target = { kind: "shot" | "cast"; id: string; label: string };
interface Msg { id: number; role: "user" | "ai"; text: string; stage?: StageId; chips?: string[]; context?: string }
type FilmState = "idle" | "rendering" | "done";

const STAGE_ICON = { story: BookOpen, cast: Users, elements: Package, shots: Clapperboard, film: Film } as const;
const IDEAS = ["สงครามย้อนยุค 2 นาที", "รักแรกพบบนรถไฟฟ้า 1 นาที", "โฆษณากาแฟท้องถิ่น 30 วิ"];
const EDIT_CHIPS = ["ทำให้ฉากต่อสู้ดุเดือดขึ้น", "ตัดให้เหลือ 90 วินาที", "เพิ่มบทพูดให้ไอ้กล้า"];
const pct = (sec: number) => `${(sec / TOTAL_SECONDS) * 100}%`;

export interface FilmHeading { title: string; subtitle: string; backHref: string }

export function FilmStudio({ heading }: { heading?: FilmHeading }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState(SAMPLE_PROMPT);
  const [ready, setReady] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<StageId>("story");
  const [target, setTarget] = useState<Target | null>(null);
  const [edited, setEdited] = useState<string[]>([]);
  const [film, setFilm] = useState<FilmState>("idle");
  const [rendered, setRendered] = useState(0);
  const [opts, setOpts] = useState({ voice: true, music: true, subs: true, review: false });
  const timers = useRef<number[]>([]);
  const nextId = useRef(1);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  const push = (msg: Omit<Msg, "id">) => {
    const id = nextId.current++;
    setMessages((m) => [...m, { ...msg, id }]);
  };

  const generate = (prompt: string) => {
    push({ role: "user", text: prompt });
    setBusy(true);
    const steps: { stage: StageId; text: string; chips?: string[] }[] = [
      { stage: "story", text: "เขียนเรื่องย่อ แก่นเรื่อง และแบ่งเป็น 3 องก์ให้แล้ว ความยาวรวม 2:00" },
      { stage: "cast", text: "สร้างตัวละคร 3 ตัวจากบท พร้อมหน้าตาและเสียงพากย์ที่เหมาะกับแต่ละคน" },
      { stage: "elements", text: "กำหนดสถานที่ 3 แห่ง ของสำคัญที่ต้องเหมือนกันทุกช็อต และโทนภาพของเรื่อง" },
      { stage: "shots", text: `แตกเป็น 5 ฉาก ${SHOT_COUNT} ช็อต เวลารวม 2:00 พอดี — คลิกช็อตหรือตัวละครทางขวา แล้วพิมพ์บอกได้เลยว่าอยากแก้อะไร`, chips: EDIT_CHIPS },
    ];
    steps.forEach((step, i) =>
      later(1100 * (i + 1), () => {
        setReady(i + 1);
        setTab(step.stage);
        push({ role: "ai", ...step });
        if (i === steps.length - 1) setBusy(false);
      }),
    );
  };

  const revise = (prompt: string) => {
    const t = target;
    push({ role: "user", text: prompt, context: t?.label });
    setBusy(true);
    later(1200, () => {
      if (t?.kind === "shot") {
        setEdited((e) => (e.includes(t.id) ? e : [...e, t.id]));
        setTab("shots");
        push({ role: "ai", stage: "shots", text: `แก้${t.label}แล้ว ภาพอ้างอิงของช็อตนี้จะสร้างใหม่ ช็อตอื่นไม่เปลี่ยน และเวลารวมยังเป็น 2:00` });
      } else if (t?.kind === "cast") {
        setTab("cast");
        push({ role: "ai", stage: "cast", text: `ปรับ${t.label}แล้ว ช็อตที่มีตัวละครนี้จะถูกทำเครื่องหมายให้สร้างภาพใหม่` });
      } else {
        push({ role: "ai", stage: "shots", text: "ปรับบทให้แล้ว ส่วนที่เปลี่ยนมีป้าย “แก้แล้ว” ทางขวา" });
      }
      setBusy(false);
    });
  };

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    if (ready === 0) generate(text);
    else revise(text);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };
  const pick = (t: Target) => setTarget((cur) => (cur?.id === t.id && cur.kind === t.kind ? null : t));

  const startFilm = () => {
    setFilm("rendering");
    setRendered(0);
    push({ role: "ai", stage: "film", text: "เริ่มสร้างหนังแล้ว ปิดหน้านี้ได้เลย ระบบจะแจ้งเตือนเมื่อเสร็จ" });
    let n = 0;
    const iv = window.setInterval(() => {
      n += 1;
      setRendered(n);
      if (n >= SHOT_COUNT) {
        window.clearInterval(iv);
        later(700, () => {
          setFilm("done");
          push({ role: "ai", stage: "film", text: "หนังเสร็จแล้ว ถ้าไม่ชอบช็อตไหน คลิกช็อตนั้นแล้วบอกผม ระบบจะสร้างใหม่และรวมไฟล์ให้เฉพาะส่วนที่แก้" });
        });
      }
    }, 260);
    timers.current.push(iv);
  };

  const started = ready > 0 || busy;
  const allReady = ready >= 4;

  return (
    <div className={f.root}>
      {/* ---------- Chat ---------- */}
      <section className={f.chat} aria-label="แชตสร้างหนัง">
        <header className={f.chatHead}>
          {heading && <Link href={heading.backHref} className={f.iconBtn} aria-label="กลับไปหน้าตอนทั้งหมด"><ArrowLeft size={18} /></Link>}
          <div className={f.chatTitle}>
            <strong>{heading?.title ?? (allReady ? STORY.title : "หนังเรื่องใหม่")}</strong>
            <span>{heading?.subtitle ?? (allReady ? "ตอนที่ 1 · บันทึกอัตโนมัติ" : "ยังไม่ได้ตั้งชื่อ")}</span>
          </div>
        </header>

        <div className={f.thread} ref={threadRef}>
          {messages.length === 0 && (
            <div className={f.welcome}>
              <span className={f.welcomeIcon}><Clapperboard size={22} /></span>
              <h2>อยากสร้างหนังเรื่องอะไร?</h2>
              <p>เล่าไอเดียสั้น ๆ ระบบจะวางเรื่อง ตัวละคร ฉาก และช็อตให้ แล้วคุณค่อยแก้ผ่านแชตนี้ได้ทุกจุด</p>
              <div className={f.chips}>
                {IDEAS.map((i) => <button type="button" key={i} className={f.chip} onClick={() => setDraft(i)}>{i}</button>)}
              </div>
            </div>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className={f.userMsg}>
                {m.context && <span className={f.ctxTag}>{m.context}</span>}
                <p>{m.text}</p>
              </div>
            ) : (
              <div key={m.id} className={f.aiMsg}>
                <span className={f.avatar} aria-hidden="true"><Sparkles size={14} /></span>
                <div className={f.aiBody}>
                  <p>{m.text}</p>
                  {m.stage && (
                    <button type="button" className={f.jump} onClick={() => m.stage && setTab(m.stage)}>
                      ดู{STAGES.find((s) => s.id === m.stage)?.label} →
                    </button>
                  )}
                  {m.chips && (
                    <div className={f.chips}>
                      {m.chips.map((c) => <button type="button" key={c} className={f.chip} onClick={() => setDraft(c)}>{c}</button>)}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className={f.aiMsg} role="status">
              <span className={f.avatar} aria-hidden="true"><Sparkles size={14} /></span>
              <div className={f.typing}><LoaderCircle size={14} className={f.spin} /> {ready === 0 ? "กำลังวางเรื่อง…" : `กำลังทำ${STAGES[Math.min(ready, 3)].label}…`}</div>
            </div>
          )}
        </div>

        <form className={f.composer} onSubmit={send}>
          {target && (
            <div className={f.target}>
              <Pencil size={13} /> กำลังแก้: <strong>{target.label}</strong>
              <button type="button" aria-label="ยกเลิกการเลือก" onClick={() => setTarget(null)}><X size={14} /></button>
            </div>
          )}
          <label htmlFor="film-prompt" className={f.sr}>ข้อความถึงผู้ช่วยสร้างหนัง</label>
          <textarea
            id="film-prompt"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={ready === 0 ? "เล่าไอเดียหนังของคุณ…" : target ? `บอกว่าอยากแก้${target.label}อย่างไร…` : "สั่งแก้อะไรก็ได้ หรือคลิกช็อตทางขวาเพื่อแก้เฉพาะจุด…"}
          />
          <div className={f.composerRow}>
            {ready === 0 ? (
              <div className={f.settings}>
                <button type="button"><Clock size={13} /> 2 นาที</button>
                <button type="button">16:9</button>
                <button type="button">สมจริง</button>
              </div>
            ) : <span className={f.hint}>Enter เพื่อส่ง · Shift+Enter ขึ้นบรรทัดใหม่</span>}
            <button type="submit" className={f.send} aria-label="ส่ง" disabled={busy || !draft.trim()}><ArrowUp size={18} /></button>
          </div>
        </form>
      </section>

      {/* ---------- Result ---------- */}
      <section className={f.result} aria-label="ผลลัพธ์">
        <nav className={f.stages} aria-label="ขั้นตอนของหนัง">
          {STAGES.map((s, i) => {
            const Icon = STAGE_ICON[s.id];
            const available = s.id === "film" ? allReady : i < ready;
            const working = busy && i === ready && s.id !== "film";
            const done = s.id === "film" ? film === "done" : i < ready;
            return (
              <button
                type="button"
                key={s.id}
                className={f.stage}
                data-active={tab === s.id && available}
                disabled={!available}
                onClick={() => setTab(s.id)}
              >
                <span className={f.stageIcon} data-done={done}>
                  {working ? <LoaderCircle size={15} className={f.spin} /> : done ? <Check size={15} /> : available ? <Icon size={15} /> : <Lock size={13} />}
                </span>
                <span className={f.stageText}><strong>{s.label}</strong><small>{s.hint}</small></span>
              </button>
            );
          })}
        </nav>

        <div className={f.body}>
          {!started && <EmptyResult />}
          {busy && ready === 0 && <Skeleton />}
          {ready > 0 && tab === "story" && <StoryPanel />}
          {ready > 1 && tab === "cast" && <CastPanel target={target} onPick={pick} />}
          {ready > 2 && tab === "elements" && <ElementsPanel />}
          {ready > 3 && tab === "shots" && <ShotsPanel target={target} edited={edited} onPick={pick} />}
          {allReady && tab === "film" && (
            <FilmPanel state={film} rendered={rendered} opts={opts} setOpts={setOpts} onStart={startFilm} edited={edited.length} />
          )}
        </div>

        {started && (
          <footer className={f.footer}>
            <div className={f.stats}>
              <span data-ok={allReady}><Clock size={14} /> {allReady ? "2:00 / 2:00" : "—"}</span>
              <span>{allReady ? `${SHOT_COUNT} ช็อต` : "กำลังแตกช็อต"}</span>
              {ready > 1 && <span>{CAST.length} ตัวละคร</span>}
              {edited.length > 0 && <span data-warn="true">แก้แล้ว {edited.length} ช็อต</span>}
            </div>
            {tab !== "film" ? (
              <button type="button" className={f.primary} disabled={!allReady} onClick={() => setTab("film")}>
                <Film size={16} /> ไปขั้นสร้างหนัง
              </button>
            ) : film === "idle" ? (
              <button type="button" className={f.primary} onClick={startFilm}><Play size={16} /> สร้างหนัง · [แต้ม]</button>
            ) : (
              <span className={f.footNote}>{film === "rendering" ? `กำลังสร้าง ${rendered}/${SHOT_COUNT} ช็อต` : "เสร็จแล้ว"}</span>
            )}
          </footer>
        )}
      </section>
    </div>
  );
}

/* ---------- Panels ---------- */

function EmptyResult() {
  return (
    <div className={f.empty}>
      <Film size={34} />
      <h2>หนังของคุณจะค่อย ๆ ก่อตัวตรงนี้</h2>
      <p>พิมพ์ไอเดียทางซ้าย ระบบจะทำทีละขั้นให้เห็น และแก้ได้ทุกขั้นก่อนกดสร้างหนังจริง</p>
      <ol className={f.emptySteps}>
        {STAGES.map((s, i) => <li key={s.id}><span>{i + 1}</span><strong>{s.label}</strong><small>{s.hint}</small></li>)}
      </ol>
    </div>
  );
}

function Skeleton() {
  return (
    <div className={f.skeleton} aria-hidden="true">
      <div style={{ width: "40%", height: 28 }} />
      <div style={{ width: "90%" }} />
      <div style={{ width: "75%" }} />
      <div style={{ width: "100%", height: 48, marginTop: 16 }} />
    </div>
  );
}

function StoryPanel() {
  return (
    <article className={f.panel}>
      <div className={f.titleRow}>
        <h1>{STORY.title}</h1>
        <div className={f.pills}>{STORY.meta.map((m) => <span key={m}>{m}</span>)}</div>
      </div>
      <p className={f.logline}>{STORY.logline}</p>
      <div className={f.twoCol}>
        <section className={f.box}>
          <h3>เรื่องย่อ</h3>
          <p>{STORY.synopsis}</p>
        </section>
        <section className={f.box}>
          <h3>แก่นเรื่อง</h3>
          <p>{STORY.theme}</p>
        </section>
      </div>
      <section>
        <h3 className={f.h3}>โครงเรื่อง · 2 นาที</h3>
        <div className={f.actBar}>
          {STORY.acts.map((a, i) => (
            <div key={a.label} style={{ width: pct(a.end - a.start) }} data-act={i}>
              <strong>{a.label}</strong>
              <small>{clock(a.start)}–{clock(a.end)} · {a.summary}</small>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}

function CastPanel({ target, onPick }: { target: Target | null; onPick: (t: Target) => void }) {
  return (
    <article className={f.panel}>
      <PanelHead title="ตัวละคร" note="ภาพตัวละครใช้เป็นต้นแบบทุกช็อต หน้าตาจึงตรงกันทั้งเรื่อง" />
      <div className={f.castGrid}>
        {CAST.map((c) => {
          const selected = target?.kind === "cast" && target.id === c.id;
          return (
            <div key={c.id} className={f.castCard} data-selected={selected}>
              <div className={f.portrait} style={{ background: c.tone }}>
                <span>{c.name.replace("ไอ้", "").slice(0, 1)}</span>
                <small>ภาพอ้างอิง</small>
              </div>
              <div className={f.castBody}>
                <div><strong>{c.name}</strong> <span className={f.muted}>· {c.age} ปี</span></div>
                <div className={f.role}>{c.role}</div>
                <p>{c.trait}</p>
                <p className={f.muted}>{c.look}</p>
                <div className={f.voice}><Mic size={13} /> {c.voice}</div>
                <div className={f.cardActions}>
                  <button type="button"><RefreshCw size={13} /> สร้างภาพใหม่</button>
                  <button type="button" aria-pressed={selected} onClick={() => onPick({ kind: "cast", id: c.id, label: `ตัวละคร ${c.name}` })}>
                    <Pencil size={13} /> แก้ในแชต
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ElementsPanel() {
  return (
    <article className={f.panel}>
      <PanelHead title="องค์ประกอบ" note="สิ่งที่ต้องเหมือนกันทุกช็อต ระบบจะใส่ให้อัตโนมัติในทุกช็อตที่เกี่ยวข้อง" />
      <h3 className={f.h3}>สถานที่</h3>
      <div className={f.locGrid}>
        {ELEMENTS.locations.map((l, i) => (
          <div key={l.name} className={f.loc}>
            <div className={f.locArt} style={{ background: SCENES[i * 2]?.tone ?? "#555" }}><span>ภาพสถานที่</span></div>
            <strong>{l.name}</strong>
            <small>{l.note}</small>
          </div>
        ))}
      </div>
      <div className={f.twoCol}>
        <section className={f.box}>
          <h3>ของสำคัญ</h3>
          <ul className={f.list}>
            {ELEMENTS.props.map((p) => <li key={p.name}><strong>{p.name}</strong><span>{p.spec}</span></li>)}
          </ul>
        </section>
        <section className={f.box}>
          <h3>โทนภาพ</h3>
          <ul className={f.list}>
            {ELEMENTS.look.map((l) => <li key={l.label}><strong>{l.label}</strong><span>{l.value}</span></li>)}
          </ul>
          <div className={f.palette}>
            {ELEMENTS.palette.map((c) => (
              <span key={c.hex}><i style={{ background: c.hex }} />{c.name}</span>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}

function ShotsPanel({ target, edited, onPick }: { target: Target | null; edited: string[]; onPick: (t: Target) => void }) {
  return (
    <article className={f.panel}>
      <PanelHead title="ฉากและช็อต" note="คลิกช็อตเพื่อเลือก แล้วพิมพ์สั่งแก้ในแชต" />
      <div className={f.timeline} aria-label="ไทม์ไลน์ 0:00 ถึง 2:00">
        {SCENES.map((s) => (
          <a key={s.id} href={`#scene-${s.id}`} style={{ width: pct(s.end - s.start), background: s.tone }}>
            <span>ฉาก {s.no}</span>
          </a>
        ))}
      </div>
      <div className={f.ticks}><span>0:00</span><span>0:30</span><span>1:00</span><span>1:30</span><span>2:00</span></div>

      {SCENES.map((s) => (
        <section key={s.id} id={`scene-${s.id}`} className={f.scene}>
          <header className={f.sceneHead}>
            <span className={f.sceneNo} style={{ background: s.tone }}>{s.no}</span>
            <div>
              <strong>{s.title}</strong>
              <small>{s.heading}</small>
            </div>
            <span className={f.range}>{clock(s.start)}–{clock(s.end)}</span>
          </header>
          <div className={f.shotGrid}>
            {s.shots.map((sh) => {
              const selected = target?.kind === "shot" && target.id === sh.id;
              const isEdited = edited.includes(sh.id);
              return (
                <button
                  type="button"
                  key={sh.id}
                  className={f.shot}
                  data-selected={selected}
                  aria-pressed={selected}
                  onClick={() => onPick({ kind: "shot", id: sh.id, label: `ช็อต ${sh.no}` })}
                >
                  <span className={f.frame} style={{ background: s.tone }}>
                    <span className={f.frameNo}>{sh.no}</span>
                    <span className={f.frameType}>{sh.type}</span>
                    {isEdited && <span className={f.badge}><RefreshCw size={11} /> แก้แล้ว · รอสร้างภาพ</span>}
                  </span>
                  <span className={f.shotMeta}><Clock size={12} /> {clock(sh.start)}–{clock(sh.end)} · {sh.end - sh.start} วิ</span>
                  <span className={f.action}>{sh.action}</span>
                  {sh.lines?.map((l) => (
                    <span key={l.text} className={f.line}><b>{l.who}:</b> “{l.text}”</span>
                  ))}
                  {sh.sound && <span className={f.sound}><Music size={12} /> {sh.sound}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </article>
  );
}

function FilmPanel({
  state, rendered, opts, setOpts, onStart, edited,
}: {
  state: FilmState;
  rendered: number;
  opts: { voice: boolean; music: boolean; subs: boolean; review: boolean };
  setOpts: (o: { voice: boolean; music: boolean; subs: boolean; review: boolean }) => void;
  onStart: () => void;
  edited: number;
}) {
  if (state === "idle") {
    const toggle = (k: keyof typeof opts) => setOpts({ ...opts, [k]: !opts[k] });
    const options: { k: keyof typeof opts; label: string; note: string }[] = [
      { k: "voice", label: "เสียงพากย์ไทย", note: "ตามบทพูดและเสียงบรรยาย เสียงตามที่กำหนดในตัวละคร" },
      { k: "music", label: "ดนตรีและเสียงบรรยากาศ", note: "ตามคิวเสียงของแต่ละช็อต" },
      { k: "subs", label: "ซับไตเติล", note: "สร้างจากบทพูด แก้ได้ใน AI ตัดต่อ" },
      { k: "review", label: "ให้ฉันตรวจคลิปก่อนรวม", note: "ถ้าไม่เลือก ระบบรวมเป็นหนังให้อัตโนมัติ" },
    ];
    return (
      <article className={f.panel}>
        <PanelHead title="พร้อมสร้างหนัง" note="ตรวจสรุปและค่าใช้จ่ายก่อนกดสร้าง" />
        <div className={f.summary}>
          <div><strong>2:00</strong><small>ความยาว</small></div>
          <div><strong>{SHOT_COUNT}</strong><small>ช็อต</small></div>
          <div><strong>{CAST.length}</strong><small>ตัวละคร</small></div>
          <div><strong>1080p</strong><small>16:9 · 24fps</small></div>
        </div>
        <div className={f.twoCol}>
          <section className={f.box}>
            <h3>ตัวเลือก</h3>
            {options.map((o) => (
              <label key={o.k} className={f.option}>
                <input type="checkbox" checked={opts[o.k]} onChange={() => toggle(o.k)} />
                <span><strong>{o.label}</strong><small>{o.note}</small></span>
              </label>
            ))}
          </section>
          <section className={f.box}>
            <h3>ค่าใช้จ่าย</h3>
            <dl className={f.cost}>
              <div><dt>วิดีโอ {SHOT_COUNT} ช็อต</dt><dd>[แต้ม]</dd></div>
              {opts.voice && <div><dt>เสียงพากย์</dt><dd>[แต้ม]</dd></div>}
              {opts.music && <div><dt>ดนตรีและเสียง</dt><dd>[แต้ม]</dd></div>}
              <div><dt>รวมไฟล์</dt><dd>ฟรี</dd></div>
              <div className={f.total}><dt>รวม</dt><dd>[แต้ม]</dd></div>
            </dl>
            <p className={f.muted}>ช็อตที่สร้างไม่สำเร็จจะคืนแต้มอัตโนมัติ{edited > 0 ? ` · มีช็อตที่แก้แล้ว ${edited} ช็อต ระบบจะสร้างภาพใหม่ให้ก่อน` : ""}</p>
            <button type="button" className={f.primary} onClick={onStart}><Play size={16} /> สร้างหนัง</button>
          </section>
        </div>
      </article>
    );
  }

  const progress = Math.round((rendered / SHOT_COUNT) * 100);
  const shots = SCENES.flatMap((s) => s.shots.map((sh) => ({ ...sh, tone: s.tone })));
  return (
    <article className={f.panel}>
      <PanelHead title={state === "done" ? STORY.title : "กำลังสร้างหนัง"} note={state === "done" ? "ตอนที่ 1 · 2:00 · 1080p" : "ปิดหน้านี้ได้ ระบบจะแจ้งเตือนเมื่อเสร็จ"} />
      <div className={f.player}>
        {state === "done" ? (
          <>
            <span className={f.playerTitle}>{STORY.title}</span>
            <button type="button" className={f.play} aria-label="เล่นหนัง"><Play size={26} /></button>
          </>
        ) : (
          <div className={f.renderBox}>
            <LoaderCircle size={22} className={f.spin} />
            <strong>{progress}%</strong>
            <small>{rendered < SHOT_COUNT ? `สร้างวิดีโอช็อต ${String(rendered + 1).padStart(2, "0")}` : "รวมเสียงและไฟล์"}</small>
            <div className={f.progress}><i style={{ width: `${progress}%` }} /></div>
          </div>
        )}
      </div>
      <div className={f.strip} aria-label="สถานะแต่ละช็อต">
        {shots.map((sh, i) => (
          <span key={sh.id} style={{ flexGrow: sh.end - sh.start, background: i < rendered ? sh.tone : undefined }} data-done={i < rendered}>
            {sh.no}
          </span>
        ))}
      </div>
      {state === "done" && (
        <div className={f.doneActions}>
          <button type="button" className={f.primary}><Download size={16} /> ดาวน์โหลด MP4</button>
          <button type="button" className={f.secondary}><Scissors size={16} /> เปิดใน AI ตัดต่อ</button>
          <button type="button" className={f.secondary}><Plus size={16} /> สร้างตอนที่ 2</button>
        </div>
      )}
    </article>
  );
}

function PanelHead({ title, note }: { title: string; note: string }) {
  return (
    <div className={f.panelHead}>
      <h2>{title}</h2>
      <p>{note}</p>
    </div>
  );
}
