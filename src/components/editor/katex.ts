import katex from 'katex';
import 'katex/dist/katex.min.css';

export function renderKatex(expr: string, display: boolean): string {
  try {
    return katex.renderToString(expr || '\\phantom{x}', { displayMode: display, throwOnError: false });
  } catch {
    return `<span class="katex-error">${expr}</span>`;
  }
}
