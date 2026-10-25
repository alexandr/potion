// snotion.com: serves the Potion site (GitHub Pages at potion.page) under its own domain, so every deploy shows up here too.
const ORIGIN = 'https://potion.page';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname.startsWith('www.')) {
      return Response.redirect(`https://${url.hostname.slice(4)}${url.pathname}${url.search}`, 301);
    }
    const upstream = new Request(ORIGIN + url.pathname + url.search, request);
    const res = await fetch(upstream, { redirect: 'manual' });
    const headers = new Headers(res.headers);
    const loc = headers.get('location');
    if (loc && loc.startsWith(ORIGIN)) headers.set('location', loc.slice(ORIGIN.length) || '/');
    const out = new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    if (!(headers.get('content-type') || '').includes('text/html')) return out;
    // The app picks its name from the hostname; this covers what crawlers and link previews read from the HTML
    return new HTMLRewriter()
      .on('title', { text(t) { if (t.text) t.replace(t.text.replaceAll('Potion', 'Snotion')); } })
      .on('meta[name="description"]', { element(e) { e.setAttribute('content', (e.getAttribute('content') || '').replaceAll('Potion', 'Snotion')); } })
      .transform(out);
  },
};
