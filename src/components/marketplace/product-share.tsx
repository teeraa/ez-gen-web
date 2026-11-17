"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Copy, ExternalLink, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import m from "./marketplace.module.css";
import { PLATFORMS, PLATFORM_LABEL, failText, marketplaceApi, safeLink, thaiDate, todayISO, type Content, type Platform, type Product, type Publish } from "@/lib/marketplace-api";
import { channelUrl } from "./marketplace-ui";

const CAPTION_MAX = 2200;

/**
 * Manual sharing: the user posts on the platform themselves, using the caption prepared here,
 * then logs the post so it shows up next to the sales figures.
 */
export function ProductShare({ product, contents, publishes, setPublishes, initialContentId, onAskAdvice, notify }: {
  product: Product; contents: Content[]; publishes: Publish[]; setPublishes: Dispatch<SetStateAction<Publish[]>>;
  initialContentId: string; onAskAdvice: () => void; notify: (text: string) => void;
}) {
  const [platform, setPlatform] = useState<Platform>("tiktok_shop");
  const [contentId, setContentId] = useState(contents.some((c) => c.id === initialContentId) ? initialContentId : "");
  const [caption, setCaption] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [postedOn, setPostedOn] = useState(todayISO);
  const [busy, setBusy] = useState(false);

  const aiCaption = product.suggestion?.captions.find((c) => c.platform === platform)?.caption;
  const listing = channelUrl(product, platform);
  const titleOf = (id: string | null) => contents.find((c) => c.id === id)?.title;

  const applyAiCaption = () => {
    if (!aiCaption) { onAskAdvice(); return; }
    setCaption([aiCaption, product.suggestion?.hashtags.join(" ")].filter(Boolean).join("\n\n").slice(0, CAPTION_MAX));
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(caption); notify("คัดลอกแคปชันแล้ว"); }
    catch { notify("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง"); }
  };

  const save = async () => {
    setBusy(true);
    try {
      const created = await marketplaceApi.createPublish(product.id, { platform, caption: caption.trim(), postUrl: postUrl.trim(), postedOn, ...(contentId ? { contentId } : {}) });
      setPublishes((items) => [created, ...items].sort((a, b) => b.postedOn.localeCompare(a.postedOn)));
      setPostUrl("");
      notify("บันทึกการโพสต์แล้ว");
    } catch (e) {
      notify(failText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (publish: Publish) => {
    try {
      await marketplaceApi.removePublish(publish.id);
      setPublishes((items) => items.filter((p) => p.id !== publish.id));
      notify("ลบรายการโพสต์แล้ว");
    } catch (e) {
      notify(failText(e));
    }
  };

  return (
    <div className={m.two}>
      <form className={w.panel} aria-label="แชร์ไปแพลตฟอร์ม" onSubmit={(e) => { e.preventDefault(); if (!busy && postedOn) void save(); }}>
        <h2>แชร์ไปแพลตฟอร์ม</h2>
        <p className={m.notice}>ระยะนี้ยังไม่เชื่อมบัญชีแพลตฟอร์ม ระบบเตรียมแคปชันให้ คุณโพสต์เองบนแพลตฟอร์ม แล้วกลับมาบันทึกไว้ที่นี่</p>
        <fieldset className={w.field} style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ marginBottom: 6 }}>แพลตฟอร์ม</legend>
          <div className={w.chips}>
            {PLATFORMS.map((p) => <button key={p} type="button" aria-pressed={platform === p} onClick={() => setPlatform(p)}>{PLATFORM_LABEL[p]}</button>)}
          </div>
        </fieldset>
        <label className={w.field}>คอนเทนต์ที่ใช้โพสต์
          <select value={contentId} onChange={(e) => setContentId(e.target.value)}>
            <option value="">ไม่ระบุ</option>
            {contents.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className={w.field}><span className={w.fieldRow}>แคปชัน<span className={w.counter}>{caption.length}/{CAPTION_MAX}</span></span>
          <textarea value={caption} maxLength={CAPTION_MAX} onChange={(e) => setCaption(e.target.value)} placeholder="เขียนแคปชัน หรือกด “ใช้แคปชันจาก AI”" />
        </label>
        <div className={w.toolbar}>
          <button type="button" className={w.secondary} onClick={applyAiCaption}><Sparkles aria-hidden />{aiCaption ? "ใช้แคปชันจาก AI" : "ขอแคปชันจาก AI"}</button>
          <button type="button" className={w.secondary} disabled={!caption} onClick={() => void copy()}><Copy aria-hidden />คัดลอกแคปชัน</button>
          {listing && <a className={w.secondary} href={listing} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden />เปิดสินค้าบน {PLATFORM_LABEL[platform]}</a>}
        </div>
        <ol className={m.steps}>
          <li>ดาวน์โหลดวิดีโอจากงานที่ผูกไว้ในแท็บ “คอนเทนต์โปรโมท”</li>
          <li>โพสต์บน {PLATFORM_LABEL[platform]} พร้อมแคปชันด้านบน และผูกสินค้าในโพสต์</li>
          <li>วางลิงก์โพสต์และวันที่โพสต์ด้านล่าง แล้วกดบันทึก</li>
        </ol>
        <div className={m.formGrid}>
          <label className={w.field}>ลิงก์โพสต์ (ไม่บังคับ)
            <input value={postUrl} maxLength={500} placeholder="https://" onChange={(e) => setPostUrl(e.target.value)} />
          </label>
          <label className={w.field}>วันที่โพสต์
            <input type="date" value={postedOn} max={todayISO()} required onChange={(e) => setPostedOn(e.target.value)} />
          </label>
        </div>
        <button className={`${w.primary} ${w.block}`} disabled={busy || !postedOn}>
          {busy ? <Loader2 className={m.spin} aria-hidden /> : <Send aria-hidden />}บันทึกการโพสต์
        </button>
      </form>

      <section className={w.panel} aria-label="ประวัติการโพสต์">
        <h2>ประวัติการโพสต์</h2>
        {publishes.length === 0 ? (
          <div className={w.empty} style={{ padding: 32 }}><Send aria-hidden /><h3>ยังไม่มีการโพสต์</h3><p>เมื่อบันทึกการโพสต์แล้ว แท็บยอดขายจะเทียบยอดก่อนและหลังโพสต์ให้</p></div>
        ) : (
          <div className={w.list}>
            {publishes.map((p) => {
              const href = safeLink(p.postUrl);
              return (
                <article key={p.id} className={m.item}>
                  <div className={m.itemTop}>
                    <h3>{PLATFORM_LABEL[p.platform]} · {thaiDate(p.postedOn)}</h3>
                    {titleOf(p.contentId) && <span className={`${w.tag} ${w.tagAccent}`}>{titleOf(p.contentId)}</span>}
                  </div>
                  {p.caption && <p className={w.clamp} style={{ whiteSpace: "pre-line" }}>{p.caption}</p>}
                  <div className={w.cardActions}>
                    {href && <a className={w.secondary} href={href} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden />เปิดโพสต์</a>}
                    <button type="button" className={`${w.ghost} ${w.danger}`} onClick={() => void remove(p)}><Trash2 aria-hidden />ลบ</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
