import React from 'react';

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

/** Barras de uma contagem por categoria (aparelho, país, estado...), em ordem decrescente. */
const StatBars: React.FC<{ title: string; data: Record<string, number>; label?: (key: string) => string; limit?: number }> = ({ title, data, label = (key) => key, limit = 6 }) => {
  const rows = Object.entries(data).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">
        {rows.slice(0, limit).map(([key, count]) => (
          <li key={key} className="text-sm">
            <div className="flex justify-between gap-2">
              <span className="truncate">{label(key)}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{count} · {pct(count, total)}</span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, Math.round((count / total) * 100))}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StatBars;
