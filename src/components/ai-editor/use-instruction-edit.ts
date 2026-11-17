"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {EditorApiError, videoEditorApi, type EditorProject} from "@/lib/video-editor-api";
import {videoEditorAiApi, type AiEditPreview} from "@/lib/video-editor-ai-api";
import {compareTimelines, instructionEditError, instructionIssue, type CountRow} from "./ai-edit-rules";
import {playbackTimeline} from "./media-playback";
import type {EditorPersistence} from "./use-editor-ai";

export type InstructionPreview = {projectId: string; preview: AiEditPreview; rows: CountRow[]};
const durationOf = (segments: {start: number; end: number; speed?: number; transitionDuration?: number}[]) => playbackTimeline(segments).at(-1)?.timelineEnd ?? 0;
const conflict = (error: unknown) => error instanceof EditorApiError && (error.status === 409 || error.code === "REVISION_CONFLICT");

/**
 * Instruction edits: preview never saves; apply is the ordinary project save of the server's proposal at
 * the preview's baseRevision, adopted through the same path as an AI draft so it can be undone.
 */
export function useInstructionEdit(persistence: EditorPersistence, onApply: (project: EditorProject, epoch: number, revision: number) => boolean) {
  const [instruction, setInstruction] = useState(""), [result, setResult] = useState<InstructionPreview | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "apply">(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const alive = useRef(true), lock = useRef(false), controller = useRef<AbortController | null>(null), context = useRef({persistence, onApply});
  useEffect(() => {context.current = {persistence, onApply};}, [persistence, onApply]);
  useEffect(() => {alive.current = true;return () => {alive.current = false;controller.current?.abort();};}, []);

  const recoverFromConflict = useCallback(async (projectId: string) => {
    const {persistence: current} = context.current;
    setResult(null);
    // A dirty timeline must not be replaced silently; the editor's conflict banner offers keep-local / load-latest.
    if (current.snapshot().dirty || current.uploadCount > 0) {current.flagAiConflict("โปรเจกต์มีฉบับใหม่กว่า กรุณาเก็บฉบับในเครื่องแล้วโหลดฉบับล่าสุดก่อนแก้ด้วยคำสั่ง");setError("โปรเจกต์มีฉบับใหม่กว่า กรุณาโหลดฉบับล่าสุดก่อน");return;}
    await current.load(projectId, true);
    if (alive.current) setError("โปรเจกต์ถูกแก้จากที่อื่น ระบบโหลดฉบับล่าสุดแล้ว กรุณาดูตัวอย่างการแก้อีกครั้ง");
  }, []);

  async function preview() {
    if (lock.current) return;
    const issue = instructionIssue(instruction);
    if (issue) {setError(issue);return;}
    lock.current = true;setBusy("preview");setError("");setNotice("");setResult(null);
    const request = new AbortController();controller.current = request;
    let projectId = "";
    try {
      const {persistence: current} = context.current;
      let snapshot = current.snapshot();
      if (!snapshot.project) throw new Error("กรุณารอโหลดโปรเจกต์ก่อน");
      // The server edits the stored timeline, so local edits are saved first (same rule as starting an analysis).
      if (snapshot.dirty) {
        let saved: Awaited<ReturnType<typeof current.save>>;
        try {saved = await current.save();}
        catch (failure) {
          // The local timeline is unsaved and older than the server: keep it and use the editor's keep-local / load-latest choice.
          if (conflict(failure)) {
            const guidance = "โปรเจกต์มีฉบับใหม่กว่างานในเครื่อง กด “เก็บฉบับในเครื่อง” เพื่อเก็บงานไว้ แล้ว “โหลดฉบับล่าสุด” ที่แถบแจ้งเตือนด้านบน ก่อนดูตัวอย่างการแก้อีกครั้ง";
            current.flagAiConflict(guidance);if (alive.current) setError(guidance);return;
          }
          throw failure;
        }
        if (!saved.unchanged) throw new Error("มีการแก้ไขระหว่างบันทึก กรุณากดดูตัวอย่างอีกครั้ง");
        snapshot = current.snapshot();
      }
      const project = snapshot.project;
      if (!project) throw new Error("กรุณารอโหลดโปรเจกต์ก่อน");
      projectId = project.id;
      const response = await videoEditorAiApi.previewEdit(project.id, {instruction: instruction.trim(), revision: project.revision}, request.signal);
      if (request.signal.aborted || !alive.current || context.current.persistence.snapshot().project?.id !== project.id) return;
      const proposal = response.proposal;
      setResult({projectId: project.id, preview: response, rows: compareTimelines(snapshot, durationOf(snapshot.segments), proposal, durationOf(proposal.segments))});
    } catch (failure) {
      if (request.signal.aborted || !alive.current) return;
      if (conflict(failure) && projectId) await recoverFromConflict(projectId);
      else setError(instructionEditError(failure));
    } finally {
      if (controller.current === request) controller.current = null;
      lock.current = false;if (alive.current) setBusy("");
    }
  }

  async function apply() {
    const current = result;
    if (lock.current || !current) return;
    lock.current = true;setBusy("apply");setError("");setNotice("");
    try {
      const {persistence: editor} = context.current, snapshot = editor.snapshot();
      if (!snapshot.project || snapshot.project.id !== current.projectId) throw new Error("กรุณาเปิดโปรเจกต์เดิมก่อนนำการแก้ไปใช้");
      if (snapshot.dirty || snapshot.project.revision !== current.preview.baseRevision) {setResult(null);throw new Error("timeline เปลี่ยนไปหลังดูตัวอย่าง กรุณาดูตัวอย่างการแก้อีกครั้ง");}
      const proposal = current.preview.proposal;
      // Sent as-is: an absent imageLayers stays absent so the server keeps the stored image layers.
      const saved = await editor.exclusiveSave(() => videoEditorApi.save(current.projectId, {...proposal, revision: current.preview.baseRevision}));
      if (!alive.current) return;
      const adopted = context.current.onApply(saved, snapshot.epoch, snapshot.project.revision);
      setResult(null);
      if (adopted) {setInstruction("");setNotice("นำการแก้ไปใช้กับ timeline แล้ว กดย้อนกลับ (Ctrl+Z) ได้หากไม่ต้องการ");}
      else setNotice("บันทึกการแก้บนเซิร์ฟเวอร์แล้ว แต่ timeline ในหน้านี้มีการเปลี่ยนแปลง กรุณาเก็บฉบับในเครื่องแล้วโหลดฉบับล่าสุด");
    } catch (failure) {
      if (!alive.current) return;
      if (conflict(failure)) await recoverFromConflict(current.projectId);
      else setError(instructionEditError(failure));
    } finally {lock.current = false;if (alive.current) setBusy("");}
  }

  function cancel() {
    controller.current?.abort();controller.current = null;
    setResult(null);setError("");setNotice("");
  }
  return {instruction, setInstruction, result, busy, error, notice, preview, apply, cancel};
}
