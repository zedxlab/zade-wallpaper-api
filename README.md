# zade-wallpaper-api

Unified wallpaper API combining multiple free wallpaper sources behind one Vercel edge function.

**Owner:** @zade4everbot
**Built by:** Zora AI by Zade

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/wallhaven?q=&limit=&purity=&sort=` | Search Wallhaven wallpapers (SFW, 4K, etc.) |
| `GET /api/wallhaven?id={id}` | Direct download from Wallhaven (jpg/png/webp) |
| `GET /api/wallpaperaccess?id={id}` | Direct download from WallpaperAccess CDN |
| `GET /api/workshop?sort=&limit=&q=` | Browse Steam Workshop (Wallpaper Engine appid 431960) |
| `GET /api/dl?source=wallhaven\|wallpaperaccess&id=...` | Unified download by source+id |
| `GET /api/dl?url={direct_url}` | Passthrough image proxy |
| `GET /` | Endpoint listing + usage examples |

## Local dev

```bash
npm install
node tests/local.js
```

## Deploy

```bash
vercel --prod
```

## Sources

- **Wallhaven** — best free wallpaper source. Search + direct download with referer.
- **WallpaperAccess** — direct CDN proxy. Their search page is Cloudflare-gated (TLS fingerprint blocks serverless), but image CDN endpoints are open.
- **Wallpaper Engine Steam Workshop** — animated & static wallpapers from appid 431960. We serve preview URLs and redirect to source for binary downloads (subscription required).

## Notes

- Unsplash + Pexels were the original plan but both are blocked by anti-bot challenges as of 2026-06-22 (Unsplash uses Anubis PoW; Pexels uses TLS fingerprinting). Replaced with the 3 working sources above.
- All responses include `owner: "@zade4everbot"` and `built_by: "Zora AI by Zade"`.
