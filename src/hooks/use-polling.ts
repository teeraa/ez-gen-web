"use client"
import { useEffect, useRef, useState } from "react"
import { jobsApi } from "@/lib/api"
import { earliestExpiry } from "@/lib/refresh-polling"
import { useRefreshPolling } from "@/hooks/use-refresh-polling"
import type { JobDTO } from "@/types/api"
import { TERMINAL_STATUSES } from "@/types/api"
const MIN_INTERVAL_MS = 2500
interface UseJobPollingOptions { jobId: string | null; intervalMs?: number; onTerminal?: (job: JobDTO) => void }
interface UseJobPollingResult { job: JobDTO | null; isPolling: boolean; error: string | null }
export function useJobPolling({ jobId, intervalMs = MIN_INTERVAL_MS, onTerminal }: UseJobPollingOptions): UseJobPollingResult {
  const [job, setJob] = useState<JobDTO | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const notified = useRef<string | null>(null)
  useEffect(() => { setJob(null); setError(null); setIsPolling(!!jobId); notified.current = null }, [jobId])
  useRefreshPolling(jobId, {
    intervalMs: Math.max(intervalMs, MIN_INTERVAL_MS),
    fetch: signal => jobsApi.get(jobId ?? "", signal),
    onData: result => {
      setJob(result); setError(null)
      const terminal = TERMINAL_STATUSES.includes(result.status)
      setIsPolling(!terminal)
      if (terminal && notified.current !== result.jobId) { notified.current = result.jobId; onTerminal?.(result) }
      return { poll: !terminal, expiresAt: earliestExpiry([result.result?.expiresAt]) }
    },
    onError: err => { setError(err instanceof Error ? err.message : "Polling error"); setIsPolling(false) },
  })
  return { job, isPolling, error }
}
