import { useEffect, useRef } from 'react';
import { useStore, pageTitle } from '../../store/store';
import { setPeek, goPage, pagePath } from '../../lib/router';
import { PageView } from './PageView';
import * as I from '../ui/Icons';
import { Tooltip } from '../ui/Tooltip';
import { useUI } from '../../store/ui';

export function Peek({ id, mode }: { id: string; mode: 's' | 'c' }) {
  const page = useStore((s) => s.blocks[id]);
  const db = useStore((s) => (page?.parent ? s.blocks[page.parent] : undefined));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.popover, .modal-backdrop')) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae?.classList.contains('page-title')) {
        ae.blur();
        return;
      }
      if (ae?.isContentEditable || ae?.tagName === 'INPUT' || ae?.tagName === 'TEXTAREA') return;
      if (useUI.getState().selected.length) return;
      setPeek(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  if (!page) return null;
  const rows = db?.type === 'database' ? db.children.filter((c) => !useStore.getState().blocks[c]?.props.trashed) : [];
  const idx = rows.indexOf(id);
  const body = (
    <div className={`peek-panel ${mode === 'c' ? 'center' : 'side'}`} ref={ref} onMouseDown={(e) => e.stopPropagation()}>
      <div className="peek-top">
        <Tooltip label="Close" shortcut="Esc">
          <div className="tb-icon" onClick={() => setPeek(null)}>
            <I.DoubleChevronRight size={18} />
          </div>
        </Tooltip>
        <Tooltip label="Open as full page">
          <div className="tb-icon" onClick={() => goPage(id, pageTitle(page))}>
            <I.ExpandIcon size={16} />
          </div>
        </Tooltip>
        <Tooltip label={mode === 's' ? 'Open in center peek' : 'Open in side peek'}>
          <div className="tb-icon" onClick={() => setPeek(id, mode === 's' ? 'c' : 's')}>
            {mode === 's' ? <I.CenterPeekIcon size={18} /> : <I.SidePeekIcon size={18} />}
          </div>
        </Tooltip>
        {rows.length > 1 && (
          <>
            <Tooltip label="Previous page" shortcut="⌃⇧K">
              <div className={`tb-icon ${idx <= 0 ? 'disabled' : ''}`} onClick={() => idx > 0 && setPeek(rows[idx - 1], mode)}>
                <I.ArrowUpIcon size={16} />
              </div>
            </Tooltip>
            <Tooltip label="Next page" shortcut="⌃⇧J">
              <div className={`tb-icon ${idx >= rows.length - 1 ? 'disabled' : ''}`} onClick={() => idx < rows.length - 1 && setPeek(rows[idx + 1], mode)}>
                <I.ArrowDownIcon size={16} />
              </div>
            </Tooltip>
          </>
        )}
        <div style={{ flex: 1 }} />
        <div
          className="tb-text-btn"
          onClick={() => {
            navigator.clipboard?.writeText(location.origin + pagePath(id, pageTitle(page))).catch(() => {});
            useUI.getState().showToast('Copied link to clipboard');
          }}
        >
          Share
        </div>
        <div className="tb-icon" onClick={() => useStore.getState().toggleFavorite(id)}>
          {useStore.getState().workspace.favorites.includes(id) ? <I.StarFilled size={18} style={{ color: 'var(--favorite)' }} /> : <I.StarIcon size={18} />}
        </div>
        <div
          className="tb-icon"
          onClick={() => {
            useStore.getState().trashPage(id);
            setPeek(null);
            useUI.getState().showToast('Moved to Trash');
          }}
          title="Delete"
        >
          <I.TrashIcon size={18} />
        </div>
      </div>
      <div className="peek-scroll scroller">
        <PageView pageId={id} peek />
      </div>
    </div>
  );
  if (mode === 'c')
    return (
      <div className="peek-overlay" onMouseDown={() => setPeek(null)}>
        {body}
      </div>
    );
  return body;
}
