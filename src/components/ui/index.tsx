"use client"

import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react"
import NextLink from "next/link"
import { Loader2, X, ChevronDown, ChevronLeft, CheckCircle, AlertCircle, Info, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Toast } from "@/hooks/use-toast"

// Values below mirror design-reference/index.html (.btn-primary, .btn-secondary,
// .select-wrap, .prompt-box, .status, .modal …) so studio screens match the dashboard.

// ── Button ────────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
type ButtonSize = "sm" | "md" | "lg"

const BUTTON_BASE = "inline-flex items-center justify-center gap-2 rounded-lg border font-semibold whitespace-nowrap transition-all duration-200 [&_svg]:size-3.5 disabled:opacity-55 disabled:cursor-not-allowed disabled:translate-y-0"

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-[linear-gradient(120deg,#a37aff,#8050e7)] border-[rgba(222,203,255,.3)] text-white shadow-[0_5px_24px_rgba(127,75,236,.2),inset_0_1px_rgba(255,255,255,.16)] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_8px_28px_rgba(127,75,236,.3)]",
  secondary: "bg-white/[.055] border-white/[.14] text-[#e3ddec] font-medium hover:bg-white/10 hover:border-white/[.23]",
  ghost: "bg-transparent border-transparent text-[#a9a2b7] font-medium hover:bg-[var(--glass-hover)] hover:text-white",
  danger: "bg-[rgba(243,165,165,.06)] border-[rgba(243,165,165,.2)] text-[#f3a5a5] font-medium hover:bg-[rgba(243,165,165,.12)] hover:border-[rgba(243,165,165,.32)]",
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "text-[11px] px-3 py-[7px]",
  md: "text-xs px-[15px] py-[9px]",
  lg: "text-xs px-[17px] py-[11px]",
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", loading, icon, children, className, disabled, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled ?? loading}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </button>
  )
)
Button.displayName = "Button"

interface LinkButtonProps {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function LinkButton({ href, variant = "secondary", size = "md", icon, children, className }: LinkButtonProps) {
  return (
    <NextLink href={href} className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}>
      {icon}{children}
    </NextLink>
  )
}

// ── Form fields ───────────────────────────────────────────────────────────────

const LABEL = "block text-[11px] font-medium text-[#aaa3ba]"
const FIELD_BORDER = (error?: string) =>
  error ? "border-[rgba(243,165,165,.45)] focus:border-[rgba(243,165,165,.65)]" : "border-white/10 focus:border-[rgba(155,109,255,.5)]"
const FIELD_ERROR = "text-[11px] text-[#f3a5a5]"
const FIELD_HINT = "text-[11px] text-text-subtle"

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return <label htmlFor={htmlFor} className={LABEL}>{children}</label>
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
    return (
      <div className="flex flex-col gap-[7px]">
        {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-9 w-full rounded-[7px] border bg-white/[.035] px-2.5 text-xs text-[#e8e3f1] outline-none transition-colors placeholder:text-[#777186]",
            FIELD_BORDER(error),
            className
          )}
          {...props}
        />
        {error && <p className={FIELD_ERROR}>{error}</p>}
        {hint && !error && <p className={FIELD_HINT}>{hint}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  counter?: boolean
  maxLength?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, counter, maxLength, value, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
    const charCount = typeof value === "string" ? value.length : 0
    return (
      <div className="flex flex-col gap-[7px]">
        {label && (
          <div className="flex items-baseline justify-between">
            <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
            {counter && maxLength && (
              <span className="text-[10px] text-[#777186]">{charCount} / {maxLength}</span>
            )}
          </div>
        )}
        <textarea
          ref={ref}
          id={inputId}
          maxLength={maxLength}
          value={value}
          className={cn(
            "min-h-[88px] w-full resize-y rounded-[10px] border bg-[rgba(5,5,10,.38)] px-3.5 py-3 text-xs leading-[1.8] text-text-base outline-none transition-colors placeholder:text-[#777186]",
            FIELD_BORDER(error),
            className
          )}
          {...props}
        />
        {error && <p className={FIELD_ERROR}>{error}</p>}
        {hint && !error && <p className={FIELD_HINT}>{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
    return (
      <div className="flex flex-col gap-[7px]">
        {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={cn(
              "h-9 w-full cursor-pointer appearance-none rounded-[7px] border bg-white/[.035] pl-2.5 pr-[30px] text-xs text-[#e8e3f1] outline-none transition-colors",
              FIELD_BORDER(error),
              className
            )}
            {...props}
          >
            {options.map(o => (
              <option key={o.value} value={o.value} className="bg-[#15121f] text-white">
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-[9px] top-1/2 size-[13px] -translate-y-1/2 text-text-muted" />
        </div>
        {error && <p className={FIELD_ERROR}>{error}</p>}
      </div>
    )
  }
)
Select.displayName = "Select"

// ── SegmentControl ────────────────────────────────────────────────────────────

interface SegmentControlProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  label?: string
}

export function SegmentControl({ options, value, onChange, label }: SegmentControlProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      {label && <span className={LABEL}>{label}</span>}
      <div className="segment-control" role="group" aria-label={label}>
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(value === o.value && "active")}
            aria-pressed={value === o.value}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: ReactNode
  variant?: "violet" | "success" | "warning" | "error" | "neutral" | "processing"
  className?: string
}

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  const variants = {
    violet: "bg-[rgba(155,109,255,.13)] text-[#d1b8ff] border-[rgba(155,109,255,.2)]",
    success: "bg-[rgba(113,216,174,.09)] text-[var(--green)] border-[rgba(113,216,174,.18)]",
    warning: "bg-[rgba(233,184,125,.09)] text-[var(--orange)] border-[rgba(233,184,125,.2)]",
    error: "bg-[rgba(243,165,165,.08)] text-[#f3a5a5] border-[rgba(243,165,165,.2)]",
    neutral: "bg-white/[.06] text-[#b3adbf] border-white/[.08]",
    processing: "bg-[rgba(155,109,255,.12)] text-[#c4a5ff] border-[rgba(155,109,255,.15)] animate-pulse",
  }
  return (
    <span className={cn("inline-flex items-center gap-[5px] whitespace-nowrap rounded-[5px] border px-[7px] py-[3px] text-[10px] font-medium leading-none [&_svg]:size-3", variants[variant], className)}>
      {children}
    </span>
  )
}

// ── Card / Panel ──────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
}

export function Card({ children, className, onClick, hover = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-[11px] border border-[var(--border)] bg-[var(--glass)]",
        hover && "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(166,128,255,.25)] hover:bg-[var(--glass-hover)]",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  )
}

// The reference's "Creative canvas" container (.generator) — used for every studio form.
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("generator", className)}>{children}</div>
}

// ── Page chrome ───────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="section-heading">
      <div className="min-w-0">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <NextLink href={href} className="back-link">
      <ChevronLeft /> {children}
    </NextLink>
  )
}

export function LoadingState({ label = "กำลังโหลด..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-12 text-xs text-text-muted">
      <Spinner /> {label}
    </div>
  )
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(243,165,165,.2)] bg-[rgba(243,165,165,.05)] p-3.5 text-xs text-[#f3a5a5]">
      <AlertCircle className="mt-px size-4" />
      <span>{message === "Backend is not reachable" ? "Backend ยังไม่ได้เชื่อมต่อ — เริ่ม ez-gen-api ก่อนใช้งาน" : message}</span>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 style={{ width: size, height: size }} className="animate-spin text-violet-light" />
}

// ── Empty state ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] px-7 py-12 text-center">
      {icon && <span className="generator-icon mb-4 [&_svg]:size-[18px]">{icon}</span>}
      <p className="mb-1 text-[13px] font-semibold text-text-base">{title}</p>
      {description && <p className="mb-5 max-w-sm text-[11px] leading-relaxed text-text-muted">{description}</p>}
      {action}
    </div>
  )
}

// ── Dialog ────────────────────────────────────────────────────────────────────

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  size?: "sm" | "md" | "lg"
}

const DIALOG_WIDTHS = { sm: 400, md: 530, lg: 720 }

export function Dialog({ open, onClose, title, description, children, size = "md" }: DialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="modal-backdrop open"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // React events bubble through the component tree, so a dialog opened from a clickable
      // card would otherwise trigger that card's onClick (e.g. navigate away mid-edit).
      onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal" style={{ width: `min(${DIALOG_WIDTHS[size]}px, 100%)` }}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="close-modal" aria-label="ปิด">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Toast stack ───────────────────────────────────────────────────────────────

interface ToastStackProps {
  toasts: Toast[]
  onRemove: (id: number) => void
}

export function ToastStack({ toasts, onRemove }: ToastStackProps) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="toast">
          <span className="toast-icon">
            {t.kind === "success" && <CheckCircle className="text-success" />}
            {t.kind === "error" && <AlertCircle className="text-[#f3a5a5]" />}
            {t.kind === "info" && <Info />}
          </span>
          <div className="toast-copy">
            <strong>{t.title}</strong>
            {t.message && <p>{t.message}</p>}
          </div>
          <button type="button" onClick={() => onRemove(t.id)} className="toast-close" aria-label="ปิด">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── ActionMenu (reference .project-menu) ──────────────────────────────────────

export interface ActionMenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
}

export function ActionMenu({ items, label = "ตัวเลือก" }: { items: ActionMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    // Cards are often links/clickable; keep menu clicks from reaching them.
    <div ref={wrapRef} className="project-menu-wrap" onClick={e => { e.preventDefault(); e.stopPropagation() }}>
      <button
        type="button"
        className="card-more"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <MoreHorizontal className="size-3.5" />
      </button>
      {open && (
        <div className="project-menu" role="menu">
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={cn(item.danger && "delete-action")}
              onClick={() => { setOpen(false); item.onSelect() }}
            >
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, description, confirmLabel = "ลบ", loading, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="sm">
      <div className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose} disabled={loading}>ยกเลิก</Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  )
}
