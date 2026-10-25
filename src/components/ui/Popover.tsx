import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type Anchor = DOMRect | { x: number; y: number; w?: number; h?: number } | HTMLElement | null;

function toRect(a: Anchor): { left: number; top: number; width: number; height: number } | null {
  if (!a) return null;
  if (a instanceof HTMLElement) {
    const r = a.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  if ('x' in a && !('left' in a)) return { left: a.x, top: a.y, width: a.w ?? 0, height: a.h ?? 0 };
  const r = a as DOMRect;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

interface Props {
  anchor: Anchor;
  onClose: () => void;
  children: ReactNode;
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'right-start' | 'left-start' | 'bottom-center' | 'top-center';
  offset?: number;
  width?: number | string;
  style?: CSSProperties;
  className?: string;
  /** don't close on outside click */
  modal?: boolean;
  backdrop?: boolean;
  closeOnEsc?: boolean;
}

let openStack: number[] = [];
let idSeq = 0;

export function Popover({
  anchor,
  onClose,
  children,
  placement = 'bottom-start',
  offset = 4,
  width,
  style,
  className,
  backdrop = true,
  closeOnEsc = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const idRef = useRef(++idSeq);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const el = ref.current;
    const r = toRect(anchor);
    if (!el || !r) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.left;
    let top = r.top + r.height + offset;
    if (placement === 'bottom-end') left = r.left + r.width - w;
    if (placement === 'bottom-center') left = r.left + r.width / 2 - w / 2;
    if (placement === 'top-start') top = r.top - h - offset;
    if (placement === 'top-center') {
      top = r.top - h - offset;
      left = r.left + r.width / 2 - w / 2;
    }
    if (placement === 'right-start') {
      left = r.left + r.width + offset;
      top = r.top;
      if (left + w > vw - 8) left = r.left - w - offset;
    }
    if (placement === 'left-start') {
      left = r.left - w - offset;
      top = r.top;
    }
    let maxHeight = vh - 16;
    if (placement.startsWith('bottom') && top + h > vh - 8) {
      const above = r.top - h - offset;
      if (above > 8) top = above;
      else {
        maxHeight = Math.max(160, vh - top - 12);
        if (maxHeight < 200) top = Math.max(8, vh - h - 8);
      }
    }
    if (placement.startsWith('top') && top < 8) top = r.top + r.height + offset;
    if (top + Math.min(h, maxHeight) > vh - 8) top = Math.max(8, vh - Math.min(h, maxHeight) - 8);
    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, top);
    setPos({ left, top, maxHeight });
    const af = el.querySelector('[autofocus], input[data-autofocus], textarea[data-autofocus]') as HTMLElement | null;
    if (af && !el.contains(document.activeElement)) af.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, placement, offset]);

  useEffect(() => {
    const id = idRef.current;
    openStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEsc && openStack[openStack.length - 1] === id) {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      openStack = openStack.filter((x) => x !== id);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [closeOnEsc]);

  return createPortal(
    <>
      {backdrop && (
        <div
          className="popover-backdrop"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeRef.current();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            closeRef.current();
          }}
        />
      )}
      <div
        ref={ref}
        className={`popover ${className ?? ''}`}
        style={{
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          width,
          maxHeight: pos?.maxHeight,
          opacity: pos ? undefined : 0,
          ...style,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

export function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  active,
  danger,
  right,
  chevron,
  description,
  onMouseEnter,
  className,
  disabled,
  checked,
}: {
  icon?: ReactNode;
  label: ReactNode;
  shortcut?: string;
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  danger?: boolean;
  right?: ReactNode;
  chevron?: boolean;
  description?: ReactNode;
  onMouseEnter?: (e: React.MouseEvent) => void;
  className?: string;
  disabled?: boolean;
  checked?: boolean;
}) {
  return (
    <div
      role="menuitem"
      className={`menu-item ${active ? 'active' : ''} ${danger ? 'danger' : ''} ${disabled ? 'disabled' : ''} ${description ? 'has-desc' : ''} ${className ?? ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={onMouseEnter}
    >
      {icon && <div className="menu-item-icon">{icon}</div>}
      <div className="menu-item-body">
        <div className="menu-item-label">{label}</div>
        {description && <div className="menu-item-desc">{description}</div>}
      </div>
      {shortcut && <div className="menu-item-shortcut">{shortcut}</div>}
      {right}
      {checked && (
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ marginLeft: 6 }}>
          <path d="M4.5 10.5l3.5 3.5 7.5-8" />
        </svg>
      )}
      {chevron && (
        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--icon)', marginLeft: 4 }}>
          <path d="M7.5 4.5L13 10l-5.5 5.5" />
        </svg>
      )}
    </div>
  );
}

export function MenuSep() {
  return <div className="menu-sep" />;
}
export function MenuHeader({ children }: { children: ReactNode }) {
  return <div className="menu-header">{children}</div>;
}

export function Toggle({ on, onChange }: { on: boolean; onChange?: (v: boolean) => void }) {
  return (
    <div
      className={`toggle-switch ${on ? 'on' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!on);
      }}
    >
      <div className="toggle-knob" />
    </div>
  );
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl+';
export const ALT = isMac ? '⌥' : 'Alt+';
export const SHIFT = isMac ? '⇧' : 'Shift+';
export const isMacOS = isMac;
