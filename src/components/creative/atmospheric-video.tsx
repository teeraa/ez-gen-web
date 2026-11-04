"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export function AtmosphericVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) video.current?.pause();
      else void video.current?.play().catch(() => setPlaying(false));
    };
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);

  async function toggle() {
    if (!video.current) return;
    if (playing) video.current.pause();
    else await video.current.play().catch(() => setPlaying(false));
  }

  return (
    <>
      <div className="atmospheric-background" aria-hidden="true">
        <video
          ref={video}
          width={1280}
          height={720}
          poster="/media/studio-landscape-poster.jpg"
          muted
          loop
          playsInline
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className={reducedMotion ? "motion-static" : undefined}
        >
          <source src="/media/studio-landscape.mp4" type="video/mp4" media="(prefers-reduced-motion: no-preference)" />
        </video>
      </div>
      <button
        type="button"
        className="background-playback"
        onClick={toggle}
        aria-pressed={playing}
        disabled={reducedMotion}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
        {reducedMotion ? "ภาพนิ่ง · ลดการเคลื่อนไหว" : playing ? "หยุดภาพพื้นหลัง" : "เล่นภาพพื้นหลัง"}
      </button>
    </>
  );
}
