# i-phones — iPhone store for Kenya

Static website: no database, no monthly server fees. Orders go to WhatsApp 0704 839 296.

## Update prices, colours or models
1. Edit `data/products.json` (prices, colours, specs, `"stock": false` for out-of-stock).
2. Edit `data/site.json` for the brand name, phone, shop address, hours, trust badges and delivery areas.
3. Rebuild: `python tools/build.py`

## Preview locally
`python -m http.server 8080`, then open http://localhost:8080

## Go live
Upload the whole folder (except `data/` and `tools/` if you like) to any static host:
Netlify, Cloudflare Pages, Vercel or cPanel hosting. Then:
- Set your real domain in `data/site.json` → `siteUrl` and rebuild (canonical URLs, sitemap and schema use it).
- Submit `https://your-domain/sitemap.xml` in Google Search Console.
- Create a Google Business Profile for the shop with the same name, phone and address.

Wallpapers can be regenerated with `python tools/wallpapers.py` (needs Pillow).

## Order emails
Every "Order on WhatsApp" tap also POSTs to `api/order.js`, which emails a copy of the order.
SMTP login and the recipient address are Vercel environment variables (Project → Settings →
Environment Variables): `SMTP_HOST`, `SMTP_SERVERNAME`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`ORDER_EMAIL_TO`, `SITE_URL`. Never put the password in this repo; it is public.
After changing a variable, redeploy for it to take effect.
