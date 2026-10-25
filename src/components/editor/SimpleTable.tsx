import { useRef, useState } from 'react';
import { useStore } from '../../store/store';
import type { Block } from '../../store/types';
import { Editable } from './Editable';
import { Popover, MenuItem, MenuSep, Toggle } from '../ui/Popover';
import * as I from '../ui/Icons';
import { getCaretOffset, isCaretAtEnd, isCaretAtStart } from '../../lib/dom';
import { setCaret } from '../../lib/dom';

export function SimpleTable({ b }: { b: Block }) {
  const rows: string[][] = b.props.rows ?? [['', '', ''], ['', '', ''], ['', '', '']];
  const widths: number[] = b.props.colWidths ?? [];
  const s = useStore.getState;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ kind: 'row' | 'col'; index: number; rect: DOMRect } | null>(null);
  const [opts, setOpts] = useState<DOMRect | null>(null);
  const ncols = Math.max(...rows.map((r) => r.length), 1);

  const update = (next: string[][], key?: string) => s().setProps(b.id, { rows: next }, key);
  const setCell = (r: number, c: number, html: string) => {
    const cur = useStore.getState().blocks[b.id]?.props.rows ?? rows;
    const next = cur.map((row: string[]) => [...row]);
    while (next[r].length < ncols) next[r].push('');
    next[r][c] = html;
    update(next, `cell:${b.id}:${r}:${c}`);
  };
  const addRow = (at = rows.length) => {
    const next = rows.map((r) => [...r]);
    next.splice(at, 0, Array(ncols).fill(''));
    update(next);
  };
  const addCol = (at = ncols) => {
    update(rows.map((r) => { const n = [...r]; n.splice(at, 0, ''); return n; }));
    const w = [...widths];
    w.splice(at, 0, 120);
    s().setProps(b.id, { colWidths: w });
  };
  const focusCell = (r: number, c: number, where: 'start' | 'end' = 'end') => {
    const el = wrapRef.current?.querySelector(`[data-cell="${r}-${c}"]`) as HTMLElement | null;
    if (el) {
      el.focus();
      setCaret(el, where);
    }
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>, r: number, c: number) => {
    const el = e.currentTarget;
    if (e.key === 'Tab') {
      e.preventDefault();
      let nr = r;
      let nc = c + (e.shiftKey ? -1 : 1);
      if (nc >= ncols) { nc = 0; nr++; }
      if (nc < 0) { nc = ncols - 1; nr--; }
      if (nr >= rows.length) { addRow(); setTimeout(() => focusCell(nr, nc), 30); return; }
      if (nr >= 0) focusCell(nr, nc);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (r + 1 >= rows.length) { addRow(); setTimeout(() => focusCell(r + 1, c), 30); }
      else focusCell(r + 1, c);
    } else if (e.key === 'ArrowUp' && r > 0 && getCaretOffset(el) === 0) {
      e.preventDefault();
      focusCell(r - 1, c);
    } else if (e.key === 'ArrowDown' && r + 1 < rows.length && isCaretAtEnd(el)) {
      e.preventDefault();
      focusCell(r + 1, c);
    } else if (e.key === 'ArrowLeft' && c > 0 && isCaretAtStart(el)) {
      e.preventDefault();
      focusCell(r, c - 1, 'end');
    } else if (e.key === 'ArrowRight' && c + 1 < ncols && isCaretAtEnd(el)) {
      e.preventDefault();
      focusCell(r, c + 1, 'start');
    }
  };
  const resize = (e: React.MouseEvent, c: number) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = widths[c] ?? 120;
    const move = (ev: MouseEvent) => {
      const w = [...(useStore.getState().blocks[b.id].props.colWidths ?? [])];
      while (w.length < ncols) w.push(120);
      w[c] = Math.max(32, w0 + ev.clientX - x0);
      useStore.setState((st) => ({ blocks: { ...st.blocks, [b.id]: { ...st.blocks[b.id], props: { ...st.blocks[b.id].props, colWidths: w } } } }));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    s().checkpoint();
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="simple-table-wrap" ref={wrapRef}>
      <div className="simple-table-scroll">
        <table className={`simple-table ${b.props.hasHeaderRow ? 'header-row' : ''} ${b.props.hasHeaderColumn ? 'header-col' : ''}`}>
          <colgroup>
            {Array.from({ length: ncols }).map((_, c) => (
              <col key={c} style={{ width: widths[c] ?? 120 }} />
            ))}
          </colgroup>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: ncols }).map((_, c) => (
                  <td key={c} className={`${(b.props.hasHeaderRow && r === 0) || (b.props.hasHeaderColumn && c === 0) ? 'th' : ''}`}>
                    {r === 0 && (
                      <div className="col-handle" onMouseDown={(e) => e.preventDefault()} onClick={(e) => setMenu({ kind: 'col', index: c, rect: e.currentTarget.getBoundingClientRect() })}>
                        <I.DotsIcon size={12} />
                      </div>
                    )}
                    {c === 0 && (
                      <div className="row-handle" onMouseDown={(e) => e.preventDefault()} onClick={(e) => setMenu({ kind: 'row', index: r, rect: e.currentTarget.getBoundingClientRect() })}>
                        <I.DragIcon size={12} />
                      </div>
                    )}
                    <Editable
                      id={undefined}
                      className="table-cell-edit"
                      html={row[c] ?? ''}
                      onChange={(h) => setCell(r, c, h)}
                      onKeyDown={(e) => onKey(e, r, c)}
                    />
                    <div data-cell-ref="" />
                    <div className="col-resizer" onMouseDown={(e) => resize(e, c)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-add-col" onClick={() => addCol()} title="Add column">
          <I.PlusIcon size={14} />
        </div>
      </div>
      <div className="table-add-row" onClick={() => addRow()} title="Add row">
        <I.PlusIcon size={14} />
      </div>
      <div className="table-options" onClick={(e) => setOpts(e.currentTarget.getBoundingClientRect())}>
        <I.SlidersIcon size={14} />
      </div>
      {opts && (
        <Popover anchor={opts} onClose={() => setOpts(null)} width={240} placement="bottom-end">
          <div className="menu">
            <MenuItem label="Header row" right={<Toggle on={!!b.props.hasHeaderRow} onChange={(v) => s().setProps(b.id, { hasHeaderRow: v })} />} onClick={() => s().setProps(b.id, { hasHeaderRow: !b.props.hasHeaderRow })} />
            <MenuItem label="Header column" right={<Toggle on={!!b.props.hasHeaderColumn} onChange={(v) => s().setProps(b.id, { hasHeaderColumn: v })} />} onClick={() => s().setProps(b.id, { hasHeaderColumn: !b.props.hasHeaderColumn })} />
          </div>
        </Popover>
      )}
      {menu && (
        <Popover anchor={menu.rect} onClose={() => setMenu(null)} width={220}>
          <div className="menu">
            {menu.kind === 'row' ? (
              <>
                <MenuItem icon={<I.ArrowUpIcon size={16} />} label="Insert above" onClick={() => { addRow(menu.index); setMenu(null); }} />
                <MenuItem icon={<I.ArrowDownIcon size={16} />} label="Insert below" onClick={() => { addRow(menu.index + 1); setMenu(null); }} />
                <MenuItem icon={<I.DuplicateIcon size={16} />} label="Duplicate" onClick={() => { const n = rows.map((x) => [...x]); n.splice(menu.index + 1, 0, [...rows[menu.index]]); update(n); setMenu(null); }} />
                <MenuItem icon={<I.CloseIcon size={16} />} label="Clear contents" onClick={() => { const n = rows.map((x) => [...x]); n[menu.index] = n[menu.index].map(() => ''); update(n); setMenu(null); }} />
                <MenuSep />
                <MenuItem icon={<I.TrashIcon size={16} />} label="Delete row" danger onClick={() => { if (rows.length > 1) update(rows.filter((_, i) => i !== menu.index)); setMenu(null); }} />
              </>
            ) : (
              <>
                <MenuItem icon={<I.ArrowLeftIcon size={16} />} label="Insert left" onClick={() => { addCol(menu.index); setMenu(null); }} />
                <MenuItem icon={<I.ArrowRightIcon size={16} />} label="Insert right" onClick={() => { addCol(menu.index + 1); setMenu(null); }} />
                <MenuItem icon={<I.CloseIcon size={16} />} label="Clear contents" onClick={() => { update(rows.map((x) => x.map((v, i) => (i === menu.index ? '' : v)))); setMenu(null); }} />
                <MenuSep />
                <MenuItem icon={<I.TrashIcon size={16} />} label="Delete column" danger onClick={() => { if (ncols > 1) update(rows.map((x) => x.filter((_, i) => i !== menu.index))); setMenu(null); }} />
              </>
            )}
          </div>
        </Popover>
      )}
    </div>
  );
}
