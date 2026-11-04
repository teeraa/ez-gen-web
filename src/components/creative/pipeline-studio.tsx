'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, Check, Clock, Film, ImagePlus, Library, Loader2, RotateCcw, Sparkles, Wand2, X } from 'lucide-react';
import { uploadsApi } from '@/lib/api';
import { pipelineApi, PipelineApiError, type Pipeline, type PipelineCapabilities, type PipelinePreflight, type PipelineRequest } from '@/lib/pipeline-api';
import { DEFAULT_MODEL } from '@/lib/model-capabilities';
import type { ModelId } from '@/types/api';
import { pipelineFailureMessage } from '@/lib/pipeline-failure';
import { estimateDialogueSeconds, mayExceedThaiDialogueDuration } from '@/lib/dialogue-timing';
import { getPipelineProgress } from '@/lib/pipeline-progress';
import { type Asset } from '@/lib/creative-api';
import { orderedRatios, QUICK_DURATIONS, rankModels, recommendDuration } from '@/lib/studio-recommend';
import { PipelineCharacterPicker } from './pipeline-character-picker';
import { restorePipelineRequest, restorePipelineFinal, type PendingPipelineFinal } from '@/lib/pipeline-submission';
import styles from './studio.module.css';

const pendingKey = 'violet-pipeline-submission';
const finalKey = 'violet-pipeline-final-submission';
const draftKey = 'violet-pipeline-draft';
const LIMITS = { character: 2000, scene: 2000, dialogue: 1000 } as const;
const STATUS: Record<Pipeline['status'], string> = { queued: 'รอคิว', processing: 'กำลังสร้าง', succeeded: 'เสร็จแล้ว', failed: 'ไม่สำเร็จ', needs_attention: 'ต้องตรวจสอบ' };
const STEPS = ['สร้างตัวละคร', 'บันทึกตัวละคร', 'สร้างวิดีโอ', 'บันทึกวิดีโอ'];
const LIBRARY_STEPS = ['ใช้ตัวละครจากคลัง', 'พร้อมใช้', 'สร้างวิดีโอ', 'บันทึกวิดีโอ'];
const IDEAS = [
  { label: 'รีวิวสินค้า', prompt: 'ถือสินค้าให้เห็นชัด หันฉลากเข้ากล้อง แล้วยิ้มแนะนำอย่างเป็นกันเอง แสงสตูดิโอนุ่ม' },
  { label: 'โปรโมทแบรนด์', prompt: 'เดินเข้าหากล้องอย่างมั่นใจในสตูดิโอเรียบหรู กล้องค่อย ๆ เคลื่อนตาม' },
  { label: 'ทักทายโซเชียล', prompt: 'ยิ้มทักทายและโบกมือให้กล้อง บรรยากาศสดใส กล้องค่อย ๆ ดันเข้าใกล้' },
  { label: 'ฉากแอ็กชัน', prompt: 'ชักกระบี่ออกจากฝักช้า ๆ บนยอดเขาท่ามกลางหมอก ใบไม้ปลิว กล้องดันเข้าใบหน้า แสงยามเย็น' },
];

const runes = (text: string) => Array.from(text).length;
const modeLabel = (value: Pipeline) => (value.isDraft ? 'แบบร่าง 480p' : value.sourceDraftId ? 'ฉบับสมบูรณ์ 1080p' : 'วิดีโอ');

export function PipelineStudio() {
  // ── inputs ────────────────────────────────────────────────────────────────
  const [source, setSource] = useState<'upload' | 'library'>('upload');
  const [libraryCharacter, setLibraryCharacter] = useState<Asset | null>(null);
  const [character, setCharacter] = useState('');
  const [scene, setScene] = useState('');
  const [dialogue, setDialogue] = useState('');
  const [reference, setReference] = useState('');
  const [preview, setPreview] = useState('');
  const [filename, setFilename] = useState('');
  const [ratio, setRatio] = useState('9:16');
  const [duration, setDuration] = useState(5);
  const [modelId, setModelId] = useState<ModelId>(DEFAULT_MODEL);
  // null = follow the recommendation (draft on when the model offers it).
  const [draftChoice, setDraftChoice] = useState<boolean | null>(null);
  const modelTouched = useRef(false);

  // ── server state ──────────────────────────────────────────────────────────
  const [cap, setCap] = useState<PipelineCapabilities | null>(null);
  const [capError, setCapError] = useState(false);
  const [jobs, setJobs] = useState<Pipeline[]>([]);
  const [job, setJob] = useState<Pipeline | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [pollError, setPollError] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PipelineRequest | null>(null);
  const [ready, setReady] = useState(false);
  const [pendingFinal, setPendingFinal] = useState<PendingPipelineFinal | null>(null);
  const [finalError, setFinalError] = useState('');
  const [check, setCheck] = useState<{ key: string; result: PipelinePreflight | null } | null>(null);
  const [lastBudget, setLastBudget] = useState<PipelinePreflight | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const submitLock = useRef(false);
  const selectedId = useRef<string | null>(null);
  const selectionEpoch = useRef(0);

  const selectJob = useCallback((value: Pipeline | null) => {
    selectionEpoch.current++;
    selectedId.current = value?.id ?? null;
    setJob(value);
    setPollError(false);
    setMediaError(false);
  }, []);
  const loadCapabilities = useCallback(async () => {
    setCapError(false);
    try {
      setCap(await pipelineApi.capabilities());
    } catch {
      setCapError(true);
    }
  }, []);
  const loadJobs = useCallback(async () => {
    const epoch = selectionEpoch.current;
    setListLoading(true);
    try {
      const data = await pipelineApi.list();
      setJobs(data.items);
      setListError(false);
      if (selectionEpoch.current === epoch && !selectedId.current) selectJob(data.items[0] ?? null);
    } catch {
      setListError(true);
    } finally {
      setListLoading(false);
    }
  }, [selectJob]);

  // Restore the typed draft, settings handed over from the landing page, and any send that
  // may not have reached the server.
  useEffect(() => {
    void loadCapabilities();
    void loadJobs();
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null');
      if (draft) {
        setCharacter(typeof draft.character === 'string' ? draft.character : '');
        setScene(typeof draft.scene === 'string' ? draft.scene : '');
        setDialogue(typeof draft.dialogue === 'string' ? draft.dialogue : '');
        if (draft.aspectRatio === '9:16' || draft.aspectRatio === '16:9') setRatio(draft.aspectRatio);
        if ([5, 8, 10].includes(draft.durationSeconds)) setDuration(draft.durationSeconds);
        if (typeof draft.draft === 'boolean') setDraftChoice(draft.draft);
      }
      const savedFinal = restorePipelineFinal(JSON.parse(sessionStorage.getItem(finalKey) ?? 'null'));
      if (savedFinal) setPendingFinal(savedFinal);
      const restored = restorePipelineRequest(JSON.parse(sessionStorage.getItem(pendingKey) ?? 'null'));
      if (restored) {
        setPending(restored);
        setSource(restored.characterAssetId ? 'library' : 'upload');
        setDialogue(restored.dialogue ?? '');
        setModelId(restored.modelId as ModelId);
        modelTouched.current = true;
        setRatio(restored.aspectRatio);
        setDuration(restored.durationSeconds);
        setDraftChoice(restored.draft === true);
      }
    } catch {}
    setReady(true);
  }, [loadCapabilities, loadJobs]);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({ character, scene, dialogue }));
      } catch {}
  }, [character, scene, dialogue, ready]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const id = job?.id;
  const running = job?.status === 'queued' || job?.status === 'processing';
  useEffect(() => {
    if (!id || !running) return;
    let alive = true;
    const timer = setInterval(() => {
      pipelineApi
        .get(id)
        .then((value) => {
          if (alive && selectedId.current === id) {
            setJob(value);
            setJobs((items) => items.map((item) => (item.id === value.id ? value : item)));
            setPollError(false);
          }
        })
        .catch(() => {
          if (alive && selectedId.current === id) setPollError(true);
        });
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id, running]);

  // ── derived: model choices and what the chosen model allows ───────────────
  const locked = !!pending || !!pendingFinal || busy || uploading;
  const sourceMode: 'library' | 'upload' | 'text' = source === 'library' ? 'library' : reference ? 'upload' : 'text';
  const choices = useMemo(() => rankModels(cap?.models ?? [], { hasDialogue: !!dialogue.trim(), source: sourceMode }), [cap, dialogue, sourceMode]);
  const modelCap = cap?.models?.find((item) => item.id === modelId) ?? cap;
  const supportsDraft = !!cap?.models?.find((item) => item.id === modelId)?.supportsDraft;
  const draft = supportsDraft && (draftChoice ?? true);
  const sourceEnabled = source === 'library' ? !!modelCap?.libraryEnabled : reference ? !!modelCap?.enabled : !!modelCap?.textEnabled;
  const availableRatios = useMemo(() => (source === 'library' ? modelCap?.libraryAspectRatios : modelCap?.aspectRatios) ?? [], [modelCap, source]);
  const availableDurations = useMemo(() => (source === 'library' ? modelCap?.libraryDurations : modelCap?.durations) ?? [], [modelCap, source]);
  const ratios = orderedRatios(availableRatios);
  const quickDurations = QUICK_DURATIONS.filter((d) => availableDurations.includes(d));
  // Prefer a one-tap chip; fall back to the full list only when no chip is long enough.
  const suggestedDuration = modelCap?.supportsDialogue && dialogue.trim() ? recommendDuration(quickDurations, dialogue) ?? recommendDuration(availableDurations, dialogue) : undefined;
  const speakSeconds = estimateDialogueSeconds(dialogue);
  const dialogueTooLongForClip = !!modelCap?.supportsDialogue && mayExceedThaiDialogueDuration(dialogue, duration);

  // Until the user picks a model, follow the recommendation for the current inputs.
  useEffect(() => {
    if (modelTouched.current || !choices.length) return;
    const best = choices.find((c) => !c.blockedReason);
    if (best && best.model.id !== modelId) setModelId(best.model.id as ModelId);
  }, [choices, modelId]);
  // Keep ratio and duration valid for the chosen model.
  useEffect(() => {
    if (availableRatios.length && !availableRatios.includes(ratio)) setRatio(orderedRatios(availableRatios)[0]?.value ?? availableRatios[0]);
    if (availableDurations.length && !availableDurations.includes(duration)) setDuration(availableDurations.includes(5) ? 5 : availableDurations[0]);
  }, [availableRatios, availableDurations, ratio, duration]);

  function chooseModel(next: string) {
    modelTouched.current = true;
    setModelId(next as ModelId);
  }

  // ── validation: instant local limits + the server's exact prompt budget ───
  const requestBody = useMemo<Omit<PipelineRequest, 'idempotencyKey'>>(
    () => ({
      ...(source === 'library' ? { characterAssetId: libraryCharacter?.id } : reference ? { referenceImageId: reference } : {}),
      characterPrompt: source === 'library' ? '' : character,
      scenePrompt: scene,
      ...(dialogue ? { dialogue } : {}),
      visualStyle: 'cinematic_realistic',
      aspectRatio: ratio,
      durationSeconds: duration,
      modelId,
      quality: 'standard',
      ...(draft ? { draft: true } : {}),
    }),
    [source, libraryCharacter, reference, character, scene, dialogue, ratio, duration, modelId, draft],
  );
  const bodyKey = JSON.stringify(requestBody);
  useEffect(() => {
    if (!cap || pending || (!scene.trim() && !dialogue.trim())) return;
    let alive = true;
    const timer = setTimeout(() => {
      pipelineApi
        .preflight(requestBody)
        .then((result) => {
          if (!alive) return;
          setCheck({ key: bodyKey, result });
          setLastBudget(result);
        })
        // Endpoint missing (older API) or offline: fall back to local checks; create still validates.
        .catch(() => alive && setCheck({ key: bodyKey, result: null }));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [bodyKey, requestBody, cap, pending, scene, dialogue]);
  const preflight = check?.key === bodyKey ? check : null;
  const checking = !!(scene.trim() || dialogue.trim()) && !preflight;

  const blockers: string[] = [];
  if (source === 'library' && !libraryCharacter) blockers.push('เลือกตัวละครจากคลัง');
  if (source !== 'library' && !character.trim()) blockers.push('ใส่ลักษณะตัวละคร');
  if (!scene.trim()) blockers.push('ใส่ฉากและการเคลื่อนไหว');
  if (runes(character) > LIMITS.character) blockers.push(`ลักษณะตัวละครยาวเกิน ${LIMITS.character} ตัวอักษร`);
  if (runes(scene) > LIMITS.scene) blockers.push(`ฉากยาวเกิน ${LIMITS.scene} ตัวอักษร`);
  if (runes(dialogue) > LIMITS.dialogue) blockers.push(`บทพูดยาวเกิน ${LIMITS.dialogue} ตัวอักษร`);
  if (dialogue.trim() && modelCap && !modelCap.supportsDialogue) blockers.push('โมเดลนี้ไม่รองรับบทพูด');
  for (const issue of preflight?.result?.issues ?? []) if (!blockers.includes(issue.message)) blockers.push(issue.message);

  // Remaining room in the combined budget, from the latest answer (it lags typing by ~350ms).
  const budget = preflight?.result ?? lastBudget;
  const remaining = budget && budget.promptLimit ? budget.promptLimit - budget.promptRunes : null;
  // Stop typing at the limit instead of failing on send. Only once dialogue makes the budget a
  // hard rule; without dialogue an overlong prompt is truncated, not rejected.
  const roomFor = (value: string, hardMax: number) => (dialogue && remaining !== null ? Math.max(runes(value), Math.min(hardMax, runes(value) + Math.max(0, remaining))) : hardMax);
  const budgetPct = budget && budget.promptLimit ? Math.min(100, Math.round((budget.promptRunes / budget.promptLimit) * 100)) : 0;
  const overBudget = remaining !== null && remaining < 0 && !!dialogue;

  // ── actions ───────────────────────────────────────────────────────────────
  async function refresh() {
    const target = selectedId.current;
    if (!target) return;
    try {
      const value = await pipelineApi.get(target);
      if (selectedId.current === target) {
        setJob(value);
        setJobs((items) => items.map((item) => (item.id === value.id ? value : item)));
        setPollError(false);
        setMediaError(false);
      }
    } catch {
      if (selectedId.current === target) setPollError(true);
    }
  }
  async function upload(file?: File) {
    if (!file || uploading || busy || pending || pendingFinal || source !== 'upload') return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('กรุณาเลือกภาพ JPG, PNG หรือ WebP');
      return;
    }
    setUploading(true);
    setReference('');
    setPreview('');
    setFilename('');
    try {
      const result = await uploadsApi.upload(file);
      setReference(result.uploadId);
      setPreview(URL.createObjectURL(file));
      setFilename(file.name);
    } catch {
      setError('อัปโหลดภาพไม่สำเร็จ กรุณาเลือกภาพอีกครั้ง');
    } finally {
      setUploading(false);
    }
  }
  function clearReference() {
    setReference('');
    setPreview('');
    setFilename('');
    if (fileRef.current) fileRef.current.value = '';
  }
  async function send(body: PipelineRequest) {
    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setError('');
    setPending(body);
    try {
      sessionStorage.setItem(pendingKey, JSON.stringify(body));
    } catch {
      setError('ไม่สามารถเก็บคำขอเพื่อกู้คืนได้ กรุณาเปิดการจัดเก็บข้อมูลของเบราว์เซอร์');
      setBusy(false);
      submitLock.current = false;
      return;
    }
    try {
      const result = await pipelineApi.create(body);
      selectJob(result);
      setJobs((items) => [result, ...items.filter((item) => item.id !== result.id)]);
      setPending(null);
      sessionStorage.removeItem(pendingKey);
      resultRef.current?.focus();
    } catch (cause) {
      if (cause instanceof PipelineApiError && cause.status >= 400 && cause.status < 500) {
        setPending(null);
        sessionStorage.removeItem(pendingKey);
        setError(cause.status === 429 ? 'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' : cause.status === 401 ? 'กรุณาเข้าสู่ระบบอีกครั้ง' : cause.details[0]?.message ?? 'คำขอไม่ได้รับการยอมรับ กรุณาตรวจสอบรายละเอียดหรือเลือกภาพอ้างอิงใหม่');
      } else {
        setError('ยังยืนยันคำขอไม่ได้ คุณสามารถส่งคำขอเดิมอีกครั้งโดยไม่เปลี่ยนรายละเอียด');
      }
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pendingFinal) return;
    if (pending) {
      void send(pending);
      return;
    }
    if (blockers.length || !sourceEnabled || !availableRatios.includes(ratio) || !availableDurations.includes(duration)) {
      setError(blockers[0] ?? 'ขณะนี้ยังไม่รองรับคำขอนี้ กรุณาตรวจสอบการตั้งค่า');
      return;
    }
    void send({ ...requestBody, idempotencyKey: crypto.randomUUID() });
  }
  async function retry() {
    if (!job || !job.canRetry || busy || pendingFinal || pending) return;
    setBusy(true);
    try {
      const target = job.id;
      const value = await pipelineApi.retry(target);
      if (selectedId.current === target) {
        setJob(value);
        setJobs((items) => items.map((item) => (item.id === value.id ? value : item)));
        setError('');
      }
    } catch {
      setError('ยังดำเนินการต่อไม่ได้ กรุณาตรวจสอบงานอีกครั้ง');
    } finally {
      setBusy(false);
    }
  }
  function startNew() {
    if (pending || pendingFinal || busy || uploading) return;
    selectJob(null);
    setCharacter('');
    setScene('');
    setDialogue('');
    setLibraryCharacter(null);
    clearReference();
    setError('');
    setFinalError('');
  }
  function changeSource(value: 'upload' | 'library') {
    if (locked) return;
    setSource(value);
    setLibraryCharacter(null);
    clearReference();
    setError('');
  }
  async function sendFinal(body: PendingPipelineFinal) {
    if (submitLock.current || pending || uploading) return;
    submitLock.current = true;
    setBusy(true);
    setFinalError('');
    setPendingFinal(body);
    try {
      sessionStorage.setItem(finalKey, JSON.stringify(body));
    } catch {
      setFinalError('ไม่สามารถเก็บคำขอเพื่อกู้คืนได้ กรุณาเปิดการจัดเก็บข้อมูลของเบราว์เซอร์');
      setBusy(false);
      submitLock.current = false;
      return;
    }
    try {
      const result = await pipelineApi.finalize(body.sourceId, body.idempotencyKey);
      selectJob(result);
      setJobs((items) => [result, ...items.filter((item) => item.id !== result.id)]);
      setPendingFinal(null);
      try {
        sessionStorage.removeItem(finalKey);
      } catch {}
      resultRef.current?.focus();
    } catch (cause) {
      if (cause instanceof PipelineApiError && cause.status >= 400 && cause.status < 500) {
        setPendingFinal(null);
        try {
          sessionStorage.removeItem(finalKey);
        } catch {}
        setFinalError(cause.code === 'DRAFT_EXPIRED' ? 'ฉบับร่างหมดอายุสำหรับสร้างฉบับสมบูรณ์ กรุณาสร้างวิดีโอใหม่' : cause.status === 401 ? 'กรุณาเข้าสู่ระบบอีกครั้ง' : cause.status === 429 ? 'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' : 'ยังสร้างฉบับสมบูรณ์จากร่างนี้ไม่ได้ กรุณาตรวจสอบสถานะอีกครั้ง');
        void refresh();
      } else setFinalError('ยังยืนยันคำขอฉบับสมบูรณ์ไม่ได้ ส่งคำขอเดิมอีกครั้งได้โดยไม่สร้างงานซ้ำ');
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  }
  async function openSource(sourceId: string) {
    if (locked) return;
    setBusy(true);
    setFinalError('');
    try {
      selectJob(await pipelineApi.get(sourceId));
      resultRef.current?.focus();
    } catch {
      setFinalError('โหลดฉบับร่างต้นฉบับไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  const progress = job ? getPipelineProgress(job) : null;
  const stepLabels = job?.sourceMode === 'library' ? LIBRARY_STEPS : STEPS;
  const selectedChoice = choices.find((c) => c.model.id === modelId);
  const canSend = !locked && sourceEnabled && !blockers.length && !checking;
  const summary = [selectedChoice?.model.label, ratio, `${duration} วิ`, draft ? 'แบบร่าง 480p' : null].filter(Boolean).join(' · ');

  // ── view ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.studio}>
      <form className={styles.composer} onSubmit={submit} aria-label="สร้างวิดีโอ">
        <div className={styles.composerScroll}>
          {pending && (
            <div className={styles.notice} role="status">
              <strong>มีคำขอที่ยังส่งไม่สำเร็จ</strong>
              <span>กด “ส่งคำขอเดิมอีกครั้ง” ระบบจะไม่สร้างงานซ้ำ</span>
            </div>
          )}
          {pendingFinal && (
            <div className={styles.notice} role="status">
              <strong>คำขอฉบับสมบูรณ์ยังรอยืนยัน</strong>
              <button type="button" className={styles.linkBtn} disabled={busy} onClick={() => void sendFinal(pendingFinal)}>
                {busy ? 'กำลังส่ง…' : 'ส่งคำขอเดิมอีกครั้ง'}
              </button>
            </div>
          )}

          {/* 1. Character */}
          <section className={styles.block} aria-labelledby="sec-character">
            <div className={styles.blockHead}>
              <h2 id="sec-character">ตัวละคร</h2>
              <div className={styles.segment} role="radiogroup" aria-label="แหล่งตัวละคร">
                <button type="button" role="radio" aria-checked={source === 'upload'} disabled={locked} onClick={() => changeSource('upload')}>
                  <Wand2 aria-hidden /> สร้างใหม่
                </button>
                <button type="button" role="radio" aria-checked={source === 'library'} disabled={locked} onClick={() => changeSource('library')}>
                  <Library aria-hidden /> จากคลัง
                </button>
              </div>
            </div>
            {source === 'library' ? (
              <div className={styles.picker}>
                <PipelineCharacterPicker selected={libraryCharacter} onSelect={setLibraryCharacter} disabled={locked} />
              </div>
            ) : (
              <>
                <div className={styles.field}>
                  <textarea
                    id="pipeline-character"
                    aria-label="ลักษณะตัวละคร"
                    rows={3}
                    maxLength={LIMITS.character}
                    value={character}
                    disabled={locked}
                    onChange={(e) => setCharacter(e.target.value)}
                    placeholder="เช่น หญิงสาวผมสั้นสีน้ำตาล เสื้อเชิ้ตสีครีม ยิ้มอบอุ่น"
                  />
                  <span className={styles.count}>
                    {runes(character)}/{LIMITS.character}
                  </span>
                </div>
                <div
                  className={styles.refRow}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!locked) void upload(e.dataTransfer.files[0]);
                  }}
                >
                  {preview ? <Image unoptimized src={preview} width={44} height={44} alt="ภาพอ้างอิง" className={styles.refThumb} /> : <span className={styles.refIcon}><ImagePlus aria-hidden /></span>}
                  <label htmlFor="pipeline-image" className={styles.refLabel}>
                    <strong>{uploading ? 'กำลังอัปโหลด…' : filename || 'แนบภาพอ้างอิง'}</strong>
                    <span>{reference ? 'ระบบจะคงหน้าตาใกล้ภาพนี้' : 'ไม่บังคับ · JPG, PNG, WebP · ลากมาวางได้'}</span>
                  </label>
                  <input ref={fileRef} id="pipeline-image" className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} onChange={(e) => void upload(e.target.files?.[0])} />
                  {reference && (
                    <button type="button" className={styles.iconBtn} disabled={locked} onClick={clearReference} aria-label="นำภาพออก">
                      <X aria-hidden />
                    </button>
                  )}
                </div>
              </>
            )}
          </section>

          {/* 2. Scene */}
          <section className={styles.block} aria-labelledby="sec-scene">
            <div className={styles.blockHead}>
              <h2 id="sec-scene">ฉากและการเคลื่อนไหว</h2>
            </div>
            <div className={`${styles.field} ${runes(scene) > LIMITS.scene || overBudget ? styles.fieldOver : ''}`}>
              <textarea
                id="pipeline-scene"
                aria-label="ฉากและการเคลื่อนไหว"
                rows={4}
                maxLength={roomFor(scene, LIMITS.scene)}
                value={scene}
                disabled={locked}
                onChange={(e) => setScene(e.target.value)}
                placeholder="ตัวละครทำอะไร ที่ไหน กล้องเคลื่อนอย่างไร เช่น เดินผ่านตลาดยามเช้า หันมายิ้ม กล้องค่อย ๆ ดันเข้า"
              />
              <span className={styles.count}>
                {runes(scene)}/{LIMITS.scene}
              </span>
            </div>
            {!scene && (
              <div className={styles.ideas}>
                {IDEAS.map((idea) => (
                  <button type="button" key={idea.label} disabled={locked} onClick={() => setScene(idea.prompt)}>
                    {idea.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 3. Dialogue */}
          <section className={styles.block} aria-labelledby="sec-dialogue">
            <div className={styles.blockHead}>
              <h2 id="sec-dialogue">
                บทพูด <span className={styles.optional}>ไม่บังคับ</span>
              </h2>
              {dialogue && speakSeconds > 0 && (
                <span className={styles.meta}>
                  <Clock aria-hidden /> พูดราว {Math.max(1, Math.round(speakSeconds))} วิ
                </span>
              )}
            </div>
            <div className={`${styles.field} ${runes(dialogue) > LIMITS.dialogue || overBudget ? styles.fieldOver : ''}`}>
              <textarea
                id="pipeline-dialogue"
                aria-label="บทพูด"
                rows={2}
                maxLength={roomFor(dialogue, LIMITS.dialogue)}
                value={dialogue}
                disabled={locked || (!!modelCap && !modelCap.supportsDialogue && !dialogue)}
                onChange={(e) => setDialogue(e.target.value)}
                placeholder={modelCap && !modelCap.supportsDialogue ? 'โมเดลนี้ไม่มีเสียงพูด' : 'สิ่งที่ตัวละครพูด เช่น “สวัสดีค่ะ วันนี้มีของดีมาฝาก”'}
              />
              <span className={styles.count}>
                {runes(dialogue)}/{LIMITS.dialogue}
              </span>
            </div>
            {dialogueTooLongForClip && suggestedDuration && suggestedDuration !== duration && (
              <p className={styles.hint} role="status">
                <AlertTriangle aria-hidden /> บทพูดน่าจะยาวกว่าวิดีโอ {duration} วิ
                <button type="button" className={styles.linkBtn} disabled={locked} onClick={() => setDuration(suggestedDuration)}>
                  ใช้ {suggestedDuration} วิ
                </button>
              </p>
            )}
          </section>

          {/* Combined budget: what the server will actually check. */}
          {budget && budget.promptLimit > 0 && (scene || dialogue) && (
            <div className={`${styles.budget} ${overBudget ? styles.budgetOver : budgetPct > 90 ? styles.budgetNear : ''}`} aria-live="polite">
              <div className={styles.budgetBar}>
                <span style={{ width: `${budgetPct}%` }} />
              </div>
              <span>
                {overBudget
                  ? `ฉาก + บทพูดเกินพื้นที่ ${Math.abs(remaining ?? 0)} ตัวอักษร`
                  : budget.sceneTruncated
                    ? 'ฉากยาวมาก ส่วนท้ายอาจถูกตัด'
                    : `พื้นที่ข้อความเหลือ ${Math.max(0, remaining ?? 0).toLocaleString('th-TH')} ตัวอักษร`}
              </span>
            </div>
          )}

          {/* 4. Settings — recommended options first. */}
          <section className={styles.block} aria-labelledby="sec-settings">
            <div className={styles.blockHead}>
              <h2 id="sec-settings">ตั้งค่าวิดีโอ</h2>
            </div>

            <div className={styles.settingLabel}>โมเดล</div>
            <div className={styles.models} role="radiogroup" aria-label="โมเดล">
              {choices.map((c) => (
                <button
                  type="button"
                  role="radio"
                  key={c.model.id}
                  aria-checked={c.model.id === modelId}
                  disabled={locked || !!c.blockedReason}
                  className={styles.modelCard}
                  onClick={() => chooseModel(c.model.id)}
                >
                  <span className={styles.modelName}>
                    {c.model.label}
                    {c.badge && <span className={styles.badge}>{c.badge}</span>}
                  </span>
                  <span className={styles.modelHint}>{c.blockedReason ?? c.hint}</span>
                </button>
              ))}
              {!choices.length && <p className={styles.meta}>{capError ? 'โหลดรายการโมเดลไม่สำเร็จ' : 'กำลังโหลดโมเดล…'}</p>}
            </div>

            <div className={styles.settingLabel}>สัดส่วน</div>
            <div className={styles.ratios} role="radiogroup" aria-label="สัดส่วน">
              {ratios.map((r) => {
                const [w, h] = r.value.split(':').map(Number);
                return (
                  <button type="button" role="radio" key={r.value} aria-checked={ratio === r.value} disabled={locked} className={styles.ratioChip} onClick={() => setRatio(r.value)}>
                    <span className={styles.ratioShape} style={{ aspectRatio: `${w} / ${h}` }} aria-hidden />
                    <strong>{r.value}</strong>
                    <small>{r.use}</small>
                  </button>
                );
              })}
            </div>

            <div className={styles.settingLabel}>ความยาว</div>
            <div className={styles.durations} role="radiogroup" aria-label="ความยาว">
              {quickDurations.map((d) => (
                <button type="button" role="radio" key={d} aria-checked={duration === d} disabled={locked} className={styles.chip} onClick={() => setDuration(d)}>
                  {d} วิ
                  {d === suggestedDuration && <span className={styles.dot} title="พอดีบทพูด" />}
                </button>
              ))}
              <select aria-label="ความยาวอื่น" className={styles.select} value={quickDurations.includes(duration) ? '' : duration} disabled={locked} onChange={(e) => e.target.value && setDuration(Number(e.target.value))}>
                <option value="">อื่น ๆ</option>
                {availableDurations
                  .filter((d) => !quickDurations.includes(d))
                  .map((d) => (
                    <option key={d} value={d}>
                      {d} วินาที
                    </option>
                  ))}
              </select>
              {suggestedDuration && quickDurations.includes(suggestedDuration) && <span className={styles.meta}>● พอดีบทพูด</span>}
            </div>

            {supportsDraft && (
              <label className={styles.draftRow}>
                <input type="checkbox" checked={draft} disabled={locked} onChange={(e) => setDraftChoice(e.target.checked)} />
                <span className={styles.switch} aria-hidden />
                <span>
                  <strong>เริ่มจากแบบร่าง 480p</strong>
                  <small>เร็วและประหยัด พอใจแล้วค่อยสร้าง 1080p จากร่างเดิม</small>
                </span>
              </label>
            )}
          </section>
        </div>

        {/* Sticky action bar */}
        <div className={styles.actionBar}>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : blockers.length && (scene || dialogue || character) ? (
            <p className={styles.blocker}>{blockers[0]}</p>
          ) : capError ? (
            <p className={styles.blocker}>
              โหลดการตั้งค่าไม่สำเร็จ{' '}
              <button type="button" className={styles.linkBtn} onClick={() => void loadCapabilities()}>
                ลองใหม่
              </button>
            </p>
          ) : (
            <p className={styles.summary}>{summary}</p>
          )}
          <button className={styles.primary} type={pending ? 'button' : 'submit'} disabled={pending ? busy : !canSend} onClick={pending ? () => void send(pending) : undefined}>
            {busy ? <Loader2 className={styles.spin} aria-hidden /> : <Sparkles aria-hidden />}
            {busy ? 'กำลังส่ง…' : pending ? 'ส่งคำขอเดิมอีกครั้ง' : checking ? 'กำลังตรวจข้อความ…' : draft ? 'สร้างแบบร่าง' : 'สร้างวิดีโอ'}
          </button>
        </div>
      </form>

      {/* Result */}
      <section className={styles.result} aria-labelledby="pipeline-result">
        <div className={styles.resultHead}>
          <h2 id="pipeline-result" ref={resultRef} tabIndex={-1}>
            ผลงาน
          </h2>
          {job && (
            <span className={`${styles.status} ${styles[`status_${job.status}`] ?? ''}`} role="status">
              {running && <Loader2 className={styles.spin} aria-hidden />}
              {STATUS[job.status]}
            </span>
          )}
          {job && (
            <button type="button" className={styles.ghostBtn} disabled={locked} onClick={startNew}>
              สร้างใหม่
            </button>
          )}
        </div>

        <div className={styles.stage}>
          {!job ? (
            <div className={styles.empty}>
              <Film aria-hidden />
              <p>วิดีโอของคุณจะแสดงที่นี่</p>
            </div>
          ) : job.videoMediaUrl ? (
            <video
              key={job.videoMediaUrl}
              className={styles.media}
              controls
              playsInline
              preload="auto"
              aria-label="วิดีโอที่สร้าง"
              src={job.videoMediaUrl}
              onError={() => setMediaError(true)}
              // Show a real frame (~1s in; frame 0 is often black) instead of a poster image,
              // then rewind on the first play so playback still starts at the beginning.
              onLoadedData={(e) => {
                const v = e.currentTarget;
                if (v.currentTime === 0 && v.paused) {
                  const t = Math.min(1, (v.duration || 2) / 4);
                  v.dataset.preview = String(t);
                  v.currentTime = t;
                }
              }}
              onPlay={(e) => {
                const v = e.currentTarget;
                if (v.dataset.preview) {
                  delete v.dataset.preview;
                  v.currentTime = 0;
                }
              }}
              onSeeking={(e) => {
                // A seek by the user (not our preview jump) cancels the rewind.
                const v = e.currentTarget;
                if (v.dataset.preview && Math.abs(v.currentTime - Number(v.dataset.preview)) > 0.05) delete v.dataset.preview;
              }}
            />
          ) : job.characterMediaUrl ? (
            <div className={styles.mediaWrap}>
              <Image unoptimized fill sizes="(max-width: 1100px) 100vw, 60vw" src={job.characterMediaUrl} alt="ตัวละครที่สร้าง" className={styles.mediaContain} onError={() => setMediaError(true)} />
              {running && <span className={styles.stageNote}>กำลังสร้างวิดีโอจากตัวละครนี้…</span>}
            </div>
          ) : (
            <div className={styles.empty}>
              {running ? <Loader2 className={styles.spin} aria-hidden /> : <Film aria-hidden />}
              <p>{running ? 'กำลังเริ่มงาน…' : STATUS[job.status]}</p>
            </div>
          )}
          {job && <span className={`${styles.modeTag} ${job.isDraft ? styles.modeDraft : ''}`}>{modeLabel(job)}</span>}
        </div>

        {progress && (running || job?.status === 'failed' || job?.status === 'needs_attention') && (
          <ol className={styles.steps} aria-label={`ความคืบหน้า ${progress.completed} จาก 4 ขั้นตอน`}>
            {progress.stages.map((step, index) => (
              <li key={step.stage} className={styles[`step_${step.state}`] ?? ''}>
                <span className={styles.stepDot}>{step.state === 'complete' ? <Check aria-hidden /> : index + 1}</span>
                {stepLabels[index]}
              </li>
            ))}
          </ol>
        )}

        {job && (
          <div className={styles.resultBody}>
            {mediaError && (
              <p className={styles.error} role="alert">
                โหลดสื่อไม่สำเร็จ{' '}
                <button type="button" className={styles.linkBtn} onClick={() => void refresh()}>
                  โหลดใหม่
                </button>
              </p>
            )}
            {pollError && (
              <p className={styles.error} role="alert">
                ตรวจสอบสถานะไม่สำเร็จ งานอาจยังดำเนินอยู่{' '}
                <button type="button" className={styles.linkBtn} onClick={() => void refresh()}>
                  ตรวจอีกครั้ง
                </button>
              </p>
            )}
            {(job.status === 'failed' || job.status === 'needs_attention') && (
              <div className={styles.failBox} role="alert">
                <p>
                  {job.characterAssetId ? 'ตัวละครบันทึกแล้ว แต่ขั้นตอนถัดไปยังไม่สำเร็จ ' : ''}
                  {pipelineFailureMessage(job)}
                </p>
                {job.canRetry && (
                  <button type="button" className={styles.secondary} disabled={locked} onClick={() => void retry()}>
                    <RotateCcw aria-hidden /> ทำต่อจากงานเดิม
                  </button>
                )}
              </div>
            )}

            {job.isDraft && (
              <div className={styles.finalBox}>
                <div>
                  <strong>พอใจแบบร่างนี้ไหม?</strong>
                  <p>
                    สร้างฉบับ 1080p จากร่างเดิม (มีค่าใช้จ่ายเพิ่ม)
                    {job.draftExpiresAt && ` · ได้ถึง ${new Date(job.draftExpiresAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`}
                  </p>
                </div>
                {job.canCreateFinal ? (
                  <button type="button" className={styles.primary} disabled={locked} onClick={() => void sendFinal({ sourceId: job.id, idempotencyKey: crypto.randomUUID() })}>
                    สร้าง 1080p
                  </button>
                ) : (
                  <span className={styles.meta}>{job.status === 'succeeded' ? (job.finalUnavailableReason ? 'ร่างนี้ใช้ต่อไม่ได้แล้ว' : 'ยังสร้างจากร่างนี้ไม่ได้') : 'รอแบบร่างเสร็จก่อน'}</span>
                )}
              </div>
            )}
            {finalError && (
              <p className={styles.error} role="alert">
                {finalError}
              </p>
            )}
            {job.sourceDraftId && (
              <button type="button" className={styles.linkBtn} disabled={locked} onClick={() => void openSource(job.sourceDraftId as string)}>
                ดูแบบร่างต้นฉบับ
              </button>
            )}

            <div className={styles.resultLinks}>
              {job.videoAssetId && <Link href="/studio/library?type=video">ดูในคลังวิดีโอ</Link>}
              {job.characterAssetId && <Link href="/studio/library?type=character">ดูตัวละครในคลัง</Link>}
              {running && <span className={styles.meta}>ออกจากหน้านี้ได้ งานจะทำต่อเอง</span>}
            </div>

            <details className={styles.details}>
              <summary>รายละเอียดคำขอ</summary>
              <dl>
                {job.modelLabel && (
                  <>
                    <dt>ตั้งค่า</dt>
                    <dd>
                      {job.modelLabel} · {job.aspectRatio} · {job.durationSeconds} วิ
                    </dd>
                  </>
                )}
                <dt>ตัวละคร</dt>
                <dd>{job.sourceMode === 'library' ? 'ตัวละครจากคลัง' : job.characterPrompt}</dd>
                <dt>ฉาก</dt>
                <dd>{job.scenePrompt}</dd>
                {job.dialogue && (
                  <>
                    <dt>บทพูด</dt>
                    <dd>{job.dialogue}</dd>
                  </>
                )}
                <dt>สร้างเมื่อ</dt>
                <dd>
                  {new Date(job.createdAt).toLocaleString('th-TH')} · {job.id.slice(0, 8)}
                </dd>
              </dl>
            </details>
          </div>
        )}

        <div id="pipeline-history" className={styles.history}>
          <h3>งานล่าสุด</h3>
          {listLoading ? (
            <p className={styles.meta}>กำลังโหลด…</p>
          ) : listError ? (
            <p className={styles.meta}>
              โหลดไม่สำเร็จ{' '}
              <button type="button" className={styles.linkBtn} onClick={() => void loadJobs()}>
                ลองใหม่
              </button>
            </p>
          ) : jobs.length ? (
            <ul>
              {jobs.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <button type="button" className={`${styles.historyCard} ${item.id === job?.id ? styles.historyOn : ''}`} disabled={locked} onClick={() => selectJob(item)} aria-label={`ดูงาน ${item.scenePrompt.slice(0, 40)}`}>
                    <span className={styles.thumb}>
                      {item.videoMediaUrl ? (
                        // A frame ~1s in: the first frame is often black or a fade-in.
                        <video className={styles.thumbVideo} src={`${item.videoMediaUrl}#t=1`} preload="metadata" muted playsInline tabIndex={-1} aria-hidden />
                      ) : item.characterMediaUrl ? (
                        <Image unoptimized fill sizes="160px" src={item.characterMediaUrl} alt="" />
                      ) : (
                        <Film aria-hidden />
                      )}
                      <span className={`${styles.thumbStatus} ${styles[`status_${item.status}`] ?? ''}`}>{STATUS[item.status]}</span>
                    </span>
                    <span className={styles.historyText}>{item.scenePrompt || item.characterPrompt || 'วิดีโอ'}</span>
                    <span className={styles.historyMeta}>
                      {modeLabel(item)} · {new Date(item.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.meta}>ยังไม่มีงาน เริ่มสร้างวิดีโอแรกได้เลย</p>
          )}
        </div>
      </section>
    </div>
  );
}

