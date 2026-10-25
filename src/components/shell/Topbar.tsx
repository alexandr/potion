import { useState } from 'react';
import { useStore, getPagePath, pageTitle } from '../../store/store';
import type { ID } from '../../store/types';
import { useUI } from '../../store/ui';
import { goPage, pagePath } from '../../lib/router';
import * as I from '../ui/Icons';
import { PageIconView } from '../ui/PageIcon';
import { Popover, MenuItem, MenuSep, Toggle, MOD, SHIFT } from '../ui/Popover';
import { Tooltip } from '../ui/Tooltip';
import { editedLabel, relTime } from '../../lib/time';
import { PagePicker } from '../editor/InlineMenus';
import { exportPage } from '../../lib/exporter';
import { RenameBox } from './Sidebar';

export function Breadcrumbs({ pageId }: { pageId: ID }) {
  const blocks = useStore((s) => s.blocks);
  const ws = useStore((s) => s.workspace);
  const path = getPagePath(blocks, pageId);
  const [rename, setRename] = useState<DOMRect | null>(null);
  const [more, setMore] = useState<DOMRect | null>(null);
  const isTeam = path[0] && ws.teamPages.includes(path[0].id);
  let shown = path;
  let hidden: typeof path = [];
  if (path.length > 4) {
    hidden = path.slice(1, path.length - 2);
    shown = [path[0], ...path.slice(path.length - 2)];
  }
  return (
    <div className="breadcrumbs">
      {isTeam && (
        <>
          <div className="crumb">
            <span className="crumb-emoji">🏢</span>
            <span className="crumb-title">General</span>
          </div>
          <span className="crumb-sep">/</span>
        </>
      )}
      {shown.map((p, i) => (
        <span key={p.id} className="crumb-wrap">
          {i > 0 && <span className="crumb-sep">/</span>}
          {hidden.length > 0 && i === 1 && (
            <>
              <div className="crumb" onClick={(e) => setMore(e.currentTarget.getBoundingClientRect())}>
                …
              </div>
              <span className="crumb-sep">/</span>
            </>
          )}
          <div
            className="crumb"
            onClick={(e) => {
              if (p.id === pageId) setRename(e.currentTarget.getBoundingClientRect());
              else goPage(p.id, pageTitle(p));
            }}
          >
            <PageIconView icon={p.props.icon} size={16} page={p} fallback="none" />
            <span className="crumb-title">{pageTitle(p)}</span>
          </div>
        </span>
      ))}
      {path.at(-1)?.props.locked && (
        <div className="locked-pill" onClick={() => useStore.getState().setProps(pageId, { locked: false })}>
          <I.LockIcon size={14} /> Locked
        </div>
      )}
      {rename && (
        <Popover anchor={rename} onClose={() => setRename(null)} width={360} offset={2}>
          <RenameBox id={pageId} onDone={() => setRename(null)} />
        </Popover>
      )}
      {more && (
        <Popover anchor={more} onClose={() => setMore(null)} width={260}>
          <div className="menu">
            {hidden.map((p) => (
              <MenuItem key={p.id} icon={<PageIconView icon={p.props.icon} size={18} page={p} />} label={pageTitle(p)} onClick={() => { setMore(null); goPage(p.id, pageTitle(p)); }} />
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}

export function Topbar({ pageId }: { pageId: ID | null }) {
  const page = useStore((s) => (pageId ? s.blocks[pageId] : undefined));
  const favorites = useStore((s) => s.workspace.favorites);
  const collapsed = useStore((s) => s.settings.sidebarCollapsed);
  const discussions = useStore((s) => s.discussions);
  const ui = useUI();
  const [share, setShare] = useState<DOMRect | null>(null);
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [updates, setUpdates] = useState<DOMRect | null>(null);
  const isFav = pageId ? favorites.includes(pageId) : false;
  const openDiscussions = Object.values(discussions).filter((d) => d.pageId === pageId && !d.resolved).length;

  return (
    <header className="topbar">
      {collapsed && (
        <Tooltip label="Open sidebar" shortcut={`${MOD}\\`}>
          <div
            className="tb-icon menu-btn"
            onMouseEnter={() => ui.set({ sidebarPeek: true })}
            onClick={() => useStore.getState().updateSettings({ sidebarCollapsed: false })}
          >
            <span className="menu-icon-default">
              <I.MenuIcon size={20} />
            </span>
            <span className="menu-icon-hover">
              <I.DoubleChevronRight size={18} />
            </span>
          </div>
        </Tooltip>
      )}
      {pageId && page ? (
        <Breadcrumbs pageId={pageId} />
      ) : (
        <div className="breadcrumbs">
          <div className="crumb">
            <I.HomeIcon size={16} />
            <span className="crumb-title">Home</span>
          </div>
        </div>
      )}
      <div style={{ flex: 1 }} />
      {pageId && page && (
        <div className="topbar-right">
          <Tooltip label={`Edited by ${useStore.getState().users[page.lastEditedBy]?.name ?? 'Unknown'} ${relTime(page.updatedAt, true)}`}>
            <div className="tb-edited">{editedLabel(page.updatedAt)}</div>
          </Tooltip>
          <div className="tb-text-btn" onClick={(e) => setShare(e.currentTarget.getBoundingClientRect())}>
            Share
          </div>
          <Tooltip label="View all comments" shortcut={`${MOD}${SHIFT}U`}>
            <div className={`tb-icon ${ui.commentsOpen ? 'active' : ''}`} onClick={() => ui.set({ commentsOpen: !ui.commentsOpen })}>
              <I.CommentIcon size={20} />
              {openDiscussions > 0 && <span className="tb-dot" />}
            </div>
          </Tooltip>
          <Tooltip label="View all updates">
            <div className="tb-icon" onClick={(e) => setUpdates(e.currentTarget.getBoundingClientRect())}>
              <I.ClockIcon size={20} />
            </div>
          </Tooltip>
          <Tooltip label={isFav ? 'Remove from Favorites' : 'Add to Favorites'}>
            <div className="tb-icon" onClick={() => useStore.getState().toggleFavorite(pageId)}>
              {isFav ? <I.StarFilled size={20} style={{ color: 'var(--favorite)' }} /> : <I.StarIcon size={20} />}
            </div>
          </Tooltip>
          <Tooltip label="Style, export, and more…">
            <div className="tb-icon" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
              <I.DotsIcon size={20} />
            </div>
          </Tooltip>
        </div>
      )}
      {share && pageId && <ShareMenu pageId={pageId} anchor={share} onClose={() => setShare(null)} />}
      {menu && pageId && <PageMenu pageId={pageId} anchor={menu} onClose={() => setMenu(null)} />}
      {updates && pageId && <UpdatesPopover pageId={pageId} anchor={updates} onClose={() => setUpdates(null)} />}
    </header>
  );
}

function ShareMenu({ pageId, anchor, onClose }: { pageId: ID; anchor: DOMRect; onClose: () => void }) {
  const page = useStore((s) => s.blocks[pageId]);
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.me);
  const [tab, setTab] = useState<'share' | 'publish'>('share');
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState<DOMRect | null>(null);
  const general = page.props.generalAccess ?? 'invited';
  const published = !!page.props.published;
  const url = location.origin + pagePath(pageId, pageTitle(page));
  const invited: string[] = page.props.invited ?? [];
  return (
    <Popover anchor={anchor} onClose={onClose} width={480} placement="bottom-end">
      <div className="share-menu">
        <div className="share-tabs">
          <div className={`share-tab ${tab === 'share' ? 'on' : ''}`} onClick={() => setTab('share')}>
            Share
          </div>
          <div className={`share-tab ${tab === 'publish' ? 'on' : ''}`} onClick={() => setTab('publish')}>
            Publish
            {published && <span className="pub-dot" />}
          </div>
        </div>
        {tab === 'share' ? (
          <div className="share-body">
            <div className="share-invite">
              <input className="text-input" placeholder="Email or group, separated by commas" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button
                className="btn-primary"
                disabled={!email.trim()}
                onClick={() => {
                  useStore.getState().setProps(pageId, { invited: [...invited, ...email.split(',').map((x) => x.trim()).filter(Boolean)] });
                  setEmail('');
                  useUI.getState().showToast('Invitation sent');
                }}
              >
                Invite
              </button>
            </div>
            <div className="share-people">
              <div className="share-person">
                <div className="avatar md" style={{ background: users[me].color }}>
                  {users[me].name[0]}
                </div>
                <div className="sp-text">
                  <div className="sp-name">{users[me].name} <span className="sp-you">(You)</span></div>
                  <div className="sp-email">{users[me].email}</div>
                </div>
                <div className="sp-role">Full access</div>
              </div>
              {invited.map((m) => (
                <div className="share-person" key={m}>
                  <div className="avatar md" style={{ background: '#9b9a97' }}>{m[0]?.toUpperCase()}</div>
                  <div className="sp-text">
                    <div className="sp-name">{m}</div>
                    <div className="sp-email">Invited</div>
                  </div>
                  <div className="sp-role">Can edit</div>
                </div>
              ))}
            </div>
            <div className="share-section-title">General access</div>
            <div className="share-general" onClick={(e) => setAccess(e.currentTarget.getBoundingClientRect())}>
              <div className={`ga-icon ${general}`}>{general === 'invited' ? <I.LockIcon size={18} /> : general === 'workspace' ? <I.UsersIcon size={18} /> : <I.GlobeIcon size={18} />}</div>
              <div className="sp-text">
                <div className="sp-name">
                  {general === 'invited' ? 'Only people invited' : general === 'workspace' ? `Everyone at ${useStore.getState().workspace.name}` : 'Anyone on the web with link'}
                  <I.ChevronDown size={12} />
                </div>
                <div className="sp-email">{general === 'invited' ? 'Only you and people invited can access' : general === 'workspace' ? 'Workspace members can access with the link' : 'Anyone with the link can view'}</div>
              </div>
            </div>
            <div className="share-footer">
              <div className="share-learn">
                <I.QuestionIcon size={16} /> Learn about sharing
              </div>
              <button
                className="btn-outline"
                onClick={() => {
                  navigator.clipboard?.writeText(url).catch(() => {});
                  useUI.getState().showToast('Copied link to clipboard');
                }}
              >
                <I.LinkIcon size={16} /> Copy link
              </button>
            </div>
            {access && (
              <Popover anchor={access} onClose={() => setAccess(null)} width={320}>
                <div className="menu">
                  {[
                    ['invited', 'Only people invited', 'Only you and people invited can access'],
                    ['workspace', `Everyone at ${useStore.getState().workspace.name}`, 'Workspace members can access with the link'],
                    ['web', 'Anyone on the web with link', 'Anyone with the link can view'],
                  ].map(([k, l, d]) => (
                    <MenuItem key={k} label={l} description={d} checked={general === k} onClick={() => { useStore.getState().setProps(pageId, { generalAccess: k }); setAccess(null); }} />
                  ))}
                </div>
              </Popover>
            )}
          </div>
        ) : (
          <div className="share-body publish-body">
            {!published ? (
              <>
                <div className="publish-illus">
                  <I.GlobeIcon size={48} />
                </div>
                <div className="publish-title">Publish to web</div>
                <div className="publish-desc">Create a website with Potion.</div>
                <button className="btn-primary wide" onClick={() => useStore.getState().setProps(pageId, { published: true })}>
                  Publish
                </button>
              </>
            ) : (
              <>
                <div className="publish-url">
                  <I.GlobeIcon size={16} />
                  <span>{url}</span>
                </div>
                <div className="publish-row">
                  <span>Allow editing</span>
                  <Toggle on={!!page.props.pubEdit} onChange={(v) => useStore.getState().setProps(pageId, { pubEdit: v })} />
                </div>
                <div className="publish-row">
                  <span>Allow comments</span>
                  <Toggle on={!!page.props.pubComment} onChange={(v) => useStore.getState().setProps(pageId, { pubComment: v })} />
                </div>
                <div className="publish-row">
                  <span>Allow duplicate as template</span>
                  <Toggle on={page.props.pubDup !== false} onChange={(v) => useStore.getState().setProps(pageId, { pubDup: v })} />
                </div>
                <div className="publish-row">
                  <span>Search engine indexing</span>
                  <Toggle on={!!page.props.pubIndex} onChange={(v) => useStore.getState().setProps(pageId, { pubIndex: v })} />
                </div>
                <div className="share-footer">
                  <button className="btn-outline" onClick={() => useStore.getState().setProps(pageId, { published: false })}>
                    Unpublish
                  </button>
                  <button className="btn-primary" onClick={() => window.open(url, '_blank')}>
                    View site
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Popover>
  );
}

export function PageMenu({ pageId, anchor, onClose }: { pageId: ID; anchor: DOMRect; onClose: () => void }) {
  const page = useStore((s) => s.blocks[pageId]);
  const blocks = useStore((s) => s.blocks);
  const users = useStore((s) => s.users);
  const [q, setQ] = useState('');
  const [moveTo, setMoveTo] = useState<DOMRect | null>(null);
  const [exp, setExp] = useState(false);
  const s = useStore.getState;
  const font = page.props.font ?? 'default';
  const words = (() => {
    let n = 0;
    const walk = (id: ID) => {
      const b = blocks[id];
      if (!b) return;
      if (b.text) {
        const d = document.createElement('div');
        d.innerHTML = b.text;
        n += (d.textContent ?? '').split(/\s+/).filter(Boolean).length;
      }
      b.children.forEach((c) => blocks[c]?.type !== 'page' && walk(c));
    };
    walk(pageId);
    return n;
  })();
  const url = location.origin + pagePath(pageId, pageTitle(page));
  const item = (label: string, el: React.ReactNode) => (!q || label.toLowerCase().includes(q.toLowerCase()) ? el : null);
  return (
    <Popover anchor={anchor} onClose={onClose} width={265} placement="bottom-end">
      <div className="menu page-menu">
        <div className="menu-search">
          <input autoFocus placeholder="Search actions…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!q && (
          <div className="font-tiles">
            {(['default', 'serif', 'mono'] as const).map((f) => (
              <div key={f} className={`font-tile ${font === f ? 'on' : ''}`} onClick={() => s().setProps(pageId, { font: f })}>
                <div className={`ft-aa font-${f}`}>Ag</div>
                <div className="ft-label">{f[0].toUpperCase() + f.slice(1)}</div>
              </div>
            ))}
          </div>
        )}
        <MenuSep />
        {item('Copy link', <MenuItem icon={<I.LinkIcon size={16} />} label="Copy link" shortcut={`${MOD}L`} onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); useUI.getState().showToast('Copied link to clipboard'); onClose(); }} />)}
        {item('Copy page contents', <MenuItem icon={<I.DuplicateIcon size={16} />} label="Copy page contents" onClick={() => { import('../editor/clipboard').then((c) => { navigator.clipboard?.writeText(c.blocksToMarkdown(c.serializeBlocks(page.children))).catch(() => {}); useUI.getState().showToast('Copied page contents'); }); onClose(); }} />)}
        {item('Duplicate', <MenuItem icon={<I.DuplicateIcon size={16} />} label="Duplicate" shortcut={`${MOD}D`} onClick={() => { const n = s().duplicateBlock(pageId); onClose(); goPage(n, ''); }} />)}
        {item('Move to', <MenuItem icon={<I.MoveToIcon size={16} />} label="Move to" shortcut={`${MOD}${SHIFT}P`} onClick={(e) => setMoveTo((e.currentTarget as HTMLElement).getBoundingClientRect())} />)}
        {item('Move to Trash', <MenuItem icon={<I.TrashIcon size={16} />} label="Move to Trash" onClick={() => { s().trashPage(pageId); onClose(); useUI.getState().showToast('Moved to Trash'); }} />)}
        <MenuSep />
        {item('Small text', <MenuItem label="Small text" icon={<I.FontIcon size={16} />} right={<Toggle on={!!page.props.smallText} />} onClick={() => s().setProps(pageId, { smallText: !page.props.smallText })} />)}
        {item('Full width', <MenuItem label="Full width" icon={<I.ExpandIcon size={16} />} shortcut="" right={<Toggle on={!!page.props.fullWidth} />} onClick={() => s().setProps(pageId, { fullWidth: !page.props.fullWidth })} />)}
        {item('Lock page', <MenuItem label="Lock page" icon={<I.LockIcon size={16} />} right={<Toggle on={!!page.props.locked} />} onClick={() => s().setProps(pageId, { locked: !page.props.locked })} />)}
        <MenuSep />
        {item('Customize page', <MenuItem icon={<I.SlidersIcon size={16} />} label="Backlinks" right={<Toggle on={page.props.showBacklinks !== false} />} onClick={() => s().setProps(pageId, { showBacklinks: page.props.showBacklinks === false })} />)}
        {item('Table of contents', <MenuItem icon={<I.TocIcon size={16} />} label="Table of contents" right={<Toggle on={!!page.props.floatingToc} />} onClick={() => s().setProps(pageId, { floatingToc: !page.props.floatingToc })} />)}
        <MenuSep />
        {item('Undo', <MenuItem icon={<I.ArrowUturnIcon size={16} />} label="Undo" shortcut={`${MOD}Z`} onClick={() => { s().undo(); onClose(); }} />)}
        {item('Version history', <MenuItem icon={<I.HistoryIcon size={16} />} label="Version history" onClick={() => { s().saveVersion(pageId); useUI.getState().set({ historyOpen: true }); onClose(); }} />)}
        {item('Updates & analytics', <MenuItem icon={<I.ClockIcon size={16} />} label="Updates & analytics" onClick={() => onClose()} />)}
        <MenuSep />
        {item('Import', <MenuItem icon={<I.ImportIcon size={16} />} label="Import" onClick={() => { onClose(); useUI.getState().set({ settingsOpen: true, settingsTab: 'import' }); }} />)}
        {item('Export', <MenuItem icon={<I.ExportIcon size={16} />} label="Export" description="PDF, HTML, Markdown & CSV" onClick={() => setExp(true)} />)}
        <MenuSep />
        <div className="menu-footer">
          <div>Word count: {words.toLocaleString()} {words === 1 ? 'word' : 'words'}</div>
          <div>Last edited by {users[page.lastEditedBy]?.name ?? 'Unknown'}</div>
          <div>{relTime(page.updatedAt, true)}</div>
        </div>
      </div>
      {moveTo && (
        <PagePicker
          rect={moveTo}
          title="Move to"
          excludeId={pageId}
          onClose={() => setMoveTo(null)}
          onPick={(pid) => {
            if (pid === 'private' || pid === 'team') s().moveRoot(pageId, pid, 0);
            else s().moveBlock(pageId, pid, s().blocks[pid].children.length);
            setMoveTo(null);
            onClose();
          }}
        />
      )}
      {exp && <ExportDialog pageId={pageId} onClose={() => { setExp(false); onClose(); }} />}
    </Popover>
  );
}

function ExportDialog({ pageId, onClose }: { pageId: ID; onClose: () => void }) {
  const [fmt, setFmt] = useState<'markdown' | 'html' | 'pdf'>('markdown');
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal export-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="export-row">
          <span>Export format</span>
          <select value={fmt} onChange={(e) => setFmt(e.target.value as any)} className="select">
            <option value="markdown">Markdown & CSV</option>
            <option value="html">HTML</option>
            <option value="pdf">PDF</option>
          </select>
        </div>
        <div className="export-actions">
          <button className="btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              exportPage(pageId, fmt);
              onClose();
            }}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdatesPopover({ pageId, anchor, onClose }: { pageId: ID; anchor: DOMRect; onClose: () => void }) {
  const blocks = useStore((s) => s.blocks);
  const users = useStore((s) => s.users);
  const allVersions = useStore((s) => s.versions);
  const versions = allVersions.filter((v) => v.pageId === pageId);
  const page = blocks[pageId];
  const items = [
    ...versions.map((v) => ({ at: v.at, who: v.author, what: 'edited' })),
    { at: page.updatedAt, who: page.lastEditedBy, what: 'edited' },
    { at: page.createdAt, who: page.createdBy, what: 'created' },
  ]
    .sort((a, b) => b.at - a.at)
    .filter((x, i, arr) => i === 0 || Math.abs(arr[i - 1].at - x.at) > 60000);
  return (
    <Popover anchor={anchor} onClose={onClose} width={380} placement="bottom-end">
      <div className="updates-pop">
        <div className="share-tabs">
          <div className="share-tab on">Updates</div>
          <div className="share-tab">Analytics</div>
        </div>
        <div className="updates-list">
          {items.map((it, i) => (
            <div className="update-item" key={i}>
              <div className="avatar sm" style={{ background: users[it.who]?.color }}>
                {users[it.who]?.name[0]}
              </div>
              <div>
                <div>
                  <b>{users[it.who]?.name ?? 'Someone'}</b> {it.what} <b>{pageTitle(page)}</b>
                </div>
                <div className="update-time">{relTime(it.at, true)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Popover>
  );
}
