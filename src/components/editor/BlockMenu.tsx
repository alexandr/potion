import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorUI } from './editorUI';
import { useStore, getPageOf } from '../../store/store';
import { useUI } from '../../store/ui';
import { Popover, MenuItem, MenuSep, MOD, ALT, SHIFT } from '../ui/Popover';
import * as I from '../ui/Icons';
import { TURN_INTO, COLOR_LIST, COLOR_NAMES, isTextType } from '../../lib/blockDefs';
import { deleteSelection, focusBlock, selectedBlocksInOrder, topLevelSelection, turnInto } from './actions';
import { PagePicker } from './InlineMenus';
import { pagePath } from '../../lib/router';
import { relTime } from '../../lib/time';
import { BRAND } from '../../lib/brand';

export function BlockMenu() {
  const bm = useEditorUI((s) => s.blockMenu);
  const set = useEditorUI((s) => s.set);
  const block = useStore((s) => (bm ? s.blocks[bm.blockId] : undefined));
  const users = useStore((s) => s.users);
  const [q, setQ] = useState('');
  const [sub, setSub] = useState<null | { kind: 'turn' | 'color'; rect: DOMRect }>(null);
  const [moveTo, setMoveTo] = useState<DOMRect | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQ('');
    setSub(null);
    setActive(0);
  }, [bm?.blockId]);

  const close = () => {
    set({ blockMenu: null });
    setSub(null);
  };
  const ids = () => {
    const sel = useUI.getState().selected;
    return sel.includes(bm!.blockId) ? topLevelSelection(selectedBlocksInOrder()) : [bm!.blockId];
  };

  const actions = useMemo(() => {
    if (!bm || !block) return [];
    const textual = isTextType(block.type);
    const list: { key: string; icon: React.ReactNode; label: string; shortcut?: string; run: (e?: React.MouseEvent) => void; chevron?: boolean; danger?: boolean; sep?: boolean }[] = [];
    if (textual || block.type === 'page')
      list.push({ key: 'turn', icon: <I.TurnIntoIcon size={16} />, label: 'Turn into', chevron: true, run: (e) => e && setSub({ kind: 'turn', rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }) });
    if (textual || ['divider', 'toc', 'page', 'image'].includes(block.type))
      list.push({ key: 'color', icon: <I.PaintIcon size={16} />, label: 'Color', chevron: true, run: (e) => e && setSub({ kind: 'color', rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }) });
    list.push({
      key: 'link',
      icon: <I.LinkIcon size={16} />,
      label: 'Copy link to block',
      shortcut: `${ALT}${SHIFT}L`,
      sep: true,
      run: () => {
        const page = getPageOf(useStore.getState().blocks, block.id);
        const url = location.origin + (page ? pagePath(page.id, page.props.title ?? '') : '') + '#' + block.id;
        navigator.clipboard?.writeText(url).catch(() => {});
        useUI.getState().showToast('Copied link to clipboard');
        close();
      },
    });
    list.push({
      key: 'dup',
      icon: <I.DuplicateIcon size={16} />,
      label: 'Duplicate',
      shortcut: `${MOD}D`,
      run: () => {
        const s = useStore.getState();
        const all = ids();
        let lastId = '';
        s.batch(() => {
          let after = all[all.length - 1];
          all.forEach((id) => {
            const b = useStore.getState().blocks[id];
            const p = useStore.getState().blocks[b.parent!];
            const at = p.children.indexOf(after) + 1;
            lastId = useStore.getState().duplicateBlock(id, b.parent!, at);
            after = lastId;
          });
        });
        useUI.getState().select([lastId]);
        close();
      },
    });
    list.push({ key: 'move', icon: <I.MoveToIcon size={16} />, label: 'Move to', shortcut: `${MOD}${SHIFT}P`, run: (e) => e && setMoveTo((e.currentTarget as HTMLElement).getBoundingClientRect()) });
    list.push({
      key: 'del',
      icon: <I.TrashIcon size={16} />,
      label: 'Delete',
      shortcut: 'Del',
      run: () => {
        useUI.getState().select(ids());
        deleteSelection();
        close();
      },
    });
    list.push({
      key: 'comment',
      icon: <I.CommentIcon size={16} />,
      label: 'Comment',
      shortcut: `${MOD}${SHIFT}M`,
      sep: true,
      run: () => {
        useUI.getState().set({ commentsOpen: true });
        (window as any).__commentBlock = block.id;
        close();
      },
    });
    list.push({ key: 'ai', icon: <I.SparkleIcon size={16} />, label: 'Ask AI', shortcut: `${MOD}J`, run: () => { useUI.getState().showToast(`${BRAND} AI is not available in this demo workspace`); close(); } });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bm, block]);

  const turnOpts = TURN_INTO.filter((t) => !q || t.label.toLowerCase().includes(q.toLowerCase()));
  const filtered = q
    ? [
        ...actions.filter((a) => a.label.toLowerCase().includes(q.toLowerCase()) && !a.chevron),
        ...turnOpts.map((t) => ({ key: 'turn-' + t.label, icon: t.icon, label: `Turn into ${t.label}`, run: () => { ids().forEach((id) => turnInto(id, t.type, t.props)); close(); } })),
      ]
    : actions;

  useEffect(() => {
    if (bm?.mode === 'turn' && !sub) {
      const r = new DOMRect((bm.anchor as any).x ?? (bm.anchor as DOMRect).left, (bm.anchor as any).y ?? (bm.anchor as DOMRect).top, 0, 0);
      setSub({ kind: 'turn', rect: r });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bm]);

  if (!bm || !block) return null;
  const editor = users[block.lastEditedBy];

  const applyColor = (c: string | undefined) => {
    const s = useStore.getState();
    s.batch(() => ids().forEach((id) => s.setProps(id, { color: c })));
    close();
  };

  if (bm.mode === 'turn' && sub)
    return (
      <Popover anchor={sub.rect} onClose={close} width={240}>
        <TurnMenu blockType={block.type} toggleable={!!block.props.toggleable} onPick={(t, p) => { ids().forEach((id) => turnInto(id, t, p)); close(); }} />
      </Popover>
    );

  return (
    <>
      <Popover anchor={bm.anchor as any} onClose={close} width={265} placement="left-start" offset={6}>
        <div className="menu block-menu">
          <div className="menu-search">
            <input
              ref={inputRef}
              autoFocus
              placeholder="Search actions…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(filtered.length - 1, a + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const f = filtered[active];
                  if (f) f.run();
                }
              }}
            />
          </div>
          <div className="menu-type-label">{block.type === 'page' ? 'Page' : TURN_INTO.find((t) => t.type === block.type)?.label ?? 'Block'}</div>
          {filtered.map((a, i) => (
            <div key={a.key}>
              {(a as any).sep && !q && <MenuSep />}
              <MenuItem
                icon={a.icon}
                label={a.label}
                shortcut={(a as any).shortcut}
                chevron={(a as any).chevron}
                active={i === active}
                onMouseEnter={(e) => {
                  setActive(i);
                  if ((a as any).chevron) a.run(e);
                  else setSub(null);
                }}
                onClick={(e) => a.run(e)}
              />
            </div>
          ))}
          {filtered.length === 0 && <div className="menu-empty">No results</div>}
          <MenuSep />
          <div className="menu-footer">
            <div>Last edited by {editor?.name ?? 'Unknown'}</div>
            <div>{relTime(block.updatedAt, true)}</div>
          </div>
        </div>
      </Popover>
      {sub?.kind === 'turn' && (
        <Popover anchor={sub.rect} onClose={() => setSub(null)} width={240} placement="right-start" backdrop={false} offset={2}>
          <TurnMenu blockType={block.type} toggleable={!!block.props.toggleable} onPick={(t, p) => { ids().forEach((id) => turnInto(id, t, p)); close(); }} />
        </Popover>
      )}
      {sub?.kind === 'color' && (
        <Popover anchor={sub.rect} onClose={() => setSub(null)} width={220} placement="right-start" backdrop={false} offset={2}>
          <div className="menu">
            <div className="menu-header">Text color</div>
            {COLOR_LIST.map((c) => (
              <MenuItem
                key={c}
                icon={<div className="color-swatch" style={{ color: c === 'default' ? 'var(--text)' : `var(--c-${c})` }}>A</div>}
                label={c === 'default' ? 'Default text' : `${COLOR_NAMES[c]} text`}
                checked={(block.props.color ?? 'default') === c}
                onClick={() => applyColor(c === 'default' ? undefined : c)}
              />
            ))}
            <div className="menu-header">Background color</div>
            {COLOR_LIST.map((c) => (
              <MenuItem
                key={'bg' + c}
                icon={<div className="color-swatch" style={{ background: c === 'default' ? 'transparent' : `var(--bg-${c})` }}>A</div>}
                label={c === 'default' ? 'Default background' : `${COLOR_NAMES[c]} background`}
                checked={block.props.color === `${c}_background`}
                onClick={() => applyColor(c === 'default' ? undefined : `${c}_background`)}
              />
            ))}
          </div>
        </Popover>
      )}
      {moveTo && (
        <PagePicker
          rect={moveTo}
          title="Move to"
          excludeId={block.id}
          onClose={() => setMoveTo(null)}
          onPick={(pid) => {
            const s = useStore.getState();
            if (pid === 'private' || pid === 'team') {
              if (block.type === 'page') s.moveRoot(block.id, pid, 0);
            } else {
              const target = s.blocks[pid];
              s.batch(() => ids().forEach((id) => s.moveBlock(id, pid, target.type === 'database' ? target.children.length : useStore.getState().blocks[pid].children.length)));
              useUI.getState().showToast(`Moved to ${target.props.title || 'Untitled'}`);
            }
            setMoveTo(null);
            close();
            useUI.getState().select([]);
          }}
        />
      )}
    </>
  );
}

function TurnMenu({ blockType, toggleable, onPick }: { blockType: string; toggleable: boolean; onPick: (t: any, p?: any) => void }) {
  return (
    <div className="menu">
      <div className="menu-header">Turn into</div>
      {TURN_INTO.map((t) => (
        <MenuItem key={t.label} icon={t.icon} label={t.label} checked={blockType === t.type && toggleable === !!t.props?.toggleable} onClick={() => onPick(t.type, t.props)} />
      ))}
    </div>
  );
}

export { focusBlock };
