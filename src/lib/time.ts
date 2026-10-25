export function relTime(t: number, withTime = false): string {
  const d = new Date(t);
  const now = new Date();
  const diff = (now.getTime() - t) / 1000;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return withTime ? `Today at ${time}` : `${Math.floor(diff / 3600)}h ago`;
  const y = new Date(now.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return withTime ? `Yesterday at ${time}` : 'Yesterday';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts) + (withTime ? `, ${time}` : '');
}

export function editedLabel(t: number): string {
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'Edited just now';
  if (diff < 3600) return `Edited ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Edited ${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `Edited ${days}d ago`;
  return `Edited ${new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function fullDate(t: number) {
  return new Date(t).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
