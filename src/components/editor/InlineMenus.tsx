import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorUI } from './editorUI';
import { useStore, pageTitle, isTrashed } from '../../store/store';
import { editableEl, focusBlock } from './actions';
import { deleteRange, insertAtom } from '../../lib/format';
import { getCaretOffset, escapeHtml } from '../../lib/dom';
import { Popover, MenuHeader } from '../ui/Popover';
import { PageIconView } from '../ui/PageIcon';
import { searchEmoji } from '../ui/EmojiPicker';
import * as I from '../ui/Icons';
import { goPage } from '../../lib/router';

interface Option {
  key: string;
  section: string;
  icon: React.ReactNode;
  label: string;
  sub?: string;
  run: () => void;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function InlineMenus() {
  const inline = useEditorUI((s) => s.inline);
  const set = useEditorUI((s) => s.set);
  const blocks = useStore((s) => s.blocks);
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.me);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  activeRef.current = active;

  const replaceWith = (html: string | null, text?: string) => {
    if (!inline) return;
    const el = editableEl(inline.blockId);
    if (!el) return;
    const caret = getCaretOffset(el);
    const from = inline.start - inline.trigger.length;
    if (html) insertAtom(el, from, Math.max(caret, inline.start), html);
    else if (text != null) {
      deleteRange(el, from, Math.max(caret, inline.start));
      document.execCommand('insertText', false, text);
    } else deleteRange(el, from, Math.max(caret, inline.start));
    set({ inline: null, menuKey: null });
  };

  const options: Option[] = useMemo(() => {
    if (!inline) return [];
    const q = inline.query.toLowerCase();
    const opts: Option[] = [];
    const pages = Object.values(blocks)
      .filter((b) => (b.type === 'page' || (b.type === 'database' && !b.props.inline)) && !isTrashed(blocks, b.id))
      .filter((b) => !q || pageTitle(b).toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, inline.kind === 'mention' ? 5 : 12);
    const mentionPage = (pid: string) => {
      const p = blocks[pid];
      return `<span class="mention" data-page="${pid}" contenteditable="false">${escapeHtml(pageTitle(p))}</span>`;
    };

    if (inline.kind === 'emoji') {
      if (!q) return [];
      return searchEmoji(q, 10).map((e) => ({
        key: e.slug,
        section: '',
        icon: <span style={{ fontSize: 18 }}>{e.emoji}</span>,
        label: `:${e.slug}:`,
        run: () => replaceWith(null, e.emoji),
      }));
    }

    if (inline.kind === 'mention' || inline.kind === 'person') {
      Object.values(users)
        .filter((u) => !q || u.name.toLowerCase().includes(q))
        .forEach((u) =>
          opts.push({
            key: 'u' + u.id,
            section: 'People',
            icon: (
              <div className="avatar sm" style={{ background: u.color }}>
                {u.name[0]}
              </div>
            ),
            label: u.name + (u.id === me ? '' : ''),
            sub: u.id === me ? 'You' : undefined,
            run: () => replaceWith(`<span class="mention" data-user="${u.id}" contenteditable="false">@${escapeHtml(u.name)}</span>`),
          }),
        );
    }
    if (inline.kind === 'mention' || inline.kind === 'date') {
      const today = new Date();
      const dates: [string, Date, string][] = [
        ['Today', today, 'today'],
        ['Tomorrow', new Date(Date.now() + 86400000), 'tomorrow'],
        ['Yesterday', new Date(Date.now() - 86400000), 'yesterday'],
      ];
      let parsed: Date | null = null;
      if (q && !dates.some((d) => d[0].toLowerCase().startsWith(q))) {
        const t = Date.parse(inline.query);
        if (!isNaN(t)) parsed = new Date(t);
      }
      const list = parsed ? [[fmtDate(parsed), parsed, 'date'] as [string, Date, string]] : dates.filter((d) => !q || d[0].toLowerCase().startsWith(q) || 'date'.startsWith(q) || 'remind'.startsWith(q));
      list.forEach(([label, d]) =>
        opts.push({
          key: 'd' + label,
          section: 'Date',
          icon: <I.CalendarIcon size={18} />,
          label,
          sub: fmtDate(d),
          run: () => replaceWith(`<span class="mention mention-date" data-date="${d.toISOString().slice(0, 10)}" contenteditable="false">@${label === 'Today' || label === 'Tomorrow' || label === 'Yesterday' ? label : fmtDate(d)}</span>`),
        }),
      );
      if (inline.kind === 'mention' && (!q || 'remind me'.startsWith(q)))
        opts.push({
          key: 'rem',
          section: 'Date',
          icon: <I.ClockIcon size={18} />,
          label: 'Remind me',
          sub: 'Today at 9:00 AM',
          run: () => replaceWith(`<span class="mention mention-date" data-date="${new Date().toISOString().slice(0, 10)}" contenteditable="false">@Today 9:00 AM ⏰</span>`),
        });
    }
    if (inline.kind === 'mention' || inline.kind === 'page' || inline.kind === 'link-page') {
      pages.forEach((p) =>
        opts.push({
          key: 'p' + p.id,
          section: inline.kind === 'link-page' ? 'Link to page' : 'Link to page',
          icon: <PageIconView icon={p.props.icon} size={18} page={p} />,
          label: pageTitle(p),
          run: () => {
            if (inline.kind === 'link-page') {
              // +/[[ create a mention-style page link
              replaceWith(mentionPage(p.id));
            } else replaceWith(mentionPage(p.id));
          },
        }),
      );
      if (inline.kind === 'link-page' || (inline.kind === 'mention' && q)) {
        const title = inline.query.trim();
        if (title) {
          opts.push({
            key: 'new',
            section: 'New',
            icon: <I.PlusIcon size={18} />,
            label: `New "${title}" sub-page`,
            run: () => {
              const s = useStore.getState();
              const b = s.blocks[inline.blockId];
              let page = b;
              while (page && page.type !== 'page') page = s.blocks[page.parent!];
              if (!page) return;
              const pid = s.createPage(page.id, { title });
              replaceWith(mentionPage(pid));
            },
          });
        }
      }
    }
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline?.query, inline?.kind, blocks, users]);

  useEffect(() => setActive(0), [inline?.query, inline?.kind]);

  useEffect(() => {
    if (!inline) return;
    if (inline.kind === 'emoji' && !inline.query) {
      set({ menuKey: null });
      return;
    }
    const handler = (e: React.KeyboardEvent | KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setActive((a) => (options.length ? (a + 1) % options.length : 0));
        return true;
      }
      if (e.key === 'ArrowUp') {
        setActive((a) => (options.length ? (a - 1 + options.length) % options.length : 0));
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const o = options[activeRef.current];
        if (o) {
          o.run();
          return true;
        }
        set({ inline: null });
        return false;
      }
      if (e.key === 'Escape') {
        set({ inline: null });
        return true;
      }
      if (e.key === ' ' && inline.kind === 'mention' && options.length === 0) {
        set({ inline: null });
      }
      return false;
    };
    set({ menuKey: handler });
    return () => set({ menuKey: null });
  }, [inline, options, set]);

  if (!inline) return null;
  if (inline.kind === 'emoji' && (!inline.query || options.length === 0)) return null;
  let last = '';
  return (
    <Popover anchor={{ x: inline.rect.left, y: inline.rect.top, h: inline.rect.height || 20 }} onClose={() => set({ inline: null })} width={inline.kind === 'emoji' ? 260 : 320} backdrop={false} offset={6}>
      <div className="menu inline-menu" onMouseDown={(e) => e.preventDefault()}>
        {options.length === 0 && <div className="menu-empty">No results</div>}
        {options.map((o, i) => {
          const header = o.section && o.section !== last ? o.section : null;
          last = o.section;
          return (
            <div key={o.key}>
              {header && <MenuHeader>{header}</MenuHeader>}
              <div className={`menu-item ${i === active ? 'active' : ''}`} onMouseMove={() => i !== active && setActive(i)} onClick={() => o.run()}>
                <div className="menu-item-icon">{o.icon}</div>
                <div className="menu-item-body">
                  <div className="menu-item-label">{o.label}</div>
                </div>
                {o.sub && <div className="menu-item-shortcut">{o.sub}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Popover>
  );
}

/** "Link to page" / "Move to" page picker */
export function PagePicker({
  rect,
  onClose,
  onPick,
  title = 'Link to page',
  excludeId,
  databasesOnly,
}: {
  rect: DOMRect | { x: number; y: number };
  onClose: () => void;
  onPick: (id: string | 'private' | 'team') => void;
  title?: string;
  excludeId?: string;
  databasesOnly?: boolean;
}) {
  const blocks = useStore((s) => s.blocks);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const pages = Object.values(blocks)
    .filter((b) => (databasesOnly ? b.type === 'database' : b.type === 'page' || (b.type === 'database' && !b.props.inline)) && !isTrashed(blocks, b.id) && b.id !== excludeId)
    .filter((b) => !q || pageTitle(b).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 50);
  const showRoots = title === 'Move to' && !q;
  const list = [...(showRoots ? (['private', 'team'] as const) : []), ...pages.map((p) => p.id)];
  return (
    <Popover anchor={rect as any} onClose={onClose} width={340}>
      <div className="menu page-picker">
        <input
          autoFocus
          className="text-input"
          placeholder={title === 'Move to' ? 'Move page to…' : 'Search for a page…'}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(list.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && list[active]) {
              e.preventDefault();
              onPick(list[active]);
            }
          }}
        />
        <div className="pp-list">
          {showRoots && <MenuHeader>Suggested</MenuHeader>}
          {showRoots && (
            <>
              <div className={`menu-item ${active === 0 ? 'active' : ''}`} onClick={() => onPick('private')} onMouseMove={() => setActive(0)}>
                <div className="menu-item-icon"><I.LockIcon size={18} /></div>
                <div className="menu-item-body"><div className="menu-item-label">Private pages</div></div>
              </div>
              <div className={`menu-item ${active === 1 ? 'active' : ''}`} onClick={() => onPick('team')} onMouseMove={() => setActive(1)}>
                <div className="menu-item-icon"><I.UsersIcon size={18} /></div>
                <div className="menu-item-body"><div className="menu-item-label">Teamspace</div></div>
              </div>
            </>
          )}
          <MenuHeader>{q ? 'Results' : 'Recent'}</MenuHeader>
          {pages.map((p, i) => {
            const idx = i + (showRoots ? 2 : 0);
            return (
              <div key={p.id} className={`menu-item ${idx === active ? 'active' : ''}`} onMouseMove={() => setActive(idx)} onClick={() => onPick(p.id)}>
                <div className="menu-item-icon">
                  <PageIconView icon={p.props.icon} size={18} page={p} />
                </div>
                <div className="menu-item-body">
                  <div className="menu-item-label">{pageTitle(p)}</div>
                </div>
              </div>
            );
          })}
          {pages.length === 0 && <div className="menu-empty">No results</div>}
        </div>
      </div>
    </Popover>
  );
}

export function LinkPickerHost() {
  const lp = useEditorUI((s) => s.linkPicker);
  const set = useEditorUI((s) => s.set);
  if (!lp) return null;
  const linkedDb = !!(window as any).__linkedDb;
  return (
    <PagePicker
      rect={lp.rect}
      title={linkedDb ? 'Select data source' : 'Link to page'}
      databasesOnly={linkedDb}
      onClose={() => set({ linkPicker: null })}
      onPick={(pid) => {
        const s = useStore.getState();
        const b = s.blocks[lp.blockId];
        set({ linkPicker: null });
        if (!b || pid === 'private' || pid === 'team') return;
        const empty = !b.text;
        s.batch(() => {
          let nid: string;
          if (linkedDb) {
            const src = s.blocks[pid];
            const view = { ...(src.props.views?.[0] ?? {}), id: Math.random().toString(36).slice(2) };
            if (empty) {
              s.updateBlock(b.id, { type: 'database', text: '', props: { inline: true, linkedDb: pid, views: [view] } });
              nid = b.id;
            } else nid = s.insertBlockAfter(b.id, 'database', '', { inline: true, linkedDb: pid, views: [view] });
          } else if (empty) {
            s.updateBlock(b.id, { type: 'link_to_page', text: '', props: { pageId: pid } });
            nid = b.id;
          } else nid = s.insertBlockAfter(b.id, 'link_to_page', '', { pageId: pid });
          const t = useStore.getState().insertBlockAfter(nid, 'text');
          focusBlock(t, 'start');
        });
      }}
    />
  );
}

export { goPage };
