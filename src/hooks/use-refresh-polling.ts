"use client";
import { useCallback, useEffect, useRef } from "react";
import { createRefreshController, type RefreshOptions, type RefreshReason } from "@/lib/refresh-polling";
export function useRefreshPolling<T>(key: string | null, options: RefreshOptions<T>) {
  const callbacks = useRef(options);
  const controller = useRef<ReturnType<typeof createRefreshController<T>> | null>(null);
  useEffect(() => { callbacks.current = options; });
  const intervalMs = options.intervalMs;
  const initial = options.initial;
  useEffect(() => {
    if (!key) return;
    const instance = createRefreshController<T>({
      ...callbacks.current,
      visible: document.visibilityState !== "hidden",
      fetch: (signal, reason) => callbacks.current.fetch(signal, reason),
      onData: data => callbacks.current.onData(data),
      onError: error => callbacks.current.onError?.(error),
      onRefreshing: refreshing => callbacks.current.onRefreshing?.(refreshing),
    });
    controller.current = instance;
    const visibility = () => instance.setVisible(document.visibilityState !== "hidden");
    const focus = () => { if (document.visibilityState !== "hidden") void instance.refresh("resume"); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", focus);
    return () => {
      instance.dispose();
      if (controller.current === instance) controller.current = null;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", focus);
    };
  }, [key, intervalMs, initial]);
  return useCallback((reason: RefreshReason = "manual") => controller.current?.refresh(reason) ?? Promise.resolve(false), []);
}
