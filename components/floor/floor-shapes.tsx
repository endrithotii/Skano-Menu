// Drawing the things of a floor plan (SVG, in meters). Used by the builder and the customer's table picker.

import { chairPositions, type FloorObject } from "@/lib/floor-plan";

const WOOD = "#e9d5b0", WOOD_EDGE = "#a16207", CHAIR = "#cbd5e1";

// ── Drawing one object (in meters, centered on 0,0 before rotation) ──────────

/** How a table looks on the customer's plan */
export type TableState = "free" | "off" | "picked";

export function Shape({ o, clean, state, accent }: { o: FloorObject; clean?: boolean; state?: TableState; accent?: string }) {
  if (clean) return <CleanShape o={o} state={state ?? "off"} accent={accent ?? "#1f2937"} />;
  const w = o.w, h = o.h;
  switch (o.type) {
    case "table": {
      const chairs = chairPositions(o);
      const label = o.label || "";
      const fs = Math.min(0.3, Math.max(0.13, Math.min(w, h) * 0.25));
      return (
        <g>
          {chairs.map((c, i) => (
            <rect key={i} x={c.x - 0.2} y={c.y - 0.18} width={0.4} height={0.36} rx={0.1} fill={CHAIR} stroke="#94a3b8" strokeWidth={0.02}
              transform={`rotate(${c.angle} ${c.x} ${c.y})`} />
          ))}
          {o.shape === "round"
            ? <ellipse cx={0} cy={0} rx={w / 2} ry={h / 2} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={0.04} />
            : <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.06} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={0.04} />}
          <g transform={`rotate(${-o.rotation})`}>
            <text x={0} y={label ? -fs * 0.1 : fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={700} fill="#422006" fontFamily="system-ui">{label}</text>
            <text x={0} y={label ? fs * 0.95 : fs * 0.35} textAnchor="middle" fontSize={fs * 0.75} fill="#713f12" fontFamily="system-ui">{o.seats} seats</text>
          </g>
        </g>
      );
    }
    case "wall":
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={o.color ?? "#475569"} />;
    case "window":
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#e0f2fe" stroke="#0284c7" strokeWidth={0.03} />
          <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke="#0284c7" strokeWidth={0.02} />
        </g>
      );
    case "door": {
      // Opening along the bottom edge, the door leaf turns from the left corner
      const s = Math.min(w, h * 2);
      return (
        <g transform={o.flip ? "scale(-1 1)" : undefined}>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="transparent" />
          <line x1={-w / 2} y1={h / 2} x2={-w / 2} y2={h / 2 - s} stroke="#334155" strokeWidth={0.05} />
          <path d={`M ${-w / 2} ${h / 2 - s} A ${s} ${s} 0 0 1 ${-w / 2 + s} ${h / 2}`} fill="none" stroke="#64748b" strokeWidth={0.02} strokeDasharray="0.08 0.06" />
          <line x1={-w / 2} y1={h / 2} x2={w / 2} y2={h / 2} stroke="#f8fafc" strokeWidth={0.12} />
          {o.label && (
            <g transform={o.flip ? "scale(-1 1)" : undefined}>
              <text x={0} y={h / 2 - 0.12} textAnchor="middle" fontSize={0.2} fill="#475569" fontFamily="system-ui" transform={`rotate(${-o.rotation} 0 ${h / 2 - 0.12})`}>{o.label}</text>
            </g>
          )}
        </g>
      );
    }
    case "plant":
      return (
        <g>
          <circle r={Math.min(w, h) / 2} fill="#86efac" stroke="#15803d" strokeWidth={0.03} />
          <circle cx={-Math.min(w, h) * 0.15} cy={-Math.min(w, h) * 0.12} r={Math.min(w, h) * 0.2} fill="#4ade80" />
          <circle cx={Math.min(w, h) * 0.16} cy={Math.min(w, h) * 0.1} r={Math.min(w, h) * 0.18} fill="#22c55e" />
        </g>
      );
    case "pillar":
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#64748b" stroke="#334155" strokeWidth={0.03} />;
    case "room":
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={o.color ?? "#f1f5f9"} stroke="#475569" strokeWidth={0.12} />
          <text x={0} y={(o.fontSize ?? 0.45) * 0.35} textAnchor="middle" fontSize={o.fontSize ?? 0.45} fontWeight={700} fill="#334155" fontFamily="system-ui"
            transform={`rotate(${-o.rotation})`}>{o.label}</text>
        </g>
      );
    case "bar":
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.12} fill={o.color ?? "#92400e"} />
          <text x={0} y={0.09} textAnchor="middle" fontSize={Math.min(0.3, h * 0.45)} fontWeight={700} fill="#fff" fontFamily="system-ui">{o.label}</text>
        </g>
      );
    case "text":
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="transparent" />
          <text x={0} y={(o.fontSize ?? 0.4) * 0.35} textAnchor="middle" fontSize={o.fontSize ?? 0.4} fontWeight={600} fill={o.color ?? "#334155"} fontFamily="system-ui">{o.label}</text>
        </g>
      );
  }
}


// ── The customer's plan: a quiet architectural drawing ───────────────────────
// Ink lines on paper, only the table numbers as text. The restaurant's color marks free and picked tables.

const INK = "#3f3f46", HAIR = "#d4d4d8", PAPER = "#ffffff", MUTED = "#a1a1aa", OFF_FILL = "#f4f4f5";
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

function CleanShape({ o, state, accent }: { o: FloorObject; state: TableState; accent: string }) {
  const w = o.w, h = o.h;
  switch (o.type) {
    case "table": {
      const picked = state === "picked", off = state === "off";
      const stroke = off ? HAIR : accent;
      const fill = picked ? accent : off ? OFF_FILL : PAPER;
      const chairs = chairPositions(o);
      const fs = Math.min(0.28, Math.max(0.14, Math.min(w, h) * 0.3));
      return (
        <g>
          {chairs.map((c, i) => (
            <rect key={i} x={c.x - 0.17} y={c.y - 0.13} width={0.34} height={0.26} rx={0.09}
              fill={picked ? accent : PAPER} fillOpacity={picked ? 0.18 : 1} stroke={off ? HAIR : picked ? accent : MUTED} strokeWidth={0.02}
              transform={`rotate(${c.angle} ${c.x} ${c.y})`} />
          ))}
          {o.shape === "round"
            ? <ellipse rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={picked ? 0.035 : 0.03} />
            : <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.05} fill={fill} stroke={stroke} strokeWidth={picked ? 0.035 : 0.03} />}
          <text transform={`rotate(${-o.rotation})`} y={fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={picked ? 600 : 500} letterSpacing={0.01}
            fill={picked ? "#fff" : off ? MUTED : INK} fontFamily={SANS}>{o.label}</text>
        </g>
      );
    }
    case "wall":
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={INK} />;
    case "window":
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={PAPER} />
          <line x1={-w / 2} y1={-h / 4} x2={w / 2} y2={-h / 4} stroke={INK} strokeWidth={0.015} />
          <line x1={-w / 2} y1={h / 4} x2={w / 2} y2={h / 4} stroke={INK} strokeWidth={0.015} />
        </g>
      );
    case "door": {
      const s = Math.min(w, h * 2);
      return (
        <g transform={o.flip ? "scale(-1 1)" : undefined}>
          <line x1={-w / 2} y1={h / 2} x2={w / 2} y2={h / 2} stroke={PAPER} strokeWidth={0.14} />
          <line x1={-w / 2} y1={h / 2} x2={-w / 2} y2={h / 2 - s} stroke={INK} strokeWidth={0.02} />
          <path d={`M ${-w / 2} ${h / 2 - s} A ${s} ${s} 0 0 1 ${-w / 2 + s} ${h / 2}`} fill="none" stroke={MUTED} strokeWidth={0.012} />
        </g>
      );
    }
    case "plant": {
      const r = Math.min(w, h) / 2;
      return (
        <g stroke={MUTED} strokeWidth={0.012} fill="none">
          <circle r={r} />
          {[0, 60, 120].map((a) => <line key={a} x1={-r * 0.7} x2={r * 0.7} transform={`rotate(${a})`} />)}
        </g>
      );
    }
    case "pillar":
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={INK} />;
    case "room": {
      const fs = Math.min(0.32, (o.fontSize ?? 0.45) * 0.7);
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={PAPER} stroke={INK} strokeWidth={0.06} />
          {o.label && <text transform={`rotate(${-o.rotation})`} x={-w / 2 + 0.25} y={-h / 2 + 0.25 + fs} fontSize={fs} fill={MUTED} fontFamily={SANS} letterSpacing={0.02}>{o.label}</text>}
        </g>
      );
    }
    case "bar":
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.04} fill={OFF_FILL} stroke={INK} strokeWidth={0.02} />
          {o.label && <text y={Math.min(0.24, h * 0.4) * 0.36} textAnchor="middle" fontSize={Math.min(0.24, h * 0.4)} fill={INK} fontFamily={SANS} letterSpacing={0.02}>{o.label}</text>}
        </g>
      );
    case "text":
      return <text y={(o.fontSize ?? 0.35) * 0.3} textAnchor="middle" fontSize={Math.min(o.fontSize ?? 0.35, 0.3)} fill={MUTED} fontFamily={SANS} letterSpacing={0.02}>{o.label}</text>;
  }
}
