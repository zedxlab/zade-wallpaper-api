// GET / — landing page listing all endpoints + usage examples
module.exports = function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify({
    ok: true,
    name: 'zade-wallpaper-api',
    version: '1.0.0',
    owner: '@zade4everbot',
    built_by: 'Zora AI by Zade',
    endpoints: {
      '/api/wallhaven': {
        description: 'Search wallhaven.cc wallpapers (best free source)',
        params: ['q (search)', 'page (1..n)', 'limit (max 64)', 'purity (100=SFW)', 'sort (relevance|date|views|favorites|toplist)', 'atleast (e.g. 1920x1080)'],
        example: '/api/wallhaven?q=anime%20sunset&limit=10&purity=100'
      },
      '/api/wallpaperaccess': {
        description: 'Direct image download from wallpaperaccess.com (search gated by Cloudflare; use IDs from their site)',
        params: ['id (numeric wallpaper id, required)'],
        example: '/api/wallpaperaccess?id=12578'
      },
      '/api/workshop': {
        description: 'Browse Steam Workshop for Wallpaper Engine (appid 431960)',
        params: ['q (text filter, optional)', 'sort (trend|newest|rating|popular)', 'page', 'limit'],
        example: '/api/workshop?sort=trend&limit=15'
      },
      '/api/dl': {
        description: 'Direct-download wallpaper image by source+id (or full URL)',
        params: ['source (wallhaven|wallpaperaccess)', 'id', 'OR url (full direct image URL)'],
        example: '/api/dl?source=wallhaven&id=j37zv5'
      }
    },
    notes: {
      'Unsplash + Pexels': 'blocked by anti-bot challenges (Anubis + fingerprint) as of 2026-06-22 — replaced with Wallhaven (search+dl), Workshop (search+preview), WallpaperAccess (direct dl only)',
      'Workshop downloads': 'binary wallpaper files require Steam subscription — we redirect to source page, do not proxy the binary'
    }
  }, null, 2));
};
