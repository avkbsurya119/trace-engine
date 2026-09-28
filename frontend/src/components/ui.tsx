"use client";

/**
 * Small presentational building blocks shared across screens.
 * They only render data; no business logic lives here.
 */

import { forwardRef } from "react";
import { AlertTriangle, ChevronRight, Inbox, Loader2, RefreshCw } from "lucide-react";
import { cn, getOutcomeBgColor } from "@/lib/utils";
import type { ActionOutcome } from "@/types/incident";

/** One card treatment for the whole app – dark glass style. */
export const CARD = "glass-card";
/** Cards that respond to hover/click. */
export const CARD_INTERACTIVE = "glass-card-hover cursor-pointer";

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
  INSUFFICIENT_DATA: "Insufficient evidence",
};

const CONFIDENCE_LEVEL: Record<Confidence, number> = { INSUFFICIENT_DATA: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const CONFIDENCE_FILL: Record<Confidence, string> = {
  HIGH: "bg-green-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-orange-400",
  INSUFFICIENT_DATA: "bg-slate-500",
};
const CONFIDENCE_TEXT: Record<Confidence, string> = {
  HIGH: "text-green-400",
  MEDIUM: "text-amber-400",
  LOW: "text-orange-400",
  INSUFFICIENT_DATA: "text-slate-400",
};

/**
 * Three-segment meter (LOW / MEDIUM / HIGH), with the real count of recorded
 * attempts that worked so a high rate on one attempt never looks like proof.
 */
export function ConfidenceMeter({
  confidence,
  successes,
  attempts,
  size = "md",
}: {
  confidence: Confidence;
  successes?: number;
  attempts?: number;
  size?: "sm" | "md";
}) {
  const hasRate = successes != null && attempts != null && attempts > 0;
  const level = CONFIDENCE_LEVEL[confidence];
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`${CONFIDENCE_LABEL[confidence]}${hasRate ? `, ${successes} of ${attempts} recorded attempts worked` : ""}`}>
      <div className={cn("flex gap-1", size === "sm" ? "w-20" : "w-28")} aria-hidden>
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn("flex-1 rounded-full bg-slate-700 overflow-hidden", size === "sm" ? "h-1.5" : "h-2")}
          >
            {step <= level && (
              <span
                className={cn("block h-full origin-left animate-grow-x", CONFIDENCE_FILL[confidence])}
                style={{ animationDelay: `${(step - 1) * 120}ms` }}
              />
            )}
          </span>
        ))}
      </div>
      <span className={cn("font-semibold", size === "sm" ? "text-xs" : "text-sm", CONFIDENCE_TEXT[confidence])}>
        {CONFIDENCE_LABEL[confidence]}
      </span>
      {hasRate && (
        <span className={cn("text-slate-400", size === "sm" ? "text-xs" : "text-sm")}>
          · {successes} of {attempts} recorded attempt{attempts === 1 ? "" : "s"} worked ({Math.round((successes! / attempts!) * 100)}%)
        </span>
      )}
    </div>
  );
}

export function OutcomePill({ outcome, className }: { outcome?: ActionOutcome | null; className?: string }) {
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", getOutcomeBgColor(outcome ?? undefined), className)}>
      {outcome ?? "OPEN"}
    </span>
  );
}

export function Section({
  icon,
  step,
  title,
  aside,
  children,
  id,
}: {
  icon: React.ReactNode;
  step?: string;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn(CARD, "p-6 scroll-mt-16")}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#38bdf8]" aria-hidden>{icon}</span>
        <h3 id={headingId} className="text-lg font-semibold text-white">
          {step && <span className="text-slate-400 font-normal mr-1">{step}.</span>}
          {title}
        </h3>
        {aside && <div className="ml-auto text-slate-400">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

/**
 * Page title block. Every page answers one question, shown as the eyebrow,
 * and has exactly one h1 that receives focus after navigation.
 */
export const PageHeader = forwardRef<
  HTMLHeadingElement,
  {
    question: string;
    title: string;
    subtitle?: React.ReactNode;
    breadcrumb?: { label: string; onClick?: () => void }[];
    actions?: React.ReactNode;
  }
>(function PageHeader({ question, title, subtitle, breadcrumb, actions }, ref) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1">
            <ol className="flex items-center gap-1 text-xs text-slate-400">
              {breadcrumb.map((crumb, i) => (
                <li key={crumb.label} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3 h-3" aria-hidden />}
                  {crumb.onClick ? (
                    <button type="button" onClick={crumb.onClick} className="hover:text-[#38bdf8] hover:underline">
                      {crumb.label}
                    </button>
                  ) : (
                    <span aria-current="page">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <p className="text-xs uppercase tracking-wide font-semibold text-[#38bdf8]">{question}</p>
        <h1 ref={ref} tabIndex={-1} className="text-2xl font-bold text-white mt-0.5 outline-none">
          {title}
        </h1>
        {subtitle && <div className="text-sm text-slate-300 mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
});

/** Metric tile used on every page. */
export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn";
}) {
  const iconTone = {
    neutral: "bg-slate-700/50 text-[#38bdf8]",
    good: "bg-green-900/40 text-green-400",
    bad: "bg-red-900/40 text-red-400",
    warn: "bg-amber-900/40 text-amber-400",
  }[tone];
  return (
    <div className={cn(CARD, "p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1 leading-snug">{sub}</p>}
        </div>
        {icon && (
          <span className={cn("p-2 rounded-lg flex-shrink-0", iconTone)} aria-hidden>
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}

/** Reassuring loading state: says what is happening. */
export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center justify-center gap-2 py-16 text-sm text-slate-400", className)}>
      <Loader2 className="w-5 h-5 animate-spin text-[#38bdf8]" aria-hidden />
      {label}
    </div>
  );
}

/** Empty state that teaches what will appear here and how to get it. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn(CARD, "p-8 text-center")}>
      <span className="inline-flex p-3 rounded-full bg-slate-700/50 text-[#38bdf8] mb-3" aria-hidden>
        {icon ?? <Inbox className="w-6 h-6" />}
      </span>
      <p className="font-semibold text-white">{title}</p>
      {children && <div className="text-sm text-slate-300 mt-1 max-w-xl mx-auto">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Error that explains what failed and what to do; never a raw stack or status code alone. */
export function ErrorState({ title, detail, onRetry }: { title: string; detail?: string | null; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-900/20 backdrop-blur-lg p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-red-200">{title}</p>
        {detail && <p className="text-sm text-red-300/80 mt-0.5 break-words">{detail}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 text-sm font-medium text-red-300 hover:text-red-100 flex-shrink-0"
        >
          <RefreshCw className="w-4 h-4" aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

/** Primary / secondary buttons with one shape across the app. */
export const BUTTON_PRIMARY =
  "btn-neon-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50";
export const BUTTON_SECONDARY =
  "btn-neon-outline inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium disabled:opacity-50";
