"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { ShowcaseItem } from "@/lib/showcase";
import { isLandscape } from "./showcase-pick";
import s from "./landing.module.css";

/**
 * A real showcase clip filling its (positioned) parent. Portrait clips in a wide frame are
 * letterboxed over a blurred copy of their poster instead of being cropped to a sliver.
 * Plays only while on screen and never under prefers-reduced-motion.
 */
export function ShowcaseMedia({ item, className, style, paused }: { item: ShowcaseItem; className?: string; style?: CSSProperties; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const fit = isLandscape(item) ? "cover" : "contain";

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.pause();
      return;
    }
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? void el.play().catch(() => {}) : el.pause()), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [paused, item.mediaUrl]);

  return (
    <div className={[s.media, className].filter(Boolean).join(" ")} style={style}>
      {fit === "contain" && item.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image would cache it past expiry
        <img className={s.mediaBackdrop} src={item.thumbnailUrl} alt="" aria-hidden />
      )}
      <video
        ref={video}
        key={item.mediaUrl}
        className={s.mediaVideo}
        style={{ objectFit: fit }}
        src={item.mediaUrl}
        poster={item.thumbnailUrl ?? undefined}
        muted
        loop
        playsInline
        preload="none"
        aria-label={item.title}
      />
    </div>
  );
}

/** A still showcase image (character or product) filling its positioned parent. */
export function ShowcaseStill({ item, fit = "cover", className }: { item: ShowcaseItem; fit?: "cover" | "contain"; className?: string }) {
  return (
    <div className={[s.media, className].filter(Boolean).join(" ")}>
      {fit === "contain" && (
        // eslint-disable-next-line @next/next/no-img-element -- see ShowcaseMedia
        <img className={s.mediaBackdrop} src={item.mediaUrl} alt="" aria-hidden />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- see ShowcaseMedia */}
      <img className={s.mediaVideo} style={{ objectFit: fit }} src={item.mediaUrl} alt={item.title} />
    </div>
  );
}

/** Still frame (poster) of a clip, for filmstrips. */
export function ShowcasePoster({ item, style }: { item: ShowcaseItem; style?: CSSProperties }) {
  if (!item.thumbnailUrl) return null;
  // eslint-disable-next-line @next/next/no-img-element -- see ShowcaseMedia
  return <img className={s.mediaPoster} src={item.thumbnailUrl} alt="" aria-hidden style={style} />;
}
