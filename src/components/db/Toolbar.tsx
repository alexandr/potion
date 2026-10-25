import { useEffect, useRef, useState } from 'react';
import type { Block, Filter, ID, PropertySchema, Sort, View, ViewType } from '../../store/types';
import { useStore, uid } from '../../store/store';
import { useUI } from '../../store/ui';
import { Popover, MenuItem, MenuHeader, MenuSep, Toggle, type Anchor } from '../ui/Popover';
import * as I from '../ui/Icons';
import { PropTypeIcon, ViewTypeIcon, VIEW_DESCRIPTIONS } from './dbIcons';
import {
  defaultOp,
  ensureDateProp,
  ensureGroupProp,
  newView,
  opsFor,
  schemaList,
  updateDb,
  updateView,
  viewProps,
  VIEW_TYPES,
} from './dbUtils';
import { Tag, Avatar } from './CellValue';
import { DatePicker } from './CellEditor';
import { createAndOpen } from './openRow';
import { EditPropertyPanel } from './PropertyMenu';

// ------------------------------------------------------------------ view tabs
export function ViewTabs({ db, activeId, onSelect }: { db: Block; activeId: ID; onSelect: (id: ID) => void }) {
  const views = db.props.views as View[];
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null);
  const [menu, setMenu] = useState<{ view: View; rect: DOMRect } | null>(null);
  const [overflow, setOverflow] = useState<DOMRect | null>(null);
  const MAX = 5;
  const shown = views.length > MAX ? views.slice(0, MAX) : views;
  const active = views.find((v) => v.id === activeId);
  if (active && !shown.includes(active)) shown[shown.length - 1] = active;
  return (
    <div className="db-tabs">
      {shown.map((v) => (
        <div
          key={v.id}
          className={`db-tab ${v.id === activeId ? 'active' : ''}`}
          onClick={(e) => {
            if (v.id === activeId) setMenu({ view: v, rect: e.currentTarget.getBoundingClientRect() });
            else onSelect(v.id);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ view: v, rect: e.currentTarget.getBoundingClientRect() });
          }}
        >
          <ViewTypeIcon type={v.type} size={14} />
          <span className="db-tab-name">{v.name}</span>
        </div>
      ))}
      {views.length > MAX && (
        <div className="db-tab more" onClick={(e) => setOverflow(e.currentTarget.getBoundingClientRect())}>
          {views.length - MAX} more…
        </div>
      )}
      <div className="db-tab-add" onClick={(e) => setAddAnchor(e.currentTarget.getBoundingClientRect())} title="Add view">
        <I.PlusIcon size={16} />
      </div>
      {addAnchor && (
        <AddViewMenu
          db={db}
          anchor={addAnchor}
          onClose={() => setAddAnchor(null)}
          onAdded={(id) => {
            setAddAnchor(null);
            onSelect(id);
          }}
        />
      )}
      {menu && <ViewTabMenu db={db} view={menu.view} anchor={menu.rect} onClose={() => setMenu(null)} onSelect={onSelect} />}
      {overflow && (
        <Popover anchor={overflow} onClose={() => setOverflow(null)} width={240}>
          <div className="menu">
            {views.map((v) => (
              <MenuItem key={v.id} icon={<ViewTypeIcon type={v.type} />} label={v.name} checked={v.id === activeId} onClick={() => { onSelect(v.id); setOverflow(null); }} />
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}

export function addViewOfType(db: Block, type: ViewType): ID {
  const v = newView(db, type);
  updateDb(db.id, { views: [...(db.props.views as View[]), v] });
  if (type === 'calendar' || type === 'timeline') {
    if (!v.dateProp) ensureDateProp(db.id, v.id);
  }
  if (type === 'board' && !v.groupBy) ensureGroupProp(db.id, v.id);
  return v.id;
}

function AddViewMenu({ db, anchor, onClose, onAdded }: { db: Block; anchor: Anchor; onClose: () => void; onAdded: (id: ID) => void }) {
  return (
    <Popover anchor={anchor} onClose={onClose} width={280}>
      <div className="menu">
        <MenuHeader>Add a new view</MenuHeader>
        {VIEW_TYPES.map((t) => (
          <MenuItem key={t.type} icon={<ViewTypeIcon type={t.type} size={18} />} label={t.label} description={VIEW_DESCRIPTIONS[t.type]} onClick={() => onAdded(addViewOfType(db, t.type))} />
        ))}
      </div>
    </Popover>
  );
}

function ViewTabMenu({ db, view, anchor, onClose, onSelect }: { db: Block; view: View; anchor: Anchor; onClose: () => void; onSelect: (id: ID) => void }) {
  const [name, setName] = useState(view.name);
  const [layout, setLayout] = useState<DOMRect | null>(null);
  const views = db.props.views as View[];
  const commit = () => name.trim() && name !== view.name && updateView(db.id, view.id, { name: name.trim() });
  return (
    <Popover anchor={anchor} onClose={() => { commit(); onClose(); }} width={260}>
      <div className="menu">
        <div className="menu-input-row prop-name-row">
          <div className="prop-type-btn">
            <ViewTypeIcon type={view.type} />
          </div>
          <input autoFocus className="text-input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (commit(), onClose())} />
        </div>
        <MenuItem icon={<I.SlidersIcon size={16} />} label="Edit view" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('potion-db-settings', { detail: { viewId: view.id } })); }} />
        <MenuItem icon={<ViewTypeIcon type={view.type} />} label="Layout" chevron right={<span className="menu-item-value">{VIEW_TYPES.find((t) => t.type === view.type)?.label}</span>} onClick={(e) => setLayout((e.currentTarget as HTMLElement).getBoundingClientRect())} />
        <MenuItem
          icon={<I.LinkIcon size={16} />}
          label="Copy link to view"
          onClick={() => {
            navigator.clipboard?.writeText(`${location.origin}${location.pathname}?v=${view.id}`).catch(() => {});
            useUI.getState().showToast('Copied link to clipboard');
            onClose();
          }}
        />
        <MenuItem
          icon={<I.DuplicateIcon size={16} />}
          label="Duplicate view"
          onClick={() => {
            const copy = { ...structuredClone(view), id: uid(), name: `${view.name} (1)` };
            const i = views.findIndex((v) => v.id === view.id);
            const nv = [...views];
            nv.splice(i + 1, 0, copy);
            updateDb(db.id, { views: nv });
            onSelect(copy.id);
            onClose();
          }}
        />
        {views.length > 1 && (
          <MenuItem
            icon={<I.TrashIcon size={16} />}
            label="Delete view"
            danger
            onClick={() => {
              const nv = views.filter((v) => v.id !== view.id);
              updateDb(db.id, { views: nv });
              onSelect(nv[0].id);
              onClose();
            }}
          />
        )}
      </div>
      {layout && <LayoutPicker db={db} view={view} anchor={layout} onClose={() => setLayout(null)} placement="right-start" />}
    </Popover>
  );
}

export function setLayout(db: Block, view: View, type: ViewType) {
  const patch: Partial<View> = { type };
  if ((type === 'board' || type === 'chart') && !view.groupBy) {
    const g = schemaList(db).find((p) => p.type === 'status') ?? schemaList(db).find((p) => p.type === 'select');
    patch.groupBy = g?.id ?? null;
  }
  if ((type === 'calendar' || type === 'timeline') && !view.dateProp) patch.dateProp = schemaList(db).find((p) => p.type === 'date')?.id ?? null;
  if (VIEW_TYPES.find((t) => t.type === view.type)?.label === view.name) patch.name = VIEW_TYPES.find((t) => t.type === type)!.label;
  updateView(db.id, view.id, patch);
  if ((type === 'calendar' || type === 'timeline') && !patch.dateProp && !view.dateProp) ensureDateProp(db.id, view.id);
  if (type === 'board' && !patch.groupBy && !view.groupBy) ensureGroupProp(db.id, view.id);
}

function LayoutPicker({ db, view, anchor, onClose, placement }: { db: Block; view: View; anchor: Anchor; onClose: () => void; placement?: 'right-start' | 'bottom-start' }) {
  return (
    <Popover anchor={anchor} onClose={onClose} width={290} placement={placement}>
      <LayoutGrid db={db} view={view} />
    </Popover>
  );
}

function LayoutGrid({ db, view }: { db: Block; view: View }) {
  return (
    <div className="layout-grid">
      {VIEW_TYPES.map((t) => (
        <div key={t.type} className={`layout-cell ${view.type === t.type ? 'active' : ''}`} onClick={() => setLayout(db, view, t.type)}>
          <ViewTypeIcon type={t.type} size={20} />
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ toolbar
export function DbToolbar({ db, view, search, setSearch, showPills, setShowPills }: { db: Block; view: View; search: string; setSearch: (s: string) => void; showPills: boolean; setShowPills: (b: boolean) => void }) {
  const [searchOpen, setSearchOpen] = useState(!!search);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);
  const [sortAnchor, setSortAnchor] = useState<DOMRect | null>(null);
  const [settings, setSettings] = useState<DOMRect | null>(null);
  const [newMenu, setNewMenu] = useState<DOMRect | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onSettings = (e: Event) => {
      if ((e as CustomEvent).detail?.viewId === view.id && settingsRef.current) setSettings(settingsRef.current.getBoundingClientRect());
    };
    const onFilter = (e: Event) => {
      if ((e as CustomEvent).detail?.viewId === view.id) setShowPills(true);
    };
    window.addEventListener('potion-db-settings', onSettings);
    window.addEventListener('potion-db-open-filter', onFilter);
    return () => {
      window.removeEventListener('potion-db-settings', onSettings);
      window.removeEventListener('potion-db-open-filter', onFilter);
    };
  }, [view.id, setShowPills]);

  const hasFilters = view.filters.length > 0;
  const hasSorts = view.sorts.length > 0;

  return (
    <div className="db-toolbar">
      <div
        ref={filterRef}
        className={`db-tool ${hasFilters ? 'active' : ''}`}
        title="Filter"
        onClick={(e) => {
          if (hasFilters) setShowPills(!showPills);
          else setFilterAnchor(e.currentTarget.getBoundingClientRect());
        }}
      >
        <I.FilterIcon size={16} />
      </div>
      <div
        className={`db-tool ${hasSorts ? 'active' : ''}`}
        title="Sort"
        onClick={(e) => {
          if (hasSorts) setShowPills(!showPills);
          else setSortAnchor(e.currentTarget.getBoundingClientRect());
        }}
      >
        <I.SortIcon size={16} />
      </div>
      <div className="db-tool" title="Automations" onClick={() => useUI.getState().showToast('Automations are not available in this demo')}>
        <I.LightningIcon size={16} />
      </div>
      <div className={`db-search ${searchOpen ? 'open' : ''}`}>
        <div
          className="db-tool"
          title="Search"
          onClick={() => {
            setSearchOpen(true);
            setTimeout(() => inputRef.current?.focus());
          }}
        >
          <I.SearchIcon size={16} />
        </div>
        {searchOpen && (
          <input
            ref={inputRef}
            className="db-search-input"
            placeholder="Type to search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => !search && setSearchOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearch('');
                setSearchOpen(false);
              }
            }}
          />
        )}
        {searchOpen && search && (
          <span className="db-search-clear" onMouseDown={(e) => { e.preventDefault(); setSearch(''); }}>
            <I.CloseIcon size={12} />
          </span>
        )}
      </div>
      <div ref={settingsRef} className="db-tool" title="Settings" onClick={(e) => setSettings(e.currentTarget.getBoundingClientRect())}>
        <I.DotsIcon size={16} />
      </div>
      <div className="db-new-btn">
        <div className="db-new-main" onClick={() => createAndOpen(db, view, {}, 0)}>
          New
        </div>
        <div className="db-new-arrow" onClick={(e) => setNewMenu(e.currentTarget.getBoundingClientRect())}>
          <I.ChevronDown size={12} />
        </div>
      </div>
      {filterAnchor && (
        <PropPicker
          db={db}
          anchor={filterAnchor}
          title="Filter by"
          onClose={() => setFilterAnchor(null)}
          onPick={(p) => {
            const f: Filter = { id: uid(6), prop: p.id, op: defaultOp(p.type) };
            updateView(db.id, view.id, { filters: [...view.filters, f] });
            setFilterAnchor(null);
            setShowPills(true);
            setTimeout(() => window.dispatchEvent(new CustomEvent('potion-open-filter-pill', { detail: { id: f.id } })), 30);
          }}
        />
      )}
      {sortAnchor && (
        <PropPicker
          db={db}
          anchor={sortAnchor}
          title="Sort by"
          onClose={() => setSortAnchor(null)}
          onPick={(p) => {
            updateView(db.id, view.id, { sorts: [...view.sorts, { id: uid(6), prop: p.id, dir: 'asc' }] });
            setSortAnchor(null);
            setShowPills(true);
          }}
        />
      )}
      {settings && <ViewSettings db={db} view={view} anchor={settings} onClose={() => setSettings(null)} />}
      {newMenu && (
        <Popover anchor={newMenu} onClose={() => setNewMenu(null)} width={260} placement="bottom-end">
          <div className="menu">
            <MenuHeader>Templates for {db.props.title || 'Untitled'}</MenuHeader>
            <MenuItem icon={<I.PageIcon size={16} />} label="Empty page" right={<span className="default-badge">Default</span>} onClick={() => { createAndOpen(db, view, {}, 0); setNewMenu(null); }} />
            <MenuSep />
            <MenuItem icon={<I.PlusIcon size={16} />} label="New template" onClick={() => { useUI.getState().showToast('Templates are coming soon'); setNewMenu(null); }} />
          </div>
        </Popover>
      )}
    </div>
  );
}

export function PropPicker({ db, anchor, onClose, onPick, title, filter }: { db: Block; anchor: Anchor; onClose: () => void; onPick: (p: PropertySchema) => void; title?: string; filter?: (p: PropertySchema) => boolean }) {
  const [q, setQ] = useState('');
  const list = schemaList(db).filter((p) => (!filter || filter(p)) && p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover anchor={anchor} onClose={onClose} width={260}>
      <div className="menu">
        <div className="menu-input-row">
          <input autoFocus className="text-input" placeholder={`${title ?? 'Filter by'}…`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && list[0] && onPick(list[0])} />
        </div>
        {list.map((p) => (
          <MenuItem key={p.id} icon={<PropTypeIcon type={p.type} />} label={p.name} onClick={() => onPick(p)} />
        ))}
        {!list.length && <div className="menu-empty">No results</div>}
      </div>
    </Popover>
  );
}

// ------------------------------------------------------------------ filter & sort pills
export function PillsRow({ db, view }: { db: Block; view: View }) {
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null);
  const [sortAnchor, setSortAnchor] = useState<DOMRect | null>(null);
  const schema = db.props.schema as Record<ID, PropertySchema>;
  const sorts = view.sorts.filter((s) => schema[s.prop]);
  return (
    <div className="db-pills">
      {sorts.length > 0 && (
        <div className="db-pill sort-pill" onClick={(e) => setSortAnchor(e.currentTarget.getBoundingClientRect())}>
          <I.SortIcon size={14} />
          <span>{sorts.length === 1 ? schema[sorts[0].prop].name : `${sorts.length} sorts`}</span>
          <I.ChevronDown size={12} />
        </div>
      )}
      {sorts.length > 0 && view.filters.length > 0 && <div className="db-pill-sep" />}
      {view.filters.length > 1 && (
        <div className="db-pill filter-mode" onClick={() => updateView(db.id, view.id, { filterMode: view.filterMode === 'or' ? 'and' : 'or' })} title="Toggle AND / OR">
          {view.filterMode === 'or' ? 'Any' : 'All'}
        </div>
      )}
      {view.filters.map((f) => (
        <FilterPill key={f.id} db={db} view={view} filter={f} />
      ))}
      <div className="db-pill add" onClick={(e) => setAddAnchor(e.currentTarget.getBoundingClientRect())}>
        <I.PlusIcon size={14} />
        <span>Add filter</span>
      </div>
      {addAnchor && (
        <PropPicker
          db={db}
          anchor={addAnchor}
          onClose={() => setAddAnchor(null)}
          onPick={(p) => {
            const f: Filter = { id: uid(6), prop: p.id, op: defaultOp(p.type) };
            updateView(db.id, view.id, { filters: [...view.filters, f] });
            setAddAnchor(null);
            setTimeout(() => window.dispatchEvent(new CustomEvent('potion-open-filter-pill', { detail: { id: f.id } })), 30);
          }}
        />
      )}
      {sortAnchor && <SortMenu db={db} view={view} anchor={sortAnchor} onClose={() => setSortAnchor(null)} />}
    </div>
  );
}

function filterSummary(db: Block, p: PropertySchema, f: Filter): string {
  const ops = opsFor(p.type);
  const op = ops.find((o) => o.id === f.op);
  if (op?.noValue) return op.label.toLowerCase();
  const v = f.value;
  if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return '';
  if (p.type === 'checkbox') return v ? 'checked' : 'unchecked';
  if (p.type === 'select' || p.type === 'status' || p.type === 'multi_select') {
    const arr = Array.isArray(v) ? v : [v];
    return arr.map((id: ID) => p.options?.find((o) => o.id === id)?.name).filter(Boolean).join(', ');
  }
  if (p.type === 'person') {
    const arr = Array.isArray(v) ? v : [v];
    return arr.map((id: ID) => useStore.getState().users[id]?.name).filter(Boolean).join(', ');
  }
  void db;
  const prefix = ['is', 'contains'].includes(f.op) ? '' : `${op?.label.toLowerCase()} `;
  return prefix + String(v);
}

function FilterPill({ db, view, filter }: { db: Block; view: View; filter: Filter }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const p = db.props.schema[filter.prop] as PropertySchema | undefined;
  useEffect(() => {
    const h = (e: Event) => {
      if ((e as CustomEvent).detail?.id === filter.id && ref.current) setAnchor(ref.current.getBoundingClientRect());
    };
    window.addEventListener('potion-open-filter-pill', h);
    return () => window.removeEventListener('potion-open-filter-pill', h);
  }, [filter.id]);
  if (!p) return null;
  const summary = filterSummary(db, p, filter);
  return (
    <>
      <div ref={ref} className={`db-pill filter ${summary ? 'set' : ''}`} onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}>
        <PropTypeIcon type={p.type} size={14} />
        <span className="pill-name">{p.name}</span>
        {summary && <span className="pill-val">: {summary}</span>}
        <I.ChevronDown size={12} />
      </div>
      {anchor && <FilterEditor db={db} view={view} filter={filter} prop={p} anchor={anchor} onClose={() => setAnchor(null)} />}
    </>
  );
}

function FilterEditor({ db, view, filter, prop, anchor, onClose }: { db: Block; view: View; filter: Filter; prop: PropertySchema; anchor: Anchor; onClose: () => void }) {
  const [opMenu, setOpMenu] = useState<DOMRect | null>(null);
  const [more, setMore] = useState<DOMRect | null>(null);
  const users = useStore((s) => s.users);
  const liveDb = useStore((s) => s.blocks[db.id]) ?? db;
  const liveView = (liveDb.props.views as View[]).find((v) => v.id === view.id) ?? view;
  const f = liveView.filters.find((x) => x.id === filter.id) ?? filter;
  const ops = opsFor(prop.type);
  const op = ops.find((o) => o.id === f.op) ?? ops[0];
  const set = (patch: Partial<Filter>) => updateView(db.id, view.id, { filters: liveView.filters.map((x) => (x.id === f.id ? { ...x, ...patch } : x)) });
  const remove = () => {
    updateView(db.id, view.id, { filters: liveView.filters.filter((x) => x.id !== f.id) });
    onClose();
  };
  const arr: ID[] = Array.isArray(f.value) ? f.value : f.value ? [f.value] : [];
  const toggleIn = (id: ID) => set({ value: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] });
  return (
    <Popover anchor={anchor} onClose={onClose} width={prop.type === 'date' ? 280 : 290}>
      <div className="menu filter-editor">
        <div className="filter-head">
          <span className="filter-prop">{prop.name}</span>
          <span className="filter-op" onClick={(e) => setOpMenu(e.currentTarget.getBoundingClientRect())}>
            {op.label.toLowerCase()} <I.ChevronDown size={11} />
          </span>
          <span className="filter-more" onClick={(e) => setMore(e.currentTarget.getBoundingClientRect())}>
            <I.DotsIcon size={14} />
          </span>
        </div>
        {!op.noValue && (
          <div className="filter-body">
            {(prop.type === 'select' || prop.type === 'status' || prop.type === 'multi_select') && (
              <div className="filter-options">
                {(prop.options ?? []).map((o) => (
                  <div key={o.id} className="menu-item" onClick={() => toggleIn(o.id)}>
                    <span className={`db-checkbox small ${arr.includes(o.id) ? 'on' : ''}`}>{arr.includes(o.id) && <I.CheckIcon size={10} style={{ strokeWidth: 2.6 }} />}</span>
                    <div className="menu-item-body">
                      <Tag name={o.name} color={o.color} status={prop.type === 'status'} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(prop.type === 'person' || prop.type === 'created_by' || prop.type === 'last_edited_by') && (
              <div className="filter-options">
                {Object.values(users).map((u) => (
                  <div key={u.id} className="menu-item" onClick={() => toggleIn(u.id)}>
                    <span className={`db-checkbox small ${arr.includes(u.id) ? 'on' : ''}`}>{arr.includes(u.id) && <I.CheckIcon size={10} style={{ strokeWidth: 2.6 }} />}</span>
                    <Avatar userId={u.id} />
                    <div className="menu-item-body">{u.name}</div>
                  </div>
                ))}
              </div>
            )}
            {prop.type === 'checkbox' && (
              <div className="menu-item" onClick={() => set({ value: !f.value })}>
                <span className={`db-checkbox ${f.value ? 'on' : ''}`}>{f.value && <I.CheckIcon size={12} style={{ strokeWidth: 2.4 }} />}</span>
                <div className="menu-item-body">{f.value ? 'Checked' : 'Unchecked'}</div>
              </div>
            )}
            {(prop.type === 'date' || prop.type === 'created_time' || prop.type === 'last_edited_time') && (
              <DatePicker allowRange={false} value={f.value ? { start: f.value } : undefined} onChange={(v) => set({ value: v?.start?.slice(0, 10) })} />
            )}
            {['text', 'title', 'url', 'email', 'phone', 'formula', 'rollup', 'number', 'unique_id', 'relation'].includes(prop.type) && (
              <div className="menu-input-row">
                <input autoFocus className="text-input" type={prop.type === 'number' ? 'number' : 'text'} placeholder="Type a value…" value={f.value ?? ''} onChange={(e) => set({ value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && onClose()} />
              </div>
            )}
          </div>
        )}
      </div>
      {opMenu && (
        <Popover anchor={opMenu} onClose={() => setOpMenu(null)} width={220}>
          <div className="menu">
            {ops.map((o) => (
              <MenuItem key={o.id} label={o.label} checked={o.id === f.op} onClick={() => { set({ op: o.id }); setOpMenu(null); }} />
            ))}
          </div>
        </Popover>
      )}
      {more && (
        <Popover anchor={more} onClose={() => setMore(null)} width={200}>
          <div className="menu">
            <MenuItem icon={<I.TrashIcon size={16} />} label="Delete filter" danger onClick={remove} />
          </div>
        </Popover>
      )}
    </Popover>
  );
}

function SortMenu({ db, view, anchor, onClose }: { db: Block; view: View; anchor: Anchor; onClose: () => void }) {
  const liveDb = useStore((s) => s.blocks[db.id]) ?? db;
  const liveView = (liveDb.props.views as View[]).find((v) => v.id === view.id) ?? view;
  const schema = liveDb.props.schema as Record<ID, PropertySchema>;
  const [pick, setPick] = useState<{ rect: DOMRect; sortId: ID | null } | null>(null);
  const [dirMenu, setDirMenu] = useState<{ rect: DOMRect; sortId: ID } | null>(null);
  const setSorts = (sorts: Sort[]) => updateView(db.id, view.id, { sorts });
  return (
    <Popover anchor={anchor} onClose={onClose} width={380}>
      <div className="menu sort-menu">
        {liveView.sorts.map((s) => (
          <div key={s.id} className="sort-row">
            <span className="opt-drag">
              <I.DragIcon size={14} />
            </span>
            <div className="sort-select" onClick={(e) => setPick({ rect: e.currentTarget.getBoundingClientRect(), sortId: s.id })}>
              {schema[s.prop] && <PropTypeIcon type={schema[s.prop].type} size={14} />}
              <span>{schema[s.prop]?.name ?? 'Property'}</span>
              <I.ChevronDown size={12} />
            </div>
            <div className="sort-select" onClick={(e) => setDirMenu({ rect: e.currentTarget.getBoundingClientRect(), sortId: s.id })}>
              <span>{s.dir === 'asc' ? 'Ascending' : 'Descending'}</span>
              <I.ChevronDown size={12} />
            </div>
            <span className="sort-x" onClick={() => setSorts(liveView.sorts.filter((x) => x.id !== s.id))}>
              <I.CloseIcon size={14} />
            </span>
          </div>
        ))}
        <MenuItem icon={<I.PlusIcon size={16} />} label="Add sort" onClick={(e) => setPick({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), sortId: null })} />
        <MenuItem icon={<I.TrashIcon size={16} />} label="Delete sort" onClick={() => { setSorts([]); onClose(); }} />
      </div>
      {pick && (
        <PropPicker
          db={liveDb}
          anchor={pick.rect}
          title="Sort by"
          onClose={() => setPick(null)}
          onPick={(p) => {
            if (pick.sortId) setSorts(liveView.sorts.map((x) => (x.id === pick.sortId ? { ...x, prop: p.id } : x)));
            else setSorts([...liveView.sorts, { id: uid(6), prop: p.id, dir: 'asc' }]);
            setPick(null);
          }}
        />
      )}
      {dirMenu && (
        <Popover anchor={dirMenu.rect} onClose={() => setDirMenu(null)} width={160}>
          <div className="menu">
            {(['asc', 'desc'] as const).map((d) => (
              <MenuItem key={d} label={d === 'asc' ? 'Ascending' : 'Descending'} onClick={() => { setSorts(liveView.sorts.map((x) => (x.id === dirMenu.sortId ? { ...x, dir: d } : x))); setDirMenu(null); }} />
            ))}
          </div>
        </Popover>
      )}
    </Popover>
  );
}

// ------------------------------------------------------------------ view settings
type Panel = 'main' | 'layout' | 'props' | 'group' | 'sort' | 'filter' | 'open' | 'date' | 'edit-props' | 'limit' | 'card';

export function ViewSettings({ db, view, anchor, onClose }: { db: Block; view: View; anchor: Anchor; onClose: () => void }) {
  const liveDb = useStore((s) => s.blocks[db.id]) ?? db;
  const liveView = (liveDb.props.views as View[]).find((v) => v.id === view.id) ?? view;
  const [panel, setPanel] = useState<Panel>('main');
  const [editProp, setEditProp] = useState<{ id: ID; rect: DOMRect } | null>(null);
  const [dragId, setDragId] = useState<ID | null>(null);
  const schema = liveDb.props.schema as Record<ID, PropertySchema>;
  const up = (patch: Partial<View>) => updateView(db.id, view.id, patch);
  const header = (title: string) => (
    <div className="settings-head">
      <span className="settings-back" onClick={() => setPanel('main')}>
        <I.ArrowLeftIcon size={16} />
      </span>
      <span className="settings-title">{title}</span>
      <span className="settings-close" onClick={onClose}>
        <I.CloseIcon size={16} />
      </span>
    </div>
  );
  const typeLabel = VIEW_TYPES.find((t) => t.type === liveView.type)?.label;
  const visibleCount = viewProps(liveDb, liveView).filter((p) => !(liveView.hidden ?? []).includes(p.id)).length;
  const groupName = liveView.groupBy ? schema[liveView.groupBy]?.name : 'None';
  const openLabel = { side: 'Side peek', center: 'Center peek', full: 'Full page' }[liveView.openIn ?? 'side'];

  return (
    <Popover anchor={anchor} onClose={onClose} width={290} placement="bottom-end">
      <div className="menu view-settings">
        {panel === 'main' && (
          <>
            <div className="settings-head">
              <span className="settings-title">View options</span>
              <span className="settings-close" onClick={onClose}>
                <I.CloseIcon size={16} />
              </span>
            </div>
            <div className="menu-input-row prop-name-row">
              <div className="prop-type-btn">
                <ViewTypeIcon type={liveView.type} />
              </div>
              <input className="text-input" defaultValue={liveView.name} onBlur={(e) => e.target.value.trim() && up({ name: e.target.value.trim() })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
            </div>
            <MenuItem icon={<ViewTypeIcon type={liveView.type} />} label="Layout" right={<span className="menu-item-value">{typeLabel}</span>} chevron onClick={() => setPanel('layout')} />
            <MenuItem icon={<I.PropertiesIcon size={16} />} label="Property visibility" right={<span className="menu-item-value">{visibleCount}</span>} chevron onClick={() => setPanel('props')} />
            <MenuItem icon={<I.FilterIcon size={16} />} label="Filter" right={<span className="menu-item-value">{liveView.filters.length || ''}</span>} chevron onClick={() => setPanel('filter')} />
            <MenuItem icon={<I.SortIcon size={16} />} label="Sort" right={<span className="menu-item-value">{liveView.sorts.length || ''}</span>} chevron onClick={() => setPanel('sort')} />
            {liveView.type !== 'calendar' && liveView.type !== 'chart' && (
              <MenuItem icon={<I.GroupIcon size={16} />} label="Group" right={<span className="menu-item-value">{groupName}</span>} chevron onClick={() => setPanel('group')} />
            )}
            {(liveView.type === 'calendar' || liveView.type === 'timeline') && (
              <MenuItem icon={<I.CalendarIcon size={16} />} label={liveView.type === 'calendar' ? 'Show calendar by' : 'Show timeline by'} right={<span className="menu-item-value">{liveView.dateProp ? schema[liveView.dateProp]?.name : 'None'}</span>} chevron onClick={() => setPanel('date')} />
            )}
            {(liveView.type === 'gallery' || liveView.type === 'board') && (
              <MenuItem icon={<I.ImageIcon size={16} />} label="Card preview" right={<span className="menu-item-value">{{ none: 'None', cover: 'Page cover', content: 'Page content' }[liveView.cardPreview ?? (liveView.type === 'gallery' ? 'cover' : 'none')]}</span>} chevron onClick={() => setPanel('card')} />
            )}
            {liveView.type === 'chart' && (
              <>
                <MenuHeader>Chart type</MenuHeader>
                {(['bar', 'line', 'donut'] as const).map((c) => (
                  <MenuItem key={c} label={c[0].toUpperCase() + c.slice(1)} checked={(liveView.chartType ?? 'bar') === c} onClick={() => up({ chartType: c })} />
                ))}
              </>
            )}
            {liveView.type === 'table' && (
              <>
                <MenuItem icon={<I.WrapIcon size={16} />} label="Wrap all content" right={<Toggle on={!!liveView.wrapCells} />} onClick={() => up({ wrapCells: !liveView.wrapCells })} />
                <MenuItem icon={<I.ColumnsIcon size={16} />} label="Show vertical lines" right={<Toggle on={liveView.showVerticalLines !== false} />} onClick={() => up({ showVerticalLines: liveView.showVerticalLines === false })} />
              </>
            )}
            <MenuItem icon={<I.ListIcon size={16} />} label="Load limit" right={<span className="menu-item-value">{liveView.limit ?? 50} pages</span>} chevron onClick={() => setPanel('limit')} />
            <MenuItem icon={<I.SidePeekIcon size={16} />} label="Open pages in" right={<span className="menu-item-value">{openLabel}</span>} chevron onClick={() => setPanel('open')} />
            <MenuItem
              icon={<I.LinkIcon size={16} />}
              label="Copy link to view"
              onClick={() => {
                navigator.clipboard?.writeText(`${location.origin}${location.pathname}?v=${view.id}`).catch(() => {});
                useUI.getState().showToast('Copied link to clipboard');
              }}
            />
            <MenuSep />
            <MenuHeader>Data source settings</MenuHeader>
            <MenuItem icon={<I.SlidersIcon size={16} />} label="Edit properties" chevron onClick={() => setPanel('edit-props')} />
            <MenuItem icon={<I.LightningIcon size={16} />} label="Automations" onClick={() => useUI.getState().showToast('Automations are not available in this demo')} />
            <MenuItem
              icon={<I.LockIcon size={16} />}
              label="Lock database"
              right={<Toggle on={!!liveDb.props.locked} />}
              onClick={() => updateDb(db.id, { locked: !liveDb.props.locked })}
            />
          </>
        )}
        {panel === 'layout' && (
          <>
            {header('Layout')}
            <LayoutGrid db={liveDb} view={liveView} />
          </>
        )}
        {(panel === 'props' || panel === 'edit-props') && (
          <>
            {header(panel === 'props' ? 'Property visibility' : 'Edit properties')}
            {panel === 'props' && (
              <div className="settings-sub-row">
                <span className="menu-header">Shown in {liveView.type}</span>
                <span
                  className="settings-link"
                  onClick={() => {
                    const all = viewProps(liveDb, liveView).filter((p) => p.id !== 'title').map((p) => p.id);
                    const allShown = all.every((id) => !(liveView.hidden ?? []).includes(id));
                    up({ hidden: allShown ? all : [] });
                  }}
                >
                  {viewProps(liveDb, liveView).every((p) => !(liveView.hidden ?? []).includes(p.id)) ? 'Hide all' : 'Show all'}
                </span>
              </div>
            )}
            {viewProps(liveDb, liveView).map((p) => {
              const hidden = (liveView.hidden ?? []).includes(p.id) && p.id !== 'title';
              return (
                <div
                  key={p.id}
                  className={`menu-item prop-vis-row ${dragId === p.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => setDragId(p.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!dragId || dragId === p.id) return;
                    const order = viewProps(liveDb, liveView).map((x) => x.id).filter((x) => x !== dragId);
                    order.splice(order.indexOf(p.id), 0, dragId);
                    up({ propOrder: order });
                    setDragId(null);
                  }}
                  onDragEnd={() => setDragId(null)}
                  onClick={(e) => panel === 'edit-props' && setEditProp({ id: p.id, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                >
                  <span className="opt-drag">
                    <I.DragIcon size={14} />
                  </span>
                  <div className="menu-item-icon">
                    <PropTypeIcon type={p.type} />
                  </div>
                  <div className="menu-item-body">
                    <div className="menu-item-label" style={{ opacity: hidden ? 0.6 : 1 }}>
                      {p.name}
                    </div>
                  </div>
                  {panel === 'props' ? (
                    p.id === 'title' ? (
                      <span className="vis-eye disabled">
                        <I.EyeIcon size={16} />
                      </span>
                    ) : (
                      <span
                        className="vis-eye"
                        onClick={(e) => {
                          e.stopPropagation();
                          up({ hidden: hidden ? (liveView.hidden ?? []).filter((x) => x !== p.id) : [...(liveView.hidden ?? []), p.id] });
                        }}
                      >
                        {hidden ? <I.EyeOffIcon size={16} /> : <I.EyeIcon size={16} />}
                      </span>
                    )
                  ) : (
                    <I.ChevronRight size={14} style={{ color: 'var(--icon)' }} />
                  )}
                </div>
              );
            })}
          </>
        )}
        {panel === 'group' && (
          <>
            {header('Group')}
            <MenuItem label="None" checked={!liveView.groupBy} onClick={() => up({ groupBy: null })} />
            {Object.values(schema)
              .filter((p) => ['select', 'status', 'multi_select', 'person', 'checkbox', 'text', 'url', 'number'].includes(p.type))
              .map((p) => (
                <MenuItem key={p.id} icon={<PropTypeIcon type={p.type} />} label={p.name} checked={liveView.groupBy === p.id} onClick={() => up({ groupBy: p.id })} />
              ))}
            {liveView.groupBy && (
              <>
                <MenuSep />
                <MenuItem
                  label="Hide empty groups"
                  right={<Toggle on={!!(liveView as any).hideEmptyGroups} />}
                  onClick={() => up({ hideEmptyGroups: !(liveView as any).hideEmptyGroups } as any)}
                />
              </>
            )}
          </>
        )}
        {panel === 'date' && (
          <>
            {header(liveView.type === 'calendar' ? 'Show calendar by' : 'Show timeline by')}
            {Object.values(schema)
              .filter((p) => p.type === 'date' || p.type === 'created_time' || p.type === 'last_edited_time')
              .map((p) => (
                <MenuItem key={p.id} icon={<PropTypeIcon type={p.type} />} label={p.name} checked={liveView.dateProp === p.id} onClick={() => up({ dateProp: p.id })} />
              ))}
          </>
        )}
        {panel === 'card' && (
          <>
            {header('Card preview')}
            {(['none', 'cover', 'content'] as const).map((c) => (
              <MenuItem key={c} label={{ none: 'None', cover: 'Page cover', content: 'Page content' }[c]} checked={(liveView.cardPreview ?? (liveView.type === 'gallery' ? 'cover' : 'none')) === c} onClick={() => up({ cardPreview: c })} />
            ))}
            {liveView.type === 'gallery' && (
              <>
                <MenuHeader>Card size</MenuHeader>
                {(['small', 'medium', 'large'] as const).map((c) => (
                  <MenuItem key={c} label={c[0].toUpperCase() + c.slice(1)} checked={(liveView.cardSize ?? 'medium') === c} onClick={() => up({ cardSize: c })} />
                ))}
              </>
            )}
          </>
        )}
        {panel === 'open' && (
          <>
            {header('Open pages in')}
            {(
              [
                ['side', 'Side peek', 'Preview pages on the side. Keeps the view behind interactive.', <I.SidePeekIcon size={18} key="s" />],
                ['center', 'Center peek', 'Open pages in a focused, centered modal.', <I.CenterPeekIcon size={18} key="c" />],
                ['full', 'Full page', 'Open pages in full page.', <I.FullPageIcon size={18} key="f" />],
              ] as const
            ).map(([id, l, d, icon]) => (
              <MenuItem key={id} icon={icon} label={l} description={d} checked={(liveView.openIn ?? 'side') === id} onClick={() => up({ openIn: id })} />
            ))}
          </>
        )}
        {panel === 'limit' && (
          <>
            {header('Load limit')}
            {[10, 25, 50, 100].map((n) => (
              <MenuItem key={n} label={`${n} pages`} checked={(liveView.limit ?? 50) === n} onClick={() => up({ limit: n })} />
            ))}
          </>
        )}
        {panel === 'filter' && (
          <>
            {header('Filter')}
            {liveView.filters.map((f) => (
              <div key={f.id} className="menu-item">
                <div className="menu-item-icon">{schema[f.prop] && <PropTypeIcon type={schema[f.prop].type} />}</div>
                <div className="menu-item-body">
                  {schema[f.prop]?.name} <span className="menu-item-value">{schema[f.prop] ? filterSummary(liveDb, schema[f.prop], f) || opsFor(schema[f.prop].type).find((o) => o.id === f.op)?.label.toLowerCase() : ''}</span>
                </div>
                <span className="sort-x" onClick={() => up({ filters: liveView.filters.filter((x) => x.id !== f.id) })}>
                  <I.CloseIcon size={14} />
                </span>
              </div>
            ))}
            {Object.values(schema).map((p) => (
              <MenuItem key={p.id} icon={<PropTypeIcon type={p.type} />} label={`Add filter: ${p.name}`} onClick={() => up({ filters: [...liveView.filters, { id: uid(6), prop: p.id, op: defaultOp(p.type) }] })} />
            ))}
          </>
        )}
        {panel === 'sort' && (
          <>
            {header('Sort')}
            {liveView.sorts.map((s) => (
              <div key={s.id} className="menu-item">
                <div className="menu-item-icon">{schema[s.prop] && <PropTypeIcon type={schema[s.prop].type} />}</div>
                <div className="menu-item-body">{schema[s.prop]?.name}</div>
                <span className="settings-link" onClick={() => up({ sorts: liveView.sorts.map((x) => (x.id === s.id ? { ...x, dir: x.dir === 'asc' ? 'desc' : 'asc' } : x)) })}>
                  {s.dir === 'asc' ? 'Ascending' : 'Descending'}
                </span>
                <span className="sort-x" onClick={() => up({ sorts: liveView.sorts.filter((x) => x.id !== s.id) })}>
                  <I.CloseIcon size={14} />
                </span>
              </div>
            ))}
            {Object.values(schema)
              .filter((p) => !liveView.sorts.some((s) => s.prop === p.id))
              .map((p) => (
                <MenuItem key={p.id} icon={<PropTypeIcon type={p.type} />} label={`Sort by ${p.name}`} onClick={() => up({ sorts: [...liveView.sorts, { id: uid(6), prop: p.id, dir: 'asc' }] })} />
              ))}
          </>
        )}
      </div>
      {editProp && <EditPropertyPanel dbId={db.id} propId={editProp.id} anchor={editProp.rect} onClose={() => setEditProp(null)} placement="right-start" />}
    </Popover>
  );
}
