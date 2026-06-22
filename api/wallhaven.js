// /api/wallhaven — search wallhaven.cc wallpapers
// Query params:
//   q      search keywords
//   page   page number (default 1)
//   limit  max results (default 24, max 64)
//   purity 100 (SFW only by default), 110 (SFW+sketchy)
//   sort   relevance | date | views | favorites | toplist (default relevance)
//   atleast 1920x1080 etc. (optional)

const { getHTML, getBuffer } = require('./lib/http');

const DEFAULT_PURITY = '100';

function buildSearchUrl({ q = '', page = 1, purity = DEFAULT_PURITY, sort = 'relevance', atleast = '' }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('page', String(page));
  params.set('purity', purity);
  if (sort) params.set('sorting', sort);
  params.set('order', 'desc');
  if (atleast) params.set('atleast', atleast);
  return `https://wallhaven.cc/search?${params.toString()}`;
}

function parseSearch(html) {
  // Wallhaven puts thumb URLs in src/data-src as https://th.wallhaven.cc/small/{a}/{a}{rest}.jpg
  const thumbs = [...html.matchAll(/https:\/\/th\.wallhaven\.cc\/small\/([a-z0-9]{2})\/([a-z0-9]+)\.jpg/g)];
  const seen = new Set();
  const results = [];
  for (const m of thumbs) {
    const first = m[1];
    const id = m[2];
    if (seen.has(id)) continue;
    seen.add(id);
    // Pull title context near the thumb (look back a few chars)
    const idx = m.index;
    const ctxStart = Math.max(0, idx - 600);
    const ctx = html.slice(ctxStart, idx);
    const titleMatches = ctx.match(/alt="([^"]+)"/g) || ctx.match(/title="([^"]+)"/g);
    let lastTitle = `wallhaven-${id}`;
    if (titleMatches) {
      const last = titleMatches[titleMatches.length - 1];
      lastTitle = last.replace(/^(alt|title)="/, '').replace(/"$/, '').trim();
      if (!lastTitle) lastTitle = `wallhaven-${id}`;
    }
    // Search HTML is lazy-loaded — titles aren't inline. Use id-derived title;
    // resolve full title on individual /?id= requests by fetching the page.
    results.push({
      id,
      source: 'wallhaven',
      title: `wallhaven-${id}`,
      thumb: `https://th.wallhaven.cc/small/${first}/${id}.jpg`,
      full_url: `https://w.wallhaven.cc/full/${first}/wallhaven-${id}.jpg`,
      page_url: `https://wallhaven.cc/w/${id}`
    });
  }
  return results;
}

function parseWallpaperPage(html, id) {
  // Single wallpaper page has a single "wallpaper-..." filename and tags in alt.
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const tags = [...html.matchAll(/"tag_name":"([^"]+)"/g)].map(m => m[1]);
  const first2 = id.slice(0, 2);
  return {
    id,
    source: 'wallhaven',
    title: titleMatch ? titleMatch[1].replace(/ - Wallhaven$/, '').trim() : `wallhaven-${id}`,
    tags,
    full_url: `https://w.wallhaven.cc/full/${first2}/wallhaven-${id}.jpg`,
    page_url: `https://wallhaven.cc/w/${id}`
  };
}

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const q = url.searchParams.get('q') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '24', 10), 64);
    const purity = url.searchParams.get('purity') || DEFAULT_PURITY;
    const sort = url.searchParams.get('sort') || 'relevance';
    const atleast = url.searchParams.get('atleast') || '';
    const id = url.searchParams.get('id');
    const download = url.searchParams.get('download');

    // Direct download by id — try common extensions in order (wallhaven can be png or jpg)
    if (id) {
      const first2 = id.slice(0, 2);
      const candidates = [
        `https://w.wallhaven.cc/full/${first2}/wallhaven-${id}.jpg`,
        `https://w.wallhaven.cc/full/${first2}/wallhaven-${id}.png`,
        `https://w.wallhaven.cc/full/${first2}/wallhaven-${id}.webp`
      ];
      const headers = { 'Referer': 'https://wallhaven.cc/' };
      for (const directUrl of candidates) {
        const { status, buffer, contentType } = await getBuffer(directUrl, headers);
        if (status === 200 && buffer.length > 1024) {
          res.statusCode = 200;
          res.setHeader('Content-Type', contentType || 'image/jpeg');
          const ext = (contentType || '').includes('png') ? 'png'
                    : (contentType || '').includes('webp') ? 'webp' : 'jpg';
          res.setHeader('Content-Disposition', `attachment; filename="wallhaven-${id}.${ext}"`);
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.end(buffer);
        }
      }
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'wallhaven fetch failed', id, owner: '@zade4everbot' }));
    }

    // Search
    const searchUrl = buildSearchUrl({ q, page, purity, sort, atleast });
    const { status, html } = await getHTML(searchUrl);
    if (status !== 200) {
      res.statusCode = status;
      return res.end(JSON.stringify({ error: 'wallhaven search failed', status }));
    }
    const all = parseSearch(html);
    const results = all.slice(0, limit);
    const payload = {
      ok: true,
      owner: '@zade4everbot',
      source: 'wallhaven',
      query: { q, page, purity, sort, atleast },
      total_results: all.length,
      returned: results.length,
      cached: false,
      results
    };
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(payload));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'internal error', message: e.message, owner: '@zade4everbot' }));
  }
};
