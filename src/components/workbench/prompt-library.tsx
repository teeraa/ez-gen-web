"use client";
import { Fragment, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, Copy, Plus, ScrollText, Search, Sparkles, X } from "lucide-react";
import w from "./workbench.module.css";
import { NOT_CONNECTED, WorkbenchHead, useToast } from "./workbench-ui";

type Category = "video" | "image" | "product" | "character" | "camera";
type PromptItem = { id: string; title: string; category: Category; text: string; hue: number; mine?: boolean };

const CATEGORIES: { id: Category | "all" | "saved"; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "video", label: "วิดีโอ" },
  { id: "image", label: "ภาพ" },
  { id: "product", label: "สินค้า" },
  { id: "character", label: "ตัวละคร" },
  { id: "camera", label: "มุมกล้อง" },
  { id: "saved", label: "ที่บันทึกไว้" },
];
const CATEGORY_LABEL: Record<Category, string> = { video: "วิดีโอ", image: "ภาพ", product: "สินค้า", character: "ตัวละคร", camera: "มุมกล้อง" };

const LIBRARY: PromptItem[] = [
  { id: "p1", title: "ช็อตเปิดเรื่องแบบซีเนมาติก", category: "video", hue: 220, text: "Cinematic establishing shot of {สถานที่} at {ช่วงเวลา}, slow dolly forward, volumetric light, shallow depth of field, 35mm film grain" },
  { id: "p2", title: "สินค้าบนพื้นหินอ่อน", category: "product", hue: 30, text: "Studio product photo of {สินค้า} on white marble, soft key light from left, subtle reflection, clean {สีพื้นหลัง} background, high detail" },
  { id: "p3", title: "ตัวละครเต็มตัว มุมตรง", category: "character", hue: 300, text: "Full body character sheet of {ตัวละคร}, front view, neutral pose, plain light grey background, consistent proportions, {สไตล์}" },
  { id: "p4", title: "โดรนบินผ่านภูเขา", category: "camera", hue: 160, text: "Aerial drone shot gliding over {ภูมิประเทศ}, sunrise haze, smooth forward motion, wide angle, 4K" },
  { id: "p5", title: "ภาพประกอบสไตล์สีน้ำ", category: "image", hue: 190, text: "Soft watercolor illustration of {ฉาก}, pastel palette, paper texture, gentle light, storybook feel" },
  { id: "p6", title: "ซูมเข้าหน้าตัวละคร", category: "camera", hue: 350, text: "Slow push-in close-up on {ตัวละคร} face, {อารมณ์} expression, rim light, background bokeh" },
  { id: "p7", title: "สินค้าหมุน 360°", category: "video", hue: 45, text: "{สินค้า} rotating 360 degrees on a turntable, studio lighting, seamless {สีพื้นหลัง} backdrop, loopable" },
  { id: "p8", title: "เมืองยามค่ำคืนนีออน", category: "image", hue: 270, text: "Neon-lit {เมือง} street at night after rain, reflections on wet asphalt, cyberpunk mood, wide shot" },
];

const VARS = /\{([^{}]+)\}/g;
const varsOf = (text: string) => [...new Set([...text.matchAll(VARS)].map((m) => m[1]))];

function Highlighted({ text, values }: { text: string; values?: Record<string, string> }) {
  const parts = text.split(VARS);
  return <>{parts.map((part, i) => i % 2 === 1
    ? <span key={i} className={w.var}>{values?.[part]?.trim() || `{${part}}`}</span>
    : <Fragment key={i}>{part}</Fragment>)}</>;
}

export function PromptLibrary() {
  const [items, setItems] = useState<PromptItem[]>(LIBRARY);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("video");
  const toast = useToast();

  const shown = useMemo(() => items.filter((p) =>
    (category === "all" || (category === "saved" ? saved.includes(p.id) : p.category === category)) &&
    (!query.trim() || `${p.title} ${p.text}`.toLowerCase().includes(query.trim().toLowerCase()))), [items, category, query, saved]);
  const open = items.find((p) => p.id === openId) ?? null;
  const filled = open ? open.text.replace(VARS, (_, name: string) => values[name]?.trim() || `{${name}}`) : "";

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.show("คัดลอก Prompt แล้ว"); }
    catch { toast.show("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง"); }
  };
  const toggleSave = (id: string) => setSaved((list) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const openItem = (id: string) => { setOpenId(id); setValues({}); setCreating(false); };
  const addPrompt = () => {
    const item: PromptItem = { id: `mine-${Date.now()}`, title: newTitle.trim(), text: newText.trim(), category: newCategory, hue: 210, mine: true };
    setItems((list) => [item, ...list]);
    setSaved((list) => [item.id, ...list]);
    setCreating(false); setNewTitle(""); setNewText("");
    openItem(item.id);
    toast.show("เพิ่มไว้ในหน้านี้ชั่วคราว (ยังไม่บันทึกลงระบบ)");
  };
  const side = creating || !!open;

  return (
    <div className={w.page}>
      <WorkbenchHead icon={<ScrollText aria-hidden />} title="Prompt" description="คลัง Prompt สำเร็จรูปสำหรับวิดีโอ ภาพ และมุมกล้อง ใส่ค่าในช่อง {ตัวแปร} แล้วคัดลอกไปใช้ได้ทันที"
        actions={<button type="button" className={w.primary} onClick={() => { setCreating(true); setOpenId(null); }}><Plus aria-hidden />เพิ่ม Prompt</button>} />

      <div className={w.toolbar}>
        <div className={w.tabs} role="tablist" aria-label="หมวด Prompt">
          {CATEGORIES.map((c) => <button key={c.id} type="button" role="tab" aria-selected={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</button>)}
        </div>
        <label className={w.search}><Search aria-hidden /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหา Prompt" aria-label="ค้นหา Prompt" /></label>
      </div>

      <div className={side ? w.split : undefined} style={side ? { gridTemplateColumns: "minmax(0,1fr) minmax(340px,420px)" } : undefined}>
        <div className={w.grid}>
          {shown.map((p) => (
            <article key={p.id} className={`${w.card} ${openId === p.id ? w.cardOn : ""}`}>
              <button type="button" className={w.thumb} aria-label={`เปิด ${p.title}`} onClick={() => openItem(p.id)}
                style={{ border: 0, padding: 0, background: `linear-gradient(135deg, hsl(${p.hue} 70% 62%), hsl(${(p.hue + 50) % 360} 65% 45%))` }} />
              <div className={w.cardTop} style={{ justifyContent: "space-between" }}>
                <h3>{p.title}</h3>
                <button type="button" className={w.ghost} aria-pressed={saved.includes(p.id)} aria-label={saved.includes(p.id) ? "เลิกบันทึก" : "บันทึก"} onClick={() => toggleSave(p.id)}>
                  {saved.includes(p.id) ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
                </button>
              </div>
              <p className={w.clamp}><Highlighted text={p.text} /></p>
              <div className={w.meta}>
                <span className={`${w.tag} ${w.tagAccent}`}>{CATEGORY_LABEL[p.category]}</span>
                {varsOf(p.text).length > 0 && <span>{varsOf(p.text).length} ตัวแปร</span>}
                {p.mine && <span className={w.tag}>ของฉัน</span>}
              </div>
              <div className={w.cardActions}>
                <button type="button" className={w.secondary} onClick={() => openItem(p.id)}>ใช้ Prompt</button>
                <button type="button" className={w.ghost} onClick={() => void copy(p.text)}><Copy aria-hidden />คัดลอก</button>
              </div>
            </article>
          ))}
          {shown.length === 0 && <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><ScrollText aria-hidden /><h3>ไม่พบ Prompt</h3><p>{category === "saved" ? "กดไอคอนบุ๊กมาร์กเพื่อเก็บ Prompt ที่ชอบไว้ที่นี่" : "ลองค้นหาด้วยคำอื่น หรือเลือกหมวดอื่น"}</p></div>}
        </div>

        {open && !creating && (
          <aside className={`${w.panel} ${w.panelSticky}`} aria-label="รายละเอียด Prompt">
            <div className={w.toolbar} style={{ justifyContent: "space-between" }}>
              <h2>{open.title}</h2>
              <button type="button" className={w.ghost} aria-label="ปิด" onClick={() => setOpenId(null)}><X aria-hidden /></button>
            </div>
            {varsOf(open.text).map((name) => (
              <label key={name} className={w.field}>{name}
                <input value={values[name] ?? ""} onChange={(e) => setValues({ ...values, [name]: e.target.value })} placeholder={`ใส่${name}`} />
              </label>
            ))}
            <div className={w.field}>
              <span>ผลลัพธ์</span>
              <p className={w.code}><Highlighted text={open.text} values={values} /></p>
            </div>
            <button type="button" className={`${w.primary} ${w.block}`} onClick={() => void copy(filled)}><Copy aria-hidden />คัดลอก Prompt</button>
            <button type="button" className={`${w.secondary} ${w.block}`} onClick={() => toast.show(NOT_CONNECTED)}><Sparkles aria-hidden />ส่งไปหน้าสร้างวิดีโอ</button>
          </aside>
        )}

        {creating && (
          <form className={`${w.panel} ${w.panelSticky}`} aria-label="เพิ่ม Prompt" onSubmit={(e) => { e.preventDefault(); addPrompt(); }}>
            <div className={w.toolbar} style={{ justifyContent: "space-between" }}>
              <h2>เพิ่ม Prompt</h2>
              <button type="button" className={w.ghost} aria-label="ปิด" onClick={() => setCreating(false)}><X aria-hidden /></button>
            </div>
            <label className={w.field}>ชื่อ
              <input value={newTitle} maxLength={60} onChange={(e) => setNewTitle(e.target.value)} placeholder="เช่น ช็อตอาหารแบบท็อปวิว" />
            </label>
            <fieldset className={w.field} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 6 }}>หมวด</legend>
              <div className={w.chips}>
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <button key={c} type="button" aria-pressed={newCategory === c} onClick={() => setNewCategory(c)}>{CATEGORY_LABEL[c]}</button>)}
              </div>
            </fieldset>
            <label className={w.field}><span className={w.fieldRow}>Prompt<span className={w.counter}>{newText.length}/2000</span></span>
              <textarea value={newText} maxLength={2000} onChange={(e) => setNewText(e.target.value)} placeholder="ใช้ {ชื่อตัวแปร} สำหรับส่วนที่อยากเปลี่ยนทุกครั้ง เช่น Top-down shot of {เมนู} on a wooden table" />
            </label>
            {newText && <p className={w.code}><Highlighted text={newText} /></p>}
            <button className={`${w.primary} ${w.block}`} disabled={newTitle.trim().length < 2 || newText.trim().length < 5}><Plus aria-hidden />เพิ่ม Prompt</button>
            <p className={w.note}>ตัวอย่าง UI · Prompt จะหายเมื่อรีเฟรชหน้า</p>
          </form>
        )}
      </div>
      {toast.node}
    </div>
  );
}
