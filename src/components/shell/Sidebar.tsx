import { useEffect, useRef, useState } from 'react';
import { useStore, getSubPages, pageTitle, isTrashed } from '../../store/store';
import type { ID } from '../../store/types';
import { useUI } from '../../store/ui';
import { useRoute, goPage, setPeek, pagePath } from '../../lib/router';
import * as I from '../ui/Icons';
import { PageIconView } from '../ui/PageIcon';
import { Popover, MenuItem, MenuSep, MOD, SHIFT } from '../ui/Popover';
import { Tooltip } from '../ui/Tooltip';
import { PagePicker } from '../editor/InlineMenus';
import { relTime } from '../../lib/time';

function useExpanded() {
  const [map, setMap] = useState<Record<ID, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('potion-expanded') ?? '{}');
    } catch {
      return {};
    }
  });
  const toggle = (id: ID, v?: boolean) =>
    setMap((m) => {
      const n = { ...m, [id]: v ?? !m[id] };
      try {
        localStorage.setItem('potion-expanded', JSON.stringify(n));
      } catch {
        /* */
      }
      return n;
    });
  return [map, toggle] as const;
}

let expandApi: ((id: ID, v?: boolean) => void) | null = null;
export const expandInSidebar = (id: ID) => expandApi?.(id, true);

export function Sidebar({ floating }: { floating?: boolean }) {
  const ws = useStore((s) => s.workspace);
  const blocks = useStore((s) => s.blocks);
  const settings = useStore((s) => s.settings);
  const notifications = useStore((s) => s.notifications);
  const ui = useUI();
  const route = useRoute();
  const [expanded, toggle] = useExpanded();
  expandApi = toggle;
  const [wsMenu, setWsMenu] = useState<DOMRect | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const width = settings.sidebarWidth;
  const unread = notifications.filter((n) => !n.read).length;

  // expand ancestors of current page
  useEffect(() => {
    if (!route.pageId) return;
    let cur = blocks[route.pageId]?.parent;
    while (cur) {
      const b = blocks[cur];
      if (!b) break;
      if ((b.type === 'page' || b.type === 'database') && !expanded[cur]) toggle(cur, true);
      cur = b.parent;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.pageId]);

  const newPage = (section: 'private' | 'team' = 'private') => {
    const id = useStore.getState().createPage(section);
    goPage(id, '');
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = width;
    document.body.classList.add('resizing-sidebar');
    const move = (ev: MouseEvent) => {
      const w = Math.max(200, Math.min(480, w0 + ev.clientX - x0));
      useStore.getState().updateSettings({ sidebarWidth: w });
    };
    const up = () => {
      document.body.classList.remove('resizing-sidebar');
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const favs = ws.favorites.filter((f) => blocks[f] && !isTrashed(blocks, f));
  const priv = ws.privatePages.filter((p) => blocks[p] && !blocks[p].props.trashed);
  const team = ws.teamPages.filter((p) => blocks[p] && !blocks[p].props.trashed);
  const me = useStore.getState().users[useStore.getState().me];

  const Section = ({ id, label, children, onAdd }: { id: string; label: string; children: React.ReactNode; onAdd?: () => void }) => (
    <div className="sb-section">
      <div className="sb-section-head" onClick={() => setCollapsedSections((c) => ({ ...c, [id]: !c[id] }))}>
        <span className="sb-section-label">{label}</span>
        <span className="sb-section-actions">
          {onAdd && (
            <Tooltip label="Add a page">
              <span
                className="sb-mini-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
              >
                <I.PlusIcon size={14} />
              </span>
            </Tooltip>
          )}
        </span>
      </div>
      {!collapsedSections[id] && children}
    </div>
  );

  return (
    <aside className={`sidebar ${floating ? 'floating' : ''}`} style={{ width }}>
      <div className="sb-top">
        <div className="sb-switcher sidebar-item" onClick={(e) => setWsMenu(e.currentTarget.getBoundingClientRect())}>
          <div className="ws-icon">{ws.icon}</div>
          <div className="ws-name">{ws.name}</div>
          <I.ChevronDown size={12} style={{ color: 'var(--icon)', marginLeft: 2 }} />
          <div style={{ flex: 1 }} />
          {!floating && (
            <Tooltip label="Close sidebar" shortcut={`${MOD}\\`}>
              <div
                className="sb-icon-btn sb-collapse"
                onClick={(e) => {
                  e.stopPropagation();
                  useStore.getState().updateSettings({ sidebarCollapsed: true });
                }}
              >
                <I.DoubleChevronLeft size={16} />
              </div>
            </Tooltip>
          )}
          <Tooltip label="Create a new page" shortcut={`${MOD}N`}>
            <div
              className="sb-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                newPage();
              }}
            >
              <I.ComposeIcon size={18} />
            </div>
          </Tooltip>
        </div>
        <NavItem icon={<I.SearchIcon size={18} />} label="Search" onClick={() => ui.set({ searchOpen: true })} />
        <NavItem icon={<I.HomeIcon size={18} />} label="Home" active={!route.pageId} onClick={() => goPage(null)} />
        <NavItem icon={<I.NotionAiIcon size={18} />} label="Potion AI" onClick={() => ui.showToast('Potion AI is not available in this demo workspace')} />
        <NavItem
          icon={<I.InboxIcon size={18} />}
          label="Inbox"
          active={ui.inboxOpen}
          badge={unread || undefined}
          onClick={() => ui.set({ inboxOpen: !ui.inboxOpen })}
        />
      </div>
      <div className="sb-scroll">
        {favs.length > 0 && (
          <Section id="fav" label="Favorites">
            {favs.map((id) => (
              <TreeItem key={'f' + id} id={id} depth={0} expanded={expanded} toggle={toggle} keyPrefix="fav" />
            ))}
          </Section>
        )}
        <Section id="team" label="Teamspaces">
          <div className="sidebar-item teamspace-row" onClick={() => toggle('__team')}>
            <div className="sb-item-icon">
              <div className="ts-icon">🏢</div>
            </div>
            <div className="sb-item-label">General</div>
            <div className="sb-item-actions">
              <span className="sb-mini-btn" onClick={(e) => { e.stopPropagation(); newPage('team'); }}>
                <I.PlusIcon size={14} />
              </span>
            </div>
          </div>
          {expanded['__team'] !== false &&
            team.map((id) => <TreeItem key={id} id={id} depth={1} expanded={expanded} toggle={toggle} section="team" />)}
        </Section>
        <Section id="private" label="Private" onAdd={() => newPage('private')}>
          {priv.map((id) => (
            <TreeItem key={id} id={id} depth={0} expanded={expanded} toggle={toggle} section="private" />
          ))}
          {priv.length === 0 && <div className="sb-empty">No pages inside</div>}
        </Section>
        <div className="sb-bottom">
          <NavItem icon={<I.SettingsIcon size={18} />} label="Settings" onClick={() => ui.set({ settingsOpen: true, settingsTab: 'preferences' })} />
          <NavItem icon={<I.TemplatesIcon size={18} />} label="Templates" onClick={() => ui.set({ templatesOpen: true })} />
          <NavItem
            icon={<I.TrashIcon size={18} />}
            label="Trash"
            onClick={(e) => ui.set({ trashAnchor: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
            dataTrash
          />
        </div>
      </div>
      <div className="sb-footer">
        <div className="sidebar-item" onClick={() => ui.set({ settingsOpen: true, settingsTab: 'people' })}>
          <div className="sb-item-icon">
            <I.UsersIcon size={18} />
          </div>
          <div className="sb-item-label">Invite members</div>
        </div>
        <Tooltip label="Help, contact, more…">
          <div className="help-btn" onClick={() => ui.set({ settingsOpen: true, settingsTab: 'shortcuts' })}>
            <I.QuestionIcon size={18} />
          </div>
        </Tooltip>
      </div>
      {!floating && <div className="sb-resizer" onMouseDown={startResize} onDoubleClick={() => useStore.getState().updateSettings({ sidebarWidth: 240 })} />}
      {wsMenu && (
        <Popover anchor={wsMenu} onClose={() => setWsMenu(null)} width={300}>
          <div className="menu ws-menu">
            <div className="ws-menu-email">{me?.email}</div>
            <div className="ws-menu-card">
              <div className="ws-icon lg">{ws.icon}</div>
              <div>
                <div className="ws-menu-name">{ws.name}</div>
                <div className="ws-menu-sub">Free Plan · 4 members</div>
              </div>
            </div>
            <div className="ws-menu-buttons">
              <button className="btn-outline sm" onClick={() => { setWsMenu(null); ui.set({ settingsOpen: true, settingsTab: 'preferences' }); }}>
                <I.SettingsIcon size={14} /> Settings
              </button>
              <button className="btn-outline sm" onClick={() => { setWsMenu(null); ui.set({ settingsOpen: true, settingsTab: 'people' }); }}>
                <I.UsersIcon size={14} /> Invite members
              </button>
            </div>
            <MenuSep />
            <MenuItem icon={<div className="ws-icon sm">{ws.icon}</div>} label={ws.name} checked onClick={() => setWsMenu(null)} />
            <MenuItem icon={<I.PlusIcon size={16} />} label="New workspace" onClick={() => { setWsMenu(null); ui.showToast('Multiple workspaces are not available in the demo'); }} />
            <MenuSep />
            <MenuItem label="Reset demo workspace" onClick={() => { if (confirm('Reset the demo workspace? All your changes will be lost.')) { useStore.getState().resetDemo(); goPage(null); } setWsMenu(null); }} />
            <MenuItem label="Log out" onClick={() => { setWsMenu(null); ui.showToast('This is a demo — there is nothing to log out of'); }} />
          </div>
        </Popover>
      )}
    </aside>
  );
}

function NavItem({
  icon,
  label,
  onClick,
  active,
  badge,
  dataTrash,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  badge?: number;
  dataTrash?: boolean;
}) {
  return (
    <div className={`sidebar-item nav-item ${active ? 'selected' : ''}`} onClick={onClick} data-trash={dataTrash ? '' : undefined}>
      <div className="sb-item-icon">{icon}</div>
      <div className="sb-item-label">{label}</div>
      {badge ? <div className="sb-badge">{badge}</div> : null}
    </div>
  );
}

let dragPage: ID | null = null;

function TreeItem({
  id,
  depth,
  expanded,
  toggle,
  section,
  keyPrefix,
}: {
  id: ID;
  depth: number;
  expanded: Record<ID, boolean>;
  toggle: (id: ID, v?: boolean) => void;
  section?: 'private' | 'team';
  keyPrefix?: string;
}) {
  const b = useStore((s) => s.blocks[id]);
  const blocks = useStore((s) => s.blocks);
  const route = useRoute();
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [rename, setRename] = useState<DOMRect | null>(null);
  const [moveTo, setMoveTo] = useState<DOMRect | null>(null);
  const [dropPos, setDropPos] = useState<'before' | 'after' | 'inside' | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  if (!b) return null;
  const key = (keyPrefix ?? '') + id;
  const isOpen = !!expanded[key];
  const subs = isOpen ? getSubPages(blocks, id) : [];
  const selected = route.pageId === id && !keyPrefix;
  const s = useStore.getState;

  const addSub = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (b.type === 'database') {
      const rid = s().createPage(id, { values: {} });
      setPeek(rid, 's');
      return;
    }
    const nid = s().createPage(id);
    toggle(key, true);
    goPage(nid, '');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const src = dragPage;
    setDropPos(null);
    if (!src || src === id) return;
    const st = s();
    // prevent dropping into own descendant
    let cur: ID | null = id;
    while (cur) {
      if (cur === src) return;
      cur = st.blocks[cur]?.parent ?? null;
    }
    if (dropPos === 'inside') {
      st.moveBlock(src, id, st.blocks[id].children.length);
      toggle(key, true);
    } else {
      const parent = b.parent;
      if (!parent) {
        const sec = section ?? (st.workspace.privatePages.includes(id) ? 'private' : 'team');
        const list = sec === 'private' ? st.workspace.privatePages : st.workspace.teamPages;
        st.moveRoot(src, sec, list.indexOf(id) + (dropPos === 'after' ? 1 : 0));
      } else {
        const p = st.blocks[parent];
        st.moveBlock(src, parent, p.children.indexOf(id) + (dropPos === 'after' ? 1 : 0));
      }
    }
  };

  return (
    <>
      <div
        ref={rowRef}
        className={`sidebar-item tree-item ${selected ? 'selected' : ''} ${dropPos ? 'drop-' + dropPos : ''}`}
        style={{ paddingLeft: 8 + depth * 12 }}
        data-sidebar-page={id}
        draggable
        onDragStart={(e) => {
          dragPage = id;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', pageTitle(b));
        }}
        onDragEnd={() => (dragPage = null)}
        onDragOver={(e) => {
          if (!dragPage || dragPage === id) return;
          e.preventDefault();
          const r = rowRef.current!.getBoundingClientRect();
          const y = e.clientY - r.top;
          setDropPos(y < r.height * 0.25 ? 'before' : y > r.height * 0.75 ? 'after' : 'inside');
        }}
        onDragLeave={() => setDropPos(null)}
        onDrop={onDrop}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey) window.open(pagePath(id, pageTitle(b)), '_blank');
          else goPage(id, pageTitle(b));
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu(new DOMRect(e.clientX, e.clientY, 0, 0));
        }}
      >
        <div className="sb-item-icon tree-icon">
          <span className="tree-page-icon">
            <PageIconView icon={b.props.icon} size={18} page={b} />
          </span>
          <span
            className={`tree-toggle ${isOpen ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggle(key);
            }}
          >
            <I.ChevronRight size={12} />
          </span>
        </div>
        <div className="sb-item-label">{pageTitle(b)}</div>
        <div className="sb-item-actions">
          <Tooltip label="Delete, duplicate, and more…">
            <span
              className="sb-mini-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMenu(e.currentTarget.getBoundingClientRect());
              }}
            >
              <I.DotsIcon size={14} />
            </span>
          </Tooltip>
          <Tooltip label={b.type === 'database' ? 'Add a new page' : 'Add a page inside'}>
            <span className="sb-mini-btn" onClick={addSub}>
              <I.PlusIcon size={14} />
            </span>
          </Tooltip>
        </div>
      </div>
      {isOpen && (
        <>
          {subs.map((c) => (
            <TreeItem key={c} id={c} depth={depth + 1} expanded={expanded} toggle={toggle} keyPrefix={keyPrefix} />
          ))}
          {subs.length === 0 && (
            <div className="sb-empty" style={{ paddingLeft: 8 + (depth + 1) * 12 + 22 }}>
              No pages inside
            </div>
          )}
        </>
      )}
      {menu && (
        <Popover anchor={menu} onClose={() => setMenu(null)} width={265}>
          <div className="menu">
            <div className="menu-type-label">Page</div>
            <MenuItem
              icon={useStore.getState().workspace.favorites.includes(id) ? <I.StarFilled size={16} /> : <I.StarIcon size={16} />}
              label={useStore.getState().workspace.favorites.includes(id) ? 'Remove from Favorites' : 'Add to Favorites'}
              onClick={() => {
                s().toggleFavorite(id);
                setMenu(null);
              }}
            />
            <MenuSep />
            <MenuItem
              icon={<I.LinkIcon size={16} />}
              label="Copy link"
              onClick={() => {
                navigator.clipboard?.writeText(location.origin + pagePath(id, pageTitle(b))).catch(() => {});
                useUI.getState().showToast('Copied link to clipboard');
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<I.DuplicateIcon size={16} />}
              label="Duplicate"
              shortcut={`${MOD}D`}
              onClick={() => {
                s().duplicateBlock(id);
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<I.ComposeIcon size={16} />}
              label="Rename"
              shortcut={`${MOD}${SHIFT}R`}
              onClick={() => {
                setRename(rowRef.current!.getBoundingClientRect());
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<I.MoveToIcon size={16} />}
              label="Move to"
              shortcut={`${MOD}${SHIFT}P`}
              onClick={() => {
                setMoveTo(rowRef.current!.getBoundingClientRect());
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<I.TrashIcon size={16} />}
              label="Move to Trash"
              danger
              onClick={() => {
                s().trashPage(id);
                setMenu(null);
                useUI.getState().showToast('Moved to Trash');
                if (route.pageId === id) goPage(null);
              }}
            />
            <MenuSep />
            <MenuItem
              icon={<I.ArrowUpRight size={16} />}
              label="Open in new tab"
              shortcut={`${MOD}⇧↵`}
              onClick={() => {
                window.open(pagePath(id, pageTitle(b)), '_blank');
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<I.SidePeekIcon size={16} />}
              label="Open in side peek"
              onClick={() => {
                setPeek(id, 's');
                setMenu(null);
              }}
            />
            <MenuSep />
            <div className="menu-footer">
              <div>Last edited by {useStore.getState().users[b.lastEditedBy]?.name ?? 'Unknown'}</div>
              <div>{relTime(b.updatedAt, true)}</div>
            </div>
          </div>
        </Popover>
      )}
      {rename && (
        <Popover anchor={rename} onClose={() => setRename(null)} width={rename.width - 8} offset={-rename.height}>
          <RenameBox id={id} onDone={() => setRename(null)} />
        </Popover>
      )}
      {moveTo && (
        <PagePicker
          rect={moveTo}
          title="Move to"
          excludeId={id}
          onClose={() => setMoveTo(null)}
          onPick={(pid) => {
            if (pid === 'private' || pid === 'team') s().moveRoot(id, pid, 0);
            else s().moveBlock(id, pid, s().blocks[pid].children.length);
            setMoveTo(null);
          }}
        />
      )}
    </>
  );
}

export function RenameBox({ id, onDone }: { id: ID; onDone: () => void }) {
  const b = useStore((s) => s.blocks[id]);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  if (!b) return null;
  return (
    <div className="rename-box">
      <div className="rename-icon" onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}>
        <PageIconView icon={b.props.icon} size={18} page={b} />
      </div>
      <input
        autoFocus
        className="text-input"
        value={b.props.title ?? ''}
        placeholder="Untitled"
        onChange={(e) => useStore.getState().setProps(id, { title: e.target.value }, `title:${id}`)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && onDone()}
        onFocus={(e) => e.target.select()}
      />
      {anchor && <IconPicker id={id} anchor={anchor} onClose={() => setAnchor(null)} />}
    </div>
  );
}

import { EmojiPopover } from '../ui/EmojiPicker';
export function IconPicker({ id, anchor, onClose }: { id: ID; anchor: DOMRect | HTMLElement; onClose: () => void }) {
  return (
    <EmojiPopover
      anchor={anchor}
      onClose={onClose}
      onPick={(e) => {
        useStore.getState().setProps(id, { icon: e });
        onClose();
      }}
      onRemove={() => {
        useStore.getState().setProps(id, { icon: undefined });
        onClose();
      }}
    />
  );
}
