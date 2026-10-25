import { useMemo, useState } from 'react';
import type { Block, ID, PropertySchema, View } from '../../../store/types';
import * as I from '../../ui/Icons';
import { CellValue } from '../CellValue';
import { computeValue, dayKey, isEmptyValue, MONTHS_SHORT, parseDay, setValue, visibleProps } from '../dbUtils';
import { createAndOpen, openRow } from '../openRow';
import { RowIcon } from '../RowIcon';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function rowDate(db: Block, row: Block, p: PropertySchema): { start: string; end?: string } | null {
  const v = computeValue(db, row, p);
  if (p.type === 'created_time' || p.type === 'last_edited_time') return { start: dayKey(new Date(v)) };
  if (!v?.start) return null;
  return { start: v.start.slice(0, 10), end: v.end?.slice(0, 10) };
}

export function CalendarView({ db, view, rows, locked }: { db: Block; view: View; rows: Block[]; locked?: boolean }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [drag, setDrag] = useState<ID | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const dp = view.dateProp ? (db.props.schema[view.dateProp] as PropertySchema | undefined) : undefined;
  const props = visibleProps(db, view).filter((p) => p.id !== 'title' && p.id !== view.dateProp);
  const startWeek = (view as any).weekStart === 1 ? 1 : 0;
  const days = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - ((month.getDay() - startWeek + 7) % 7));
    const total = Math.ceil(((month.getDay() - startWeek + 7) % 7 + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month, startWeek]);
  const byDay = useMemo(() => {
    const m = new Map<string, Block[]>();
    if (!dp) return m;
    rows.forEach((r) => {
      const d = rowDate(db, r, dp);
      if (!d) return;
      const s = parseDay(d.start);
      const e = d.end ? parseDay(d.end) : s;
      for (let t = new Date(s); t <= e && (t.getTime() - s.getTime()) / 86400000 < 62; t.setDate(t.getDate() + 1)) {
        const k = dayKey(t);
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(r);
      }
    });
    return m;
  }, [rows, dp, db]);
  const noDate = dp ? rows.filter((r) => !rowDate(db, r, dp)).length : 0;
  const today = dayKey(new Date());
  if (!dp) return <div className="db-empty-view">Choose a date property in view settings to show a calendar.</div>;
  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const orderedDows = [...dows.slice(startWeek), ...dows.slice(0, startWeek)];

  const moveTo = (k: string) => {
    if (!drag || dp.type !== 'date') return;
    const row = rows.find((r) => r.id === drag);
    const cur = row?.props.values?.[dp.id];
    if (cur?.start && cur.end) {
      const delta = (parseDay(k).getTime() - parseDay(cur.start).getTime()) / 86400000;
      const ne = parseDay(cur.end);
      ne.setDate(ne.getDate() + delta);
      setValue(drag, dp.id, { ...cur, start: k + (cur.start.slice(10) || ''), end: dayKey(ne) + (cur.end.slice(10) || '') });
    } else setValue(drag, dp.id, { ...(cur ?? {}), start: k + (cur?.start?.slice(10) || '') });
    setDrag(null);
    setOver(null);
  };

  return (
    <div className="db-calendar">
      <div className="cal-head">
        <div className="cal-month">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </div>
        <div className="cal-nav">
          {noDate > 0 && <span className="cal-nodate">No date ({noDate})</span>}
          <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <I.ChevronLeft size={16} />
          </button>
          <button
            className="cal-today-btn"
            onClick={() => {
              const d = new Date();
              setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            Today
          </button>
          <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <I.ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="cal-dows">
        {orderedDows.map((d) => (
          <div key={d} className={`cal-dow ${d === 'Sun' || d === 'Sat' ? 'weekend' : ''}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="cal-grid">
        {days.map((d) => {
          const k = dayKey(d);
          const list = byDay.get(k) ?? [];
          const other = d.getMonth() !== month.getMonth();
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div
              key={k}
              className={`cal-day ${other ? 'other' : ''} ${weekend ? 'weekend' : ''} ${over === k ? 'over' : ''}`}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                setOver(k);
              }}
              onDragLeave={() => over === k && setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                moveTo(k);
              }}
            >
              <div className="cal-day-head">
                {!locked && dp.type === 'date' && (
                  <span className="cal-add" onClick={() => createAndOpen(db, view, { [dp.id]: { start: k } })}>
                    <I.PlusIcon size={14} />
                  </span>
                )}
                <span className={`cal-day-num ${k === today ? 'today' : ''}`}>
                  {d.getDate() === 1 ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}` : d.getDate()}
                </span>
              </div>
              <div className="cal-cards">
                {list.map((r) => (
                  <div
                    key={r.id}
                    className={`cal-card ${drag === r.id ? 'dragging' : ''}`}
                    draggable={!locked && dp.type === 'date'}
                    onDragStart={(e) => {
                      setDrag(r.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', r.props.title ?? '');
                    }}
                    onDragEnd={() => {
                      setDrag(null);
                      setOver(null);
                    }}
                    onClick={() => openRow(view, r.id)}
                  >
                    <div className="cal-card-title">
                      <RowIcon row={r} size={14} />
                      <span>{r.props.title || 'Untitled'}</span>
                    </div>
                    {props.map((p) => {
                      const v = computeValue(db, r, p);
                      if (isEmptyValue(p, v)) return null;
                      return (
                        <div key={p.id} className="cal-card-prop">
                          <CellValue db={db} row={r} prop={p} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
