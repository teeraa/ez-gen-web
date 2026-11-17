"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import d from "./director.module.css";

// `portal` renders at document.body: full-screen players must escape the studio layout's
// stacking context, or the app navbar covers their header and close button.
export function CreateModal({ onClose, children, portal = false }: { onClose: () => void; children: React.ReactNode; portal?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const nodes = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]') ?? []);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const initial = root.current?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled])') ?? root.current?.querySelector<HTMLElement>('button:not([disabled])');
    initial?.focus();
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); previous?.focus(); };
  }, []);
  const modal = <div ref={root} className={d.scrim} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>{children}</div>;
  return portal ? createPortal(modal, document.body) : modal;
}
