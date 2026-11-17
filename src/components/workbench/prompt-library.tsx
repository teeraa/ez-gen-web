"use client";
import { Fragment, useState } from "react";
import { Bookmark, BookmarkCheck, Copy, Loader2, Pencil, Plus, RotateCw, ScrollText, Search, Sparkles, Trash2, X } from "lucide-react";
import w from "./workbench.module.css";
import { NOT_CONNECTED, WorkbenchHead, useToast } from "./workbench-ui";
import { useLibraryList } from "./use-library-list";
import { LibraryApiError, promptsApi, type LibraryQuery, type PromptCategory, type PromptItem } from "@/lib/library-api";

type Tab = PromptCategory | "all" | "saved" | "mine";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "video", label: "วิดีโอ" },
  { id: "image", label: "ภาพ" },
  { id: "product", label: "สินค้า" },
  { id: "character", label: "ตัวละคร" },
  { id: "camera", label: "มุมกล้อง" },
  { id: "mine", label: "ของฉัน" },
  { id: "saved", label: "ที่บันทึกไว้" },
];
const CATEGORY_LABEL: Record<PromptCategory, string> = { video: "วิดีโอ", image: "ภาพ", product: "สินค้า", character: "ตัวละคร", camera: "มุมกล้อง" };

const VARS = /\{([^{}]+)\}/g;
const varsOf = (text: string) => [...new Set([...text.matchAll(VARS)].map((m) => m[1]))];
const hueOf = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
const tabQuery = (tab: Tab): LibraryQuery =>
  tab === "all" ? {} : tab === "saved" || tab === "mine" ? { scope: tab } : { category: tab };
const failText = (e: unknown) => e instanceof LibraryApiError ? e.message : "ทำรายการไม่สำเร็จ กรุณาลองใหม่";

function Highlighted({ text, values }: { text: string; values?: Record<string, string> }) {
  const parts = text.split(VARS);
  return <>{parts.map((part, i) => i % 2 === 1
    ? <span key={i} className={w.var}>{values?.[part]?.trim() || `{${part}}`}</span>
    : <Fragment key={i}>{part}</Fragment>)}</>;
}

type Form = { id?: string; title: string; category: PromptCategory; body: string };

export function PromptLibrary() {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  const list = useLibraryList<PromptItem>(`${tab}|${query.trim()}`, (page, signal) =>
    promptsApi.list({ ...tabQuery(tab), q: query, page }, signal));
  const open = list.items.find((p) => p.id === openId) ?? null;
  const filled = open ? open.body.replace(VARS, (_, name: string) => values[name]?.trim() || `{${name}}`) : "";

  const replace = (item: PromptItem) => list.setItems((items) => items.map((p) => p.id === item.id ? item : p));
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.show("คัดลอก Prompt แล้ว"); }
    catch { toast.show("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง"); }
  };
  const openItem = (id: string) => { setOpenId(id); setValues({}); setForm(null); setConfirmDelete(false); };

  const toggleBookmark = async (p: PromptItem) => {
    const on = !p.bookmarked;
    replace({ ...p, bookmarked: on });
    try {
      const saved = await promptsApi.bookmark(p.id, on);
      if (tab === "saved" && !on) {
        list.setItems((items) => items.filter((x) => x.id !== p.id));
        list.setTotal((n) => Math.max(0, n - 1));
      } else replace(saved);
    } catch (e) {
      replace(p);
      toast.show(failText(e));
    }
  };

  const submit = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const body = { title: form.title.trim(), category: form.category, body: form.body.trim() };
      if (form.id) {
        replace(await promptsApi.update(form.id, body));
        toast.show("บันทึกการแก้ไขแล้ว");
        openItem(form.id);
      } else {
        const created = await promptsApi.create(body);
        list.setItems((items) => [created, ...items]);
        list.setTotal((n) => n + 1);
        toast.show("เพิ่ม Prompt แล้ว");
        openItem(created.id);
      }
    } catch (e) {
      toast.show(failText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: PromptItem) => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try {
      await promptsApi.remove(p.id);
      list.setItems((items) => items.filter((x) => x.id !== p.id));
      list.setTotal((n) => Math.max(0, n - 1));
      setOpenId(null);
      toast.show("ลบ Prompt แล้ว");
    } catch (e) {
      toast.show(failText(e));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const side = !!form || !!open;
  const formValid = !!form && form.title.trim().length >= 2 && form.body.trim().length >= 5;

  return (
    <div className={w.page}>
      <WorkbenchHead preview={false} icon={<ScrollText aria-hidden />} title="Prompt" description="คลัง Prompt สำเร็จรูปสำหรับวิดีโอ ภาพ และมุมกล้อง ใส่ค่าในช่อง {ตัวแปร} แล้วคัดลอกไปใช้ได้ทันที"
        actions={<button type="button" className={w.primary} onClick={() => { setForm({ title: "", category: "video", body: "" }); setOpenId(null); }}><Plus aria-hidden />เพิ่ม Prompt</button>} />

      <div className={w.toolbar}>
        <div className={w.tabs} role="tablist" aria-label="หมวด Prompt">
          {TABS.map((c) => <button key={c.id} type="button" role="tab" aria-selected={tab === c.id} onClick={() => setTab(c.id)}>{c.label}</button>)}
        </div>
        <label className={w.search}><Search aria-hidden /><input value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหา Prompt" aria-label="ค้นหา Prompt" /></label>
      </div>

      <div className={side ? w.split : undefined} style={side ? { gridTemplateColumns: "minmax(0,1fr) minmax(340px,420px)" } : undefined}>
        <div className={w.grid} aria-busy={list.loading}>
          {!list.loading && list.items.map((p) => {
            const hue = hueOf(p.id);
            return (
              <article key={p.id} className={`${w.card} ${openId === p.id ? w.cardOn : ""}`}>
                <button type="button" className={w.thumb} aria-label={`เปิด ${p.title}`} onClick={() => openItem(p.id)}
                  style={{ border: 0, padding: 0, background: `linear-gradient(135deg, hsl(${hue} 70% 62%), hsl(${(hue + 50) % 360} 65% 45%))` }} />
                <div className={w.cardTop} style={{ justifyContent: "space-between" }}>
                  <h3>{p.title}</h3>
                  <button type="button" className={w.ghost} aria-pressed={p.bookmarked} aria-label={p.bookmarked ? "เลิกบันทึก" : "บันทึก"} onClick={() => void toggleBookmark(p)}>
                    {p.bookmarked ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
                  </button>
                </div>
                <p className={w.clamp}><Highlighted text={p.body} /></p>
                <div className={w.meta}>
                  <span className={`${w.tag} ${w.tagAccent}`}>{CATEGORY_LABEL[p.category]}</span>
                  {varsOf(p.body).length > 0 && <span>{varsOf(p.body).length} ตัวแปร</span>}
                  {!p.builtIn && <span className={w.tag}>ของฉัน</span>}
                </div>
                <div className={w.cardActions}>
                  <button type="button" className={w.secondary} onClick={() => openItem(p.id)}>ใช้ Prompt</button>
                  <button type="button" className={w.ghost} onClick={() => void copy(p.body)}><Copy aria-hidden />คัดลอก</button>
                </div>
              </article>
            );
          })}
          {list.loading && <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><Loader2 aria-hidden /><p>กำลังโหลด Prompt…</p></div>}
          {!list.loading && list.error && (
            <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><ScrollText aria-hidden /><h3>โหลดไม่สำเร็จ</h3><p>{list.error}</p>
              <button type="button" className={w.secondary} onClick={list.reload}><RotateCw aria-hidden />ลองใหม่</button></div>
          )}
          {!list.loading && !list.error && list.items.length === 0 && (
            <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><ScrollText aria-hidden /><h3>ไม่พบ Prompt</h3>
              <p>{tab === "saved" ? "กดไอคอนบุ๊กมาร์กเพื่อเก็บ Prompt ที่ชอบไว้ที่นี่" : tab === "mine" ? "กด “เพิ่ม Prompt” เพื่อสร้าง Prompt ของคุณเอง" : "ลองค้นหาด้วยคำอื่น หรือเลือกหมวดอื่น"}</p></div>
          )}
          {!list.loading && list.hasMore && (
            <button type="button" className={w.secondary} style={{ gridColumn: "1 / -1", justifySelf: "center" }} disabled={list.loadingMore} onClick={() => void list.loadMore()}>
              {list.loadingMore ? "กำลังโหลด…" : `โหลดเพิ่ม (${list.items.length}/${list.total})`}
            </button>
          )}
        </div>

        {open && !form && (
          <aside className={`${w.panel} ${w.panelSticky}`} aria-label="รายละเอียด Prompt">
            <div className={w.toolbar} style={{ justifyContent: "space-between" }}>
              <h2>{open.title}</h2>
              <button type="button" className={w.ghost} aria-label="ปิด" onClick={() => setOpenId(null)}><X aria-hidden /></button>
            </div>
            {varsOf(open.body).map((name) => (
              <label key={name} className={w.field}>{name}
                <input value={values[name] ?? ""} onChange={(e) => setValues({ ...values, [name]: e.target.value })} placeholder={`ใส่${name}`} />
              </label>
            ))}
            <div className={w.field}>
              <span>ผลลัพธ์</span>
              <p className={w.code}><Highlighted text={open.body} values={values} /></p>
            </div>
            <button type="button" className={`${w.primary} ${w.block}`} onClick={() => void copy(filled)}><Copy aria-hidden />คัดลอก Prompt</button>
            <button type="button" className={`${w.secondary} ${w.block}`} onClick={() => toast.show(NOT_CONNECTED)}><Sparkles aria-hidden />ส่งไปหน้าสร้างวิดีโอ</button>
            {!open.builtIn && (
              <div className={w.toolbar}>
                <button type="button" className={w.secondary} disabled={busy} onClick={() => setForm({ id: open.id, title: open.title, category: open.category, body: open.body })}><Pencil aria-hidden />แก้ไข</button>
                <button type="button" className={`${w.ghost} ${w.danger}`} disabled={busy} onClick={() => void remove(open)} onBlur={() => setConfirmDelete(false)}>
                  <Trash2 aria-hidden />{confirmDelete ? "กดอีกครั้งเพื่อยืนยันการลบ" : "ลบ"}
                </button>
              </div>
            )}
          </aside>
        )}

        {form && (
          <form className={`${w.panel} ${w.panelSticky}`} aria-label={form.id ? "แก้ไข Prompt" : "เพิ่ม Prompt"} onSubmit={(e) => { e.preventDefault(); if (formValid && !busy) void submit(); }}>
            <div className={w.toolbar} style={{ justifyContent: "space-between" }}>
              <h2>{form.id ? "แก้ไข Prompt" : "เพิ่ม Prompt"}</h2>
              <button type="button" className={w.ghost} aria-label="ปิด" onClick={() => setForm(null)}><X aria-hidden /></button>
            </div>
            <label className={w.field}>ชื่อ
              <input value={form.title} maxLength={60} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น ช็อตอาหารแบบท็อปวิว" />
            </label>
            <fieldset className={w.field} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 6 }}>หมวด</legend>
              <div className={w.chips}>
                {(Object.keys(CATEGORY_LABEL) as PromptCategory[]).map((c) => <button key={c} type="button" aria-pressed={form.category === c} onClick={() => setForm({ ...form, category: c })}>{CATEGORY_LABEL[c]}</button>)}
              </div>
            </fieldset>
            <label className={w.field}><span className={w.fieldRow}>Prompt<span className={w.counter}>{form.body.length}/2000</span></span>
              <textarea value={form.body} maxLength={2000} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="ใช้ {ชื่อตัวแปร} สำหรับส่วนที่อยากเปลี่ยนทุกครั้ง เช่น Top-down shot of {เมนู} on a wooden table" />
            </label>
            {form.body && <p className={w.code}><Highlighted text={form.body} /></p>}
            <button className={`${w.primary} ${w.block}`} disabled={!formValid || busy}>
              {busy ? <Loader2 aria-hidden /> : <Plus aria-hidden />}{form.id ? "บันทึกการแก้ไข" : "เพิ่ม Prompt"}
            </button>
          </form>
        )}
      </div>
      {toast.node}
    </div>
  );
}
