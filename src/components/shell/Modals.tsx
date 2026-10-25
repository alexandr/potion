import { useEffect, useMemo, useState } from 'react';
import { useStore, pageTitle, getPagePath, type DataState } from '../../store/store';
import type { Block, ID } from '../../store/types';
import { useUI } from '../../store/ui';
import { goPage, useRoute } from '../../lib/router';
import * as I from '../ui/Icons';
import { PageIconView } from '../ui/PageIcon';
import { Popover, MenuItem, Toggle, MOD, SHIFT, ALT } from '../ui/Popover';
import { relTime, fullDate } from '../../lib/time';
import { BlockList } from '../editor/Block';
import { TEMPLATES, instantiateTemplate } from '../../lib/templates';
import { parseMarkdown, insertClipBlocks } from '../editor/clipboard';

// ---------------- Trash ----------------
export function TrashPopover() {
  const anchor = useUI((s) => s.trashAnchor);
  const set = useUI((s) => s.set);
  const blocks = useStore((s) => s.blocks);
  const [q, setQ] = useState('');
  if (!anchor) return null;
  const items = Object.values(blocks)
    .filter((b) => b.props.trashed && (b.type === 'page' || b.type === 'database'))
    .filter((b) => !q || pageTitle(b).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.props.trashedAt ?? 0) - (a.props.trashedAt ?? 0));
  const s = useStore.getState;
  return (
    <Popover anchor={{ x: anchor.right + 4, y: anchor.top - 300, h: 0 }} onClose={() => set({ trashAnchor: null })} width={414} placement="bottom-start">
      <div className="trash-pop">
        <div className="trash-search">
          <input autoFocus className="text-input" placeholder="Search pages in Trash" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="trash-filters">
          <span className="sf-pill">
            <I.UserIcon size={14} /> Last edited by <I.ChevronDown size={10} />
          </span>
          <span className="sf-pill">
            <I.PageIcon size={14} /> In <I.ChevronDown size={10} />
          </span>
          <span className="sf-pill">
            <I.UsersIcon size={14} /> Teamspaces <I.ChevronDown size={10} />
          </span>
        </div>
        <div className="trash-list">
          {items.length === 0 && (
            <div className="trash-empty">
              <I.TrashIcon size={32} />
              <div>No results</div>
            </div>
          )}
          {items.map((b) => {
            const path = getPagePath(blocks, b.id).slice(0, -1);
            return (
              <div
                key={b.id}
                className="trash-item"
                onClick={() => {
                  set({ trashAnchor: null });
                  goPage(b.id, pageTitle(b));
                }}
              >
                <PageIconView icon={b.props.icon} size={20} page={b} />
                <div className="ti-text">
                  <div className="ti-title">{pageTitle(b)}</div>
                  {path.length > 0 && <div className="ti-path">{path.map((p) => pageTitle(p)).join(' / ')}</div>}
                </div>
                <div className="ti-actions">
                  <span
                    className="sb-mini-btn"
                    title="Restore"
                    onClick={(e) => {
                      e.stopPropagation();
                      s().restorePage(b.id);
                    }}
                  >
                    <I.ArrowUturnIcon size={16} />
                  </span>
                  <span
                    className="sb-mini-btn"
                    title="Delete from Trash"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this page from Trash?')) s().deleteForever(b.id);
                    }}
                  >
                    <I.TrashIcon size={16} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="trash-footer">
          <span>Pages in Trash for over 30 days will be automatically deleted</span>
          <I.QuestionIcon size={16} />
        </div>
      </div>
    </Popover>
  );
}

// ---------------- Settings ----------------
const SHORTCUTS: [string, string][] = [
  ['Search / jump to page', `${MOD}K or ${MOD}P`],
  ['Create a new page', `${MOD}N`],
  ['Toggle sidebar', `${MOD}\\`],
  ['Toggle dark mode', `${MOD}${SHIFT}L`],
  ['Go back / forward', `${MOD}[ / ${MOD}]`],
  ['Undo / Redo', `${MOD}Z / ${MOD}${SHIFT}Z`],
  ['Bold / Italic / Underline', `${MOD}B / ${MOD}I / ${MOD}U`],
  ['Strike-through', `${MOD}${SHIFT}S`],
  ['Inline code', `${MOD}E`],
  ['Add link', `${MOD}K (with text selected)`],
  ['Text / Heading 1 / 2 / 3', `${MOD}${ALT}0 / 1 / 2 / 3`],
  ['To-do / Bulleted / Numbered / Toggle', `${MOD}${ALT}4 / 5 / 6 / 7`],
  ['Code block / Page', `${MOD}${ALT}8 / 9`],
  ['Duplicate block', `${MOD}D`],
  ['Move block up / down', `${MOD}${SHIFT}↑ / ↓`],
  ['Select block', 'Esc'],
  ['Indent / Outdent', 'Tab / Shift+Tab'],
  ['Turn into / block menu', `${MOD}/`],
  ['Check to-do / toggle open', `${MOD}Enter`],
  ['Line break inside block', 'Shift+Enter'],
  ['Mention person, page or date', '@'],
  ['Link to page', '[[ or +'],
  ['Emoji', ':'],
  ['Slash commands', '/'],
];

export function SettingsModal() {
  const open = useUI((s) => s.settingsOpen);
  const tab = useUI((s) => s.settingsTab);
  const set = useUI((s) => s.set);
  const settings = useStore((s) => s.settings);
  const ws = useStore((s) => s.workspace);
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.me);
  const [themeMenu, setThemeMenu] = useState<DOMRect | null>(null);
  if (!open) return null;
  const s = useStore.getState;
  const nav: [string, string, React.ReactNode][] = [
    ['account', 'My account', <I.UserIcon size={18} />],
    ['preferences', 'Preferences', <I.SlidersIcon size={18} />],
    ['notifications', 'Notifications', <I.BellIcon size={18} />],
    ['connections', 'Connections', <I.ArrowUpRight size={18} />],
    ['general', 'General', <I.SettingsIcon size={18} />],
    ['people', 'People', <I.UsersIcon size={18} />],
    ['import', 'Import', <I.ImportIcon size={18} />],
    ['shortcuts', 'Keyboard shortcuts', <I.CodeIcon size={18} />],
  ];
  const meU = users[me];
  return (
    <div className="modal-backdrop" onMouseDown={() => set({ settingsOpen: false })}>
      <div className="modal settings-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="settings-nav">
          <div className="sn-group">Account</div>
          <div className="sn-user">
            <div className="avatar" style={{ background: meU.color, width: 20, height: 20, fontSize: 11 }}>
              {meU.name[0]}
            </div>
            <span>{meU.name}</span>
          </div>
          {nav.slice(0, 4).map(([k, l, ic]) => (
            <div key={k} className={`sn-item ${tab === k ? 'on' : ''}`} onClick={() => set({ settingsTab: k })}>
              {ic}
              <span>{l}</span>
            </div>
          ))}
          <div className="sn-group">Workspace</div>
          {nav.slice(4).map(([k, l, ic]) => (
            <div key={k} className={`sn-item ${tab === k ? 'on' : ''}`} onClick={() => set({ settingsTab: k })}>
              {ic}
              <span>{l}</span>
            </div>
          ))}
          <div className="sn-upgrade">
            <div className="sn-item" onClick={() => useUI.getState().showToast('This is a free demo workspace')}>
              <I.LightningIcon size={18} />
              <span>Upgrade plan</span>
            </div>
          </div>
        </div>
        <div className="settings-content">
          {tab === 'account' && (
            <>
              <h2>Account</h2>
              <div className="set-row">
                <div className="avatar" style={{ background: meU.color, width: 60, height: 60, fontSize: 28 }}>
                  {meU.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="set-label">Preferred name</div>
                  <input className="text-input" value={meU.name} onChange={(e) => useStore.setState({ users: { ...users, [me]: { ...meU, name: e.target.value } } })} />
                </div>
              </div>
              <h3>Account security</h3>
              <div className="set-row">
                <div>
                  <div className="set-label">Email</div>
                  <div className="set-desc">{meU.email}</div>
                </div>
                <button className="btn-outline sm">Change email</button>
              </div>
              <div className="set-row">
                <div>
                  <div className="set-label">Password</div>
                  <div className="set-desc">Set a permanent password to login to your account.</div>
                </div>
                <Toggle on={false} />
              </div>
            </>
          )}
          {tab === 'preferences' && (
            <>
              <h2>Preferences</h2>
              <h3>Appearance</h3>
              <div className="set-row">
                <div>
                  <div className="set-label">Appearance</div>
                  <div className="set-desc">Customize how Potion looks on your device.</div>
                </div>
                <div className="set-select" onClick={(e) => setThemeMenu(e.currentTarget.getBoundingClientRect())}>
                  {settings.theme === 'system' ? 'Use system setting' : settings.theme === 'dark' ? 'Dark' : 'Light'}
                  <I.ChevronDown size={12} />
                </div>
              </div>
              <h3>Language & Time</h3>
              <div className="set-row">
                <div>
                  <div className="set-label">Language</div>
                  <div className="set-desc">Change the language used in the user interface.</div>
                </div>
                <div className="set-select">English (US)</div>
              </div>
              <div className="set-row">
                <div>
                  <div className="set-label">Start week on Monday</div>
                  <div className="set-desc">This will change how all calendars in your app look.</div>
                </div>
                <Toggle on={!!(settings as any).weekMonday} onChange={(v) => s().updateSettings({ weekMonday: v } as any)} />
              </div>
              <h3>Desktop app</h3>
              <div className="set-row">
                <div>
                  <div className="set-label">Open on start</div>
                  <div className="set-desc">Choose what to show when Potion starts or when you switch workspaces.</div>
                </div>
                <div className="set-select" onClick={() => s().updateSettings({ startPage: settings.startPage === 'home' ? 'last' : 'home' })}>
                  {settings.startPage === 'home' ? 'Home' : 'Last visited page'}
                  <I.ChevronDown size={12} />
                </div>
              </div>
              {themeMenu && (
                <Popover anchor={themeMenu} onClose={() => setThemeMenu(null)} width={200} placement="bottom-end">
                  <div className="menu">
                    {(
                      [
                        ['system', 'Use system setting'],
                        ['light', 'Light'],
                        ['dark', 'Dark'],
                      ] as const
                    ).map(([k, l]) => (
                      <MenuItem key={k} label={l} checked={settings.theme === k} onClick={() => { s().updateSettings({ theme: k }); setThemeMenu(null); }} />
                    ))}
                  </div>
                </Popover>
              )}
            </>
          )}
          {tab === 'notifications' && (
            <>
              <h2>Notifications</h2>
              {['Activity in your workspace', 'Always send email notifications', 'Page updates', 'Workspace digest'].map((l, i) => (
                <div className="set-row" key={l}>
                  <div>
                    <div className="set-label">{l}</div>
                    <div className="set-desc">Receive notifications about {l.toLowerCase()}.</div>
                  </div>
                  <Toggle on={i !== 1} />
                </div>
              ))}
            </>
          )}
          {tab === 'connections' && (
            <>
              <h2>Connections</h2>
              <div className="set-desc">Connect Potion with your favorite tools. No connections in the demo workspace.</div>
            </>
          )}
          {tab === 'general' && (
            <>
              <h2>General</h2>
              <h3>Workspace settings</h3>
              <div className="set-row column">
                <div className="set-label">Name</div>
                <input className="text-input" value={ws.name} onChange={(e) => s().setWorkspace({ name: e.target.value })} />
                <div className="set-desc">You can use your organization or company name. Keep it simple.</div>
              </div>
              <div className="set-row column">
                <div className="set-label">Icon</div>
                <input className="text-input" style={{ width: 60 }} value={ws.icon} maxLength={2} onChange={(e) => s().setWorkspace({ icon: e.target.value || 'P' })} />
              </div>
              <h3>Danger zone</h3>
              <div className="set-row">
                <div>
                  <div className="set-label">Reset demo workspace</div>
                  <div className="set-desc">Restore the original demo pages. Your changes in this browser will be erased.</div>
                </div>
                <button
                  className="btn-danger sm"
                  onClick={() => {
                    if (confirm('Reset the demo workspace?')) {
                      s().resetDemo();
                      set({ settingsOpen: false });
                      goPage(null);
                    }
                  }}
                >
                  Reset
                </button>
              </div>
              <div className="set-row">
                <div>
                  <div className="set-label">Export all workspace content</div>
                  <div className="set-desc">Download a JSON backup of everything in this workspace.</div>
                </div>
                <button
                  className="btn-outline sm"
                  onClick={() => {
                    const st = useStore.getState();
                    const data: DataState = { blocks: st.blocks, workspace: st.workspace, settings: st.settings, users: st.users, me: st.me, discussions: st.discussions, notifications: st.notifications, versions: [] };
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
                    a.download = 'potion-workspace.json';
                    a.click();
                  }}
                >
                  Export
                </button>
              </div>
            </>
          )}
          {tab === 'people' && (
            <>
              <h2>People</h2>
              <div className="set-row">
                <div className="set-desc">Members of this workspace.</div>
                <button className="btn-primary sm" onClick={() => useUI.getState().showToast('Invitations are disabled in the demo')}>
                  Add members
                </button>
              </div>
              <table className="people-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(users).map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="people-cell">
                          <div className="avatar" style={{ background: u.color, width: 28, height: 28 }}>
                            {u.name[0]}
                          </div>
                          <div>
                            <div>{u.name}</div>
                            <div className="set-desc">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="set-desc">{u.id === me ? 'Workspace owner' : 'Member'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {tab === 'import' && <ImportTab />}
          {tab === 'shortcuts' && (
            <>
              <h2>Keyboard shortcuts</h2>
              <div className="shortcut-list">
                {SHORTCUTS.map(([a, k]) => (
                  <div className="shortcut-row" key={a}>
                    <span>{a}</span>
                    <kbd>{k}</kbd>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportTab() {
  return (
    <>
      <h2>Import</h2>
      <div className="set-desc" style={{ marginBottom: 16 }}>
        Import Markdown, text or JSON backups into a new private page.
      </div>
      <div className="import-grid">
        {['Text & Markdown', 'Potion backup (JSON)', 'CSV', 'HTML'].map((l) => (
          <label key={l} className="import-tile">
            <I.ImportIcon size={20} />
            <span>{l}</span>
            <input
              type="file"
              hidden
              accept={l.startsWith('Text') ? '.md,.txt,.markdown' : l.startsWith('Potion') ? '.json' : l === 'CSV' ? '.csv' : '.html,.htm'}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                f.text().then((text) => {
                  const s = useStore.getState();
                  if (l.startsWith('Potion')) {
                    try {
                      s.importState(JSON.parse(text));
                      useUI.getState().showToast('Workspace imported');
                    } catch {
                      useUI.getState().showToast('Could not read that file');
                    }
                    return;
                  }
                  const title = f.name.replace(/\.\w+$/, '');
                  const pid = s.createPage('private', { title });
                  let md = text;
                  if (l === 'HTML') {
                    const d = new DOMParser().parseFromString(text, 'text/html');
                    md = d.body.innerText;
                  }
                  if (l === 'CSV') md = text.split('\n').map((r) => '- ' + r).join('\n');
                  const first = useStore.getState().createBlock(pid, 0, 'text');
                  insertClipBlocks(first, parseMarkdown(md), true);
                  useUI.getState().set({ settingsOpen: false });
                  goPage(pid, title);
                });
              }}
            />
          </label>
        ))}
      </div>
    </>
  );
}

// ---------------- Inbox ----------------
export function InboxPanel() {
  const open = useUI((s) => s.inboxOpen);
  const set = useUI((s) => s.set);
  const notifications = useStore((s) => s.notifications);
  const users = useStore((s) => s.users);
  const blocks = useStore((s) => s.blocks);
  const discussions = useStore((s) => s.discussions);
  const sidebarW = useStore((s) => (s.settings.sidebarCollapsed ? 0 : s.settings.sidebarWidth));
  if (!open) return null;
  const comments = Object.values(discussions).flatMap((d) => d.comments.filter((c) => c.author !== useStore.getState().me).map((c) => ({ id: c.id, pageId: d.pageId, text: `commented: ${c.text}`, at: c.createdAt, read: true, actor: c.author })));
  const all = [...notifications, ...comments].sort((a, b) => b.at - a.at);
  return (
    <>
      <div className="inbox-backdrop" onMouseDown={() => set({ inboxOpen: false })} />
      <div className="inbox-panel" style={{ left: sidebarW }}>
        <div className="sp-head">
          <div className="sp-title">Inbox</div>
          <div style={{ flex: 1 }} />
          <div className="tb-icon" title="Mark all as read" onClick={() => useStore.getState().markNotificationsRead()}>
            <I.CheckIcon size={18} />
          </div>
          <div className="tb-icon" onClick={() => set({ inboxOpen: false })}>
            <I.DoubleChevronLeft size={18} />
          </div>
        </div>
        <div className="sp-body">
          {all.length === 0 && <div className="sp-empty">You're all caught up</div>}
          {all.map((n) => {
            const p = blocks[n.pageId];
            return (
              <div
                key={n.id}
                className={`inbox-item ${n.read ? '' : 'unread'}`}
                onClick={() => {
                  useStore.setState({ notifications: useStore.getState().notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)) });
                  set({ inboxOpen: false });
                  if (p) goPage(p.id, pageTitle(p));
                }}
              >
                {!n.read && <span className="unread-dot" />}
                <div className="avatar" style={{ background: users[n.actor]?.color, width: 28, height: 28 }}>
                  {users[n.actor]?.name[0]}
                </div>
                <div className="ii-body">
                  <div>
                    <b>{users[n.actor]?.name}</b> <span dangerouslySetInnerHTML={{ __html: n.text }} />
                  </div>
                  <div className="ii-time">{relTime(n.at, true)}</div>
                  {p && (
                    <div className="ii-page">
                      <PageIconView icon={p.props.icon} size={16} page={p} />
                      <span>{pageTitle(p)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ---------------- Templates ----------------
export function TemplatesModal() {
  const open = useUI((s) => s.templatesOpen);
  const set = useUI((s) => s.set);
  const [sel, setSel] = useState(0);
  const [cat, setCat] = useState('All');
  const cats = ['All', ...Array.from(new Set(TEMPLATES.map((t) => t.category)))];
  const list = TEMPLATES.filter((t) => cat === 'All' || t.category === cat);
  const t = list[sel] ?? list[0];
  const preview = useMemo(() => t?.markdown, [t]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={() => set({ templatesOpen: false })}>
      <div className="modal templates-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="tpl-nav">
          <div className="tpl-nav-title">Templates</div>
          {cats.map((c) => (
            <div key={c} className={`sn-item ${cat === c ? 'on' : ''}`} onClick={() => { setCat(c); setSel(0); }}>
              {c}
            </div>
          ))}
          <div className="tpl-list">
            {list.map((x, i) => (
              <div key={x.name} className={`tpl-item ${i === sel ? 'on' : ''}`} onClick={() => setSel(i)}>
                <span>{x.icon}</span>
                <span>{x.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="tpl-preview">
          {t && (
            <>
              <div className="tpl-head">
                <div>
                  <div className="tpl-name">
                    {t.icon} {t.name}
                  </div>
                  <div className="set-desc">{t.description}</div>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => {
                    const id = instantiateTemplate(t);
                    set({ templatesOpen: false });
                    goPage(id, t.name);
                  }}
                >
                  Get template
                </button>
              </div>
              <div className="tpl-body">
                <pre className="tpl-md">{preview}</pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- Version history ----------------
export function HistoryModal() {
  const open = useUI((s) => s.historyOpen);
  const set = useUI((s) => s.set);
  const route = useRoute();
  const pageId = route.peek ?? route.pageId;
  const allVersions = useStore((s) => s.versions);
  const versions = allVersions.filter((v) => v.pageId === pageId).sort((a, b) => b.at - a.at);
  const users = useStore((s) => s.users);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => setSel(versions[0]?.id ?? null), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open || !pageId) return null;
  const v = versions.find((x) => x.id === sel);
  return (
    <div className="modal-backdrop" onMouseDown={() => set({ historyOpen: false })}>
      <div className="modal history-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="hist-preview">
          {v ? <HistoryPreview blocks={v.blocks} pageId={pageId} /> : <div className="sp-empty">This page does not have any snapshots yet.</div>}
        </div>
        <div className="hist-side">
          <div className="sp-title" style={{ padding: '14px 16px' }}>
            Version history
          </div>
          <div className="hist-list">
            {versions.map((x) => (
              <div key={x.id} className={`hist-item ${x.id === sel ? 'on' : ''}`} onClick={() => setSel(x.id)}>
                <div className="hist-time">{fullDate(x.at)}</div>
                <div className="hist-who">
                  <div className="avatar" style={{ background: users[x.author]?.color, width: 16, height: 16, fontSize: 9 }}>
                    {users[x.author]?.name[0]}
                  </div>
                  {users[x.author]?.name}
                </div>
              </div>
            ))}
          </div>
          <div className="hist-actions">
            <button className="btn-outline" onClick={() => set({ historyOpen: false })}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!v}
              onClick={() => {
                if (v) useStore.getState().restoreVersion(v.id);
                set({ historyOpen: false });
                useUI.getState().showToast('Restored version');
              }}
            >
              Restore
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryPreview({ blocks, pageId }: { blocks: Record<ID, Block>; pageId: ID }) {
  const page = blocks[pageId];
  // temporarily render from snapshot by swapping a read-only store view
  return (
    <div className="hist-page">
      <div className="hist-title">{page?.props.title || 'Untitled'}</div>
      <SnapshotList blocks={blocks} ids={page?.children ?? []} />
    </div>
  );
}

function SnapshotList({ blocks, ids }: { blocks: Record<ID, Block>; ids: ID[] }) {
  return (
    <>
      {ids.map((id) => {
        const b = blocks[id];
        if (!b) return null;
        const cls = `snap-${b.type}`;
        return (
          <div key={id} className={`snap ${cls}`}>
            {b.type === 'todo' && <span className="snap-box">{b.props.checked ? '☑' : '☐'}</span>}
            {b.type === 'bulleted' && <span className="snap-box">•</span>}
            {b.type === 'page' ? <span className="snap-page">📄 {b.props.title || 'Untitled'}</span> : b.type === 'divider' ? <hr /> : <span dangerouslySetInnerHTML={{ __html: b.text || (b.type === 'image' ? '[image]' : '') }} />}
            {b.children.length > 0 && b.type !== 'page' && (
              <div style={{ paddingLeft: 24 }}>
                <SnapshotList blocks={blocks} ids={b.children} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ---------------- Toast ----------------
export function Toast() {
  const toast = useUI((s) => s.toast);
  if (!toast) return null;
  return <div className="toast">{toast}</div>;
}

export { BlockList };
