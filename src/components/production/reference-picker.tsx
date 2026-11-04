"use client";
import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { creativeApi, type Asset } from "@/lib/creative-api";
import s from "./production.module.css";
export function ReferencePicker({
  onSelect,
  onClose,
}: {
  onSelect: (asset: Asset) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [items, setItems] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const dialog = ref.current;
    const returnFocus = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected)
        returnFocus.focus();
    };
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      creativeApi
        .assets(search, "character", page)
        .then((r) => {
          if (active) {
            setItems(r.items);
            setTotal(r.total);
          }
        })
        .catch((e) => active && setError(e.message))
        .finally(() => active && setLoading(false));
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, page]);
  return (
    <dialog className={s.dialog} ref={ref} aria-labelledby={titleId}
      onCancel={onClose}
      onClose={() => {
        // StrictMode cleanup can queue close before the same dialog is reopened.
        if (!ref.current?.open) onClose();
      }}>
      <div className={s.stack}>
        <header className={s.header}>
          <div>
            <h2 id={titleId}>เลือกตัวละครจากคลัง</h2>
            <p className={s.muted}>ใช้ภาพที่บันทึกไว้ ไม่สร้างภาพซ้ำ</p>
          </div>
          <button className={s.button} onClick={onClose}>
            ปิด
          </button>
        </header>
        <label className={s.field}>
          ค้นหาตัวละคร
          <input
            autoFocus
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">กำลังโหลด…</p>
        ) : (
          <div className={s.grid}>
            {items.map((a) => (
              <button
                className={s.asset}
                key={a.id}
                disabled={!a.mediaUrl}
                onClick={() => onSelect(a)}
              >
                {a.mediaUrl && (
                  <Image
                    unoptimized
                    width={64}
                    height={80}
                    src={a.mediaUrl}
                    alt=""
                  />
                )}
                <span>
                  <strong>{a.name}</strong>
                  <br />
                  <span className={s.muted}>{a.description.slice(0, 100)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {!loading && !items.length && <p>ยังไม่พบตัวละครที่มีภาพในคลัง</p>}
        <div className={s.row}>
          <button
            className={s.button}
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            ก่อนหน้า
          </button>
          <span>หน้า {page}</span>
          <button
            className={s.button}
            disabled={page * 20 >= total}
            onClick={() => setPage(page + 1)}
          >
            ถัดไป
          </button>
        </div>
      </div>
    </dialog>
  );
}
