"use client";

import { useEffect, useRef, useState } from "react";
import type { ShowcaseItem } from "@/lib/showcase";
import { Figure, Scene, type SceneKey } from "./scenes";
import s from "./landing.module.css";

type Fallback = { scene: SceneKey; title: string; subtitle: string; duration: string; figure: boolean; tall: boolean };

const FALLBACK: Fallback[] = [
  { scene: "sunset", title: "ทางกลับบ้าน", subtitle: "Seedance", duration: "8 วิ", figure: true, tall: false },
  { scene: "neon", title: "คืนที่เมืองไม่หลับ", subtitle: "Seedance", duration: "5 วิ", figure: true, tall: true },
  { scene: "studio", title: "น้ำหอม Lumière", subtitle: "ภาพสินค้า", duration: "ภาพ", figure: false, tall: false },
  { scene: "ocean", title: "ทะเลเดือนเมษา", subtitle: "แบบร่าง 480p", duration: "5 วิ", figure: true, tall: false },
  { scene: "anime", title: "ฤดูร้อนของมายา", subtitle: "Seedance", duration: "10 วิ", figure: true, tall: true },
  { scene: "forest", title: "ป่าแห่งแสง", subtitle: "Seedance", duration: "8 วิ", figure: false, tall: false },
];

const TALL = new Set(["9:16", "3:4", "4:5"]);

/** Repeat a short list until one copy is wider than the viewport, then duplicate it for a seamless loop. */
function loop<T>(list: T[], min = 6): T[] {
  if (!list.length) return [];
  let base = list;
  while (base.length < min) base = base.concat(list);
  return base.concat(base);
}

function VideoCard({ item }: { item: ShowcaseItem }) {
  const card = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);

  // The reel repeats every clip several times; only cards on screen get a real <video>,
  // the rest show the poster, so the page never opens dozens of video streams at once.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !card.current) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.25 });
    io.observe(card.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={card} className={`${s.card} ${TALL.has(item.aspectRatio) ? s.cardTall : ""}`}>
      {onScreen ? (
        <video className={s.cardVideo} src={item.mediaUrl} poster={item.thumbnailUrl ?? undefined} muted loop playsInline autoPlay aria-label={item.title} />
      ) : (
        item.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image would cache it past expiry
          <img className={s.cardVideo} src={item.thumbnailUrl} alt={item.title} loading="lazy" />
        )
      )}
      <div className={s.meta}>
        <span>
          <b>{item.title}</b>
          {item.subtitle}
        </span>
        <i>{item.duration} วิ</i>
      </div>
    </div>
  );
}

function FallbackCard({ item, delay }: { item: Fallback; delay: number }) {
  return (
    <div className={`${s.card} ${item.tall ? s.cardTall : ""}`} aria-hidden>
      <Scene kind={item.scene} style={{ animationDelay: `-${delay * 2}s` }} />
      {item.figure && <Figure />}
      <div className={s.meta}>
        <span>
          <b>{item.title}</b>
          {item.subtitle}
        </span>
        <i>{item.duration}</i>
      </div>
    </div>
  );
}

export function ShowcaseReel({ items }: { items: ShowcaseItem[] }) {
  const live = items.length >= 3;

  if (live) {
    const half = Math.ceil(items.length / 2);
    const first = items.slice(0, half).concat(items.slice(half));
    const second = items.slice(half).concat(items.slice(0, half)).reverse();
    return (
      <div className={s.reel} aria-label="ตัวอย่างผลงาน">
        <div className={s.track}>
          {loop(first).map((item, i) => (
            <VideoCard key={`a${i}`} item={item} />
          ))}
        </div>
        <div className={`${s.track} ${s.trackRev}`}>
          {loop(second).map((item, i) => (
            <VideoCard key={`b${i}`} item={item} />
          ))}
        </div>
      </div>
    );
  }

  const reversed = [...FALLBACK].reverse().map((item, i) => ({ ...item, figure: item.scene !== "studio" && i % 2 === 1, tall: i % 3 === 1 }));
  return (
    <div className={s.reel} aria-label="ตัวอย่างผลงาน">
      <div className={s.track}>
        {loop(FALLBACK, 6).map((item, i) => (
          <FallbackCard key={`a${i}`} item={item} delay={i} />
        ))}
      </div>
      <div className={`${s.track} ${s.trackRev}`}>
        {loop(reversed, 6).map((item, i) => (
          <FallbackCard key={`b${i}`} item={item} delay={i} />
        ))}
      </div>
    </div>
  );
}
