import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, pageTitle, getPagePath, isTrashed } from '../../store/store';
import type { Block } from '../../store/types';
import { useUI } from '../../store/ui';
import { goPage, pagePath } from '../../lib/router';
import * as I from '../ui/Icons';
import { PageIconView } from '../ui/PageIcon';
import { relTime } from '../../lib/time';
import { MOD } from '../ui/Popover';

function plain(h: string) {
  const d = document.createElement('div');
  d.innerHTML = h;
  return d.textContent ?? '';
}

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function SearchModal() {
  const open = useUI((s) => s.searchOpen);
  const set = useUI((s) => s.set);
  const blocks = useStore((s) => s.blocks);
  const recent = useStore((s) => s.workspace.recent);
  const wsName = useStore((s) => s.workspace.name);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [titleOnly, setTitleOnly] = useState(false);
  const [sort, setSort] = useState<'best' | 'edited'>('best');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const pages = Object.values(blocks).filter((b) => (b.type === 'page' || (b.type === 'database' && !b.props.inline)) && !isTrashed(blocks, b.id));
    if (!q.trim()) {
      return recent
        .map((r) => blocks[r.id])
        .filter((b): b is Block => !!b && !isTrashed(blocks, b.id))
        .slice(0, 12)
        .map((b) => ({ b, snippet: '', section: sectionFor(recent.find((r) => r.id === b.id)!.at) }));
    }
    const s = q.toLowerCase();
    const out: { b: Block; score: number; snippet: string }[] = [];
    for (const p of pages) {
      const t = pageTitle(p).toLowerCase();
      let score = 0;
      let snippet = '';
      if (t === s) score = 100;
      else if (t.startsWith(s)) score = 80;
      else if (t.includes(s)) score = 60;
      if (!titleOnly) {
        // content search
        const walk = (id: string): string | null => {
          const b = blocks[id];
          if (!b) return null;
          for (const c of b.children) {
            const cb = blocks[c];
            if (!cb || cb.type === 'page' || cb.type === 'database') continue;
            const txt = plain(cb.text);
            if (txt.toLowerCase().includes(s)) return txt;
            const deep = walk(c);
            if (deep) return deep;
          }
          return null;
        };
        const hit = walk(p.id);
        if (hit) {
          if (!score) score = 30;
          snippet = hit;
        }
      }
      if (score) out.push({ b: p, score: score + p.updatedAt / 1e14, snippet });
    }
    out.sort((a, b) => (sort === 'edited' ? b.b.updatedAt - a.b.updatedAt : b.score - a.score));
    return out.slice(0, 30).map((x) => ({ b: x.b, snippet: x.snippet, section: 'Best matches' }));
  }, [q, blocks, recent, titleOnly, sort]);

  useEffect(() => {
    listRef.current?.querySelector('.sr-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;
  const close = () => set({ searchOpen: false });
  const openPage = (b: Block, newTab = false) => {
    close();
    if (newTab) window.open(pagePath(b.id, pageTitle(b)), '_blank');
    else goPage(b.id, pageTitle(b));
  };
  const actionsShown = q.trim() && 'new page'.includes(q.trim().toLowerCase());
  let last = '';

  return (
    <div className="modal-backdrop search-backdrop" onMouseDown={close}>
      <div className="search-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-input-row">
          <I.SearchIcon size={20} />
          <input
            autoFocus
            placeholder={`Search or ask a question in ${wsName}…`}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const r = results[active];
                if (r) openPage(r.b, e.metaKey || e.ctrlKey);
                else if (q.trim()) {
                  const id = useStore.getState().createPage('private', { title: q.trim() });
                  close();
                  goPage(id, q.trim());
                }
              } else if (e.key === 'Escape') close();
            }}
          />
          {q && (
            <span className="search-clear" onClick={() => setQ('')}>
              <I.CloseIcon size={14} />
            </span>
          )}
        </div>
        <div className="search-filters">
          <span className={`sf-pill ${sort === 'edited' ? 'on' : ''}`} onClick={() => setSort(sort === 'best' ? 'edited' : 'best')}>
            <I.SortIcon size={14} /> {sort === 'best' ? 'Best matches' : 'Last edited'}
          </span>
          <span className={`sf-pill ${titleOnly ? 'on' : ''}`} onClick={() => setTitleOnly(!titleOnly)}>
            <I.TextIcon size={14} /> Title only
          </span>
          <span className="sf-pill">
            <I.UserIcon size={14} /> Created by <I.ChevronDown size={10} />
          </span>
          <span className="sf-pill">
            <I.UsersIcon size={14} /> Teamspace <I.ChevronDown size={10} />
          </span>
          <span className="sf-pill">
            <I.PageIcon size={14} /> In <I.ChevronDown size={10} />
          </span>
          <span className="sf-pill">
            <I.CalendarIcon size={14} /> Date <I.ChevronDown size={10} />
          </span>
        </div>
        <div className="search-results" ref={listRef}>
          {results.length === 0 && q && (
            <div className="search-empty">
              <div className="se-title">No results</div>
              <div className="se-sub">Some pages may be in Trash. Try searching for something else.</div>
            </div>
          )}
          {results.map((r, i) => {
            const header = r.section !== last ? r.section : null;
            last = r.section;
            const path = getPagePath(blocks, r.b.id).slice(0, -1);
            return (
              <div key={r.b.id}>
                {header && <div className="sr-section">{header}</div>}
                <div className={`sr-item ${i === active ? 'active' : ''}`} onMouseMove={() => i !== active && setActive(i)} onClick={(e) => openPage(r.b, e.metaKey || e.ctrlKey)}>
                  <div className="sr-icon">
                    <PageIconView icon={r.b.props.icon} size={20} page={r.b} />
                  </div>
                  <div className="sr-text">
                    <div className="sr-title-row">
                      <span className="sr-title">{highlight(pageTitle(r.b), q)}</span>
                      {path.length > 0 && <span className="sr-path">— {path.map((p) => pageTitle(p)).join(' / ')}</span>}
                    </div>
                    {r.snippet && <div className="sr-snippet">{highlight(r.snippet.slice(0, 120), q)}</div>}
                  </div>
                  <div className="sr-meta">{i === active ? <span className="sr-enter">↵</span> : relTime(r.b.updatedAt)}</div>
                </div>
              </div>
            );
          })}
          {actionsShown && (
            <>
              <div className="sr-section">Actions</div>
              <div
                className="sr-item"
                onClick={() => {
                  const id = useStore.getState().createPage('private');
                  close();
                  goPage(id, '');
                }}
              >
                <div className="sr-icon">
                  <I.ComposeIcon size={20} />
                </div>
                <div className="sr-text">
                  <div className="sr-title">New page</div>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="search-footer">
          <span>
            <kbd>↑↓</kbd> Select
          </span>
          <span>
            <kbd>↵</kbd> Open
          </span>
          <span>
            <kbd>{MOD}↵</kbd> Open in new tab
          </span>
        </div>
      </div>
    </div>
  );
}

function sectionFor(at: number) {
  const now = new Date();
  const d = new Date(at);
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  const diff = (now.getTime() - at) / 86400000;
  if (diff < 7) return 'Past week';
  if (diff < 30) return 'Past 30 days';
  return 'Older';
}
