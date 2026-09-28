"use client";

/**
 * Small presentational building blocks shared across screens.
 * They only render data; no business logic lives here.
 */

import { cn, getOutcomeBgColor } from "@/lib/utils";
import type { ActionOutcome } from "@/types/incident";

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
  INSUFFICIENT_DATA: "Insufficient evidence",
};

const CONFIDENCE_LEVEL: Record<Confidence, number> = { INSUFFICIENT_DATA: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const CONFIDENCE_FILL: Record<Confidence, string> = {
  HIGH: "bg-green-600",
  MEDIUM: "bg-amber-500",
  LOW: "bg-orange-500",
  INSUFFICIENT_DATA: "bg-gray-300",
};
const CONFIDENCE_TEXT: Record<Confidence, string> = {
  HIGH: "text-green-800",
  MEDIUM: "text-amber-800",
  LOW: "text-orange-800",
  INSUFFICIENT_DATA: "text-gray-600",
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
            className={cn(
              "flex-1 rounded-full",
              size === "sm" ? "h-1.5" : "h-2",
              step <= level ? CONFIDENCE_FILL[confidence] : "bg-gray-200"
            )}
          />
        ))}
      </div>
      <span className={cn("font-semibold", size === "sm" ? "text-xs" : "text-sm", CONFIDENCE_TEXT[confidence])}>
        {CONFIDENCE_LABEL[confidence]}
      </span>
      {hasRate && (
        <span className={cn("text-gray-500", size === "sm" ? "text-xs" : "text-sm")}>
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
    <section id={id} aria-labelledby={headingId} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <span aria-hidden>{icon}</span>
        <h3 id={headingId} className="text-lg font-semibold text-industrial-900">
          {step && <span className="text-industrial-400 font-normal mr-1">{step}.</span>}
          {title}
        </h3>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
