import { useStore, setFocusProvider, getPageOf } from '../../store/store';
import type { Block, BlockType, ID } from '../../store/types';
import { NESTABLE, TEXT_TYPES } from '../../lib/blockDefs';
import { getCaretOffset, setCaret, setCaretAtX, setSelectionRange } from '../../lib/dom';
import { useUI } from '../../store/ui';

const S = () => useStore.getState();

export function editableEl(id: ID): HTMLElement | null {
  return document.querySelector(`[data-editable="${id}"]`) as HTMLElement | null;
}

export function focusBlock(id: ID, offset: number | 'start' | 'end' = 'end', x?: number, line?: 'first' | 'last') {
  const run = (tries: number) => {
    const el = editableEl(id);
    if (!el || !el.isConnected) {
      if (tries > 0) requestAnimationFrame(() => run(tries - 1));
      return;
    }
    el.focus({ preventScroll: true });
    if (x != null && line) setCaretAtX(el, x, line);
    else setCaret(el, offset);
    const r = el.getBoundingClientRect();
    const scroller = el.closest('.scroller');
    if (scroller) {
      const sr = scroller.getBoundingClientRect();
      if (r.bottom > sr.bottom - 40) scroller.scrollTop += r.bottom - sr.bottom + 80;
      else if (r.top < sr.top + 40) scroller.scrollTop -= sr.top - r.top + 80;
    }
  };
  // React flushes discrete-event updates synchronously, so the target usually exists already;
  // focusing in a microtask keeps fast typists' next keystrokes in the right block.
  queueMicrotask(() => run(5));
}

export function focusRange(id: ID, start: number, end: number) {
  requestAnimationFrame(() => {
    const el = editableEl(id);
    if (!el) return;
    el.focus({ preventScroll: true });
    setSelectionRange(el, start, end);
  });
}

setFocusProvider(() => {
  const a = document.activeElement as HTMLElement | null;
  const id = a?.getAttribute?.('data-editable');
  if (!id) return null;
  return { id, offset: getCaretOffset(a!) };
});

const isContainer = (b?: Block) =>
  !b || b.type === 'page' || b.type === 'database' || b.type === 'column' || b.type === 'column_list';

/** Blocks in visual document order under a root page (descends into visible children). */
export function flatten(rootId: ID): ID[] {
  const { blocks } = S();
  const out: ID[] = [];
  const walk = (id: ID) => {
    const b = blocks[id];
    if (!b) return;
    for (const c of b.children) {
      const cb = blocks[c];
      if (!cb) continue;
      if ((cb.type === 'page' || cb.type === 'database') && cb.props.trashed) continue;
      out.push(c);
      if (cb.type === 'page' || cb.type === 'database') continue;
      if ((cb.type === 'toggle' || cb.props.toggleable) && !cb.props.open) continue;
      walk(c);
    }
  };
  walk(rootId);
  return out;
}

function rootOf(id: ID): ID | null {
  const { blocks } = S();
  let cur = blocks[id];
  while (cur && cur.parent) {
    const p = blocks[cur.parent];
    if (!p) break;
    if (p.type === 'page' || p.type === 'database') return p.id;
    cur = p;
  }
  return null;
}

export const isEditableType = (t: BlockType) => TEXT_TYPES.includes(t) || t === 'code';

export function prevEditable(id: ID): ID | null {
  const root = rootOf(id);
  if (!root) return null;
  const list = flatten(root);
  const i = list.indexOf(id);
  const { blocks } = S();
  for (let j = i - 1; j >= 0; j--) if (isEditableType(blocks[list[j]].type)) return list[j];
  return null;
}
export function nextEditable(id: ID): ID | null {
  const root = rootOf(id);
  if (!root) return null;
  const list = flatten(root);
  const i = list.indexOf(id);
  const { blocks } = S();
  for (let j = i + 1; j < list.length; j++) if (isEditableType(blocks[list[j]].type)) return list[j];
  return null;
}
export function prevVisible(id: ID): ID | null {
  const root = rootOf(id);
  if (!root) return null;
  const list = flatten(root);
  const i = list.indexOf(id);
  return i > 0 ? list[i - 1] : null;
}

export function textLen(html: string) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent ?? '').length;
}

/** Enter key: split block at caret. */
export function splitBlock(id: ID, before: string, after: string) {
  const s = S();
  const b = s.blocks[id];
  if (!b || !b.parent) return;
  const listLike: BlockType[] = ['bulleted', 'numbered', 'todo', 'toggle'];
  const isToggle = b.type === 'toggle' || !!b.props.toggleable;
  const newType: BlockType = listLike.includes(b.type) && !b.props.toggleable ? b.type : 'text';
  const newProps: Record<string, any> = {};
  if (b.props.color && listLike.includes(b.type)) newProps.color = b.props.color;
  s.batch(() => {
    if (before === '' && after !== '') {
      // caret at start: push an empty block above, keep this one
      const p = S().blocks[b.parent!];
      s.createBlock(b.parent!, p.children.indexOf(id), b.props.toggleable ? 'text' : newType, '', newProps);
      focusBlock(id, 'start');
      return;
    }
    useStore.setState((st) => ({
      blocks: { ...st.blocks, [id]: { ...b, text: before, updatedAt: Date.now() } },
    }));
    let newId: ID;
    const hasOpenChildren = b.children.length > 0 && !(isToggle && !b.props.open);
    if (b.type === 'callout' || (isToggle && b.props.open)) {
      newId = s.createBlock(id, 0, 'text', after);
    } else if (hasOpenChildren && !isToggle && b.type !== 'quote') {
      newId = s.createBlock(id, 0, newType, after, newProps);
    } else {
      newId = s.insertBlockAfter(id, newType, after, newProps);
    }
    focusBlock(newId, 'start');
  });
}

/** Backspace at start of block. */
export function backspaceAtStart(id: ID): boolean {
  const s = S();
  const b = s.blocks[id];
  if (!b || !b.parent) return false;
  if (b.type !== 'text') {
    // turn into text first (keeps indentation and children)
    s.updateBlock(id, { type: 'text', props: { ...b.props, toggleable: undefined, checked: undefined } });
    focusBlock(id, 'start');
    return true;
  }
  const parent = s.blocks[b.parent];
  if (parent && !isContainer(parent) && parent.type !== 'callout') {
    // nested -> outdent
    outdent(id);
    focusBlock(id, 'start');
    return true;
  }
  const prev = prevVisible(id);
  const pb = prev ? s.blocks[prev] : undefined;
  if (!pb) {
    const title = editableEl(id)?.closest('.page-frame')?.querySelector('.page-title') as HTMLElement | null;
    if (b.text === '' && b.children.length === 0 && s.blocks[b.parent!]?.children.length > 1) s.deleteBlock(id);
    if (title) focusTitle(title);
    return true;
  }
  if (!isEditableType(pb.type)) {
    if (b.text === '' && b.children.length === 0) {
      s.deleteBlock(id);
      useUI.getState().select([pb.id]);
      (document.activeElement as HTMLElement)?.blur();
    } else {
      useUI.getState().select([pb.id]);
      (document.activeElement as HTMLElement)?.blur();
    }
    return true;
  }
  mergeInto(pb.id, id);
  return true;
}

export function mergeInto(targetId: ID, srcId: ID) {
  const s = S();
  const t = s.blocks[targetId];
  const src = s.blocks[srcId];
  if (!t || !src) return;
  const offset = textLen(t.text);
  s.checkpoint();
  const blocks = { ...s.blocks };
  const text = t.type === 'code' ? t.text + (src.text ? '\n' + stripTags(src.text) : '') : t.text + src.text;
  // children of src move to the end of target's children
  const children = [...t.children, ...src.children];
  src.children.forEach((c) => (blocks[c] = { ...blocks[c], parent: targetId }));
  blocks[targetId] = { ...t, text, children: t.id === src.parent ? children.filter((c) => c !== srcId) : children, updatedAt: Date.now() };
  // remove src from its parent
  const p = blocks[src.parent!];
  if (p) blocks[p.id] = { ...p, children: p.children.filter((c) => c !== srcId) };
  if (p && p.id === targetId) blocks[targetId] = { ...blocks[targetId], children: blocks[targetId].children.filter((c) => c !== srcId) };
  delete blocks[srcId];
  useStore.setState({ blocks });
  cleanupColumns(src.parent!);
  focusBlock(targetId, offset);
}

function stripTags(h: string) {
  const d = document.createElement('div');
  d.innerHTML = h;
  return d.textContent ?? '';
}

export function deleteAtEnd(id: ID) {
  const n = nextEditable(id);
  if (!n) return;
  const s = S();
  const b = s.blocks[id];
  const nb = s.blocks[n];
  // only merge if next is right after in flatten order
  const root = rootOf(id);
  if (!root) return;
  const list = flatten(root);
  if (list.indexOf(n) !== list.indexOf(id) + 1) return;
  void b;
  void nb;
  mergeInto(id, n);
}

export function canNestUnder(b?: Block) {
  if (!b) return false;
  if (['h1', 'h2', 'h3'].includes(b.type)) return !!b.props.toggleable;
  return NESTABLE.includes(b.type);
}

export function indent(id: ID) {
  const s = S();
  const b = s.blocks[id];
  if (!b || !b.parent) return;
  const p = s.blocks[b.parent];
  const i = p.children.indexOf(id);
  if (i <= 0) return;
  const prev = s.blocks[p.children[i - 1]];
  if (!canNestUnder(prev)) return;
  const off = captureOffset(id);
  s.moveBlock(id, prev.id, prev.children.length);
  if ((prev.type === 'toggle' || prev.props.toggleable) && !prev.props.open) s.setProps(prev.id, { open: true });
  if (off != null) focusBlock(id, off);
}

export function outdent(id: ID) {
  const s = S();
  const b = s.blocks[id];
  if (!b || !b.parent) return;
  const p = s.blocks[b.parent];
  if (isContainer(p)) return;
  const gp = s.blocks[p.parent!];
  if (!gp) return;
  const off = captureOffset(id);
  // following siblings become children of the block
  const i = p.children.indexOf(id);
  const following = p.children.slice(i + 1);
  s.checkpoint();
  const blocks = { ...S().blocks };
  blocks[p.id] = { ...p, children: p.children.slice(0, i) };
  const gpc = [...gp.children];
  gpc.splice(gpc.indexOf(p.id) + 1, 0, id);
  blocks[gp.id] = { ...gp, children: gpc };
  following.forEach((f) => (blocks[f] = { ...blocks[f], parent: id }));
  blocks[id] = { ...b, parent: gp.id, children: [...b.children, ...following] };
  useStore.setState({ blocks });
  if (off != null) focusBlock(id, off);
}

function captureOffset(id: ID) {
  const el = editableEl(id);
  if (el && document.activeElement === el) return getCaretOffset(el);
  return null;
}

export function cleanupColumns(colId: ID) {
  const s = S();
  const col = s.blocks[colId];
  if (!col || col.type !== 'column' || col.children.length) return;
  const list = s.blocks[col.parent!];
  if (!list) return;
  const blocks = { ...s.blocks };
  const remaining = list.children.filter((c) => c !== colId);
  delete blocks[colId];
  if (remaining.length <= 1) {
    const gp = blocks[list.parent!];
    const at = gp.children.indexOf(list.id);
    const kids = remaining.length ? blocks[remaining[0]].children : [];
    const gc = [...gp.children];
    gc.splice(at, 1, ...kids);
    blocks[gp.id] = { ...gp, children: gc };
    kids.forEach((k) => (blocks[k] = { ...blocks[k], parent: gp.id }));
    if (remaining.length) delete blocks[remaining[0]];
    delete blocks[list.id];
  } else {
    blocks[list.id] = { ...list, children: remaining };
    remaining.forEach((c) => (blocks[c] = { ...blocks[c], props: { ...blocks[c].props, width: 1 / remaining.length } }));
  }
  useStore.setState({ blocks });
}

export function moveUpDown(id: ID, dir: -1 | 1) {
  const s = S();
  const b = s.blocks[id];
  if (!b || !b.parent) return;
  const p = s.blocks[b.parent];
  const i = p.children.indexOf(id);
  const j = i + dir;
  if (j < 0 || j >= p.children.length) return;
  const off = captureOffset(id);
  s.moveBlock(id, p.id, dir === 1 ? j + 1 : j);
  if (off != null) focusBlock(id, off);
}

export function turnInto(id: ID, type: BlockType, props: Record<string, any> = {}) {
  const s = S();
  const b = s.blocks[id];
  if (!b) return;
  if (type === 'page') {
    // convert block into a sub-page carrying its children
    s.checkpoint();
    const title = stripTags(b.text);
    const blocks = { ...s.blocks };
    blocks[id] = { ...b, type: 'page', text: '', props: { title } };
    useStore.setState({ blocks });
    return;
  }
  const off = captureOffset(id);
  const np: Record<string, any> = { ...b.props, toggleable: props.toggleable || undefined, ...props };
  if (type !== 'todo') delete np.checked;
  if (type === 'callout' && !np.icon) np.icon = '💡';
  let text = b.text;
  if (type === 'code' && b.type !== 'code') text = stripTags(b.text);
  if (type === 'equation') {
    s.updateBlock(id, { type, text: '', props: { ...np, expression: stripTags(b.text) } });
    return;
  }
  s.updateBlock(id, { type, props: np, text });
  if (off != null) focusBlock(id, off);
  else if (isEditableType(type)) focusBlock(id, 'end');
}

export function selectedBlocksInOrder(): ID[] {
  const sel = useUI.getState().selected;
  if (sel.length <= 1) return sel;
  const page = getPageOf(S().blocks, sel[0]);
  if (!page) return sel;
  const order = flatten(page.id);
  return [...sel].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** remove selected ids whose ancestor is also selected */
export function topLevelSelection(ids: ID[]): ID[] {
  const { blocks } = S();
  const set = new Set(ids);
  return ids.filter((id) => {
    let cur = blocks[id]?.parent;
    while (cur) {
      if (set.has(cur)) return false;
      cur = blocks[cur]?.parent ?? null;
    }
    return true;
  });
}

export function deleteSelection() {
  const s = S();
  const ids = topLevelSelection(selectedBlocksInOrder());
  if (!ids.length) return;
  const first = ids[0];
  const prev = prevEditable(first);
  s.checkpoint();
  ids.forEach((id) => {
    const b = S().blocks[id];
    if (!b) return;
    const parent = b.parent;
    if (b.type === 'page' || (b.type === 'database' && !b.props.inline)) {
      S().trashPage(id);
      // remove from content too
      const blocks = { ...S().blocks };
      const p = blocks[parent!];
      if (p) blocks[p.id] = { ...p, children: p.children.filter((c) => c !== id) };
      blocks[id] = { ...blocks[id], props: { ...blocks[id].props, trashedFrom: parent } };
      useStore.setState({ blocks });
    } else {
      const blocks = { ...S().blocks };
      const rm = (x: ID) => {
        const xb = blocks[x];
        if (!xb) return;
        xb.children.forEach(rm);
        delete blocks[x];
      };
      const p = blocks[parent!];
      if (p) blocks[p.id] = { ...p, children: p.children.filter((c) => c !== id) };
      rm(id);
      useStore.setState({ blocks });
    }
    if (parent) cleanupColumns(parent);
  });
  useUI.getState().select([]);
  if (prev && S().blocks[prev]) focusBlock(prev, 'end');
}

export function ensureTrailingBlock(pageId: ID) {
  const s = S();
  const p = s.blocks[pageId];
  if (!p) return;
  const last = s.blocks[p.children[p.children.length - 1]];
  if (last && last.type === 'text' && !last.text && last.children.length === 0) {
    focusBlock(last.id, 'start');
    return;
  }
  const id = s.createBlock(pageId, p.children.length, 'text');
  focusBlock(id, 'start');
}

export function focusTitle(title: HTMLElement) {
  title.focus();
  const r = document.createRange();
  r.selectNodeContents(title);
  r.collapse(false);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(r);
}
