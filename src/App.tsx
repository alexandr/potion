import { useEffect } from 'react';
import { useStore, pageTitle } from './store/store';
import { useUI } from './store/ui';
import { useRoute, goPage, setPeek } from './lib/router';
import { Sidebar } from './components/shell/Sidebar';
import { Topbar } from './components/shell/Topbar';
import { PageView } from './components/shell/PageView';
import { Home } from './components/shell/Home';
import { Peek } from './components/shell/Peek';
import { SearchModal } from './components/shell/SearchModal';
import { SettingsModal, TrashPopover, InboxPanel, TemplatesModal, HistoryModal, Toast } from './components/shell/Modals';
import { CommentsPanel } from './components/shell/Comments';
import { SlashMenu } from './components/editor/SlashMenu';
import { InlineMenus, LinkPickerHost } from './components/editor/InlineMenus';
import { InlineToolbar } from './components/editor/InlineToolbar';
import { BlockMenu } from './components/editor/BlockMenu';
import { focusBlock } from './components/editor/actions';
import { BRAND } from './lib/brand';

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function useGlobalKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      const ae = document.activeElement as HTMLElement | null;
      const inInput = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
      const ui = useUI.getState();
      const s = useStore.getState();
      if ((k === 'k' && !(ae?.isContentEditable && !window.getSelection()?.isCollapsed)) || (k === 'p' && !e.shiftKey)) {
        if (k === 'k' && ae?.isContentEditable) return; // link editor handles it
        e.preventDefault();
        ui.set({ searchOpen: !ui.searchOpen });
      } else if (k === 'n' && !e.shiftKey && !inInput) {
        e.preventDefault();
        const id = s.createPage('private');
        goPage(id, '');
      } else if (e.key === '\\' && !e.shiftKey) {
        e.preventDefault();
        s.updateSettings({ sidebarCollapsed: !s.settings.sidebarCollapsed });
      } else if (k === 'l' && e.shiftKey) {
        e.preventDefault();
        const dark = document.documentElement.dataset.theme === 'dark';
        s.updateSettings({ theme: dark ? 'light' : 'dark' });
      } else if (k === 'z' && !inInput) {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        const f = e.shiftKey ? s.redo() : s.undo();
        if (f) focusBlock(f.id, f.offset);
      } else if (k === 'y' && !inInput && !navigator.platform.includes('Mac')) {
        e.preventDefault();
        const f = s.redo();
        if (f) focusBlock(f.id, f.offset);
      } else if (e.key === '[' && !inInput) {
        e.preventDefault();
        history.back();
      } else if (e.key === ']' && !inInput) {
        e.preventDefault();
        history.forward();
      } else if (k === 'l' && !e.shiftKey && !inInput && !ae?.isContentEditable) {
        const r = new URL(location.href);
        e.preventDefault();
        navigator.clipboard?.writeText(r.origin + r.pathname).catch(() => {});
        ui.showToast('Copied link to clipboard');
      } else if (k === 'm' && e.shiftKey) {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && ae?.isContentEditable) {
          import('./components/editor/InlineToolbar').then((m) => m.openCommentComposer());
        } else ui.set({ commentsOpen: true });
      } else if (k === 'h' && e.shiftKey && ae?.isContentEditable) {
        e.preventDefault();
        import('./components/editor/InlineToolbar').then((m) => m.repeatLastColor());
      } else if (k === 'u' && e.shiftKey) {
        e.preventDefault();
        ui.set({ commentsOpen: !ui.commentsOpen });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}

export default function App() {
  useTheme();
  useGlobalKeys();
  const route = useRoute();
  const collapsed = useStore((s) => s.settings.sidebarCollapsed);
  const exists = useStore((s) => (route.pageId ? !!s.blocks[route.pageId] : true));
  const commentsOpen = useUI((s) => s.commentsOpen);
  const sidebarPeek = useUI((s) => s.sidebarPeek);

  useEffect(() => {
    // start page
    if (!route.pageId && useStore.getState().settings.startPage === 'last' && !sessionStorage.getItem('potion-started')) {
      const last = useStore.getState().workspace.recent[0];
      const b = last && useStore.getState().blocks[last.id];
      if (b) goPage(b.id, pageTitle(b));
    }
    sessionStorage.setItem('potion-started', '1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!route.pageId) document.title = `Home | ${BRAND}`;
    useUI.getState().select([]);
    // scroll to block hash
    if (location.hash.length > 1) {
      setTimeout(() => {
        const el = document.querySelector(`[data-block-id="${location.hash.slice(1)}"]`);
        el?.scrollIntoView({ block: 'center' });
        el?.classList.add('flash');
        setTimeout(() => el?.classList.remove('flash'), 1500);
      }, 200);
    } else document.querySelector('.main-scroll')?.scrollTo(0, 0);
  }, [route.pageId]);

  return (
    <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {!collapsed && <Sidebar />}
      {collapsed && sidebarPeek && (
        <div className="sidebar-peek-zone" onMouseLeave={() => useUI.getState().set({ sidebarPeek: false })}>
          <Sidebar floating />
        </div>
      )}
      {collapsed && <div className="sidebar-hover-edge" onMouseEnter={() => useUI.getState().set({ sidebarPeek: true })} />}
      <main className="main">
        <Topbar pageId={route.pageId && exists ? route.pageId : null} />
        <div className="main-row">
          <div className="main-scroll scroller">
            {route.pageId ? (
              exists ? (
                <PageView key={route.pageId} pageId={route.pageId} />
              ) : (
                <div className="page-missing">
                  <div className="pm-title">This page couldn’t be found</div>
                  <button className="btn-outline" onClick={() => goPage(null)}>
                    Back to Home
                  </button>
                </div>
              )
            ) : (
              <Home />
            )}
          </div>
          {commentsOpen && route.pageId && <CommentsPanel pageId={route.pageId} />}
          {route.peek && route.peekMode === 's' && <Peek key={route.peek} id={route.peek} mode="s" />}
        </div>
      </main>
      {route.peek && route.peekMode === 'c' && <Peek key={route.peek} id={route.peek} mode="c" />}
      <InboxPanel />
      <SearchModal />
      <SettingsModal />
      <TrashPopover />
      <TemplatesModal />
      <HistoryModal />
      <SlashMenu />
      <InlineMenus />
      <LinkPickerHost />
      <InlineToolbar />
      <BlockMenu />
      <Toast />
    </div>
  );
}

export { setPeek };
