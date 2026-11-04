"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import type { ShowcaseItem } from "@/lib/showcase";
import { Figure, Scene } from "./scenes";
import { ShowcaseMedia, ShowcaseStill } from "./showcase-media";
import { pickLandscape } from "./showcase-pick";
import s from "./landing.module.css";

const STEPS = [
  { title: "สร้างตัวละคร", body: "อธิบายหรือแนบภาพอ้างอิง ระบบจะบันทึกเข้าคลังไว้ใช้ซ้ำ" },
  { title: "เขียนฉากและบทพูด", body: "บอกท่าทาง บรรยากาศ และสิ่งที่ตัวละครพูดเป็นภาษาไทย" },
  { title: "ดูแบบร่าง 480p", body: "เร็วและประหยัด เห็นจังหวะและมุมกล้องก่อนตัดสินใจ" },
  { title: "สร้างฉบับสมบูรณ์ 1080p", body: "ต่อยอดจากร่างเดิม ได้ไฟล์คมชัดพร้อมเผยแพร่" },
];
const STEP_MS = 4200;

export function FlowDemo({ items = [], shots = [], character }: { items?: ShowcaseItem[]; shots?: ShowcaseItem[]; character?: ShowcaseItem }) {
  // Tell one story when real assets exist: the library character, then a shot made with it.
  const clip = shots[0] ?? pickLandscape(items);
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  // Start cycling only once the stage scrolls into view.
  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting), { threshold: 0.3 });
    if (stage.current) io.observe(stage.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setActive((i) => (i + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(timer);
  }, [active, running]);

  const panel = (i: number) => `${s.panel} ${active === i ? s.panelOn : ""}`;

  return (
    <div className={s.flow}>
      <div className={s.steps}>
        {STEPS.map((step, i) => (
          <button key={step.title} type="button" className={`${s.step} ${active === i ? s.stepOn : ""}`} aria-pressed={active === i} onClick={() => setActive(i)}>
            <span className={s.stepN}>{i + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
            {/* Re-keyed so the progress bar restarts whenever the step changes. */}
            <i key={active === i ? `on-${active}` : "off"} className={s.stepBar} />
          </button>
        ))}
      </div>

      <div className={`${s.stage} ${s.reveal} ${s.d1}`} ref={stage} aria-live="polite">
        <div className={panel(0)}>
          {character ? (
            <ShowcaseStill item={character} fit="contain" />
          ) : (
            <>
              <Scene kind="anime" still />
              <Figure style={{ width: "26%" }} />
            </>
          )}
          <div className={s.ui} style={{ left: 20, top: 20 }}>
            <small>ตัวละครใหม่</small>
            {character ? character.title : "มายา · นักสำรวจผมสีเงิน"}
            <br />
            <span className={s.lock}>
              <Lock size={12} />
              ล็อกหน้าและชุดแล้ว
            </span>
          </div>
        </div>
        <div className={panel(1)}>
          {clip ? <ShowcaseMedia item={clip} paused={active !== 1} /> : <><Scene kind="sunset" /><Figure style={{ width: "22%", left: "40%" }} /></>}
          <div className={s.ui} style={{ right: 20, bottom: 20, maxWidth: 280 }}>
            <small>บทพูด</small>{shots.length ? "“ศิษย์สำนักใด กล้ามาท้าข้า”" : "“เส้นทางนี้... ฉันเคยเห็นในความฝัน”"}
          </div>
          <div className={s.ui} style={{ left: 20, top: 20 }}>
            <small>ฉาก</small>{shots.length ? "เผชิญหน้าคู่ต่อสู้บนยอดเขา ชักกระบี่ช้า ๆ" : "ยืนบนเนินเขายามเย็น กล้องค่อย ๆ ดันเข้า"}
          </div>
        </div>
        <div className={panel(2)}>
          {clip ? (
            <ShowcaseMedia item={clip} className={s.pix} paused={active !== 2} />
          ) : (
            <>
              <Scene kind="sunset" className={s.pix} />
              <Figure className={s.pix} style={{ width: "22%", left: "40%" }} />
            </>
          )}
          <div className={s.ui} style={{ left: 20, bottom: 20 }}>
            <small>กำลังสร้างแบบร่าง</small>480p · 5 วินาที
            <div className={s.prog}>
              <i key={active === 2 ? "run" : "idle"} />
            </div>
          </div>
          <span className={`${s.res} ${s.resDraft}`}>480p</span>
        </div>
        <div className={panel(3)}>
          {clip ? (
            <ShowcaseMedia item={clip} className={s.unblur} paused={active !== 3} />
          ) : (
            <>
              <Scene kind="sunset" className={s.unblur} />
              <Figure className={s.unblur} style={{ width: "22%", left: "40%" }} />
            </>
          )}
          <div className={s.ui} style={{ left: 20, bottom: 20 }}>
            <small>ฉบับสมบูรณ์</small>พร้อมดาวน์โหลด · แชร์ลิงก์ได้
          </div>
          <span className={s.res}>1080p</span>
        </div>
      </div>
    </div>
  );
}
