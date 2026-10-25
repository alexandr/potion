import { useEffect, useMemo, useRef, useState } from 'react';
import type { Block, ID, PropertySchema, View } from '../../../store/types';
import * as I from '../../ui/Icons';
import { Popover, MenuItem } from '../../ui/Popover';
import { CellValue } from '../CellValue';
import { computeValue, dayKey, isEmptyValue, MONTHS_SHORT, parseDay, setValue, updateView, visibleProps } from '../dbUtils';
import { createAndOpen, openRow } from '../openRow';
import { RowIcon } from '../RowIcon';

const DAY = 86400000;
const ZOOMS: { id: string; label: string; w: number }[] = [
  { id: 'day', label: 'Day', w: 120 },
  { id: 'week', label: 'Week', w: 56 },
  { id: 'month', label: 'Month', w: 28 },
  { id: 'quarter', label: 'Quarter', w: 10 },
  { id: 'year', label: 'Year', w: 3 },
];
const ROW_H = 40;

export function TimelineView({ db, view, rows, locked }: { db: Block; view: View; rows: Block[]; locked?: boolean }) {
  const dp = view.dateProp ? (db.props.schema[view.dateProp] as PropertySchema | undefined) : undefined;
  const zoom = ZOOMS.find((z) => z.id === ((view as any).zoom ?? 'month')) ?? ZOOMS[2];
  const showTable = (view as any).showTable !== false;
  const dayW = zoom.w;
  const scrollRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const [zoomMenu, setZoomMenu] = useState<DOMRect | null>(null);
  const [dragState, setDragState] = useState<{ id: ID; mode: 'move' | 'start' | 'end'; x0: number; start: number; end: number; dx: number } | null>(null);
  const props = visibleProps(db, view).filter((p) => p.id !== 'title' && p.id !== view.dateProp).slice(0, 3);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = (r: Block) => {
    if (!dp) return null;
    const v = computeValue(db, r, dp);
    if (dp.type === 'created_time' || dp.type === 'last_edited_time') {
      const d = new Date(v);
      d.setHours(0, 0, 0, 0);
      return { s: d.getTime(), e: d.getTime() };
    }
    if (!v?.start) return null;
    const s = parseDay(v.start).getTime();
    return { s, e: v.end ? parseDay(v.end).getTime() : s };
  };
  const { origin, days } = useMemo(() => {
    let min = today.getTime() - 30 * DAY;
    let max = today.getTime() + 90 * DAY;
    rows.forEach((r) => {
      const d = dates(r);
      if (d) {
        min = Math.min(min, d.s - 14 * DAY);
        max = Math.max(max, d.e + 30 * DAY);
      }
    });
    const o = new Date(min);
    o.setDate(o.getDate() - o.getDay());
    return { origin: o.getTime(), days: Math.ceil((max - o.getTime()) / DAY) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, dp?.id]);

  const scrollToToday = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = ((today.getTime() - origin) / DAY) * dayW - el.clientWidth / 3;
  };
  useEffect(scrollToToday, [dayW, origin]); // eslint-disable-line react-hooks/exhaustive-deps
  const [scrollX, setScrollX] = useState(0);

  useEffect(() => {
    if (!dragState) return;
    const move = (e: MouseEvent) => setDragState((d) => (d ? { ...d, dx: e.clientX - d.x0 } : d));
    const up = () => {
      setDragState((d) => {
        if (d && Math.abs(d.dx) > 3) {
          movedRef.current = true;
          setTimeout(() => (movedRef.current = false), 80);
        }
        if (d && dp) {
          const shift = Math.round(d.dx / dayW) * DAY;
          let s = d.start;
          let en = d.end;
          if (d.mode === 'move') {
            s += shift;
            en += shift;
          } else if (d.mode === 'start') s = Math.min(en, s + shift);
          else en = Math.max(s, en + shift);
          if (shift !== 0) {
            const row = rows.find((r) => r.id === d.id);
            const cur = row?.props.values?.[dp.id] ?? {};
            setValue(d.id, dp.id, { ...cur, start: dayKey(new Date(s)), end: en !== s || cur.end ? dayKey(new Date(en)) : undefined });
          }
        }
        return null;
      });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragState?.id, dp, dayW, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dp) return <div className="db-empty-view">Choose a date property in view settings to show a timeline.</div>;

  // scale header: months + days/weeks
  const months: { label: string; x: number; w: number }[] = [];
  const ticks: { label: string; x: number; today: boolean }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(origin + i * DAY);
    if (d.getDate() === 1 || i === 0) months.push({ label: `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`, x: i * dayW, w: 0 });
    const showTick = dayW >= 20 || (dayW >= 8 && d.getDay() === 0) || (dayW < 8 && d.getDate() === 1);
    if (showTick) ticks.push({ label: dayW < 8 ? MONTHS_SHORT[d.getMonth()] : String(d.getDate()), x: i * dayW, today: d.getTime() === today.getTime() });
  }
  months.forEach((m, i) => (m.w = (months[i + 1]?.x ?? days * dayW) - m.x));
  const todayX = ((today.getTime() - origin) / DAY) * dayW;

  return (
    <div className="db-timeline">
      <div className="tl-head">
        <div className="tl-title">{[...months].reverse().find((m) => m.x <= scrollX + (scrollRef.current?.clientWidth ?? 600) / 3)?.label ?? months[0]?.label}</div>
        <div className="tl-controls">
          <span className="tl-zoom" onClick={(e) => setZoomMenu(e.currentTarget.getBoundingClientRect())}>
            {zoom.label} <I.ChevronDown size={12} />
          </span>
          <button className="icon-btn" onClick={() => scrollRef.current && (scrollRef.current.scrollLeft -= 7 * dayW)}>
            <I.ChevronLeft size={16} />
          </button>
          <button className="cal-today-btn" onClick={scrollToToday}>
            Today
          </button>
          <button className="icon-btn" onClick={() => scrollRef.current && (scrollRef.current.scrollLeft += 7 * dayW)}>
            <I.ChevronRight size={16} />
          </button>
          <span className={`tl-table-toggle ${showTable ? 'on' : ''}`} title="Show table" onClick={() => updateView(db.id, view.id, { showTable: !showTable } as any)}>
            <I.SidePeekIcon size={16} />
          </span>
        </div>
      </div>
      <div className="tl-body">
        {showTable && (
          <div className="tl-table">
            <div className="tl-table-head">
              <I.TextIcon size={14} /> {(db.props.schema.title as PropertySchema)?.name ?? 'Name'}
            </div>
            {rows.map((r) => (
              <div key={r.id} className="tl-table-row" style={{ height: ROW_H }} onClick={() => openRow(view, r.id)}>
                <RowIcon row={r} size={14} />
                <span className="tl-row-title">{r.props.title || 'Untitled'}</span>
              </div>
            ))}
            {!locked && (
              <div className="db-new-row" onClick={() => createAndOpen(db, view)}>
                <I.PlusIcon size={14} />
                <span>New page</span>
              </div>
            )}
          </div>
        )}
        <div className="tl-scroll" ref={scrollRef} onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}>
          <div className="tl-canvas" style={{ width: days * dayW, height: 52 + rows.length * ROW_H + 40 }}>
            <div className="tl-scale">
              <div className="tl-months">
                {months.map((m) => (
                  <div key={m.x} className="tl-month" style={{ left: m.x, width: m.w }}>
                    {m.label}
                  </div>
                ))}
              </div>
              <div className="tl-ticks">
                {ticks.map((t) => (
                  <div key={t.x} className={`tl-tick ${t.today ? 'today' : ''}`} style={{ left: t.x, width: dayW }}>
                    {t.label}
                  </div>
                ))}
              </div>
            </div>
            {dayW >= 20 &&
              Array.from({ length: days }, (_, i) => {
                const d = new Date(origin + i * DAY);
                return d.getDay() === 0 || d.getDay() === 6 ? <div key={i} className="tl-weekend" style={{ left: i * dayW, width: dayW }} /> : null;
              })}
            <div className="tl-today-line" style={{ left: todayX + dayW / 2 }} />
            {rows.map((r, i) => {
              const d = dates(r);
              const top = 52 + i * ROW_H + 6;
              if (!d)
                return (
                  <div
                    key={r.id}
                    className="tl-empty-row"
                    style={{ top: top - 6, height: ROW_H }}
                    onClick={(e) => {
                      if (locked || dp.type !== 'date') return;
                      const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                      const dayIdx = Math.floor((e.clientX - rect.left) / dayW);
                      setValue(r.id, dp.id, { start: dayKey(new Date(origin + dayIdx * DAY)) });
                    }}
                  />
                );
              let s = d.s;
              let e = d.e;
              if (dragState?.id === r.id) {
                const shift = Math.round(dragState.dx / dayW) * DAY;
                if (dragState.mode === 'move') {
                  s += shift;
                  e += shift;
                } else if (dragState.mode === 'start') s = Math.min(e, s + shift);
                else e = Math.max(s, e + shift);
              }
              const x = ((s - origin) / DAY) * dayW;
              const w = ((e - s) / DAY + 1) * dayW;
              return (
                <div key={r.id} className={`tl-bar ${dragState?.id === r.id ? 'dragging' : ''}`} style={{ left: x, width: Math.max(w, 6), top, height: ROW_H - 12 }}
                  onMouseDown={(ev) => {
                    if (locked || dp.type !== 'date' || ev.button !== 0) return;
                    ev.preventDefault();
                    setDragState({ id: r.id, mode: 'move', x0: ev.clientX, start: d.s, end: d.e, dx: 0 });
                  }}
                  onClick={(ev) => {
                    void ev;
                    if (movedRef.current) return;
                    openRow(view, r.id);
                  }}
                >
                  {!locked && <span className="tl-handle left" onMouseDown={(ev) => { ev.stopPropagation(); ev.preventDefault(); setDragState({ id: r.id, mode: 'start', x0: ev.clientX, start: d.s, end: d.e, dx: 0 }); }} />}
                  <RowIcon row={r} size={14} />
                  <span className="tl-bar-title">{r.props.title || 'Untitled'}</span>
                  {props.map((p) => {
                    const v = computeValue(db, r, p);
                    if (isEmptyValue(p, v)) return null;
                    return (
                      <span key={p.id} className="tl-bar-prop">
                        <CellValue db={db} row={r} prop={p} />
                      </span>
                    );
                  })}
                  {!locked && <span className="tl-handle right" onMouseDown={(ev) => { ev.stopPropagation(); ev.preventDefault(); setDragState({ id: r.id, mode: 'end', x0: ev.clientX, start: d.s, end: d.e, dx: 0 }); }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {zoomMenu && (
        <Popover anchor={zoomMenu} onClose={() => setZoomMenu(null)} width={160}>
          <div className="menu">
            {ZOOMS.map((z) => (
              <MenuItem key={z.id} label={z.label} checked={z.id === zoom.id} onClick={() => { updateView(db.id, view.id, { zoom: z.id } as any); setZoomMenu(null); }} />
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}
