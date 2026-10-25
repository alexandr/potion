import { useState } from 'react';
import type { Block, ID, PropertySchema, PropType, SelectOption, View } from '../../store/types';
import { useStore, uid } from '../../store/store';
import { Popover, MenuItem, MenuHeader, MenuSep, Toggle, type Anchor } from '../ui/Popover';
import * as I from '../ui/Icons';
import { PropTypeIcon } from './dbIcons';
import {
  addOption,
  addProperty,
  calcsFor,
  changePropType,
  defaultOp,
  deleteProperty,
  duplicateProperty,
  NUMBER_FORMATS,
  PROP_TYPES,
  updateSchema,
  updateView,
  viewProps,
} from './dbUtils';
import { Tag } from './CellValue';
import { OptionMenu } from './CellEditor';

export function TypePicker({ anchor, onClose, onPick, current, placement = 'bottom-start', title = 'Type' }: { anchor: Anchor; onClose: () => void; onPick: (t: PropType) => void; current?: PropType; placement?: 'bottom-start' | 'right-start'; title?: string }) {
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const list = PROP_TYPES.filter((t) => t.label.toLowerCase().includes(q.toLowerCase()));
  const basic = list.filter((t) => !['created_time', 'created_by', 'last_edited_time', 'last_edited_by', 'unique_id', 'formula', 'relation', 'rollup'].includes(t.type));
  const adv = list.filter((t) => !basic.includes(t));
  return (
    <Popover anchor={anchor} onClose={onClose} width={260} placement={placement}>
      <div className="menu type-picker">
        <div className="menu-input-row">
          <input
            autoFocus
            className="text-input"
            placeholder="Search for a property type"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setHi(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHi((h) => Math.min(list.length - 1, h + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHi((h) => Math.max(0, h - 1));
              } else if (e.key === 'Enter' && list[hi]) {
                e.preventDefault();
                onPick([...basic, ...adv][hi].type);
              }
            }}
          />
        </div>
        <MenuHeader>{title}</MenuHeader>
        {[...basic, ...adv].map((t, i) => (
          <div key={t.type}>
            {i === basic.length && adv.length > 0 && <MenuHeader>Advanced</MenuHeader>}
            <MenuItem icon={<PropTypeIcon type={t.type} />} label={t.label} active={hi === i} checked={current === t.type} onMouseEnter={() => setHi(i)} onClick={() => onPick(t.type)} />
          </div>
        ))}
        {!list.length && <div className="menu-empty">No results</div>}
      </div>
    </Popover>
  );
}

export function AddPropertyButton({ db, view, className, label }: { db: Block; view: View; className?: string; label?: string }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [edit, setEdit] = useState<{ id: ID; rect: DOMRect } | null>(null);
  return (
    <>
      <div className={className ?? 'db-add-prop'} onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}>
        <I.PlusIcon size={16} />
        {label && <span>{label}</span>}
      </div>
      {anchor && (
        <TypePicker
          anchor={anchor}
          onClose={() => setAnchor(null)}
          title="Select type"
          onPick={(t) => {
            const id = addProperty(db.id, t, undefined, view.id);
            const r = anchor;
            setAnchor(null);
            setEdit({ id, rect: r });
          }}
        />
      )}
      {edit && <EditPropertyPanel dbId={db.id} propId={edit.id} anchor={edit.rect} onClose={() => setEdit(null)} />}
    </>
  );
}

export function PropertyHeaderMenu({ db, view, prop, anchor, onClose, onSortChange }: { db: Block; view: View; prop: PropertySchema; anchor: Anchor; onClose: () => void; onSortChange?: () => void }) {
  const [name, setName] = useState(prop.name);
  const [sub, setSub] = useState<null | { kind: 'type' | 'edit' | 'calc'; rect: DOMRect }>(null);
  const isTitle = prop.type === 'title';
  const commitName = () => {
    if (name.trim() && name !== prop.name) updateSchema(db.id, prop.id, { name: name.trim() });
  };
  const close = () => {
    commitName();
    onClose();
  };
  const order = viewProps(db, view).map((p) => p.id);
  const insert = (dir: 0 | 1) => {
    const idx = order.indexOf(prop.id) + dir;
    addProperty(db.id, 'text', undefined, view.id, idx);
    close();
  };
  return (
    <Popover anchor={anchor} onClose={close} width={260}>
      <div className="menu">
        <div className="menu-input-row prop-name-row">
          <div className="prop-type-btn" onClick={(e) => !isTitle && setSub({ kind: 'type', rect: e.currentTarget.getBoundingClientRect() })}>
            <PropTypeIcon type={prop.type} />
          </div>
          <input
            autoFocus
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') close();
            }}
          />
        </div>
        <MenuItem icon={<I.SlidersIcon size={16} />} label="Edit property" onClick={(e) => setSub({ kind: 'edit', rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })} />
        {!isTitle && (
          <MenuItem
            icon={<I.TurnIntoIcon size={16} />}
            label="Change type"
            chevron
            right={<span className="menu-item-value">{PROP_TYPES.find((t) => t.type === prop.type)?.label}</span>}
            onClick={(e) => setSub({ kind: 'type', rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
          />
        )}
        <MenuSep />
        <MenuItem
          icon={<I.FilterIcon size={16} />}
          label="Filter"
          onClick={() => {
            updateView(db.id, view.id, { filters: [...view.filters, { id: uid(6), prop: prop.id, op: defaultOp(prop.type) }] });
            window.dispatchEvent(new CustomEvent('potion-db-open-filter', { detail: { viewId: view.id } }));
            close();
          }}
        />
        <MenuItem
          icon={<I.ArrowUpIcon size={16} />}
          label="Sort ascending"
          onClick={() => {
            updateView(db.id, view.id, { sorts: [{ id: uid(6), prop: prop.id, dir: 'asc' }] });
            onSortChange?.();
            close();
          }}
        />
        <MenuItem
          icon={<I.ArrowDownIcon size={16} />}
          label="Sort descending"
          onClick={() => {
            updateView(db.id, view.id, { sorts: [{ id: uid(6), prop: prop.id, dir: 'desc' }] });
            onSortChange?.();
            close();
          }}
        />
        {['select', 'status', 'multi_select', 'person', 'checkbox', 'text'].includes(prop.type) && (
          <MenuItem icon={<I.GroupIcon size={16} />} label={view.groupBy === prop.id ? 'Ungroup' : 'Group'} onClick={() => { updateView(db.id, view.id, { groupBy: view.groupBy === prop.id ? null : prop.id }); close(); }} />
        )}
        {view.type === 'table' && (
          <MenuItem icon={<I.ChartIcon size={16} />} label="Calculate" chevron onClick={(e) => setSub({ kind: 'calc', rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })} />
        )}
        <MenuSep />
        {!isTitle && (
          <MenuItem icon={<I.EyeOffIcon size={16} />} label="Hide" onClick={() => { updateView(db.id, view.id, { hidden: [...(view.hidden ?? []), prop.id] }); close(); }} />
        )}
        {view.type === 'table' && (
          <MenuItem
            icon={<I.WrapIcon size={16} />}
            label="Wrap column"
            right={<Toggle on={!!prop.wrap} />}
            onClick={() => updateSchema(db.id, prop.id, { wrap: !prop.wrap })}
          />
        )}
        {view.type === 'table' && (
          <>
            <MenuItem icon={<I.ArrowLeftIcon size={16} />} label="Insert left" onClick={() => insert(0)} />
            <MenuItem icon={<I.ArrowRightIcon size={16} />} label="Insert right" onClick={() => insert(1)} />
          </>
        )}
        {!isTitle && (
          <>
            <MenuItem icon={<I.DuplicateIcon size={16} />} label="Duplicate property" onClick={() => { duplicateProperty(db.id, prop.id, view.id); close(); }} />
            <MenuItem icon={<I.TrashIcon size={16} />} label="Delete property" danger onClick={() => { deleteProperty(db.id, prop.id); onClose(); }} />
          </>
        )}
      </div>
      {sub?.kind === 'type' && (
        <TypePicker
          anchor={sub.rect}
          placement="right-start"
          current={prop.type}
          onClose={() => setSub(null)}
          onPick={(t) => {
            changePropType(db.id, prop.id, t);
            setSub(null);
            onClose();
          }}
        />
      )}
      {sub?.kind === 'edit' && <EditPropertyPanel dbId={db.id} propId={prop.id} anchor={sub.rect} onClose={() => { setSub(null); onClose(); }} placement="right-start" />}
      {sub?.kind === 'calc' && <CalcMenu db={db} view={view} prop={prop} anchor={sub.rect} onClose={() => setSub(null)} placement="right-start" />}
    </Popover>
  );
}

export function CalcMenu({ db, view, prop, anchor, onClose, placement = 'top-start' }: { db: Block; view: View; prop: PropertySchema; anchor: Anchor; onClose: () => void; placement?: 'top-start' | 'right-start' | 'bottom-start' }) {
  const cur = view.calcs?.[prop.id] ?? 'none';
  const list = calcsFor(prop.type);
  const groups: [string, string[]][] = [
    ['', ['none']],
    ['Count', ['count', 'count_values', 'count_unique', 'count_empty', 'count_not_empty', 'percent_empty', 'percent_not_empty']],
    ['More options', ['sum', 'average', 'median', 'min', 'max', 'range', 'earliest', 'latest', 'date_range', 'checked', 'unchecked', 'percent_checked', 'percent_unchecked']],
  ];
  return (
    <Popover anchor={anchor} onClose={onClose} width={220} placement={placement}>
      <div className="menu">
        {groups.map(([g, ids]) => {
          const items = list.filter((c) => ids.includes(c.id));
          if (!items.length) return null;
          return (
            <div key={g || 'none'}>
              {g && <MenuHeader>{g}</MenuHeader>}
              {items.map((c) => (
                <MenuItem
                  key={c.id}
                  label={c.label}
                  checked={cur === c.id}
                  onClick={() => {
                    updateView(db.id, view.id, { calcs: { ...(view.calcs ?? {}), [prop.id]: c.id } });
                    onClose();
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
    </Popover>
  );
}

export function EditPropertyPanel({ dbId, propId, anchor, onClose, placement = 'bottom-start' }: { dbId: ID; propId: ID; anchor: Anchor; onClose: () => void; placement?: 'bottom-start' | 'right-start' }) {
  const db = useStore((s) => s.blocks[dbId]);
  const blocks = useStore((s) => s.blocks);
  const prop = db?.props.schema[propId] as PropertySchema | undefined;
  const [name, setName] = useState(prop?.name ?? '');
  const [typeAnchor, setTypeAnchor] = useState<DOMRect | null>(null);
  const [newOpt, setNewOpt] = useState<string | null>(null);
  const [optMenu, setOptMenu] = useState<{ opt: SelectOption; rect: DOMRect } | null>(null);
  if (!db || !prop) return null;
  const commit = () => {
    if (name.trim() && name !== prop.name) updateSchema(dbId, propId, { name: name.trim() });
  };
  const dbs = Object.values(blocks).filter((b) => b.type === 'database' && !b.props.trashed && !b.props.linkedDb);
  const relProps = Object.values(db.props.schema as Record<ID, PropertySchema>).filter((p) => p.type === 'relation');
  const rollupTarget = prop.rollup?.relationProp ? blocks[(db.props.schema[prop.rollup.relationProp] as PropertySchema)?.relationDb ?? ''] : undefined;

  const optionRow = (o: SelectOption) => (
    <div key={o.id} className="menu-item select-opt" onClick={(e) => setOptMenu({ opt: o, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}>
      <span className="opt-drag">
        <I.DragIcon size={14} />
      </span>
      <div className="menu-item-body">
        <Tag name={o.name} color={o.color} status={prop.type === 'status'} />
      </div>
      <I.ChevronRight size={14} style={{ color: 'var(--icon)' }} />
    </div>
  );

  return (
    <Popover anchor={anchor} onClose={() => { commit(); onClose(); }} width={290} placement={placement}>
      <div className="menu edit-prop">
        <div className="edit-prop-head">
          <span>Edit property</span>
        </div>
        <div className="menu-input-row prop-name-row">
          <div className="prop-type-btn">
            <PropTypeIcon type={prop.type} />
          </div>
          <input autoFocus className="text-input" value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
        </div>
        {prop.type !== 'title' && (
          <MenuItem
            label="Type"
            right={
              <span className="menu-item-value">
                <PropTypeIcon type={prop.type} size={14} /> {PROP_TYPES.find((t) => t.type === prop.type)?.label}
              </span>
            }
            chevron
            onClick={(e) => setTypeAnchor((e.currentTarget as HTMLElement).getBoundingClientRect())}
          />
        )}
        {prop.type === 'number' && (
          <>
            <MenuHeader>Number format</MenuHeader>
            {NUMBER_FORMATS.map((f) => (
              <MenuItem key={f.id} label={f.label} checked={(prop.numberFormat ?? 'number') === f.id} onClick={() => updateSchema(dbId, propId, { numberFormat: f.id })} />
            ))}
          </>
        )}
        {(prop.type === 'select' || prop.type === 'multi_select') && (
          <>
            <div className="menu-header with-action">
              <span>Options</span>
              <span className="header-action" onClick={() => setNewOpt('')}>
                <I.PlusIcon size={14} />
              </span>
            </div>
            {newOpt !== null && (
              <div className="menu-input-row">
                <input
                  autoFocus
                  className="text-input"
                  placeholder="Type a new option…"
                  value={newOpt}
                  onChange={(e) => setNewOpt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newOpt.trim()) {
                      addOption(dbId, propId, newOpt.trim());
                      setNewOpt('');
                    }
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setNewOpt(null);
                    }
                  }}
                  onBlur={() => setNewOpt(null)}
                />
              </div>
            )}
            {(prop.options ?? []).map(optionRow)}
            {!(prop.options ?? []).length && newOpt === null && <div className="menu-empty">No options yet</div>}
          </>
        )}
        {prop.type === 'status' &&
          (
            [
              ['todo', 'To-do'],
              ['in_progress', 'In progress'],
              ['complete', 'Complete'],
            ] as const
          ).map(([g, label]) => (
            <div key={g}>
              <div className="menu-header with-action">
                <span>{label}</span>
                <span className="header-action" onClick={() => addOption(dbId, propId, `New ${label.toLowerCase()}`, g === 'complete' ? 'green' : g === 'in_progress' ? 'blue' : 'default', g)}>
                  <I.PlusIcon size={14} />
                </span>
              </div>
              {(prop.options ?? []).filter((o) => (o.group ?? 'todo') === g).map(optionRow)}
            </div>
          ))}
        {prop.type === 'formula' && (
          <div className="edit-prop-section">
            <MenuHeader>Formula</MenuHeader>
            <textarea className="formula-input" defaultValue={prop.formula ?? ''} placeholder='prop("Estimate") * 2' onBlur={(e) => updateSchema(dbId, propId, { formula: e.target.value })} />
          </div>
        )}
        {prop.type === 'relation' && (
          <>
            <MenuHeader>Related to</MenuHeader>
            {dbs.map((d) => (
              <MenuItem key={d.id} icon={<span className="menu-emoji">{d.props.icon || <I.TableIcon size={16} />}</span>} label={d.props.title || 'Untitled'} checked={prop.relationDb === d.id} onClick={() => updateSchema(dbId, propId, { relationDb: d.id })} />
            ))}
          </>
        )}
        {prop.type === 'rollup' && (
          <>
            <MenuHeader>Relation</MenuHeader>
            {relProps.length === 0 && <div className="menu-empty">Add a relation property first</div>}
            {relProps.map((r) => (
              <MenuItem key={r.id} label={r.name} checked={prop.rollup?.relationProp === r.id} onClick={() => updateSchema(dbId, propId, { rollup: { relationProp: r.id, targetProp: 'title', fn: prop.rollup?.fn ?? 'show_original' } })} />
            ))}
            {rollupTarget && (
              <>
                <MenuHeader>Property</MenuHeader>
                {Object.values(rollupTarget.props.schema as Record<ID, PropertySchema>).map((tp) => (
                  <MenuItem key={tp.id} icon={<PropTypeIcon type={tp.type} />} label={tp.name} checked={prop.rollup?.targetProp === tp.id} onClick={() => updateSchema(dbId, propId, { rollup: { ...prop.rollup!, targetProp: tp.id } })} />
                ))}
                <MenuHeader>Calculate</MenuHeader>
                {[
                  ['show_original', 'Show original'],
                  ['count', 'Count all'],
                  ['sum', 'Sum'],
                  ['average', 'Average'],
                  ['min', 'Min'],
                  ['max', 'Max'],
                ].map(([id, l]) => (
                  <MenuItem key={id} label={l} checked={(prop.rollup?.fn ?? 'show_original') === id} onClick={() => updateSchema(dbId, propId, { rollup: { ...prop.rollup!, fn: id } })} />
                ))}
              </>
            )}
          </>
        )}
        {prop.type === 'unique_id' && (
          <div className="edit-prop-section">
            <MenuHeader>Prefix</MenuHeader>
            <div className="menu-input-row">
              <input className="text-input" placeholder="Type a prefix" defaultValue={prop.prefix ?? ''} onBlur={(e) => updateSchema(dbId, propId, { prefix: e.target.value.trim() })} />
            </div>
          </div>
        )}
        {prop.type !== 'title' && (
          <>
            <MenuSep />
            <MenuItem icon={<I.DuplicateIcon size={16} />} label="Duplicate property" onClick={() => { const v = (db.props.views as View[])[0]; duplicateProperty(dbId, propId, v.id); onClose(); }} />
            <MenuItem icon={<I.TrashIcon size={16} />} label="Delete property" danger onClick={() => { deleteProperty(dbId, propId); onClose(); }} />
          </>
        )}
      </div>
      {typeAnchor && (
        <TypePicker
          anchor={typeAnchor}
          placement="right-start"
          current={prop.type}
          onClose={() => setTypeAnchor(null)}
          onPick={(t) => {
            changePropType(dbId, propId, t);
            setTypeAnchor(null);
          }}
        />
      )}
      {optMenu && <OptionMenu db={db} prop={prop} opt={optMenu.opt} anchor={optMenu.rect} onClose={() => setOptMenu(null)} />}
    </Popover>
  );
}
