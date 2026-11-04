"use client";
import { useEffect, useRef, useState } from "react";
import {
  productionApi,
  ProductionError,
  validTrim,
  statusLabel,
  type EditDraft,
  type EditClip,
  type ProjectDetail,
  type ProductionExport,
  type VideoCapabilities,
  type VideoJob,
  type Output,
} from "@/lib/production-api";
import s from "./production.module.css";
import { useRefreshPolling } from "@/hooks/use-refresh-polling";
import { earliestExpiry } from "@/lib/refresh-polling";
import { reconcileClips } from "@/lib/production-editor";
export function AssemblyEditor({
  project,
  caps,
  onSaved,
}: {
  project: ProjectDetail;
  caps: VideoCapabilities;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<EditDraft>(() => ({
    ...project.editDraft,
    clips: reconcileClips(project.editDraft?.clips ?? [], project.scenes),
  }));
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [output, setOutput] = useState<Output>({
    format: "mp4",
    resolution: "720p",
    aspectRatio: project.aspectRatio,
  });
  const [exports, setExports] = useState(project.exports);
  const [media, setMedia] = useState<{
    id: string;
    url: string;
    expiresAt: string;
  } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [pending, setPending] = useState<{
    body: Parameters<typeof productionApi.export>[0];
  } | null>(null);
  const storageKey = `violet-export-submit:${project.id}`;
  const draftKey = `violet-editor-draft:${project.id}`;
  const restored = useRef(false);
  const initialScenes = useRef(project.scenes);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.clips))
          setDraft({
            ...d,
            clips: reconcileClips(d.clips, initialScenes.current),
          });
      }
    } catch {}
    restored.current = true;
  }, [draftKey]);
  useEffect(() => {
    if (restored.current)
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draft, draftKey]);
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    Promise.all(project.scenes.map((x) => productionApi.jobs(x.id, 1, abort.signal)))
      .then(async (rs) => {
        const found = rs.flatMap((r) => r.items);
        const ids = [
          ...project.editDraft.clips.map((c) => c.jobId),
          ...project.scenes.map((sc) => sc.selectedJobId),
        ].filter(
          (id): id is string => !!id && !found.some((j) => j.jobId === id),
        );
        const extra = await Promise.all(
          [...new Set(ids)].map((id) => productionApi.job(id, abort.signal)),
        );
        if (active) setJobs([...found, ...extra]);
      })
      .catch((e) => active && setError(e.message));
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.body?.projectId === project.id && p.body?.idempotencyKey)
          setPending(p);
      }
    } catch {}
    return () => {
      active = false;
      abort.abort();
    };
  }, [project.id, project.scenes, project.editDraft.clips, storageKey]);
  const [refreshing, setRefreshing] = useState(false);
  const refreshExports = useRefreshPolling(`exports:${project.id}`, {
    intervalMs: 4000,
    initial: false,
    initialPlan: { poll: exports.some(exp => ["queued", "processing"].includes(exp.status)) },
    fetch: signal => productionApi.project(project.id, signal),
    onData: p => { setExports(p.exports); setError(""); return { poll: p.exports.some(exp => ["queued", "processing"].includes(exp.status)) }; },
    onError: e => setError(e instanceof Error ? e.message : "ตรวจสอบการส่งออกไม่สำเร็จ"),
    onRefreshing: setRefreshing,
  });
  const refreshMedia = useRefreshPolling(media ? `export-media:${media.id}` : null, {
    intervalMs: 4000,
    initial: false,
    initialPlan: { expiresAt: earliestExpiry([media?.expiresAt]) },
    fetch: signal => productionApi.download(media?.id ?? "", signal),
    onData: d => { setMedia(old => old ? { ...old, ...d } : old); return { expiresAt: earliestExpiry([d.expiresAt]) }; },
    onError: () => setError("โหลดลิงก์วิดีโอไม่สำเร็จ กดดูวิดีโอรวมอีกครั้งเพื่อลองใหม่"),
  });
  const clip = draft.clips.find((c) => c.sceneId === preview);
  const scene = project.scenes.find((x) => x.id === preview);
  const job = jobs.find(
    (j) => j.jobId === (clip?.jobId ?? scene?.selectedJobId),
  );
  const included = draft.clips.filter((c) => c.enabled);
  const duration = (c: EditClip) => {
    const sc = project.scenes.find((x) => x.id === c.sceneId);
    const j = jobs.find((x) => x.jobId === (c.jobId ?? sc?.selectedJobId));
    return j?.outputDurationMs ? j.outputDurationMs / 1000 : null;
  };
  const total = included.reduce<number | null>((sum, c) => {
    const d = duration(c);
    return sum === null || d === null
      ? null
      : sum + (c.trimEnd || d) - c.trimStart;
  }, 0);
  const invalid =
    included.length < 1 ||
    included.length > 20 ||
    included.some(
      (c) =>
        !validTrim(c.trimStart, c.trimEnd, duration(c)) ||
        !jobs.find(
          (j) =>
            j.jobId ===
              (c.jobId ??
                project.scenes.find((x) => x.id === c.sceneId)
                  ?.selectedJobId) && j.status === "succeeded",
        ),
    );
  function patch(index: number, change: Partial<EditClip>) {
    setDraft((d) => ({
      ...d,
      clips: d.clips.map((c, i) => (i === index ? { ...c, ...change } : c)),
    }));
    setSaved(false);
  }
  function move(index: number, delta: number) {
    setDraft((d) => {
      const clips = [...d.clips];
      [clips[index], clips[index + delta]] = [
        clips[index + delta],
        clips[index],
      ];
      return { ...d, clips };
    });
    setSaved(false);
  }
  async function save() {
    await productionApi.editor(project.id, project.revision, draft);
    setSaved(true);
    sessionStorage.removeItem(draftKey);
    await onSaved();
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if (
        e instanceof ProductionError &&
        [400, 401, 403, 404, 409, 422].includes(e.status)
      ) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
      }
      setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    let p = pending;
    if (!p) {
      await save();
      p = {
        body: {
          projectId: project.id,
          idempotencyKey: crypto.randomUUID(),
          clips: included.map((c) => ({
            sceneId: c.sceneId,
            jobId:
              c.jobId ??
              project.scenes.find((x) => x.id === c.sceneId)?.selectedJobId ??
              undefined,
            trimStart: c.trimStart,
            trimEnd: c.trimEnd,
          })),
          output,
        },
      };
      sessionStorage.setItem(storageKey, JSON.stringify(p));
      setPending(p);
    }
    const exp = await productionApi.export(p.body);
    setExports((xs) => [exp, ...xs.filter((x) => x.exportId !== exp.exportId)]);
    sessionStorage.removeItem(storageKey);
    setPending(null);
    await refreshExports();
  }
  async function download(exp: ProductionExport, watch = false) {
    if (watch && media?.id === exp.exportId) { await refreshMedia(); return; }
    const d = await productionApi.download(exp.exportId);
    if (watch) setMedia({ id: exp.exportId, url: d.url, expiresAt: d.expiresAt });
    else {
      const a = document.createElement("a");
      a.href = d.url;
      a.rel = "noopener";
      a.download = `export-${exp.exportId}.mp4`;
      a.click();
    }
  }
  return (
    <div className={s.stack}>
      <button type="button" className={s.button} aria-disabled={refreshing} aria-busy={refreshing} onClick={() => { if (!refreshing) void refreshExports(); }}>{refreshing ? "กำลังรีเฟรชสถานะ…" : "รีเฟรชสถานะ"}</button>
      <div className={s.notice}>
        เรียงคลิปและตัดช่วงได้โดยไม่แก้ไฟล์ต้นฉบับ ใช้รอยต่อแบบตัดตรง
        ยังไม่รองรับทรานซิชันในหน้านี้
      </div>
      <div>
        <h2>ดูคลิปที่เลือก</h2>
        <p className={s.muted}>
          ตัวอย่างนี้แสดงทีละคลิปตามช่วงที่ตัด ผลลัพธ์รวมดูได้หลังส่งออก
        </p>
        <div className={s.player}>
          {job?.result?.mediaUrl ? (
            <video
              ref={video}
              key={job.jobId}
              src={job.result.mediaUrl}
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={() => {
                if (video.current)
                  video.current.currentTime = clip?.trimStart ?? 0;
              }}
              onPlay={() => {
                const v = video.current;
                if (
                  v &&
                  clip &&
                  (v.currentTime < clip.trimStart ||
                    (clip.trimEnd > 0 && v.currentTime >= clip.trimEnd))
                )
                  v.currentTime = clip.trimStart;
              }}
              onTimeUpdate={() => {
                const v = video.current;
                if (v && clip?.trimEnd && v.currentTime >= clip.trimEnd) {
                  v.pause();
                  v.currentTime = clip.trimStart;
                }
              }}
            />
          ) : (
            <p>เลือกคลิปในรายการด้านล่างเพื่อดูและตัดช่วง</p>
          )}
        </div>
      </div>
      <section className={`${s.panel} ${s.stack}`}>
        <header className={s.header}>
          <div>
            <h2>ลำดับและช่วงคลิป</h2>
            <p className={s.muted}>
              {included.length} คลิป · รวม{" "}
              {total === null
                ? "ยังไม่ทราบระยะเวลาจริง"
                : `${total.toFixed(1)} วินาที`}{" "}
              · {saved ? "บันทึกแล้ว" : "กดบันทึกเพื่อเก็บการตัดต่อ"}
            </p>
          </div>
          <button
            className={s.button}
            disabled={busy || !!pending}
            onClick={() => action(save)}
          >
            บันทึกการตัดต่อ
          </button>
        </header>
        {!draft.clips.length && (
          <div className={s.empty}>
            <p>ยังไม่มีคลิปที่เลือกใช้ กลับไปสร้างคลิปแล้วเลือกเวอร์ชันก่อน</p>
          </div>
        )}
        {draft.clips.map((c, i) => {
          const sc = project.scenes.find((x) => x.id === c.sceneId);
          const d = duration(c);
          return (
            <div key={c.sceneId} className={s.clip}>
              <div className={s.stack}>
                <label className={s.row}>
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    disabled={busy || !!pending}
                    onChange={(e) => patch(i, { enabled: e.target.checked })}
                  />
                  <strong>
                    {i + 1}. {sc?.title ?? "ไม่พบฉาก"}
                  </strong>
                </label>
                <button
                  className={s.button}
                  onClick={() => setPreview(c.sceneId)}
                >
                  ดูคลิป / ตัดช่วง
                </button>
                <label className={s.field}>
                  เวอร์ชันที่ใช้
                  <select
                    value={c.jobId ?? sc?.selectedJobId ?? ""}
                    disabled={busy || !!pending}
                    onChange={(e) =>
                      patch(i, {
                        jobId: e.target.value,
                        trimStart: 0,
                        trimEnd: 0,
                      })
                    }
                  >
                    {jobs
                      .filter(
                        (j) =>
                          j.sceneId === c.sceneId && j.status === "succeeded",
                      )
                      .map((j, k) => (
                        <option key={j.jobId} value={j.jobId}>
                          คลิป {k + 1} ·{" "}
                          {new Date(j.createdAt).toLocaleTimeString("th-TH")}
                        </option>
                      ))}
                  </select>
                </label>
                <span className={s.muted}>
                  {d === null
                    ? "ยังไม่ทราบระยะเวลาจริง"
                    : `ต้นฉบับ ${d.toFixed(1)} วินาที`}
                </span>
              </div>
              <label className={s.field}>
                เริ่ม (วินาที)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={c.trimStart}
                  disabled={busy || !!pending}
                  onChange={(e) =>
                    patch(i, { trimStart: Number(e.target.value) })
                  }
                />
              </label>
              <label className={s.field}>
                จบ (0 = ทั้งคลิป)
                <input
                  type="number"
                  min={0}
                  max={d ?? undefined}
                  step={0.1}
                  value={c.trimEnd}
                  disabled={busy || !!pending}
                  onChange={(e) =>
                    patch(i, { trimEnd: Number(e.target.value) })
                  }
                />
              </label>
              <div className={s.row}>
                <button
                  className={s.button}
                  disabled={i === 0 || busy || !!pending}
                  aria-label={`เลื่อน ${sc?.title} ขึ้น`}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  className={s.button}
                  disabled={i === draft.clips.length - 1 || busy || !!pending}
                  aria-label={`เลื่อน ${sc?.title} ลง`}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
              </div>
            </div>
          );
        })}
        <p className={s.muted}>
          ต้องการเพิ่มคลิป? เลือกเวอร์ชันในแท็บฉากและคลิป
          แล้วกลับมาเปิดแท็บนี้อีกครั้ง
        </p>
      </section>
      <section className={`${s.panel} ${s.stack}`}>
        <h2>ส่งออกวิดีโอ</h2>
        <div className={s.fields}>
          <label className={s.field}>
            ความละเอียด
            <select
              value={output.resolution}
              disabled={busy || !!pending}
              onChange={(e) =>
                setOutput((o) => ({
                  ...o,
                  resolution: e.target.value as Output["resolution"],
                }))
              }
            >
              {caps.export.resolutions.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            สัดส่วนผลลัพธ์
            <select
              value={output.aspectRatio}
              disabled={busy || !!pending}
              onChange={(e) =>
                setOutput((o) => ({ ...o, aspectRatio: e.target.value }))
              }
            >
              {caps.export.aspectRatios.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        {invalid && (
          <p className={s.muted}>
            เลือกคลิปที่สร้างเสร็จ 1–20 ฉาก
            และระบุช่วงเริ่ม–จบที่ถูกต้องก่อนส่งออก
          </p>
        )}
        {error && (
          <p className={s.error} role="alert">
            {error}
            <button
              className={s.button}
              disabled={busy}
              onClick={() => action(onSaved)}
            >
              โหลดข้อมูลล่าสุด
            </button>
          </p>
        )}
        <button
          className={s.primary}
          disabled={busy || !caps.export.available || (!pending && invalid)}
          onClick={() => action(submit)}
        >
          {busy
            ? "กำลังดำเนินการ…"
            : pending
              ? "ส่งคำขอส่งออกเดิมอีกครั้ง"
              : "ส่งออก MP4"}
        </button>
        {!caps.export.available && (
          <p className={s.error}>
            ระบบตัดต่อยังไม่พร้อมใช้งาน กรุณาตรวจการตั้งค่า FFmpeg
            และพื้นที่เก็บไฟล์
          </p>
        )}
      </section>
      <h2>ผลลัพธ์ที่ส่งออก</h2>
      {exports.length === 0 && (
        <p className={s.muted}>วิดีโอรวมที่ส่งออกจะแสดงที่นี่</p>
      )}
      {exports.map((exp) => (
        <article className={`${s.panel} ${s.stack}`} key={exp.exportId}>
          <div className={s.row}>
            <span
              className={
                ["queued", "processing"].includes(exp.status)
                  ? s.progress
                  : s.badge
              }
            >
              {statusLabel(exp.status)}
            </span>
            <span className={s.muted}>
              {new Date(exp.createdAt).toLocaleString("th-TH")} ·{" "}
              {exp.output?.resolution} ·{" "}
              {exp.outputDurationMs
                ? `${(exp.outputDurationMs / 1000).toFixed(1)} วินาที`
                : ""}
            </span>
          </div>
          {exp.error && <p className={s.error}>{exp.error}</p>}
          {exp.status === "failed" && (
            <button
              className={s.button}
              disabled={busy}
              onClick={() =>
                action(async () => {
                  const r = await productionApi.retryExport(exp.exportId);
                  setExports((xs) =>
                    xs.map((x) => (x.exportId === r.exportId ? r : x)),
                  );
                  await refreshExports();
                })
              }
            >
              ลองส่งออกฉบับเดิมอีกครั้ง
            </button>
          )}
          {exp.status === "succeeded" && (
            <div className={s.row}>
              <button
                className={s.button}
                disabled={busy}
                onClick={() => action(() => download(exp, true))}
              >
                ดูวิดีโอรวม
              </button>
              <button
                className={s.primary}
                disabled={busy}
                onClick={() => action(() => download(exp))}
              >
                ดาวน์โหลด MP4
              </button>
            </div>
          )}
          {media?.id === exp.exportId && (
            <div className={s.player}>
              <video
                src={media.url}
                controls
                playsInline
                onError={() => void refreshMedia("media")}
              />
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
