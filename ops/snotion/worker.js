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
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
