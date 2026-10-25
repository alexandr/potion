import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type {
  Block,
  BlockType,
  Discussion,
  ID,
  Notification,
  PropertySchema,
  Settings,
  User,
  View,
  Workspace,
} from './types';
import { buildSeed } from './seed';

export const uid = (n = 12) => nanoid(n).replace(/[-_]/g, 'x');

const STORAGE_KEY = 'potion-workspace-v1';

export interface PageVersion {
  id: ID;
  pageId: ID;
  at: number;
  author: string;
  blocks: Record<ID, Block>;
}

export interface DataState {
  blocks: Record<ID, Block>;
  workspace: Workspace;
  settings: Settings;
  users: Record<ID, User>;
  me: ID;
  discussions: Record<ID, Discussion>;
  notifications: Notification[];
  versions: PageVersion[];
}

interface Snapshot {
  blocks: Record<ID, Block>;
  workspace: Workspace;
  discussions: Record<ID, Discussion>;
  focus?: FocusTarget | null;
}

export type FocusTarget = { id: ID; offset: number | 'start' | 'end'; field?: 'title' };

interface HistoryState {
  past: Snapshot[];
  future: Snapshot[];
  lastKey: string | null;
  lastAt: number;
}

export interface Store extends DataState {
  history: HistoryState;
  /** where the caret should go after the next render */
  pendingFocus: FocusTarget | null;
  setFocus: (f: FocusTarget | null) => void;

  checkpoint: (key?: string) => void;
  batch: <T>(fn: () => T) => T;
  undo: () => FocusTarget | null | undefined;
  redo: () => FocusTarget | null | undefined;

  createBlock: (parent: ID, index: number, type: BlockType, text?: string, props?: Record<string, any>) => ID;
  insertBlockAfter: (afterId: ID, type: BlockType, text?: string, props?: Record<string, any>) => ID;
  updateBlock: (id: ID, patch: Partial<Pick<Block, 'text' | 'type' | 'props'>>, key?: string) => void;
  setProps: (id: ID, props: Record<string, any>, key?: string) => void;
  deleteBlock: (id: ID) => void;
  moveBlock: (id: ID, newParent: ID, index: number) => void;
  duplicateBlock: (id: ID, parent?: ID, index?: number) => ID;
  createPage: (parent: ID | 'private' | 'team', props?: Record<string, any>, index?: number) => ID;
  createDatabase: (parent: ID | 'private' | 'team', inline: boolean, index?: number, view?: View['type']) => ID;
  trashPage: (id: ID) => void;
  restorePage: (id: ID) => void;
  deleteForever: (id: ID) => void;
  emptyTrash: () => void;
  toggleFavorite: (id: ID) => void;
  visit: (id: ID) => void;
  moveRoot: (id: ID, section: 'private' | 'team', index: number) => void;

  updateSettings: (s: Partial<Settings>) => void;
  setWorkspace: (w: Partial<Workspace>) => void;

  addDiscussion: (pageId: ID, blockId: ID | null, quote: string, text: string) => ID;
  addComment: (discussionId: ID, text: string) => void;
  resolveDiscussion: (discussionId: ID, resolved: boolean) => void;
  deleteComment: (discussionId: ID, commentId: ID) => void;

  saveVersion: (pageId: ID) => void;
  restoreVersion: (versionId: ID) => void;
  markNotificationsRead: () => void;

  resetDemo: () => void;
  importState: (s: DataState) => void;
}

function now() {
  return Date.now();
}

function loadInitial(): DataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as DataState;
      if (s && s.blocks && s.workspace) {
        s.versions ||= [];
        s.notifications ||= [];
        s.discussions ||= {};
        if (window.innerWidth < 800) s.settings = { ...s.settings, sidebarCollapsed: true };
        return s;
      }
    }
  } catch {
    /* ignore */
  }
  const seed = buildSeed();
  if (window.innerWidth < 800) seed.settings.sidebarCollapsed = true;
  return seed;
}

let suppress = 0;
let focusProvider: () => FocusTarget | null = () => null;
export function setFocusProvider(f: () => FocusTarget | null) {
  focusProvider = f;
}

function snapshot(s: Store): Snapshot {
  return { blocks: s.blocks, workspace: s.workspace, discussions: s.discussions, focus: focusProvider() };
}

export const isPageLike = (b?: Block) => !!b && (b.type === 'page' || (b.type === 'database' && !b.props.inline));

export const useStore = create<Store>((set, get) => {
  const initial = loadInitial();

  const mutate = (fn: (blocks: Record<ID, Block>) => void) => {
    const blocks = { ...get().blocks };
    fn(blocks);
    set({ blocks });
  };

  const touch = (b: Block): Block => ({ ...b, updatedAt: now(), lastEditedBy: get().me });

  const newBlock = (type: BlockType, parent: ID | null, text = '', props: Record<string, any> = {}): Block => ({
    id: uid(),
    type,
    text,
    props,
    children: [],
    parent,
    createdAt: now(),
    updatedAt: now(),
    createdBy: get().me,
    lastEditedBy: get().me,
  });

  /** mark the containing page as edited */
  const touchPage = (blocks: Record<ID, Block>, id: ID | null) => {
    let cur = id ? blocks[id] : undefined;
    while (cur) {
      if (cur.type === 'page' || cur.type === 'database') {
        blocks[cur.id] = { ...cur, updatedAt: now(), lastEditedBy: get().me };
        return;
      }
      cur = cur.parent ? blocks[cur.parent] : undefined;
    }
  };

  const removeFromParent = (blocks: Record<ID, Block>, id: ID) => {
    const b = blocks[id];
    if (!b) return;
    if (b.parent && blocks[b.parent]) {
      const p = blocks[b.parent];
      blocks[b.parent] = { ...p, children: p.children.filter((c) => c !== id) };
    }
  };

  const collect = (blocks: Record<ID, Block>, id: ID, out: ID[] = []) => {
    const b = blocks[id];
    if (!b) return out;
    out.push(id);
    b.children.forEach((c) => collect(blocks, c, out));
    return out;
  };

  return {
    ...initial,
    history: { past: [], future: [], lastKey: null, lastAt: 0 },
    pendingFocus: null,
    setFocus: (f) => set({ pendingFocus: f }),

    batch: (fn) => {
      get().checkpoint();
      suppress++;
      try {
        return fn();
      } finally {
        suppress--;
      }
    },
    checkpoint: (key) => {
      if (suppress > 0) return;
      const s = get();
      const h = s.history;
      const t = now();
      if (key && h.lastKey === key && t - h.lastAt < 1500) {
        set({ history: { ...h, lastAt: t } });
        return;
      }
      const past = [...h.past, snapshot(s)].slice(-200);
      set({ history: { past, future: [], lastKey: key ?? null, lastAt: t } });
    },
    undo: () => {
      const s = get();
      const h = s.history;
      if (!h.past.length) return undefined;
      const prev = h.past[h.past.length - 1];
      set({
        blocks: prev.blocks,
        workspace: prev.workspace,
        discussions: prev.discussions,
        history: { past: h.past.slice(0, -1), future: [snapshot(s), ...h.future], lastKey: null, lastAt: 0 },
      });
      return prev.focus ?? null;
    },
    redo: () => {
      const s = get();
      const h = s.history;
      if (!h.future.length) return undefined;
      const next = h.future[0];
      set({
        blocks: next.blocks,
        workspace: next.workspace,
        discussions: next.discussions,
        history: { past: [...h.past, snapshot(s)], future: h.future.slice(1), lastKey: null, lastAt: 0 },
      });
      return next.focus ?? null;
    },

    createBlock: (parent, index, type, text = '', props = {}) => {
      get().checkpoint();
      const b = newBlock(type, parent, text, props);
      if (type === 'column_list') {
        // seeded by caller
      }
      mutate((blocks) => {
        blocks[b.id] = b;
        const p = blocks[parent];
        if (p) {
          const children = [...p.children];
          children.splice(Math.max(0, Math.min(index, children.length)), 0, b.id);
          blocks[parent] = { ...p, children };
        }
        touchPage(blocks, parent);
      });
      return b.id;
    },
    insertBlockAfter: (afterId, type, text = '', props = {}) => {
      const after = get().blocks[afterId];
      if (!after || !after.parent) return '';
      const p = get().blocks[after.parent];
      return get().createBlock(after.parent, p.children.indexOf(afterId) + 1, type, text, props);
    },
    updateBlock: (id, patch, key) => {
      const b = get().blocks[id];
      if (!b) return;
      get().checkpoint(key);
      mutate((blocks) => {
        blocks[id] = touch({ ...b, ...patch, props: patch.props ? patch.props : b.props });
        touchPage(blocks, b.parent);
      });
    },
    setProps: (id, props, key) => {
      const b = get().blocks[id];
      if (!b) return;
      get().checkpoint(key);
      mutate((blocks) => {
        blocks[id] = touch({ ...b, props: { ...b.props, ...props } });
        touchPage(blocks, b.parent);
      });
    },
    deleteBlock: (id) => {
      const b = get().blocks[id];
      if (!b) return;
      if (b.type === 'page' || (b.type === 'database' && !b.props.inline)) {
        get().trashPage(id);
        return;
      }
      get().checkpoint();
      mutate((blocks) => {
        removeFromParent(blocks, id);
        // remove descendants (but trash any subpages)
        collect(blocks, id).forEach((d) => {
          delete blocks[d];
        });
        touchPage(blocks, b.parent);
      });
    },
    moveBlock: (id, newParent, index) => {
      const s = get();
      const b = s.blocks[id];
      if (!b) return;
      // prevent moving into own descendant
      let cur: ID | null = newParent;
      while (cur) {
        if (cur === id) return;
        cur = s.blocks[cur]?.parent ?? null;
      }
      s.checkpoint();
      const ws = { ...s.workspace };
      ws.privatePages = ws.privatePages.filter((x) => x !== id);
      ws.teamPages = ws.teamPages.filter((x) => x !== id);
      mutate((blocks) => {
        const oldParent = b.parent;
        let idx = index;
        if (oldParent === newParent && blocks[oldParent]) {
          const oi = blocks[oldParent].children.indexOf(id);
          if (oi !== -1 && oi < index) idx = index - 1;
        }
        removeFromParent(blocks, id);
        const p = blocks[newParent];
        const children = [...p.children];
        children.splice(Math.max(0, Math.min(idx, children.length)), 0, id);
        blocks[newParent] = { ...p, children };
        blocks[id] = { ...blocks[id], parent: newParent };
        touchPage(blocks, newParent);
        // clean up empty columns
        if (oldParent && blocks[oldParent]?.type === 'column' && blocks[oldParent].children.length === 0) {
          const col = blocks[oldParent];
          const list = col.parent ? blocks[col.parent] : undefined;
          removeFromParent(blocks, col.id);
          delete blocks[col.id];
          if (list) {
            const l = blocks[list.id];
            if (l.children.length === 1) {
              // unwrap last column
              const last = blocks[l.children[0]];
              const gp = blocks[l.parent!];
              const at = gp.children.indexOf(l.id);
              const gc = [...gp.children];
              gc.splice(at, 1, ...last.children);
              blocks[gp.id] = { ...gp, children: gc };
              last.children.forEach((c) => (blocks[c] = { ...blocks[c], parent: gp.id }));
              delete blocks[last.id];
              delete blocks[l.id];
            } else if (l.children.length === 0) {
              removeFromParent(blocks, l.id);
              delete blocks[l.id];
            } else {
              // rebalance widths
              blocks[l.id] = { ...l };
              l.children.forEach((c) => (blocks[c] = { ...blocks[c], props: { ...blocks[c].props, width: 1 / l.children.length } }));
            }
          }
        }
      });
      set({ workspace: ws });
    },
    duplicateBlock: (id, parent, index) => {
      const s = get();
      const b = s.blocks[id];
      if (!b) return '';
      s.checkpoint();
      const map: Record<ID, ID> = {};
      const copy: Record<ID, Block> = {};
      const walk = (bid: ID, newParent: ID | null) => {
        const src = s.blocks[bid];
        if (!src) return;
        if (src.type === 'page' && src.props.trashed) return;
        const nid = uid();
        map[bid] = nid;
        copy[nid] = { ...src, id: nid, parent: newParent, children: [], createdAt: now(), updatedAt: now() };
        src.children.forEach((c) => walk(c, nid));
        copy[nid].children = src.children.map((c) => map[c]).filter(Boolean);
      };
      const targetParent = parent ?? b.parent;
      walk(id, targetParent);
      const nid = map[id];
      if (b.type === 'page' || b.type === 'database') {
        const t = copy[nid].props.title || '';
        if (!parent) copy[nid] = { ...copy[nid], props: { ...copy[nid].props, title: t ? `${t} (1)` : '' } };
      }
      mutate((blocks) => {
        Object.assign(blocks, copy);
        if (targetParent && blocks[targetParent]) {
          const p = blocks[targetParent];
          const children = [...p.children];
          const at = index ?? children.indexOf(id) + 1;
          children.splice(at, 0, nid);
          blocks[targetParent] = { ...p, children };
        }
      });
      if (!targetParent) {
        const ws = { ...get().workspace };
        const inPriv = ws.privatePages.includes(id);
        const list = inPriv ? [...ws.privatePages] : [...ws.teamPages];
        list.splice(list.indexOf(id) + 1, 0, nid);
        set({ workspace: inPriv ? { ...ws, privatePages: list } : { ...ws, teamPages: list } });
      }
      return nid;
    },
    createPage: (parent, props = {}, index) => {
      get().checkpoint();
      const isRoot = parent === 'private' || parent === 'team';
      const page = newBlock('page', isRoot ? null : parent, '', { title: '', ...props });
      mutate((blocks) => {
        blocks[page.id] = page;
        if (!isRoot) {
          const p = blocks[parent];
          if (p) {
            const children = [...p.children];
            children.splice(index ?? children.length, 0, page.id);
            blocks[parent] = { ...p, children };
          }
        }
      });
      if (isRoot) {
        const ws = { ...get().workspace };
        const key = parent === 'private' ? 'privatePages' : 'teamPages';
        const list = [...ws[key]];
        list.splice(index ?? list.length, 0, page.id);
        set({ workspace: { ...ws, [key]: list } });
      }
      return page.id;
    },
    createDatabase: (parent, inline, index, viewType = 'table') => {
      get().checkpoint();
      const isRoot = parent === 'private' || parent === 'team';
      const titleId = 'title';
      const tagsId = uid(6);
      const schema: Record<ID, PropertySchema> = {
        [titleId]: { id: titleId, name: 'Name', type: 'title' },
        [tagsId]: { id: tagsId, name: 'Tags', type: 'multi_select', options: [] },
      };
      const view: View = {
        id: uid(),
        name: viewType === 'table' ? 'Table' : viewType[0].toUpperCase() + viewType.slice(1),
        type: viewType,
        filters: [],
        sorts: [],
        propOrder: [titleId, tagsId],
        hidden: [],
        widths: {},
        calcs: {},
      };
      if (viewType === 'board') {
        const st = uid(6);
        schema[st] = {
          id: st,
          name: 'Status',
          type: 'status',
          options: [
            { id: uid(6), name: 'Not started', color: 'default', group: 'todo' },
            { id: uid(6), name: 'In progress', color: 'blue', group: 'in_progress' },
            { id: uid(6), name: 'Done', color: 'green', group: 'complete' },
          ],
        };
        view.propOrder!.push(st);
        view.groupBy = st;
      }
      if (viewType === 'calendar' || viewType === 'timeline') {
        const d = uid(6);
        schema[d] = { id: d, name: 'Date', type: 'date' };
        view.propOrder!.push(d);
        view.dateProp = d;
      }
      const db = newBlock('database', isRoot ? null : parent, '', {
        title: '',
        inline,
        schema,
        views: [view],
      });
      const rows: Block[] = inline
        ? [0, 1, 2].map(() => newBlock('page', db.id, '', { title: '', values: {} }))
        : [];
      db.children = rows.map((r) => r.id);
      mutate((blocks) => {
        blocks[db.id] = db;
        rows.forEach((r) => (blocks[r.id] = r));
        if (!isRoot) {
          const p = blocks[parent];
          if (p) {
            const children = [...p.children];
            children.splice(index ?? children.length, 0, db.id);
            blocks[parent] = { ...p, children };
          }
        }
      });
      if (isRoot) {
        const ws = { ...get().workspace };
        const key = parent === 'private' ? 'privatePages' : 'teamPages';
        set({ workspace: { ...ws, [key]: [...ws[key], db.id] } });
      }
      return db.id;
    },
    trashPage: (id) => {
      const b = get().blocks[id];
      if (!b) return;
      get().checkpoint();
      mutate((blocks) => {
        blocks[id] = { ...b, props: { ...b.props, trashed: true, trashedAt: now(), trashedBy: get().me } };
      });
    },
    restorePage: (id) => {
      const b = get().blocks[id];
      if (!b) return;
      get().checkpoint();
      mutate((blocks) => {
        const { trashed, trashedAt, trashedBy, ...rest } = b.props;
        void trashed;
        void trashedAt;
        void trashedBy;
        blocks[id] = { ...b, props: rest };
        // if parent is gone, move to private root
      });
      const s = get();
      if (b.parent && s.blocks[b.parent] && !s.blocks[b.parent].children.includes(id)) {
        mutate((blocks) => {
          const p = blocks[b.parent!];
          blocks[p.id] = { ...p, children: [...p.children, id] };
        });
      } else if (b.parent && !s.blocks[b.parent]) {
        mutate((blocks) => (blocks[id] = { ...blocks[id], parent: null }));
        set({ workspace: { ...s.workspace, privatePages: [...s.workspace.privatePages, id] } });
      } else if (!b.parent && !s.workspace.privatePages.includes(id) && !s.workspace.teamPages.includes(id)) {
        set({ workspace: { ...s.workspace, privatePages: [...s.workspace.privatePages, id] } });
      }
    },
    deleteForever: (id) => {
      const s = get();
      const b = s.blocks[id];
      if (!b) return;
      s.checkpoint();
      mutate((blocks) => {
        removeFromParent(blocks, id);
        collect(blocks, id).forEach((d) => delete blocks[d]);
      });
      const ws = get().workspace;
      set({
        workspace: {
          ...ws,
          privatePages: ws.privatePages.filter((x) => x !== id),
          teamPages: ws.teamPages.filter((x) => x !== id),
          favorites: ws.favorites.filter((x) => x !== id),
        },
      });
    },
    emptyTrash: () => {
      const s = get();
      Object.values(s.blocks)
        .filter((b) => b.props.trashed)
        .forEach((b) => get().deleteForever(b.id));
    },
    toggleFavorite: (id) => {
      const ws = get().workspace;
      get().checkpoint();
      const favorites = ws.favorites.includes(id) ? ws.favorites.filter((f) => f !== id) : [...ws.favorites, id];
      set({ workspace: { ...ws, favorites } });
    },
    visit: (id) => {
      const ws = get().workspace;
      const recent = [{ id, at: now() }, ...ws.recent.filter((r) => r.id !== id)].slice(0, 30);
      set({ workspace: { ...ws, recent } });
    },
    moveRoot: (id, section, index) => {
      const s = get();
      s.checkpoint();
      const b = s.blocks[id];
      if (b && b.parent) {
        mutate((blocks) => {
          removeFromParent(blocks, id);
          blocks[id] = { ...blocks[id], parent: null };
        });
      }
      const ws = { ...get().workspace };
      let priv = ws.privatePages;
      let team = ws.teamPages;
      const key = section === 'private' ? 'privatePages' : 'teamPages';
      const listBefore = section === 'private' ? priv : team;
      const oldIdx = listBefore.indexOf(id);
      priv = priv.filter((x) => x !== id);
      team = team.filter((x) => x !== id);
      const list = section === 'private' ? [...priv] : [...team];
      const at = oldIdx !== -1 && oldIdx < index ? index - 1 : index;
      list.splice(Math.max(0, Math.min(at, list.length)), 0, id);
      set({
        workspace: { ...ws, privatePages: priv, teamPages: team, [key]: list },
      });
    },

    updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
    setWorkspace: (patch) => set({ workspace: { ...get().workspace, ...patch } }),

    addDiscussion: (pageId, blockId, quote, text) => {
      get().checkpoint();
      const id = uid();
      const d: Discussion = {
        id,
        pageId,
        blockId,
        quote,
        comments: [{ id: uid(), author: get().me, text, createdAt: now() }],
      };
      set({ discussions: { ...get().discussions, [id]: d } });
      return id;
    },
    addComment: (discussionId, text) => {
      const d = get().discussions[discussionId];
      if (!d) return;
      get().checkpoint();
      set({
        discussions: {
          ...get().discussions,
          [discussionId]: { ...d, comments: [...d.comments, { id: uid(), author: get().me, text, createdAt: now() }] },
        },
      });
    },
    resolveDiscussion: (discussionId, resolved) => {
      const d = get().discussions[discussionId];
      if (!d) return;
      get().checkpoint();
      set({ discussions: { ...get().discussions, [discussionId]: { ...d, resolved } } });
    },
    deleteComment: (discussionId, commentId) => {
      const d = get().discussions[discussionId];
      if (!d) return;
      get().checkpoint();
      const comments = d.comments.filter((c) => c.id !== commentId);
      const discussions = { ...get().discussions };
      if (comments.length) discussions[discussionId] = { ...d, comments };
      else delete discussions[discussionId];
      set({ discussions });
    },

    saveVersion: (pageId) => {
      const s = get();
      const ids = collect(s.blocks, pageId);
      const blocks: Record<ID, Block> = {};
      ids.forEach((i) => (blocks[i] = s.blocks[i]));
      const last = s.versions.filter((v) => v.pageId === pageId).at(-1);
      if (last && JSON.stringify(last.blocks) === JSON.stringify(blocks)) return;
      const v: PageVersion = { id: uid(), pageId, at: now(), author: s.me, blocks };
      const versions = [...s.versions, v].slice(-100);
      set({ versions });
    },
    restoreVersion: (versionId) => {
      const s = get();
      const v = s.versions.find((x) => x.id === versionId);
      if (!v) return;
      s.checkpoint();
      mutate((blocks) => {
        collect(blocks, v.pageId).forEach((d) => {
          if (!v.blocks[d] && blocks[d]?.type !== 'page') delete blocks[d];
        });
        Object.values(v.blocks).forEach((b) => {
          // keep current subpages/rows as they are (they have their own history)
          if (b.id !== v.pageId && (b.type === 'page' || b.type === 'database') && blocks[b.id]) return;
          blocks[b.id] = b;
        });
        blocks[v.pageId] = { ...v.blocks[v.pageId], updatedAt: now() };
      });
    },
    markNotificationsRead: () => set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) }),

    resetDemo: () => {
      const seed = buildSeed();
      set({ ...seed, history: { past: [], future: [], lastKey: null, lastAt: 0 } });
    },
    importState: (s) => set({ ...s, history: { past: [], future: [], lastKey: null, lastAt: 0 } }),
  };
});

// ---------- persistence ----------
let saveTimer: number | undefined;
useStore.subscribe((s, prev) => {
  if (
    s.blocks === prev.blocks &&
    s.workspace === prev.workspace &&
    s.settings === prev.settings &&
    s.discussions === prev.discussions &&
    s.notifications === prev.notifications &&
    s.versions === prev.versions
  )
    return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const data: DataState = {
      blocks: s.blocks,
      workspace: s.workspace,
      settings: s.settings,
      users: s.users,
      me: s.me,
      discussions: s.discussions,
      notifications: s.notifications,
      versions: s.versions,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // quota: drop versions and retry
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, versions: [] }));
      } catch {
        /* ignore */
      }
    }
  }, 300);
});

// ---------- selectors / helpers ----------
export function getPageOf(blocks: Record<ID, Block>, id: ID): Block | undefined {
  let cur: Block | undefined = blocks[id];
  if (cur && (cur.type === 'page' || cur.type === 'database')) cur = cur.parent ? blocks[cur.parent] : undefined;
  while (cur) {
    if (cur.type === 'page' || (cur.type === 'database' && !cur.props.inline)) return cur;
    cur = cur.parent ? blocks[cur.parent] : undefined;
  }
  return undefined;
}

/** ancestors pages for breadcrumbs (root first), including self */
export function getPagePath(blocks: Record<ID, Block>, id: ID): Block[] {
  const path: Block[] = [];
  let cur: Block | undefined = blocks[id];
  while (cur) {
    if (cur.type === 'page' || cur.type === 'database') path.unshift(cur);
    cur = cur.parent ? blocks[cur.parent] : undefined;
  }
  return path;
}

/** sub pages shown in the sidebar under page id */
export function getSubPages(blocks: Record<ID, Block>, id: ID): ID[] {
  const b = blocks[id];
  if (!b) return [];
  if (b.type === 'database') {
    return b.children.filter((c) => blocks[c] && !blocks[c].props.trashed);
  }
  const out: ID[] = [];
  const walk = (bid: ID) => {
    const x = blocks[bid];
    if (!x) return;
    for (const c of x.children) {
      const cb = blocks[c];
      if (!cb) continue;
      if (cb.type === 'page' || cb.type === 'database') {
        if (!cb.props.trashed) out.push(c);
      } else walk(c);
    }
  };
  walk(id);
  return out;
}

export function isTrashed(blocks: Record<ID, Block>, id: ID): boolean {
  let cur: Block | undefined = blocks[id];
  while (cur) {
    if (cur.props.trashed) return true;
    cur = cur.parent ? blocks[cur.parent] : undefined;
  }
  return false;
}

export function pageTitle(b?: Block): string {
  if (!b) return 'Untitled';
  return (b.props.title as string) || 'Untitled';
}

// handy for debugging and automated tests
(window as any).__potion = useStore;
