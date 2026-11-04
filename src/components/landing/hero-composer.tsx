"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Check, Clock, RectangleHorizontal, RectangleVertical, Scissors, ShoppingBag, User, Video, type LucideIcon } from "lucide-react";
import s from "./landing.module.css";

type ModeId = "video" | "character" | "product" | "story" | "editor";
type Mode = { id: ModeId; label: string; icon: LucideIcon; examples: string[] };

const MODES: Mode[] = [
  { id: "video", label: "วิดีโอ", icon: Video, examples: ["มายาเดินผ่านตลาดน้ำยามเช้า หันมายิ้มให้กล้อง แล้วพูดว่า “มาเที่ยวด้วยกันไหม”", "พรีเซนเตอร์ถือเซรั่ม หันฉลากเข้ากล้อง แสงสตูดิโอนุ่ม", "ละครสั้นแนวตั้ง หญิงสาวเปิดจดหมายในคืนฝนตก"] },
  { id: "character", label: "ตัวละคร", icon: User, examples: ["นักสำรวจผมสีเงิน เสื้อคลุมสีครีม ผ้าพันคอม่วง ดวงตาอบอุ่น", "ชายวัยกลางคน ใส่แว่นกรอบหนา เสื้อเชิ้ตลายสก็อต"] },
  { id: "product", label: "ภาพสินค้า", icon: ShoppingBag, examples: ["ขวดน้ำหอมทรงเหลี่ยม แก้วใสฝาทอง บนผ้าซาตินสีครีม", "รองเท้าวิ่งสีขาว ลอยกลางอากาศ พื้นหลังไล่สีพาสเทล"] },
  { id: "story", label: "เรื่องยาว", icon: BookOpen, examples: ["เรื่องของเด็กสาวที่พบแมวพูดได้ในร้านหนังสือเก่า 5 ฉาก"] },
  { id: "editor", label: "AI ตัดต่อ", icon: Scissors, examples: ["ตัดไลฟ์ขายของ 1 ชั่วโมง ให้เหลือคลิปไฮไลต์ 60 วินาที"] },
];

const SUGGESTIONS = [
  { label: "พรีเซนเตอร์รีวิวสินค้า", prompt: "พรีเซนเตอร์ยืนข้างสินค้า ยิ้มแล้วผายมือแนะนำสินค้า แสงสตูดิโอนุ่มนวล" },
  { label: "ละครสั้นแนวตั้ง", prompt: "ละครสั้นแนวตั้ง หญิงสาวเปิดจดหมายในคืนฝนตก แล้วเงยหน้ามองกล้อง" },
  { label: "โฆษณาน้ำหอม", prompt: "ขวดน้ำหอมหมุนช้า ๆ บนผ้าซาติน แสงทองส่องผ่าน กล้องเคลื่อนรอบสินค้า" },
  { label: "คลิปสอนหน้ากระดาน", prompt: "ยืนอธิบายหน้ากระดาน ใช้มือประกอบคำอธิบาย กล้องระดับสายตา" },
  { label: "ทักทายโซเชียล", prompt: "ยิ้มทักทายและโบกมือให้กล้อง บรรยากาศสดใส กล้องค่อย ๆ เคลื่อนเข้าใกล้" },
];

const DURATIONS = [5, 8, 10] as const;

// Same sessionStorage keys the studio already restores from, so the idea survives sign-in.
const PIPELINE_DRAFT_KEY = "violet-pipeline-draft";
const CHARACTER_DRAFT_KEY = "violet-character-draft";

type VideoOptions = { vertical: boolean; duration: number; draft: boolean };

function persistAndRoute(mode: ModeId, prompt: string, { vertical, duration, draft }: VideoOptions): string {
  try {
    if (mode === "video") 
      sessionStorage.setItem(
        PIPELINE_DRAFT_KEY,
        JSON.stringify({ character: "", scene: prompt, dialogue: "", aspectRatio: vertical ? "9:16" : "16:9", durationSeconds: duration, draft }),
      );
    if (mode === "character" || mode === "product")
      sessionStorage.setItem(CHARACTER_DRAFT_KEY, JSON.stringify({ version: 1, category: mode, prompt, aspectRatio: mode === "product" ? "1:1" : vertical ? "9:16" : "3:4" }));
  } catch {}
  switch (mode) {
    case "video":
      return "/studio";
    case "character":
      return "/studio/images";
    case "product":
      return "/studio/images?category=product";
    case "story":
      return "/studio/story-flow";
    case "editor":
      return "/studio/ai-editor";
  }
}

export function HeroComposer() {
  const router = useRouter();
  const [mode, setMode] = useState<ModeId>("video");
  const [prompt, setPrompt] = useState("");
  const [typed, setTyped] = useState("");
  const [vertical, setVertical] = useState(true);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(5);
  const [draft, setDraft] = useState(true);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const composer = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const examples = MODES.find((m) => m.id === mode)!.examples;

  useLayoutEffect(() => {
    const place = () => {
      const el = tabs.current[mode];
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    };
    place();
    window.addEventListener("resize", place);
    void document.fonts?.ready.then(place);
    return () => window.removeEventListener("resize", place);
  }, [mode]);

  // Typewriter placeholder cycling through the current mode's examples.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(examples[0]);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let index = 0;
    const type = (text: string, k: number) => {
      setTyped(text.slice(0, k));
      timer = k < text.length ? setTimeout(() => type(text, k + 1), 38) : setTimeout(() => erase(text, text.length), 2200);
    };
    const erase = (text: string, k: number) => {
      setTyped(text.slice(0, k));
      if (k > 0) timer = setTimeout(() => erase(text, k - 1), 14);
      else {
        index = (index + 1) % examples.length;
        timer = setTimeout(() => type(examples[index], 0), 300);
      }
    };
    type(examples[0], 0);
    return () => clearTimeout(timer);
  }, [examples]);

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const box = composer.current?.getBoundingClientRect();
    if (!box) return;
    composer.current!.style.setProperty("--mx", `${event.clientX - box.left}px`);
    composer.current!.style.setProperty("--my", `${event.clientY - box.top}px`);
  }

  function submit() {
    const text = prompt.trim() || examples[0];
    router.push(persistAndRoute(mode, text, { vertical, duration, draft }));
  }

  const showVideoOptions = mode === "video";

  return (
    <>
      <div className={`${s.composer} ${s.reveal} ${s.d3}`} ref={composer} onPointerMove={onPointerMove}>
        <form
          className={s.composerIn}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className={s.glow} aria-hidden />
          <div className={s.modes} role="tablist" aria-label="เลือกสิ่งที่จะสร้าง">
            <span className={s.modeInd} style={indicator} aria-hidden />
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                ref={(el) => {
                  tabs.current[id] = el;
                }}
                className={`${s.mode} ${mode === id ? s.modeOn : ""}`}
                onClick={() => setMode(id)}
              >
                <Icon size={16} strokeWidth={1.8} />
                {label}
              </button>
            ))}
          </div>
          <div className={s.promptArea}>
            <label htmlFor="landing-prompt" className={s.srOnly}>
              อธิบายสิ่งที่อยากสร้าง
            </label>
            <textarea
              id="landing-prompt"
              ref={textarea}
              value={prompt}
              maxLength={2000}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
              }}
            />
            {!prompt && (
              <div className={s.ph} aria-hidden>
                {typed}
                <span className={s.caret} />
              </div>
            )}
          </div>
          <div className={s.tools}>
            {showVideoOptions && (
              <>
                <button type="button" className={s.chip} onClick={() => setVertical((v) => !v)} aria-label={`สัดส่วน ${vertical ? "9:16" : "16:9"}`}>
                  {vertical ? <RectangleVertical size={13} /> : <RectangleHorizontal size={13} />}
                  {vertical ? "9:16" : "16:9"}
                </button>
                <button
                  type="button"
                  className={s.chip}
                  onClick={() => setDuration((d) => DURATIONS[(DURATIONS.indexOf(d) + 1) % DURATIONS.length])}
                  aria-label={`ความยาว ${duration} วินาที`}
                >
                  <Clock size={13} />
                  {duration} วิ
                </button>
                <button type="button" className={s.chip} aria-pressed={draft} onClick={() => setDraft((d) => !d)}>
                  <span className={`${s.switch} ${draft ? s.switchOn : ""}`} aria-hidden />
                  แบบร่าง 480p
                </button>
              </>
            )}
            <span className={s.spacer} />
            <span className={s.costNote}>เห็นราคาก่อนกดสร้างทุกครั้ง</span>
            <button type="submit" className={s.send} aria-label="เริ่มสร้าง">
              <ArrowRight size={20} strokeWidth={2} />
            </button>
          </div>
        </form>
      </div>

      <div className={`${s.suggest} ${s.reveal} ${s.d3}`}>
        {SUGGESTIONS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              setMode("video");
              setPrompt(item.prompt);
              textarea.current?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={`${s.trust} ${s.reveal} ${s.d3}`}>
        <span>
          <Check size={13} />
          ลองแบบร่างก่อนสร้างจริง
        </span>
        <span>
          <Check size={13} />
          ตัวละครคงเดิมทุกฉาก
        </span>
        <span>
          <Check size={13} />
          บทพูดภาษาไทย
        </span>
      </div>
    </>
  );
}
