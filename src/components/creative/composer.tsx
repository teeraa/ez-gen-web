"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Image as ImageIcon,
  Lightbulb,
  Maximize2,
  Package,
  RefreshCw,
  UserRound,
  Sparkles,
  SlidersHorizontal,
  ImagePlus,
  Check,
  LoaderCircle,
} from "lucide-react";
import {
  creativeApi,
  CreativeApiError,
  imageAssetFromJob,
  type ImageCapabilities,
} from "@/lib/creative-api";
import {
  prepareImageSubmission,
  imageSubmissionCategory,
  imageCategoryAvailable,
  restoreImageSubmission,
  type ImageSubmission,
  type ImageInput,
} from "@/lib/image-submission";
import { visualStyles, moods, productMoods, designFormats, restoreCharacterDraft, imageDesignOptions, type ImageCategory, type CharacterDesignOptions } from "@/lib/character-design";
import { useRefreshPolling } from "@/hooks/use-refresh-polling";
import { earliestExpiry } from "@/lib/refresh-polling";
import controls from "./character-controls.module.css";
import ui from "./image-studio.module.css";
import { validateReferenceFile } from "@/lib/character-reference";
import { jobsApi, uploadsApi } from "@/lib/api";
import { jobStatusLabel } from "@/lib/creative-labels";
import type { AspectRatio, JobDTO } from "@/types/api";
export function Composer({ publicView = false }: { publicView?: boolean }) {
  const router = useRouter();
  const [capability, setCapability] = useState<ImageCapabilities | null>(null);
  const [restored, setRestored] = useState(false);
  const [category, setCategory] = useState<ImageCategory>("character");
  const [brief, setBrief] = useState("");
  const [name, setName] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [ratio, setRatio] = useState<AspectRatio>("3:4");
  const [visualStyle, setVisualStyle] = useState<NonNullable<CharacterDesignOptions["visualStyle"]>>("auto");
  const [mood, setMood] = useState<NonNullable<CharacterDesignOptions["mood"]>>("neutral");
  const [designFormat, setDesignFormat] = useState<NonNullable<CharacterDesignOptions["designFormat"]>>("full_body");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<JobDTO | null>(null);
  const [saved, setSaved] = useState(false);
  const [reference, setReference] = useState<string>();
  const [referenceName, setReferenceName] = useState("");
  const [referencePreview, setReferencePreview] = useState("");
  const [referenceExpiry, setReferenceExpiry] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const submission = useRef<ImageSubmission | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ratioTouched = useRef(false);
  useEffect(() => {
    let mounted = true;
    const abort = new AbortController();
    const requestedCategory = new URLSearchParams(window.location.search).get("category");
    submission.current = restoreImageSubmission(
      sessionStorage.getItem("violet-character-submission"),
    );
    if (submission.current) {
      setRecovering(true);
      const pendingInput = JSON.parse(
        submission.current.signature,
      ) as ImageInput;
      setCategory(pendingInput.category ?? "character");
      setBrief(pendingInput.prompt);
      setRatio(pendingInput.aspectRatio as AspectRatio);
      setReference(pendingInput.referenceImageId);
      if (pendingInput.referenceImageId) setReferenceName("ภาพอ้างอิงของคำขอเดิม");
      setVisualStyle(pendingInput.visualStyle ?? "auto");
      setMood(pendingInput.mood ?? "neutral");
      setDesignFormat(pendingInput.designFormat ?? "full_body");
    }
    const draft = sessionStorage.getItem("violet-character-draft");
    const restoredDraft = restoreCharacterDraft(draft);
    if (restoredDraft && !submission.current) {
      setCategory(restoredDraft.category ?? "character");
      setBrief(restoredDraft.prompt);
      setRatio((restoredDraft.aspectRatio as AspectRatio) ?? "3:4");
      setVisualStyle(restoredDraft.visualStyle ?? "auto");
      setMood(restoredDraft.mood ?? "neutral");
      setDesignFormat(restoredDraft.designFormat ?? "full_body");
      setReference(restoredDraft.referenceImageId);
      setReferenceName(restoredDraft.referenceName ?? "");
      setReferenceExpiry(restoredDraft.referenceExpiresAt);
    }
    if (!submission.current && requestedCategory === "product") setCategory("product");
    const activeJob = sessionStorage.getItem("violet-character-job");
    if (activeJob && !publicView)
      jobsApi
        .get(activeJob, abort.signal)
        .then((found) => {
          if (mounted) {
            setJob(found);
            const unresolved = submission.current && submission.current.jobId !== found.jobId;
            setRecovering(!!unresolved);
            if (!unresolved && ["succeeded", "failed", "cancelled"].includes(found.status)) {
              if (restoredDraft) {
                setCategory(restoredDraft.category ?? "character");
                setBrief(restoredDraft.prompt);
                setRatio((restoredDraft.aspectRatio as AspectRatio) ?? "3:4");
                setVisualStyle(restoredDraft.visualStyle ?? "auto");
                setMood(restoredDraft.mood ?? "neutral");
                setDesignFormat(restoredDraft.designFormat ?? "full_body");
              }
              if (requestedCategory === "product") setCategory("product");
            }
            setSubmitted(found.rawPrompt ?? (submission.current?.jobId === found.jobId ? (JSON.parse(submission.current.signature) as ImageInput).prompt : ""));
          }
        })
                .catch(() => {
          if (!mounted || abort.signal.aborted) return;
          if (submission.current) {
            setRecovering(true);
            setError("ตรวจสอบคำขอก่อนหน้าไม่สำเร็จ กดส่งคำขอเดิมอีกครั้ง ระบบจะใช้ข้อมูลและรหัสเดิมเพื่อป้องกันการสร้างซ้ำ");
          } else {
            sessionStorage.removeItem("violet-character-job");
            setError("โหลดผลงานก่อนหน้าไม่สำเร็จ กรุณาดูประวัติการสร้างหรือลองเปิดหน้าใหม่");
          }
        })
        .finally(() => { if (mounted) setRestored(true); });
    if (!publicView)
      creativeApi
        .capabilities()
        .then((value) => {
          if (mounted) {
            setCapability(value);
            if (!submission.current && !restoredDraft?.aspectRatio && !ratioTouched.current && !value.aspectRatios.includes("3:4")) {
              setRatio(value.aspectRatios[0] ?? "1:1");
            }
          }
        })
        .catch((e) => {
          if (mounted) setError(e.message);
        });
    if (!activeJob || publicView) setRestored(true);
    return () => {
      mounted = false;
      abort.abort();
    };
  }, [publicView]);
  useEffect(() => {
    if (job && submission.current?.jobId === job.jobId && ["succeeded", "failed", "cancelled"].includes(job.status)) {
      submission.current = null;
      sessionStorage.removeItem("violet-character-submission");
    }
  }, [job]);
  const refreshJob = useRefreshPolling(!publicView && job ? job.jobId : null, {
    intervalMs: 3000,
    initial: false,
    initialPlan: { poll: !!job && !["succeeded", "failed", "cancelled"].includes(job.status), expiresAt: earliestExpiry([job?.result?.expiresAt]) },
    fetch: signal => jobsApi.get(job?.jobId ?? "", signal),
    onData: next => {
      setJob(next); setError("");
      return { poll: !["succeeded", "failed", "cancelled"].includes(next.status), expiresAt: earliestExpiry([next.result?.expiresAt]) };
    },
    onError: e => setError(e instanceof Error ? e.message : "ตรวจสอบสถานะไม่สำเร็จ กดรีเฟรชสถานะเพื่อลองใหม่"),
    onRefreshing: setRefreshing,
  });
  useEffect(() => () => { if (referencePreview) URL.revokeObjectURL(referencePreview); }, [referencePreview]);
  function persistDraft(changes: Partial<{ category: ImageCategory; prompt: string; aspectRatio: AspectRatio; referenceImageId: string | undefined; referenceName: string; referenceExpiresAt: string | undefined } & CharacterDesignOptions> = {}) {
    sessionStorage.setItem("violet-character-draft", JSON.stringify({ version: 1, category, prompt: brief, aspectRatio: ratio, visualStyle, mood, designFormat, referenceImageId: reference, referenceName, referenceExpiresAt: referenceExpiry, ...changes }));
  }
  const referenceAvailable = category === "product"
    ? capability?.supportsReferenceImage === true
    : capability?.enabled === true && capability.supportsCharacterReferenceImage === true && capability.characterReferenceMode === "image_to_image";
  const referenceUnavailableReason = category === "character"
    ? capability?.characterReferenceUnavailableReason || "การสร้างตัวละครจากภาพอ้างอิงยังไม่พร้อมใช้งาน กรุณานำภาพออกเพื่อสร้างจากข้อความ"
    : "ภาพอ้างอิงสินค้ายังไม่พร้อมใช้งาน กรุณานำภาพออกเพื่อสร้างจากข้อความ";
  const blockedNewReference = !!reference && !referenceAvailable && !recovering;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!restored || busy || active) return;
    if (publicView) {
      persistDraft();
      router.push("/signin?next=/studio");
      return;
    }
    if (!imageCategoryAvailable(imageSubmissionCategory(submission.current, category, job), capability?.categories)) {
      setError("โหมดสร้างสินค้ายังไม่พร้อมใช้งาน");
      return;
    }
    const pendingTerminal = submission.current?.jobId === job?.jobId && ["succeeded", "failed", "cancelled"].includes(job?.status ?? "");
    if (reference && !referenceAvailable && (!submission.current || pendingTerminal)) { setError(referenceUnavailableReason); return; }
    setBusy(true);
    setError("");
    setSaved(false);
    let postAccepted = false;
    try {
      submission.current = prepareImageSubmission(
        submission.current,
        {
          prompt: brief.trim(),
          aspectRatio: ratio,
          referenceImageId: reference,
          ...imageDesignOptions(category, { visualStyle, mood, designFormat }),
        },
        job,
        () => crypto.randomUUID(),
      );
      const attempt = submission.current;
      const input = JSON.parse(attempt.signature) as ImageInput;
      setSubmitted(input.prompt);
      setCategory(input.category ?? "character");
      setBrief(input.prompt);
      setRatio(input.aspectRatio as AspectRatio);
      setReference(input.referenceImageId);
      setVisualStyle(input.visualStyle ?? "auto");
      setMood(input.mood ?? "neutral");
      setDesignFormat(input.designFormat ?? "full_body");
      sessionStorage.setItem(
        "violet-character-submission",
        JSON.stringify(attempt),
      );
      const created = await creativeApi.generate({
        ...input,
        aspectRatio: input.aspectRatio as AspectRatio,
        idempotencyKey: attempt.key,
      });
      postAccepted = true;
      submission.current = { ...attempt, jobId: created.jobId };
      sessionStorage.setItem(
        "violet-character-submission",
        JSON.stringify(submission.current),
      );
      sessionStorage.setItem("violet-character-job", created.jobId);
      setJob(await jobsApi.get(created.jobId));
      setRecovering(false);
    } catch (e) {
      if (
        !postAccepted &&
        e instanceof CreativeApiError &&
        ([400, 401, 403, 404, 409, 422].includes(e.status) ||
          (e.status === 503 && e.code === "CHARACTER_REFERENCE_UNAVAILABLE"))
      ) {
        submission.current = null;
        sessionStorage.removeItem("violet-character-submission");
      }
      setRecovering(!!submission.current);
      setError(
        e instanceof TypeError
          ? "การเชื่อมต่อขัดข้อง กรุณาลองอีกครั้ง ระบบจะตรวจสอบคำขอเดิมเพื่อป้องกันการสร้างซ้ำ"
          : e instanceof Error
            ? e.message
            : "เริ่มสร้างภาพไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }
  const active =
    !!job && !["succeeded", "failed", "cancelled"].includes(job.status);
  async function save() {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      await creativeApi.addAsset(imageAssetFromJob(job, name, submitted));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกตัวละครไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file || busy || active || recovering || !referenceAvailable) return;
    const validation = validateReferenceFile(file);
    if (validation) { setError(validation); return; }
    setBusy(true);
    setUploading(true);
    setError("");
    const preview = URL.createObjectURL(file);
    let retained = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0 ? resolve() : reject(new Error("ไฟล์ภาพไม่สมบูรณ์ กรุณาเลือกภาพใหม่"));
        image.onerror = () => reject(new Error("เปิดไฟล์ภาพไม่ได้ กรุณาเลือกภาพ PNG, JPEG หรือ WebP ที่สมบูรณ์"));
        image.src = preview;
      });
      const result = await uploadsApi.upload(file);
      setReference(result.uploadId);
      setReferenceName(file.name);
      setReferenceExpiry(result.expiresAt);
      setReferencePreview(preview);
      retained = true;
      persistDraft({ referenceImageId: result.uploadId, referenceName: file.name, referenceExpiresAt: result.expiresAt });
    } catch (e) {
      setError(e instanceof Error && /[ก-๙]/.test(e.message) ? e.message : "อัปโหลดภาพอ้างอิงไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่ ภาพอ้างอิงเดิมยังอยู่");
    } finally {
      if (!retained) URL.revokeObjectURL(preview);
      setUploading(false);
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  function chooseReference() {
    if (publicView) { persistDraft(); router.push("/signin?next=/studio"); return; }
    if (!referenceAvailable || busy || active || recovering) return;
    fileRef.current?.click();
  }
  function removeReference() {
    if (busy || active || recovering) return;
    setReference(undefined);
    setReferenceName("");
    setReferenceExpiry(undefined);
    setReferencePreview("");
    persistDraft({ referenceImageId: undefined, referenceName: "", referenceExpiresAt: undefined });
  }
  const subject = category === "product" ? "สินค้า" : "ตัวละคร";
  const resultProduct = job?.imageCategory === "product";
  const resultSubject = resultProduct ? "สินค้า" : "ตัวละคร";
  const ratios = capability?.aspectRatios ?? ["3:4", "1:1", "4:3", "16:9", "9:16"];
  const locked = busy || active || recovering;
  const ideas = category === "product"
    ? ["ขวดน้ำหอมแก้วใส ฝาทอง บนพื้นหินอ่อน", "กล่องชาไทยลายกราฟิกสีพาสเทล", "หูฟังไร้สายสีขาว แสงสตูดิโอ"]
    : ["ผู้พิทักษ์ป่าใจดี ดวงตาสีอำพัน", "นักบินอวกาศย้อนยุคในชุดสีคอรัล", "นักสำรวจในชุดเกราะเหลือบรุ้ง"];
  return (
    <div className={ui.workspace}>
      <form className={`idea-composer ${ui.panel}`} onSubmit={submit}>
        <header className={ui.panelHead}>
          <div>
            <h1 className={ui.title}><Sparkles aria-hidden />สร้างภาพ{subject}</h1>
            <p className={ui.subtitle}>{category === "product" ? "ออกแบบรูปทรง วัสดุ และบรรจุภัณฑ์ แล้วเก็บไว้ใช้ในวิดีโอ" : "ออกแบบรูปลักษณ์ตัวละคร แล้วเก็บไว้ใช้ซ้ำในทุกเรื่อง"}</p>
          </div>
          {!publicView && capability && (
            <span className={ui.connection} data-state={capability.connectionMode === "fixture" ? "fixture" : capability.enabled ? "ready" : "off"} role="status">
              {capability.connectionMode === "fixture"
                ? "โหมดทดสอบ — ภาพจำลอง ไม่ได้สร้างด้วย AI และไม่ใช้เครดิต"
                : capability.enabled
                  ? "เชื่อมต่อ API แล้ว · พร้อมส่งคำขอสร้างภาพ"
                  : "เชื่อมต่อ API แล้ว · ยังไม่พร้อมส่งคำขอสร้างภาพ"}
            </span>
          )}
        </header>
        {recovering && (
          <p className="capability-notice" role="status">
            กำลังตรวจสอบคำขอก่อนหน้า ระบบจะใช้ข้อมูลเดิมเพื่อป้องกันการสร้างซ้ำ ภาพด้านขวาอาจเป็นผลจากรอบก่อนหน้า{" "}
            <Link href="/studio/jobs">ดูประวัติการสร้าง ↗</Link>
          </p>
        )}
        <div className={ui.scroll}>
          <div className={`creation-modes ${controls.categoryModes} ${ui.modes}`} role="group" aria-label="ประเภทภาพ">
            {(["character", "product"] as const).map((value) => (
              <button key={value} type="button" className={category === value ? "selected" : undefined}
                aria-pressed={category === value} disabled={!restored || uploading || locked}
                onClick={() => { setCategory(value); persistDraft({ category: value }); }}>
                {value === "character" ? <UserRound /> : <Package />}
                {value === "character" ? "สร้างตัวละคร" : "สร้างสินค้า"}
              </button>
            ))}
          </div>

          <section className={ui.section}>
            <div className={ui.sectionHead}><span aria-hidden>คำอธิบาย</span><span className={ui.counter}>{brief.length}/2000</span></div>
            <label className="sr-only" htmlFor="creative-idea">อธิบาย{subject}ของคุณ</label>
            <div className={ui.promptBox}>
              <textarea
                id="creative-idea"
                required
                minLength={3}
                maxLength={2000}
                value={brief}
                disabled={locked}
                onChange={(e) => { setBrief(e.target.value); persistDraft({ prompt: e.target.value }); }}
                placeholder={category === "product" ? "ขวดน้ำหอมทรงเหลี่ยม แก้วใสฝาสีทอง ฉลากเรียบหรูบนบรรจุภัณฑ์สีครีม แสงนุ่ม พื้นหลังเรียบ…" : "นักสำรวจผมสีเงินในชุดเกราะเหลือบรุ้ง ดวงตาอบอุ่นและอยากรู้อยากเห็น รองเท้าบูตสีน้ำตาล และกระเป๋าสำรวจประจำตัว…"}
              />
              <div className={ui.ideas} aria-label="ไอเดียตัวอย่าง">
                {ideas.map((text) => (
                  <button type="button" key={text} disabled={locked} onClick={() => { setBrief(text); persistDraft({ prompt: text }); document.getElementById("creative-idea")?.focus(); }}>
                    <Lightbulb aria-hidden />{text}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={`${controls.reference} ${ui.section}`} aria-busy={uploading}>
            <div className={ui.sectionHead}><span>ภาพอ้างอิง <small>(ไม่บังคับ)</small></span></div>
            <input id="character-reference" type="file" ref={fileRef} hidden
              accept="image/png,image/jpeg,image/webp" disabled={locked || (!publicView && !referenceAvailable)}
              onChange={(e) => upload(e.target.files?.[0])} />
            {reference ? (
              <div className={`${controls.referenceCard} ${ui.referenceCard}`}>
                {referencePreview ? <Image unoptimized src={referencePreview} width={72} height={72} alt={`ภาพอ้างอิง${subject}ที่เลือก`} className={controls.thumbnail} /> : <ImagePlus className={controls.thumbnail} aria-hidden="true" />}
                <div className={controls.referenceDetails}>
                  <p className={controls.referenceName}>{referenceName || "แนบภาพอ้างอิงแล้ว"}</p>
                  <p className={controls.referenceHint} role="status">{category === "product" ? "แนบภาพแล้ว · จะส่งไปพร้อมคำอธิบายและแท็ก" : "แนบภาพแล้ว · สร้างตัวละครสังเคราะห์จากภาพ คงเค้าโครงเดิมให้ใกล้เคียงที่สุด โดยผลลัพธ์อาจต่างจากต้นฉบับ"}{!referencePreview && " (ภาพตัวอย่างแสดงได้เฉพาะรอบที่อัปโหลด)"}</p>
                  <div className={controls.referenceActions}>
                    <button type="button" className="plain-control" disabled={locked || (!publicView && !referenceAvailable)} onClick={chooseReference}>{uploading ? "กำลังอัปโหลดภาพ…" : "เปลี่ยนภาพอ้างอิง"}</button>
                    <button type="button" className="plain-control" disabled={locked} onClick={removeReference}>นำภาพอ้างอิงออก</button>
                  </div>
                </div>
              </div>
            ) : (
              <button type="button" className={ui.dropzone} onClick={chooseReference} disabled={locked || (!publicView && !referenceAvailable)}>
                {uploading ? <LoaderCircle className="spin" /> : <ImagePlus />}
                <b>{uploading ? "กำลังอัปโหลดภาพ…" : "เพิ่มภาพอ้างอิง"}</b>
                <small>{publicView ? "เข้าสู่ระบบเพื่อเพิ่มภาพอ้างอิง" : category === "product" ? "ภาพสินค้า รูปทรง วัสดุ หรือบรรจุภัณฑ์" : "ใช้คงเค้าโครงและลักษณะเดิมให้ใกล้เคียงที่สุด"} · PNG, JPEG, WebP ไม่เกิน 8 MB</small>
              </button>
            )}
            {!publicView && !referenceAvailable && <p className={controls.referenceHint} role="status">{referenceUnavailableReason}</p>}
          </section>

          <div className={`${controls.designOptions} ${ui.section}`}>
            <fieldset disabled={locked} className={controls.tagGroup}>
              <legend>สไตล์ภาพ</legend>
              <div className={`${controls.tags} ${ui.chips}`}>
                {visualStyles.map((item) => (
                  <button type="button" key={item.value} aria-pressed={visualStyle === item.value}
                    onClick={() => { setVisualStyle(item.value); persistDraft({ visualStyle: item.value }); }}>
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset disabled={locked} className={controls.tagGroup}>
              <legend>{category === "product" ? "โทนภาพ" : "อารมณ์และบุคลิก"}</legend>
              <div className={`${controls.tags} ${ui.chips}`}>
                {(category === "product" ? productMoods : moods).map((item) => (
                  <button type="button" key={item.value} aria-pressed={mood === item.value}
                    onClick={() => { setMood(item.value); persistDraft({ mood: item.value }); }}>
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>
            {category === "character" && <>
              <label className={controls.format} htmlFor="character-design-format">
                รูปแบบภาพอ้างอิง
                <select id="character-design-format" value={designFormat} disabled={locked}
                  aria-describedby="character-format-help"
                  onChange={(e) => {
                    const next = e.target.value as NonNullable<CharacterDesignOptions["designFormat"]>;
                    setDesignFormat(next); persistDraft({ designFormat: next });
                  }}>
                  {designFormats.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <p id="character-format-help" className={controls.formatHelp}>
                {designFormats.find((item) => item.value === designFormat)?.description}
                {" "}แนะนำสัดส่วน {designFormat === "turnaround" ? "16:9" : "3:4"} โดยไม่รับประกันความเหมือนของตัวละครในทุกโมเดล
              </p>
            </>}
            <fieldset disabled={locked} className={controls.tagGroup}>
              <legend>สัดส่วนภาพ</legend>
              <div className={ui.ratios} role="group" aria-label="สัดส่วนภาพ">
                {ratios.map((r) => {
                  const [w, h] = r.split(":").map(Number);
                  return (
                    <button type="button" key={r} aria-pressed={ratio === r}
                      onClick={() => { ratioTouched.current = true; setRatio(r); persistDraft({ aspectRatio: r }); }}>
                      <span className={ui.ratioShape} style={{ aspectRatio: `${w} / ${h}` }} aria-hidden />
                      {r}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div className={ui.section}>
            <button type="button" className={`plain-control ${ui.advanced}`} aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
              <SlidersHorizontal /> ตั้งค่าเพิ่มเติม
            </button>
            {advanced && (
              <div className="brief-fields">
                <label htmlFor="character-name">
                  ชื่อ{subject} <span>(ไม่บังคับ)</span>
                  <input id="character-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder={`ตั้งชื่อให้${subject}ของคุณ`} />
                </label>
              </div>
            )}
          </div>
        </div>

        <footer className={`composer-submit ${ui.submit}`}>
          {!publicView && category === "product" && capability && !imageCategoryAvailable(category, capability.categories) && (
            <p className="capability-notice" role="status">โหมดสร้างสินค้ายังไม่พร้อมใช้งาน</p>
          )}
          {!publicView && capability && !capability.enabled && (
            <p className="capability-notice" role="status">
              {capability.unavailableReason || "ยังไม่ได้ตั้งค่าระบบสร้างภาพ กรุณาให้ผู้ดูแลเชื่อมต่อโมเดลสร้างภาพ"}
            </p>
          )}
          {error && <p className="creative-error" role="alert">{error}</p>}
          <button
            className={`btn-primary ${ui.generate}`}
            disabled={!restored || uploading || busy || active || (!publicView && (!capability?.enabled || !imageCategoryAvailable(category, capability?.categories) || blockedNewReference))}
          >
            {busy ? <LoaderCircle className="spin" /> : <Sparkles />}
            {busy
              ? "กำลังดำเนินการ…"
              : active
                ? `กำลังสร้าง${subject}…`
                : publicView
                  ? "เข้าสู่สตูดิโอ"
                  : recovering
                    ? "ส่งคำขอเดิมอีกครั้ง"
                    : capability?.connectionMode === "fixture"
                      ? "ทดสอบสร้างภาพจำลอง"
                      : job?.status === "succeeded"
                        ? `สร้างภาพ${subject}อีกแบบ`
                        : `สร้างภาพ${subject}`}
          </button>
          <span className={ui.submitNote}>
            {publicView
              ? `${subject}ของคุณเริ่มจากไอเดียเดียว`
              : capability?.enabled && capability.connectionMode !== "fixture"
                ? "ใช้ผู้ให้บริการ AI ที่ตั้งค่าไว้ ยังไม่มีข้อมูลราคาประเมิน และอาจมีค่าใช้จ่ายจากผู้ให้บริการ"
                : "บันทึกภาพที่สร้างเสร็จไว้ในคลังส่วนตัวได้"}
          </span>
        </footer>
      </form>

      <section className={ui.canvas} aria-live="polite" aria-label="ผลลัพธ์">
        {job ? (
          <div className={`character-result ${ui.result}`}>
            <div className={ui.resultHead}>
              <div>
                <span className="eyebrow">{resultSubject}ของคุณ</span>
                <h2>
                  {job.status === "succeeded"
                    ? `${resultSubject}ของคุณเป็นรูปเป็นร่างแล้ว`
                    : job.status === "failed"
                      ? "ลองปรับแล้วสร้างใหม่อีกครั้ง"
                      : "กำลังเปลี่ยนจินตนาการให้เป็นภาพ"}
                </h2>
              </div>
              <div className={ui.resultTools}>
                <span className={`job-state ${job.status}`}>{job.status === "succeeded" ? "เสร็จสมบูรณ์" : jobStatusLabel[job.status]}</span>
                <button type="button" className="btn-secondary" aria-disabled={refreshing} aria-busy={refreshing} onClick={() => { if (!refreshing) void refreshJob(); }}>
                  <RefreshCw aria-hidden />{refreshing ? "กำลังรีเฟรชสถานะ…" : "รีเฟรชสถานะ"}
                </button>
              </div>
            </div>
            {active && (
              <div className={`generation-pending ${ui.pending}`}>
                <div className={ui.pendingFrame} style={{ aspectRatio: ratio.replace(":", " / ") }}><LoaderCircle className="spin" /></div>
                <p>ภาพของคุณ{" "}{job.status === "queued" ? "กำลังรอคิว" : "กำลังสร้าง"}. ระหว่างรอ คุณสามารถไปหน้าอื่นในสตูดิโอได้</p>
                <Link href="/studio/jobs">ติดตามสถานะการสร้าง ↗</Link>
              </div>
            )}
            {job.status === "failed" && (
              <div className="creative-error">
                <p>{job.error?.message || "สร้างภาพไม่สำเร็จ ไอเดียของคุณยังอยู่ด้านซ้าย"}</p>
                <button type="button" className="btn-secondary" onClick={() => document.getElementById("creative-idea")?.focus()}>ทบทวนคำอธิบายแล้วลองใหม่ ←</button>
              </div>
            )}
            {job.status === "cancelled" && <p>ยกเลิกการสร้างแล้ว ไอเดียของคุณยังอยู่ด้านซ้าย</p>}
            {job.status === "succeeded" && job.result?.mediaType === "image" && job.result.mediaUrl ? (
              <div className={`result-layout ${ui.resultLayout}`}>
                <div className={ui.imageStage}>
                  <Image unoptimized width={900} height={900} src={job.result.mediaUrl} alt={job.rawPrompt || submitted || `ภาพออกแบบ${resultSubject}`} className={`generated-character ${ui.image}`} onError={() => void refreshJob("media")} />
                  <a href={job.result.mediaUrl} target="_blank" rel="noreferrer" className={ui.fullSize} aria-label="เปิดภาพขนาดเต็ม"><Maximize2 aria-hidden /></a>
                </div>
                <div className={`result-details ${ui.details}`}>
                  <p className={ui.prompt}>{job.rawPrompt ?? submitted}</p>
                  {(job.characterDesign || job.productDesign) && (
                    <p className="character-result-tags">
                      {[visualStyles.find((item) => item.value === (job.productDesign ?? job.characterDesign)?.visualStyle)?.label,
                        (resultProduct ? productMoods : moods).find((item) => item.value === (job.productDesign ?? job.characterDesign)?.mood)?.label,
                        !resultProduct && designFormats.find((item) => item.value === job.characterDesign?.designFormat)?.label]
                        .filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className={controls.formatHelp}>
                    {resultProduct ? "ตรวจรูปทรง วัสดุ สี ฉลาก และบรรจุภัณฑ์ให้ตรงกับสินค้าที่ต้องการก่อนบันทึก" : "ก่อนนำไปสร้างวิดีโอ ตรวจใบหน้า มือ เสื้อผ้า และสัดส่วนให้ตรงกับตัวละครที่ต้องการ เก็บภาพเต็มตัวมุมเดียวเป็นภาพอ้างอิงหลัก"}
                  </p>
                  <div className={ui.saveRow}>
                    <label htmlFor="saved-character-name">
                      ชื่อ{resultSubject}
                      <input id="saved-character-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder={`ตั้งชื่อให้${resultSubject}ของคุณ`} />
                    </label>
                    <button type="button" className="btn-primary" disabled={busy || saved || !name.trim()} onClick={save}>
                      {saved ? <Check /> : <ImagePlus />}
                      {saved ? "บันทึกลงคลังแล้ว" : `บันทึก${resultSubject}`}
                    </button>
                  </div>
                  <div className={ui.links}>
                    <Link href="/studio/library" className="plain-control">เปิดคลังผลงาน <ArrowUpRight /></Link>
                    <a href={job.result.mediaUrl} target="_blank" rel="noreferrer" className="plain-control">เปิดภาพขนาดเต็ม ↗</a>
                  </div>
                </div>
              </div>
            ) : (
              job.status === "succeeded" && <p className="creative-error">ผู้ให้บริการไม่ได้ส่งภาพที่ใช้งานได้ จึงยังบันทึกผลลัพธ์นี้ไม่ได้</p>
            )}
          </div>
        ) : (
          <div className={ui.empty}>
            <div className={ui.emptyArt} aria-hidden>
              {[0, 1, 2].map((i) => <span key={i} style={{ aspectRatio: ratio.replace(":", " / ") }}><ImageIcon /></span>)}
            </div>
            <h2>ภาพที่สร้างจะแสดงที่นี่</h2>
            <p>พิมพ์คำอธิบายทางซ้าย เลือกสไตล์และสัดส่วน แล้วกด “สร้างภาพ{subject}”</p>
            <ul className={ui.tips}>
              <li><b>ยิ่งละเอียดยิ่งดี</b> บอกรูปลักษณ์ วัสดุ สี แสง และฉากหลัง</li>
              <li><b>ใช้ภาพอ้างอิง</b> เมื่ออยากให้รูปทรงหรือใบหน้าใกล้เคียงต้นฉบับ</li>
              <li><b>บันทึกลงคลัง</b> เพื่อนำ{subject}ไปใช้ซ้ำในวิดีโอและงานผู้กำกับ</li>
            </ul>
            <Link href="/studio/library" className="plain-control">ดู{subject}ในคลังผลงาน <ArrowUpRight /></Link>
          </div>
        )}
      </section>
    </div>
  );
}
