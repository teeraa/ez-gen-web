"use client"
import { useEffect, useRef, useState } from "react"
import { exportsApi } from "@/lib/api"
import { useRefreshPolling } from "@/hooks/use-refresh-polling"
import type { ExportDTO } from "@/types/api"
import { EXPORT_TERMINAL_STATUSES } from "@/types/api"
const MIN_INTERVAL_MS = 3000
interface UseExportPollingOptions { exportId: string | null; intervalMs?: number; onTerminal?: (ex: ExportDTO) => void }
interface UseExportPollingResult { exportJob: ExportDTO | null; isPolling: boolean; error: string | null }
export function useExportPolling({ exportId, intervalMs = MIN_INTERVAL_MS, onTerminal }: UseExportPollingOptions): UseExportPollingResult {
  const [exportJob, setExportJob] = useState<ExportDTO | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const notified = useRef<string | null>(null)
  useEffect(() => { setExportJob(null); setError(null); setIsPolling(!!exportId); notified.current = null }, [exportId])
  useRefreshPolling(exportId, {
    intervalMs: Math.max(intervalMs, MIN_INTERVAL_MS),
    fetch: signal => exportsApi.get(exportId ?? "", signal),
    onData: result => {
      setExportJob(result); setError(null)
      const terminal = EXPORT_TERMINAL_STATUSES.includes(result.status)
      setIsPolling(!terminal)
      if (terminal && notified.current !== result.exportId) { notified.current = result.exportId; onTerminal?.(result) }
      return { poll: !terminal }
    },
    onError: err => { setError(err instanceof Error ? err.message : "Polling error"); setIsPolling(false) },
  })
  return { exportJob, isPolling, error }
}
