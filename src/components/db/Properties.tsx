import { useState } from 'react';
import type { ID, PropertySchema, View } from '../../store/types';
import { useStore } from '../../store/store';
import * as I from '../ui/Icons';
import { PropTypeIcon } from './dbIcons';
import { CellValue } from './CellValue';
import { CellEditor } from './CellEditor';
import { PropertyHeaderMenu, TypePicker, EditPropertyPanel } from './PropertyMenu';
import { addProperty, computeValue, isEmptyValue, setValue } from './dbUtils';

const READONLY = ['created_time', 'last_edited_time', 'created_by', 'last_edited_by', 'unique_id', 'rollup'];

export function PageProperties({ pageId }: { pageId: ID }) {
  const row = useStore((s) => s.blocks[pageId]);
  const db = useStore((s) => (row?.parent ? s.blocks[row.parent] : undefined));
  useStore((s) => s.blocks); // re-render on related changes (formulas, relations)
  const [editing, setEditing] = useState<{ propId: ID; el: HTMLElement } | null>(null);
  const [nameMenu, setNameMenu] = useState<{ prop: PropertySchema; rect: DOMRect } | null>(null);
  const [adding, setAdding] = useState<DOMRect | null>(null);
  const [editNew, setEditNew] = useState<{ id: ID; rect: DOMRect } | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  if (!row || !db || db.type !== 'database') return null;
  const view = (db.props.views as View[])[0];
  const schema = db.props.schema as Record<ID, PropertySchema>;
  const order = [...(view?.propOrder ?? [])].filter((k) => schema[k]);
  Object.keys(schema).forEach((k) => !order.includes(k) && order.push(k));
  const props = order.map((k) => schema[k]).filter((p) => p.type !== 'title');
  const hideEmpty = (db.props.hideEmptyProps as ID[] | undefined) ?? [];
  const visible = props.filter((p) => showHidden || !(hideEmpty.includes(p.id) && isEmptyValue(p, computeValue(db, row, p))));
  const hiddenCount = props.length - visible.length;
  const locked = !!db.props.locked;

  return (
    <div className="page-props">
      {visible.map((p) => {
        const v = computeValue(db, row, p);
        const empty = isEmptyValue(p, v) && p.type !== 'checkbox';
        const ro = READONLY.includes(p.type) || locked;
        return (
          <div key={p.id} className="page-prop-row">
            <div className="page-prop-name" onClick={(e) => !locked && setNameMenu({ prop: p, rect: e.currentTarget.getBoundingClientRect() })}>
              <span className="page-prop-icon">
                <PropTypeIcon type={p.type} size={16} />
              </span>
              <span className="page-prop-label">{p.name}</span>
            </div>
            <div
              className={`page-prop-value type-${p.type} ${ro ? 'readonly' : ''} ${editing?.propId === p.id ? 'editing' : ''}`}
              onClick={(e) => {
                if (ro) return;
                if ((e.target as HTMLElement).closest('a')) return;
                if (p.type === 'checkbox') {
                  setValue(row.id, p.id, !v);
                  return;
                }
                setEditing({ propId: p.id, el: e.currentTarget });
              }}
            >
              {empty ? <span className="page-prop-empty">Empty</span> : <CellValue db={db} row={row} prop={p} wrap />}
            </div>
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <div className="page-prop-more" onClick={() => setShowHidden(true)}>
          <I.ChevronDown size={14} /> {hiddenCount} more {hiddenCount === 1 ? 'property' : 'properties'}
        </div>
      )}
      {!locked && (
        <div className="page-prop-add" onClick={(e) => setAdding(e.currentTarget.getBoundingClientRect())}>
          <I.PlusIcon size={16} />
          <span>Add a property</span>
        </div>
      )}
      {editing &&
        (() => {
          const p = schema[editing.propId];
          if (!p) return null;
          return <CellEditor db={db} row={row} prop={p} anchor={editing.el} onClose={() => setEditing(null)} />;
        })()}
      {nameMenu && view && <PropertyHeaderMenu db={db} view={view} prop={nameMenu.prop} anchor={nameMenu.rect} onClose={() => setNameMenu(null)} />}
      {adding && (
        <TypePicker
          anchor={adding}
          title="Select type"
          onClose={() => setAdding(null)}
          onPick={(t) => {
            const id = addProperty(db.id, t);
            setEditNew({ id, rect: adding });
            setAdding(null);
          }}
        />
      )}
      {editNew && <EditPropertyPanel dbId={db.id} propId={editNew.id} anchor={editNew.rect} onClose={() => setEditNew(null)} />}
    </div>
  );
}
