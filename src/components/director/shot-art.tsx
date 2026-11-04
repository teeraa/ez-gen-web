"use client";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { mediaUrl } from "@/lib/director-api";
export function ShotArt({ url, label = "ภาพ", onError }: { url?: string | null; label?: string; onError?: () => void }) {
  const src = mediaUrl(url);
  if (!src) return <span style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "var(--wb-card-2)", color: "var(--wb-muted)" }}><ImageIcon aria-label="ยังไม่มีภาพ" /></span>;
  return <Image unoptimized fill sizes="100vw" src={src} alt={label} style={{ objectFit: "cover" }} onError={onError} />;
}
export function ShotVideo({ url, poster, label, onError }: { url?: string | null; poster?: string | null; label: string; onError?: () => void }) {
  const src = mediaUrl(url);
  if (!src) return null;
  return <video key={src} src={src} poster={mediaUrl(poster)} controls playsInline preload="metadata" aria-label={label} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", background: "#000" }} onError={onError} />;
}
