"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRefreshPolling } from "@/hooks/use-refresh-polling";
import { directorApi, DirectorError, errorMessage, hasWork, type Idea, type Project } from "@/lib/director-api";
import { definiteRejection, finishSubmission, pendingSubmission, prepareSubmission } from "@/lib/director-submission";

export function useDirectorProject(id: string) {
  const [server, setServer] = useState<Project | null>(null);
  const current = useRef<Project | null>(null);
  const [ideaDraft, setIdeaDraft] = useState<Idea | null>(null);
  const draft = useRef<Idea | null>(null);
  const draftVersion = useRef(0);
  const [error, setError] = useState<unknown>(null);
  const actionError = useRef(false);
  const [saving, setSaving] = useState(0);
  const count = useRef(0);
  const epoch = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const refreshRef = useRef<() => void>(() => {});
  const apply = useCallback((p: Project) => { current.current = p; if (alive.current) setServer(p); }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);
  const refresh = useRefreshPolling(id, {
    intervalMs: 2000,
    fetch: async (signal, reason) => {
      const version = epoch.current;
      const p = await directorApi.get(id, signal, reason === "poll");
      return { p, version };
    },
    onData: ({ p, version }) => {
      if (version === epoch.current && count.current === 0) { apply(p); if (!actionError.current) setError(null); }
      return { poll: hasWork(current.current ?? p), expiresAt: [p.cover?.expiresAt, p.coverImageExpiresAt, ...p.scenes.flatMap(s => s.shots.map(x => x.image.expiresAt))].flatMap(v => v && Number.isFinite(Date.parse(v)) ? [Date.parse(v)] : []) };
    },
    onError: setError,
  });
  useEffect(() => { refreshRef.current = () => { void refresh("manual"); }; }, [refresh]);
  const enqueue = useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
    count.current += 1;
    setSaving(count.current);
    epoch.current += 1;
    const next = queue.current.catch(() => {}).then(run);
    queue.current = next;
    void next.finally(() => {
      count.current -= 1;
      epoch.current += 1;
      if (alive.current) { setSaving(count.current); refreshRef.current(); }
    }).catch(() => {});
    return next;
  }, []);
  const submit = useCallback(async (path: string, method: string, payload: Record<string, unknown>, paid = false) => {
    const p = current.current;
    if (!p) throw new Error("กำลังโหลดโปรเจกต์");
    const scope = `${id}:${path || "project"}`;
    const submission = paid ? prepareSubmission(scope, { ...payload, revision: p.revision }) : null;
    try {
      const result = await directorApi.mutate(id, path, method, submission ? { ...submission.body, idempotencyKey: submission.key } : { ...payload, revision: p.revision });
      if (paid) finishSubmission(scope);
      apply(result);
      actionError.current = false;
      if (alive.current) setError(null);
      return result;
    } catch (cause) {
      if (cause instanceof DirectorError && definiteRejection(cause) && paid) finishSubmission(scope);
      if (cause instanceof DirectorError && cause.code === "REVISION_CONFLICT") {
        try { apply(await directorApi.get(id)); } catch { /* Keep the actionable conflict even if its refresh fails. */ }
      }
      actionError.current = true;
      if (alive.current) setError(cause);
      throw cause;
    }
  }, [id, apply]);
  const saveIdea = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    return enqueue(async () => {
      const idea = draft.current;
      if (!idea) return;
      const version = draftVersion.current;
      await submit("/idea", "PUT", { ...idea });
      if (draftVersion.current === version) { draft.current = null; if (alive.current) setIdeaDraft(null); }
    });
  }, [enqueue, submit]);
  const changeIdea = useCallback((patch: Partial<Idea>, immediate = false) => {
    const base = draft.current ?? current.current?.idea;
    if (!base) return;
    const next = { ...base, ...patch };
    draft.current = next;
    draftVersion.current += 1;
    setIdeaDraft(next);
    if (timer.current) clearTimeout(timer.current);
    if (immediate) void saveIdea().catch(() => {});
    else timer.current = setTimeout(() => { void saveIdea().catch(() => {}); }, 600);
  }, [saveIdea]);
  const mutate = useCallback(async (path: string, method: string, payload: Record<string, unknown> = {}, paid = false) => {
    // Replay an uncertain paid operation before saving new edits: its revision and input must stay frozen.
    if (!(paid && pendingSubmission(`${id}:${path || "project"}`)) && draft.current) await saveIdea();
    return enqueue(() => submit(path, method, payload, paid));
  }, [id, enqueue, saveIdea, submit]);
  const mediaError = useCallback(() => { void refresh("media"); }, [refresh]);
  return { project: server ? { ...server, idea: ideaDraft ?? server.idea } : null, error, message: error ? errorMessage(error) : null, saving, hasDraft: ideaDraft !== null, changeIdea, saveIdea, mutate, refresh, mediaError };
}
export type DirectorMutation = ReturnType<typeof useDirectorProject>["mutate"];
