"use client";
import { useMemo, useState } from "react";
import { Clapperboard, FileText, Megaphone, Plus, Play, Scissors, Search, ShoppingBag, Sparkles, Trash2, Wand2, X } from "lucide-react";
import w from "./workbench.module.css";
import { NOT_CONNECTED, WorkbenchHead, useToast } from "./workbench-ui";

type Skill = { id: string; name: string; description: string; icon: typeof Wand2; steps: string[]; inputs: string[]; output: string; mine: boolean };

const INPUTS = ["ตัวละคร", "สินค้า", "สไตล์ภาพ", "เสียงพากย์", "เพลงประกอบ", "บท / ข้อความ"];
const OUTPUTS = ["วิดีโอ 9:16", "วิดีโอ 16:9", "สตอรี่บอร์ด", "ชุดภาพ"];

const STARTER: Skill[] = [
  { id: "ad15", name: "โฆษณาสินค้า 15 วินาที", description: "เปิดด้วยปัญหา โชว์สินค้า ปิดด้วยคำชวนซื้อ เหมาะกับ TikTok และ Reels", icon: Megaphone, steps: ["วิเคราะห์จุดเด่นสินค้า", "เขียนบท 3 ช็อต", "สร้างภาพแต่ละช็อต", "ใส่เสียงพากย์และเพลง"], inputs: ["สินค้า", "เสียงพากย์"], output: "วิดีโอ 9:16", mine: false },
  { id: "story5", name: "เรื่องสั้น 5 ฉาก", description: "ขยายไอเดียประโยคเดียวเป็นเรื่องสั้น 5 ฉาก คงตัวละครเดิมทุกฉาก", icon: Clapperboard, steps: ["แตกโครงเรื่อง 5 ฉาก", "ล็อกตัวละครหลัก", "สร้างภาพนิ่งทีละฉาก", "แปลงเป็นวิดีโอ"], inputs: ["ตัวละคร", "สไตล์ภาพ"], output: "วิดีโอ 16:9", mine: false },
  { id: "ugc", name: "รีวิวสินค้าแบบ UGC", description: "วิดีโอรีวิวสไตล์คนจริงถือสินค้า พูดกับกล้อง เป็นกันเอง", icon: ShoppingBag, steps: ["กำหนดผู้รีวิว", "เขียนสคริปต์รีวิว", "สร้างวิดีโอ + ลิปซิงก์"], inputs: ["ตัวละคร", "สินค้า", "เสียงพากย์"], output: "วิดีโอ 9:16", mine: false },
  { id: "board", name: "สตอรี่บอร์ดจากบท", description: "วางบทหรือเรื่องย่อ แล้วได้สตอรี่บอร์ดพร้อมมุมกล้องทุกช็อต", icon: FileText, steps: ["แบ่งบทเป็นช็อต", "กำหนดมุมกล้อง", "สร้างภาพสเก็ตช์"], inputs: ["บท / ข้อความ", "สไตล์ภาพ"], output: "สตอรี่บอร์ด", mine: false },
  { id: "highlight", name: "ตัดไฮไลต์อัตโนมัติ", description: "เลือกช่วงที่น่าสนใจจากคลิปยาว ใส่ซับและทรานซิชันให้พร้อมโพสต์", icon: Scissors, steps: ["หาช่วงไฮไลต์", "ตัดและเรียง", "ใส่ข้อความและเพลง"], inputs: ["เพลงประกอบ"], output: "วิดีโอ 9:16", mine: false },
];

type Draft = { id?: string; name: string; description: string; steps: string[]; inputs: string[]; output: string };
const EMPTY: Draft = { name: "", description: "", steps: ["", ""], inputs: [], output: OUTPUTS[0] };

export function SkillsStudio() {
  const [skills, setSkills] = useState<Skill[]>(STARTER);
  const [filter, setFilter] = useState<"all" | "mine" | "starter">("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const toast = useToast();
  const shown = useMemo(() => skills.filter((s) =>
    (filter === "all" || (filter === "mine") === s.mine) &&
    (!query.trim() || `${s.name} ${s.description}`.toLowerCase().includes(query.trim().toLowerCase()))), [skills, filter, query]);

  const edit = (s: Skill) => setDraft({ id: s.id, name: s.name, description: s.description, steps: [...s.steps], inputs: [...s.inputs], output: s.output });
  const save = () => {
    if (!draft) return;
    const steps = draft.steps.map((x) => x.trim()).filter(Boolean);
    const next: Skill = { id: draft.id ?? `local-${Date.now()}`, name: draft.name.trim(), description: draft.description.trim(), steps, inputs: draft.inputs, output: draft.output, icon: Wand2, mine: true };
    setSkills((list) => draft.id && list.some((s) => s.id === draft.id) ? list.map((s) => s.id === draft.id ? { ...next, icon: s.icon } : s) : [next, ...list]);
    setDraft(null);
    toast.show("บันทึกไว้ในหน้านี้ชั่วคราว (ยังไม่บันทึกลงระบบ)");
  };
  const valid = !!draft && draft.name.trim().length >= 2 && draft.steps.some((x) => x.trim());

  return (
    <div className={w.page}>
      <WorkbenchHead icon={<Wand2 aria-hidden />} title="สกิล" description="เวิร์กโฟลว์สำเร็จรูปที่รวมขั้นตอนสร้างงานไว้ในคลิกเดียว ใช้ซ้ำได้กับตัวละคร สินค้า และสไตล์ของคุณ"
        actions={<button type="button" className={w.primary} onClick={() => setDraft({ ...EMPTY, steps: [...EMPTY.steps] })}><Plus aria-hidden />สร้างสกิล</button>} />

      <div className={w.toolbar}>
        <div className={w.tabs} role="tablist" aria-label="ตัวกรองสกิล">
          {([["all", "ทั้งหมด"], ["starter", "แนะนำ"], ["mine", "ของฉัน"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
        <label className={w.search}><Search aria-hidden /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสกิล" aria-label="ค้นหาสกิล" /></label>
      </div>

      <div className={draft ? w.split : undefined} style={draft ? { gridTemplateColumns: "minmax(0,1fr) minmax(340px,420px)" } : undefined}>
        <div className={w.grid}>
          {!draft && filter !== "starter" && (
            <button type="button" className={`${w.card} ${w.newCard}`} onClick={() => setDraft({ ...EMPTY, steps: [...EMPTY.steps] })}><Plus aria-hidden />สร้างสกิลใหม่</button>
          )}
          {shown.map((s) => {
            const Icon = s.icon;
            return (
              <article key={s.id} className={`${w.card} ${draft?.id === s.id ? w.cardOn : ""}`}>
                <div className={w.cardTop}>
                  <span className={w.cardIcon}><Icon aria-hidden /></span>
                  <h3>{s.name}</h3>
                </div>
                <p className={w.clamp}>{s.description || "ไม่มีคำอธิบาย"}</p>
                <div className={w.meta}>
                  <span className={`${w.tag} ${w.tagAccent}`}>{s.output}</span>
                  <span>{s.steps.length} ขั้นตอน</span>
                  {s.mine && <span className={w.tag}>ของฉัน</span>}
                </div>
                <div className={w.cardActions}>
                  <button type="button" className={w.secondary} onClick={() => toast.show(NOT_CONNECTED)}><Play aria-hidden />ใช้สกิลนี้</button>
                  <button type="button" className={w.ghost} onClick={() => edit(s)}>{s.mine ? "แก้ไข" : "ทำสำเนาแล้วแก้"}</button>
                </div>
              </article>
            );
          })}
          {shown.length === 0 && <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><Wand2 aria-hidden /><h3>ยังไม่มีสกิล</h3><p>{filter === "mine" ? "สร้างสกิลแรกของคุณจากขั้นตอนที่ใช้บ่อย" : "ไม่พบสกิลที่ค้นหา"}</p></div>}
        </div>

        {draft && (
          <form className={`${w.panel} ${w.panelSticky}`} aria-label="ตัวสร้างสกิล" onSubmit={(e) => { e.preventDefault(); if (valid) save(); }}>
            <div className={w.toolbar} style={{ justifyContent: "space-between" }}>
              <h2>{draft.id && skills.find((s) => s.id === draft.id)?.mine ? "แก้ไขสกิล" : "สร้างสกิล"}</h2>
              <button type="button" className={w.ghost} aria-label="ปิด" onClick={() => setDraft(null)}><X aria-hidden /></button>
            </div>
            <label className={w.field}>ชื่อสกิล
              <input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="เช่น โฆษณาร้านกาแฟ 15 วินาที" />
            </label>
            <label className={w.field}><span className={w.fieldRow}>คำอธิบาย <small>(ไม่บังคับ)</small></span>
              <textarea style={{ minHeight: 72 }} value={draft.description} maxLength={300} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="สกิลนี้ทำอะไร เหมาะกับงานแบบไหน" />
            </label>
            <div className={w.field}>
              <span>ขั้นตอน</span>
              <ol className={w.steps}>
                {draft.steps.map((step, i) => (
                  <li key={i}>
                    <input value={step} aria-label={`ขั้นตอนที่ ${i + 1}`} placeholder="อธิบายขั้นตอน" onChange={(e) => setDraft({ ...draft, steps: draft.steps.map((x, j) => j === i ? e.target.value : x) })} />
                    <button type="button" className={w.ghost} aria-label={`ลบขั้นตอนที่ ${i + 1}`} disabled={draft.steps.length <= 1} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}><Trash2 aria-hidden /></button>
                  </li>
                ))}
              </ol>
              <button type="button" className={w.secondary} style={{ alignSelf: "flex-start" }} disabled={draft.steps.length >= 8} onClick={() => setDraft({ ...draft, steps: [...draft.steps, ""] })}><Plus aria-hidden />เพิ่มขั้นตอน</button>
            </div>
            <fieldset className={w.field} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 6 }}>ข้อมูลที่ต้องใช้</legend>
              <div className={w.chips}>
                {INPUTS.map((x) => (
                  <button key={x} type="button" aria-pressed={draft.inputs.includes(x)}
                    onClick={() => setDraft({ ...draft, inputs: draft.inputs.includes(x) ? draft.inputs.filter((y) => y !== x) : [...draft.inputs, x] })}>{x}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className={w.field} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 6 }}>ผลลัพธ์</legend>
              <div className={w.chips}>
                {OUTPUTS.map((x) => <button key={x} type="button" aria-pressed={draft.output === x} onClick={() => setDraft({ ...draft, output: x })}>{x}</button>)}
              </div>
            </fieldset>
            <button className={`${w.primary} ${w.block}`} disabled={!valid}><Sparkles aria-hidden />บันทึกสกิล</button>
            <p className={w.note}>ตัวอย่าง UI · สกิลจะหายเมื่อรีเฟรชหน้า</p>
          </form>
        )}
      </div>
      {toast.node}
    </div>
  );
}
