"use client";
import Link from "next/link";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Clapperboard, Copy, ExternalLink, Film, Loader2, Plus, Send, Trash2 } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import m from "./marketplace.module.css";
import { directorApi } from "@/lib/director-api";
import { CONTENT_KIND_LABEL, baht, failText, marketplaceApi, thaiDate, type AdAngle, type Content, type ContentKind, type Product } from "@/lib/marketplace-api";

export interface ContentDraft { kind: ContentKind; title: string; brief: string }

const BRIEF_MAX = 4000;

/** Where each kind of content is made, and which series list a finished work can be linked from. */
const STUDIO: Record<ContentKind, { href: string; label: string; mode: "director" | "film"; refType: "director_series" | "film_series"; workHref: (id: string) => string }> = {
  promo_video: { href: "/studio/director", label: "เปิดหน้าผู้กำกับ", mode: "director", refType: "director_series", workHref: (id) => `/studio/director/series/${id}` },
  short_film: { href: "/studio/film", label: "เปิดหน้าสร้างหนัง", mode: "film", refType: "film_series", workHref: (id) => `/studio/film/${id}` },
};

/** Text the user pastes into the Director or film page; built only from what they entered (and an AI angle, if picked). */
export function briefFor(p: Product, kind: ContentKind, angle?: AdAngle): string {
  const lines = [
    `${CONTENT_KIND_LABEL[kind]}สำหรับสินค้า “${p.name}”`,
    p.category && `หมวด: ${p.category}`,
    p.price > 0 && `ราคา: ${baht(p.price)}`,
    p.description && `รายละเอียด: ${p.description}`,
    p.sellingPoints && `จุดขาย: ${p.sellingPoints}`,
    angle && `แนวทาง: ${angle.format} — ${angle.title}`,
    angle?.hook && `ประโยคเปิด: ${angle.hook}`,
    angle && angle.outline.length > 0 && `ลำดับ:\n${angle.outline.map((step, i) => `${i + 1}. ${step}`).join("\n")}`,
    kind === "short_film"
      ? "รูปแบบ: หนังสั้น 30-60 วินาที เล่าเป็นเรื่อง มีตัวละครและจุดพลิกก่อนเผยสินค้า ปิดด้วยสินค้าชัด ๆ"
      : "รูปแบบ: คลิปแนวตั้ง 9:16 ยาว 15-30 วินาที เปิดด้วยฮุกใน 3 วินาทีแรก โชว์สินค้าชัด ปิดด้วยคำชวนซื้อ",
  ];
  return lines.filter(Boolean).join("\n").slice(0, BRIEF_MAX);
}

export function ProductContents({ product, contents, setContents, draft, clearDraft, onShare, notify }: {
  product: Product; contents: Content[]; setContents: Dispatch<SetStateAction<Content[]>>;
  /** Pre-filled form coming from an AI angle. */
  draft: ContentDraft | null; clearDraft: () => void;
  onShare: (contentId: string) => void; notify: (text: string) => void;
}) {
  const [form, setForm] = useState<(ContentDraft & { refId: string }) | null>(draft ? { ...draft, refId: "" } : null);
  const [series, setSeries] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const kind = form?.kind;

  useEffect(() => {
    if (!kind) return;
    const ctl = new AbortController();
    setSeries([]);
    // Linking is optional, so a failed list just leaves the picker empty.
    directorApi.listSeries(1, ctl.signal, STUDIO[kind].mode).then((list) => setSeries(list.items.map(({ id, name }) => ({ id, name })))).catch(() => undefined);
    return () => ctl.abort();
  }, [kind]);

  const start = (next: ContentKind) => setForm({ kind: next, title: `${CONTENT_KIND_LABEL[next]} ${product.name}`.slice(0, 120), brief: briefFor(product, next), refId: "" });
  const close = () => { setForm(null); clearDraft(); };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); notify("คัดลอกบรีฟแล้ว"); }
    catch { notify("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง"); }
  };

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const created = await marketplaceApi.createContent(product.id, {
        kind: form.kind, title: form.title.trim(), brief: form.brief.trim(),
        ...(form.refId ? { refType: STUDIO[form.kind].refType, refId: form.refId } : {}),
      });
      setContents((items) => [created, ...items]);
      notify("บันทึกคอนเทนต์แล้ว");
      close();
    } catch (e) {
      notify(failText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (content: Content) => {
    try {
      await marketplaceApi.removeContent(content.id);
      setContents((items) => items.filter((c) => c.id !== content.id));
      notify("ลบคอนเทนต์แล้ว");
    } catch (e) {
      notify(failText(e));
    }
  };

  return (
    <div className={form ? m.two : undefined}>
      <section className={w.panel} aria-label="คอนเทนต์โปรโมท">
        <div className={m.itemTop}>
          <h2>คอนเทนต์โปรโมทของสินค้านี้</h2>
          <div className={w.toolbar}>
            <button type="button" className={w.primary} onClick={() => start("promo_video")}><Clapperboard aria-hidden />สร้างวิดีโอโปรโมท</button>
            <button type="button" className={w.secondary} onClick={() => start("short_film")}><Film aria-hidden />สร้างหนังสั้นโปรโมท</button>
          </div>
        </div>
        {contents.length === 0 ? (
          <div className={w.empty} style={{ padding: 32 }}><Clapperboard aria-hidden /><h3>ยังไม่มีคอนเทนต์</h3>
            <p>เลือกสร้างวิดีโอโปรโมทหรือหนังสั้น ระบบจะเตรียมบรีฟจากข้อมูลสินค้าให้นำไปใช้ในหน้าผู้กำกับหรือหน้าสร้างหนัง</p></div>
        ) : (
          <div className={w.list}>
            {contents.map((c) => (
              <article key={c.id} className={m.item}>
                <div className={m.itemTop}>
                  <h3>{c.title}</h3>
                  <div className={w.meta} style={{ marginTop: 0 }}>
                    <span className={`${w.tag} ${w.tagAccent}`}>{CONTENT_KIND_LABEL[c.kind]}</span>
                    <span>{thaiDate(c.createdAt)}</span>
                  </div>
                </div>
                {c.brief && <p className={w.clamp} style={{ whiteSpace: "pre-line" }}>{c.brief}</p>}
                <div className={w.cardActions}>
                  {c.refId && c.refType
                    ? <Link className={w.secondary} href={STUDIO[c.kind].workHref(c.refId)}><ExternalLink aria-hidden />เปิดงาน</Link>
                    : <span className={w.tag}>ยังไม่ผูกกับงาน</span>}
                  <button type="button" className={w.secondary} onClick={() => onShare(c.id)}><Send aria-hidden />แชร์ไปแพลตฟอร์ม</button>
                  {c.brief && <button type="button" className={w.ghost} onClick={() => void copy(c.brief)}><Copy aria-hidden />คัดลอกบรีฟ</button>}
                  <button type="button" className={`${w.ghost} ${w.danger}`} onClick={() => void remove(c)}><Trash2 aria-hidden />ลบ</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {form && (
        <form className={`${w.panel} ${w.panelSticky}`} aria-label={CONTENT_KIND_LABEL[form.kind]} onSubmit={(e) => { e.preventDefault(); if (form.title.trim() && !busy) void save(); }}>
          <div className={m.itemTop}>
            <h2>{CONTENT_KIND_LABEL[form.kind]}</h2>
            <button type="button" className={w.ghost} onClick={close}>ปิด</button>
          </div>
          <ol className={m.steps}>
            <li>ตรวจและปรับบรีฟด้านล่าง แล้วกด “คัดลอกบรีฟ”</li>
            <li>{STUDIO[form.kind].label} วางบรีฟ แล้วสร้างงานโดยใช้รูปสินค้าเป็นภาพอ้างอิง</li>
            <li>กลับมาเลือกงานที่สร้างในช่อง “ผูกกับงาน” แล้วบันทึก เพื่อเก็บไว้กับสินค้านี้</li>
          </ol>
          <label className={w.field}>ชื่อคอนเทนต์
            <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className={w.field}><span className={w.fieldRow}>บรีฟ<span className={w.counter}>{form.brief.length}/{BRIEF_MAX}</span></span>
            <textarea value={form.brief} maxLength={BRIEF_MAX} style={{ minHeight: 220 }} onChange={(e) => setForm({ ...form, brief: e.target.value })} />
          </label>
          <div className={w.toolbar}>
            <button type="button" className={w.secondary} onClick={() => void copy(form.brief)}><Copy aria-hidden />คัดลอกบรีฟ</button>
            <Link className={w.secondary} href={STUDIO[form.kind].href} target="_blank"><ExternalLink aria-hidden />{STUDIO[form.kind].label}</Link>
          </div>
          <label className={w.field}>ผูกกับงาน (ไม่บังคับ)
            <select value={form.refId} onChange={(e) => setForm({ ...form, refId: e.target.value })}>
              <option value="">ยังไม่ผูก</option>
              {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <small>แสดงงานล่าสุด 20 รายการจาก{form.kind === "short_film" ? "หน้าสร้างหนัง" : "หน้าผู้กำกับ"}</small>
          </label>
          <button className={`${w.primary} ${w.block}`} disabled={!form.title.trim() || busy}>
            {busy ? <Loader2 className={m.spin} aria-hidden /> : <Plus aria-hidden />}บันทึกคอนเทนต์
          </button>
        </form>
      )}
    </div>
  );
}
