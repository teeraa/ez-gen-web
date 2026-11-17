"use client";

import { useEffect, useState } from "react";
import { fetchAiChatUsage, type AiUsage, type AiUsageTotals } from "@/lib/ai-usage-api";
import styles from "./ai-usage.module.css";

const PERIODS = [7, 30, 90];
const RATE_KEY = "ai-usage-thb-rate";
const tokens = new Intl.NumberFormat("th-TH");
const usd = (value: number) => `$${value < 0.01 && value > 0 ? value.toFixed(4) : value.toFixed(2)}`;
const thb = (value: number) => `฿${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (value: string) => new Date(`${value}T00:00:00+07:00`).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
function readRate() { try { const value = Number(window.localStorage.getItem(RATE_KEY)); return value > 0 ? value : 33; } catch { return 33; } }

export function AiUsageView() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AiUsage | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [rate, setRate] = useState(33);
  useEffect(() => { setRate(readRate()); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    fetchAiChatUsage(days, controller.signal).then(setData, failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "โหลดข้อมูลไม่สำเร็จ"); });
    return () => controller.abort();
  }, [days, attempt]);
  function changeRate(value: string) {
    const next = Number(value);
    setRate(next);
    if (next > 0) try { window.localStorage.setItem(RATE_KEY, String(next)); } catch { /* not remembered */ }
  }
  const cost = (value: number | null) => value === null ? <span className={styles.muted} title="มีรุ่นที่ยังไม่มีราคาในตาราง">ไม่ทราบ</span> : <>{usd(value)}{rate > 0 && <small className={styles.sub}>{thb(value * rate)}</small>}</>;
  const cells = (row: AiUsageTotals) => <>
    <td className={styles.num}>{tokens.format(row.replies)}</td><td className={styles.num}>{tokens.format(row.steps)}</td>
    <td className={styles.num}>{tokens.format(row.inputTokens)}</td><td className={styles.num}>{tokens.format(row.outputTokens)}</td><td className={styles.num}>{cost(row.costUsd)}</td>
  </>;
  const head = <><th className={styles.num}>คำตอบ</th><th className={styles.num} title="จำนวนครั้งที่เรียกโมเดล (1 คำตอบอาจเรียกหลายครั้งเมื่อใช้เครื่องมือ)">เรียกโมเดล</th><th className={styles.num}>Input tokens</th><th className={styles.num}>Output tokens</th><th className={styles.num}>ราคาโดยประมาณ</th></>;

  return <div className={styles.page}>
    <header className={styles.head}>
      <div><h1>การใช้ token ของแชท AI</h1><p className={styles.muted}>หน้านี้ไม่อยู่ในเมนู · นับเฉพาะแชทตัดต่อด้วย AI ของบัญชีนี้ รวมข้อความที่ถูกล้างแล้ว</p></div>
      <div className={styles.controls}>
        <div className={styles.segmented} role="group" aria-label="ช่วงเวลา">{PERIODS.map(value => <button key={value} aria-pressed={days === value} onClick={() => setDays(value)}>{value} วัน</button>)}</div>
        <label className={styles.rate}>1 USD =<input type="number" min="0" step="0.01" inputMode="decimal" value={Number.isFinite(rate) ? rate : ""} onChange={event => changeRate(event.target.value)} aria-label="อัตราแลกเปลี่ยนบาทต่อดอลลาร์ (ตั้งเอง)" />บาท</label>
      </div>
    </header>

    {error && <p className={styles.error} role="alert">{error}<button onClick={() => setAttempt(value => value + 1)}>ลองใหม่</button></p>}
    {!data && !error && <UsageSkeleton />}
    {data && <>
      <section className={styles.tiles} aria-label={`สรุป ${data.days} วัน ตั้งแต่ ${day(data.since)}`}>
        <div className={styles.tile}><span className={styles.label}>ราคาโดยประมาณ</span><b className={styles.hero}>{data.total.costUsd === null ? "ไม่ทราบ" : usd(data.total.costUsd)}</b><span className={styles.muted}>{data.total.costUsd !== null && rate > 0 ? `≈ ${thb(data.total.costUsd * rate)}` : "มีรุ่นที่ยังไม่มีราคา"}</span></div>
        <div className={styles.tile}><span className={styles.label}>Input tokens</span><b className={styles.hero}>{tokens.format(data.total.inputTokens)}</b><span className={styles.muted}>ข้อความ ประวัติแชท ข้อมูลโปรเจกต์ ผลเครื่องมือ</span></div>
        <div className={styles.tile}><span className={styles.label}>Output tokens</span><b className={styles.hero}>{tokens.format(data.total.outputTokens)}</b><span className={styles.muted}>คำตอบและการเรียกเครื่องมือ</span></div>
        <div className={styles.tile}><span className={styles.label}>คำตอบจาก AI</span><b className={styles.hero}>{tokens.format(data.total.replies)}</b><span className={styles.muted}>เรียกโมเดล {tokens.format(data.total.steps)} ครั้ง</span></div>
      </section>

      {data.total.replies === 0 ? <p className={styles.empty}>ยังไม่มีการใช้แชท AI ในช่วง {data.days} วันนี้</p> : <>
        <section className={styles.card}><h2>แยกตามรุ่น</h2><div className={styles.scroll}><table>
          <thead><tr><th>ผู้ให้บริการ</th><th>รุ่น</th><th className={styles.num}>ราคา / 1M tokens (in / out)</th>{head}</tr></thead>
          <tbody>{data.models.map(row => <tr key={`${row.provider}:${row.model}`}><td>{row.provider || "-"}</td><td className={styles.mono}>{row.model || "-"}</td>
            <td className={styles.num}>{row.inputPricePerMTok === null ? <span className={styles.muted}>ไม่มีในตาราง</span> : `$${row.inputPricePerMTok} / $${row.outputPricePerMTok}`}</td>{cells(row)}</tr>)}</tbody>
        </table></div></section>

        <section className={styles.card}><h2>รายวัน</h2><div className={styles.scroll}><table>
          <thead><tr><th>วันที่</th>{head}</tr></thead>
          <tbody>{data.byDay.map(row => <tr key={row.day}><td>{day(row.day)}</td>{cells(row)}</tr>)}</tbody>
        </table></div></section>

        <section className={styles.card}><h2>แยกตามโปรเจกต์</h2><div className={styles.scroll}><table>
          <thead><tr><th>โปรเจกต์</th>{head}</tr></thead>
          <tbody>{data.projects.map(row => <tr key={row.projectId}><td>{row.title || <span className={styles.muted}>ไม่มีชื่อ</span>}</td>{cells(row)}</tr>)}</tbody>
        </table></div></section>
      </>}

      <footer className={styles.notes}>
        <p>{data.priceSource}</p>
        <p>เป็นราคาประมาณจากจำนวน token × ราคาประกาศ ไม่หักโควตาฟรี ส่วนลด cache หรือ batch ค่า Claude Haiku 5.5 ใช้ราคาช่วง prompt ไม่เกิน 100K tokens อัตราแลกเปลี่ยนเป็นค่าที่ตั้งเอง</p>
        <p>นับเฉพาะแชทตัดต่อ ยังไม่รวมการวิเคราะห์คลิปและ “แก้ด้วยคำสั่ง” · Output ของ Gemini นับ thinking tokens ตั้งแต่ 10 พ.ย. 2026 หลัง restart API</p>
      </footer>
    </>}
  </div>;
}

function UsageSkeleton() {
  return <div aria-busy="true" aria-label="กำลังโหลดข้อมูลการใช้งาน" className={styles.skeletonWrap}>
    <div className={styles.tiles}>{Array.from({ length: 4 }, (_, index) => <span key={index} className={`${styles.skeleton} ${styles.skTile}`} />)}</div>
    <span className={`${styles.skeleton} ${styles.skTable}`} /><span className={`${styles.skeleton} ${styles.skTable}`} />
  </div>;
}
