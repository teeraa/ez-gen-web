"use client"

import { useCallback, useState } from "react"

export type ToastKind = "info" | "success" | "error"

export interface Toast {
  id: number
  title: string
  message?: string
  kind: ToastKind
}

let _nextId = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((title: string, message?: string, kind: ToastKind = "info") => {
    const id = ++_nextId
    setToasts(prev => [...prev, { id, title, message, kind }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
    return id
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}
