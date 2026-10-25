import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import type { ID } from '../../store/types';
import { useUI } from '../../store/ui';
import { BlockList } from './Block';
import { useEditorUI } from './editorUI';
import * as I from '../ui/Icons';
import {
  deleteSelection,
  ensureTrailingBlock,
  flatten,
  focusBlock,
  indent,
  isEditableType,
  outdent,
  selectedBlocksInOrder,
  topLevelSelection,
  moveUpDown,
  editableEl,
} from './actions';
import { onCopyEvent, parseMarkdown, insertClipBlocks } from './clipboard';
import { Tooltip } from '../ui/Tooltip';

interface DropTarget {
  id: ID;
  pos: 'before' | 'after' | 'left' | 'right' | 'inside';
  rect: DOMRect;
}

export function PageEditor({ pageId, readOnly }: { pageId: ID; readOnly?: boolean }) {
  const page = useStore((s) => s.blocks[pageId]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ id: ID; top: number; left: number; h: number } | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const [rubber, setRubber] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const dragRef = useRef<{ ids: ID[]; ghost: HTMLElement | null; startX: number; startY: number; active: boolean; handleId: ID } | null>(null);
  const hoverFrozen = useRef(false);

  // ---------- hover handle ----------
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scroller = root.closest('.scroller') as HTMLElement | null;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (hoverFrozen.current || dragRef.current?.active) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rr = root.getBoundingClientRect();
        if (e.clientY < rr.top - 4 || e.clientY > rr.bottom + 4 || e.clientX < rr.left - 120 || e.clientX > rr.right + 60) {
          setHover(null);
          return;
        }
        const selfs = Array.from(root.querySelectorAll('[data-block-self]')) as HTMLElement[];
        let best: HTMLElement | null = null;
        for (const el of selfs) {
          const r = el.getBoundingClientRect();
          if (e.clientY >= r.top && e.clientY < r.bottom) {
            // horizontal: inside columns need x within column
            const col = el.closest('.column') as HTMLElement | null;
            if (col) {
              const cr = col.getBoundingClientRect();
              if (e.clientX < cr.left - 60 || e.clientX > cr.right + 10) continue;
            }
            best = el; // deepest wins (later in DOM order)
          }
        }
        if (!best) {
          setHover(null);
          return;
        }
        const id = best.getAttribute('data-block-self')!;
        const b = useStore.getState().blocks[id];
        if (!b || b.type === 'column_list') {
          setHover(null);
          return;
        }
        const r = best.getBoundingClientRect();
        const ed = best.querySelector('[data-editable]') as HTMLElement | null;
        let top = r.top;
        let h = 24;
        if (ed) {
          const er = ed.getBoundingClientRect();
          const lh = parseFloat(getComputedStyle(ed).lineHeight) || 24;
          top = er.top + parseFloat(getComputedStyle(ed).paddingTop || '0');
          h = Math.min(lh, er.height);
        } else top = r.top + 2;
        setHover({ id, top: top - rr.top + h / 2 - 12, left: r.left - rr.left, h });
        useEditorUI.getState().set({ hoverBlock: id });
      });
    };
    const onLeave = () => {
      if (!hoverFrozen.current) setHover(null);
    };
    (scroller ?? root).addEventListener('mousemove', onMove);
    (scroller ?? root).addEventListener('mouseleave', onLeave);
    return () => {
      (scroller ?? root).removeEventListener('mousemove', onMove);
      (scroller ?? root).removeEventListener('mouseleave', onLeave);
    };
  }, [pageId]);

  // hide handle while typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey && e.key.length === 1) setHover(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- selection keyboard + copy/paste ----------
  useEffect(() => {
    const isOurs = (id: ID) => !!rootRef.current?.querySelector(`[data-block-id="${id}"]`);
    const onKey = (e: KeyboardEvent) => {
      const sel = useUI.getState().selected;
      if (!sel.length || !isOurs(sel[0])) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      if (document.querySelector('.popover')) return;
      const mod = e.metaKey || e.ctrlKey;
      const s = useStore.getState();
      const ordered = selectedBlocksInOrder();
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        deleteSelection();
      } else if (e.key === 'Escape') {
        useUI.getState().select([]);
      } else if (e.key === 'Enter' && !mod) {
        e.preventDefault();
        const id = ordered[ordered.length - 1];
        const b = s.blocks[id];
        useUI.getState().select([]);
        if (b && isEditableType(b.type)) focusBlock(id, 'end');
        else if (b?.type === 'page') import('../../lib/router').then((r) => r.goPage(id, b.props.title));
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !mod) {
        e.preventDefault();
        const list = flatten(pageId);
        const anchor = e.key === 'ArrowUp' ? ordered[0] : ordered[ordered.length - 1];
        let i = list.indexOf(anchor) + (e.key === 'ArrowUp' ? -1 : 1);
        // skip children of selected
        while (i >= 0 && i < list.length && s.blocks[list[i]]?.type === 'column') i += e.key === 'ArrowUp' ? -1 : 1;
        if (i < 0 || i >= list.length) return;
        const next = list[i];
        if (e.shiftKey) useUI.getState().select(Array.from(new Set([...sel, next])));
        else useUI.getState().select([next]);
        document.querySelector(`[data-block-id="${next}"]`)?.scrollIntoView({ block: 'nearest' });
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && mod && e.shiftKey) {
        e.preventDefault();
        const ids = topLevelSelection(ordered);
        (e.key === 'ArrowUp' ? ids : [...ids].reverse()).forEach((id) => moveUpDown(id, e.key === 'ArrowUp' ? -1 : 1));
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const ids = topLevelSelection(ordered);
        s.batch(() => (e.shiftKey ? [...ids].reverse() : ids).forEach((id) => (e.shiftKey ? outdent(id) : indent(id))));
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const ids = topLevelSelection(ordered);
        const newIds: ID[] = [];
        s.batch(() => {
          let after = ids[ids.length - 1];
          ids.forEach((id) => {
            const b = useStore.getState().blocks[id];
            const p = useStore.getState().blocks[b.parent!];
            const n = useStore.getState().duplicateBlock(id, b.parent!, p.children.indexOf(after) + 1);
            newIds.push(n);
            after = n;
          });
        });
        useUI.getState().select(newIds);
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        useUI.getState().select(useStore.getState().blocks[pageId].children.filter((c) => !useStore.getState().blocks[c]?.props.trashed));
      } else if (mod && e.key === '/') {
        e.preventDefault();
        const el = document.querySelector(`[data-block-self="${ordered[0]}"]`) as HTMLElement | null;
        const r = el?.getBoundingClientRect();
        if (r) useEditorUI.getState().set({ blockMenu: { blockId: ordered[0], anchor: { x: r.left, y: r.top } } });
      } else if (mod && e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
      }
    };
    const onCopy = (e: ClipboardEvent) => {
      const sel = useUI.getState().selected;
      if (!sel.length || !isOurs(sel[0])) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      onCopyEvent(e, topLevelSelection(selectedBlocksInOrder()));
    };
    const onCut = (e: ClipboardEvent) => {
      const sel = useUI.getState().selected;
      if (!sel.length || !isOurs(sel[0])) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      onCopyEvent(e, topLevelSelection(selectedBlocksInOrder()));
      deleteSelection();
    };
    const onPaste = (e: ClipboardEvent) => {
      const sel = useUI.getState().selected;
      if (!sel.length || !isOurs(sel[0])) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const html = e.clipboardData?.getData('text/html') ?? '';
      void html;
      const list = parseMarkdown(text);
      const ordered = selectedBlocksInOrder();
      const last = insertClipBlocks(ordered[ordered.length - 1], list);
      useUI.getState().select([]);
      if (last) focusBlock(last, 'end');
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, [pageId]);

  // ---------- rubber band selection from margins ----------
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scroller = root.closest('.scroller') as HTMLElement | null;
    if (!scroller) return;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || readOnly) return;
      const t = e.target as HTMLElement;
      if (t.closest('[contenteditable="true"], input, textarea, button, a, .popover, .page-header, .db, .block-handle, .media-block, .simple-table-wrap, .code-block, .page-link, .equation-block, .callout-icon, .checkbox, .toggle-arrow, .column-gutter, .peek-panel .peek-top, .comments-section, .backlinks')) return;
      if (!scroller.contains(t)) return;
      const x0 = e.clientX;
      const y0 = e.clientY;
      let moved = false;
      const rect0 = root.getBoundingClientRect();
      const move = (ev: MouseEvent) => {
        if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        if (!moved) {
          moved = true;
          (document.activeElement as HTMLElement)?.blur();
          window.getSelection()?.removeAllRanges();
        }
        ev.preventDefault();
        const box = { l: Math.min(x0, ev.clientX), r: Math.max(x0, ev.clientX), t: Math.min(y0, ev.clientY), b: Math.max(y0, ev.clientY) };
        setRubber({ x0: box.l, y0: box.t, x1: box.r, y1: box.b });
        const hits: ID[] = [];
        root.querySelectorAll('[data-block-self]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.right >= box.l && r.left <= box.r && r.bottom >= box.t && r.top <= box.b) hits.push(el.getAttribute('data-block-self')!);
        });
        const blocks = useStore.getState().blocks;
        const filtered = hits.filter((h) => blocks[h] && blocks[h].type !== 'column_list');
        useUI.getState().select(topLevelSelection(filtered));
      };
      const up = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        setRubber(null);
        if (!moved) {
          useUI.getState().select([]);
          // click below content -> trailing block; click in margin -> focus row
          const rr = root.getBoundingClientRect();
          if (ev.clientY > rr.bottom - 2 && !readOnly) {
            ensureTrailingBlock(pageId);
            return;
          }
          const selfs = Array.from(root.querySelectorAll('[data-block-self]')) as HTMLElement[];
          let hit: HTMLElement | null = null;
          for (const el of selfs) {
            const r = el.getBoundingClientRect();
            if (ev.clientY >= r.top && ev.clientY < r.bottom) hit = el;
          }
          if (hit) {
            const id = hit.getAttribute('data-block-self')!;
            const b = useStore.getState().blocks[id];
            if (b && isEditableType(b.type)) focusBlock(id, ev.clientX < rect0.left + 20 ? 'start' : 'end');
          }
        }
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    };
    scroller.addEventListener('mousedown', onDown);
    return () => scroller.removeEventListener('mousedown', onDown);
  }, [pageId, readOnly]);

  // clear block selection on any mousedown inside editable
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.block-handle, .popover, .popover-backdrop')) return;
      if (useUI.getState().selected.length && t.closest('[contenteditable="true"]')) useUI.getState().select([]);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, []);

  // ---------- drag and drop ----------
  const computeDrop = (x: number, y: number, dragging: ID[]): DropTarget | null => {
    const root = rootRef.current!;
    const blocks = useStore.getState().blocks;
    const selfs = Array.from(root.querySelectorAll('[data-block-self]')) as HTMLElement[];
    let best: HTMLElement | null = null;
    for (const el of selfs) {
      const r = el.getBoundingClientRect();
      if (y >= r.top - 2 && y < r.bottom + 2) {
        const col = el.closest('.column') as HTMLElement | null;
        if (col) {
          const cr = col.getBoundingClientRect();
          if (x < cr.left - 30 || x > cr.right + 30) continue;
        }
        best = el;
      }
    }
    if (!best) {
      // below last block
      const rr = root.getBoundingClientRect();
      const top = (blocks[pageId]?.children ?? []).filter((c) => !blocks[c]?.props.trashed);
      if (y > rr.top && top.length) {
        const lastId = top[top.length - 1];
        const el = root.querySelector(`[data-block-id="${lastId}"]`) as HTMLElement | null;
        if (el && y > el.getBoundingClientRect().bottom) return { id: lastId, pos: 'after', rect: el.getBoundingClientRect() };
      }
      return null;
    }
    let id = best.getAttribute('data-block-self')!;
    // don't drop into itself / own descendants
    for (const d of dragging) {
      let cur: ID | null = id;
      while (cur) {
        if (cur === d) return null;
        cur = blocks[cur]?.parent ?? null;
      }
    }
    const b = blocks[id];
    if (!b) return null;
    if (b.type === 'column_list') return null;
    const wrap = best.closest('[data-block-id]') as HTMLElement;
    const r = best.getBoundingClientRect();
    const parent = blocks[b.parent!];
    const atTop = parent && (parent.type === 'page' || parent.type === 'column');
    if (atTop && x > r.right - 60 && x < r.right + 40) return { id, pos: 'right', rect: r };
    if (atTop && x < r.left + 4 && x > r.left - 80 && parent.type !== 'column') return { id, pos: 'left', rect: r };
    if ((b.type === 'toggle' || b.props.toggleable) && y > r.top + r.height * 0.5 && x > r.left + 40) return { id, pos: 'inside', rect: r };
    if (y < r.top + r.height / 2) return { id, pos: 'before', rect: r };
    // dropping after a block that has children -> after its whole subtree
    const wr = wrap.getBoundingClientRect();
    void wr;
    const isToggle = b.type === 'toggle' || b.props.toggleable;
    if (b.children.length && b.type !== 'callout' && b.type !== 'synced' && (!isToggle || b.props.open) && !['page', 'database', 'column_list'].includes(b.type))
      return { id, pos: 'inside', rect: r };
    return { id, pos: 'after', rect: r };
  };

  const performDrop = (t: DropTarget, ids: ID[]) => {
    const s = useStore.getState();
    const blocks = s.blocks;
    const target = blocks[t.id];
    if (!target) return;
    s.batch(() => {
      if (t.pos === 'before' || t.pos === 'after') {
        const parent = useStore.getState().blocks[target.parent!];
        let idx = parent.children.indexOf(t.id) + (t.pos === 'after' ? 1 : 0);
        ids.forEach((id) => {
          const cur = useStore.getState().blocks[id];
          const p = useStore.getState().blocks[target.parent!];
          const wasBefore = cur.parent === p.id && p.children.indexOf(id) < idx;
          useStore.getState().moveBlock(id, target.parent!, idx);
          if (!wasBefore) idx++;
        });
      } else if (t.pos === 'inside') {
        if (!target.props.open) useStore.getState().setProps(t.id, { open: true });
        ids.forEach((id, i) => useStore.getState().moveBlock(id, t.id, i));
      } else {
        const parent = useStore.getState().blocks[target.parent!];
        if (parent.type === 'column') {
          const list = useStore.getState().blocks[parent.parent!];
          const at = list.children.indexOf(parent.id) + (t.pos === 'right' ? 1 : 0);
          const col = useStore.getState().createBlock(list.id, at, 'column', '', {});
          ids.forEach((id, i) => useStore.getState().moveBlock(id, col, i));
          const l2 = useStore.getState().blocks[list.id];
          l2.children.forEach((c) => useStore.getState().setProps(c, { width: 1 / l2.children.length }));
        } else {
          const idx = parent.children.indexOf(t.id);
          const list = useStore.getState().createBlock(parent.id, idx, 'column_list');
          const c1 = useStore.getState().createBlock(list, 0, 'column', '', { width: 0.5 });
          const c2 = useStore.getState().createBlock(list, 1, 'column', '', { width: 0.5 });
          const [targetCol, dragCol] = t.pos === 'right' ? [c1, c2] : [c2, c1];
          useStore.getState().moveBlock(t.id, targetCol, 0);
          ids.forEach((id, i) => useStore.getState().moveBlock(id, dragCol, i));
        }
      }
    });
  };

  const onHandleDown = (e: React.MouseEvent, id: ID) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const sel = useUI.getState().selected;
    const ids = sel.includes(id) ? topLevelSelection(selectedBlocksInOrder()) : [id];
    dragRef.current = { ids, ghost: null, startX: e.clientX, startY: e.clientY, active: false, handleId: id };
    hoverFrozen.current = true;
    const move = (ev: MouseEvent) => {
      const d = dragRef.current!;
      if (!d.active) {
        if (Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < 4) return;
        d.active = true;
        useUI.getState().set({ dragging: true });
        useUI.getState().select(d.ids);
        const ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        d.ids.forEach((bid) => {
          const el = rootRef.current?.querySelector(`[data-block-id="${bid}"]`) as HTMLElement | null;
          if (el) {
            const c = el.cloneNode(true) as HTMLElement;
            c.style.width = el.getBoundingClientRect().width + 'px';
            ghost.appendChild(c);
          }
        });
        document.body.appendChild(ghost);
        d.ghost = ghost;
        document.body.classList.add('dragging-blocks');
        setHover(null);
      }
      if (d.ghost) {
        d.ghost.style.left = ev.clientX + 4 + 'px';
        d.ghost.style.top = ev.clientY + 4 + 'px';
      }
      // sidebar page target
      const over = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      document.querySelectorAll('.sidebar-item.drop-into').forEach((x) => x.classList.remove('drop-into'));
      const side = over?.closest('[data-sidebar-page]') as HTMLElement | null;
      if (side) {
        side.classList.add('drop-into');
        setDrop(null);
        return;
      }
      setDrop(computeDrop(ev.clientX, ev.clientY, d.ids));
      // autoscroll
      const scroller = rootRef.current?.closest('.scroller') as HTMLElement | null;
      if (scroller) {
        const sr = scroller.getBoundingClientRect();
        if (ev.clientY < sr.top + 50) scroller.scrollTop -= 12;
        else if (ev.clientY > sr.bottom - 50) scroller.scrollTop += 12;
      }
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      const d = dragRef.current!;
      hoverFrozen.current = false;
      document.body.classList.remove('dragging-blocks');
      d.ghost?.remove();
      useUI.getState().set({ dragging: false });
      if (!d.active) {
        // click: select + open block menu
        useUI.getState().select(sel.includes(id) ? sel : [id]);
        (document.activeElement as HTMLElement)?.blur();
        const hr = (e.target as HTMLElement).closest('.block-handle')?.getBoundingClientRect();
        useEditorUI.getState().set({ blockMenu: { blockId: id, anchor: hr ? new DOMRect(hr.left, hr.top, hr.width, hr.height) : { x: ev.clientX, y: ev.clientY } } });
        dragRef.current = null;
        return;
      }
      const over = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const side = over?.closest('[data-sidebar-page]') as HTMLElement | null;
      document.querySelectorAll('.sidebar-item.drop-into').forEach((x) => x.classList.remove('drop-into'));
      if (side) {
        const pid = side.getAttribute('data-sidebar-page')!;
        const s = useStore.getState();
        if (!d.ids.includes(pid)) s.batch(() => d.ids.forEach((bid) => useStore.getState().moveBlock(bid, pid, useStore.getState().blocks[pid].children.length)));
        useUI.getState().select([]);
      } else {
        const t = computeDrop(ev.clientX, ev.clientY, d.ids);
        if (t) performDrop(t, d.ids);
      }
      setDrop(null);
      dragRef.current = null;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onPlus = (e: React.MouseEvent, id: ID) => {
    e.preventDefault();
    const s = useStore.getState();
    const b = s.blocks[id];
    if (!b) return;
    let nid: ID;
    if (b.type === 'text' && !b.text && !e.altKey) {
      nid = id;
      s.updateBlock(id, { text: '/' });
    } else if (e.altKey) {
      const p = s.blocks[b.parent!];
      nid = s.createBlock(p.id, p.children.indexOf(id), 'text', '/');
    } else nid = s.insertBlockAfter(id, 'text', '/');
    focusBlock(nid, 'end');
    setTimeout(() => {
      const el = editableEl(nid);
      if (!el) return;
      const r = el.getBoundingClientRect();
      useEditorUI.getState().set({ slash: { blockId: nid, rect: new DOMRect(r.left, r.top, 0, r.height), query: '', start: 1 } });
    }, 50);
  };

  if (!page) return null;
  const rr = rootRef.current?.getBoundingClientRect();

  return (
    <div className="page-blocks" ref={rootRef} data-page-blocks={pageId}>
      <BlockList ids={page.children} readOnly={readOnly} />
      {!readOnly && hover && (
        <div className="block-handle" style={{ top: hover.top, left: hover.left - 50 }} onMouseEnter={() => (hoverFrozen.current = false)}>
          <Tooltip label={<><b>Click</b> to add below<br /><b>{navigator.platform.includes('Mac') ? 'Option' : 'Alt'}-click</b> to add a block above</>}>
            <div className="bh-btn" onMouseDown={(e) => onPlus(e, hover.id)}>
              <I.PlusIcon size={16} />
            </div>
          </Tooltip>
          <Tooltip label={<><b>Drag</b> to move<br /><b>Click</b> to open menu</>}>
            <div className="bh-btn drag" onMouseDown={(e) => onHandleDown(e, hover.id)}>
              <I.DragIcon size={14} />
            </div>
          </Tooltip>
        </div>
      )}
      {drop && rr && <DropIndicator t={drop} root={rr} />}
      {rubber && <div className="rubber-band" style={{ left: rubber.x0, top: rubber.y0, width: rubber.x1 - rubber.x0, height: rubber.y1 - rubber.y0 }} />}
    </div>
  );
}

function DropIndicator({ t, root }: { t: DropTarget; root: DOMRect }) {
  const r = t.rect;
  if (t.pos === 'left' || t.pos === 'right')
    return <div className="drop-indicator vertical" style={{ left: (t.pos === 'left' ? r.left - 6 : r.right + 2) - root.left, top: r.top - root.top, height: r.height }} />;
  const y = t.pos === 'before' ? r.top - root.top - 2 : r.bottom - root.top - 2;
  const indentPx = t.pos === 'inside' ? 26 : 0;
  return <div className="drop-indicator" style={{ left: r.left - root.left + indentPx, top: y, width: r.width - indentPx }} />;
}
