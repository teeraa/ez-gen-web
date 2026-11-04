"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Film, Plus, ArrowUpRight } from "lucide-react";
import { productionApi, type Project } from "@/lib/production-api";
import s from "./production.module.css";
export function ProjectList() {
  const router = useRouter();
  const params = useSearchParams();
  const [items, setItems] = useState<Project[]>([]);
  const [brief, setBrief] = useState("");
  const [title, setTitle] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    productionApi
      .projects(page)
      .then((r) => {
        if (active) {
          setItems(r.items);
          setTotal(r.total);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page]);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const p = await productionApi.create({
        title: title.trim() || undefined,
        brief: brief.trim(),
      });
      const asset = params.get("asset");
      router.push(
        `/studio/projects/${p.id}${asset ? `?asset=${encodeURIComponent(asset)}` : ""}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างโปรเจกต์ไม่สำเร็จ");
      setBusy(false);
    }
  }
  return (
    <section className={s.shell}>
      <header className={s.header}>
        <div>
          <span className={s.muted}>จากไอเดีย สู่คลิปที่เล่าเรื่องของคุณ</span>
          <h1>โปรเจกต์วิดีโอ</h1>
          <p className={s.muted}>
            เริ่มหนึ่งฉาก ดูคลิปจริง แล้วค่อยเพิ่มฉาก ตัดช่วง และส่งออก
          </p>
        </div>
        <Film size={32} />
      </header>
      <div className={s.stack}>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <form
          className={`${s.panel} ${s.glass} ${s.stack}`}
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <h2>เริ่มเรื่องใหม่</h2>
          {params.get("asset") && (
            <p className={s.notice}>
              เลือกตัวละครจากคลังแล้ว จะนำไปเลือกเป็นภาพอ้างอิงในฉากแรก
            </p>
          )}
          <label className={s.field}>
            ฉากแรกเกิดอะไรขึ้น?
            <textarea
              required
              maxLength={2000}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="นักสำรวจเดินผ่านป่าเรืองแสง กล้องค่อย ๆ เคลื่อนตามจากด้านหลัง…"
            />
          </label>
          <details>
            <summary>ตั้งชื่อโปรเจกต์เอง (ไม่บังคับ)</summary>
            <label className={s.field}>
              ชื่อโปรเจกต์
              <input
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
          </details>
          <div className={s.row}>
            <button className={s.primary} disabled={busy || !brief.trim()}>
              <Plus size={18} />
              {busy ? "กำลังสร้างพื้นที่ทำงาน…" : "เริ่มสร้างวิดีโอ"}
            </button>
            <span className={s.muted}>
              ขั้นตอนนี้ยังไม่เรียก AI หรือใช้เครดิต
            </span>
          </div>
        </form>
        <h2>เรื่องราวของคุณ</h2>
        {loading ? (
          <p role="status">กำลังโหลดโปรเจกต์…</p>
        ) : items.length ? (
          <div className={s.grid}>
            {items.map((p) => (
              <Link
                key={p.id}
                className={`${s.panel} ${s.stack}`}
                href={`/studio/projects/${p.id}`}
              >
                <Film />
                <h3>{p.title}</h3>
                <p className={s.muted}>{p.brief.slice(0, 120)}</p>
                <span className={s.row}>
                  เปิดพื้นที่ทำงาน <ArrowUpRight size={18} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={`${s.panel} ${s.empty}`}>
            <Film />
            <p>ยังไม่มีโปรเจกต์ เริ่มจากไอเดียด้านบนได้เลย</p>
          </div>
        )}
        <div className={s.row}>
          <button
            className={s.button}
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            ก่อนหน้า
          </button>
          <span className={s.muted}>หน้า {page}</span>
          <button
            className={s.button}
            disabled={page * 20 >= total}
            onClick={() => setPage(page + 1)}
          >
            ถัดไป
          </button>
        </div>
      </div>
    </section>
  );
}
