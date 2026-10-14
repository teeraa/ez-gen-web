"use client"

import { useEffect, useRef, useState } from "react"
import { exportsApi } from "@/lib/api"
import type { ExportDTO } from "@/types/api"
import { EXPORT_TERMINAL_STATUSES } from "@/types/api"

const MIN_INTERVAL_MS = 3000

interface UseExportPollingOptions {
  exportId: string | null
  intervalMs?: number
  // Fires once per export, when it reaches succeeded / failed.
  onTerminal?: (ex: ExportDTO) => void
}

interface UseExportPollingResult {
  exportJob: ExportDTO | null
  isPolling: boolean
  error: string | null
}

// Same single-loop discipline as useJobPolling: the next poll is scheduled only after the
// previous one settles, and effect cleanup cancels the pending timer, so an exportId change
// or unmount can never leave a second loop running.
export function useExportPolling({ exportId, intervalMs = MIN_INTERVAL_MS, onTerminal }: UseExportPollingOptions): UseExportPollingResult {
  const [exportJob, setExportJob] = useState<ExportDTO | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onTerminalRef = useRef(onTerminal)
  useEffect(() => { onTerminalRef.current = onTerminal }, [onTerminal])

  const delay = Math.max(intervalMs, MIN_INTERVAL_MS)

  useEffect(() => {
    if (!exportId) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      try {
        const result = await exportsApi.get(exportId)
        if (cancelled) return
        setExportJob(result)
        if (EXPORT_TERMINAL_STATUSES.includes(result.status)) {
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

    setExportJob(null)
    setError(null)
    setIsPolling(true)
    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [exportId, delay])

  return { exportJob, isPolling, error }
}
