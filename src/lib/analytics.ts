import { GA_MEASUREMENT_ID } from '../config';
import { getRoute, subscribeRoute, type Route } from './router';

type Gtag = (...args: unknown[]) => void;

// Page URLs and titles contain page names (document content), so GA only ever sees these generic values
function virtualPath(r: Route) {
  if (!r.pageId) return '/';
  return r.peek ? '/page/peek' : '/page';
}

export function initAnalytics() {
  const host = location.hostname.replace(/^www\./, '');
  const id = GA_MEASUREMENT_ID[host];
  // Not on localhost, previews or automated browsers (Playwright sets navigator.webdriver)
  if (!id || navigator.webdriver) return;

  const w = window as unknown as { dataLayer: unknown[]; gtag: Gtag };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() {
    // gtag.js expects the arguments object itself
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);

  const loc = (r: Route) => `${location.origin}${virtualPath(r)}`;
  w.gtag('js', new Date());
  w.gtag('config', id, {
    send_page_view: false,
    page_location: loc(getRoute()),
    page_title: 'Home',
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  let last = '';
  const send = () => {
    const r = getRoute();
    const key = `${r.pageId}|${r.peek}`;
    if (key === last) return;
    last = key;
    const path = virtualPath(r);
    const page = { page_location: `${location.origin}${path}`, page_path: path, page_title: path === '/' ? 'Home' : 'Page' };
    // 'set' also covers GA's automatic (enhanced measurement) events, which would otherwise read the real URL
    w.gtag('set', page);
    w.gtag('event', 'page_view', page);
  };
  send();
  subscribeRoute(send);
}
