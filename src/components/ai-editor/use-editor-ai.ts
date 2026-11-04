"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {EditorApiError, videoEditorApi, type EditorProject} from "@/lib/video-editor-api";
import {videoEditorAiApi, type AiCapabilities, type AiCreateRequest, type AiDraftSegment, type AiJob} from "@/lib/video-editor-ai-api";
import {copySegments, isBusy, keyFor, readAiIntents, sameAiDraft, terminal, text, type Intents} from "@/lib/video-editor-ai-state";
import {approvalIdsForApply} from "./ai-composition";
import type {useEditorProject} from "./use-editor-project";

export type EditorPersistence = ReturnType<typeof useEditorProject>;
type DraftEdit = {jobId: string; revision: number; segments: AiDraftSegment[]; dirty: boolean; conflict: boolean};
export function useEditorAi(persistence: EditorPersistence, onApply: (project: EditorProject, epoch: number, revision: number) => boolean) {
  const projectId = persistence.project?.id;
  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null), [ownerId, setOwnerId] = useState("");
  const [jobs, setJobs] = useState<AiJob[]>([]), [job, setJob] = useState<AiJob | null>(null), [draftEdit, setDraftEdit] = useState<DraftEdit | null>(null);
  const [loading, setLoading] = useState(true), [action, setAction] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [approved, setApproved] = useState<string[]>([]), [intents, setIntents] = useState<Intents | null>(null);
  const alive = useRef(true), context = useRef({persistence, onApply}), jobRef = useRef<AiJob | null>(null), draftRef = useRef<DraftEdit | null>(null), intentsRef = useRef<Intents | null>(null), actionRef = useRef(false), controllers = useRef(new Set<AbortController>());
  useEffect(() => {context.current = {persistence, onApply};}, [persistence, onApply]);
  const store = useCallback((next: Intents) => {
    sessionStorage.setItem(keyFor(next.ownerId, next.projectId), JSON.stringify(next));
    intentsRef.current = next;setIntents(next);
  }, []);
  const editState = useCallback((next: DraftEdit | null) => {draftRef.current = next;setDraftEdit(next);}, []);
  const receive = useCallback((next: AiJob, forceDraft = false) => {
    if (!alive.current || context.current.persistence.snapshot().project?.id !== next.projectId) return;
    const previous = jobRef.current;
    jobRef.current = next;setJob(next);setJobs(items => [next, ...items.filter(item => item.id !== next.id)]);
    if (next.draft && (forceDraft || previous?.id !== next.id || previous.draft?.revision !== next.draft.revision)) {
      const local = draftRef.current;
      const retained = intentsRef.current?.localDraft;
      if (!forceDraft && local?.jobId === next.id && local.dirty) {
        editState({...local, conflict: true});setError("ฉบับร่างมีการเปลี่ยนแปลง กรุณาเก็บฉบับในเครื่องแล้วโหลดฉบับร่างล่าสุด");
      } else if (!forceDraft && retained?.jobId === next.id) {
        editState({jobId: next.id, revision: retained.revision, segments: copySegments(retained.segments), dirty: true, conflict: retained.revision !== next.draft.revision});
      } else editState({jobId: next.id, revision: next.draft.revision, segments: copySegments(next.draft.segments), dirty: false, conflict: false});
      setApproved([]);
    } else if (!next.draft) {editState(null);setApproved([]);}
    if (next.selectedConceptId && intentsRef.current?.select?.jobId === next.id) {
      const updated = {...intentsRef.current};
      if (updated.select?.conceptId !== next.selectedConceptId) setError("งานนี้มีการเลือกแนวเรื่องอื่นแล้ว กรุณาตรวจฉบับร่างก่อนนำไปใช้");
      delete updated.select;store(updated);
    }
    if (next.status !== "failed" && intentsRef.current?.retry?.jobId === next.id) {const updated = {...intentsRef.current};delete updated.retry;store(updated);}
    if (terminal.has(next.status) && next.status !== "failed") setApproved([]);
  }, [editState, store]);
  useEffect(() => {
    alive.current = true;
    const activeControllers = controllers.current, controller = new AbortController();activeControllers.add(controller);
    void (async () => {
      try {
        const [caps, owner] = await Promise.all([videoEditorAiApi.capabilities(controller.signal), videoEditorAiApi.owner(controller.signal)]);
        if (controller.signal.aborted) return;
        setCapabilities(caps);setOwnerId(owner);
        if (projectId) {
          const list = await videoEditorAiApi.jobs(projectId, controller.signal);
          if (controller.signal.aborted) return;
          const restored = readAiIntents(sessionStorage.getItem(keyFor(owner, projectId)), owner, projectId);store(restored);setJobs(list);
          const requested = restored.apply?.jobId ?? restored.select?.jobId ?? restored.retry?.jobId ?? restored.localDraft?.jobId;
          let requestedJob = list.find(item => item.id === requested);
          if (requested && !requestedJob) {
            try {const owned = await videoEditorAiApi.job(requested, controller.signal);if (owned.projectId === projectId) requestedJob = owned;} catch (failure) {if (controller.signal.aborted) throw failure;}
            if (!requestedJob) {delete restored.apply;delete restored.select;delete restored.retry;delete restored.localDraft;store(restored);}
          }
          const latest = requestedJob ?? list.find(item => !terminal.has(item.status)) ?? list[0];
          if (latest) receive(latest);
        }
      } catch (failure) {if (!controller.signal.aborted) setError(text(failure));}
      finally {activeControllers.delete(controller);if (!controller.signal.aborted) setLoading(false);}
    })();
    return () => {alive.current = false;activeControllers.forEach(value => value.abort());activeControllers.clear();};
  }, [projectId, receive, store]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const id = jobRef.current?.id;if (!id) return;
    const latest = await videoEditorAiApi.job(id, signal);if (!signal?.aborted) receive(latest);
  }, [receive]);
  useEffect(() => {
    if (!projectId) return;
    const activeControllers = controllers.current, controller = new AbortController();activeControllers.add(controller);let inFlight = false, finishedAt = Date.now();
    const tick = async (force = false) => {
      if (inFlight || controller.signal.aborted || !jobRef.current || (!force && !isBusy(jobRef.current) && Date.now() - finishedAt < 60000)) return;
      inFlight = true;
      try {await refresh(controller.signal);} catch (failure) {if (!controller.signal.aborted && alive.current) setError(text(failure));}
      finally {inFlight = false;finishedAt = Date.now();}
    };
    const timer = setInterval(() => {void tick();}, 2000), focus = () => {void tick(true);};window.addEventListener("focus", focus);
    return () => {controller.abort();activeControllers.delete(controller);clearInterval(timer);window.removeEventListener("focus", focus);};
  }, [projectId, refresh]);
  useEffect(() => {
    if (job?.status !== "failed" || !job.retryAt) return;
    const delay = new Date(job.retryAt).getTime() - Date.now();if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = setTimeout(() => {void refresh().catch(failure => {if (alive.current) setError(text(failure));});}, Math.min(delay + 100, 2147483647));return () => clearTimeout(timer);
  }, [job?.id, job?.retryAt, job?.status, refresh]);
  useEffect(() => {const before = (event: BeforeUnloadEvent) => {if (draftRef.current?.dirty || actionRef.current) {event.preventDefault();event.returnValue = "";}};window.addEventListener("beforeunload", before);return () => window.removeEventListener("beforeunload", before);}, []);
  async function perform(name: string, operation: (signal: AbortSignal) => Promise<void>) {
    if (actionRef.current || !alive.current) return;
    actionRef.current = true;setAction(name);setError("");setNotice("");const controller = new AbortController();controllers.current.add(controller);
    try {await operation(controller.signal);} catch (failure) {if (!controller.signal.aborted && alive.current) setError(text(failure));}
    finally {controllers.current.delete(controller);actionRef.current = false;if (alive.current) setAction("");}
  }
  function currentIntents(): Intents {const existing = intentsRef.current;if (!existing || !ownerId || !projectId) throw new Error("กรุณารอโหลดโปรเจกต์และยืนยันบัญชีก่อน");return {...existing};}
  const clear = (field: "create" | "select" | "apply" | "retry" | "localDraft") => {const next = currentIntents();delete next[field];store(next);};
  function definitive(failure: unknown) {return failure instanceof EditorApiError && failure.status >= 400 && failure.status < 500;}
  async function start(settings: Omit<AiCreateRequest, "requestId" | "revision">) {
    await perform("analysis", async signal => {
      let pending = currentIntents().create;
      if (!pending) {
        const saved = await context.current.persistence.save();
        if (!saved.unchanged) throw new Error("มีการแก้ไขระหว่างบันทึก กรุณาตรวจและเริ่มวิเคราะห์อีกครั้ง");
        pending = {...settings, requestId: crypto.randomUUID(), revision: saved.project.revision};store({...currentIntents(), create: pending});
      }
      try {const result = await videoEditorAiApi.create(projectId ?? "", pending, signal);if (signal.aborted || !alive.current) return;clear("create");clear("localDraft");editState(null);receive(result);}
      catch (failure) {if (definitive(failure)) clear("create");throw failure;}
    });
  }
  async function select(conceptId: string) {
    const active = jobRef.current;if (!active) return;
    await perform("selection", async signal => {
      const intent = currentIntents().select ?? {jobId: active.id, conceptId};if (intent.jobId !== active.id) throw new Error("กรุณาเปิดงานที่คำขอเดิมอ้างอิงก่อน");store({...currentIntents(), select: intent});
      try {const result = await videoEditorAiApi.select(intent.jobId, intent.conceptId, signal);if (!signal.aborted && alive.current) {clear("select");receive(result);}}
      catch (failure) {if (definitive(failure)) clear("select");throw failure;}
    });
  }
  function changeDraft(segments: AiDraftSegment[]) {
    const active = draftRef.current;if (!active || actionRef.current || intentsRef.current?.apply) return;
    const next = {...active, segments: copySegments(segments), dirty: true};editState(next);setApproved([]);
    try {store({...currentIntents(), localDraft: {jobId: active.jobId, revision: active.revision, segments: copySegments(segments)}});} catch (failure) {setError(text(failure));}
  }
  async function saveDraft() {
    const local = draftRef.current;if (!local || local.conflict) return;
    await perform("draft", async signal => {
      try {const result = await videoEditorAiApi.draft(local.jobId, local.revision, local.segments, signal);if (!signal.aborted && alive.current) {clear("localDraft");receive(result, true);}}
      catch (failure) {
        if (signal.aborted) throw failure;
        try {
          const latest = await videoEditorAiApi.job(local.jobId, signal);
          if (latest.draft && latest.draft.revision > local.revision && sameAiDraft(latest.draft.segments, local.segments)) {clear("localDraft");receive(latest, true);return;}
          if (latest.draft && latest.draft.revision !== local.revision) {editState({...local, conflict: true});setApproved([]);}
        } catch {}
        throw failure;
      }
    });
  }
  async function reloadDraft() {
    const active = jobRef.current;if (!active) return;
    if (draftRef.current?.dirty && !window.confirm("โหลดฉบับร่างล่าสุดแทนการแก้ไขในเครื่องหรือไม่?")) return;
    await perform("draft", async signal => {const latest = await videoEditorAiApi.job(active.id, signal);if (!signal.aborted && alive.current) {clear("localDraft");receive(latest, true);}});
  }
  async function applyDraft(options?: {approveAll?: boolean}) {
    const active = jobRef.current, local = draftRef.current;if (!active || !local) return;
    await perform("apply", async signal => {
      const snapshot = context.current.persistence.snapshot();if (!snapshot.project || snapshot.dirty) throw new Error("มีการแก้ไขใน timeline กรุณาเก็บฉบับในเครื่องหรือบันทึกก่อนตรวจแผนอีกครั้ง");
      let intent = currentIntents().apply;
      if (intent && intent.jobId !== active.id) throw new Error("กรุณาเปิดงานที่คำขอเดิมอ้างอิงก่อน");
      if (!intent) {
        if (local.dirty || local.conflict || active.sourceRevision !== snapshot.project.revision) throw new Error("โปรเจกต์หรือฉบับร่างมีการเปลี่ยนแปลง กรุณาวิเคราะห์จากฉบับล่าสุด");
        const approvalIds = approvalIdsForApply(local.segments.map(segment=>segment.id),approved,active.autoCompose===true,options?.approveAll===true);
        intent = {jobId: active.id, body: {requestId: crypto.randomUUID(), revision: snapshot.project.revision, draftRevision: local.revision, approvedSegmentIds: [...approvalIds]}};store({...currentIntents(), apply: intent});
      }
      try {
        let result = await videoEditorAiApi.apply(intent.jobId, intent.body, signal);if (signal.aborted || !alive.current) return;
        const now = context.current.persistence.snapshot();
        if (now.project && now.project.revision > result.revision) result = await videoEditorApi.project(result.id, signal);
        if (signal.aborted || !alive.current) return;
        const adopted = context.current.onApply(result, snapshot.epoch, snapshot.project.revision);
        clear("apply");clear("localDraft");receive({...active, status: "applied", stage: "applied", appliedRevision: result.revision}, true);
        setNotice(adopted ? "นำแผนไปใช้กับ timeline แล้ว ย้อนกลับหรือแก้ต่อได้" : "แผนถูกบันทึกบนเซิร์ฟเวอร์แล้ว งานที่แก้ในเครื่องยังอยู่ กรุณาเก็บฉบับในเครื่องก่อนโหลดล่าสุด");
        try {const latest = await videoEditorAiApi.job(active.id, signal);if (!signal.aborted) receive(latest, true);} catch {}
      } catch (failure) {if (definitive(failure)) clear("apply");if (failure instanceof EditorApiError && failure.code === "REVISION_CONFLICT") context.current.persistence.flagAiConflict("โปรเจกต์มีฉบับใหม่ กรุณาเก็บฉบับในเครื่องแล้วโหลดฉบับล่าสุดก่อนวิเคราะห์ใหม่");throw failure;}
    });
  }
  async function cancel() {
    const active = jobRef.current;if (!active) return;
    await perform("cancel", async signal => {const latest = await videoEditorAiApi.cancel(active.id, signal);if (!signal.aborted && alive.current) {clear("select");clear("retry");clear("localDraft");receive(latest, true);}});
  }
  async function retry() {
    const active = jobRef.current;if (!active) return;
    await perform("retry", async signal => {
      const intent = currentIntents().retry ?? {jobId: active.id, requestId: crypto.randomUUID()};if (intent.jobId !== active.id) throw new Error("กรุณาเปิดงานที่คำขอเดิมอ้างอิงก่อน");store({...currentIntents(), retry: intent});
      try {const latest = await videoEditorAiApi.retry(intent.jobId, intent.requestId, signal);if (!signal.aborted && alive.current) {clear("retry");receive(latest);}}
      catch (failure) {if (definitive(failure)) clear("retry");throw failure;}
    });
  }
  async function chooseJob(id: string) {
    if (actionRef.current) return;
    if (draftRef.current?.dirty) {setError("กรุณาบันทึกฉบับร่าง หรือโหลดฉบับร่างล่าสุดก่อนเปลี่ยนงาน");return;}
    await perform("load", async signal => {const latest = await videoEditorAiApi.job(id, signal);if (!signal.aborted && alive.current) receive(latest);});
  }
  function reset() {if (actionRef.current || isBusy(jobRef.current)) return;if (draftRef.current?.dirty) {setError("กรุณาบันทึกฉบับร่าง หรือโหลดฉบับร่างล่าสุดก่อนเริ่มงานใหม่");return;}jobRef.current = null;setJob(null);editState(null);setApproved([]);setError("");setNotice("");}
  function recoverDraft() {const local = draftRef.current;if (!local) return;const blob = new Blob([JSON.stringify({projectId, jobId: local.jobId, draftRevision: local.revision, segments: local.segments}, null, 2)], {type: "application/json"});const url = URL.createObjectURL(blob), anchor = document.createElement("a");anchor.href = url;anchor.download = "ai-draft-recovery.json";anchor.click();setTimeout(() => URL.revokeObjectURL(url), 1000);}
  return {capabilities, ownerId, loading, action, error, notice, jobs, job, draftEdit, approved, setApproved, intents, start, select, changeDraft, saveDraft, reloadDraft, applyDraft, cancel, retry, chooseJob, reset, recoverDraft, refresh};
}
