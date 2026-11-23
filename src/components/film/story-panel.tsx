"use client";
// Step 1 of an episode: the story the planning assistant wrote.
import { MessagesSquare } from "lucide-react";
import { STYLE_LABEL, clock, type FilmEpisode } from "@/lib/film-api";
import f from "./film.module.css";
import x from "./film-work.module.css";

export function StoryPanel({ ep, title, total }: { ep: FilmEpisode; title: string; total: number }) {
  if (!ep.story) {
    return (
      <div className={x.center}>
        <MessagesSquare />
        <h3>ยังไม่ได้วางเรื่อง</h3>
        <p>เล่าไอเดียในแชตทางซ้าย เลือกความยาว แล้วกดส่ง ผู้ช่วยจะเขียนเรื่องย่อ สร้างองค์ประกอบ และแตกเป็นช็อตให้</p>
      </div>
    );
  }
  return (
    <>
      <div className={f.titleRow}><h1>{ep.story.title || title}</h1><div className={f.pills}><span>{clock(total)}</span><span>{ep.aspectRatio}</span><span>{STYLE_LABEL[ep.style] ?? ep.style}</span></div></div>
      {ep.story.logline && <p className={f.logline}>{ep.story.logline}</p>}
      <div className={f.twoCol}>
        <section className={f.box}><h3>เรื่องย่อ</h3><p>{ep.story.synopsis || "—"}</p></section>
        <section className={f.box}><h3>แก่นเรื่อง</h3><p>{ep.story.theme || "—"}</p></section>
      </div>
      <p className={x.hint}>อยากเปลี่ยนเรื่อง พิมพ์บอกผู้ช่วยในแชต หรือแก้รายละเอียดเองในขั้นองค์ประกอบและสตูดิโอ</p>
    </>
  );
}
