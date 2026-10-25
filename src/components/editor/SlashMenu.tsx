import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorUI } from './editorUI';
import { SLASH_ITEMS, type SlashItem } from '../../lib/blockDefs';
import { useStore } from '../../store/store';
import { editableEl, focusBlock, turnInto } from './actions';
import { deleteRange, restore } from '../../lib/format';
import { getCaretOffset, getCaretRect } from '../../lib/dom';
import { goPage } from '../../lib/router';
import { Popover } from '../ui/Popover';

function score(item: SlashItem, q: string): number {
  if (!q) return 1;
  const s = q.toLowerCase().trim();
  const label = item.label.toLowerCase();
  if (label.startsWith(s)) return 100 - label.length;
  if (label.split(/[\s-]+/).some((w) => w.startsWith(s))) return 60;
  const compact = s.replace(/\s+/g, '');
  if (item.keywords.split(' ').some((k) => k.startsWith(compact))) return 40;
  if (label.replace(/\s+/g, '').includes(compact)) return 30;
  return 0;
}

export function runSlashItem(item: SlashItem, blockId: string) {
  const s = useStore.getState();
  const b = s.blocks[blockId];
  if (!b) return;
  const el = editableEl(blockId);
  const empty = !el || (el.textContent ?? '').trim() === '';
  const ed = useEditorUI.getState();
  const caretRect = () => getCaretRect() ?? el?.getBoundingClientRect() ?? new DOMRect();

  if (item.action === 'color') {
    s.setProps(blockId, { color: item.color === 'default' || item.color === 'default_background' ? undefined : item.color });
    focusBlock(blockId, 'end');
    return;
  }
  if (item.action === 'mention-person' || item.action === 'mention-page' || item.action === 'date' || item.action === 'emoji') {
    if (!el) return;
    const off = getCaretOffset(el);
    const kind = item.action === 'mention-person' ? 'person' : item.action === 'mention-page' ? 'page' : item.action === 'date' ? 'date' : 'emoji';
    ed.set({ inline: { kind, blockId, rect: caretRect(), query: '', start: off, trigger: '' } });
    return;
  }
  if (item.action === 'inline-equation') {
    if (!el) return;
    import('./katex').then(({ renderKatex }) => {
      const off = getCaretOffset(el);
      restore(el, off, off);
      const span = document.createElement('span');
      span.className = 'equation-inline';
      span.setAttribute('contenteditable', 'false');
      span.setAttribute('data-expr', '');
      span.innerHTML = renderKatex('', false);
      const r = window.getSelection()!.getRangeAt(0);
      r.insertNode(span);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      import('./InlineEquation').then((m) => m.openInlineEquation(span, blockId));
    });
    return;
  }
  if (item.action === 'link-to-page' || item.action === 'linked-db') {
    ed.set({ linkPicker: { blockId, rect: el?.getBoundingClientRect() ?? caretRect(), mode: 'link-block' } });
    if (item.action === 'linked-db') ed.set({ linkPicker: { blockId, rect: el?.getBoundingClientRect() ?? caretRect(), mode: 'link-block' } });
    (window as any).__linkedDb = item.action === 'linked-db';
    return;
  }

  s.batch(() => {
    const parent = s.blocks[b.parent!];
    const idx = parent.children.indexOf(blockId);
    const at = empty ? idx : idx + 1;
    if (item.action === 'page') {
      const pid = s.createPage(parent.id, {}, at);
      if (empty) useStore.getState().deleteBlock(blockId);
      goPage(pid, '');
      return;
    }
    if (item.action === 'db-inline' || item.action === 'db-full') {
      const dbId = s.createDatabase(parent.id, item.action === 'db-inline', at, item.view);
      if (empty) useStore.getState().deleteBlock(blockId);
      if (item.action === 'db-full') goPage(dbId, '');
      else {
        const nid = useStore.getState().insertBlockAfter(dbId, 'text');
        void nid;
      }
      return;
    }
    if (item.action === 'columns') {
      const n = item.columns ?? 2;
      const list = s.createBlock(parent.id, at, 'column_list');
      let first = '';
      for (let i = 0; i < n; i++) {
        const col = useStore.getState().createBlock(list, i, 'column', '', { width: 1 / n });
        const t = useStore.getState().createBlock(col, 0, 'text');
        if (i === 0) first = t;
      }
      if (empty) useStore.getState().deleteBlock(blockId);
      focusBlock(first, 'start');
      return;
    }
    const type = item.type!;
    const props: Record<string, any> = { ...(item.props ?? {}) };
    if (type === 'callout') props.icon = '💡';
    if (type === 'code') props.language = props.language ?? 'JavaScript';
    if (['image', 'video', 'audio', 'file', 'embed', 'bookmark', 'equation'].includes(type)) props.justCreated = true;
    if (type === 'table') props.rows = [['', '', ''], ['', '', ''], ['', '', '']];
    if (type === 'toggle' || props.toggleable) props.open = true;
    if (type === 'synced') {
      const id = s.createBlock(parent.id, at, 'synced');
      const t = useStore.getState().createBlock(id, 0, 'text');
      if (empty) useStore.getState().deleteBlock(blockId);
      focusBlock(t, 'start');
      return;
    }
    const textual = ['text', 'h1', 'h2', 'h3', 'bulleted', 'numbered', 'todo', 'toggle', 'quote', 'callout', 'code'].includes(type);
    if (empty && textual) {
      turnInto(blockId, type, props);
      focusBlock(blockId, 'end');
      return;
    }
    if (empty) {
      useStore.getState().updateBlock(blockId, { type, text: '', props });
      if (!['image', 'video', 'audio', 'file', 'embed', 'bookmark', 'equation'].includes(type)) {
        const nid = useStore.getState().insertBlockAfter(blockId, 'text');
        focusBlock(nid, 'start');
      } else {
        (document.activeElement as HTMLElement)?.blur();
        useStore.getState().insertBlockAfter(blockId, 'text');
      }
      return;
    }
    const nid = s.createBlock(parent.id, at, type, '', props);
    if (textual) focusBlock(nid, 'start');
    else {
      (document.activeElement as HTMLElement)?.blur();
      if (['divider', 'toc', 'breadcrumb', 'table', 'button'].includes(type)) {
        const t = useStore.getState().insertBlockAfter(nid, 'text');
        focusBlock(t, 'start');
      }
    }
  });
}

export function SlashMenu() {
  const slash = useEditorUI((s) => s.slash);
  const set = useEditorUI((s) => s.set);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const noMatchCount = useRef(0);

  const items = useMemo(() => {
    if (!slash) return [];
    const q = slash.query;
    if (!q) return SLASH_ITEMS.filter((i) => i.group !== 'Color' && i.group !== 'Background color');
    return SLASH_ITEMS.map((i) => ({ i, s: score(i, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.i);
  }, [slash]);

  useEffect(() => setActive(0), [slash?.query]);

  useEffect(() => {
    if (!slash) return;
    if (items.length === 0) {
      noMatchCount.current++;
      if (slash.query.length > 3 && noMatchCount.current > 2) set({ slash: null });
    } else noMatchCount.current = 0;
  }, [items.length, slash, set]);

  const choose = (item: SlashItem) => {
    if (!slash) return;
    const el = editableEl(slash.blockId);
    if (el) {
      const caret = getCaretOffset(el);
      deleteRange(el, slash.start - 1, Math.max(caret, slash.start));
    }
    const id = slash.blockId;
    set({ slash: null, menuKey: null });
    // let the input event settle
    setTimeout(() => runSlashItem(item, id), 0);
  };

  useEffect(() => {
    if (!slash) {
      set({ menuKey: null });
      return;
    }
    const handler = (e: React.KeyboardEvent | KeyboardEvent) => {
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey) || (e.key === 'n' && e.ctrlKey)) {
        setActive((a) => (items.length ? (a + 1) % items.length : 0));
        return true;
      }
      if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey) || (e.key === 'p' && e.ctrlKey)) {
        setActive((a) => (items.length ? (a - 1 + items.length) % items.length : 0));
        return true;
      }
      if (e.key === 'Enter') {
        const it = items[activeRef.current];
        if (it) choose(it);
        else set({ slash: null });
        return true;
      }
      if (e.key === 'Escape') {
        set({ slash: null });
        return true;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        set({ slash: null });
        return false;
      }
      return false;
    };
    set({ menuKey: handler });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slash, items]);

  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const el = listRef.current?.querySelector('.menu-item.active') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!slash) return null;
  let lastGroup = '';
  return (
    <Popover anchor={{ x: slash.rect.left, y: slash.rect.top, h: slash.rect.height || 20 }} onClose={() => set({ slash: null })} width={324} backdrop={false} offset={6}>
      <div className="slash-menu" ref={listRef} onMouseDown={(e) => e.preventDefault()}>
        <div className="slash-scroll">
          {items.length === 0 && <div className="menu-empty">No results</div>}
          {items.map((it, idx) => {
            const header = !slash.query && it.group !== lastGroup ? it.group : slash.query && idx === 0 ? 'Filtered results' : null;
            lastGroup = it.group;
            return (
              <div key={it.key}>
                {header && <div className="menu-header">{header}</div>}
                <div
                  className={`menu-item slash-item ${idx === active ? 'active' : ''}`}
                  onMouseMove={() => idx !== active && setActive(idx)}
                  onClick={() => choose(it)}
                >
                  {it.icon}
                  <div className="menu-item-body">
                    <div className="menu-item-label">{it.label}</div>
                  </div>
                  {it.hint && <div className="menu-item-shortcut">{it.hint}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="slash-footer">
          <span>Type '/' on the page</span>
          <span className="kbd-hint">esc</span>
        </div>
      </div>
    </Popover>
  );
}
