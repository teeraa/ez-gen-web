"use client"

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Loader2, X } from "lucide-react"

// ── Button ────────────────────────────────────────────────────────────────────

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", loading, icon, children, className, disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-light/60"
    const variants = {
      primary: "bg-gradient-to-r from-[#a37aff] to-[#7141d9] border border-violet-light/30 text-white shadow-[0_4px_18px_rgba(113,65,217,.25)] hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0",
      secondary: "bg-white/[.05] border border-white/[.12] text-[#c4b8d8] hover:bg-white/[.08] hover:text-white hover:border-white/[.2]",
      ghost: "bg-transparent text-[#9893a8] hover:bg-white/[.05] hover:text-white",
      danger: "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300",
    }
    const sizes = {
      sm: "text-xs px-3 py-1.5",
      md: "text-sm px-4 py-2",
      lg: "text-sm px-5 py-2.5",
    }
    return (
      <button
        ref={ref}
        disabled={disabled ?? loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

// ── LinkButton — renders a Next.js Link styled as a Button ───────────────────
import NextLink from "next/link"

interface LinkButtonProps {
  href: string
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function LinkButton({ href, variant = "secondary", size = "md", icon, children, className }: LinkButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-light/60"
  const variants = {
    primary: "bg-gradient-to-r from-[#a37aff] to-[#7141d9] border border-violet-light/30 text-white shadow-[0_4px_18px_rgba(113,65,217,.25)] hover:brightness-110 hover:-translate-y-0.5",
    secondary: "bg-white/[.05] border border-white/[.12] text-[#c4b8d8] hover:bg-white/[.08] hover:text-white hover:border-white/[.2]",
    ghost: "bg-transparent text-[#9893a8] hover:bg-white/[.05] hover:text-white",
    danger: "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300",
  }
  const sizes = { sm: "text-xs px-3 py-1.5", md: "text-sm px-4 py-2", lg: "text-sm px-5 py-2.5" }
  return (
    <NextLink href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {icon}{children}
    </NextLink>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-[#9893a8]">{label}</label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full bg-white/[.04] border rounded-lg px-3 py-2 text-sm text-text-base placeholder-text-subtle outline-none transition-colors",
            error ? "border-red-500/50 focus:border-red-500/70" : "border-white/[.1] focus:border-violet/50",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-text-subtle">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"

// ── Textarea ──────────────────────────────────────────────────────────────────

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
      <div className="flex flex-col gap-1.5">
        {label && (
          <div className="flex justify-between items-baseline">
            <label htmlFor={inputId} className="text-xs font-medium text-[#9893a8]">{label}</label>
            {counter && maxLength && (
              <span className="text-xs text-text-subtle">{charCount} / {maxLength}</span>
            )}
          </div>
        )}
        <textarea
          ref={ref}
          id={inputId}
          maxLength={maxLength}
          value={value}
          className={cn(
            "w-full bg-white/[.04] border rounded-lg px-3 py-2.5 text-sm text-text-base placeholder-text-subtle outline-none resize-y transition-colors min-h-20",
            error ? "border-red-500/50 focus:border-red-500/70" : "border-white/[.1] focus:border-violet/50",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-text-subtle">{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

// ── Select ────────────────────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-[#9893a8]">{label}</label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={cn(
              "w-full appearance-none bg-white/[.04] border rounded-lg px-3 py-2 text-sm text-text-base outline-none cursor-pointer transition-colors pr-8",
              error ? "border-red-500/50" : "border-white/[.1] focus:border-violet/50",
              className
            )}
            {...props}
          >
            {options.map(o => (
              <option key={o.value} value={o.value} className="bg-[#12111b] text-white">
                {o.label}
              </option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 10 5 5 5-5"/></svg>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Select.displayName = "Select"

// ── Badge ─────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: ReactNode
  variant?: "violet" | "success" | "warning" | "error" | "neutral" | "processing"
  className?: string
}

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  const variants = {
    violet: "bg-violet/15 text-violet-light border-violet/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
    neutral: "bg-white/[.06] text-text-muted border-white/[.1]",
    processing: "bg-violet/10 text-violet-light border-violet/15 animate-pulse",
  }
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border", variants[variant], className)}>
      {children}
    </span>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

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
        "bg-white/[.025] border border-white/[.07] rounded-xl",
        hover && "hover:bg-white/[.04] hover:border-violet/20 transition-all duration-200 cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
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
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      {icon && <div className="mb-4 text-text-subtle opacity-50">{icon}</div>}
      <p className="text-sm font-medium text-text-muted mb-1">{title}</p>
      {description && <p className="text-xs text-text-subtle max-w-xs mb-4">{description}</p>}
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

export function Dialog({ open, onClose, title, description, children, size = "md" }: DialogProps) {
  if (!open) return null
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative w-full bg-gradient-to-b from-[#171321] to-[#100e18] border border-violet-light/20 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,.6)] p-6", widths[size])}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-semibold text-text-base">{title}</h2>
            {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-text-subtle hover:text-text-base hover:bg-white/[.06] transition-colors -mr-1 -mt-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Toast stack ───────────────────────────────────────────────────────────────

import type { Toast } from "@/hooks/use-toast"
import { CheckCircle, AlertCircle, Info } from "lucide-react"

interface ToastStackProps {
  toasts: Toast[]
  onRemove: (id: number) => void
}

export function ToastStack({ toasts, onRemove }: ToastStackProps) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-5 right-5 z-[120] flex flex-col gap-2 w-[min(340px,calc(100vw-2rem))]" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="flex items-start gap-3 p-3.5 bg-[rgba(24,21,34,.96)] border border-violet-light/20 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,.4)] backdrop-blur-lg animate-[toast-in_.3s_ease_both]">
          <span className="flex-shrink-0 mt-0.5">
            {t.kind === "success" && <CheckCircle className="w-4 h-4 text-success" />}
            {t.kind === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
            {t.kind === "info" && <Info className="w-4 h-4 text-violet-light" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-base">{t.title}</p>
            {t.message && <p className="text-xs text-text-muted mt-0.5">{t.message}</p>}
          </div>
          <button onClick={() => onRemove(t.id)} className="flex-shrink-0 text-text-subtle hover:text-text-base transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── SegmentControl ────────────────────────────────────────────────────────────

interface SegmentControlProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  label?: string
}

export function SegmentControl({ options, value, onChange, label }: SegmentControlProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-medium text-text-muted">{label}</span>}
      <div className="flex p-0.5 bg-black/20 border border-white/[.1] rounded-lg gap-0.5">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all duration-150",
              value === o.value
                ? "bg-violet/20 text-violet-light shadow-[inset_0_0_0_1px_rgba(155,109,255,.2)]"
                : "text-text-muted hover:text-text-base"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-lg font-semibold text-text-base">{title}</h1>
        {description && <p className="text-sm text-text-muted mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  )
}
