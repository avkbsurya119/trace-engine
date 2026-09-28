import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for merging Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get color class for outcome status
 */
export function getOutcomeColor(outcome?: string): string {
  switch (outcome) {
    case "SUCCESS":
      return "text-status-success";
    case "PARTIAL":
      return "text-status-partial";
    case "FAILED":
      return "text-status-failed";
    default:
      return "text-status-unknown";
  }
}

/**
 * Get background color class for outcome status (dark theme)
 */
export function getOutcomeBgColor(outcome?: string): string {
  switch (outcome) {
    case "SUCCESS":
      return "bg-green-900/40 text-green-300";
    case "PARTIAL":
      return "bg-amber-900/40 text-amber-300";
    case "FAILED":
      return "bg-red-900/40 text-red-300";
    default:
      return "bg-slate-700/50 text-slate-300";
  }
}

/**
 * Get confidence level color (dark theme)
 */
export function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case "HIGH":
      return "text-green-400";
    case "MEDIUM":
      return "text-amber-400";
    case "LOW":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}

/**
 * "spindle_vibration" -> "Spindle vibration"
 */
export function humanize(value?: string | null): string {
  if (!value) return "";
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Format a date (no time) for historical records
 */
export function formatDay(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatHours(minutes?: number | null): string {
  if (minutes === undefined || minutes === null) return "-";
  return minutes < 60 ? `${minutes} min` : `${(minutes / 60).toFixed(1)} h`;
}

/**
 * "2026-03" -> "Mar" or "Mar 2026"
 */
export function formatMonth(month: string, withYear = false): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  return value == null ? "-" : `${(value * 100).toFixed(digits)}%`;
}
