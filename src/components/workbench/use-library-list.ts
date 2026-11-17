"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LibraryApiError, type LibraryPage } from "@/lib/library-api";

type FetchPage<T> = (page: number, signal?: AbortSignal) => Promise<LibraryPage<T>>;

const errorText = (e: unknown) => e instanceof LibraryApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่";

/**
 * Loads a paginated library list. `key` captures the filters: whenever it changes the list
 * reloads from page 1 after a short debounce, so typing in the search box issues one request.
 */
export function useLibraryList<T extends { id: string }>(key: string, fetchPage: FetchPage<T>) {
  const fetchRef = useRef(fetchPage);
  useEffect(() => { fetchRef.current = fetchPage; });

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      fetchRef.current(1, ctl.signal)
        .then((res) => { setItems(res.items); setTotal(res.total); setPage(1); })
        .catch((e: unknown) => { if (!ctl.signal.aborted) setError(errorText(e)); })
        .finally(() => { if (!ctl.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [key, nonce]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await fetchRef.current(page + 1);
      setItems((list) => [...list, ...res.items.filter((x) => !list.some((y) => y.id === x.id))]);
      setTotal(res.total);
      setPage(page + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoadingMore(false);
    }
  }, [page]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { items, setItems, total, setTotal, loading, loadingMore, error, hasMore: items.length < total, loadMore, reload };
}
