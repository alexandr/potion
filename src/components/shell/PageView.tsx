import { useEffect, useRef, useState } from 'react';
import { useStore, pageTitle, isTrashed } from '../../store/store';
import type { ID } from '../../store/types';
import { useUI } from '../../store/ui';
import { PageEditor } from '../editor/PageEditor';
import * as I from '../ui/Icons';
import { PageIconView } from '../ui/PageIcon';
import { EmojiPopover, randomEmoji } from '../ui/EmojiPicker';
import { coverStyle, GRADIENTS, GALLERY_PHOTOS, randomCover } from '../../lib/covers';
import { Popover } from '../ui/Popover';
import { focusBlock } from '../editor/actions';
import { DatabaseFullPage } from '../db/Database';
import { PageProperties } from '../db/Properties';
import { goPage } from '../../lib/router';
import { PageComments } from './Comments';
import { relTime } from '../../lib/time';
import { BRAND } from '../../lib/brand';

export function PageView({ pageId, peek }: { pageId: ID; peek?: boolean }) {
  const page = useStore((s) => s.blocks[pageId]);
  const blocks = useStore((s) => s.blocks);
  const trashed = useStore((s) => isTrashed(s.blocks, pageId));
  const [iconAnchor, setIconAnchor] = useState<HTMLElement | null>(null);
  const [coverMenu, setCoverMenu] = useState<DOMRect | null>(null);
  const [repos, setRepos] = useState<number | null>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [showBl, setShowBl] = useState(false);

  useEffect(() => {
    if (!page) return;
    useStore.getState().visit(pageId);
    document.title = pageTitle(page) + ` | ${BRAND}`;
    // focus title of new empty pages
    if (!page.props.title && page.children.length === 0 && titleRef.current) {
      titleRef.current.focus();
    }
    const t = setTimeout(() => useStore.getState().saveVersion(pageId), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // snapshot for version history after a pause in editing
  useEffect(() => {
    if (!page) return;
    const t = setTimeout(() => useStore.getState().saveVersion(pageId), 15000);
    return () => clearTimeout(t);
  }, [page?.updatedAt, pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = titleRef.current;
    if (el && document.activeElement !== el && el.textContent !== (page?.props.title ?? '')) el.textContent = page?.props.title ?? '';
  }, [page?.props.title]);

  if (!page) return <div className="page-missing">This page does not exist or was deleted.</div>;
  const isDb = page.type === 'database';
  const isRow = !!page.parent && blocks[page.parent]?.type === 'database';
  const locked = !!page.props.locked;
  const fullWidth = !!page.props.fullWidth || (isDb && !peek);
  const font = page.props.font ?? 'default';
  const cover = page.props.cover as string | undefined;
  const s = useStore.getState;

  const backlinks = Object.values(blocks).filter((b) => {
    if (b.props.trashed) return false;
    if (b.type === 'link_to_page' && b.props.pageId === pageId) return true;
    return b.text && b.text.includes(`data-page="${pageId}"`);
  });
  const blPages = Array.from(
    new Map(
      backlinks
        .map((b) => {
          let cur = b.parent ? blocks[b.parent] : undefined;
          while (cur && cur.type !== 'page') cur = cur.parent ? blocks[cur.parent] : undefined;
          return cur;
        })
        .filter((p): p is NonNullable<typeof p> => !!p && p.id !== pageId && !isTrashed(blocks, p.id))
        .map((p) => [p.id, p]),
    ).values(),
  );

  const onTitleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isDb) return;
      const st = s();
      const first = st.blocks[pageId].children[0];
      const fb = first ? st.blocks[first] : undefined;
      if (fb && fb.type === 'text' && !fb.text) focusBlock(fb.id, 'start');
      else {
        const id = st.createBlock(pageId, 0, 'text');
        focusBlock(id, 'start');
      }
    } else if (e.key === 'ArrowDown') {
      const first = s().blocks[pageId].children.find((c) => ['text', 'h1', 'h2', 'h3', 'todo', 'bulleted', 'numbered', 'toggle', 'quote', 'callout', 'code'].includes(s().blocks[c]?.type));
      if (first) {
        e.preventDefault();
        focusBlock(first, 'start');
      }
    }
  };

  const startReposition = () => setRepos(page.props.coverPos ?? 50);

  return (
    <div className={`page-frame font-${font} ${page.props.smallText ? 'small-text' : ''} ${fullWidth ? 'full-width' : ''} ${peek ? 'in-peek' : ''} ${locked ? 'locked' : ''}`}>
      {trashed && (
        <div className="trash-banner">
          <span>This page is in Trash.</span>
          <button className="banner-btn" onClick={() => s().restorePage(rootTrashed(pageId))}>
            <I.ArrowUturnIcon size={14} /> Restore page
          </button>
          <button
            className="banner-btn"
            onClick={() => {
              if (confirm('Are you sure you want to permanently delete this page? You won’t be able to view or restore it.')) {
                s().deleteForever(rootTrashed(pageId));
                goPage(null);
              }
            }}
          >
            <I.TrashIcon size={14} /> Delete from Trash
          </button>
        </div>
      )}
      {cover && (
        <div
          className={`page-cover ${repos != null ? 'repositioning' : ''}`}
          style={coverStyle(cover, repos ?? page.props.coverPos ?? 50) ?? undefined}
          onMouseDown={(e) => {
            if (repos == null) return;
            e.preventDefault();
            const y0 = e.clientY;
            const p0 = repos;
            const h = (e.currentTarget as HTMLElement).getBoundingClientRect().height;
            const move = (ev: MouseEvent) => setRepos(Math.max(0, Math.min(100, p0 - ((ev.clientY - y0) / h) * 100)));
            const up = () => {
              window.removeEventListener('mousemove', move);
              window.removeEventListener('mouseup', up);
            };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
          }}
        >
          {repos != null && <div className="cover-drag-hint">Drag image to reposition</div>}
          {!locked && (
            <div className="cover-controls">
              {repos == null ? (
                <>
                  <button onClick={(e) => setCoverMenu(e.currentTarget.getBoundingClientRect())}>Change cover</button>
                  {!GRADIENTS[cover] && <button onClick={startReposition}>Reposition</button>}
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      s().setProps(pageId, { coverPos: repos });
                      setRepos(null);
                    }}
                  >
                    Save position
                  </button>
                  <button onClick={() => setRepos(null)}>Cancel</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <div className="page-content">
        <div className={`page-header ${cover ? 'has-cover' : ''} ${page.props.icon ? 'has-icon' : ''}`}>
          {page.props.icon && (
            <div className="page-icon-big" onClick={(e) => !locked && setIconAnchor(e.currentTarget)}>
              <PageIconView icon={page.props.icon} size={78} />
            </div>
          )}
          {!locked && (
            <div className="page-controls">
              {!page.props.icon && (
                <div
                  className="pc-btn"
                  onClick={(e) => {
                    s().setProps(pageId, { icon: randomEmoji() });
                    void e;
                  }}
                >
                  <I.SmileIcon size={16} /> Add icon
                </div>
              )}
              {!cover && (
                <div className="pc-btn" onClick={() => s().setProps(pageId, { cover: randomCover(), coverPos: 50 })}>
                  <I.ImageIcon size={16} /> Add cover
                </div>
              )}
              {!isDb && (
                <div
                  className="pc-btn"
                  onClick={() => {
                    s().setProps(pageId, { showPageComments: true });
                    setTimeout(() => (document.querySelector('.page-comment-input') as HTMLElement | null)?.focus(), 30);
                  }}
                >
                  <I.CommentIcon size={16} /> Add comment
                </div>
              )}
              {isDb && (
                <div className="pc-btn" onClick={() => s().setProps(pageId, { showDescription: !page.props.showDescription })}>
                  <I.ParagraphIcon size={16} /> {page.props.showDescription ? 'Hide description' : 'Add description'}
                </div>
              )}
            </div>
          )}
          <div
            ref={titleRef}
            className="page-title"
            contentEditable={!locked}
            suppressContentEditableWarning
            data-placeholder={isDb ? 'Untitled' : isRow ? 'Untitled' : 'New page'}
            onInput={(e) => s().setProps(pageId, { title: e.currentTarget.textContent ?? '' }, `title:${pageId}`)}
            onKeyDown={onTitleKey}
            onPaste={(e) => {
              e.preventDefault();
              document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\n/g, ' '));
            }}
            spellCheck
          />
          {isDb && page.props.showDescription && (
            <div
              className="db-description"
              contentEditable={!locked}
              suppressContentEditableWarning
              data-placeholder="Add a description…"
              onBlur={(e) => s().setProps(pageId, { description: e.currentTarget.innerHTML })}
              dangerouslySetInnerHTML={{ __html: page.props.description ?? '' }}
            />
          )}
          {isRow && <PageProperties pageId={pageId} />}
          {page.props.showBacklinks !== false && blPages.length > 0 && (
            <div className="backlinks">
              <div className="bl-toggle" onClick={() => setShowBl(!showBl)}>
                <I.ArrowUpRight size={14} /> {blPages.length} backlink{blPages.length > 1 ? 's' : ''}
              </div>
              {showBl && (
                <div className="bl-list">
                  {blPages.map((p) => (
                    <div key={p.id} className="bl-item" onClick={() => goPage(p.id, pageTitle(p))}>
                      <PageIconView icon={p.props.icon} size={16} page={p} />
                      <span>{pageTitle(p)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {!isDb && <PageComments pageId={pageId} />}
        </div>
        {!isDb && (
          <div className="page-body">
            {page.children.length === 0 && !locked ? (
              <EmptyPageHints pageId={pageId} />
            ) : (
              <PageEditor pageId={pageId} readOnly={locked} />
            )}
          </div>
        )}
      </div>
      {isDb && (
        <div className="db-page-body">
          <DatabaseFullPage id={pageId} />
        </div>
      )}
      {page.props.floatingToc && !isDb && <FloatingToc pageId={pageId} />}
      {iconAnchor && (
        <EmojiPopover
          anchor={iconAnchor}
          onClose={() => setIconAnchor(null)}
          onPick={(e) => {
            s().setProps(pageId, { icon: e });
            setIconAnchor(null);
          }}
          onRemove={() => {
            s().setProps(pageId, { icon: undefined });
            setIconAnchor(null);
          }}
        />
      )}
      {coverMenu && <CoverPicker pageId={pageId} anchor={coverMenu} onClose={() => setCoverMenu(null)} />}
    </div>
  );
}

function rootTrashed(id: ID) {
  const blocks = useStore.getState().blocks;
  let cur = blocks[id];
  while (cur) {
    if (cur.props.trashed) return cur.id;
    cur = blocks[cur.parent ?? ''];
  }
  return id;
}

function EmptyPageHints({ pageId }: { pageId: ID }) {
  const s = useStore.getState;
  const start = (type?: 'todo') => {
    const id = s().createBlock(pageId, 0, type ?? 'text');
    focusBlock(id, 'start');
  };
  return (
    <div className="empty-page">
      <div className="empty-page-click" onClick={() => start()}>
        <div className="empty-page-ph">Press Enter to continue with an empty page, or pick a template (↑↓ to select)</div>
      </div>
      <div className="empty-hints">
        <div className="eh-item" onClick={() => useUI.getState().showToast(`${BRAND} AI is not available in this demo workspace`)}>
          <I.SparkleIcon size={16} /> Ask AI
        </div>
        <div className="eh-item" onClick={() => start('todo')}>
          <I.CheckboxIcon size={16} /> To-do list
        </div>
        <div
          className="eh-item"
          onClick={() => {
            const st = s();
            st.createDatabase(pageId, true, 0, 'table');
          }}
        >
          <I.TableIcon size={16} /> Database
        </div>
        <div className="eh-item" onClick={() => useUI.getState().set({ templatesOpen: true })}>
          <I.TemplatesIcon size={16} /> Templates
        </div>
        <div className="eh-item" onClick={() => start()}>
          <I.DotsIcon size={16} /> More
        </div>
      </div>
    </div>
  );
}

function CoverPicker({ pageId, anchor, onClose }: { pageId: ID; anchor: DOMRect; onClose: () => void }) {
  const [tab, setTab] = useState<'gallery' | 'upload' | 'link'>('gallery');
  const [link, setLink] = useState('');
  const set = (c: string | undefined) => {
    useStore.getState().setProps(pageId, { cover: c, coverPos: 50 });
    onClose();
  };
  return (
    <Popover anchor={anchor} onClose={onClose} width={540} placement="bottom-end">
      <div className="cover-picker">
        <div className="mpk-tabs">
          {(['gallery', 'upload', 'link'] as const).map((t) => (
            <div key={t} className={`mpk-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div className="mpk-tab" onClick={() => set(undefined)}>
            Remove
          </div>
        </div>
        <div className="cover-body">
          {tab === 'gallery' && (
            <>
              <div className="cover-section-title">Color & Gradient</div>
              <div className="cover-grid">
                {Object.entries(GRADIENTS).map(([k, v]) => (
                  <div key={k} className="cover-thumb" style={{ background: v }} onClick={() => set(k)} />
                ))}
              </div>
              <div className="cover-section-title">Photography</div>
              <div className="cover-grid">
                {GALLERY_PHOTOS.map((u) => (
                  <div key={u} className="cover-thumb" style={{ backgroundImage: `url(${u.replace('w=1500', 'w=300')})` }} onClick={() => set(u)} />
                ))}
              </div>
            </>
          )}
          {tab === 'upload' && (
            <div className="mpk-body">
              <label className="btn-outline wide">
                Upload file
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => set(r.result as string);
                    r.readAsDataURL(f);
                  }}
                />
              </label>
              <div className="mpk-hint">Images wider than 1500 pixels work best.</div>
            </div>
          )}
          {tab === 'link' && (
            <div className="mpk-body">
              <input autoFocus className="text-input" placeholder="Paste an image link…" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && link && set(link)} />
              <button className="btn-primary wide" style={{ marginTop: 10 }} onClick={() => link && set(link)}>
                Submit
              </button>
              <div className="mpk-hint">Works with any image from the web.</div>
            </div>
          )}
        </div>
      </div>
    </Popover>
  );
}

function FloatingToc({ pageId }: { pageId: ID }) {
  const blocks = useStore((s) => s.blocks);
  const heads: { id: ID; type: string; text: string }[] = [];
  const walk = (id: ID) => {
    const b = blocks[id];
    if (!b) return;
    for (const c of b.children) {
      const cb = blocks[c];
      if (!cb || cb.type === 'page' || cb.type === 'database') continue;
      if (['h1', 'h2', 'h3'].includes(cb.type)) {
        const d = document.createElement('div');
        d.innerHTML = cb.text;
        heads.push({ id: cb.id, type: cb.type, text: d.textContent || 'Untitled' });
      }
      walk(c);
    }
  };
  walk(pageId);
  if (!heads.length) return null;
  return (
    <div className="floating-toc">
      <div className="ftoc-lines">
        {heads.map((h) => (
          <div key={h.id} className={`ftoc-line ${h.type}`} />
        ))}
      </div>
      <div className="ftoc-panel">
        {heads.map((h) => (
          <div key={h.id} className={`ftoc-item ${h.type}`} onClick={() => document.querySelector(`[data-block-id="${h.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            {h.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export { relTime };
