import { useEffect, useRef, useState } from 'react';
import type { Block, ID, PropertySchema, View } from '../../../store/types';
import { useStore } from '../../../store/store';
import * as I from '../../ui/Icons';
import { PropTypeIcon } from '../dbIcons';
import { CellValue, Tag } from '../CellValue';
import { CellEditor } from '../CellEditor';
import { PropertyHeaderMenu, AddPropertyButton, CalcMenu } from '../PropertyMenu';
import { addRow, calculate, CALC_SHORT, groupRows, groupValue, setValue, updateView, visibleProps, type Group } from '../dbUtils';
import { openRow } from '../openRow';
import { RowIcon } from '../RowIcon';

const DEFAULT_W: Partial<Record<string, number>> = { title: 280, checkbox: 110, number: 140 };

export function colWidth(view: View, p: PropertySchema) {
  return view.widths?.[p.id] ?? DEFAULT_W[p.id === 'title' ? 'title' : p.type] ?? 200;
}

export function TableView({ db, view, rows, locked }: { db: Block; view: View; rows: Block[]; locked?: boolean }) {
  const props = visibleProps(db, view);
  const [editing, setEditing] = useState<{ rowId: ID; propId: ID; el: HTMLElement } | null>(null);
  const [headerMenu, setHeaderMenu] = useState<{ prop: PropertySchema; rect: DOMRect } | null>(null);
  const [calcMenu, setCalcMenu] = useState<{ prop: PropertySchema; rect: DOMRect } | null>(null);
  const [widths, setWidths] = useState<Record<ID, number>>({});
  const [selected, setSelected] = useState<ID[]>([]);
  const [dragCol, setDragCol] = useState<ID | null>(null);
  const [dragRow, setDragRow] = useState<ID | null>(null);
  const [dropRow, setDropRow] = useState<{ id: ID; after: boolean } | null>(null);
  const [pendingEdit, setPendingEdit] = useState<ID | null>(null);
  const [limit, setLimit] = useState(view.limit ?? 50);
  const rootRef = useRef<HTMLDivElement>(null);
  const groups = groupRows(db, view, rows);
  const collapsed: string[] = (view as any).collapsedGroups ?? [];
  const w = (p: PropertySchema) => widths[p.id] ?? colWidth(view, p);
  const total = props.reduce((a, p) => a + w(p), 0);
  const wrapAll = !!view.wrapCells;
  const vlines = view.showVerticalLines !== false;

  useEffect(() => setLimit(view.limit ?? 50), [view.limit]);

  // after creating a row via "+ New page", open its title editor
  useEffect(() => {
    if (!pendingEdit) return;
    const el = rootRef.current?.querySelector(`[data-cell="${pendingEdit}:title"]`) as HTMLElement | null;
    if (el) {
      setEditing({ rowId: pendingEdit, propId: 'title', el });
      setPendingEdit(null);
    }
  });

  const startResize = (e: React.MouseEvent, p: PropertySchema) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const w0 = w(p);
    let cur = w0;
    const move = (ev: MouseEvent) => {
      cur = Math.max(p.id === 'title' ? 100 : 60, w0 + ev.clientX - x0);
      setWidths((ws) => ({ ...ws, [p.id]: cur }));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.classList.remove('col-resizing');
      updateView(db.id, view.id, { widths: { ...(view.widths ?? {}), [p.id]: cur } });
      setWidths({});
    };
    document.body.classList.add('col-resizing');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onCellClick = (e: React.MouseEvent<HTMLDivElement>, row: Block, p: PropertySchema) => {
    if (locked) return;
    if (['created_time', 'last_edited_time', 'created_by', 'last_edited_by', 'unique_id', 'rollup'].includes(p.type)) return;
    if (p.type === 'checkbox') {
      setValue(row.id, p.id, !row.props.values?.[p.id]);
      return;
    }
    if ((p.type === 'url' || p.type === 'email' || p.type === 'phone') && (e.target as HTMLElement).closest('a')) return;
    setEditing({ rowId: row.id, propId: p.id, el: e.currentTarget });
  };

  const newRow = (group?: Group) => {
    const values: Record<ID, any> = {};
    if (group && view.groupBy) {
      const gp = db.props.schema[view.groupBy] as PropertySchema;
      const v = groupValue(gp, group.key, undefined);
      if (v !== undefined) values[gp.id] = v;
    }
    const id = addRow(db.id, values);
    setPendingEdit(id);
  };

  const reorderCols = (target: ID) => {
    if (!dragCol || dragCol === target) return;
    const order = props.map((p) => p.id).filter((x) => x !== dragCol);
    const all = [...(view.propOrder ?? [])].filter((x) => !order.includes(x) && x !== dragCol);
    order.splice(order.indexOf(target), 0, dragCol);
    updateView(db.id, view.id, { propOrder: [...order, ...all] });
    setDragCol(null);
  };

  const dropRowOn = () => {
    if (!dragRow || !dropRow || dragRow === dropRow.id) return;
    const children = db.children.filter((c) => c !== dragRow);
    const idx = children.indexOf(dropRow.id) + (dropRow.after ? 1 : 0);
    const st = useStore.getState();
    st.batch(() => {
      st.moveBlock(dragRow, db.id, idx + (db.children.indexOf(dragRow) <= idx ? 1 : 0));
      if (view.sorts.length) updateView(db.id, view.id, { sorts: [] });
      // moving across groups updates group value
      if (view.groupBy) {
        const gp = db.props.schema[view.groupBy] as PropertySchema;
        const target = st.blocks[dropRow.id];
        if (gp && target && gp.type !== 'multi_select') setValue(dragRow, gp.id, target.props.values?.[gp.id]);
      }
    });
    setDragRow(null);
    setDropRow(null);
  };

  const renderRow = (row: Block) => {
    const isSel = selected.includes(row.id);
    return (
      <div
        key={row.id}
        className={`db-row ${isSel ? 'selected' : ''} ${dropRow?.id === row.id ? (dropRow.after ? 'drop-after' : 'drop-before') : ''} ${dragRow === row.id ? 'dragging' : ''}`}
        onDragOver={(e) => {
          if (!dragRow) return;
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          setDropRow({ id: row.id, after: e.clientY > r.top + r.height / 2 });
        }}
        onDrop={(e) => {
          e.preventDefault();
          dropRowOn();
        }}
      >
        {!locked && (
          <div className="db-row-gutter">
            <span
              className="db-row-drag"
              draggable
              onDragStart={(e) => {
                setDragRow(row.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', row.props.title ?? '');
              }}
              onDragEnd={() => {
                setDragRow(null);
                setDropRow(null);
              }}
              onClick={() => openRow(view, row.id)}
              title="Drag to move · Click to open"
            >
              <I.DragIcon size={14} />
            </span>
            <span
              className={`db-row-check ${isSel ? 'on' : ''}`}
              onClick={() => setSelected((s) => (s.includes(row.id) ? s.filter((x) => x !== row.id) : [...s, row.id]))}
            >
              {isSel && <I.CheckIcon size={10} style={{ strokeWidth: 2.6 }} />}
            </span>
          </div>
        )}
        {props.map((p, i) => {
          const wrap = wrapAll || !!p.wrap;
          return (
            <div
              key={p.id}
              data-cell={`${row.id}:${p.id}`}
              className={`db-cell type-${p.type} ${wrap ? 'wrap' : ''} ${vlines && i > 0 ? 'vline' : ''} ${editing?.rowId === row.id && editing.propId === p.id ? 'editing' : ''}`}
              style={{ width: w(p) }}
              onClick={(e) => onCellClick(e, row, p)}
            >
              {p.type === 'title' ? (
                <div className="db-title-cell">
                  <RowIcon row={row} size={16} />
                  <span className={`db-title-text ${row.props.title ? '' : 'empty'}`}>{row.props.title || ''}</span>
                  <span
                    className="db-open-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRow(view, row.id);
                    }}
                  >
                    {view.openIn === 'center' ? <I.CenterPeekIcon size={14} /> : view.openIn === 'full' ? <I.ExpandIcon size={12} /> : <I.SidePeekIcon size={14} />}
                    <span>Open</span>
                  </span>
                </div>
              ) : (
                <CellValue db={db} row={row} prop={p} wrap={wrap} />
              )}
            </div>
          );
        })}
        <div className="db-cell filler" />
      </div>
    );
  };

  const calcRow = (list: Block[]) => (
    <div className="db-calc-row">
      {!locked && <div className="db-row-gutter" />}
      {props.map((p, i) => {
        const c = view.calcs?.[p.id] ?? 'none';
        const val = c !== 'none' ? calculate(db, p, list, c) : '';
        return (
          <div key={p.id} className={`db-calc-cell ${c !== 'none' ? 'set' : ''} ${vlines && i > 0 ? '' : ''}`} style={{ width: w(p) }} onClick={(e) => setCalcMenu({ prop: p, rect: e.currentTarget.getBoundingClientRect() })}>
            {c === 'none' ? (
              <span className="calc-placeholder">
                Calculate <I.ChevronDown size={11} />
              </span>
            ) : (
              <>
                <span className="calc-label">{CALC_SHORT[c]}</span>
                <span className="calc-value">{val}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  const header = (
    <div className="db-thead">
      {!locked && (
        <div className="db-row-gutter head">
          {selected.length > 0 || rows.length > 0 ? (
            <span
              className={`db-row-check ${selected.length && selected.length === rows.length ? 'on' : selected.length ? 'partial' : ''}`}
              onClick={() => setSelected(selected.length === rows.length ? [] : rows.map((r) => r.id))}
            >
              {selected.length > 0 && selected.length === rows.length && <I.CheckIcon size={10} style={{ strokeWidth: 2.6 }} />}
              {selected.length > 0 && selected.length < rows.length && <span className="partial-bar" />}
            </span>
          ) : null}
        </div>
      )}
      {props.map((p, i) => (
        <div
          key={p.id}
          className={`db-th ${vlines && i > 0 ? 'vline' : ''} ${dragCol === p.id ? 'dragging' : ''}`}
          style={{ width: w(p) }}
          draggable={!locked}
          onDragStart={(e) => {
            setDragCol(p.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => dragCol && e.preventDefault()}
          onDrop={() => reorderCols(p.id)}
          onDragEnd={() => setDragCol(null)}
          onClick={(e) => !locked && setHeaderMenu({ prop: p, rect: e.currentTarget.getBoundingClientRect() })}
        >
          <span className="db-th-icon">
            <PropTypeIcon type={p.type} size={14} />
          </span>
          <span className="db-th-name">{p.name}</span>
          {!locked && <span className="db-th-resize" onMouseDown={(e) => startResize(e, p)} onClick={(e) => e.stopPropagation()} />}
        </div>
      ))}
      {!locked && <AddPropertyButton db={db} view={view} className="db-th add" />}
      <div className="db-th filler" />
    </div>
  );

  const newRowEl = (group?: Group) =>
    !locked && (
      <div className="db-new-row" onClick={() => newRow(group)}>
        <I.PlusIcon size={14} />
        <span>New page</span>
      </div>
    );

  const liveRows = rows.slice(0, limit);

  return (
    <div className="db-table-wrap" ref={rootRef}>
      {selected.length > 0 && (
        <div className="db-bulk-bar">
          <span className="bulk-count">{selected.length} selected</span>
          <span
            className="bulk-btn"
            onClick={() => {
              const st = useStore.getState();
              st.batch(() => selected.forEach((id) => st.duplicateBlock(id)));
              setSelected([]);
            }}
          >
            <I.DuplicateIcon size={14} /> Duplicate
          </span>
          <span
            className="bulk-btn danger"
            onClick={() => {
              const st = useStore.getState();
              st.batch(() => selected.forEach((id) => st.trashPage(id)));
              setSelected([]);
            }}
          >
            <I.TrashIcon size={14} /> Delete
          </span>
          <span className="bulk-btn" onClick={() => setSelected([])}>
            <I.CloseIcon size={14} />
          </span>
        </div>
      )}
      <div className="db-table-scroll">
        <div className="db-table" style={{ minWidth: total + 32 + 34 }}>
          {header}
          {groups ? (
            groups
              .filter((g) => !((view as any).hideEmptyGroups && !g.rows.length) && !(g.key === '__none' && !g.rows.length))
              .map((g) => {
                const isCollapsed = collapsed.includes(g.key);
                return (
                  <div key={g.key} className="db-table-group">
                    <div className="db-group-head">
                      <span
                        className={`group-toggle ${isCollapsed ? '' : 'open'}`}
                        onClick={() => updateView(db.id, view.id, { collapsedGroups: isCollapsed ? collapsed.filter((x) => x !== g.key) : [...collapsed, g.key] } as any)}
                      >
                        <I.TriangleRight size={10} />
                      </span>
                      {g.option ? <Tag name={g.label} color={g.color} status={(db.props.schema[view.groupBy!] as PropertySchema)?.type === 'status'} /> : <span className="group-label">{g.label}</span>}
                      <span className="group-count">{g.rows.length}</span>
                    </div>
                    {!isCollapsed && (
                      <>
                        {g.rows.map(renderRow)}
                        {newRowEl(g)}
                        {calcRow(g.rows)}
                      </>
                    )}
                  </div>
                );
              })
          ) : (
            <>
              {liveRows.map(renderRow)}
              {rows.length > limit && (
                <div className="db-load-more" onClick={() => setLimit(limit + (view.limit ?? 50))}>
                  Load more
                </div>
              )}
              {newRowEl()}
              {calcRow(rows)}
            </>
          )}
        </div>
      </div>
      {editing &&
        (() => {
          const row = useStore.getState().blocks[editing.rowId];
          const p = db.props.schema[editing.propId] as PropertySchema;
          if (!row || !p) return null;
          return <CellEditor db={db} row={row} prop={p} anchor={editing.el} onClose={() => setEditing(null)} />;
        })()}
      {headerMenu && <PropertyHeaderMenu db={db} view={view} prop={headerMenu.prop} anchor={headerMenu.rect} onClose={() => setHeaderMenu(null)} />}
      {calcMenu && <CalcMenu db={db} view={view} prop={calcMenu.prop} anchor={calcMenu.rect} onClose={() => setCalcMenu(null)} />}
    </div>
  );
}
