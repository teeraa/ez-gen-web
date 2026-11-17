"use client";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/ui";

type Pending = { title: string; description?: string; confirmLabel?: string; resolve: (ok: boolean) => void };

// In-app replacement for window.confirm: some embedded browsers (e.g. the Claude desktop browser
// pane) suppress native dialogs, so window.confirm returns false without ever showing anything.
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback((title: string, description?: string, confirmLabel?: string) => new Promise<boolean>(resolve => setPending({ title, description, confirmLabel, resolve })), []);
  const settle = (ok: boolean) => { pending?.resolve(ok); setPending(null); };
  const dialog = pending && typeof document !== "undefined" ? createPortal(<ConfirmDialog open title={pending.title} description={pending.description} confirmLabel={pending.confirmLabel} onConfirm={() => settle(true)} onClose={() => settle(false)} />, document.body) : null;
  return [confirm, dialog] as const;
}
