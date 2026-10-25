# Potion / Snotion: scale and analytics (2026-10-25)

## 1. Scale: no server, so no resize

Potion is static and local-first. Each visitor's workspace lives in their own browser (localStorage); there is no
backend, database, VM, sign-up or demo reset to load. Concurrency is the CDN's job, so I checked the CDN setup and
skipped the resize and load test. Monthly cost stays **$0**.

| Site | Served by | Compression | Cache |
|---|---|---|---|
| potion.page | GitHub Pages (Fastly CDN) | gzip | `max-age=600` on everything (GitHub's fixed value) |
| snotion.com | Cloudflare Worker in front of potion.page | brotli (HTML), gzip | Hashed `/assets/*`: cached for a year at Cloudflare's edge, plus `immutable` in browsers (`cf-cache-status: HIT`). HTML: 5 min at the edge |

A visit downloads one HTML file and the hashed JS/CSS once. Editing never touches the network, so 3,000 concurrent
visitors cost the same as 3. Only the first load hits the CDN.

## 2. Google Analytics 4: hook live, waiting for IDs

- **Config:** `src/config.ts` has one `GA_MEASUREMENT_ID` per site (`potion.page`, `snotion.com`), both empty for
  now. Adding an ID is a one-line change; push to `main` and both sites redeploy.
- **When it loads:** gtag.js loads only when the current site has an ID. It never loads on localhost or in
  automated browsers (Playwright tests).
- **Page views:** sent on every SPA route change.
- **Privacy:** Potion's URLs and tab titles contain page names, so GA only ever gets generic values: path `/`,
  `/page` or `/page/peek`, title "Home" or "Page". These are also pinned with `gtag('set')`, so GA's automatic
  events use them too. Google signals and ad personalization are off. No names, emails or document content are
  sent.
- **Verified:**
  - A test build with a fake ID loaded gtag once and sent `page_view` with `/` and then `/page`.
  - Automated browsers loaded nothing.
  - Both live sites currently load nothing, because no ID is set.
- **When you add the IDs:** in each GA4 data stream, turn off Enhanced measurement's outbound-click and site-search
  events. Outbound clicks would report the URLs of links people put in their pages.
