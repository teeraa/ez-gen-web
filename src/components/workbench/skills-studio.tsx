"use client";
import { useState } from "react";
import Link from "next/link";
import { Clapperboard, Loader2, Plus, Play, RotateCw, Search, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { skillIcon } from "./skill-icons";
import w from "./workbench.module.css";
import { NOT_CONNECTED, WorkbenchHead, useToast } from "./workbench-ui";
import { useLibraryList } from "./use-library-list";
import { LibraryApiError, skillsApi, type SkillBody, type SkillInputKey, type SkillItem, type SkillOutput } from "@/lib/library-api";

const INPUTS: { id: SkillInputKey; label: string }[] = [
  { id: "character", label: "ตัวละคร" },
  { id: "product", label: "สินค้า" },
  { id: "style", label: "สไตล์ภาพ" },
  { id: "voice", label: "เสียงพากย์" },
  { id: "music", label: "เพลงประกอบ" },
  { id: "script", label: "บท / ข้อความ" },
];
const OUTPUTS: { id: SkillOutput; label: string }[] = [
  { id: "video_9_16", label: "วิดีโอ 9:16" },
  { id: "video_16_9", label: "วิดีโอ 16:9" },
  { id: "storyboard", label: "สตอรี่บอร์ด" },
  { id: "image_set", label: "ชุดภาพ" },
  { id: "film", label: "ภาพยนตร์ (ช่วยกำกับ)" },
];
const OUTPUT_LABEL = Object.fromEntries(OUTPUTS.map((o) => [o.id, o.label])) as Record<SkillOutput, string>;
const DIRECTIVE_MIN = 10;
const DIRECTIVE_MAX = 1500;

type Filter = "all" | "builtin" | "mine";
// forkedFromId set + no id = "ทำสำเนาแล้วแก้" from a built-in.
type Draft = { id?: string; forkedFromId?: string; name: string; description: string; steps: string[]; inputs: SkillInputKey[]; output: SkillOutput; directive: string };
const emptyDraft = (): Draft => ({ name: "", description: "", steps: ["", ""], inputs: [], output: "video_9_16", directive: "" });
const failText = (e: unknown) => e instanceof LibraryApiError ? e.message : "ทำรายการไม่สำเร็จ กรุณาลองใหม่";

export function SkillsStudio() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  const list = useLibraryList<SkillItem>(`${filter}|${query.trim()}`, (page, signal) =>
    skillsApi.list({ scope: filter, q: query, page }, signal));

  const edit = (s: SkillItem) => {
    setConfirmDelete(false);
    setDraft({
      ...(s.builtIn ? { forkedFromId: s.id } : { id: s.id }),
      name: s.name, description: s.description, steps: [...s.steps], inputs: [...s.inputs], output: s.output, directive: s.directive ?? "",
    });
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    const body: SkillBody = {
      name: draft.name.trim(), description: draft.description.trim(),
      steps: draft.steps.map((x) => x.trim()).filter(Boolean), inputs: draft.inputs, output: draft.output,
      ...(draft.output === "film" ? { directive: draft.directive.trim() } : {}),
      ...(draft.forkedFromId ? { forkedFromId: draft.forkedFromId } : {}),
    };
    try {
      if (draft.id) {
        const saved = await skillsApi.update(draft.id, body);
        list.setItems((items) => items.map((s) => s.id === saved.id ? saved : s));
        toast.show("บันทึกการแก้ไขแล้ว");
      } else {
        const created = await skillsApi.create(body);
        if (filter !== "builtin") {
          list.setItems((items) => [created, ...items]);
          list.setTotal((n) => n + 1);
        }
        toast.show(draft.forkedFromId ? "ทำสำเนาไว้ในสกิลของฉันแล้ว" : "สร้างสกิลแล้ว");
      }
      setDraft(null);
    } catch (e) {
      toast.show(failText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try {
      await skillsApi.remove(id);
      list.setItems((items) => items.filter((s) => s.id !== id));
      list.setTotal((n) => Math.max(0, n - 1));
      setDraft(null);
      toast.show("ลบสกิลแล้ว");
    } catch (e) {
      toast.show(failText(e));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const valid = !!draft && draft.name.trim().length >= 2 && draft.steps.some((x) => x.trim())
    && (draft.output !== "film" || draft.directive.trim().length >= DIRECTIVE_MIN);
  const editingSelectedId = draft?.id ?? draft?.forkedFromId;

  return (
    <div className={w.page}>
      <WorkbenchHead preview={false} icon={<Wand2 aria-hidden />} title="สกิล" description="เวิร์กโฟลว์สำเร็จรูปที่รวมขั้นตอนสร้างงานไว้ในคลิกเดียว ใช้ซ้ำได้กับตัวละคร สินค้า และสไตล์ของคุณ"
        actions={<button type="button" className={w.primary} onClick={() => { setConfirmDelete(false); setDraft(emptyDraft()); }}><Plus aria-hidden />สร้างสกิล</button>} />

      <div className={w.toolbar}>
        <div className={w.tabs} role="tablist" aria-label="ตัวกรองสกิล">
          {([["all", "ทั้งหมด"], ["builtin", "แนะนำ"], ["mine", "ของฉัน"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
        <label className={w.search}><Search aria-hidden /><input value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสกิล" aria-label="ค้นหาสกิล" /></label>
      </div>

      <div className={draft ? w.split : undefined} style={draft ? { gridTemplateColumns: "minmax(0,1fr) minmax(340px,420px)" } : undefined}>
        <div className={w.grid} aria-busy={list.loading}>
          {!draft && filter !== "builtin" && !list.loading && (
            <button type="button" className={`${w.card} ${w.newCard}`} onClick={() => setDraft(emptyDraft())}><Plus aria-hidden />สร้างสกิลใหม่</button>
          )}
          {!list.loading && list.items.map((s) => {
            const Icon = skillIcon(s.icon);
            return (
              <article key={s.id} className={`${w.card} ${editingSelectedId === s.id ? w.cardOn : ""}`}>
                <div className={w.cardTop}>
                  <span className={w.cardIcon}><Icon aria-hidden /></span>
                  <h3>{s.name}</h3>
                </div>
                <p className={w.clamp}>{s.description || "ไม่มีคำอธิบาย"}</p>
                <div className={w.meta}>
                  <span className={`${w.tag} ${w.tagAccent}`}>{OUTPUT_LABEL[s.output] ?? s.output}</span>
                  <span>{s.steps.length} ขั้นตอน</span>
                  {!s.builtIn && <span className={w.tag}>ของฉัน</span>}
                </div>
                <div className={w.cardActions}>
                  {s.output === "film"
                    ? <Link href="/studio/film" className={w.secondary} title="เปิดตอนในเมนูภาพยนตร์ แล้วกด “สกิล” เหนือช่องแชทผู้ช่วย"><Clapperboard aria-hidden />ใช้ในภาพยนตร์</Link>
                    : <button type="button" className={w.secondary} onClick={() => toast.show(NOT_CONNECTED)}><Play aria-hidden />ใช้สกิลนี้</button>}
                  <button type="button" className={w.ghost} onClick={() => edit(s)}>{s.builtIn ? "ทำสำเนาแล้วแก้" : "แก้ไข"}</button>
                </div>
              </article>
            );
          })}
          {list.loading && <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><Loader2 aria-hidden /><p>กำลังโหลดสกิล…</p></div>}
          {!list.loading && list.error && (
            <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><Wand2 aria-hidden /><h3>โหลดไม่สำเร็จ</h3><p>{list.error}</p>
              <button type="button" className={w.secondary} onClick={list.reload}><RotateCw aria-hidden />ลองใหม่</button></div>
          )}
          {!list.loading && !list.error && list.items.length === 0 && (
            <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><Wand2 aria-hidden /><h3>ยังไม่มีสกิล</h3><p>{filter === "mine" ? "สร้างสกิลแรกของคุณจากขั้นตอนที่ใช้บ่อย" : "ไม่พบสกิลที่ค้นหา"}</p></div>
          )}
          {!list.loading && list.hasMore && (
            <button type="button" className={w.secondary} style={{ gridColumn: "1 / -1", justifySelf: "center" }} disabled={list.loadingMore} onClick={() => void list.loadMore()}>
              {list.loadingMore ? "กำลังโหลด…" : `โหลดเพิ่ม (${list.items.length}/${list.total})`}
            </button>
          )}
        </div>

        {draft && (
          <form className={`${w.panel} ${w.panelSticky}`} aria-label="ตัวสร้างสกิล" onSubmit={(e) => { e.preventDefault(); if (valid && !busy) void save(); }}>
            <div className={w.toolbar} style={{ justifyContent: "space-between" }}>
              <h2>{draft.id ? "แก้ไขสกิล" : draft.forkedFromId ? "ทำสำเนาสกิล" : "สร้างสกิล"}</h2>
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
                    <input value={step} maxLength={200} aria-label={`ขั้นตอนที่ ${i + 1}`} placeholder="อธิบายขั้นตอน" onChange={(e) => setDraft({ ...draft, steps: draft.steps.map((x, j) => j === i ? e.target.value : x) })} />
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
                  <button key={x.id} type="button" aria-pressed={draft.inputs.includes(x.id)}
                    onClick={() => setDraft({ ...draft, inputs: draft.inputs.includes(x.id) ? draft.inputs.filter((y) => y !== x.id) : [...draft.inputs, x.id] })}>{x.label}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className={w.field} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 6 }}>ผลลัพธ์</legend>
              <div className={w.chips}>
                {OUTPUTS.map((x) => <button key={x.id} type="button" aria-pressed={draft.output === x.id} onClick={() => setDraft({ ...draft, output: x.id })}>{x.label}</button>)}
              </div>
            </fieldset>
            {draft.output === "film" && (
              <label className={w.field}><span className={w.fieldRow}>คำสั่งผู้กำกับ <small>(ภาษาอังกฤษจะได้ผลดีที่สุด)</small></span>
                <textarea style={{ minHeight: 140 }} value={draft.directive} maxLength={DIRECTIVE_MAX} onChange={(e) => setDraft({ ...draft, directive: e.target.value })}
                  placeholder="เช่น Low-key lighting from one hard source, faces half in shadow. Mostly static frames; slow push in only on reveals. Frame through door gaps and reflections." />
                <small className={w.note}>ผู้ช่วยในเมนูภาพยนตร์จะใช้ข้อความนี้กำหนดมุมกล้อง เลนส์ แสง และการจัดเฟรมของทุกช็อต (กฎพื้นฐาน เช่น 1 การเคลื่อนกล้องต่อช็อต ยังคงใช้) · {draft.directive.trim().length}/{DIRECTIVE_MAX}</small>
              </label>
            )}
            <button className={`${w.primary} ${w.block}`} disabled={!valid || busy}>{busy ? <Loader2 aria-hidden /> : <Sparkles aria-hidden />}บันทึกสกิล</button>
            {draft.id && (
              <button type="button" className={`${w.ghost} ${w.block} ${w.danger}`} disabled={busy} onClick={() => { if (draft.id) void remove(draft.id); }} onBlur={() => setConfirmDelete(false)}>
                <Trash2 aria-hidden />{confirmDelete ? "กดอีกครั้งเพื่อยืนยันการลบ" : "ลบสกิลนี้"}
              </button>
            )}
            {draft.forkedFromId && <p className={w.note}>สกิลแนะนำแก้ไขโดยตรงไม่ได้ การบันทึกจะสร้างสำเนาไว้ใน “ของฉัน”</p>}
          </form>
        )}
      </div>
      {toast.node}
    </div>
  );
}
