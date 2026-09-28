"use client";

import { useState } from "react";
import type { MemoryGrowthPoint } from "@/types/incident";

const WIDTH = 1000;
const HEIGHT = 170;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };
const LINE = "#466968"; // industrial-600

function monthLabel(month: string, withYear = false) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/**
 * Single series: cumulative recorded outcomes in memory, by month.
 * One hue, 2px line, light area, crosshair + tooltip, and a table for screen readers.
 */
export function MemoryGrowthChart({ points }: { points: MemoryGrowthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const max = Math.max(...points.map((p) => p.cumulative_outcomes));
  const niceMax = Math.ceil(max / 100) * 100 || 1;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / niceMax) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.cumulative_outcomes)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [0, niceMax / 2, niceMax];
  const labelEvery = Math.ceil(points.length / 6);
  const active = hover != null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Recorded outcomes in memory grew from ${points[0].cumulative_outcomes} in ${monthLabel(points[0].month, true)} to ${points[points.length - 1].cumulative_outcomes} in ${monthLabel(points[points.length - 1].month, true)}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
          const i = Math.round(((px - PAD.left) / innerW) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#6b7280">
              {t}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.month} x={x(i)} y={HEIGHT - 6} textAnchor="middle" fontSize={11} fill="#6b7280">
              {monthLabel(p.month, i === 0 || p.month.endsWith("-01"))}
            </text>
          ) : null
        )}
        <path d={area} fill={LINE} fillOpacity={0.1} />
        <path d={line} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
        {hover != null && active && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} stroke="#9ca3af" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(active.cumulative_outcomes)} r={4.5} fill={LINE} stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>
      {active && hover != null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-gray-900 text-white text-xs px-2.5 py-1.5 shadow"
          style={{ left: `${(x(hover) / WIDTH) * 100}%` }}
        >
          <p className="font-semibold">{monthLabel(active.month, true)}</p>
          <p>{active.cumulative_outcomes} outcomes in memory</p>
          <p className="text-gray-300">+{active.incidents} work orders that month</p>
        </div>
      )}
      <table className="sr-only">
        <caption>Recorded outcomes in memory by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Work orders that month</th>
            <th scope="col">Outcomes in memory</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month}>
              <td>{monthLabel(p.month, true)}</td>
              <td>{p.incidents}</td>
              <td>{p.cumulative_outcomes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
