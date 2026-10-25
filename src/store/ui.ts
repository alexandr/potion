import { create } from 'zustand';
import type { ID } from './types';

export interface UIState {
  searchOpen: boolean;
  settingsOpen: boolean;
  settingsTab: string;
  templatesOpen: boolean;
  trashAnchor: DOMRect | null;
  inboxOpen: boolean;
  selected: ID[];
  /** block whose handle menu is open */
  commentsOpen: boolean;
  historyOpen: boolean;
  toast: string | null;
  sidebarPeek: boolean;
  dragging: boolean;
  set: (p: Partial<UIState>) => void;
  select: (ids: ID[]) => void;
  showToast: (t: string) => void;
}

let toastTimer: number | undefined;

export const useUI = create<UIState>((set) => ({
  searchOpen: false,
  settingsOpen: false,
  settingsTab: 'preferences',
  templatesOpen: false,
  trashAnchor: null,
  inboxOpen: false,
  selected: [],
  commentsOpen: false,
  historyOpen: false,
  toast: null,
  sidebarPeek: false,
  dragging: false,
  set: (p) => set(p),
  select: (ids) => set({ selected: ids }),
  showToast: (t) => {
    window.clearTimeout(toastTimer);
    set({ toast: t });
    toastTimer = window.setTimeout(() => set({ toast: null }), 2600);
  },
}));
