import { useRef } from 'react';
import { useStore, pageTitle, isTrashed } from '../../store/store';
import { goPage, setPeek } from '../../lib/router';
import { PageIconView } from '../ui/PageIcon';
import { coverStyle } from '../../lib/covers';
import { relTime } from '../../lib/time';
import * as I from '../ui/Icons';
import { useUI } from '../../store/ui';
import { TEMPLATES, instantiateTemplate } from '../../lib/templates';
import { Tag } from '../db/CellValue';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Home() {
  const recent = useStore((s) => s.workspace.recent);
  const blocks = useStore((s) => s.blocks);
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.me);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pages = recent.map((r) => blocks[r.id]).filter((b) => b && !isTrashed(blocks, b.id)).slice(0, 12);

  // my tasks: rows in databases with a person prop containing me
  const tasks = Object.values(blocks)
    .filter((b) => b.type === 'page' && b.parent && blocks[b.parent]?.type === 'database' && !isTrashed(blocks, b.id))
    .filter((r) => {
      const db = blocks[r.parent!];
      const schema = db.props.schema ?? {};
      return Object.values(schema).some((p: any) => p.type === 'person' && (r.props.values?.[p.id] ?? []).includes(me)) &&
        Object.values(schema).some((p: any) => p.type === 'status');
    })
    .slice(0, 6);

  const scroll = (d: number) => scrollRef.current?.scrollBy({ left: d, behavior: 'smooth' });

  return (
    <div className="home">
      <h1 className="home-greeting">{greeting()}</h1>
      <section className="home-widget">
        <div className="hw-label">
          <I.ClockIcon size={14} /> Recently visited
        </div>
        <div className="hw-scroll-wrap">
          <button className="hw-arrow left" onClick={() => scroll(-480)}>
            <I.ChevronLeft size={16} />
          </button>
          <div className="recent-row" ref={scrollRef}>
            {pages.map((p) => (
              <div key={p.id} className="recent-card" onClick={() => goPage(p.id, pageTitle(p))}>
                <div className="rc-cover" style={coverStyle(p.props.cover, p.props.coverPos) ?? undefined} />
                <div className="rc-icon">
                  <PageIconView icon={p.props.icon} size={26} page={p} />
                </div>
                <div className="rc-body">
                  <div className="rc-title">{pageTitle(p)}</div>
                  <div className="rc-meta">
                    <div className="avatar" style={{ background: users[p.lastEditedBy]?.color, width: 16, height: 16, fontSize: 9 }}>
                      {users[p.lastEditedBy]?.name[0]}
                    </div>
                    <span>{relTime(p.updatedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
            <div
              className="recent-card new-card"
              onClick={() => {
                const id = useStore.getState().createPage('private');
                goPage(id, '');
              }}
            >
              <div className="rc-cover" />
              <div className="rc-icon">
                <I.PlusIcon size={22} />
              </div>
              <div className="rc-body">
                <div className="rc-title muted">New page</div>
              </div>
            </div>
          </div>
          <button className="hw-arrow right" onClick={() => scroll(480)}>
            <I.ChevronRight size={16} />
          </button>
        </div>
      </section>

      <div className="home-grid">
        <section className="home-widget">
          <div className="hw-label">
            <I.CalendarIcon size={14} /> Upcoming events
          </div>
          <div className="hw-card events-card">
            <div className="ev-left">
              <I.CalendarIcon size={28} />
              <div className="ev-title">Connect your calendar</div>
              <div className="ev-desc">See your upcoming events and join meetings from Potion.</div>
              <button className="btn-text-blue" onClick={() => useUI.getState().showToast('Calendar sync is not available in the demo')}>
                Connect Calendar
              </button>
            </div>
            <div className="ev-right">
              <div className="ev-day">Today</div>
              <div className="ev-item">
                <span className="ev-bar" /> <div><div>Team standup</div><div className="ev-time">9:00 AM · Office</div></div>
              </div>
              <div className="ev-day">Tomorrow</div>
              <div className="ev-item">
                <span className="ev-bar purple" /> <div><div>Project check-in</div><div className="ev-time">2:00 PM</div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="home-widget">
          <div className="hw-label">
            <I.CheckboxIcon size={14} /> My tasks
          </div>
          <div className="hw-card tasks-card">
            {tasks.length === 0 && <div className="sp-empty">No tasks assigned to you</div>}
            {tasks.map((t) => {
              const db = blocks[t.parent!];
              const due = Object.values(db.props.schema).find((p: any) => p.type === 'date') as any;
              const st = Object.values(db.props.schema).find((p: any) => p.type === 'status') as any;
              const opt = st?.options?.find((o: any) => o.id === t.props.values?.[st.id]);
              return (
                <div key={t.id} className="task-row" onClick={() => setPeek(t.id, 's')}>
                  <PageIconView icon={t.props.icon} size={16} page={t} />
                  <span className="task-title">{pageTitle(t)}</span>
                  {opt && <Tag name={opt.name} color={opt.color} status small />}
                  {due && t.props.values?.[due.id]?.start && <span className="task-due">{new Date(t.props.values[due.id].start + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="home-widget">
        <div className="hw-label">
          <I.TemplatesIcon size={14} /> Featured templates
        </div>
        <div className="tpl-cards">
          {TEMPLATES.slice(0, 4).map((t) => (
            <div key={t.name} className="tpl-card" onClick={() => { const id = instantiateTemplate(t); goPage(id, t.name); }}>
              <div className="tc-cover" style={coverStyle(t.cover ?? 'gradient_8') ?? undefined}>
                <span>{t.icon}</span>
              </div>
              <div className="tc-name">{t.name}</div>
              <div className="tc-desc">{t.description}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
