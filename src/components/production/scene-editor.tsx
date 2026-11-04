"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  productionApi,
  mergeVideoJobs,
  referenceMode,
  sceneJobRefreshIds,
  ProductionError,
  statusLabel,
  type ProductionScene,
  type VideoCapabilities,
  type VideoJob,
  type VideoSettings,
} from "@/lib/production-api";
import { type Asset } from "@/lib/creative-api";
import { ReferencePicker } from "./reference-picker";
import s from "./production.module.css";
import { useRefreshPolling } from "@/hooks/use-refresh-polling";
import { earliestExpiry } from "@/lib/refresh-polling";
type Pending = {
  key: string;
  body: VideoSettings & {
    prompt: string;
    idempotencyKey: string;
  };
  jobId?: string;
};
export function SceneEditor({
  scene,
  caps,
  onChange,
  initialAsset,
  onInitialAssetConsumed,
}: {
  scene: ProductionScene;
  caps: VideoCapabilities;
  onChange: (scene: ProductionScene) => void;
  initialAsset?: string | null;
  onInitialAssetConsumed?: () => void;
}) {
  const [title, setTitle] = useState(scene.title);
  const [description, setDescription] = useState(scene.description);
  const [settings, setSettings] = useState(() => initialAsset && !scene.referenceAssetId
    ? { ...scene.videoSettings, mode: referenceMode(scene.videoSettings.mode, caps.models.find(m => m.id === scene.videoSettings.model)) }
    : scene.videoSettings);
  const [assetId, setAssetId] = useState(scene.referenceAssetId ?? initialAsset ?? null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [picker, setPicker] = useState(false);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [jobPage, setJobPage] = useState(1);
  const requestedPage = useRef<number | null>(null);
  const [jobTotal, setJobTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const key = `violet-video-submit:${scene.id}`;
  const draftKey = `violet-scene-draft:${scene.id}`;
  const restored = useRef(false);
  const model = caps.models.find((m) => m.id === settings.model);
  const selected =
    jobs.find((j) => j.jobId === scene.selectedJobId) ??
    jobs.find((j) => j.status === "succeeded" && j.result?.mediaUrl);
  const knownPendingJob = useRef<string | undefined>(undefined);
  const mediaTarget = useRef<string | null>(null);
  const latestJobs = useRef<VideoJob[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const activeJob = jobs.find(
    (j) => !["succeeded", "failed", "cancelled"].includes(j.status),
  );
  const dirty =
    title !== scene.title ||
    description !== scene.description ||
    assetId !== scene.referenceAssetId ||
    JSON.stringify(settings) !== JSON.stringify(scene.videoSettings);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (
          typeof d.title === "string" &&
          typeof d.description === "string" &&
          d.settings
        ) {
          setTitle(d.title);
          setDescription(d.description);
          setSettings(d.settings);
          setAssetId(d.assetId ?? null);
        }
      }
    } catch {}
    restored.current = true;
  }, [draftKey]);
  useEffect(() => {
    if (restored.current)
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ title, description, settings, assetId }),
      );
  }, [title, description, settings, assetId, draftKey]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw) as Pending;
        if (typeof p.key === "string" && p.body?.idempotencyKey === p.key)
          { knownPendingJob.current = p.jobId; setPending(p); }
      }
    } catch {}
  }, [key]);
  const refreshJobs = useRefreshPolling(`scene:${scene.id}:${scene.selectedJobId ?? ""}`, {
    intervalMs: 4000,
    fetch: async (signal, reason) => {
      const target = mediaTarget.current;
      if (reason === "media" || reason === "expiry") {
        const ids = target ? [target] : latestJobs.current.filter(j => j.result?.expiresAt && Date.parse(j.result.expiresAt) <= Date.now()).map(j => j.jobId);
        return { items: await Promise.all([...new Set(ids)].map(id => productionApi.job(id, signal))), total: null, page: null };
      }
      const page = requestedPage.current ?? 1;
      const result = await productionApi.jobs(scene.id, page, signal);
      const ids = sceneJobRefreshIds(result.items, latestJobs.current, scene.selectedJobId, knownPendingJob.current);
      const extra = await Promise.all(ids.map(id => productionApi.job(id, signal)));
      return { items: [...result.items, ...extra], total: result.total, page };
    },
    onData: result => {
      mediaTarget.current = null;
      const fresh = mergeVideoJobs(latestJobs.current, result.items);
      const merged = result.page && result.page > 1 ? [...latestJobs.current.map(j => fresh.find(item => item.jobId === j.jobId) ?? j), ...fresh.filter(j => !latestJobs.current.some(item => item.jobId === j.jobId))] : fresh;
      if (result.page && result.page > 1) { setJobPage(result.page); if (requestedPage.current === result.page) requestedPage.current = null; }
      latestJobs.current = merged;
      setJobs(merged);
      if (result.total !== null) setJobTotal(result.total);
      setError("");
      const preview = merged.find(j => j.jobId === scene.selectedJobId) ?? merged.find(j => j.status === "succeeded" && j.result?.mediaUrl);
      return { poll: merged.some(j => !["succeeded", "failed", "cancelled"].includes(j.status)), expiresAt: earliestExpiry([preview?.result?.expiresAt]) };
    },
    onError: e => { requestedPage.current = null; setError(e instanceof Error ? e.message : "โหลดคลิปไม่สำเร็จ กดรีเฟรชสถานะเพื่อลองใหม่"); },
    onRefreshing: setRefreshing,
  });
  useEffect(() => {
    if (!pending?.jobId) return;
    const job = jobs.find((j) => j.jobId === pending.jobId);
    if (job && ["succeeded", "failed", "cancelled"].includes(job.status)) {
      sessionStorage.removeItem(key);
      knownPendingJob.current = undefined;
      setPending(null);
    }
  }, [jobs, key, pending]);
  useEffect(() => {
    if (initialAsset) onInitialAssetConsumed?.();
  }, [initialAsset, onInitialAssetConsumed]);
  useEffect(() => {
    const id = assetId;
    if (!id) return;
    let active = true;
    productionApi
      .asset(id)
      .then((a) => {
        if (active) {
          setAsset(a);

        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [assetId, model?.supportsReferenceImage]);
  async function save() {
    if (!description.trim()) throw new Error("กรุณาอธิบายฉากก่อนบันทึก");
    const saved = await productionApi.saveScene(scene.id, {
      title: title.trim() || "ฉากใหม่",
      description: description.trim(),
      referenceAssetId: assetId,
      videoSettings: settings,
    });
    sessionStorage.removeItem(draftKey);
    onChange(saved);
    setTitle(saved.title);
    setDescription(saved.description);
    setSettings(saved.videoSettings);
    setNotice("บันทึกฉากแล้ว");
    return saved;
  }
  async function saveOnly() {
    setBusy(true);
    setError("");
    try {
      await save();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    setBusy(true);
    setError("");
    try {
      let submission = pending;
      if (!submission) {
        const saved = dirty ? await save() : scene;
        const id = crypto.randomUUID();
        submission = {
          key: id,
          body: {
            ...saved.videoSettings,
            prompt: saved.description,
            idempotencyKey: id,
          },
        };
        sessionStorage.setItem(key, JSON.stringify(submission));
        setPending(submission);
      }
      const result = await productionApi.generate(scene.id, submission.body);
      knownPendingJob.current = result.jobId;
      const updated = { ...submission, jobId: result.jobId };
      sessionStorage.setItem(key, JSON.stringify(updated));
      setPending(updated);
      await refreshJobs();
      setNotice("ส่งงานแล้ว สามารถออกจากหน้านี้และกลับมาดูคลิปได้");
    } catch (e) {
      if (
        e instanceof ProductionError &&
        [400, 401, 403, 404, 409, 422].includes(e.status)
      ) {
        sessionStorage.removeItem(key);
        setPending(null);
        setError(e.message);
      } else
        setError(
          `${e instanceof Error ? e.message : "ส่งคำขอไม่สำเร็จ"} หากไม่แน่ใจว่าส่งสำเร็จหรือไม่ ให้กดส่งคำขอเดิมอีกครั้ง ระบบจะใช้รหัสเดิม`,
        );
    } finally {
      setBusy(false);
    }
  }
  async function choose(job: VideoJob) {
    setBusy(true);
    try {
      const result = await productionApi.select(scene.id, job.jobId);
      onChange({ ...scene, selectedJobId: result.selectedJobId });
      setNotice("เลือกเวอร์ชันนี้สำหรับตัดต่อแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เลือกคลิปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  function changeModel(id: string) {
    const m = caps.models.find((m) => m.id === id);
    if (!m) return;
    setSettings((v) => ({
      ...v,
      model: id,
      duration: Math.max(m.minDuration, Math.min(m.maxDuration, v.duration)),
      aspectRatio: m.aspectRatios.includes(v.aspectRatio)
        ? v.aspectRatio
        : m.aspectRatios[0],
      quality: (m.qualities.includes(v.quality)
        ? v.quality
        : m.qualities[0]) as VideoSettings["quality"],
      mode: assetId ? referenceMode(v.mode, m) : "text",
    }));
  }
  const locked = busy || !!pending || !!activeJob;
  function refreshMedia() {
    mediaTarget.current = selected?.jobId ?? null;
    void refreshJobs("media");
  }
  const invalid =
    !model ||
    settings.duration < model.minDuration ||
    settings.duration > model.maxDuration ||
    !model.aspectRatios.includes(settings.aspectRatio) ||
    (!!assetId &&
      !(model.supportsImageToVideo || model.supportsReferenceImage));
  return (
    <div className={s.stack}>
      <header className={s.row}>
        <h2>{scene.title}</h2>
        <span className={s.badge}>
          {dirty ? "มีการแก้ไขที่ยังไม่บันทึก" : "บันทึกแล้ว"}
        </span>
      </header>
      <div className={s.player}>
        {selected?.result?.mediaUrl ? (
          <video
            key={selected.jobId}
            src={selected.result.mediaUrl}
            controls
            playsInline
            preload="metadata"
            onError={refreshMedia}
          />
        ) : (
          <div className={s.empty}>
            <strong>คลิปของฉากนี้จะแสดงที่นี่</strong>
            <span>อธิบายฉาก เลือกภาพอ้างอิง แล้วกดสร้างคลิป</span>
          </div>
        )}
      </div>
      <button type="button" className={s.button} aria-disabled={refreshing} aria-busy={refreshing} onClick={() => { if (!refreshing) void refreshJobs(); }}>
        {refreshing ? "กำลังรีเฟรชสถานะ…" : "รีเฟรชสถานะ"}
      </button>
      {activeJob && (
        <p className={s.progress} role="status">
          {statusLabel(activeJob.status)} · คุณยังดูคลิปเวอร์ชันเดิมได้
        </p>
      )}
      {jobs.length < jobTotal && (
        <button
          className={s.button}
          disabled={busy || refreshing}
          onClick={() => { requestedPage.current = jobPage + 1; void refreshJobs(); }}
        >
          ดูเวอร์ชันก่อนหน้าเพิ่มเติม
        </button>
      )}
      <div className={s.versions}>
        {jobs.map((j, i) => (
          <div className={s.row} key={j.jobId}>
            <button
              className={scene.selectedJobId === j.jobId ? s.primary : s.button}
              disabled={busy || j.status !== "succeeded" || !j.result?.mediaUrl}
              onClick={() => choose(j)}
            >
              เวอร์ชัน {jobs.length - i} ·{" "}
              {scene.selectedJobId === j.jobId
                ? "เลือกใช้อยู่"
                : statusLabel(j.status)}
            </button>
            {j.error && <span className={s.error}>{j.error.message}</span>}
          </div>
        ))}
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={s.muted} role="status">
          {notice}
        </p>
      )}
      <section className={`${s.panel} ${s.stack}`}>
        <label className={s.field}>
          ชื่อฉาก
          <input
            disabled={locked}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className={s.field}>
          ฉากนี้เกิดอะไรขึ้น?
          <textarea
            disabled={locked}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-describedby="scene-background-help"
            placeholder="อธิบายการเคลื่อนไหว กล้อง และบรรยากาศ"
          />
        </label>
        <p id="scene-background-help" className={s.muted}>ระบุสถานที่/ฉากหลังในคำอธิบายฉาก</p>
        <div className={s.stack}>
          <div className={s.row}>
            <strong>ตัวละครอ้างอิง</strong>
            <button
              className={s.button}
              disabled={locked}
              onClick={() => setPicker(true)}
            >
              {assetId ? "เปลี่ยนตัวละคร" : "เลือกจากคลังตัวละคร"}
            </button>
            {assetId && (
              <button
                className={s.button}
                disabled={locked}
                onClick={() => {
                  setAssetId(null);
                  setAsset(null);
                  setSettings((v) => ({ ...v, mode: "text" }));
                }}
              >
                นำออก
              </button>
            )}
          </div>
          {assetId && (
            <div className={s.ref}>
              {asset?.mediaUrl && (
                <Image
                  unoptimized
                  src={asset.mediaUrl}
                  width={64}
                  height={80}
                  alt={asset.name}
                />
              )}
              <span>
                {asset?.name ?? "เลือกภาพตัวละครจากคลังแล้ว"}
                <br />
                <span className={s.muted}>
                  ใช้เป็นภาพอ้างอิง รูปลักษณ์อาจเปลี่ยนตามโมเดล
                </span>
              </span>
            </div>
          )}
        </div>
        <div className={s.fields}>
          <label className={s.field}>
            โมเดล
            <select
              disabled={locked}
              value={settings.model}
              onChange={(e) => changeModel(e.target.value)}
            >
              {caps.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            ความยาว (วินาที)
            <input
              disabled={locked}
              type="number"
              min={model?.minDuration}
              max={model?.maxDuration}
              step={1}
              value={settings.duration}
              onChange={(e) =>
                setSettings((v) => ({ ...v, duration: Number(e.target.value) }))
              }
            />
          </label>
          <label className={s.field}>
            สัดส่วนภาพ
            <select
              disabled={locked}
              value={settings.aspectRatio}
              onChange={(e) =>
                setSettings((v) => ({ ...v, aspectRatio: e.target.value }))
              }
            >
              {model?.aspectRatios.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        {assetId && <p className={s.muted} role="status">
              {settings.mode === "image_video" ? "ใช้ภาพนี้เป็นเฟรมเริ่มต้น จึงอาจคงฉากหลังจากภาพไว้" : "อ้างอิงรูปลักษณ์จากภาพ และใช้สถานที่/ฉากหลังตามคำอธิบายฉาก ผลลัพธ์อาจแตกต่างจากภาพอ้างอิง"}
            </p>}
            {assetId && settings.mode === "image_video" && model?.supportsReferenceImage && <button type="button" className={s.button} disabled={locked} onClick={() => setSettings(v => ({ ...v, mode: "image_image" }))}>เปลี่ยนเป็นอ้างอิงรูปลักษณ์</button>}
        <details>
          <summary>ตั้งค่าขั้นสูง</summary>
          <div className={s.fields}>
            <label className={s.field}>
              คุณภาพ
              <select
                disabled={locked}
                value={settings.quality}
                onChange={(e) =>
                  setSettings((v) => ({
                    ...v,
                    quality: e.target.value as VideoSettings["quality"],
                  }))
                }
              >
                {model?.qualities.map((q) => (
                  <option key={q} value={q}>
                    {q === "high" ? "สูง" : "มาตรฐาน"}
                  </option>
                ))}
              </select>
            </label>
            {assetId && (
              <label className={s.field}>
                การใช้ภาพอ้างอิง
                <select
                  disabled={locked}
                  value={settings.mode}
                  onChange={(e) =>
                    setSettings((v) => ({
                      ...v,
                      mode: e.target.value as VideoSettings["mode"],
                    }))
                  }
                >
                  {model?.supportsImageToVideo && (
                    <option value="image_video">ใช้เป็นเฟรมเริ่มต้น</option>
                  )}
                  {model?.supportsReferenceImage && (
                    <option value="image_image">อ้างอิงรูปลักษณ์</option>
                  )}
                </select>
              </label>
            )}

          </div>
        </details>
        {invalid && (
          <p className={s.error}>
            การตั้งค่านี้ยังไม่รองรับ กรุณาเลือกโมเดล สัดส่วน
            และระยะเวลาที่รองรับภาพอ้างอิง
          </p>
        )}
        {!caps.available && (
          <p className={s.notice}>
            ยังไม่พร้อมเชื่อมต่อผู้ให้บริการวิดีโอ บันทึกและจัดฉากก่อนได้
          </p>
        )}
        <p className={s.muted}>
          ยังไม่มีราคาประเมิน อาจมีค่าใช้จ่ายจากผู้ให้บริการ
          การสร้างใหม่จะเพิ่มเวอร์ชันและเก็บคลิปเดิมไว้
        </p>
        <div className={s.row}>
          <button
            className={s.button}
            disabled={busy || !dirty || !!pending || !!activeJob}
            onClick={saveOnly}
          >
            บันทึกฉาก
          </button>
          <button
            className={s.primary}
            disabled={
              busy ||
              !!activeJob ||
              !caps.available ||
              (!pending && (invalid || !description.trim()))
            }
            onClick={generate}
          >
            {busy
              ? "กำลังดำเนินการ…"
              : pending && !pending.jobId
                ? "ส่งคำขอเดิมอีกครั้ง"
                : jobs[0]?.status === "failed"
                  ? "ลองสร้างคลิปฉากนี้อีกครั้ง"
                  : selected
                    ? "สร้างคลิปเวอร์ชันใหม่"
                    : "สร้างคลิปฉากนี้"}
          </button>
        </div>
      </section>
      {picker && (
        <ReferencePicker
          onClose={() => setPicker(false)}
          onSelect={(a) => {
            setAsset(a);
            setAssetId(a.id);
            setSettings((v) => ({
              ...v,
              mode: referenceMode(v.mode, model),
            }));
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}
