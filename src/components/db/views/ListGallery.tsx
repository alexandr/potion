import { useState } from 'react';
import type { Block, View } from '../../../store/types';
import * as I from '../../ui/Icons';
import { CellValue, Tag } from '../CellValue';
import { computeValue, groupRows, isEmptyValue, visibleProps, contentPreview } from '../dbUtils';
import { createAndOpen, openRow } from '../openRow';
import { Card, RowMenu } from './Board';
import { RowIcon } from '../RowIcon';

export function ListView({ db, view, rows, locked }: { db: Block; view: View; rows: Block[]; locked?: boolean }) {
  const props = visibleProps(db, view).filter((p) => p.id !== 'title');
  const [menu, setMenu] = useState<{ row: Block; rect: DOMRect } | null>(null);
  const groups = groupRows(db, view, rows);
  const renderRows = (list: Block[]) =>
    list.map((r) => (
      <div key={r.id} className="db-list-row" onClick={() => openRow(view, r.id)}>
        <div className="db-list-title">
          <RowIcon row={r} size={18} always />
          <span className={r.props.title ? '' : 'untitled'}>{r.props.title || 'Untitled'}</span>
        </div>
        <div className="db-list-props">
          {props.map((p) => {
            const v = computeValue(db, r, p);
            if (isEmptyValue(p, v)) return null;
            return (
              <span key={p.id} className={`db-list-prop type-${p.type}`}>
                <CellValue db={db} row={r} prop={p} />
              </span>
            );
          })}
        </div>
        {!locked && (
          <span
            className="card-action list-more"
            onClick={(e) => {
              e.stopPropagation();
              setMenu({ row: r, rect: e.currentTarget.getBoundingClientRect() });
            }}
          >
            <I.DotsIcon size={14} />
          </span>
        )}
      </div>
    ));
  return (
    <div className="db-list">
      {groups
        ? groups.filter((g) => g.rows.length).map((g) => (
            <div key={g.key} className="db-list-group">
              <div className="db-group-head">
                {g.option ? <Tag name={g.label} color={g.color} /> : <span className="group-label">{g.label}</span>}
                <span className="group-count">{g.rows.length}</span>
              </div>
              {renderRows(g.rows)}
            </div>
          ))
        : renderRows(rows)}
      {!locked && (
        <div className="db-new-row list" onClick={() => createAndOpen(db, view)}>
          <I.PlusIcon size={14} />
          <span>New page</span>
        </div>
      )}
      {menu && <RowMenu row={menu.row} view={view} anchor={menu.rect} onClose={() => setMenu(null)} />}
    </div>
  );
}

export function GalleryView({ db, view, rows, locked }: { db: Block; view: View; rows: Block[]; locked?: boolean }) {
  const [menu, setMenu] = useState<{ row: Block; rect: DOMRect } | null>(null);
  const size = view.cardSize ?? 'medium';
  const preview = view.cardPreview ?? 'cover';
  const groups = groupRows(db, view, rows);
  const grid = (list: Block[], showNew: boolean) => (
    <div className={`db-gallery size-${size}`}>
      {list.map((r) => (
        <Card key={r.id} db={db} view={view} row={r} preview={preview} className={`gallery-card preview-${preview}`} onMenu={locked ? undefined : (rect) => setMenu({ row: r, rect })} />
      ))}
      {showNew && !locked && (
        <div className="db-gallery-new" onClick={() => createAndOpen(db, view)}>
          <I.PlusIcon size={16} />
          <span>New page</span>
        </div>
      )}
    </div>
  );
  return (
    <div className="db-gallery-wrap">
      {groups
        ? groups.filter((g) => g.rows.length).map((g) => (
            <div key={g.key}>
              <div className="db-group-head">
                {g.option ? <Tag name={g.label} color={g.color} /> : <span className="group-label">{g.label}</span>}
                <span className="group-count">{g.rows.length}</span>
              </div>
              {grid(g.rows, false)}
            </div>
          ))
        : grid(rows, true)}
      {menu && <RowMenu row={menu.row} view={view} anchor={menu.rect} onClose={() => setMenu(null)} />}
    </div>
  );
}

export function FeedView({ db, view, rows, locked }: { db: Block; view: View; rows: Block[]; locked?: boolean }) {
  const props = visibleProps(db, view).filter((p) => p.id !== 'title');
  return (
    <div className="db-feed">
      {rows.map((r) => (
        <div key={r.id} className="db-feed-item" onClick={() => openRow(view, r.id)}>
          <div className="db-feed-title">
            <RowIcon row={r} size={20} />
            <span>{r.props.title || 'Untitled'}</span>
          </div>
          <div className="db-feed-props">
            {props.map((p) => {
              const v = computeValue(db, r, p);
              if (isEmptyValue(p, v)) return null;
              return (
                <span key={p.id}>
                  <CellValue db={db} row={r} prop={p} />
                </span>
              );
            })}
          </div>
          <div className="db-feed-content">
            {contentPreview(r, 6).map((b) => (
              <div key={b.id} className={`pv-line pv-${b.type}`} dangerouslySetInnerHTML={{ __html: b.text || '' }} />
            ))}
          </div>
        </div>
      ))}
      {!locked && (
        <div className="db-new-row list" onClick={() => createAndOpen(db, view)}>
          <I.PlusIcon size={14} />
          <span>New page</span>
        </div>
      )}
    </div>
  );
}
