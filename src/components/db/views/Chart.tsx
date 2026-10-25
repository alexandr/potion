import { useState } from 'react';
import type { Block, PropertySchema, View } from '../../../store/types';
import { groupRows } from '../dbUtils';

const PALETTE: Record<string, string> = {
  default: 'var(--dot-default)',
  gray: 'var(--dot-gray)',
  brown: 'var(--dot-brown)',
  orange: 'var(--dot-orange)',
  yellow: 'var(--dot-yellow)',
  green: 'var(--dot-green)',
  blue: 'var(--dot-blue)',
  purple: 'var(--dot-purple)',
  pink: 'var(--dot-pink)',
  red: 'var(--dot-red)',
};
const SERIES = ['blue', 'orange', 'green', 'purple', 'pink', 'yellow', 'red', 'brown', 'gray'];

export function ChartView({ db, view, rows }: { db: Block; view: View; rows: Block[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const gp = view.groupBy ? (db.props.schema[view.groupBy] as PropertySchema | undefined) : undefined;
  if (!gp) return <div className="db-empty-view">Choose a property to group by in view settings to draw a chart.</div>;
  const groups = (groupRows(db, view, rows) ?? []).filter((g) => g.rows.length || g.key !== '__none');
  const data = groups.map((g, i) => ({ label: g.label, value: g.rows.length, color: PALETTE[g.color !== 'default' ? g.color : SERIES[i % SERIES.length]] }));
  const max = Math.max(1, ...data.map((d) => d.value));
  const type = view.chartType ?? 'bar';
  const W = 640;
  const H = 280;
  const padL = 36;
  const padB = 40;
  const innerW = W - padL - 12;
  const innerH = H - padB - 16;
  const step = Math.max(1, Math.ceil(max / 5));
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  const top = ticks[ticks.length - 1] || 1;

  if (type === 'donut') {
    const total = data.reduce((a, d) => a + d.value, 0) || 1;
    let acc = 0;
    const R = 100;
    const r = 62;
    const cx = 140;
    const cy = 130;
    return (
      <div className="db-chart">
        <svg viewBox="0 0 520 260" className="chart-svg">
          {data.map((d, i) => {
            if (!d.value) return null;
            const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
            acc += d.value;
            const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
            const large = a1 - a0 > Math.PI ? 1 : 0;
            const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
            const path = d.value === total ? `M ${p(R, -Math.PI / 2)} A ${R} ${R} 0 1 1 ${p(R, Math.PI * 1.5 - 0.0001)} L ${p(r, Math.PI * 1.5 - 0.0001)} A ${r} ${r} 0 1 0 ${p(r, -Math.PI / 2)} Z` : `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`;
            return <path key={i} d={path} fill={d.color} opacity={hover === null || hover === i ? 1 : 0.4} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
          })}
          <text x={cx} y={cy - 4} textAnchor="middle" className="chart-center-num">
            {hover !== null ? data[hover].value : total}
          </text>
          <text x={cx} y={cy + 16} textAnchor="middle" className="chart-center-label">
            {hover !== null ? data[hover].label : 'Total'}
          </text>
          {data.map((d, i) => (
            <g key={i} transform={`translate(290, ${40 + i * 24})`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect width="10" height="10" rx="2" y="-9" fill={d.color} />
              <text x="18" className="chart-legend">
                {d.label} · {d.value}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  const bw = innerW / Math.max(1, data.length);
  return (
    <div className="db-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        {ticks.map((t) => {
          const y = 16 + innerH - (t / top) * innerH;
          return (
            <g key={t}>
              <line x1={padL} x2={W - 12} y1={y} y2={y} className="chart-grid" />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="chart-axis">
                {t}
              </text>
            </g>
          );
        })}
        {type === 'bar' &&
          data.map((d, i) => {
            const h = (d.value / top) * innerH;
            const x = padL + i * bw + bw * 0.2;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={x} y={16 + innerH - h} width={bw * 0.6} height={Math.max(h, 0)} rx="3" fill={d.color} opacity={hover === null || hover === i ? 1 : 0.5} />
                {hover === i && (
                  <text x={x + bw * 0.3} y={16 + innerH - h - 6} textAnchor="middle" className="chart-value">
                    {d.value}
                  </text>
                )}
              </g>
            );
          })}
        {type === 'line' && (
          <>
            <polyline
              fill="none"
              stroke="var(--blue)"
              strokeWidth="2"
              points={data.map((d, i) => `${padL + i * bw + bw / 2},${16 + innerH - (d.value / top) * innerH}`).join(' ')}
            />
            {data.map((d, i) => (
              <circle key={i} cx={padL + i * bw + bw / 2} cy={16 + innerH - (d.value / top) * innerH} r={hover === i ? 5 : 3.5} fill="var(--blue)" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            ))}
          </>
        )}
        {data.map((d, i) => (
          <text key={i} x={padL + i * bw + bw / 2} y={H - padB + 20} textAnchor="middle" className="chart-axis">
            {d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label}
          </text>
        ))}
      </svg>
      {hover !== null && (
        <div className="chart-tooltip">
          <b>{data[hover].label}</b>: {data[hover].value} {data[hover].value === 1 ? 'page' : 'pages'}
        </div>
      )}
    </div>
  );
}
