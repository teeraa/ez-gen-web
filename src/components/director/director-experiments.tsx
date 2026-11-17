"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { directorApi, mediaUrl, type Experiment } from "@/lib/director-api";
import w from "@/components/workbench/workbench.module.css";

const RECIPES: Record<string, string> = { pose3d: "base · 3D pose", faceless: "A1 · ไม่มีหน้า", clay: "A2 · หุ่นดินเทา", textonly: "A3 · ไม่มีภาพ" };
const ORDER = ["pose3d", "faceless", "clay", "textonly"];

// Experiment A comparison: one row per shot, one column per recipe, newest run of each.
export function DirectorExperiments({ id }: { id: string }) {
  const [items, setItems] = useState<Experiment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => directorApi.experiments(id, controller.signal).then(setItems).catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e)); });
    void load();
    const timer = setInterval(() => { void load(); }, 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [id]);
  if (error) return <div className={w.page}><p role="alert">{error}</p></div>;
  if (!items) return <div className={w.page}><p role="status">กำลังโหลดผลทดลอง…</p></div>;
  const shots = Array.from(new Map(items.map(x => [x.shotId, x.shot])).entries()).sort((a, b) => a[1].localeCompare(b[1], "th", { numeric: true }));
  const latest = (shotId: string, recipe: string) => items.find(x => x.shotId === shotId && x.recipe === recipe);
  const stats = ORDER.map(r => { const runs = items.filter(x => x.recipe === r); return { r, runs: runs.length, rejected: runs.filter(x => x.status !== "succeeded").length }; });
  return <div className={w.page}>
    <p><Link href={`/studio/director/${id}`}>← กลับไปโปรเจกต์</Link></p>
    <h1>ผลทดลอง A · เทียบสูตรภาพอ้างอิง</h1>
    <p>{stats.map(s => `${RECIPES[s.r]}: ${s.runs} ครั้ง ไม่สำเร็จ ${s.rejected}`).join(" · ")}</p>
    {shots.length === 0 && <p>ยังไม่มีผล ตั้งสูตรแล้วสร้างวิดีโอก่อน</p>}
    <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${ORDER.length}, minmax(0, 1fr))`, gap: 12, alignItems: "start", overflowX: "auto" }}>
      <b />{ORDER.map(r => <b key={r}>{RECIPES[r]}</b>)}
      {shots.map(([shotId, label]) => <div key={shotId} style={{ display: "contents" }}>
        <b>{label}</b>
        {ORDER.map(r => { const x = latest(shotId, r); return <div key={r} style={{ minWidth: 0 }}>
          {!x ? <small>—</small> : x.status === "succeeded" && x.videoUrl
            ? <><video src={mediaUrl(x.videoUrl)} poster={mediaUrl(x.frameUrl)} controls playsInline preload="metadata" style={{ width: "100%", borderRadius: 8, background: "#000" }} /><small>{x.path === "continued" ? "ต่อจากคลิปก่อน" : "shot แรกของฉาก"} · {new Date(x.at).toLocaleString("th-TH")}</small></>
            : <small role="status">ไม่สำเร็จ · {x.failureCode ?? x.status}</small>}
        </div>; })}
      </div>)}
    </div>
  </div>;
}
