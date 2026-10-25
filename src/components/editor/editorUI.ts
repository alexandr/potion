import { create } from 'zustand';
import type { ID } from '../../store/types';

export interface SlashState {
  blockId: ID;
  rect: DOMRect;
  query: string;
  start: number; // offset right after the '/'
}
export interface InlineMenuState {
  kind: 'mention' | 'link-page' | 'emoji' | 'date' | 'person' | 'page';
  blockId: ID;
  rect: DOMRect;
  query: string;
  start: number; // offset after trigger
  trigger: string;
}

interface EditorUI {
  slash: SlashState | null;
  inline: InlineMenuState | null;
  blockMenu: { blockId: ID; anchor: DOMRect | { x: number; y: number }; mode?: 'menu' | 'turn' | 'color' } | null;
  /** handler for keyboard nav inside open menus, returns true if handled */
  menuKey: ((e: React.KeyboardEvent | KeyboardEvent) => boolean) | null;
  linkPicker: { blockId: ID; rect: DOMRect; mode: 'link-block' | 'move' } | null;
  hoverBlock: ID | null;
  set: (p: Partial<Omit<EditorUI, 'set'>>) => void;
}

export const useEditorUI = create<EditorUI>((set) => ({
  slash: null,
  inline: null,
  blockMenu: null,
  menuKey: null,
  linkPicker: null,
  hoverBlock: null,
  set: (p) => set(p),
}));
