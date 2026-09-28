"use client";

/**
 * Small, dependency-free chart primitives for TRACE Intelligence.
 * Single-series marks, one hue, recessive axes, hover details, and a text
 * alternative for screen readers.
 */

import { useEffect, useRef, useState } from "react";
import { cn, formatMonth } from "@/lib/utils";

const INK = "#466968"; // industrial-600

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Counts up to `value` once when first rendered (instant with reduced motion). */
export function AnimatedNumber({ value, format = (n) => n.toLocaleString() }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || prefersReducedMotion()) {
      setShown(value);
      return;
    }
    started.current = true;
    const duration = 700;
    const t0 = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className="tabular-nums">{format(Number.isInteger(value) ? Math.round(shown) : shown)}</span>;
}

/** Single-series line over months with a crosshair tooltip. */
export function MonthlyLine({
  months,
  values,
  label,
  format = (v) => Math.round(v).toLocaleString(),
  height = 140,
  area = true,
  max,
}: {
  months: string[];
  values: number[];
  label: string;
  format?: (v: number) => string;
  height?: number;
  area?: boolean;
  max?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (values.length < 2) return null;
  const W = 600;
  const H = height;
  const pad = { t: 10, r: 10, b: 22, l: 40 };
  const top = max ?? (Math.max(...values) * 1.08 || 1);
  const x = (i: number) => pad.l + (i / (values.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const every = Math.ceil(values.length / 5);

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`${label}: ${format(values[0])} in ${formatMonth(months[0], true)} to ${format(values[values.length - 1])} in ${formatMonth(months[months.length - 1], true)}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (values.length - 1));
          setHover(Math.max(0, Math.min(values.length - 1, i)));
        }}
      >
        {[0, top / 2, top].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#eef0f1" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#6b7280">
              {format(t)}
            </text>
          </g>
        ))}
        {months.map((m, i) =>
          i % every === 0 || i === months.length - 1 ? (
            <text key={m} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#6b7280">
              {formatMonth(m, i === 0)}
            </text>
          ) : null
        )}
        {area && <path d={`${line} L${x(values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={INK} fillOpacity={0.08} />}
        <path d={line} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} stroke="#9ca3af" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(values[hover])} r={4} fill={INK} stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded bg-gray-900 text-white text-xs px-2 py-1 whitespace-nowrap"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          {formatMonth(months[hover], true)}: <strong>{format(values[hover])}</strong>
        </div>
      )}
      <figcaption className="sr-only">
        {label}. {months.map((m, i) => `${formatMonth(m, true)}: ${format(values[i])}`).join("; ")}
      </figcaption>
    </figure>
  );
}

/** Tiny trend line for tables. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const W = 96;
  const H = 24;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 2 - (v / max) * (H - 4)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-24 h-6" role="img" aria-label={`${label}: ${values.join(", ")}`}>
      <polyline points={pts} fill="none" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/** Label + value + proportional bar; the value is always printed, so color is never the only cue. */
export function BarRow({
  label,
  value,
  max,
  display,
  sub,
  tone = "ink",
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  display?: string;
  sub?: React.ReactNode;
  tone?: "ink" | "good" | "bad";
}) {
  const fill = tone === "good" ? "bg-green-600" : tone === "bad" ? "bg-red-500" : "bg-industrial-500";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-gray-800 truncate">{label}</span>
        <span className="text-gray-900 font-medium tabular-nums flex-shrink-0">{display ?? value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full mt-1" aria-hidden>
        <div className={cn("h-full rounded-full", fill)} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
      </div>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
