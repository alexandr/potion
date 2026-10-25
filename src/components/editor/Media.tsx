import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import type { Block } from '../../store/types';
import { Popover, MenuItem } from '../ui/Popover';
import * as I from '../ui/Icons';
import { TextBlock } from './TextBlock';
import { renderKatex } from './katex';
import { LANGUAGES } from './codeHighlight';
import { useUI } from '../../store/ui';
import { Editable } from './Editable';

const UNSPLASH = [
  'photo-1500530855697-b586d89ba3ee',
  'photo-1469474968028-56623f02e42e',
  'photo-1441974231531-c6227db76b6e',
  'photo-1501785888041-af3ef285b470',
  'photo-1470071459604-3b5ec3a7fe05',
  'photo-1447752875215-b2761acb3c5d',
  'photo-1433086966358-54859d0ed716',
  'photo-1472214103451-9374bd1c798e',
  'photo-1506744038136-46273834b3fb',
  'photo-1493246507139-91e8fad9978e',
  'photo-1519681393784-d120267933ba',
  'photo-1464822759023-fed622ff2c3b',
  'photo-1505765050516-f72dcac9c60e',
  'photo-1482192596544-9eb780fc7f66',
  'photo-1490750967868-88aa4486c946',
  'photo-1502082553048-f009c37129b9',
];
export const unsplashUrl = (id: string, w = 1200) => `https://images.unsplash.com/${id}?w=${w}&q=80`;

const META: Record<string, { label: string; icon: React.ReactNode; accept: string; embedLabel: string }> = {
  image: { label: 'Add an image', icon: <I.ImageIcon size={22} />, accept: 'image/*', embedLabel: 'Embed image' },
  video: { label: 'Embed or upload a video', icon: <I.VideoIcon size={22} />, accept: 'video/*', embedLabel: 'Embed video' },
  audio: { label: 'Add an audio file', icon: <I.AudioIcon size={22} />, accept: 'audio/*', embedLabel: 'Embed audio' },
  file: { label: 'Upload or embed a file', icon: <I.PaperclipIcon size={22} />, accept: '*/*', embedLabel: 'Embed file' },
  embed: { label: 'Add an embed', icon: <I.EmbedIcon size={22} />, accept: '', embedLabel: 'Embed link' },
  bookmark: { label: 'Add a web bookmark', icon: <I.BookmarkIcon size={22} />, accept: '', embedLabel: 'Create bookmark' },
};

function youtubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1];
}
function vimeoId(url: string) {
  return url.match(/vimeo\.com\/(\d+)/)?.[1];
}

function Placeholder({ b, autoOpen }: { b: Block; autoOpen?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const meta = META[b.type];
  useEffect(() => {
    if (autoOpen && b.props.justCreated) {
      setOpen(true);
      useStore.setState((s) => ({ blocks: { ...s.blocks, [b.id]: { ...b, props: { ...b.props, justCreated: undefined } } } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <div ref={ref} className={`media-placeholder ${open ? 'active' : ''}`} onClick={() => setOpen(true)}>
        <span className="mp-icon">{meta.icon}</span>
        <span>{meta.label}</span>
      </div>
      {open && <MediaPicker b={b} anchor={ref.current!} onClose={() => setOpen(false)} />}
    </>
  );
}

function MediaPicker({ b, anchor, onClose }: { b: Block; anchor: HTMLElement; onClose: () => void }) {
  const canUpload = b.type !== 'embed' && b.type !== 'bookmark';
  const [tab, setTab] = useState<'upload' | 'link' | 'unsplash'>(canUpload ? 'upload' : 'link');
  const [url, setUrl] = useState('');
  const set = (props: Record<string, any>) => {
    useStore.getState().setProps(b.id, props);
    onClose();
  };
  const submitLink = () => {
    let u = url.trim();
    if (!u) return;
    if (!/^[a-z]+:/i.test(u)) u = 'https://' + u;
    if (b.type === 'bookmark') {
      let host = u;
      try {
        host = new URL(u).hostname;
      } catch {
        /* */
      }
      set({ url: u, title: prettyTitle(u), description: '', site: host });
    } else if (b.type === 'file') set({ src: u, name: u.split('/').pop() || u });
    else set({ src: u });
  };
  return (
    <Popover anchor={anchor} onClose={onClose} width={Math.min(540, anchor.getBoundingClientRect().width)} placement="bottom-center">
      <div className="media-picker">
        <div className="mpk-tabs">
          {canUpload && (
            <div className={`mpk-tab ${tab === 'upload' ? 'on' : ''}`} onClick={() => setTab('upload')}>
              Upload
            </div>
          )}
          <div className={`mpk-tab ${tab === 'link' ? 'on' : ''}`} onClick={() => setTab('link')}>
            {b.type === 'bookmark' || b.type === 'embed' ? 'Link' : 'Embed link'}
          </div>
          {b.type === 'image' && (
            <div className={`mpk-tab ${tab === 'unsplash' ? 'on' : ''}`} onClick={() => setTab('unsplash')}>
              Unsplash
            </div>
          )}
        </div>
        <div className="mpk-body">
          {tab === 'upload' && (
            <>
              <label className="btn-outline wide">
                Upload file
                <input
                  type="file"
                  accept={META[b.type].accept}
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 4_500_000) {
                      useUI.getState().showToast('Files over 4.5MB cannot be stored in this demo');
                      return;
                    }
                    const r = new FileReader();
                    r.onload = () => set({ src: r.result as string, name: f.name, size: f.size });
                    r.readAsDataURL(f);
                  }}
                />
              </label>
              <div className="mpk-hint">The maximum size per file is 5 MB.</div>
            </>
          )}
          {tab === 'link' && (
            <>
              <input
                autoFocus
                className="text-input"
                placeholder={b.type === 'bookmark' ? 'Paste in https://…' : 'Paste in https://…'}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitLink()}
              />
              <button className="btn-primary wide" onClick={submitLink} style={{ marginTop: 10 }}>
                {META[b.type].embedLabel}
              </button>
              <div className="mpk-hint">
                {b.type === 'image' ? 'Works with any image from the web' : b.type === 'video' ? 'Works with YouTube, Vimeo and more' : b.type === 'embed' ? 'Works with PDFs, Google Drive, Google Maps, CodePen…' : 'Create a visual bookmark from a link…'}
              </div>
            </>
          )}
          {tab === 'unsplash' && (
            <div className="unsplash-grid">
              {UNSPLASH.map((id) => (
                <img key={id} src={unsplashUrl(id, 300)} alt="" onClick={() => set({ src: unsplashUrl(id) })} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Popover>
  );
}

function prettyTitle(u: string) {
  try {
    const url = new URL(u);
    const last = url.pathname.split('/').filter(Boolean).pop();
    if (last) return decodeURIComponent(last).replace(/[-_]+/g, ' ').replace(/\.\w+$/, '');
    return url.hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}

function Caption({ b }: { b: Block }) {
  if (b.props.caption == null && !b.props.showCaption) return null;
  return (
    <div className="media-caption">
      <Editable
        id={`${b.id}-caption`}
        className="caption-edit no-toolbar"
        html={b.props.caption ?? ''}
        placeholder="Write a caption"
        alwaysPlaceholder
        onChange={(h) => useStore.getState().setProps(b.id, { caption: h }, `cap:${b.id}`)}
      />
    </div>
  );
}

function MediaToolbar({ b, extra }: { b: Block; extra?: React.ReactNode }) {
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const s = useStore.getState;
  return (
    <div className="media-toolbar" onMouseDown={(e) => e.preventDefault()}>
      {extra}
      {b.type === 'image' && (
        <>
          <div className="mt-btn" title="Align left" onClick={() => s().setProps(b.id, { align: 'left' })}>
            <I.ParagraphIcon size={16} />
          </div>
          <div className="mt-btn" title="Align center" onClick={() => s().setProps(b.id, { align: 'center' })}>
            <I.MenuIcon size={16} />
          </div>
        </>
      )}
      <div className="mt-btn" title="Caption" onClick={() => s().setProps(b.id, { caption: b.props.caption ?? '', showCaption: true })}>
        <I.TextIcon size={16} />
      </div>
      <div className="mt-btn" title="Comment" onClick={() => useUI.getState().set({ commentsOpen: true })}>
        <I.CommentIcon size={16} />
      </div>
      <div className="mt-btn" title="More" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
        <I.DotsIcon size={16} />
      </div>
      {menu && (
        <Popover anchor={menu} onClose={() => setMenu(null)} width={220} placement="bottom-end">
          <div className="menu">
            {b.props.src && (
              <MenuItem icon={<I.ArrowUpRight size={16} />} label="View original" onClick={() => { window.open(b.props.src, '_blank'); setMenu(null); }} />
            )}
            <MenuItem icon={<I.TurnIntoIcon size={16} />} label="Replace" onClick={() => { s().setProps(b.id, { src: undefined, url: undefined }); setMenu(null); }} />
            {b.props.src && (
              <MenuItem
                icon={<I.LinkIcon size={16} />}
                label="Copy link"
                onClick={() => {
                  navigator.clipboard?.writeText(b.props.src).catch(() => {});
                  useUI.getState().showToast('Copied link to clipboard');
                  setMenu(null);
                }}
              />
            )}
            <MenuItem icon={<I.TrashIcon size={16} />} label="Delete" onClick={() => { s().deleteBlock(b.id); setMenu(null); }} />
          </div>
        </Popover>
      )}
    </div>
  );
}

function Resizable({ b, children, minWidth = 120 }: { b: Block; children: React.ReactNode; minWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<number | null>(null);
  const width = w ?? (b.props.width ? `${Math.round(b.props.width * 100)}%` : '100%');
  const start = (e: React.MouseEvent, side: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current!;
    const parentW = el.parentElement!.getBoundingClientRect().width;
    const startW = el.getBoundingClientRect().width;
    const x0 = e.clientX;
    const centered = (b.props.align ?? 'center') === 'center';
    const move = (ev: MouseEvent) => {
      const d = (ev.clientX - x0) * side * (centered ? 2 : 1);
      setW(Math.max(minWidth, Math.min(parentW, startW + d)));
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      const d = (ev.clientX - x0) * side * (centered ? 2 : 1);
      const final = Math.max(minWidth, Math.min(parentW, startW + d));
      useStore.getState().setProps(b.id, { width: final / parentW });
      setW(null);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  return (
    <div className={`resizable align-${b.props.align ?? 'center'}`}>
      <div ref={ref} className="resizable-inner" style={{ width }}>
        {children}
        <div className="resize-handle left" onMouseDown={(e) => start(e, -1)}>
          <div />
        </div>
        <div className="resize-handle right" onMouseDown={(e) => start(e, 1)}>
          <div />
        </div>
      </div>
    </div>
  );
}

export function MediaBlock({ b }: { b: Block }) {
  if (!b.props.src) return <Placeholder b={b} autoOpen />;
  if (b.type === 'image')
    return (
      <div className="media-block image-block">
        <Resizable b={b}>
          <img src={b.props.src} alt={b.props.caption ?? ''} draggable={false} onClick={() => useUI.getState().select([b.id])} />
          <MediaToolbar b={b} />
        </Resizable>
        <Caption b={b} />
      </div>
    );
  if (b.type === 'video') {
    const yt = youtubeId(b.props.src);
    const vm = vimeoId(b.props.src);
    return (
      <div className="media-block video-block">
        <Resizable b={b}>
          {yt || vm ? (
            <div className="iframe-wrap" style={{ aspectRatio: '16 / 9' }}>
              <iframe src={yt ? `https://www.youtube.com/embed/${yt}` : `https://player.vimeo.com/video/${vm}`} allowFullScreen title="video" />
            </div>
          ) : (
            <video src={b.props.src} controls style={{ width: '100%' }} />
          )}
          <MediaToolbar b={b} />
        </Resizable>
        <Caption b={b} />
      </div>
    );
  }
  if (b.type === 'audio')
    return (
      <div className="media-block audio-block">
        <audio src={b.props.src} controls style={{ width: '100%' }} />
        <Caption b={b} />
      </div>
    );
  return (
    <div className="media-block file-block">
      <a className="file-row" href={b.props.src} target="_blank" rel="noreferrer" download={b.props.name}>
        <I.PaperclipIcon size={18} />
        <span className="file-name">{b.props.name ?? 'File'}</span>
        {b.props.size && <span className="file-size">{formatSize(b.props.size)}</span>}
      </a>
      <MediaToolbar b={b} />
      <Caption b={b} />
    </div>
  );
}

function formatSize(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function embedSrc(u: string) {
  const yt = youtubeId(u);
  if (yt) return `https://www.youtube.com/embed/${yt}`;
  if (/figma\.com/.test(u)) return `https://www.figma.com/embed?embed_host=potion&url=${encodeURIComponent(u)}`;
  if (/google\.[a-z.]+\/maps/.test(u)) return u.replace('/maps/', '/maps/embed/');
  if (/codepen\.io\/[^/]+\/pen\//.test(u)) return u.replace('/pen/', '/embed/');
  if (/loom\.com\/share\//.test(u)) return u.replace('/share/', '/embed/');
  return u;
}

export function EmbedBlock({ b }: { b: Block }) {
  if (!b.props.src) return <Placeholder b={b} autoOpen />;
  return (
    <div className="media-block embed-block">
      <Resizable b={b}>
        <div className="iframe-wrap" style={{ height: b.props.height ?? 400 }}>
          <iframe src={embedSrc(b.props.src)} title="embed" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
        </div>
        <MediaToolbar b={b} />
      </Resizable>
      <Caption b={b} />
    </div>
  );
}

export function BookmarkBlock({ b }: { b: Block }) {
  if (!b.props.url) return <Placeholder b={b} autoOpen />;
  let host = b.props.site;
  try {
    host = host || new URL(b.props.url).hostname;
  } catch {
    /* */
  }
  return (
    <div className="media-block bookmark-block">
      <a className="bookmark" href={b.props.url} target="_blank" rel="noreferrer">
        <div className="bm-text">
          <div className="bm-title">{b.props.title || b.props.url}</div>
          {b.props.description && <div className="bm-desc">{b.props.description}</div>}
          <div className="bm-url">
            <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} alt="" width={16} height={16} />
            <span>{b.props.url}</span>
          </div>
        </div>
        {b.props.image && (
          <div className="bm-image">
            <img src={b.props.image} alt="" />
          </div>
        )}
      </a>
      <MediaToolbar b={b} />
      <Caption b={b} />
    </div>
  );
}

export function EquationBlock({ b }: { b: Block }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(!!b.props.justCreated);
  const [v, setV] = useState(b.props.expression ?? '');
  const expr = b.props.expression ?? '';
  const commit = () => {
    useStore.getState().setProps(b.id, { expression: v, justCreated: undefined });
    setOpen(false);
  };
  return (
    <>
      <div ref={ref} className={`equation-block ${open ? 'active' : ''} ${expr ? '' : 'empty'}`} onClick={() => { setV(expr); setOpen(true); }}>
        {expr ? <div dangerouslySetInnerHTML={{ __html: renderKatex(expr, true) }} /> : (
          <div className="media-placeholder inline">
            <span className="mp-icon"><I.EquationIcon size={22} /></span>
            <span>Add a TeX equation</span>
          </div>
        )}
      </div>
      {open && ref.current && (
        <Popover anchor={ref.current} onClose={commit} width={Math.min(500, ref.current.getBoundingClientRect().width)} placement="bottom-center">
          <div className="eq-editor">
            <textarea
              autoFocus
              value={v}
              placeholder="|x| = \begin{cases} x, & \quad x \geq 0 \\ -x, & \quad x < 0 \end{cases}"
              onChange={(e) => setV(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                  e.preventDefault();
                  commit();
                }
              }}
            />
            <button className="btn-primary" onClick={commit}>
              Done <span style={{ opacity: 0.7 }}>↵</span>
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}

export function CodeBlock({ b }: { b: Block }) {
  const [lang, setLang] = useState<DOMRect | null>(null);
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const s = useStore.getState;
  const language = b.props.language ?? 'Plain Text';
  const display = LANGUAGES.find((l) => l.toLowerCase() === String(language).toLowerCase()) ?? language;
  return (
    <div className="code-block-wrap">
      <div className={`code-block ${b.props.wrap === false ? 'nowrap' : ''}`}>
        <div className="code-head" onMouseDown={(e) => e.preventDefault()}>
          <div className="code-lang" onClick={(e) => { setQ(''); setLang(e.currentTarget.getBoundingClientRect()); }}>
            {display}
            <I.ChevronDown size={10} />
          </div>
          <div className="code-actions">
            <div
              className="code-act"
              onClick={() => {
                navigator.clipboard?.writeText(b.text).catch(() => {});
                useUI.getState().showToast('Copied to clipboard');
              }}
            >
              <I.DuplicateIcon size={14} /> Copy
            </div>
            <div className="code-act" onClick={() => s().setProps(b.id, { caption: b.props.caption ?? '', showCaption: true })}>
              <I.TextIcon size={14} /> Caption
            </div>
            <div className="code-act icon-only" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
              <I.DotsIcon size={14} />
            </div>
          </div>
        </div>
        <TextBlock block={b} className="code-content" placeholder=" " />
      </div>
      <Caption b={b} />
      {lang && (
        <Popover anchor={lang} onClose={() => setLang(null)} width={240}>
          <div className="menu lang-menu">
            <input autoFocus className="text-input" placeholder="Search for a language…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="lang-list">
              {LANGUAGES.filter((l) => l.toLowerCase().includes(q.toLowerCase())).map((l) => (
                <MenuItem
                  key={l}
                  label={l}
                  checked={l.toLowerCase() === String(language).toLowerCase()}
                  onClick={() => {
                    s().setProps(b.id, { language: l });
                    setLang(null);
                  }}
                />
              ))}
            </div>
          </div>
        </Popover>
      )}
      {menu && (
        <Popover anchor={menu} onClose={() => setMenu(null)} width={220} placement="bottom-end">
          <div className="menu">
            <MenuItem
              icon={<I.WrapIcon size={16} />}
              label="Wrap code"
              checked={b.props.wrap !== false}
              onClick={() => {
                s().setProps(b.id, { wrap: b.props.wrap === false });
                setMenu(null);
              }}
            />
            <MenuItem icon={<I.TrashIcon size={16} />} label="Delete" onClick={() => { s().deleteBlock(b.id); setMenu(null); }} />
          </div>
        </Popover>
      )}
    </div>
  );
}
