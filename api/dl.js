// Unified /api/dl — download wallpaper from any supported source
// Query: ?source=wallhaven|wallpaperaccess|workshop&id=...
//        OR  ?url=<full direct image url>  (passthrough proxy)

const { getBuffer, getHTML } = require('./lib/http');

const SOURCES = {
  wallhaven: async (id) => {
    if (!/^[a-z0-9]+$/.test(id)) throw new Error('invalid wallhaven id');
    const first2 = id.slice(0, 2);
    return [
      `https://w.wallhaven.cc/full/${first2}/wallhaven-${id}.jpg`,
      `https://w.wallhaven.cc/full/${first2}/wallhaven-${id}.png`,
      `https://w.wallhaven.cc/full/${first2}/wallhaven-${id}.webp`
    ];
  },
  wallpaperaccess: (id) => {
    if (!/^\d+$/.test(id)) throw new Error('invalid wallpaperaccess id');
    return [
      `https://wallpaperaccess.com/full/${id}.jpg`,
      `https://wallpaperaccess.com/full/${id}.png`
    ];
  },
  workshop: async (id) => {
    // Workshop items are large binaries behind subscription — we just redirect to source page
    return null;
  }
};

const REFERRERS = {
  wallhaven: 'https://wallhaven.cc/',
  wallpaperaccess: 'https://wallpaperaccess.com/'
};

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const source = url.searchParams.get('source');
    const id = url.searchParams.get('id');
    const direct = url.searchParams.get('url');

    // Passthrough mode
    if (direct) {
      const target = direct;
      const { status, buffer, contentType } = await getBuffer(target);
      if (status !== 200) {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'direct fetch failed', status }));
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(buffer);
    }

    if (!source || !id) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        error: 'missing source or id',
        usage: '?source=wallhaven&id=9mjoyk OR ?source=wallpaperaccess&id=12578 OR ?url=<direct>',
        sources: Object.keys(SOURCES),
        owner: '@zade4everbot'
      }));
    }

    const resolver = SOURCES[source];
    if (!resolver) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'unknown source', source, allowed: Object.keys(SOURCES) }));
    }

    const targets = await resolver(id);
    if (!targets) {
      res.statusCode = 302;
      res.setHeader('Location', `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end();
    }
    const candidates = Array.isArray(targets) ? targets : [targets];
    const referrer = REFERRERS[source];
    const headers = referrer ? { 'Referer': referrer } : {};
    for (const target of candidates) {
      const { status, buffer, contentType } = await getBuffer(target, headers);
      if (status === 200 && buffer.length > 1024) {
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType || 'image/jpeg');
        const ext = (contentType || '').includes('png') ? 'png'
                  : (contentType || '').includes('webp') ? 'webp' : 'jpg';
        res.setHeader('Content-Disposition', `attachment; filename="${source}-${id}.${ext}"`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.end(buffer);
      }
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `${source} fetch failed (all candidates)`, tried: candidates, owner: '@zade4everbot' }));
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'bad request', message: e.message, owner: '@zade4everbot' }));
  }
};
