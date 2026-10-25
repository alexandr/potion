import { useState } from 'react';
import type { Block, ID, PropertySchema, View } from '../../../store/types';
import { useStore } from '../../../store/store';
import * as I from '../../ui/Icons';
import { Popover, MenuItem, MenuSep } from '../../ui/Popover';
import { CellValue, Tag } from '../CellValue';
import { OptionMenu } from '../CellEditor';
import { addOption, coverStyle, firstImage, groupRows, groupValue, isEmptyValue, computeValue, setValue, updateView, visibleProps, type Group, contentPreview } from '../dbUtils';
import { createAndOpen, openRow } from '../openRow';
import { RowIcon } from '../RowIcon';

export function Card({ db, view, row, preview, onMenu, draggable, onDragStart, onDragEnd, className, inlineEdit }: {
  db: Block;
  view: View;
  row: Block;
  preview?: 'none' | 'cover' | 'content';
  onMenu?: (rect: DOMRect) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  className?: string;
  inlineEdit?: boolean;
}) {
  const props = visibleProps(db, view).filter((p) => p.id !== 'title');
  const [editTitle, setEditTitle] = useState(false);
  const cover = preview === 'cover' ? row.props.cover || firstImage(row) : undefined;
  const st = coverStyle(cover);
  return (
    <div
      className={`db-card ${className ?? ''}`}
      draggable={draggable && !editTitle}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => !editTitle && openRow(view, row.id)}
    >
      {preview === 'cover' && <div className={`db-card-cover ${st ? '' : 'empty'}`} style={st} />}
      {preview === 'content' && (
        <div className="db-card-content-preview">
          {contentPreview(row).map((b) => (
            <div key={b.id} className={`pv-line pv-${b.type}`} dangerouslySetInnerHTML={{ __html: b.text || '&nbsp;' }} />
          ))}
        </div>
      )}
      <div className="db-card-body">
        <div className="db-card-title">
          <RowIcon row={row} size={16} />
          {editTitle && inlineEdit ? (
            <input
              autoFocus
              className="db-card-title-input"
              defaultValue={row.props.title ?? ''}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                setValue(row.id, 'title', e.target.value);
                setEditTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
              }}
            />
          ) : (
            <span className={row.props.title ? '' : 'untitled'}>{row.props.title || 'Untitled'}</span>
          )}
        </div>
        {props.map((p) => {
          const v = computeValue(db, row, p);
          if (isEmptyValue(p, v) && p.type !== 'checkbox') return null;
          return (
            <div key={p.id} className={`db-card-prop type-${p.type}`}>
              {p.type === 'checkbox' && (
                <span className="card-checkbox-row">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setValue(row.id, p.id, !v);
                    }}
                  >
                    <CellValue db={db} row={row} prop={p} />
                  </span>
                  <span className="card-prop-name">{p.name}</span>
                </span>
              )}
              {p.type !== 'checkbox' && <CellValue db={db} row={row} prop={p} wrap />}
            </div>
          );
        })}
      </div>
      {onMenu && (
        <div className="db-card-actions" onClick={(e) => e.stopPropagation()}>
          {inlineEdit && (
            <span className="card-action" title="Edit title" onClick={() => setEditTitle(true)}>
              <I.ComposeIcon size={14} />
            </span>
          )}
          <span className="card-action" onClick={(e) => onMenu((e.currentTarget as HTMLElement).getBoundingClientRect())}>
            <I.DotsIcon size={14} />
          </span>
        </div>
      )}
    </div>
  );
}

export function RowMenu({ row, view, anchor, onClose }: { row: Block; view: View; anchor: DOMRect; onClose: () => void }) {
  return (
    <Popover anchor={anchor} onClose={onClose} width={220}>
      <div className="menu">
        <MenuItem icon={<I.SidePeekIcon size={16} />} label="Open in side peek" onClick={() => { openRow({ ...view, openIn: 'side' }, row.id); onClose(); }} />
        <MenuItem icon={<I.CenterPeekIcon size={16} />} label="Open in center peek" onClick={() => { openRow({ ...view, openIn: 'center' }, row.id); onClose(); }} />
        <MenuItem icon={<I.ExpandIcon size={16} />} label="Open as full page" onClick={() => { openRow({ ...view, openIn: 'full' }, row.id); onClose(); }} />
        <MenuSep />
        <MenuItem icon={<I.DuplicateIcon size={16} />} label="Duplicate" onClick={() => { useStore.getState().duplicateBlock(row.id); onClose(); }} />
        <MenuItem
          icon={<I.LinkIcon size={16} />}
          label="Copy link"
          onClick={() => {
            navigator.clipboard?.writeText(`${location.origin}${import.meta.env.BASE_URL}${row.id}`).catch(() => {});
            onClose();
          }}
        />
        <MenuItem icon={<I.TrashIcon size={16} />} label="Delete" danger onClick={() => { useStore.getState().trashPage(row.id); onClose(); }} />
      </div>
    </Popover>
  );
}

export function BoardView({ db, view, rows, locked }: { db: Block; view: View; rows: Block[]; locked?: boolean }) {
  const gp = view.groupBy ? (db.props.schema[view.groupBy] as PropertySchema | undefined) : undefined;
  const groups = groupRows(db, view, rows) ?? [{ key: '__all', label: 'All', color: 'default' as const, rows }];
  const hidden = view.hiddenGroups ?? [];
  const [drag, setDrag] = useState<ID | null>(null);
  const [drop, setDrop] = useState<{ group: string; index: number } | null>(null);
  const [menu, setMenu] = useState<{ row: Block; rect: DOMRect } | null>(null);
  const [groupMenu, setGroupMenu] = useState<{ g: Group; rect: DOMRect } | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [hiddenOpen, setHiddenOpen] = useState(true);
  const preview = view.cardPreview ?? 'none';
  const isStatus = gp?.type === 'status';

  const visibleGroups = groups.filter((g) => !hidden.includes(g.key) && !((view as any).hideEmptyGroups && !g.rows.length) && !(g.key === '__none' && !g.rows.length && gp?.type !== 'select'));
  const hiddenGroups = groups.filter((g) => hidden.includes(g.key));

  const onDrop = (g: Group) => {
    if (!drag || !drop) return;
    const st = useStore.getState();
    st.batch(() => {
      if (gp && g.key !== '__all') {
        const row = st.blocks[drag];
        const cur = row?.props.values?.[gp.id];
        setValue(drag, gp.id, groupValue(gp, g.key, cur));
      }
      // reorder within database children: place before the card at drop.index in the group
      const target = g.rows.filter((r) => r.id !== drag)[drop.index];
      if (target) {
        const children = db.children.filter((c) => c !== drag);
        const at = children.indexOf(target.id);
        st.moveBlock(drag, db.id, at + (db.children.indexOf(drag) <= at ? 1 : 0));
      } else {
        const last = g.rows.filter((r) => r.id !== drag).at(-1);
        if (last) {
          const children = db.children.filter((c) => c !== drag);
          const at = children.indexOf(last.id) + 1;
          st.moveBlock(drag, db.id, at + (db.children.indexOf(drag) <= at ? 1 : 0));
        }
      }
      if (view.sorts.length) updateView(db.id, view.id, { sorts: [] });
    });
    setDrag(null);
    setDrop(null);
  };

  const newInGroup = (g: Group) => {
    const values: Record<ID, any> = {};
    if (gp && g.key !== '__all') {
      const v = groupValue(gp, g.key, undefined);
      if (v !== undefined) values[gp.id] = v;
    }
    createAndOpen(db, view, values);
  };

  return (
    <div className="db-board-scroll">
      <div className="db-board">
        {visibleGroups.map((g) => (
          <div
            key={g.key}
            className={`db-board-col ${drop?.group === g.key ? 'drop-target' : ''}`}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              const cards = Array.from(e.currentTarget.querySelectorAll('.db-card:not(.dragging)')) as HTMLElement[];
              let index = cards.length;
              for (let i = 0; i < cards.length; i++) {
                const r = cards[i].getBoundingClientRect();
                if (e.clientY < r.top + r.height / 2) {
                  index = i;
                  break;
                }
              }
              if (drop?.group !== g.key || drop.index !== index) setDrop({ group: g.key, index });
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(g);
            }}
          >
            <div className="db-board-head">
              {g.option || g.key === '__none' ? (
                g.option ? <Tag name={g.label} color={g.color} status={isStatus} /> : <span className="group-none"><span className="none-icon" />{g.label}</span>
              ) : (
                <span className="group-label">{g.label}</span>
              )}
              <span className="group-count">{g.rows.length}</span>
              {!locked && (
                <span className="board-head-actions">
                  <span className="card-action" onClick={(e) => setGroupMenu({ g, rect: e.currentTarget.getBoundingClientRect() })}>
                    <I.DotsIcon size={14} />
                  </span>
                  <span className="card-action" onClick={() => newInGroup(g)}>
                    <I.PlusIcon size={14} />
                  </span>
                </span>
              )}
            </div>
            <div className={`db-board-cards tag-col-${g.color}`}>
              {g.rows.map((r, i) => (
                <div key={r.id}>
                  {drop?.group === g.key && drop.index === i && drag && <div className="card-drop-line" />}
                  <Card
                    db={db}
                    view={view}
                    row={r}
                    preview={preview}
                    inlineEdit
                    draggable={!locked}
                    className={drag === r.id ? 'dragging' : ''}
                    onDragStart={(e) => {
                      setDrag(r.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', r.props.title ?? '');
                    }}
                    onDragEnd={() => {
                      setDrag(null);
                      setDrop(null);
                    }}
                    onMenu={locked ? undefined : (rect) => setMenu({ row: r, rect })}
                  />
                </div>
              ))}
              {drop?.group === g.key && drop.index >= g.rows.filter((x) => x.id !== drag).length && drag && <div className="card-drop-line" />}
              {!locked && (
                <div className="db-board-new" onClick={() => newInGroup(g)}>
                  <I.PlusIcon size={14} />
                  <span>New page</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {gp && !locked && (gp.type === 'select' || gp.type === 'multi_select' || gp.type === 'status') && (
          <div className="db-board-add-group">
            {addingGroup ? (
              <input
                autoFocus
                className="text-input"
                placeholder="New group"
                onBlur={() => setAddingGroup(false)}
                onKeyDown={(e) => {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (e.key === 'Enter' && v) {
                    addOption(db.id, gp.id, v);
                    setAddingGroup(false);
                  }
                  if (e.key === 'Escape') setAddingGroup(false);
                }}
              />
            ) : (
              <div className="add-group-btn" onClick={() => setAddingGroup(true)}>
                <I.PlusIcon size={14} />
                <span>Add group</span>
              </div>
            )}
          </div>
        )}
        {hiddenGroups.length > 0 && (
          <div className="db-board-hidden">
            <div className="hidden-head" onClick={() => setHiddenOpen(!hiddenOpen)}>
              <span className={`group-toggle ${hiddenOpen ? 'open' : ''}`}>
                <I.TriangleRight size={10} />
              </span>
              Hidden groups
            </div>
            {hiddenOpen &&
              hiddenGroups.map((g) => (
                <div key={g.key} className="hidden-group" onClick={() => updateView(db.id, view.id, { hiddenGroups: hidden.filter((x) => x !== g.key) })}>
                  {g.option ? <Tag name={g.label} color={g.color} status={isStatus} /> : <span className="group-label">{g.label}</span>}
                  <span className="group-count">{g.rows.length}</span>
                  <I.EyeOffIcon size={14} />
                </div>
              ))}
          </div>
        )}
      </div>
      {menu && <RowMenu row={menu.row} view={view} anchor={menu.rect} onClose={() => setMenu(null)} />}
      {groupMenu && gp && (
        groupMenu.g.option ? (
          <OptionMenuWithHide db={db} view={view} prop={gp} g={groupMenu.g} anchor={groupMenu.rect} onClose={() => setGroupMenu(null)} />
        ) : (
          <Popover anchor={groupMenu.rect} onClose={() => setGroupMenu(null)} width={200}>
            <div className="menu">
              <MenuItem icon={<I.EyeOffIcon size={16} />} label="Hide group" onClick={() => { updateView(db.id, view.id, { hiddenGroups: [...hidden, groupMenu.g.key] }); setGroupMenu(null); }} />
            </div>
          </Popover>
        )
      )}
    </div>
  );
}

function OptionMenuWithHide({ db, view, prop, g, anchor, onClose }: { db: Block; view: View; prop: PropertySchema; g: Group; anchor: DOMRect; onClose: () => void }) {
  const [edit, setEdit] = useState(false);
  if (edit && g.option) return <OptionMenu db={db} prop={prop} opt={g.option} anchor={anchor} onClose={onClose} />;
  return (
    <Popover anchor={anchor} onClose={onClose} width={200}>
      <div className="menu">
        <MenuItem icon={<I.ComposeIcon size={16} />} label="Edit group" onClick={() => setEdit(true)} />
        <MenuItem icon={<I.EyeOffIcon size={16} />} label="Hide group" onClick={() => { updateView(db.id, view.id, { hiddenGroups: [...(view.hiddenGroups ?? []), g.key] }); onClose(); }} />
      </div>
    </Popover>
  );
}
