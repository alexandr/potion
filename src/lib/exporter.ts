import { useStore, pageTitle } from '../store/store';
import type { ID } from '../store/types';
import { blocksToMarkdown, serializeBlocks } from '../components/editor/clipboard';

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportPage(pageId: ID, fmt: 'markdown' | 'html' | 'pdf') {
  const s = useStore.getState();
  const page = s.blocks[pageId];
  const title = pageTitle(page);
  if (page.type === 'database') {
    const schema = page.props.schema ?? {};
    const cols = Object.values(schema) as any[];
    const rows = page.children.map((r) => s.blocks[r]).filter(Boolean);
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.map((c) => esc(c.name)).join(','), ...rows.map((r) => cols.map((c) => esc(c.id === 'title' ? r.props.title : JSON.stringify(r.props.values?.[c.id] ?? ''))).join(','))].join('\n');
    download(`${title}.csv`, csv, 'text/csv');
    return;
  }
  if (fmt === 'markdown') {
    download(`${title}.md`, `# ${title}\n\n` + blocksToMarkdown(serializeBlocks(page.children)), 'text/markdown');
    return;
  }
  const el = document.querySelector('.page-frame');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:ui-sans-serif,-apple-system,sans-serif;max-width:708px;margin:40px auto;color:#2c2c2b;line-height:1.5}</style></head><body><h1>${title}</h1>${el?.querySelector('.page-blocks')?.innerHTML ?? ''}</body></html>`;
  if (fmt === 'html') download(`${title}.html`, html, 'text/html');
  else window.print();
}
