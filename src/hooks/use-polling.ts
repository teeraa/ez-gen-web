"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { jobsApi } from "@/lib/api"
import type { JobDTO } from "@/types/api"
import { TERMINAL_STATUSES } from "@/types/api"

interface UseJobPollingOptions {
  jobId: string | null
  intervalMs?: number
  onCompleted?: (job: JobDTO) => void
  onFailed?: (job: JobDTO) => void
}

interface UseJobPollingResult {
  job: JobDTO | null
  isPolling: boolean
  error: string | null
  stop: () => void
}

export function useJobPolling({
  jobId,
  intervalMs = 2000,
  onCompleted,
  onFailed,
}: UseJobPollingOptions): UseJobPollingResult {
  const [job, setJob] = useState<JobDTO | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stoppedRef = useRef(false)

  const stop = useCallback(() => {
    stoppedRef.current = true
    setIsPolling(false)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const poll = useCallback(async (id: string) => {
    if (stoppedRef.current) return
    try {
      const result = await jobsApi.get(id)
      setJob(result)
      if (TERMINAL_STATUSES.includes(result.status)) {
        setIsPolling(false)
        if (result.status === "succeeded") onCompleted?.(result)
        if (result.status === "failed") onFailed?.(result)
        return
      }
      if (!stoppedRef.current) {
        timerRef.current = setTimeout(() => poll(id), intervalMs)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Polling error")
      setIsPolling(false)
    }
  }, [intervalMs, onCompleted, onFailed])

  useEffect(() => {
    if (!jobId) return
    stoppedRef.current = false
    setIsPolling(true)
    setError(null)
    poll(jobId)
    return () => {
      stoppedRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [jobId, poll])

  return { job, isPolling, error, stop }
}
