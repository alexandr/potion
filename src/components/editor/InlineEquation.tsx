import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Popover } from '../ui/Popover';
import { renderKatex } from './katex';

export function openInlineEquation(span: HTMLElement, _blockId: string) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () => {
    root.unmount();
    host.remove();
  };
  root.render(<EqEditor span={span} onClose={close} />);
}

function EqEditor({ span, onClose }: { span: HTMLElement; onClose: () => void }) {
  const [v, setV] = useState(span.getAttribute('data-expr') ?? '');
  const commit = () => {
    const root = span.closest('[data-editable]') as HTMLElement | null;
    if (!v.trim()) span.remove();
    else {
      span.setAttribute('data-expr', v);
      span.innerHTML = renderKatex(v, false);
    }
    root?.dispatchEvent(new Event('input', { bubbles: true }));
    onClose();
  };
  return (
    <Popover anchor={span.getBoundingClientRect()} onClose={commit} width={360}>
      <div className="eq-editor">
        <textarea
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="E = mc^2"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
          }}
        />
        <button className="btn-primary" onClick={commit}>
          Done ↵
        </button>
      </div>
    </Popover>
  );
}
