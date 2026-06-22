// /api/workshop — search Steam Workshop for Wallpaper Engine (appid 431960)
// Query params:
//   q        free-text (matched against titles client-side after browse fetch)
//   sort     trend | newest | rating (default trend)
//   page     1..n (Steam uses lettered pages)
//   limit    max items (default 24, max 64)
//   ids      comma-separated file ids (bypasses search, fetches each directly)

const { getHTML, getBuffer } = require('./lib/http');

const APPID = 431960;

function buildBrowseUrl({ sort = 'trend', page = 1 }) {
  const sortMap = {
    trend: { browsesort: 'trend', actualsort: 'trend', days: '365' },
    newest: { browsesort: 'mostrecent', actualsort: 'mostrecent' },
    rating: { browsesort: 'highestrated', actualsort: 'highestrated' },
    popular: { browsesort: 'mostpopular', actualsort: 'mostpopular' }
  };
  const s = sortMap[sort] || sortMap.trend;
  const params = new URLSearchParams({
    appid: String(APPID),
    adult: '1',
    p: String(page),
    ...s
  });
  return `https://steamcommunity.com/workshop/browse/?${params.toString()}`;
}

function parseBrowse(html) {
  // Each item: <a href="...filedetails/?id=XXX" ...><div ...><img src="UGC..." ...>
  // Image URL: https://images.steamusercontent.com/ugc/{id}/{hash}/?ima=fit&...&imw=288&imh=288
  const linkRe = /sharedfiles\/filedetails\/\?id=(\d+)[^"]*"/g;
  const ids = [...new Set([...html.matchAll(linkRe)].map(m => m[1]))];
  return ids;
}

function extractUgcPreview(html, itemId) {
  // Inside item block: search for UGC URL linked to this item
  const blockRe = new RegExp(`filedetails/\\?id=${itemId}[\\s\\S]{0,5000}`, 'i');
  const block = html.match(blockRe);
  if (!block) return null;
  const ugc = block[0].match(/https:\/\/images\.steamusercontent\.com\/ugc\/[A-F0-9]+\/[A-F0-9]+\//);
  return ugc ? ugc[0] : null;
}

async function fetchItemMeta(id) {
  const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`;
  try {
    const { status, html } = await getHTML(url);
    if (status !== 200) return null;
    // The workshopItemTitle is the bare title (e.g. "Fishing Frogs")
    const titleMatch = html.match(/class="workshopItemTitle"[^>]*>([^<]+)</);
    let title = titleMatch ? titleMatch[1].trim() : `Workshop ${id}`;
    // Try to extract author from "X by Y" pattern in titles
    let author = null;
    const byMatch = title.match(/^(.+?)\s+by\s+(.+)$/i);
    if (byMatch) {
      title = byMatch[1].trim();
      author = byMatch[2].trim();
    } else {
      // Fallback: check <title> for "X by Y"
      const pageTitleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (pageTitleMatch) {
        const tm = pageTitleMatch[1].match(/::(.+?)(?:\s+by\s+(.+))?$/);
        if (tm) {
          if (!title || title === `Workshop ${id}`) title = tm[1].trim();
          if (tm[2]) author = tm[2].trim();
        }
      }
    }
    // Find UGC preview URL
    const previewMatch = html.match(/https:\/\/images\.steamusercontent\.com\/ugc\/[A-F0-9]+\/[A-F0-9]+\//);
    let fullPreview = null;
    if (previewMatch) {
      fullPreview = `${previewMatch[0]}imw=1920&imh=1080&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=false`;
    }
    return {
      id,
      source: 'workshop',
      title,
      author,
      preview: fullPreview,
      page_url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`,
      download_url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`
    };
  } catch (e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const q = url.searchParams.get('q') || '';
    const sort = url.searchParams.get('sort') || 'trend';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '24', 10), 64);
    const idsParam = url.searchParams.get('ids');
    const idSingle = url.searchParams.get('id');

    if (idSingle) {
      const item = await fetchItemMeta(idSingle);
      if (!item) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'workshop item not found', id: idSingle }));
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, owner: '@zade4everbot', result: item }));
    }

    let ids = [];
    if (idsParam) {
      ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, limit);
    } else {
      const browseUrl = buildBrowseUrl({ sort, page });
      const { status, html } = await getHTML(browseUrl);
      if (status !== 200) {
        res.statusCode = status;
        return res.end(JSON.stringify({ error: 'workshop browse failed', status }));
      }
      ids = parseBrowse(html).slice(0, limit);
    }

    // Fetch each item in parallel (limited)
    const results = (await Promise.all(ids.map(fetchItemMeta))).filter(Boolean);

    // Free-text filter
    const filtered = q
      ? results.filter(r => r.title.toLowerCase().includes(q.toLowerCase()))
      : results;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify({
      ok: true,
      owner: '@zade4everbot',
      source: 'workshop',
      appid: APPID,
      query: { q, sort, page },
      total_results: results.length,
      returned: filtered.length,
      cached: false,
      results: filtered
    }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'internal error', message: e.message, owner: '@zade4everbot' }));
  }
};
