import { useState } from 'react';
import { useStore } from '../../store/store';
import type { Discussion, ID } from '../../store/types';
import { useUI } from '../../store/ui';
import * as I from '../ui/Icons';
import { relTime } from '../../lib/time';
import { Popover, MenuItem } from '../ui/Popover';

export function Avatar({ userId, size = 24 }: { userId: ID; size?: number }) {
  const u = useStore((s) => s.users[userId]);
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.5, background: u?.color ?? '#999' }}>
      {u?.name?.[0] ?? '?'}
    </div>
  );
}

function CommentInput({ onSubmit, placeholder, className, autoFocus }: { onSubmit: (t: string) => void; placeholder: string; className?: string; autoFocus?: boolean }) {
  const [v, setV] = useState('');
  const me = useStore((s) => s.me);
  return (
    <div className="comment-input-row">
      <Avatar userId={me} size={24} />
      <input
        autoFocus={autoFocus}
        className={`comment-input ${className ?? ''}`}
        placeholder={placeholder}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && v.trim()) {
            e.preventDefault();
            onSubmit(v.trim());
            setV('');
          }
        }}
      />
      <button className={`send-btn ${v.trim() ? 'on' : ''}`} onClick={() => v.trim() && (onSubmit(v.trim()), setV(''))}>
        <I.ArrowUpIcon size={16} />
      </button>
    </div>
  );
}

export function Thread({ d, compact }: { d: Discussion; compact?: boolean }) {
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.me);
  const [menu, setMenu] = useState<{ rect: DOMRect; cid: ID } | null>(null);
  const s = useStore.getState;
  return (
    <div className={`thread ${d.resolved ? 'resolved' : ''} ${compact ? 'compact' : ''}`}>
      {d.quote && <div className="thread-quote">{d.quote}</div>}
      {d.comments.map((c, i) => (
        <div className="comment" key={c.id}>
          <div className="comment-head">
            <Avatar userId={c.author} size={24} />
            <span className="comment-author">{users[c.author]?.name}</span>
            <span className="comment-time">{relTime(c.createdAt)}</span>
            <div className="comment-actions">
              {i === 0 && (
                <span className="ca-btn" title={d.resolved ? 'Re-open' : 'Resolve'} onClick={() => s().resolveDiscussion(d.id, !d.resolved)}>
                  {d.resolved ? <I.ArrowUturnIcon size={16} /> : <I.CheckIcon size={16} />}
                </span>
              )}
              {c.author === me && (
                <span className="ca-btn" onClick={(e) => setMenu({ rect: e.currentTarget.getBoundingClientRect(), cid: c.id })}>
                  <I.DotsIcon size={16} />
                </span>
              )}
            </div>
          </div>
          <div className="comment-body">{c.text}</div>
        </div>
      ))}
      {!d.resolved && <CommentInput placeholder="Reply…" onSubmit={(t) => s().addComment(d.id, t)} />}
      {menu && (
        <Popover anchor={menu.rect} onClose={() => setMenu(null)} width={200}>
          <div className="menu">
            <MenuItem
              icon={<I.TrashIcon size={16} />}
              label="Delete comment"
              danger
              onClick={() => {
                s().deleteComment(d.id, menu.cid);
                setMenu(null);
              }}
            />
          </div>
        </Popover>
      )}
    </div>
  );
}

/** page-level discussions under the title */
export function PageComments({ pageId }: { pageId: ID }) {
  const discussions = useStore((s) => s.discussions);
  const show = useStore((s) => s.blocks[pageId]?.props.showPageComments);
  const list = Object.values(discussions).filter((d) => d.pageId === pageId && !d.blockId && !d.resolved);
  if (!list.length && !show) return null;
  return (
    <div className="page-comments comments-section">
      {list.map((d) => (
        <Thread key={d.id} d={d} />
      ))}
      <CommentInput
        className="page-comment-input"
        placeholder="Add a comment…"
        onSubmit={(t) => {
          useStore.getState().addDiscussion(pageId, null, '', t);
        }}
      />
    </div>
  );
}

export function CommentsPanel({ pageId }: { pageId: ID }) {
  const discussions = useStore((s) => s.discussions);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const list = Object.values(discussions).filter((d) => d.pageId === pageId && (tab === 'open' ? !d.resolved : d.resolved));
  const blockTarget = (window as any).__commentBlock as string | undefined;
  return (
    <div className="side-panel comments-panel">
      <div className="sp-head">
        <div className="sp-title">Comments</div>
        <div className="sp-tabs">
          <span className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>
            Open
          </span>
          <span className={tab === 'resolved' ? 'on' : ''} onClick={() => setTab('resolved')}>
            Resolved
          </span>
        </div>
        <div className="tb-icon" onClick={() => useUI.getState().set({ commentsOpen: false })}>
          <I.CloseIcon size={18} />
        </div>
      </div>
      <div className="sp-body">
        {blockTarget && tab === 'open' && (
          <div className="thread">
            <div className="thread-quote">Comment on block</div>
            <CommentInput
              autoFocus
              placeholder="Add a comment…"
              onSubmit={(t) => {
                const s = useStore.getState();
                const b = s.blocks[blockTarget];
                const d = document.createElement('div');
                d.innerHTML = b?.text ?? '';
                s.addDiscussion(pageId, blockTarget, (d.textContent ?? '').slice(0, 80), t);
                (window as any).__commentBlock = undefined;
              }}
            />
          </div>
        )}
        {list.length === 0 && !blockTarget && <div className="sp-empty">{tab === 'open' ? 'No open comments yet' : 'No resolved comments.'}</div>}
        {list.map((d) => (
          <div
            key={d.id}
            onMouseEnter={() => document.querySelectorAll(`[data-discussion="${d.id}"]`).forEach((e) => e.classList.add('active'))}
            onMouseLeave={() => document.querySelectorAll(`[data-discussion="${d.id}"]`).forEach((e) => e.classList.remove('active'))}
          >
            <Thread d={d} />
          </div>
        ))}
      </div>
    </div>
  );
}
