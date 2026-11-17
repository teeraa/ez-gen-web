"use client";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileUp, Loader2, Plus, Trash2 } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import m from "./marketplace.module.css";
import {
  PLATFORMS, PLATFORM_LABEL, baht, failText, marketplaceApi, parseSalesCsv, thaiDate, todayISO,
  type Platform, type Publish, type Sales, type SaleInput, type SaleRow,
} from "@/lib/marketplace-api";

const PERIODS = [7, 30, 90, 365] as const;
const COMPARE_DAYS = 7;

const addDays = (iso: string, days: number) => {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
};

/** Daily unit totals from `from` to `to`; long ranges are grouped by week so the bars stay readable. */
function buckets(sales: Sales): { label: string; units: number }[] {
  const perDay = new Map<string, number>();
  for (const row of sales.rows) perDay.set(row.date, (perDay.get(row.date) ?? 0) + row.units);
  const step = sales.days > 90 ? 7 : 1;
  const out: { label: string; units: number }[] = [];
  for (let day = sales.from; day <= sales.to; day = addDays(day, step)) {
    let units = 0;
    for (let i = 0; i < step; i++) units += perDay.get(addDays(day, i)) ?? 0;
    out.push({ label: day, units });
  }
  return out;
}

/** Units in the 7 days before a post against the 7 days starting on it, when the loaded range covers both. */
function compare(publish: Publish, sales: Sales): { before: number; after: number } | "partial" {
  const start = addDays(publish.postedOn, -COMPARE_DAYS);
  const end = addDays(publish.postedOn, COMPARE_DAYS - 1);
  if (start < sales.from || end > sales.to) return "partial";
  let before = 0;
  let after = 0;
  for (const row of sales.rows) {
    if (row.platform !== publish.platform || row.date < start || row.date > end) continue;
    if (row.date < publish.postedOn) before += row.units; else after += row.units;
  }
  return { before, after };
}

export function ProductSales({ productId, publishes, notify }: { productId: string; publishes: Publish[]; notify: (text: string) => void }) {
  const [days, setDays] = useState<number>(30);
  const [sales, setSales] = useState<Sales | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState({ platform: "tiktok_shop" as Platform, date: todayISO(), units: "", orders: "", revenue: "" });

  useEffect(() => {
    const ctl = new AbortController();
    setError("");
    marketplaceApi.sales(productId, days, ctl.signal).then(setSales).catch((e: unknown) => { if (!ctl.signal.aborted) setError(failText(e)); });
    return () => ctl.abort();
  }, [productId, days, nonce]);

  const bars = useMemo(() => (sales ? buckets(sales) : []), [sales]);
  const peak = Math.max(1, ...bars.map((b) => b.units));
  const units = Number(entry.units || 0);
  const orders = Number(entry.orders || 0);
  const revenue = Number(entry.revenue || 0);
  const entryValid = !!entry.date && entry.units !== "" && Number.isInteger(units) && Number.isInteger(orders) && Number.isFinite(revenue);

  const send = async (rows: SaleInput[], done: string) => {
    setBusy(true);
    try {
      await marketplaceApi.saveSales(productId, rows);
      notify(done);
      setNonce((n) => n + 1);
      return true;
    } catch (e) {
      notify(failText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addEntry = async () => {
    if (await send([{ platform: entry.platform, date: entry.date, units, orders, revenue }], "บันทึกยอดขายแล้ว")) setEntry({ ...entry, units: "", orders: "", revenue: "" });
  };

  const importCsv = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1024 * 1024) { notify("ไฟล์ CSV ต้องไม่เกิน 1 MB"); return; }
    const { rows, errors } = parseSalesCsv(await file.text());
    if (errors.length > 0) { notify(errors.length > 1 ? `${errors[0]} และอีก ${errors.length - 1} จุด` : errors[0]); return; }
    await send(rows, `นำเข้ายอดขาย ${rows.length} แถวแล้ว`);
  };

  const remove = async (row: SaleRow) => {
    try {
      await marketplaceApi.removeSale(row.id);
      setNonce((n) => n + 1);
    } catch (e) {
      notify(failText(e));
    }
  };

  return (
    <div className={w.page}>
      <div className={w.toolbar} style={{ justifyContent: "space-between" }}>
        <div className={w.tabs} role="tablist" aria-label="ช่วงเวลา">
          {PERIODS.map((p) => <button key={p} type="button" role="tab" aria-selected={days === p} onClick={() => setDays(p)}>{p === 365 ? "1 ปี" : `${p} วัน`}</button>)}
        </div>
        <label className={w.secondary} style={{ cursor: "pointer" }} aria-disabled={busy}>
          <FileUp aria-hidden />นำเข้า CSV
          <input type="file" accept=".csv,text/csv" hidden disabled={busy} onChange={(e) => { void importCsv(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      <p className={w.note} style={{ textAlign: "left" }}>ยอดขายเป็นตัวเลขที่คุณบันทึกเองหรือนำเข้าจากรายงานของแพลตฟอร์ม · CSV ต้องมีคอลัมน์ date (YYYY-MM-DD), platform, units และใส่ orders, revenue เพิ่มได้ · บันทึกวันและแพลตฟอร์มเดิมซ้ำจะแทนที่ค่าเก่า</p>

      {error && <div className={w.empty} style={{ padding: 32 }}><BarChart3 aria-hidden /><h3>โหลดยอดขายไม่สำเร็จ</h3><p>{error}</p>
        <button type="button" className={w.secondary} onClick={() => setNonce((n) => n + 1)}>ลองใหม่</button></div>}
      {!sales && !error && <div className={w.empty} style={{ padding: 32 }}><Loader2 className={m.spin} aria-hidden /><p role="status">กำลังโหลดยอดขาย…</p></div>}

      {sales && !error && (
        <>
          <div className={m.stats}>
            <div className={m.stat}><span>ขายได้</span><b>{sales.total.units.toLocaleString("th-TH")} ชิ้น</b><small>{thaiDate(sales.from)} – {thaiDate(sales.to)}</small></div>
            <div className={m.stat}><span>รายได้</span><b>{baht(sales.total.revenue)}</b><small>{sales.total.orders.toLocaleString("th-TH")} ออเดอร์</small></div>
            {sales.byPlatform.map((p) => p.platform && (
              <div key={p.platform} className={m.stat}><span>{PLATFORM_LABEL[p.platform]}</span><b>{p.units.toLocaleString("th-TH")} ชิ้น</b><small>{baht(p.revenue)}</small></div>
            ))}
          </div>

          <section className={w.panel} aria-label="กราฟยอดขาย">
            <h2>จำนวนชิ้นที่ขายได้{sales.days > 90 ? "ต่อสัปดาห์" : "ต่อวัน"}</h2>
            <div className={m.bars} role="img" aria-label={`ยอดขายรวม ${sales.total.units} ชิ้น ในช่วง ${sales.days} วัน`}>
              {bars.map((b) => <i key={b.label} data-empty={b.units === 0} style={{ height: `${Math.max(1, Math.round((b.units / peak) * 100))}%` }} title={`${thaiDate(b.label)}: ${b.units} ชิ้น`} />)}
            </div>
            <div className={m.axis}><span>{thaiDate(sales.from)}</span><span>{thaiDate(sales.to)}</span></div>
          </section>

          {publishes.length > 0 && (
            <section className={w.panel} aria-label="ยอดขายก่อนและหลังโพสต์">
              <h2>ยอดขายก่อนและหลังโพสต์ (ช่วงละ {COMPARE_DAYS} วัน บนแพลตฟอร์มเดียวกัน)</h2>
              <div className={m.tableWrap}>
                <table className={m.table}>
                  <thead><tr><th>โพสต์</th><th className={m.num}>ก่อนโพสต์</th><th className={m.num}>หลังโพสต์</th><th className={m.num}>เปลี่ยนแปลง</th></tr></thead>
                  <tbody>
                    {publishes.map((p) => {
                      const c = compare(p, sales);
                      const diff = c === "partial" ? 0 : c.after - c.before;
                      return (
                        <tr key={p.id}>
                          <td>{PLATFORM_LABEL[p.platform]} · {thaiDate(p.postedOn)}</td>
                          {c === "partial"
                            ? <td colSpan={3}>ช่วงเวลาที่เลือกยังไม่ครอบคลุม {COMPARE_DAYS} วันก่อนและหลังโพสต์</td>
                            : <><td className={m.num}>{c.before} ชิ้น</td><td className={m.num}>{c.after} ชิ้น</td>
                              <td className={`${m.num} ${diff > 0 ? m.up : diff < 0 ? m.down : ""}`}>{diff > 0 ? "+" : ""}{diff} ชิ้น</td></>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className={w.note} style={{ textAlign: "left" }}>เป็นการเทียบช่วงเวลาเท่านั้น ยอดที่เปลี่ยนอาจมาจากปัจจัยอื่น เช่น โปรโมชันหรือวันแคมเปญ</p>
            </section>
          )}

          <div className={m.two}>
            <form className={w.panel} aria-label="บันทึกยอดขาย" onSubmit={(e) => { e.preventDefault(); if (entryValid && !busy) void addEntry(); }}>
              <h2>บันทึกยอดขายรายวัน</h2>
              <div className={m.formGrid}>
                <label className={w.field}>วันที่
                  <input type="date" value={entry.date} max={todayISO()} required onChange={(e) => setEntry({ ...entry, date: e.target.value })} />
                </label>
                <label className={w.field}>แพลตฟอร์ม
                  <select value={entry.platform} onChange={(e) => setEntry({ ...entry, platform: e.target.value as Platform })}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
                  </select>
                </label>
                <label className={w.field}>จำนวนชิ้น
                  <input inputMode="numeric" value={entry.units} placeholder="0" onChange={(e) => setEntry({ ...entry, units: e.target.value.replace(/\D/g, "") })} />
                </label>
                <label className={w.field}>จำนวนออเดอร์
                  <input inputMode="numeric" value={entry.orders} placeholder="0" onChange={(e) => setEntry({ ...entry, orders: e.target.value.replace(/\D/g, "") })} />
                </label>
                <label className={`${w.field} ${m.wide}`}>รายได้ (บาท)
                  <input inputMode="decimal" value={entry.revenue} placeholder="0" onChange={(e) => setEntry({ ...entry, revenue: e.target.value.replace(/[^\d.]/g, "") })} />
                </label>
              </div>
              <button className={`${w.primary} ${w.block}`} disabled={!entryValid || busy}>
                {busy ? <Loader2 className={m.spin} aria-hidden /> : <Plus aria-hidden />}บันทึกยอดขาย
              </button>
            </form>

            <section className={w.panel} aria-label="รายการยอดขาย">
              <h2>รายการที่บันทึก ({sales.rows.length})</h2>
              {sales.rows.length === 0 ? (
                <div className={w.empty} style={{ padding: 24 }}><BarChart3 aria-hidden /><p>ยังไม่มียอดขายในช่วงนี้</p></div>
              ) : (
                <div className={m.tableWrap} style={{ maxHeight: 360, overflowY: "auto" }}>
                  <table className={m.table}>
                    <thead><tr><th>วันที่</th><th>แพลตฟอร์ม</th><th className={m.num}>ชิ้น</th><th className={m.num}>ออเดอร์</th><th className={m.num}>รายได้</th><th aria-label="ลบ" /></tr></thead>
                    <tbody>
                      {sales.rows.map((row) => (
                        <tr key={row.id}>
                          <td>{thaiDate(row.date)}</td><td>{PLATFORM_LABEL[row.platform]}</td>
                          <td className={m.num}>{row.units.toLocaleString("th-TH")}</td><td className={m.num}>{row.orders.toLocaleString("th-TH")}</td><td className={m.num}>{baht(row.revenue)}</td>
                          <td><button type="button" className={`${w.ghost} ${w.danger}`} aria-label={`ลบยอดขายวันที่ ${thaiDate(row.date)}`} onClick={() => void remove(row)}><Trash2 aria-hidden /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
