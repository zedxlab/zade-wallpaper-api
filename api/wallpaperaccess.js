// /api/wallpaperaccess — direct image proxy for wallpaperaccess.com
// Their search page is behind Cloudflare bot protection (undici TLS fingerprint
// gets 403), but the /full/{id}.jpg CDN is open. So this endpoint is download-only
// when the user supplies an id from another source.
//
// Query params: id (numeric wallpaper id, required)

const { getBuffer } = require('./lib/http');

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id');
    if (!id) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        error: 'id is required (search is unsupported — site gates against serverless)',
        example: '/api/wallpaperaccess?id=12578',
        owner: '@zade4everbot'
      }));
    }
    if (!/^\d+$/.test(id)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'id must be numeric', owner: '@zade4everbot' }));
    }

    // Try both .jpg and .png (some are png)
    const candidates = [
      `https://wallpaperaccess.com/full/${id}.jpg`,
      `https://wallpaperaccess.com/full/${id}.png`
    ];
    for (const directUrl of candidates) {
      const { status, buffer, contentType } = await getBuffer(directUrl, {
        'Referer': 'https://wallpaperaccess.com/'
      });
      if (status === 200 && buffer.length > 1024) {
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType || 'image/jpeg');
        const ext = (contentType || '').includes('png') ? 'png' : 'jpg';
        res.setHeader('Content-Disposition', `attachment; filename="wallpaperaccess-${id}.${ext}"`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.end(buffer);
      }
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'wallpaperaccess fetch failed', id, owner: '@zade4everbot' }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'internal error', message: e.message, owner: '@zade4everbot' }));
  }
};
