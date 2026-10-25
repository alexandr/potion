import { useEffect, useState } from 'react';
import type { Block, ID, View } from '../../store/types';
import { useStore } from '../../store/store';
import * as I from '../ui/Icons';
import { DbToolbar, PillsRow, ViewTabs } from './Toolbar';
import { getRows } from './dbUtils';
import { TableView } from './views/Table';
import { BoardView } from './views/Board';
import { ListView, GalleryView, FeedView } from './views/ListGallery';
import { CalendarView } from './views/Calendar';
import { TimelineView } from './views/Timeline';
import { ChartView } from './views/Chart';
import { RowIcon } from './RowIcon';

/** remember active view without touching undo history */
function useActiveView(owner: Block | undefined, db: Block | undefined): [View | undefined, (id: ID) => void] {
  const views = (db?.props.views ?? []) as View[];
  const urlView = new URLSearchParams(location.search).get('v');
  const initial = views.find((v) => v.id === urlView)?.id ?? owner?.props.activeView ?? views[0]?.id;
  const [active, setActive] = useState<ID | undefined>(initial);
  const view = views.find((v) => v.id === active) ?? views[0];
  const set = (id: ID) => {
    setActive(id);
    if (owner) {
      useStore.setState((s) => {
        const b = s.blocks[owner.id];
        if (!b) return {};
        return { blocks: { ...s.blocks, [owner.id]: { ...b, props: { ...b.props, activeView: id } } } };
      });
    }
  };
  return [view, set];
}

function ViewBody({ db, view, search }: { db: Block; view: View; search: string }) {
  // subscribe to all blocks so row edits re-render views
  useStore((s) => s.blocks);
  const rows = getRows(db, view, search);
  const locked = !!db.props.locked;
  switch (view.type) {
    case 'table':
      return <TableView db={db} view={view} rows={rows} locked={locked} />;
    case 'board':
      return <BoardView db={db} view={view} rows={rows} locked={locked} />;
    case 'list':
      return <ListView db={db} view={view} rows={rows} locked={locked} />;
    case 'gallery':
      return <GalleryView db={db} view={view} rows={rows} locked={locked} />;
    case 'calendar':
      return <CalendarView db={db} view={view} rows={rows} locked={locked} />;
    case 'timeline':
      return <TimelineView db={db} view={view} rows={rows} locked={locked} />;
    case 'chart':
      return <ChartView db={db} view={view} rows={rows} />;
    case 'feed':
      return <FeedView db={db} view={view} rows={rows} locked={locked} />;
  }
  return null;
}

function DbTitle({ db }: { db: Block }) {
  const [editing, setEditing] = useState(false);
  const title = db.props.title as string;
  return (
    <div className="db-inline-title-row">
      {db.props.icon && <RowIcon row={db} size={22} />}
      {editing ? (
        <input
          autoFocus
          className="db-inline-title-input"
          defaultValue={title}
          placeholder="Untitled"
          onBlur={(e) => {
            if (e.target.value !== title) useStore.getState().setProps(db.id, { title: e.target.value });
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
          }}
        />
      ) : (
        <div className={`db-inline-title ${title ? '' : 'empty'}`} onClick={() => !db.props.locked && setEditing(true)}>
          {title || 'Untitled'}
        </div>
      )}
      {db.props.locked && (
        <span className="db-locked" title="Locked">
          <I.LockIcon size={14} />
        </span>
      )}
    </div>
  );
}

function DbFrame({ db, owner, full }: { db: Block; owner: Block; full?: boolean }) {
  const [view, setView] = useActiveView(owner, db);
  const [search, setSearch] = useState('');
  const [showPills, setShowPills] = useState(true);
  const hasPills = !!view && (view.filters.length > 0 || view.sorts.length > 0);
  useEffect(() => {
    if (view && (view.filters.length || view.sorts.length)) setShowPills(true);
  }, [view?.filters.length, view?.sorts.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!view) return <div className="db-empty-view">This database has no views.</div>;
  return (
    <div className={`db-frame ${full ? 'db-full' : 'db-inline'} view-${view.type}`} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {!full && <DbTitle db={db} />}
      <div className="db-header-row">
        <ViewTabs db={db} activeId={view.id} onSelect={setView} />
        <DbToolbar db={db} view={view} search={search} setSearch={setSearch} showPills={showPills} setShowPills={setShowPills} />
      </div>
      {hasPills && showPills && <PillsRow db={db} view={view} />}
      <div className="db-view-body">
        <ViewBody db={db} view={view} search={search} />
      </div>
    </div>
  );
}

export function DatabaseBlock({ id, inlineBlockId }: { id: ID; inlineBlockId: ID }) {
  const db = useStore((s) => s.blocks[id]);
  const owner = useStore((s) => s.blocks[inlineBlockId]);
  if (!db || db.type !== 'database' || !owner)
    return (
      <div className="db-missing">
        <I.TableIcon size={16} /> No access to this database
      </div>
    );
  if (db.props.trashed && db.id !== owner.id) return <div className="db-missing">This database is in the trash</div>;
  return <DbFrame db={db} owner={owner} />;
}

export function DatabaseFullPage({ id }: { id: ID }) {
  const db = useStore((s) => s.blocks[id]);
  if (!db || db.type !== 'database') return null;
  return <DbFrame db={db} owner={db} full />;
}
