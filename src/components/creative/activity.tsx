"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LoaderCircle, ArrowUpRight, ListChecks, CheckCircle2, XCircle, Clock3, Layers, ImageIcon, Film, RefreshCw, Coins, Sparkles, Check, RectangleHorizontal } from "lucide-react";
import { jobsApi } from "@/lib/api";
import { creativeApi, imageAssetFromJob } from "@/lib/creative-api";
import { jobStatusLabel } from "@/lib/creative-labels";
import { useRefreshPolling } from "@/hooks/use-refresh-polling";
import { expiryDeadlines } from "@/lib/refresh-polling";
import type { JobDTO } from "@/types/api";
import w from "@/components/workbench/workbench.module.css";
import { WorkbenchHead } from "@/components/workbench/workbench-ui";
import c from "./collection.module.css";

type Filter = "all" | "active" | "done" | "failed";
const TERMINAL = ["succeeded", "failed", "cancelled"];
const matches = (job: JobDTO, filter: Filter) =>
  filter === "all" ||
  (filter === "active" && !TERMINAL.includes(job.status)) ||
  (filter === "done" && job.status === "succeeded") ||
  (filter === "failed" && (job.status === "failed" || job.status === "cancelled"));

export function GenerationActivity() {
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const latestJobs = useRef<JobDTO[]>([]);
  const mediaTarget = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { setLoading(true); }, [page]);
  const refreshJobs = useRefreshPolling(`activity:${page}`, {
    intervalMs: 5000,
    fetch: async (signal, reason) => {
      if (reason === "media" || reason === "expiry") {
        const ids = mediaTarget.current ? [mediaTarget.current] : latestJobs.current.filter(j => j.result?.expiresAt && Date.parse(j.result.expiresAt) <= Date.now()).map(j => j.jobId);
        return { items: await Promise.all([...new Set(ids)].map(id => jobsApi.get(id, signal))), total: null };
      }
      return jobsApi.list(page, 20, signal);
    },
    onData: data => {
      const items = data.total === null ? latestJobs.current.map(j => data.items.find(item => item.jobId === j.jobId) ?? j) : data.items;
      latestJobs.current = items;
      mediaTarget.current = null;
      setJobs(items); if (data.total !== null) setTotal(data.total);
      setLoading(false); setError("");
      return { poll: items.some(j => !["succeeded", "failed", "cancelled"].includes(j.status)), expiresAt: expiryDeadlines(items.map(j => j.result?.expiresAt)) };
    },
    onError: e => { setError(e instanceof Error ? e.message : "โหลดประวัติไม่สำเร็จ"); setLoading(false); },
    onRefreshing: setRefreshing,
  });
  async function save(job: JobDTO) {
    setSaving(job.jobId);
    try {
      await creativeApi.addAsset(imageAssetFromJob(job, names[job.jobId]));
      setSaved([...saved, job.jobId]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกตัวละครไม่สำเร็จ");
    } finally {
      setSaving(null);
    }
  }

  const counts = {
    active: jobs.filter(j => matches(j, "active")).length,
    done: jobs.filter(j => matches(j, "done")).length,
    failed: jobs.filter(j => matches(j, "failed")).length,
  };
  const polling = counts.active > 0;
  const shown = jobs.filter(j => matches(j, filter));
  const pages = Math.max(1, Math.ceil(total / 20));
  const FILTERS: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: "ทั้งหมด", count: jobs.length },
    { id: "active", label: "กำลังสร้าง", count: counts.active },
    { id: "done", label: "เสร็จแล้ว", count: counts.done },
    { id: "failed", label: "ไม่สำเร็จ", count: counts.failed },
  ];

  return (
    <div className={w.page}>
      <WorkbenchHead preview={false} icon={<ListChecks aria-hidden />} title="งานที่สร้าง"
        description="ติดตามทุกงานที่ส่งสร้าง งานยังดำเนินต่อแม้คุณไปหน้าอื่น"
        actions={<Link href="/studio/images" className={w.primary}><Sparkles aria-hidden />สร้างภาพ</Link>} />

      {!loading && jobs.length > 0 && (
        <div className={c.stats}>
          <div className={c.stat}><Layers aria-hidden /><div><b>{total}</b><span>งานทั้งหมด</span></div></div>
          <div className={c.stat} data-tone="active"><Clock3 aria-hidden /><div><b>{counts.active}</b><span>กำลังสร้าง</span></div></div>
          <div className={c.stat} data-tone="done"><CheckCircle2 aria-hidden /><div><b>{counts.done}</b><span>เสร็จแล้ว</span></div></div>
          <div className={c.stat} data-tone="failed"><XCircle aria-hidden /><div><b>{counts.failed}</b><span>ไม่สำเร็จ / ยกเลิก</span></div></div>
        </div>
      )}

      <div className={w.toolbar}>
        <div className={c.segment} role="group" aria-label="กรองตามสถานะ">
          {FILTERS.map(f => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}{!loading && <span className={c.count}>{f.count}</span>}
            </button>
          ))}
        </div>
        <span className={c.spacer} />
        <span className={`${c.live} ${polling ? "" : c.liveIdle}`}>{polling ? "อัปเดตอัตโนมัติทุก 5 วินาที" : "ไม่มีงานที่กำลังสร้าง"}</span>
        <button type="button" className={w.secondary} aria-disabled={refreshing} aria-busy={refreshing} onClick={() => { if (!refreshing) void refreshJobs(); }}>
          <RefreshCw aria-hidden className={refreshing ? "spin" : undefined} />{refreshing ? "กำลังรีเฟรชสถานะ…" : "รีเฟรชสถานะ"}
        </button>
      </div>

      {error && (
        <p className={c.alert} role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className={c.jobs} role="status" aria-busy="true">
          <span className={c.sr}>กำลังโหลดประวัติการสร้าง…</span>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={c.job} aria-hidden>
              <div className={`${c.jobThumb} ${c.skeleton}`} />
              <div className={c.jobMain}>
                <div className={`${c.skeleton} ${c.skelLine}`} style={{ width: "22%" }} />
                <div className={`${c.skeleton} ${c.skelLine}`} style={{ width: "48%", height: 14 }} />
                <div className={`${c.skeleton} ${c.skelLine}`} style={{ width: "86%" }} />
                <div className={`${c.skeleton} ${c.skelLine}`} style={{ width: "36%" }} />
              </div>
              <div className={`${c.skeleton}`} style={{ width: 86, height: 24, borderRadius: 999 }} />
            </div>
          ))}
        </div>
      ) : jobs.length ? (
        shown.length ? (
          <div className={c.jobs}>
            {shown.map((job) => {
              const active = !TERMINAL.includes(job.status);
              const image = job.result?.mediaType === "image" ? job.result : null;
              const itemName = job.imageCategory === "product" ? "สินค้า" : "ตัวละคร";
              return (
                <article className={c.job} key={job.jobId}>
                  <div className={c.jobThumb}>
                    {image?.mediaUrl ? (
                      <a href={image.mediaUrl} target="_blank" rel="noreferrer">
                        <Image
                          unoptimized
                          width={300}
                          height={300}
                          src={image.mediaUrl}
                          alt={job.imageCategory === "product" ? "ภาพสินค้าที่สร้างเสร็จ" : "ภาพตัวละครที่สร้างเสร็จ"}
                          onError={() => { mediaTarget.current = job.jobId; void refreshJobs("media"); }}
                        />
                      </a>
                    ) : active ? <LoaderCircle className="spin" aria-hidden />
                      : job.result?.mediaType === "video" ? <Film aria-hidden />
                        : job.status === "failed" ? <XCircle aria-hidden /> : <ImageIcon aria-hidden />}
                  </div>

                  <div className={c.jobMain}>
                    <span className={c.jobKind}>
                      {image ? job.imageCategory === "product" ? "ภาพสินค้า" : "ภาพตัวละคร" : job.model}
                    </span>
                    <h2>
                      {job.status === "succeeded"
                        ? "สร้างเสร็จสมบูรณ์"
                        : job.status === "failed"
                          ? "สร้างไม่สำเร็จ"
                          : "สถานะการสร้าง " + jobStatusLabel[job.status]}
                    </h2>
                    {(job.compiledPrompt || job.rawPrompt) && <p className={c.jobPrompt} title={job.compiledPrompt ?? job.rawPrompt}>{job.compiledPrompt ?? job.rawPrompt}</p>}
                    {active && (
                      <div className={c.progress} role="progressbar" aria-label="ความคืบหน้า" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.progress ?? 0)}>
                        <i style={{ width: `${Math.max(4, Math.min(100, job.progress ?? 0))}%` }} />
                      </div>
                    )}
                    {job.error && <p className={c.jobError}>{job.error.message}</p>}
                    <div className={c.jobMeta}>
                      <span><Clock3 aria-hidden />{new Date(job.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</span>
                      {job.aspectRatio && <span><RectangleHorizontal aria-hidden />{job.aspectRatio}</span>}
                      <span><Coins aria-hidden />เครดิตที่ใช้: {job.creditsCharged === null ? "ยังไม่มีข้อมูล" : job.creditsCharged}</span>
                    </div>
                  </div>

                  <div className={c.jobSide}>
                    <span className={c.pill} data-status={job.status}>
                      {active && <LoaderCircle className="spin" aria-hidden />}
                      {job.status === "succeeded" ? <Check aria-hidden /> : null}
                      {job.status === "succeeded" ? "เสร็จสมบูรณ์" : jobStatusLabel[job.status]}
                    </span>
                    {image?.mediaUrl && (
                      <div className={c.saveBox}>
                        <label htmlFor={`save-${job.jobId}`}>
                          ชื่อ{itemName}
                          <input
                            id={`save-${job.jobId}`}
                            maxLength={100}
                            value={names[job.jobId] ?? ""}
                            placeholder={`ตั้งชื่อ${itemName}`}
                            onChange={(e) => setNames({ ...names, [job.jobId]: e.target.value })}
                          />
                        </label>
                        <button
                          className={saved.includes(job.jobId) ? w.secondary : w.primary}
                          disabled={!names[job.jobId]?.trim() || saving === job.jobId || saved.includes(job.jobId)}
                          onClick={() => save(job)}
                        >
                          {saved.includes(job.jobId) ? "บันทึกลงคลังแล้ว" : `บันทึก${itemName}`}
                        </button>
                      </div>
                    )}
                    {job.result?.mediaType === "video" && (
                      <Link className={w.secondary} href={job.sceneId ? `/studio/scenes/${job.sceneId}` : "/studio/scenes"}>
                        เปิดพื้นที่จัดการฉาก <ArrowUpRight aria-hidden />
                      </Link>
                    )}
                    {job.status === "failed" && (
                      <Link className={w.secondary} href="/studio/images">
                        ทบทวนไอเดียแล้วลองใหม่ <ArrowUpRight aria-hidden />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={c.emptyBox}>
            <ListChecks aria-hidden />
            <h2>ไม่มีงานในสถานะนี้</h2>
            <p>ลองเลือกตัวกรองอื่น หรือดูงานทั้งหมด</p>
            <button type="button" className={w.secondary} onClick={() => setFilter("all")}>ดูงานทั้งหมด</button>
          </div>
        )
      ) : (
        <div className={c.emptyBox}>
          <Sparkles aria-hidden />
          <h2>เริ่มผลงานแรกของคุณที่นี่</h2>
          <p>ยังไม่มีงานสร้างภาพ งานที่ส่งสร้างจะแสดงสถานะที่นี่แบบเรียลไทม์</p>
          <Link href="/studio/images" className={w.primary}>
            สร้างภาพ <ArrowUpRight aria-hidden />
          </Link>
        </div>
      )}

      {!loading && total > 20 && (
        <nav className={c.pager} aria-label="เปลี่ยนหน้า">
          <button className={w.secondary} disabled={page === 1} onClick={() => setPage(page - 1)}>ก่อนหน้า</button>
          <span>หน้า {page} / {pages} · {total} งาน</span>
          <button className={w.secondary} disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>ถัดไป</button>
        </nav>
      )}
    </div>
  );
}
