import { useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Tooltip({ label, shortcut, children, side = 'top' }: { label: ReactNode; shortcut?: string; children: ReactElement; side?: 'top' | 'bottom' | 'right' }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const timer = useRef<number | undefined>(undefined);
  if (!label) return children;
  return (
    <span
      className="tooltip-host"
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        timer.current = window.setTimeout(() => setRect(el.getBoundingClientRect()), 450);
      }}
      onMouseLeave={() => {
        window.clearTimeout(timer.current);
        setRect(null);
      }}
      onMouseDown={() => {
        window.clearTimeout(timer.current);
        setRect(null);
      }}
    >
      {children}
      {rect &&
        createPortal(
          <div
            className="tooltip"
            style={
              side === 'right'
                ? { left: rect.right + 8, top: rect.top + rect.height / 2, transform: 'translateY(-50%)' }
                : side === 'bottom'
                  ? { left: rect.left + rect.width / 2, top: rect.bottom + 6, transform: 'translateX(-50%)' }
                  : { left: rect.left + rect.width / 2, top: rect.top - 6, transform: 'translate(-50%, -100%)' }
            }
          >
            <div>{label}</div>
            {shortcut && <div className="tooltip-shortcut">{shortcut}</div>}
          </div>,
          document.body,
        )}
    </span>
  );
}
