'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Library, RefreshCw, UserRound, X } from 'lucide-react';
import { creativeApi, type Asset } from '@/lib/creative-api';
import styles from './character-picker.module.css';

export function PipelineCharacterPicker({ selected, onSelect, disabled }: { selected: Asset | null; onSelect: (asset: Asset | null) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const failImage = (id: string) => setFailedImages((previous) => new Set(previous).add(id));
  const showImage = (asset: Asset) => !!asset.mediaUrl && !failedImages.has(asset.id);

  useEffect(() => {
    if (!open) return;
    if (disabled) {
      setOpen(false);
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      else openButtonRef.current?.focus();
    };
  }, [open, disabled]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(false);
    creativeApi
      .assets('', 'character', page)
      .then((data) => {
        if (!alive) return;
        setItems(data.items.filter((asset) => !!asset.jobId && asset.uploadId === null && asset.status === 'ready'));
        setTotal(data.total);
        setLimit(data.limit);
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page, revision, open]);

  const openPicker = () => !disabled && setOpen(true);

  return (
    <div className={styles.picker}>
      {selected ? (
        <div className={styles.selected}>
          <span className={styles.selectedThumb}>
            {showImage(selected) ? <Image unoptimized fill sizes="56px" src={selected.mediaUrl as string} alt="ตัวละครที่เลือก" onError={() => failImage(selected.id)} /> : <UserRound aria-hidden />}
          </span>
          <span className={styles.selectedText}>
            <strong>{selected.name || 'ตัวละครไม่มีชื่อ'}</strong>
            <small>ใช้หน้าตาเดิม ไม่สร้างตัวละครใหม่</small>
          </span>
          <button type="button" ref={openButtonRef} className={styles.change} disabled={disabled} onClick={openPicker}>
            เปลี่ยน
          </button>
          <button type="button" className={styles.remove} disabled={disabled} onClick={() => onSelect(null)} aria-label="นำตัวละครออก">
            <X aria-hidden />
          </button>
        </div>
      ) : (
        <button type="button" ref={openButtonRef} className={styles.empty} disabled={disabled} onClick={openPicker}>
          <span className={styles.emptyIcon}>
            <Library aria-hidden />
          </span>
          <span className={styles.selectedText}>
            <strong>เลือกตัวละครจากคลัง</strong>
            <small>ใช้ตัวละครที่เคยสร้างไว้ หน้าตาจะคงเดิมทุกคลิป</small>
          </span>
          <ChevronRight className={styles.chev} aria-hidden />
        </button>
      )}

      {open && (
        <dialog
          ref={dialogRef}
          className={styles.dialog}
          aria-labelledby="character-library-heading"
          aria-modal="true"
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return;
            const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
            const first = controls[0];
            const last = controls.at(-1);
            if (!first) return;
            if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) {
              event.preventDefault();
              first.focus();
            }
          }}
          onCancel={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const b = event.currentTarget.getBoundingClientRect();
            if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) setOpen(false);
          }}
        >
          <div className={styles.dialogHead}>
            <div>
              <h2 id="character-library-heading">เลือกตัวละครจากคลัง</h2>
              <p>แตะเพื่อใช้ตัวละครนี้สร้างวิดีโอ</p>
            </div>
            <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="ปิดหน้าต่างเลือกตัวละคร">
              <X aria-hidden />
            </button>
          </div>

          <div className={styles.dialogBody}>
            {loading ? (
              <div className={styles.grid} role="status" aria-label="กำลังโหลดตัวละคร">
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className={styles.skeleton} />
                ))}
              </div>
            ) : error ? (
              <div className={styles.state} role="alert">
                <p>โหลดตัวละครไม่สำเร็จ</p>
                <button type="button" className={styles.change} disabled={disabled} onClick={() => setRevision((v) => v + 1)}>
                  <RefreshCw aria-hidden /> ลองอีกครั้ง
                </button>
              </div>
            ) : items.length ? (
              <div className={styles.grid}>
                {items.map((asset) => (
                  <button
                    type="button"
                    key={asset.id}
                    className={styles.option}
                    aria-label={`เลือกตัวละคร ${asset.name || 'ตัวละครไม่มีชื่อ'}`}
                    aria-pressed={selected?.id === asset.id}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      onSelect(asset);
                      setOpen(false);
                    }}
                  >
                    <span className={styles.optionThumb}>
                      {showImage(asset) ? <Image unoptimized fill sizes="180px" src={asset.mediaUrl as string} alt="" onError={() => failImage(asset.id)} /> : <UserRound aria-hidden />}
                    </span>
                    <span className={styles.optionName}>{asset.name || 'ตัวละครไม่มีชื่อ'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.state}>
                <UserRound aria-hidden />
                <p>ยังไม่มีตัวละครในคลัง</p>
                <small>ปิดหน้าต่างแล้วเลือก “สร้างใหม่” เพื่อสร้างตัวละครแรก</small>
              </div>
            )}
          </div>

          {(page > 1 || page * limit < total) && (
            <div className={styles.pager}>
              <button type="button" disabled={disabled || page === 1} onClick={() => setPage((v) => v - 1)} aria-label="หน้าก่อนหน้า">
                <ChevronLeft aria-hidden />
              </button>
              <span>หน้า {page}</span>
              <button type="button" disabled={disabled || page * limit >= total} onClick={() => setPage((v) => v + 1)} aria-label="หน้าถัดไป">
                <ChevronRight aria-hidden />
              </button>
            </div>
          )}
        </dialog>
      )}
    </div>
  );
}
