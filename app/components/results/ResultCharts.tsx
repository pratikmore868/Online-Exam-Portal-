"use client";

// Charts and tables shared by the admin and student result pages.

export const OUTCOME_COLORS = {
  correct: "#059669",
  incorrect: "#dc2626",
  unanswered: "#ca8a04",
};

export const OUTCOME_LABELS: Record<string, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  unanswered: "Not Attempted",
};

export function formatLong(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export interface PieSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  // Text beside the slice. Defaults to "label: value".
  callout?: string;
}

// A pie with a labelled line to each slice. Empty slices are left out, and a lone slice is a full circle.
export function PieChart({ slices, ariaLabel }: { slices: PieSlice[]; ariaLabel: string }) {
  const shown = slices.filter((s) => s.value > 0);
  const total = shown.reduce((sum, s) => sum + s.value, 0);

  // Wide side margins leave room for the longest label, "Not Attempted: 100".
  const cx = 180;
  const cy = 85;
  const r = 58;
  // Each slice starts where the ones before it end, beginning at 12 o'clock.
  const starts = shown.map((_, i) => -Math.PI / 2 + shown.slice(0, i).reduce((sum, s) => sum + (s.value / total) * Math.PI * 2, 0));

  return (
    <figure className="m-0">
      <svg viewBox="0 0 360 170" className="w-full max-w-[380px] mx-auto" role="img" aria-label={ariaLabel}>
        {total === 0 && <circle cx={cx} cy={cy} r={r} fill="#e5e7eb" />}
        {shown.map((slice, i) => {
          const sweep = (slice.value / total) * Math.PI * 2;
          const start = starts[i];
          const end = start + sweep;
          const mid = start + sweep / 2;
          const a = polar(cx, cy, r, start);
          const b = polar(cx, cy, r, end);
          const lineStart = polar(cx, cy, r, mid);
          const lineEnd = polar(cx, cy, r + 12, mid);
          const onRight = Math.cos(mid) >= 0;
          const label = slice.callout ?? `${slice.label}: ${slice.value}`;
          return (
            <g key={slice.key}>
              <title>{`${label} (${Math.round((slice.value / total) * 100)}%)`}</title>
              {shown.length === 1 ? (
                <circle cx={cx} cy={cy} r={r} fill={slice.color} />
              ) : (
                <path
                  d={`M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${b.x} ${b.y} Z`}
                  fill={slice.color}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              )}
              <line x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y} stroke="#9ca3af" strokeWidth={1} />
              <text x={lineEnd.x + (onRight ? 3 : -3)} y={lineEnd.y + 4} textAnchor={onRight ? "start" : "end"} fontSize={11} fill="#374151">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="flex items-center justify-center gap-3 flex-wrap text-xs text-gray-600">
        {slices.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function OutcomePie({ correct, incorrect, unanswered }: { correct: number; incorrect: number; unanswered: number }) {
  const values = { correct, incorrect, unanswered };
  return (
    <PieChart
      ariaLabel={`${correct} correct, ${incorrect} incorrect, ${unanswered} not attempted`}
      slices={(Object.keys(OUTCOME_COLORS) as (keyof typeof OUTCOME_COLORS)[]).map((key) => ({
        key,
        label: OUTCOME_LABELS[key],
        value: values[key],
        color: OUTCOME_COLORS[key],
      }))}
    />
  );
}

export function BreakdownTable({ heading, rows, overall }: { heading: string; rows: any[]; overall?: any }) {
  const cell = "py-3 px-4 text-center border-r border-white/60 last:border-r-0";
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#1b78bd] text-white font-semibold">
          <tr>
            <th className={cell}>{heading}</th>
            <th className={cell}>Score</th>
            <th className={cell}>Accuracy</th>
            <th className={cell}>Percentile</th>
            <th className={cell}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white text-gray-900">
          {rows.map((row) => (
            <tr key={row.name} className="bg-blue-50/70">
              <td className={`${cell} font-medium`}>{row.name}</td>
              <td className={cell}>{row.score}</td>
              <td className={cell}>{row.accuracy.toFixed(1)}%</td>
              <td className={cell}>{row.percentile.toFixed(1)}</td>
              <td className={cell}>{row.maxScore}</td>
            </tr>
          ))}
          {overall && (
            <tr className="bg-blue-200/60 font-bold">
              <td className={cell}>Overall</td>
              <td className={cell}>{overall.score}</td>
              <td className={cell}>{overall.accuracy.toFixed(1)}%</td>
              <td className={cell}>{overall.percentile.toFixed(1)}</td>
              <td className={cell}>{overall.maxScore}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PieGrid({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-center text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map((row) => (
          <div key={row.name} className="border border-gray-200 rounded-xl p-4 break-inside-avoid">
            <div className="text-center font-medium text-gray-900">{row.name}</div>
            <div className="text-center text-xs text-gray-600 mb-2">
              Score: {row.score} | Accuracy: {row.accuracy.toFixed(1)}%
            </div>
            <OutcomePie correct={row.correct} incorrect={row.incorrect} unanswered={row.unanswered} />
          </div>
        ))}
      </div>
    </div>
  );
}
