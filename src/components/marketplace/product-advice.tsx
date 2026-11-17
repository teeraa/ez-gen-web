"use client";
import { useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import m from "./marketplace.module.css";
import { CONTENT_KIND_LABEL, PLATFORM_LABEL, failText, marketplaceApi, thaiDate, type AdAngle, type Product, type Suggestion } from "@/lib/marketplace-api";
import { briefFor, type ContentDraft } from "./product-contents";

/** AI advice on how similar products are usually advertised, with captions ready for each platform. */
export function ProductAdvice({ product, onSuggestion, onUse, notify }: {
  product: Product; onSuggestion: (suggestion: Suggestion) => void; onUse: (draft: ContentDraft) => void; notify: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const suggestion = product.suggestion;

  const generate = async () => {
    setBusy(true);
    try { onSuggestion(await marketplaceApi.suggest(product.id)); }
    catch (e) { notify(failText(e)); }
    finally { setBusy(false); }
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); notify("คัดลอกแล้ว"); }
    catch { notify("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง"); }
  };
  const use = (angle: AdAngle) => onUse({ kind: angle.fit, title: angle.title.slice(0, 120), brief: briefFor(product, angle.fit, angle) });

  return (
    <div className={w.page}>
      <section className={w.panel} aria-label="AI แนะนำแนวโฆษณา">
        <div className={m.itemTop}>
          <h2>สินค้าใกล้เคียงกันควรโปรโมทแบบไหน</h2>
          <button type="button" className={w.primary} disabled={busy} onClick={() => void generate()}>
            {busy ? <Loader2 className={m.spin} aria-hidden /> : <Sparkles aria-hidden />}{busy ? "กำลังวิเคราะห์ (อาจใช้เวลาถึง 1 นาที)…" : suggestion ? "วิเคราะห์ใหม่" : "ให้ AI วิเคราะห์"}
          </button>
        </div>
        <p className={m.notice}>คำแนะนำมาจากข้อมูลสินค้า ร้าน และยอดขายที่คุณบันทึก ประกอบกับความรู้ทั่วไปของ AI ไม่ได้ดึงข้อมูลโฆษณาจริงจากแพลตฟอร์ม ยิ่งกรอกรายละเอียด จุดขาย และกลุ่มเป้าหมายครบ คำแนะนำยิ่งตรง</p>
        {!suggestion && !busy && <div className={w.empty} style={{ padding: 32 }}><Sparkles aria-hidden /><h3>ยังไม่มีคำแนะนำ</h3><p>กด “ให้ AI วิเคราะห์” เพื่อรับแนวโฆษณา ประโยคเปิด ลำดับช็อต และแคปชันสำหรับแต่ละแพลตฟอร์ม</p></div>}
      </section>

      {suggestion && (
        <>
          {suggestion.similarProducts.length > 0 && (
            <div className={w.meta}>
              <span>สินค้าใกล้เคียงที่ใช้เทียบ:</span>
              {suggestion.similarProducts.map((name) => <span key={name} className={w.tag}>{name}</span>)}
              <span>· วิเคราะห์เมื่อ {thaiDate(suggestion.generatedAt)}</span>
            </div>
          )}
          <div className={w.grid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {suggestion.angles.map((angle, i) => (
              <article key={`${angle.title}-${i}`} className={m.item}>
                <div className={m.itemTop}>
                  <h3>{angle.title}</h3>
                  <div className={w.meta} style={{ marginTop: 0 }}>
                    {angle.format && <span className={w.tag}>{angle.format}</span>}
                    <span className={`${w.tag} ${w.tagAccent}`}>{CONTENT_KIND_LABEL[angle.fit]}</span>
                  </div>
                </div>
                {angle.why && <p>{angle.why}</p>}
                {angle.hook && <p className={m.hook}>ประโยคเปิด: {angle.hook}</p>}
                {angle.outline.length > 0 && <ol>{angle.outline.map((step, n) => <li key={n}>{step}</li>)}</ol>}
                <div className={w.cardActions}>
                  <button type="button" className={w.secondary} onClick={() => use(angle)}>ใช้ไอเดียนี้สร้าง{CONTENT_KIND_LABEL[angle.fit]}</button>
                </div>
              </article>
            ))}
          </div>

          {(suggestion.captions.length > 0 || suggestion.hashtags.length > 0) && (
            <section className={w.panel} aria-label="แคปชันพร้อมโพสต์">
              <h2>แคปชันพร้อมโพสต์</h2>
              {suggestion.captions.map((c) => (
                <article key={c.platform} className={m.item}>
                  <div className={m.itemTop}>
                    <h3>{PLATFORM_LABEL[c.platform]}</h3>
                    <button type="button" className={w.ghost} onClick={() => void copy(c.caption)}><Copy aria-hidden />คัดลอก</button>
                  </div>
                  <p style={{ whiteSpace: "pre-line" }}>{c.caption}</p>
                </article>
              ))}
              {suggestion.hashtags.length > 0 && (
                <div className={m.itemTop}>
                  <div className={w.meta} style={{ marginTop: 0 }}>{suggestion.hashtags.map((tag) => <span key={tag} className={`${w.tag} ${w.tagAccent}`}>{tag}</span>)}</div>
                  <button type="button" className={w.ghost} onClick={() => void copy(suggestion.hashtags.join(" "))}><Copy aria-hidden />คัดลอกแฮชแท็ก</button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
