import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { getCaretOffset, setCaret } from '../../lib/dom';

interface Props {
  html: string;
  id?: string;
  className?: string;
  placeholder?: string;
  /** placeholder shown even when not focused */
  alwaysPlaceholder?: boolean;
  onChange: (html: string, el: HTMLElement) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readOnly?: boolean;
  style?: CSSProperties;
  /** render function for code highlighting: given text returns html */
  highlight?: (text: string) => string;
  spellCheck?: boolean;
  tag?: 'div' | 'h1';
}

export const Editable = forwardRef<HTMLDivElement, Props>(function Editable(
  {
    html,
    id,
    className,
    placeholder,
    alwaysPlaceholder,
    onChange,
    onKeyDown,
    onBlur,
    onFocus,
    onPaste,
    onMouseDown,
    onClick,
    readOnly,
    style,
    highlight,
    spellCheck = true,
  },
  fwd,
) {
  const ref = useRef<HTMLDivElement>(null);
  useImperativeHandle(fwd, () => ref.current!);
  const composing = useRef(false);

  const render = (text: string) => {
    if (!highlight) return text;
    return highlight(text) + (text.endsWith('\n') ? '<br>' : '');
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = highlight ? render(html) : html;
    if (highlight) {
      if ((el.textContent ?? '') !== html || el.dataset.hl !== '1') {
        const focused = document.activeElement === el;
        const off = focused ? getCaretOffset(el) : 0;
        el.innerHTML = target;
        el.dataset.hl = '1';
        if (focused) setCaret(el, Math.min(off, html.length));
      }
      return;
    }
    if (el.innerHTML !== target) {
      const focused = document.activeElement === el;
      const off = focused ? getCaretOffset(el) : 0;
      el.innerHTML = target;
      if (focused) setCaret(el, off);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, highlight]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    if (highlight) {
      const text = el.textContent ?? '';
      const off = getCaretOffset(el);
      el.innerHTML = render(text);
      setCaret(el, off);
      onChange(text, el);
      return;
    }
    let h = el.innerHTML;
    if (h === '<br>' || h === '<div><br></div>') {
      el.innerHTML = '';
      h = '';
    }
    onChange(h, el);
  };

  return (
    <div
      ref={ref}
      data-editable={id}
      className={`editable ${className ?? ''} ${alwaysPlaceholder ? 'always-ph' : ''}`}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      spellCheck={spellCheck}
      data-placeholder={placeholder}
      style={style}
      onInput={() => {
        if (!composing.current) emit();
      }}
      onCompositionStart={() => (composing.current = true)}
      onCompositionEnd={() => {
        composing.current = false;
        emit();
      }}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onFocus={onFocus}
      onPaste={onPaste}
      onMouseDown={onMouseDown}
      onClick={onClick}
    />
  );
});
