"use client"

import { useEffect, useRef, useState } from "react"
import { jobsApi } from "@/lib/api"
import type { JobDTO } from "@/types/api"
import { TERMINAL_STATUSES } from "@/types/api"

const MIN_INTERVAL_MS = 2500

interface UseJobPollingOptions {
  jobId: string | null
  intervalMs?: number
  // Fires once per job, when it reaches succeeded / failed / cancelled.
  onTerminal?: (job: JobDTO) => void
}

interface UseJobPollingResult {
  job: JobDTO | null
  isPolling: boolean
  error: string | null
}

// One polling loop per jobId. The next request is scheduled only after the previous one
// settles (no overlapping fetches), and the effect cleanup cancels the pending timer, so
// re-renders, a jobId change or unmount can never leave a second loop running.
export function useJobPolling({ jobId, intervalMs = MIN_INTERVAL_MS, onTerminal }: UseJobPollingOptions): UseJobPollingResult {
  const [job, setJob] = useState<JobDTO | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Held in a ref so an inline callback from the caller doesn't restart the loop each render.
  const onTerminalRef = useRef(onTerminal)
  useEffect(() => { onTerminalRef.current = onTerminal }, [onTerminal])

  const delay = Math.max(intervalMs, MIN_INTERVAL_MS)

  useEffect(() => {
    if (!jobId) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      try {
        const result = await jobsApi.get(jobId)
        if (cancelled) return
        setJob(result)
        if (TERMINAL_STATUSES.includes(result.status)) {
          cancelled = true
          setIsPolling(false)
          onTerminalRef.current?.(result)
          return
        }
        timer = setTimeout(tick, delay)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Polling error")
        setIsPolling(false)
      }
    }

    setJob(null)
    setError(null)
    setIsPolling(true)
    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [jobId, delay])

  return { job, isPolling, error }
}
