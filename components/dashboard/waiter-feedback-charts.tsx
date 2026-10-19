"use client";

// Charts comparing the waiters (Customer Feedback > Feedbacks > About waiters).
// Colors follow the data-viz rules: one series = one color (blue), the 1 to 5 stars = one blue getting darker
// (an ordered scale), good vs bad = blue against red, and in the trend each waiter keeps the same color.
// Every chart has a table view with the same numbers.

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Table2, BarChart3 } from "lucide-react";

export interface ChartItem { waiterId: string; rating: number; tags: string[]; createdAt: string }
export interface ChartWaiter { id: string; name: string }

const INK = { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7", surface: "#ffffff" };
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const STARS = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];
const GOOD_COLOR = "#2a78d6", BAD_COLOR = "#e34948";
const GOOD = new Set(["Friendly", "Fast", "Helpful", "Knew the menu", "Good advice", "Attentive"]);
const tick = { fill: INK.muted, fontSize: 12 };
const nameTick = { fill: INK.secondary, fontSize: 12 };

function Card({ title, sub, table, children }: { title: string; sub: string; table: React.ReactNode; children: React.ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 m-0" data-chart={title}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <figcaption>
          <div className="font-semibold text-gray-900 text-sm">{title}</div>
          <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
        </figcaption>
        <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-gray-600 rounded-lg px-2 py-1.5 hover:bg-gray-100">
          {asTable ? <><BarChart3 className="w-3.5 h-3.5" /> Chart</> : <><Table2 className="w-3.5 h-3.5" /> Table</>}
        </button>
      </div>
      {asTable ? <div className="overflow-x-auto">{table}</div> : children}
    </figure>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/10 text-gray-800 space-y-0.5">{children}</div>;
}
const th = "text-left font-medium text-gray-500 px-2 py-1.5", td = "px-2 py-1.5 text-gray-800 tabular-nums";

/** Monday of the week (local time) */
const weekOf = (iso: string) => { const d = new Date(iso); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
const wkLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function WaiterCharts({ items, waiters }: { items: ChartItem[]; waiters: ChartWaiter[] }) {
  // Only waiters with feedback in the chosen time, in a fixed order (by name) so each keeps their color
  const rows = useMemo(() => {
    return waiters.map((w) => {
      const mine = items.filter((f) => f.waiterId === w.id);
      const stars = [1, 2, 3, 4, 5].map((s) => mine.filter((f) => f.rating === s).length);
      const good = mine.reduce((n, f) => n + f.tags.filter((t) => GOOD.has(t)).length, 0);
      const bad = mine.reduce((n, f) => n + f.tags.filter((t) => !GOOD.has(t)).length, 0);
      return { id: w.id, name: w.name, count: mine.length, avg: mine.length ? mine.reduce((n, f) => n + f.rating, 0) / mine.length : 0, stars, good, bad };
    }).filter((r) => r.count > 0);
  }, [items, waiters]);
  const colorOf = useMemo(() => {
    const ordered = [...waiters].sort((a, b) => a.name.localeCompare(b.name));
    return (id: string) => SERIES[ordered.findIndex((w) => w.id === id) % SERIES.length];
  }, [waiters]);

  const byAvg = [...rows].sort((a, b) => b.avg - a.avg || b.count - a.count);
  const height = (n: number) => Math.max(120, n * 36 + 40);

  // Trend: average stars per week, last 12 weeks, up to 8 waiters (the ones with the most feedback)
  const trend = useMemo(() => {
    const top = [...rows].sort((a, b) => b.count - a.count).slice(0, SERIES.length);
    const now = weekOf(new Date().toISOString());
    const weeks = Array.from({ length: 12 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - 7 * (11 - i)); return d; });
    const data = weeks.map((wk) => {
      const point: Record<string, number | string | null> = { week: wkLabel(wk) };
      for (const w of top) {
        const inWeek = items.filter((f) => f.waiterId === w.id && weekOf(f.createdAt).getTime() === wk.getTime());
        point[w.id] = inWeek.length ? Math.round((inWeek.reduce((n, f) => n + f.rating, 0) / inWeek.length) * 10) / 10 : null;
      }
      return point;
    });
    return { top, data, hasData: data.some((p) => top.some((w) => p[w.id] !== null)), folded: rows.length - top.length };
  }, [rows, items]);

  if (!rows.length) return <p className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-sm text-gray-500">No feedback about waiters in this time yet, so there is nothing to compare.</p>;

  const fmt = (n: number) => n.toFixed(1);
  return (
    <div className="grid lg:grid-cols-2 gap-4" data-waiter-charts>
      <Card title="Average stars per waiter" sub="From 1 to 5. The number after the bar is how many feedbacks."
        table={<table className="w-full text-sm"><thead><tr><th className={th}>Waiter</th><th className={th}>Average</th><th className={th}>Feedbacks</th></tr></thead>
          <tbody>{byAvg.map((r) => <tr key={r.id} className="border-t border-gray-100"><td className={td}>{r.name}</td><td className={td}>{fmt(r.avg)}</td><td className={td}>{r.count}</td></tr>)}</tbody></table>}>
        <ResponsiveContainer width="100%" height={height(byAvg.length)}>
          <BarChart data={byAvg} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 4 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke={INK.grid} />
            <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={tick} axisLine={{ stroke: INK.axis }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={124} tick={nameTick} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={({ active, payload }) => active && payload?.[0] ? (
              <Tip><div className="font-semibold">{payload[0].payload.name}</div><div>{fmt(payload[0].payload.avg)} stars on average</div><div className="text-gray-500">{payload[0].payload.count} feedbacks</div></Tip>) : null} />
            <Bar dataKey="avg" fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false}>
              <LabelList dataKey="avg" position="right" content={({ x, y, width, height: h, index }) => {
                const r = byAvg[index as number];
                return <text x={Number(x) + Number(width) + 6} y={Number(y) + Number(h) / 2} dominantBaseline="middle" fontSize={12} fill={INK.primary}>{fmt(r.avg)} <tspan fill={INK.muted}>({r.count})</tspan></text>;
              }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="How each waiter was rated" sub="Share of 1 to 5 stars. Darker blue is more stars."
        table={<table className="w-full text-sm"><thead><tr><th className={th}>Waiter</th>{[1, 2, 3, 4, 5].map((s) => <th key={s} className={th}>{s}★</th>)}</tr></thead>
          <tbody>{byAvg.map((r) => <tr key={r.id} className="border-t border-gray-100"><td className={td}>{r.name}</td>{r.stars.map((n, i) => <td key={i} className={td}>{n}</td>)}</tr>)}</tbody></table>}>
        <div className="flex flex-wrap gap-3 mb-2 text-xs text-gray-600" aria-hidden>
          {STARS.map((c, i) => <span key={i} className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: c }} /> {i + 1}★</span>)}
        </div>
        <ResponsiveContainer width="100%" height={height(byAvg.length)}>
          <BarChart data={byAvg.map((r) => ({ name: r.name, count: r.count, stars: r.stars, ...Object.fromEntries(r.stars.map((n, i) => [`s${i + 1}`, r.count ? (n / r.count) * 100 : 0])) }))}
            layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barCategoryGap={8}>
            <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={tick} axisLine={{ stroke: INK.axis }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={124} tick={nameTick} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={({ active, payload }) => active && payload?.[0] ? (
              <Tip><div className="font-semibold">{payload[0].payload.name}</div>
                {(payload[0].payload.stars as number[]).map((n, i) => <div key={i}>{i + 1}★: {n}</div>).reverse()}
              </Tip>) : null} />
            {[1, 2, 3, 4, 5].map((s) => (
              <Bar key={s} dataKey={`s${s}`} stackId="stars" fill={STARS[s - 1]} stroke={INK.surface} strokeWidth={2} barSize={16} isAnimationActive={false}
                radius={s === 5 ? [0, 4, 4, 0] : s === 1 ? [4, 0, 0, 4] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Rating over the last 12 weeks" sub={`Average stars per week. Each waiter has their own color.${trend.folded > 0 ? ` Showing the ${trend.top.length} with the most feedback.` : ""}`}
        table={<table className="w-full text-sm"><thead><tr><th className={th}>Week of</th>{trend.top.map((w) => <th key={w.id} className={th}>{w.name}</th>)}</tr></thead>
          <tbody>{trend.data.filter((p) => trend.top.some((w) => p[w.id] !== null)).map((p) => <tr key={String(p.week)} className="border-t border-gray-100"><td className={td}>{p.week}</td>{trend.top.map((w) => <td key={w.id} className={td}>{p[w.id] ?? "–"}</td>)}</tr>)}</tbody></table>}>
        {!trend.hasData ? <p className="text-sm text-gray-500">No feedback in the last 12 weeks.</p> : (
          <>
            <div className="flex flex-wrap gap-3 mb-2 text-xs text-gray-700">
              {trend.top.map((w) => <span key={w.id} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: colorOf(w.id) }} aria-hidden /> {w.name}</span>)}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend.data} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
                <CartesianGrid vertical={false} stroke={INK.grid} />
                <XAxis dataKey="week" tick={tick} axisLine={{ stroke: INK.axis }} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={tick} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ stroke: INK.axis }} content={({ active, payload, label }) => active && payload?.length ? (
                  <Tip><div className="font-semibold">Week of {label}</div>
                    {payload.filter((p) => p.value !== null && p.value !== undefined).map((p) => {
                      const w = trend.top.find((x) => x.id === p.dataKey);
                      return <div key={String(p.dataKey)} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: colorOf(String(p.dataKey)) }} />{w?.name}: {p.value}★</div>;
                    })}
                  </Tip>) : null} />
                {trend.top.map((w) => (
                  <Line key={w.id} dataKey={w.id} name={w.name} stroke={colorOf(w.id)} strokeWidth={2} connectNulls isAnimationActive={false}
                    dot={{ r: 4, fill: colorOf(w.id), stroke: INK.surface, strokeWidth: 2 }} activeDot={{ r: 5, stroke: INK.surface, strokeWidth: 2 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </Card>

      <Card title="Good things and things to improve" sub="How often customers tapped a good tag (like Friendly) or a bad one (like Slow)."
        table={<table className="w-full text-sm"><thead><tr><th className={th}>Waiter</th><th className={th}>Good</th><th className={th}>To improve</th></tr></thead>
          <tbody>{byAvg.map((r) => <tr key={r.id} className="border-t border-gray-100"><td className={td}>{r.name}</td><td className={td}>{r.good}</td><td className={td}>{r.bad}</td></tr>)}</tbody></table>}>
        {byAvg.every((r) => !r.good && !r.bad) ? <p className="text-sm text-gray-500">Customers haven&apos;t tapped any tags yet.</p> : (() => {
          // Same nice steps on both sides of zero
          const most = Math.max(1, ...byAvg.map((r) => Math.max(r.good, r.bad)));
          const step = most <= 4 ? 1 : most <= 10 ? 2 : most <= 25 ? 5 : Math.ceil(most / 50) * 10;
          const max = Math.ceil(most / step) * step;
          const ticks = Array.from({ length: (2 * max) / step + 1 }, (_, i) => -max + i * step);
          const data = [...byAvg].sort((a, b) => (b.good - b.bad) - (a.good - a.bad)).map((r) => ({ name: r.name, good: r.good, bad: -r.bad, badN: r.bad }));
          return (
            <>
              <div className="flex flex-wrap gap-3 mb-2 text-xs text-gray-600" aria-hidden>
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: BAD_COLOR }} /> To improve</span>
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: GOOD_COLOR }} /> Good</span>
              </div>
              <ResponsiveContainer width="100%" height={height(data.length)}>
                <BarChart data={data} layout="vertical" stackOffset="sign" margin={{ top: 4, right: 28, bottom: 4, left: 24 }} barCategoryGap={8}>
                  <CartesianGrid horizontal={false} stroke={INK.grid} />
                  <XAxis type="number" domain={[-max, max]} ticks={ticks} allowDecimals={false} tickFormatter={(v) => String(Math.abs(v))} tick={tick} axisLine={{ stroke: INK.axis }} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={124} tick={nameTick} axisLine={false} tickLine={false} />
                  <ReferenceLine x={0} stroke={INK.axis} />
                  <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={({ active, payload }) => active && payload?.[0] ? (
                    <Tip><div className="font-semibold">{payload[0].payload.name}</div><div>Good: {payload[0].payload.good}</div><div>To improve: {payload[0].payload.badN}</div></Tip>) : null} />
                  <Bar dataKey="bad" stackId="t" fill={BAD_COLOR} radius={[4, 0, 0, 4]} barSize={14} isAnimationActive={false}>
                    <LabelList dataKey="badN" content={({ x, y, width, height: h, value }) => {
                      if (!Number(value)) return null;
                      const left = Math.min(Number(x), Number(x) + Number(width));
                      return <text x={left - 6} y={Number(y) + Number(h) / 2} textAnchor="end" dominantBaseline="middle" fontSize={12} fill={INK.secondary}>{String(value)}</text>;
                    }} />
                  </Bar>
                  <Bar dataKey="good" stackId="t" fill={GOOD_COLOR} radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false}>
                    <LabelList dataKey="good" position="right" fontSize={12} fill={INK.secondary} formatter={(v: unknown) => (Number(v) ? String(v) : "")} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          );
        })()}
      </Card>
    </div>
  );
}
