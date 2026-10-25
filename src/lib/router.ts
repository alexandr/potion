import { useSyncExternalStore } from 'react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export interface Route {
  pageId: string | null;
  peek: string | null;
  peekMode: 's' | 'c' | null;
}

function slugify(t: string) {
  return (
    t
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'Untitled'
  );
}

export function pagePath(id: string, title: string) {
  return `${BASE}/${slugify(title)}-${id}`;
}

function parse(): Route {
  let path = location.pathname;
  if (path.startsWith(BASE)) path = path.slice(BASE.length);
  path = path.replace(/^\/+/, '');
  const qs = new URLSearchParams(location.search);
  let pageId: string | null = null;
  if (path) {
    const m = path.match(/([A-Za-z0-9]+)$/);
    const seg = decodeURIComponent(path);
    const dash = seg.lastIndexOf('-');
    pageId = dash >= 0 ? seg.slice(dash + 1) : m ? m[1] : seg;
  }
  const peek = qs.get('p');
  const pm = qs.get('pm');
  return { pageId, peek, peekMode: peek ? (pm === 'c' ? 'c' : 's') : null };
}

let current = parse();
const listeners = new Set<() => void>();
const emit = () => {
  current = parse();
  listeners.forEach((l) => l());
};
window.addEventListener('popstate', emit);

export function navigate(url: string, replace = false) {
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  emit();
}

export function goPage(id: string | null, title = '') {
  if (!id) navigate(`${BASE}/`);
  else navigate(pagePath(id, title));
}

export function setPeek(id: string | null, mode: 's' | 'c' = 's') {
  const u = new URL(location.href);
  if (id) {
    u.searchParams.set('p', id);
    u.searchParams.set('pm', mode);
  } else {
    u.searchParams.delete('p');
    u.searchParams.delete('pm');
  }
  navigate(u.pathname + u.search, !!current.peek && !!id);
}

export function getRoute(): Route {
  return current;
}

export function subscribeRoute(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
