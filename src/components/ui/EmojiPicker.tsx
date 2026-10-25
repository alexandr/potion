import { useMemo, useRef, useState } from 'react';
import groups from 'unicode-emoji-json/data-by-group.json';
import { Popover, type Anchor } from './Popover';
import * as I from './Icons';
import { NOTION_ICONS } from './iconSet';
import { COLOR_LIST } from '../../lib/blockDefs';

interface EmojiEntry {
  emoji: string;
  name: string;
  slug: string;
  skin_tone_support: boolean;
}
type Group = { name: string; slug: string; emojis: EmojiEntry[] };

const GROUPS = (groups as unknown as Group[]).filter((g) => g.slug !== 'component');
const GROUP_LABEL: Record<string, string> = {
  smileys_emotion: 'People',
  people_body: 'People',
  animals_nature: 'Animals and nature',
  food_drink: 'Food and drink',
  activities: 'Activity',
  travel_places: 'Travel and places',
  objects: 'Objects',
  symbols: 'Symbols',
  flags: 'Flags',
};
const MERGED: { label: string; icon: string; emojis: EmojiEntry[] }[] = [];
for (const g of GROUPS) {
  const label = GROUP_LABEL[g.slug] ?? g.name;
  const existing = MERGED.find((m) => m.label === label);
  if (existing) existing.emojis.push(...g.emojis);
  else MERGED.push({ label, icon: g.emojis[0]?.emoji ?? '', emojis: [...g.emojis] });
}
const ALL: EmojiEntry[] = MERGED.flatMap((m) => m.emojis);
const CAT_ICONS = ['🕘', '😀', '🐻', '🍔', '⚽', '🚗', '💡', '💕', '🏁'];

const SKIN = ['', '🏻', '🏼', '🏽', '🏾', '🏿'];
const SKIN_HANDS = ['✋', '✋🏻', '✋🏼', '✋🏽', '✋🏾', '✋🏿'];

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem('potion-recent-emoji') ?? '[]');
  } catch {
    return [];
  }
}
function pushRecent(e: string) {
  try {
    const r = [e, ...getRecent().filter((x) => x !== e)].slice(0, 24);
    localStorage.setItem('potion-recent-emoji', JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

export function randomEmoji() {
  const pool = MERGED.filter((m) => m.label !== 'Flags' && m.label !== 'Symbols').flatMap((m) => m.emojis);
  return pool[Math.floor(Math.random() * pool.length)].emoji;
}

function applySkin(e: EmojiEntry, skin: number) {
  if (!skin || !e.skin_tone_support) return e.emoji;
  const chars = Array.from(e.emoji);
  return chars[0] + SKIN[skin] + chars.slice(1).join('').replace('️', '');
}

export function EmojiPicker({ onPick, onRemove, showRemove = true, upload = true }: { onPick: (e: string) => void; onRemove?: () => void; showRemove?: boolean; upload?: boolean }) {
  const [tab, setTab] = useState<'emoji' | 'icons' | 'upload'>('emoji');
  const [q, setQ] = useState('');
  const [skin, setSkin] = useState(() => Number(localStorage.getItem('potion-skin') ?? 0) || 0);
  const [skinOpen, setSkinOpen] = useState(false);
  const [hover, setHover] = useState<EmojiEntry | null>(null);
  const [iconColor, setIconColor] = useState('gray');
  const scrollRef = useRef<HTMLDivElement>(null);
  const recent = useMemo(getRecent, []);
  const [link, setLink] = useState('');

  const pick = (e: string) => {
    pushRecent(e);
    onPick(e);
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    return ALL.filter((e) => e.name.includes(s) || e.slug.includes(s.replace(/\s+/g, '_'))).slice(0, 400);
  }, [q]);

  const sections = [
    ...(recent.length ? [{ label: 'Recent', emojis: recent.map((r) => ({ emoji: r, name: '', slug: '', skin_tone_support: false })) }] : []),
    ...MERGED,
  ];

  return (
    <div className="emoji-picker">
      <div className="ep-tabs">
        <div className={`ep-tab ${tab === 'emoji' ? 'active' : ''}`} onClick={() => setTab('emoji')}>
          Emoji
        </div>
        <div className={`ep-tab ${tab === 'icons' ? 'active' : ''}`} onClick={() => setTab('icons')}>
          Icons
        </div>
        {upload && (
          <div className={`ep-tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>
            Upload
          </div>
        )}
        <div style={{ flex: 1 }} />
        {showRemove && onRemove && (
          <div className="ep-tab ep-remove" onClick={onRemove}>
            Remove
          </div>
        )}
      </div>
      {tab !== 'upload' && (
        <div className="ep-search-row">
          <div className="ep-search">
            <I.SearchIcon size={16} />
            <input autoFocus placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="ep-icon-btn" title="Random" onClick={() => pick(tab === 'icons' ? `icon:${Object.keys(NOTION_ICONS)[Math.floor(Math.random() * Object.keys(NOTION_ICONS).length)]}:${iconColor}` : randomEmoji())}>
            <I.ShuffleIcon size={18} />
          </button>
          {tab === 'emoji' && (
            <div style={{ position: 'relative' }}>
              <button className="ep-icon-btn" title="Select skin tone" onClick={() => setSkinOpen(!skinOpen)}>
                <span style={{ fontSize: 18 }}>{SKIN_HANDS[skin]}</span>
              </button>
              {skinOpen && (
                <div className="ep-skin-menu">
                  {SKIN_HANDS.map((h, i) => (
                    <span
                      key={i}
                      onClick={() => {
                        setSkin(i);
                        localStorage.setItem('potion-skin', String(i));
                        setSkinOpen(false);
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'icons' && (
            <div className="ep-colors">
              {COLOR_LIST.filter((c) => c !== 'default').map((c) => (
                <span key={c} className={`ep-color ${iconColor === c ? 'on' : ''}`} style={{ background: `var(--dot-${c})` }} onClick={() => setIconColor(c)} />
              ))}
            </div>
          )}
        </div>
      )}
      {tab === 'emoji' && (
        <>
          <div className="ep-scroll" ref={scrollRef}>
            {filtered ? (
              <div className="ep-section">
                {filtered.length === 0 && <div className="ep-empty">No results</div>}
                <div className="ep-grid">
                  {filtered.map((e) => (
                    <div key={e.slug} className="ep-cell" onMouseEnter={() => setHover(e)} onClick={() => pick(applySkin(e, skin))}>
                      {applySkin(e, skin)}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              sections.map((sec, si) => (
                <div className="ep-section" key={sec.label} data-section={si}>
                  <div className="ep-section-title">{sec.label}</div>
                  <div className="ep-grid">
                    {sec.emojis.map((e, i) => (
                      <div key={i} className="ep-cell" onMouseEnter={() => setHover(e)} onClick={() => pick(applySkin(e, skin))}>
                        {applySkin(e, skin)}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="ep-footer">
            {hover && hover.name ? (
              <div className="ep-hover">
                <span style={{ fontSize: 22 }}>{applySkin(hover, skin)}</span>
                <span>{hover.name.replace(/^\w/, (c) => c.toUpperCase())}</span>
              </div>
            ) : (
              <div className="ep-cats">
                {CAT_ICONS.slice(recent.length ? 0 : 1).map((c, i) => (
                  <span
                    key={c}
                    className="ep-cat"
                    onClick={() => {
                      const el = scrollRef.current?.querySelector(`[data-section="${i}"]`) as HTMLElement | null;
                      if (el && scrollRef.current) scrollRef.current.scrollTop = el.offsetTop - 4;
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {tab === 'icons' && (
        <div className="ep-scroll">
          <div className="ep-section">
            <div className="ep-section-title">Icons</div>
            <div className="ep-grid icons">
              {Object.entries(NOTION_ICONS)
                .filter(([n]) => !q || n.includes(q.toLowerCase()))
                .map(([n, Cmp]) => (
                  <div key={n} className="ep-cell" title={n} style={{ color: `var(--dot-${iconColor})` }} onClick={() => pick(`icon:${n}:${iconColor}`)}>
                    <Cmp size={22} />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
      {tab === 'upload' && (
        <div className="ep-upload">
          <label className="btn-outline upload-btn">
            Upload an image
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => onPick(r.result as string);
                r.readAsDataURL(f);
              }}
            />
          </label>
          <div className="ep-hint">Recommended size is 280 × 280 pixels</div>
          <div className="ep-or">or</div>
          <input className="text-input" placeholder="Paste link to an image…" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && link && onPick(link)} />
          <button className="btn-primary" style={{ marginTop: 8 }} disabled={!link} onClick={() => link && onPick(link)}>
            Submit
          </button>
        </div>
      )}
    </div>
  );
}

export function EmojiPopover({ anchor, onClose, onPick, onRemove }: { anchor: Anchor; onClose: () => void; onPick: (e: string) => void; onRemove?: () => void }) {
  return (
    <Popover anchor={anchor} onClose={onClose} width={408}>
      <EmojiPicker onPick={onPick} onRemove={onRemove} />
    </Popover>
  );
}

export function searchEmoji(q: string, limit = 8): EmojiEntry[] {
  const s = q.toLowerCase();
  if (!s) return ALL.slice(0, limit);
  const starts = ALL.filter((e) => e.slug.startsWith(s) || e.name.startsWith(s));
  const incl = ALL.filter((e) => !starts.includes(e) && (e.name.includes(s) || e.slug.includes(s)));
  return [...starts, ...incl].slice(0, limit);
}
