import { useEffect, useMemo, useRef, useState } from 'react';
import type { Block, Color, ID, PropertySchema, SelectOption } from '../../store/types';
import { useStore } from '../../store/store';
import { Popover, MenuItem, MenuHeader, MenuSep, Toggle, type Anchor } from '../ui/Popover';
import * as I from '../ui/Icons';
import { Tag, PersonChip, Avatar } from './CellValue';
import {
  addOption,
  computeFormula,
  COLORS,
  dayKey,
  deleteOption,
  formatDateStr,
  MONTHS_SHORT,
  parseDay,
  setValue,
  updateOption,
  updateSchema,
} from './dbUtils';
import { formulaToString } from './formula';

const COLOR_LABEL: Record<string, string> = {
  default: 'Default',
  gray: 'Gray',
  brown: 'Brown',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  purple: 'Purple',
  pink: 'Pink',
  red: 'Red',
};

export interface EditorProps {
  db: Block;
  row: Block;
  prop: PropertySchema;
  anchor: Anchor;
  onClose: () => void;
}

export function CellEditor(p: EditorProps) {
  switch (p.prop.type) {
    case 'title':
    case 'text':
    case 'url':
    case 'email':
    case 'phone':
    case 'number':
      return <TextEditor {...p} />;
    case 'select':
    case 'status':
    case 'multi_select':
      return <SelectEditor {...p} />;
    case 'date':
      return <DateEditor {...p} />;
    case 'person':
      return <PersonEditor {...p} />;
    case 'files':
      return <FilesEditor {...p} />;
    case 'relation':
      return <RelationEditor {...p} />;
    case 'formula':
      return <FormulaEditor {...p} />;
    default:
      return null;
  }
}

/** Popover that sits exactly over the cell, like Notion's expanding cell editor. */
const overCache = new WeakMap<HTMLElement, { x: number; y: number; w: number; h: number }>();
/** returns a stable anchor object while the cell does not move (Popover re-positions when the anchor identity changes) */
function overCell(anchor: Anchor) {
  if (anchor instanceof HTMLElement) {
    const r = anchor.getBoundingClientRect();
    const prev = overCache.get(anchor);
    if (prev && prev.x === r.left && prev.y === r.top && prev.w === r.width) return prev;
    const o = { x: r.left, y: r.top, w: r.width, h: 0 };
    overCache.set(anchor, o);
    return o;
  }
  return anchor;
}

function TextEditor({ db, row, prop, anchor, onClose }: EditorProps) {
  const initial = prop.type === 'title' ? row.props.title ?? '' : row.props.values?.[prop.id] ?? '';
  const [v, setV] = useState<string>(initial === undefined || initial === null ? '' : String(initial));
  const ref = useRef<HTMLTextAreaElement>(null);
  const rect = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : null;
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 'px';
  }, []);
  const commit = (val = v) => {
    if (prop.type === 'number') {
      const n = val.trim() === '' ? undefined : parseFloat(val.replace(/[^0-9.\-e]/g, ''));
      setValue(row.id, prop.id, n === undefined || isNaN(n) ? undefined : prop.numberFormat === 'percent' && /%/.test(val) ? n / 100 : n);
    } else setValue(row.id, prop.id, prop.type === 'title' ? val.replace(/\n/g, ' ') : val, `cell:${row.id}:${prop.id}`);
  };
  void db;
  return (
    <Popover anchor={overCell(anchor)} offset={0} onClose={() => { commit(); onClose(); }} width={Math.max(rect?.width ?? 240, 240)} className="cell-editor-pop">
      <textarea
        ref={ref}
        className={`cell-textarea ${prop.type === 'number' ? 'num' : ''}`}
        value={v}
        rows={1}
        placeholder={prop.type === 'url' ? 'Type or paste a link' : prop.type === 'email' ? 'Type an email' : prop.type === 'phone' ? 'Type a phone number' : ''}
        onChange={(e) => {
          setV(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
          if (prop.type === 'title' || prop.type === 'text') commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !(prop.type === 'text' && e.shiftKey)) {
            e.preventDefault();
            commit();
            onClose();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            commit();
            onClose();
          }
        }}
      />
    </Popover>
  );
}

export function OptionMenu({ db, prop, opt, anchor, onClose }: { db: Block; prop: PropertySchema; opt: SelectOption; anchor: Anchor; onClose: () => void }) {
  const [name, setName] = useState(opt.name);
  return (
    <Popover anchor={anchor} placement="right-start" onClose={() => { if (name.trim() && name !== opt.name) updateOption(db.id, prop.id, opt.id, { name: name.trim() }); onClose(); }} width={220}>
      <div className="menu">
        <div className="menu-input-row">
          <input
            className="text-input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (name.trim()) updateOption(db.id, prop.id, opt.id, { name: name.trim() });
                onClose();
              }
            }}
          />
        </div>
        <MenuItem icon={<I.TrashIcon size={16} />} label="Delete" onClick={() => { deleteOption(db.id, prop.id, opt.id); onClose(); }} />
        <MenuSep />
        <MenuHeader>Colors</MenuHeader>
        {COLORS.map((c) => (
          <MenuItem
            key={c}
            icon={<span className={`color-square tag-${c}`} />}
            label={COLOR_LABEL[c]}
            checked={opt.color === c}
            onClick={() => updateOption(db.id, prop.id, opt.id, { color: c as Color })}
          />
        ))}
      </div>
    </Popover>
  );
}

function SelectEditor({ db, row, prop, anchor, onClose }: EditorProps) {
  const fresh = useStore((s) => s.blocks[db.id]);
  const liveRow = useStore((s) => s.blocks[row.id]) ?? row;
  const p = (fresh?.props.schema[prop.id] as PropertySchema) ?? prop;
  const multi = p.type === 'multi_select';
  const raw = liveRow.props.values?.[p.id];
  const selected: ID[] = multi ? (Array.isArray(raw) ? raw : []) : raw ? [raw] : [];
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const [optMenu, setOptMenu] = useState<{ opt: SelectOption; rect: DOMRect } | null>(null);
  const opts = (p.options ?? []).filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = (p.options ?? []).some((o) => o.name.toLowerCase() === q.trim().toLowerCase());
  const canCreate = q.trim() && !exact;
  const nextColor = COLORS[((p.options?.length ?? 0) + 1) % COLORS.length];
  const items: ({ kind: 'opt'; opt: SelectOption } | { kind: 'create' })[] = [
    ...opts.map((o) => ({ kind: 'opt' as const, opt: o })),
    ...(canCreate ? [{ kind: 'create' as const }] : []),
  ];

  const pick = (id: ID) => {
    if (multi) {
      setValue(row.id, p.id, selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
      setQ('');
    } else {
      setValue(row.id, p.id, selected[0] === id ? undefined : id);
      onClose();
    }
  };
  const create = () => {
    const o = addOption(db.id, p.id, q.trim(), nextColor);
    pick(o.id);
    setQ('');
  };

  const groups =
    p.type === 'status'
      ? ([
          ['todo', 'To-do'],
          ['in_progress', 'In progress'],
          ['complete', 'Complete'],
        ] as const)
      : null;

  const renderOpt = (o: SelectOption) => {
    const idx = items.findIndex((x) => x.kind === 'opt' && x.opt.id === o.id);
    return (
      <div
        key={o.id}
        className={`menu-item select-opt ${hi === idx ? 'active' : ''}`}
        onMouseEnter={() => setHi(idx)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => pick(o.id)}
      >
        <span className="opt-drag">
          <I.DragIcon size={14} />
        </span>
        <div className="menu-item-body">
          <Tag name={o.name} color={o.color} status={p.type === 'status'} />
        </div>
        {selected.includes(o.id) && !multi && <I.CheckIcon size={14} />}
        <span
          className="opt-more"
          onClick={(e) => {
            e.stopPropagation();
            setOptMenu({ opt: o, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() });
          }}
        >
          <I.DotsIcon size={14} />
        </span>
      </div>
    );
  };

  return (
    <Popover anchor={overCell(anchor)} offset={0} onClose={onClose} width={300} className="cell-editor-pop">
      <div className="select-editor">
        <div className="select-input-wrap">
          {selected.map((id) => {
            const o = p.options?.find((x) => x.id === id);
            return o ? <Tag key={id} name={o.name} color={o.color} status={p.type === 'status'} onRemove={() => (multi ? setValue(row.id, p.id, selected.filter((x) => x !== id)) : setValue(row.id, p.id, undefined))} /> : null;
          })}
          <input
            autoFocus
            className="select-input"
            value={q}
            placeholder={selected.length ? '' : multi ? 'Search for an option...' : 'Search for an option...'}
            onChange={(e) => {
              setQ(e.target.value);
              setHi(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHi((h) => Math.min(items.length - 1, h + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHi((h) => Math.max(0, h - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const it = items[hi];
                if (!it) return;
                if (it.kind === 'create') create();
                else pick(it.opt.id);
              } else if (e.key === 'Backspace' && !q && selected.length) {
                if (multi) setValue(row.id, p.id, selected.slice(0, -1));
                else setValue(row.id, p.id, undefined);
              }
            }}
          />
        </div>
        <div className="select-list">
          <div className="menu-header">{p.type === 'status' ? '' : multi ? 'Select an option or create one' : 'Select an option or create one'}</div>
          {groups
            ? groups.map(([g, label]) => {
                const list = opts.filter((o) => (o.group ?? 'todo') === g);
                if (!list.length && q) return null;
                return (
                  <div key={g}>
                    <div className="menu-header">{label}</div>
                    {list.map(renderOpt)}
                  </div>
                );
              })
            : opts.map(renderOpt)}
          {canCreate && (
            <div
              className={`menu-item ${hi === items.length - 1 ? 'active' : ''}`}
              onMouseEnter={() => setHi(items.length - 1)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={create}
            >
              <div className="menu-item-body">
                <span className="create-label">Create</span> <Tag name={q.trim()} color={nextColor} status={p.type === 'status'} />
              </div>
            </div>
          )}
        </div>
      </div>
      {optMenu && <OptionMenu db={db} prop={p} opt={optMenu.opt} anchor={optMenu.rect} onClose={() => setOptMenu(null)} />}
    </Popover>
  );
}

// ---------- Date picker ----------
export function DatePicker({
  value,
  onChange,
  allowRange = true,
}: {
  value: { start?: string; end?: string; time?: boolean } | undefined;
  onChange: (v: { start: string; end?: string; time?: boolean } | undefined) => void;
  allowRange?: boolean;
}) {
  const v = value ?? {};
  const [month, setMonth] = useState(() => {
    const d = v.start ? parseDay(v.start) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [endMode, setEndMode] = useState(!!v.end);
  const [editing, setEditing] = useState<'start' | 'end'>('start');
  const [startText, setStartText] = useState(v.start ? formatDateStr(v.start, v.time) : '');
  const [endText, setEndText] = useState(v.end ? formatDateStr(v.end, v.time) : '');
  useEffect(() => {
    setStartText(v.start ? formatDateStr(v.start, v.time) : '');
    setEndText(v.end ? formatDateStr(v.end, v.time) : '');
  }, [v.start, v.end, v.time]);

  const today = dayKey(new Date());
  const days = useMemo(() => {
    const first = new Date(month);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const timeOf = (s?: string) => (s && s.length > 10 ? s.slice(10) : v.time ? 'T09:00' : '');
  const pickDay = (k: string) => {
    if (endMode && allowRange) {
      if (editing === 'start') {
        const end = v.end && v.end >= k ? v.end : k;
        onChange({ start: k + timeOf(v.start), end: end.slice(0, 10) + timeOf(v.end), time: v.time });
        setEditing('end');
      } else {
        const s = v.start ?? k;
        if (k < s.slice(0, 10)) onChange({ start: k + timeOf(v.start), end: s.slice(0, 10) + timeOf(v.end), time: v.time });
        else onChange({ start: s, end: k + timeOf(v.end), time: v.time });
        setEditing('start');
      }
    } else onChange({ start: k + timeOf(v.start), time: v.time });
  };
  const inRange = (k: string) => v.start && v.end && k >= v.start.slice(0, 10) && k <= v.end.slice(0, 10);

  const parseText = (t: string): string | null => {
    const d = new Date(t);
    if (isNaN(d.getTime())) return null;
    return dayKey(d);
  };

  return (
    <div className="date-picker">
      <div className="dp-inputs">
        <input
          className={`text-input dp-input ${editing === 'start' ? 'focus' : ''}`}
          value={startText}
          placeholder="Start date"
          onFocus={() => setEditing('start')}
          onChange={(e) => setStartText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const k = parseText(startText);
              if (k) {
                onChange({ ...v, start: k, time: v.time } as any);
                setMonth(new Date(parseDay(k).getFullYear(), parseDay(k).getMonth(), 1));
              }
            }
          }}
        />
        {endMode && (
          <input
            className={`text-input dp-input ${editing === 'end' ? 'focus' : ''}`}
            value={endText}
            placeholder="End date"
            onFocus={() => setEditing('end')}
            onChange={(e) => setEndText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const k = parseText(endText);
                if (k && v.start) onChange({ ...v, start: v.start, end: k });
              }
            }}
          />
        )}
      </div>
      <div className="dp-head">
        <span className="dp-month">
          {MONTHS_SHORT[month.getMonth()]} {month.getFullYear()}
        </span>
        <div className="dp-nav">
          <button className="icon-btn small" onClick={() => setMonth(new Date())} title="Today">
            <span style={{ fontSize: 12 }}>Today</span>
          </button>
          <button className="icon-btn small" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <I.ChevronLeft size={14} />
          </button>
          <button className="icon-btn small" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <I.ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="dp-grid">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="dp-dow">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const k = dayKey(d);
          const sel = k === v.start?.slice(0, 10) || k === v.end?.slice(0, 10);
          return (
            <div
              key={k}
              className={`dp-day ${d.getMonth() !== month.getMonth() ? 'other' : ''} ${k === today ? 'today' : ''} ${sel ? 'sel' : ''} ${inRange(k) && !sel ? 'range' : ''}`}
              onClick={() => pickDay(k)}
            >
              {d.getDate()}
            </div>
          );
        })}
      </div>
      <div className="dp-options">
        {allowRange && (
          <div className="menu-item" onClick={() => {
            const nm = !endMode;
            setEndMode(nm);
            if (!nm && v.start) onChange({ start: v.start, time: v.time });
            else if (nm && v.start) {
              onChange({ start: v.start, end: v.start, time: v.time });
              setEditing('end');
            }
          }}>
            <div className="menu-item-body"><div className="menu-item-label">End date</div></div>
            <Toggle on={endMode} />
          </div>
        )}
        <div className="menu-item" onClick={() => {
          if (!v.start) return;
          const time = !v.time;
          const fix = (s?: string) => (s ? (time ? s.slice(0, 10) + 'T09:00' : s.slice(0, 10)) : undefined);
          onChange({ start: fix(v.start)!, end: fix(v.end), time });
        }}>
          <div className="menu-item-body"><div className="menu-item-label">Include time</div></div>
          <Toggle on={!!v.time} />
        </div>
        {v.time && v.start && (
          <div className="dp-time-row">
            <input
              type="time"
              className="text-input"
              value={v.start.slice(11, 16) || '09:00'}
              onChange={(e) => onChange({ ...v, start: v.start!.slice(0, 10) + 'T' + e.target.value } as any)}
            />
          </div>
        )}
        <MenuSep />
        <MenuItem label="Clear" onClick={() => onChange(undefined)} />
      </div>
    </div>
  );
}

function DateEditor({ row, prop, anchor, onClose }: EditorProps) {
  const liveRow = useStore((s) => s.blocks[row.id]) ?? row;
  const v = liveRow.props.values?.[prop.id];
  return (
    <Popover anchor={overCell(anchor)} offset={0} onClose={onClose} width={260} className="cell-editor-pop">
      <DatePicker value={v} onChange={(nv) => setValue(row.id, prop.id, nv)} />
    </Popover>
  );
}

function PersonEditor({ row, prop, anchor, onClose }: EditorProps) {
  const liveRow = useStore((s) => s.blocks[row.id]) ?? row;
  const users = useStore((s) => s.users);
  const sel: ID[] = liveRow.props.values?.[prop.id] ?? [];
  const [q, setQ] = useState('');
  const list = Object.values(users).filter((u) => u.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover anchor={overCell(anchor)} offset={0} onClose={onClose} width={300} className="cell-editor-pop">
      <div className="select-editor">
        <div className="select-input-wrap">
          {sel.map((u) => (
            <PersonChip key={u} userId={u} onRemove={() => setValue(row.id, prop.id, sel.filter((x) => x !== u))} />
          ))}
          <input autoFocus className="select-input" placeholder={sel.length ? '' : 'Search for a person...'} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="select-list">
          <div className="menu-header">Select as many as you like</div>
          {list.map((u) => (
            <MenuItem
              key={u.id}
              icon={<Avatar userId={u.id} />}
              label={u.name}
              checked={sel.includes(u.id)}
              onClick={() => setValue(row.id, prop.id, sel.includes(u.id) ? sel.filter((x) => x !== u.id) : [...sel, u.id])}
            />
          ))}
        </div>
      </div>
    </Popover>
  );
}

function FilesEditor({ row, prop, anchor, onClose }: EditorProps) {
  const liveRow = useStore((s) => s.blocks[row.id]) ?? row;
  const files: { name: string; url: string }[] = liveRow.props.values?.[prop.id] ?? [];
  const [tab, setTab] = useState<'upload' | 'link'>('upload');
  const [link, setLink] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <Popover anchor={overCell(anchor)} offset={0} onClose={onClose} width={360} className="cell-editor-pop">
      <div className="files-editor">
        {files.length > 0 && (
          <div className="files-list">
            {files.map((f, i) => (
              <div key={i} className="menu-item">
                <I.PaperclipIcon size={16} />
                <div className="menu-item-body">
                  <a href={f.url} target="_blank" rel="noreferrer" className="menu-item-label">
                    {f.name}
                  </a>
                </div>
                <span className="opt-more" onClick={() => setValue(row.id, prop.id, files.filter((_, j) => j !== i))}>
                  <I.TrashIcon size={14} />
                </span>
              </div>
            ))}
            <MenuSep />
          </div>
        )}
        <div className="tabs-row">
          <div className={`tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>
            Upload
          </div>
          <div className={`tab ${tab === 'link' ? 'active' : ''}`} onClick={() => setTab('link')}>
            Embed link
          </div>
        </div>
        {tab === 'upload' ? (
          <div className="files-body">
            <button className="btn-outline wide" onClick={() => fileRef.current?.click()}>
              Choose a file
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => setValue(row.id, prop.id, [...files, { name: f.name, url: reader.result as string }]);
                reader.readAsDataURL(f);
              }}
            />
            <div className="files-hint">The maximum size per file is 5 MB.</div>
          </div>
        ) : (
          <div className="files-body">
            <input className="text-input" autoFocus placeholder="Paste in https://..." value={link} onChange={(e) => setLink(e.target.value)} />
            <button
              className="btn-primary wide"
              onClick={() => {
                if (!link.trim()) return;
                const name = link.split('/').pop() || link;
                setValue(row.id, prop.id, [...files, { name, url: link.trim() }]);
                setLink('');
              }}
            >
              Embed link
            </button>
          </div>
        )}
      </div>
    </Popover>
  );
}

function RelationEditor({ db, row, prop, anchor, onClose }: EditorProps) {
  const liveRow = useStore((s) => s.blocks[row.id]) ?? row;
  const blocks = useStore((s) => s.blocks);
  const target = prop.relationDb ? blocks[prop.relationDb] : undefined;
  const sel: ID[] = liveRow.props.values?.[prop.id] ?? [];
  const [q, setQ] = useState('');
  void db;
  if (!target)
    return (
      <Popover anchor={overCell(anchor)} onClose={onClose} width={300}>
        <div className="menu">
          <div className="menu-empty">This relation has no database. Edit the property to choose one.</div>
        </div>
      </Popover>
    );
  const rows = target.children.map((c) => blocks[c]).filter((r) => r && !r.props.trashed && (r.props.title ?? '').toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover anchor={overCell(anchor)} offset={0} onClose={onClose} width={320} className="cell-editor-pop">
      <div className="select-editor">
        <div className="select-input-wrap">
          <input autoFocus className="select-input" placeholder="Search for a page..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="select-list">
          <div className="menu-header">In {target.props.title || 'Untitled'}</div>
          {rows.map((r) => (
            <MenuItem
              key={r.id}
              icon={<span className="menu-emoji">{r.props.icon || <I.PageIcon size={16} />}</span>}
              label={r.props.title || 'Untitled'}
              checked={sel.includes(r.id)}
              onClick={() => setValue(row.id, prop.id, sel.includes(r.id) ? sel.filter((x) => x !== r.id) : [...sel, r.id])}
            />
          ))}
          {!rows.length && <div className="menu-empty">No results</div>}
        </div>
      </div>
    </Popover>
  );
}

export function FormulaEditor({ db, row, prop, anchor, onClose }: EditorProps) {
  const [f, setF] = useState(prop.formula ?? '');
  const res = computeFormula(db, row, { ...prop, formula: f });
  return (
    <Popover anchor={overCell(anchor)} onClose={() => { updateSchema(db.id, prop.id, { formula: f }); onClose(); }} width={420}>
      <div className="formula-editor">
        <div className="formula-title">Edit formula</div>
        <textarea
          autoFocus
          className="formula-input"
          value={f}
          placeholder='e.g. prop("Estimate") * 2'
          onChange={(e) => setF(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              updateSchema(db.id, prop.id, { formula: f });
              onClose();
            }
          }}
        />
        <div className={`formula-result ${res.error ? 'error' : ''}`}>{res.error ? res.error : `= ${formulaToString(res.value)}`}</div>
        <div className="formula-help">
          Properties:{' '}
          {Object.values(db.props.schema as Record<ID, PropertySchema>)
            .filter((x) => x.id !== prop.id)
            .map((x) => (
              <span key={x.id} className="formula-prop" onClick={() => setF(f + `prop("${x.name}")`)}>
                {x.name}
              </span>
            ))}
        </div>
        <div className="formula-help">Functions: if, concat, length, round, now, dateBetween, format, toNumber, empty, and, or, not, min, max</div>
        <button className="btn-primary" onClick={() => { updateSchema(db.id, prop.id, { formula: f }); onClose(); }}>
          Done
        </button>
      </div>
    </Popover>
  );
}
