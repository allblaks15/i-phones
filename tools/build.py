"""Build the static i-phones website.

Edit data/products.json (prices, colours, specs) or data/site.json (brand, phone,
address, trust badges), then run:   python tools/build.py
Everything in the project root (index.html, model folders, sitemap.xml ...) is regenerated.
"""
import json, os, re, html, datetime, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = json.load(open(os.path.join(ROOT, "data", "site.json"), encoding="utf-8"))
PRODUCTS = json.load(open(os.path.join(ROOT, "data", "products.json"), encoding="utf-8"))
URL = SITE["siteUrl"].rstrip("/")
TODAY = datetime.date.today().isoformat()
WALLS = [
    ("cosmic-orange", "Cosmic Orange"), ("deep-blue", "Deep Blue"), ("burgundy", "Burgundy"),
    ("glacier", "Glacier"), ("sage", "Sage"), ("lavender", "Lavender"),
    ("desert-titanium", "Desert Titanium"), ("midnight", "Midnight"), ("champagne-gold", "Champagne Gold"),
    ("savanna-dusk", "Savanna Dusk"), ("ocean-mombasa", "Mombasa Ocean"), ("graphite", "Graphite"),
]
COND = {"new": "Brand New", "refurb": "Ex-UK (Refurbished)"}
SIM = {"dual": "Physical SIM + eSIM", "esim": "eSIM only", None: "—"}
STORAGE_ORDER = {"64GB": 0, "128GB": 1, "256GB": 2, "512GB": 3, "1TB": 4, "2TB": 5}

e = lambda s: html.escape(str(s), quote=True)
def ksh(n): return "Price on request" if n is None else f"KSh {n:,}"
def wa(text):
    from urllib.parse import quote
    return f"https://wa.me/{SITE['whatsapp']}?text={quote(text)}"

ICONS = {
    "wa": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.43 9.43 0 0 1-4.8-1.31l-.35-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.68c0 5.2-4.24 9.43-9.44 9.43zm8.03-17.46A11.3 11.3 0 0 0 12.05.7C5.79.7.7 5.79.7 12.04c0 2 .52 3.95 1.52 5.67L.6 23.3l5.72-1.5a11.3 11.3 0 0 0 5.42 1.38h.01c6.25 0 11.34-5.09 11.35-11.34 0-3.03-1.18-5.88-3.32-8.02z"/></svg>',
    "shield": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
    "truck": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
    "map": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6-5.3-6-10.5A6 6 0 0 1 18 10.5C18 15.7 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/></svg>',
    "card": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/></svg>',
    "badge": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5"/></svg>',
    "chip": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>',
    "display": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 5h3"/></svg>',
    "camera": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    "battery": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M22 10.5v3M6 10v4M9.5 10v4M13 10v4"/></svg>',
    "bag": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9L5 8z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/></svg>',
    "store": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9.5 20v-5h5v5"/></svg>',
    "menu": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>',
    "close": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    "download": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    "apple": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M12 2l2.6 6.4L21 9l-5 4.3L17.5 20 12 16.6 6.5 20 8 13.3 3 9l6.4-.6z"/></svg>',
}
HL_ICONS = ["chip", "display", "camera", "battery"]

# ---------- product helpers ----------
def avail(v): return v.get("price") is not None and v.get("stock", True) is not False
def from_price(p):
    vs = [v for v in p["variants"] if avail(v)] or [v for v in p["variants"] if v.get("price")]
    return min(v["price"] for v in vs) if vs else None
def max_price(p):
    vs = [v["price"] for v in p["variants"] if v.get("price")]
    return max(vs) if vs else None
def in_stock(p): return any(avail(v) for v in p["variants"])
def conds(p): return sorted({v["cond"] for v in p["variants"]})
def cond_label(p):
    c = conds(p)
    return "New & Ex-UK" if len(c) > 1 else COND[c[0]]
CONN = {"wifi": "Wi-Fi", "5g": "Wi-Fi + 5G", None: "—"}
def is_ipad(p): return p.get("category") == "ipad"
def series_label(p): return "iPad" if is_ipad(p) else f"iPhone {p['series']} series"
def img(p, i=1): return f"images/phones/{p['slug']}-{i}.webp"

def layout(*, base, title, desc, path, body, schema, og_image, page_js="", robots="index,follow", og_type="website", extra_head=""):
    canonical = f"{URL}/{path}"
    schema_tags = "\n".join(f'<script type="application/ld+json">{json.dumps(s, ensure_ascii=False)}</script>' for s in schema)
    site_js = json.dumps({k: SITE[k] for k in ("brand", "whatsapp", "siteUrl", "shopCity", "shopAddress", "shopContact", "phoneDisplay", "deliveryAreas")}, ensure_ascii=False)
    products_js = json.dumps([{k: p.get(k) for k in ("slug", "name", "colors", "variants", "preorder")} for p in PRODUCTS], ensure_ascii=False, separators=(",", ":"))
    return f"""<!doctype html>
<html lang="en-KE" data-base="{base}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{canonical}">
<meta name="robots" content="{robots}">
<meta name="theme-color" content="#f5f5f3">
<meta name="geo.region" content="KE-30">
<meta name="geo.placename" content="{e(SITE['shopCity'])}">
<link rel="alternate" hreflang="en-KE" href="{canonical}">
<meta property="og:type" content="{og_type}">{extra_head}
<meta property="og:site_name" content="{e(SITE['brand'])}">
<meta property="og:locale" content="en_KE">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{URL}/{og_image}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{base}assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{base}assets/icon-192.png">
<link rel="manifest" href="{base}manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{base}assets/style.css">
{schema_tags}
</head>
<body>
<div class="announce">{e(SITE['announcement']).replace(e(SITE['phoneDisplay']), '<b>' + e(SITE['phoneDisplay']) + '</b>')}</div>
{header(base)}
<main id="main">
{body}
</main>
{footer(base)}
<a class="shop-fab" href="{'#shop' if base == '' else base + '#shop'}" aria-label="Shop iPhones"><span class="fab-icon">{ICONS['bag']}</span><span class="fab-text"><b>Shop iPhones</b><small>from {ksh(min(from_price(p) for p in PRODUCTS if in_stock(p)))}</small></span></a>
<div class="inv-modal" id="invoice" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Your invoice">
  <div class="modal-bg" data-inv-close></div>
  <div class="inv-wrap"><div class="inv-card"><button class="modal-close" data-inv-close aria-label="Close invoice">{ICONS['close']}</button><div class="inv"></div></div></div>
</div>
<div class="modal" id="quick-order" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Quick order">
  <div class="modal-bg" data-close></div>
  <div class="modal-panel">
    <button class="modal-close" data-close aria-label="Close">{ICONS['close']}</button>
    <div class="qo-head"></div>
    <div class="qo-price"></div>
    <div class="qo-body"></div>
  </div>
</div>
<script>window.SITE={site_js};window.PRODUCTS={products_js};{page_js}</script>
<script src="{base}assets/app.js" defer></script>
</body>
</html>
"""

def header(base):
    links = [("#shop" if base == "" else base + "#shop", "Shop"), (base + "iphone-18-pro-max/", "iPhone 18"),
             (base + "iphone-17-pro-max/", "iPhone 17"), (base + "blog/", "Blog"), (base + "wallpapers/", "Wallpapers"),
             ("#faq" if base == "" else base + "#faq", "FAQ")]
    nav = "".join(f'<a href="{h}">{t}</a>' for h, t in links)
    return f"""<header class="header"><div class="wrap">
<a class="logo" href="{base or './'}" aria-label="{e(SITE['brand'])} home"><span class="logo-mark">{ICONS['apple']}</span><span>{e(SITE['brandShort'])}<small>Kenya</small></span></a>
<nav class="nav" aria-label="Main">{nav}</nav>
<a class="btn btn-wa btn-sm header-cta" href="{wa('Hello ' + SITE['brand'] + ', I would like to buy an iPhone.')}" target="_blank" rel="noopener">{ICONS['wa']}{e(SITE['phoneDisplay'])}</a>
<button class="menu-btn" data-menu aria-label="Open menu">{ICONS['menu']}</button>
</div></header>
<div class="drawer" id="drawer"><div style="display:flex;justify-content:space-between;align-items:center">
<a class="logo" href="{base or './'}"><span class="logo-mark">{ICONS['apple']}</span><span>{e(SITE['brandShort'])}<small>Kenya</small></span></a>
<button class="modal-close" data-menu-close aria-label="Close menu">{ICONS['close']}</button></div>
<nav>{nav}</nav>
<a class="btn btn-wa btn-block" style="margin-top:auto" href="{wa('Hello ' + SITE['brand'] + ', I would like to buy an iPhone.')}" target="_blank" rel="noopener">{ICONS['wa']}WhatsApp {e(SITE['phoneDisplay'])}</a>
</div>"""

def footer(base):
    series = "".join(f'<li><a href="{base}{p["slug"]}/">{e(p["name"])} price</a></li>' for p in PRODUCTS if p["slug"] in
                     ("iphone-18-pro-max", "iphone-18-pro", "iphone-17-pro-max", "iphone-17", "iphone-16-pro-max", "iphone-15-pro-max", "iphone-14-pro-max", "iphone-13"))
    return f"""<footer class="footer"><div class="wrap">
<div class="footer-grid">
<div><a class="logo" href="{base or './'}"><span class="logo-mark">{ICONS['apple']}</span><span>{e(SITE['brandShort'])}<small style="color:#77777e">Kenya</small></span></a>
<p style="max-width:320px;margin:0 0 14px">{e(SITE['tagline'])}</p>
<p style="margin:0"><b style="color:#fff">WhatsApp / Call:</b> <a href="tel:{SITE['phoneIntl']}">{e(SITE['phoneDisplay'])}</a><br>{e(SITE['shopAddress'])} (ask for {e(SITE['shopContact'])})<br>Visit us to pick &amp; pay<br>{e(SITE['shopHours'])}</p></div>
<div><h4>Popular</h4><ul>{series}</ul></div>
<div><h4>Shop</h4><ul>
<li><a href="{base}?series=18#shop">iPhone 18 series</a></li><li><a href="{base}?series=17#shop">iPhone 17 series</a></li>
<li><a href="{base}?series=16#shop">iPhone 16 series</a></li><li><a href="{base}?series=15#shop">iPhone 15 series</a></li>
<li><a href="{base}?series=14#shop">iPhone 14 series</a></li><li><a href="{base}?series=13#shop">iPhone 13 series</a></li><li><a href="{base}?series=12#shop">iPhone 12 series</a></li><li><a href="{base}?series=ipad#shop">iPads</a></li>
<li><a href="{base}?budget=under-80k#shop">iPhones under 80K</a></li><li><a href="{base}blog/">iPhone guides &amp; blog</a></li><li><a href="{base}wallpapers/">Free iPhone wallpapers</a></li></ul></div>
<div><h4>We deliver to</h4><p class="areas">{e(', '.join(SITE['deliveryAreas']))} and all 47 counties.</p></div>
</div>
<div class="footer-bottom"><span>© {datetime.date.today().year} {e(SITE['brand'])}. Prices in Kenya Shillings, updated {e(SITE['pricesUpdated'])}. Prices may change, so confirm on WhatsApp.</span>
<span>iPhone is a trademark of Apple Inc. {e(SITE['brand'])} is an independent reseller.</span></div>
</div></footer>"""

def card(p, base, order):
    fp = from_price(p)
    dots = "".join(f'<span class="dot" style="background:{c["hex"]}" title="{e(c["name"])}"></span>' for c in p["colors"][:6])
    badge = ""
    if p.get("badge"):
        cls = "green" if p["badge"] in ("Best value", "Lowest price") else ("gold" if p["badge"] in ("Just launched", "Pre-order") else "")
        badge = f'<span class="badge {cls}">{e(p["badge"])}</span>'
    c = conds(p)
    stock = "" if in_stock(p) else '<span class="oos">On request</span>'
    return f"""<article class="card reveal" data-series="{p['series']}" data-price="{fp or 0}" data-conds="{' '.join(c)}" data-year="{p['year']}" data-order="{order}">
<a class="card-media" href="{base}{p['slug']}/">{badge}<img src="{base}{img(p)}" alt="{e(p['name'])} price in Kenya" width="400" height="400" loading="{'eager' if order < 4 else 'lazy'}" decoding="async"></a>
<span class="cond {'new' if 'new' in c else ''}">{e(cond_label(p))}</span>
<h3><a href="{base}{p['slug']}/">{e(p['name'])}</a></h3>
<p class="tag">{e(p['tagline'])}</p>
<div class="dots" aria-label="{len(p['colors'])} colours">{dots}</div>
<div class="card-foot"><div class="price"><small>From</small><b>{ksh(fp)}</b></div>{stock}</div>
<div class="card-actions"><a class="btn btn-ghost" href="{base}{p['slug']}/">Specs</a><a class="btn btn-wa" href="{base}{p['slug']}/" data-quick="{p['slug']}">{ICONS['wa']}Order</a></div>
</article>"""

def org_schema():
    return {
        "@context": "https://schema.org", "@type": "MobilePhoneStore", "@id": URL + "/#store",
        "name": SITE["brand"], "url": URL + "/", "telephone": SITE["phoneIntl"], "image": f"{URL}/images/og.jpg",
        "priceRange": "KSh 46,000 – KSh 500,000", "currenciesAccepted": "KES", "paymentAccepted": "Cash, M-Pesa",
        "address": {"@type": "PostalAddress", "streetAddress": SITE["shopAddress"], "addressLocality": SITE["shopCity"], "addressCountry": "KE"},
        "areaServed": {"@type": "Country", "name": "Kenya"},
        "openingHours": ["Mo-Sa 08:30-19:00", "Su 11:00-17:00"],
        "contactPoint": {"@type": "ContactPoint", "telephone": SITE["phoneIntl"], "contactType": "sales", "areaServed": "KE", "availableLanguage": ["English", "Swahili"]},
    }

def faq_schema(items):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in items]}

def faq_html(items):
    return "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in items)

HOME_FAQ = [
    ("How do I order an iPhone from " + SITE["brand"] + "?", f"Pick your iPhone, colour and storage, choose delivery or shop pickup, then tap 'Order on WhatsApp'. You get an invoice on WhatsApp ({SITE['phoneDisplay']}), we confirm availability within minutes, and you visit our shop to pick and pay or we deliver."),
    ("Do you deliver iPhones outside Nairobi?", "Yes. We deliver countrywide by courier to Mombasa, Kisumu, Nakuru, Eldoret, Nyeri, Machakos and all 47 counties, usually within 24 hours. Nairobi orders placed before 3pm are delivered the same day."),
    ("Can I pick up and pay at your shop?", f"Yes. Visit our shop at {SITE['shopAddress']} and ask for {SITE['shopContact']}. Inspect your iPhone, pay, and take it home. Order on WhatsApp first so we have it ready for you."),
    ("Are your iPhones original?", "Yes. We sell only genuine Apple iPhones. Every phone is IMEI-checked, and brand-new units come sealed in the original box."),
    ("What is the difference between Brand New and Ex-UK iPhones?", "Brand New iPhones are sealed and unused. Ex-UK (refurbished) iPhones are pre-owned phones from the UK, tested and graded, and they cost much less. We tell you the battery health before you buy."),
    ("Should I choose eSIM only or Physical SIM + eSIM?", "Safaricom and Airtel Kenya both support eSIM. If you want to keep using a normal SIM card, choose the Physical SIM + eSIM version. eSIM-only models are usually a little cheaper."),
    ("Can I pick up my iPhone from your shop?", f"Yes. Choose 'Shop pickup' when ordering and collect your iPhone at {SITE['shopAddress']}. Ask for {SITE['shopContact']}."),
    ("Do your iPhones come with a warranty?", "Yes, every iPhone comes with warranty. The cover depends on the model and condition, and we confirm the exact terms on WhatsApp before you pay."),
]

# ---------- pages ----------
SERIES_GUIDE = {18: "latest-iphone-price-in-kenya", 17: "latest-iphone-price-in-kenya", 16: "iphone-16-price-in-kenya", 15: "iphone-15-price-in-kenya",
                14: "iphone-14-pro-max-price-in-kenya", 13: "iphone-13-pro-max-price-in-kenya", 12: "iphone-12-pro-max-price-in-kenya", 11: "iphone-11-price-in-kenya"}

def series_rows():
    """One row per iPhone series 18..11: (series, models, from price, in stock?)."""
    rows = []
    for n in range(18, 10, -1):
        ps = [p for p in PRODUCTS if p.get("series") == n]
        stocked = [p for p in ps if in_stock(p)]
        price = min((from_price(p) for p in (stocked or ps) if from_price(p)), default=None)
        rows.append((n, ps, price, bool(stocked)))
    return rows

def series_table():
    body = ""
    for n, ps, price, stocked in series_rows():
        models = ", ".join(f'<a href="{p["slug"]}/">{e(p["name"])}</a>' for p in ps) or "iPhone 11, 11 Pro, 11 Pro Max"
        guide = f'<a href="blog/{SERIES_GUIDE[n]}/">iPhone {n} price guide</a>'
        if not ps:
            cell, status = "Not stocked", "Market prices in guide"
        else:
            cell, status = f"<b>{ksh(price)}</b>", ("In stock" if stocked else "On request")
        body += f"<tr><td><b>iPhone {n}</b></td><td>{models}</td><td>{cell}</td><td>{status}</td><td>{guide}</td></tr>"
    return f'<div class="table-wrap"><table class="price-table"><thead><tr><th>Series</th><th>Models</th><th>From</th><th>Stock</th><th>Guide</th></tr></thead><tbody>{body}</tbody></table></div>'

def build_home():
    base = ""
    parts = []
    for n, ps, price, stocked in series_rows():
        if ps and price:
            parts.append(f"iPhone {n} from {ksh(price)}" + ("" if stocked else " (on request)"))
    home_faq = [("How much are iPhones in Kenya?",
                 "Our latest iPhone prices in Kenya: " + "; ".join(parts) + f". The iPhone 11 is not in our stock; see our iPhone 11 price guide for market prices. Prices were last updated on {SITE['pricesUpdated']}.")] + HOME_FAQ
    hero = next(p for p in PRODUCTS if p["slug"] == "iphone-18-pro-max")
    lowest = min(from_price(p) for p in PRODUCTS if from_price(p) and in_stock(p))
    cards = "\n".join(card(p, base, i + (0 if in_stock(p) else 1000)) for i, p in enumerate(PRODUCTS))
    series_chips = '<button class="chip" data-filter="series:all" aria-pressed="true">All iPhones</button>' + "".join(
        f'<button class="chip" data-filter="series:{s}" aria-pressed="false">iPhone {s}</button>' for s in (18, 17, 16, 15, 14, 13, 12)) + '<button class="chip" data-filter="series:ipad" aria-pressed="false">iPad</button>'
    trust = "".join(f'<div class="trust-item">{ICONS[t["icon"]]}<div><b>{e(t["title"])}</b><span>{e(t["text"])}</span></div></div>' for t in SITE["trust"])
    walls = "".join(f'<a class="wall reveal" href="wallpapers/#{s}"><img src="images/wallpapers/{s}-thumb.webp" alt="{e(n)} iPhone wallpaper" width="360" height="780" loading="lazy"><span class="wall-time">9:41</span><span class="wall-name">{e(n)}{ICONS["download"]}</span></a>' for s, n in WALLS[:6])
    sample = f"""🧾 <b>INVOICE IPH-261007-K7QD</b>
📱 <b>iPhone 17 Pro Max</b> · Cosmic Orange · 256GB
💰 <b>Total: KSh 180,000</b>
🏬 I'll visit your shop to pick &amp; pay.
📞 Call me on: 0712 345 678

📍 <b>Visit our shop to pick &amp; pay:</b>
{e(SITE['shopAddress'])}
Ask for {e(SITE['shopContact'])}"""
    body = f"""
<section class="hero"><div class="wrap">
  <div>
    <span class="eyebrow">iPhone 11 · 12 · 13 · 14 · 15 · 16 · 17 · 18</span>
    <h1>iPhone prices <br>in <span class="serif">Kenya.</span></h1>
    <p class="lead">Latest prices in Kenya Shillings for the iPhone 12, 13, 14, 15, 16, 17 and the new iPhone 18, plus iPads. Brand new and Ex-UK. Visit our Nairobi shop to pick and pay, or order on WhatsApp in under a minute.</p>
    <div class="hero-price"><span class="from">iPhones from</span><strong>{ksh(lowest)}</strong></div>
    <div class="hero-ctas">
      <a class="btn btn-wa" href="#shop">{ICONS['wa']}Shop &amp; order</a>
      <a class="btn btn-ghost" href="{hero['slug']}/">Explore iPhone 18 Pro Max</a>
    </div>
    <div class="hero-stats"><div><b>{len(PRODUCTS)}</b>iPhone &amp; iPad models</div><div><b>Same-day</b>Nairobi delivery</div><div><b>47</b>counties served</div></div>
  </div>
  <a class="hero-visual" href="{hero['slug']}/" aria-label="iPhone 18 Pro Max"><img src="{img(hero)}" alt="iPhone 18 Pro Max in Burgundy, price in Kenya" width="800" height="800" fetchpriority="high"></a>
</div></section>

<section class="trust"><div class="wrap"><div class="trust-row">{trust}</div></div></section>

<section class="section" id="shop"><div class="wrap">
  <div class="section-head"><div><span class="eyebrow">Shop iPhones</span><h2>Find your iPhone.</h2><p>Latest iPhone prices in Kenya, updated {e(SITE['pricesUpdated'])}. Tap any phone for full specs, colours and storage options.</p></div></div>
  <div class="filters">
    <div class="chips" role="group" aria-label="Filter by series">{series_chips}</div>
    <div class="chips" role="group" aria-label="Filter by condition">
      <button class="chip" data-filter="cond:all" aria-pressed="true">Any condition</button>
      <button class="chip" data-filter="cond:new" aria-pressed="false">Brand new</button>
      <button class="chip" data-filter="cond:refurb" aria-pressed="false">Ex-UK</button>
    </div>
    <label class="sr-only" for="sort">Sort</label>
    <select id="sort"><option value="featured">Featured</option><option value="newest">Newest first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select>
  </div>
  <div class="grid" id="grid">{cards}<p class="empty" id="empty" hidden>No iPhones match those filters. <button class="link-arrow" data-filter="series:all">Show all →</button></p></div>
</div></section>

<section class="section" style="padding-top:0"><div class="wrap">
  <div class="section-head"><div><span class="eyebrow">Shop by budget</span><h2>An iPhone for every budget.</h2></div></div>
  <div class="budget">
    <a href="?budget=under-80k#shop" data-filter="budget:under-80k" class="reveal"><div><small>Under KSh 80K</small><h3>Smart &amp; affordable</h3></div><p>iPhone 12 Pro, 12 Pro Max, 13 and 13 Pro.</p><span class="go">Shop now →</span></a>
    <a href="?budget=80k-150k#shop" data-filter="budget:80k-150k" class="reveal"><div><small>KSh 80K – 150K</small><h3>The sweet spot</h3></div><p>iPhone 14 Pro, 15 Pro Max, iPad Air, iPad mini and more.</p><span class="go">Shop now →</span></a>
    <a href="?budget=over-150k#shop" data-filter="budget:over-150k" class="reveal"><div><small>KSh 150K+</small><h3>The very best</h3></div><p>iPhone 17 Pro, 17 Pro Max, 18 Pro, 18 Pro Max and iPad Pro.</p><span class="go">Shop now →</span></a>
  </div>
</div></section>

<section class="section dark"><div class="wrap">
  <div class="section-head"><div><span class="eyebrow">How it works</span><h2>Ordering takes under a minute.</h2><p>No accounts, no checkout forms, no card details. Just WhatsApp.</p></div></div>
  <div class="steps">
    <div class="step reveal"><div class="step-n">01</div><h3>Pick your iPhone</h3><p>Choose a model, then your colour, storage and SIM type. See full specs and the exact price.</p></div>
    <div class="step reveal"><div class="step-n">02</div><h3>Delivery or pickup</h3><p>Tell us where to deliver, or collect from our shop at {e(SITE['shopAddress'])} (ask for {e(SITE['shopContact'])}).</p></div>
    <div class="step reveal"><div class="step-n">03</div><h3>Get your invoice, pick &amp; pay</h3><p>Tap "Order on WhatsApp" to get your invoice. Once we confirm stock, visit our shop at {e(SITE['shopAddress'])}, ask for {e(SITE['shopContact'])}, then pick &amp; pay.</p></div>
  </div>
  <div class="wa-preview reveal"><div class="wa-ic">{ICONS['wa']}</div><div><h4>Your invoice, right in WhatsApp</h4><p>Every order comes with an invoice number, the total and our shop address, so picking up takes minutes.</p></div><div class="wa-bubble">{sample}</div></div>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><div><span class="eyebrow">Free downloads</span><h2>iPhone wallpapers, on us.</h2><p>HD wallpapers made for every iPhone screen, inspired by the new iPhone colours.</p></div><a class="link-arrow" href="wallpapers/">See all {len(WALLS)} wallpapers →</a></div>
  <div class="walls">{walls}</div>
</div></section>

<section class="section" style="padding-top:0"><div class="wrap prose">
  <span class="eyebrow">Buy iPhones in Kenya</span>
  <h2>iPhone prices in Kenya ({datetime.date.today().year}): iPhone 11 to 18</h2>
  <p>Here are the latest iPhone prices in Kenya for every series from the iPhone 11 to the iPhone 18. {e(SITE['brand'])} sells genuine Apple iPhones, from the Ex-UK iPhone 12 Pro and iPhone 13 at {ksh(lowest)} up to the brand-new <a href="iphone-18-pro-max/"><b>iPhone 18 Pro Max</b></a> and <a href="iphone-18-pro/"><b>iPhone 18 Pro</b></a>. Prices were last updated on {e(SITE['pricesUpdated'])}.</p>
  {series_table()}
  <p>Visit our shop at {e(SITE['shopAddress'])} to inspect, pick and pay, or order on WhatsApp ({e(SITE['phoneDisplay'])}). For full price lists by storage, colour and SIM, open any model below or read our <a href="blog/iphone-prices-in-kenya/"><b>iPhone price list guide</b></a>.</p>
  <table class="price-table"><thead><tr><th>iPhone model</th><th>Condition</th><th>Price in Kenya (from)</th></tr></thead><tbody>
  {''.join(f'<tr><td><a href="{p["slug"]}/">{e(p["name"])}</a></td><td>{e(cond_label(p))}</td><td><b>{ksh(from_price(p))}</b></td></tr>' for p in PRODUCTS)}
  </tbody></table>
</div></section>

{home_guides()}

<section class="section" id="faq" style="padding-top:0"><div class="wrap">
  <div class="section-head"><div><span class="eyebrow">FAQ</span><h2>Questions? Answered.</h2></div></div>
  <div class="faq">{faq_html(home_faq)}</div>
</div></section>

<section class="wrap">{cta_band(base, hero)}</section>
"""
    schema = [
        org_schema(),
        {"@context": "https://schema.org", "@type": "WebSite", "name": SITE["brand"], "url": URL + "/", "inLanguage": "en-KE"},
        {"@context": "https://schema.org", "@type": "ItemList", "name": "iPhone prices in Kenya",
         "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": f"{URL}/{p['slug']}/", "name": p["name"]} for i, p in enumerate(PRODUCTS)]},
        faq_schema(home_faq),
    ]
    out = layout(base=base, path="",
                 title=f"iPhone Prices in Kenya {datetime.date.today().year}: iPhone 11 to 18 | {SITE['brand']}",
                 desc=f"iPhone prices in Kenya for iPhone 11, 12, 13, 14, 15, 16, 17 and 18. Brand new and Ex-UK from {ksh(lowest)}. Visit our Nairobi shop or WhatsApp {SITE['phoneDisplay']}.",
                 body=body, schema=schema, og_image="images/og.jpg")
    write("index.html", out)

def cta_band(base, p):
    return f"""<div class="cta-band reveal"><div>
<span class="eyebrow" style="color:#d6b07a">Talk to a real person</span>
<h2>Not sure which iPhone to get?</h2>
<p>Tell us your budget and what you need. We'll recommend the right iPhone and send real photos on WhatsApp.</p>
<a class="btn btn-wa" href="{wa('Hello ' + SITE['brand'] + ', please help me choose an iPhone. My budget is KSh ')}" target="_blank" rel="noopener">{ICONS['wa']}Get advice on WhatsApp</a>
<span class="cta-phone">Or call <b><a href="tel:{SITE['phoneIntl']}">{e(SITE['phoneDisplay'])}</a></b> · {e(SITE['shopHours'])}</span>
</div><img src="{base}{img(p, min(2, p['images']))}" alt="" width="320" height="320" loading="lazy" style="mix-blend-mode:normal;border-radius:24px;background:#fff"></div>"""

def build_product(p):
    base = "../"
    fp, mp = from_price(p), max_price(p)
    variants_sorted = sorted(p["variants"], key=lambda v: (STORAGE_ORDER.get(v["storage"], 9), v["cond"], v.get("conn") or "", v.get("sim") or "", v.get("price") or 0))
    thumbs = "".join(f'<button type="button" aria-current="{"true" if i == 1 else "false"}" data-src="{base}{img(p, i)}" aria-label="Photo {i}"><img src="{base}{img(p, i)}" alt="" width="76" height="76" loading="lazy"></button>' for i in range(1, p["images"] + 1))
    pills = f'<span class="pill {"green" if "new" in conds(p) else ""}">{e(cond_label(p))}</span> '
    if p.get("preorder"): pills += f'<span class="pill">{e(p["preorder"])}</span> '
    elif in_stock(p): pills += '<span class="pill green">● In stock</span> '
    else: pills += '<span class="pill red">Available on request</span> '
    hls = "".join(f'<div class="hl reveal">{ICONS[HL_ICONS[i % 4]]}<b>{e(h)}</b></div>' for i, h in enumerate(p["highlights"]))
    specs = "".join(f"<tr><th>{e(k)}</th><td>{e(v)}</td></tr>" for k, v in p["specs"].items())
    has_sim = any(v.get("sim") for v in p["variants"])
    has_conn = any(v.get("conn") for v in p["variants"])
    has_color = any(v.get("color") for v in p["variants"])
    prow = "".join(
        f'<tr><td>{e(p["name"])} {e(v["storage"])}</td>'
        + ("<td>" + e(v.get("color", "")) + "</td>" if has_color else "")
        + ("<td>" + e(CONN[v.get("conn")]) + "</td>" if has_conn else "")
        + ("<td>" + e(SIM[v.get("sim")]) + "</td>" if has_sim else "")
        + f'<td>{e(COND[v["cond"]])}</td><td><b>{ksh(v.get("price"))}</b>{" <small>(on request)</small>" if v.get("stock") is False else ""}</td></tr>'
        for v in variants_sorted)
    colors = ", ".join(c["name"] for c in p["colors"])
    storages = ", ".join(sorted({v["storage"] for v in p["variants"]}, key=lambda s: STORAGE_ORDER.get(s, 9)))
    if is_ipad(p):
        related = [q for q in PRODUCTS if q["slug"] != p["slug"] and is_ipad(q)][:4]
    else:
        related = [q for q in PRODUCTS if q["slug"] != p["slug"] and not is_ipad(q) and in_stock(q) and abs(q["series"] - p["series"]) <= 1][:4]
        related += [q for q in PRODUCTS if q not in related and q["slug"] != p["slug"] and not is_ipad(q) and abs(q["series"] - p["series"]) <= 1][:4 - len(related)]
    faq = [
        (f"What is the price of the {p['name']} in Kenya?", f"The {p['name']} costs from {ksh(fp)} in Kenya at {SITE['brand']}" + (f", up to {ksh(mp)} for the highest storage." if mp and mp != fp else ".") + f" Prices updated {SITE['pricesUpdated']}."),
        (f"Which colours does the {p['name']} come in?", f"The {p['name']} is available in {colors}. Pick your colour above and we will confirm stock on WhatsApp."),
        (f"How fast can I get the {p['name']} delivered?", "Nairobi orders placed before 3pm are delivered the same day. Upcountry orders usually arrive within 24 hours by courier. You can also pick it up from our shop."),
        (f"Is the {p['name']} original?", f"Yes. Every {p['name']} we sell is a genuine Apple iPhone, IMEI-checked, and comes with warranty."),
    ]
    body = f"""
<div class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="{base}">Home</a><span>›</span><a href="{base}?series={p['series']}#shop">{series_label(p)}</a><span>›</span><span>{e(p['name'])}</span></nav>
<div class="pdp">
  <div class="gallery">
    <div class="gallery-main">{'<span class="badge gold">' + e(p['badge']) + '</span>' if p.get('badge') else ''}<img id="gallery-main" src="{base}{img(p)}" alt="{e(p['name'])} price in Kenya" width="800" height="800" fetchpriority="high"></div>
    <div class="thumbs">{thumbs}</div>
  </div>
  <div class="pdp-info">
    <span class="eyebrow">{series_label(p)} · {p['year']}</span>
    <h1>{e(p['name'])}</h1>
    <p class="tagline">{e(p['tagline'])}</p>
    <div>{pills}</div>
    <div class="pdp-price" style="margin-top:16px"><strong id="pdp-price">{ksh(fp)}</strong><span>Price in Kenya · updated {e(SITE['pricesUpdated'])}</span></div>
    <div id="configurator"><noscript><a class="btn btn-wa btn-block" href="{wa('Hello ' + SITE['brand'] + ', I am interested in the ' + p['name'] + '.')}">Order {e(p['name'])} on WhatsApp</a></noscript></div>
    <div class="perks">
      <div>{ICONS['shield']}100% genuine Apple</div><div>{ICONS['truck']}Same-day Nairobi delivery</div>
      <div>{ICONS['store']}Pick &amp; pay at our shop</div><div>{ICONS['badge']}Warranty included</div>
    </div>
  </div>
</div>

<section class="section" style="padding-top:30px"><div class="section-head"><div><span class="eyebrow">Highlights</span><h2>Why you'll love it.</h2></div></div><div class="highlights">{hls}</div></section>

<section class="section" style="padding-top:0" id="specs"><div class="section-head"><div><span class="eyebrow">Full specifications</span><h2>{e(p['name'])} specs.</h2></div></div>
<div class="specs reveal"><table><tbody>{specs}<tr><th>Colours</th><td>{e(colors)}</td></tr></tbody></table></div></section>

<section class="section prose" style="padding-top:0">
<h2>{e(p['name'])} price in Kenya</h2>
<p>The <b>{e(p['name'])}</b> price in Kenya starts at <b>{ksh(fp)}</b> at {e(SITE['brand'])}. It is available in {e(storages)} storage and comes in {e(colors)}. {e(p['tagline'])}</p>
<table class="price-table"><thead><tr><th>Version</th>{'<th>Colour</th>' if has_color else ''}{'<th>Connectivity</th>' if has_conn else ''}{'<th>SIM</th>' if has_sim else ''}<th>Condition</th><th>Price</th></tr></thead><tbody>{prow}</tbody></table>
<p>Order your {e(p['name'])} on WhatsApp at <a href="tel:{SITE['phoneIntl']}"><b>{e(SITE['phoneDisplay'])}</b></a>. We deliver the same day in Nairobi and countrywide to Mombasa, Kisumu, Nakuru, Eldoret and all counties, or you can pick it up from our shop in {e(SITE['shopAddress'])}.</p>
</section>

<section class="section" style="padding-top:0"><div class="section-head"><div><span class="eyebrow">FAQ</span><h2>{e(p['name'])} questions.</h2></div></div><div class="faq">{faq_html(faq)}</div></section>

{guide_links(p, base)}

<section class="section" style="padding-top:0"><div class="section-head"><div><span class="eyebrow">You may also like</span><h2>Compare similar iPhones.</h2></div><a class="link-arrow" href="{base}#shop">All iPhones →</a></div>
<div class="grid">{''.join(card(q, base, 10 + i) for i, q in enumerate(related))}</div></section>

{cta_band(base, p)}
</div>
<div class="buybar" aria-label="Quick order"><div class="bb-info"><small id="bb-sub">{e(p['name'])}</small><b id="bb-price">{ksh(fp)}</b></div><a class="btn btn-wa" id="bb-btn" href="#" target="_blank" rel="noopener">{ICONS['wa']}Order</a></div>
"""
    offers = []
    for v in p["variants"]:
        if v.get("price") is None: continue
        offers.append({"@type": "Offer", "name": f"{p['name']} {v['storage']}" + (f" {v['color']}" if v.get("color") else "") + (f" {CONN[v['conn']]}" if v.get("conn") else "") + (f" {SIM[v['sim']]}" if v.get("sim") else "") + f" {COND[v['cond']]}",
                       "price": v["price"], "priceCurrency": "KES",
                       "availability": "https://schema.org/PreOrder" if p.get("preorder") else ("https://schema.org/InStock" if v.get("stock", True) else "https://schema.org/BackOrder"),
                       "itemCondition": "https://schema.org/NewCondition" if v["cond"] == "new" else "https://schema.org/RefurbishedCondition",
                       "url": f"{URL}/{p['slug']}/", "seller": {"@id": URL + "/#store"},
                       "priceValidUntil": f"{datetime.date.today().year}-12-31"})
    product_schema = {
        "@context": "https://schema.org", "@type": "Product", "name": p["name"], "brand": {"@type": "Brand", "name": "Apple"},
        "image": [f"{URL}/{img(p, i)}" for i in range(1, p["images"] + 1)],
        "description": f"{p['name']} price in Kenya from {ksh(fp)}. {p['tagline']} Available in {colors}.",
        "sku": p["slug"], "color": colors,
        "offers": {"@type": "AggregateOffer", "priceCurrency": "KES", "lowPrice": fp, "highPrice": mp or fp, "offerCount": len(offers), "offers": offers},
    }
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": URL + "/"},
        {"@type": "ListItem", "position": 2, "name": series_label(p), "item": f"{URL}/?series={p['series']}"},
        {"@type": "ListItem", "position": 3, "name": p["name"], "item": f"{URL}/{p['slug']}/"}]}
    title = f"{p['name']} Price in Kenya – {ksh(fp)} | {SITE['brand']}"
    desc = f"{p['name']} price in Kenya from {ksh(fp)}. {cond_label(p)}, {storages}, in {colors}. Full specs, same-day Nairobi delivery. Order on WhatsApp {SITE['phoneDisplay']}."
    out = layout(base=base, path=f"{p['slug']}/", title=title, desc=desc, body=body,
                 schema=[product_schema, crumbs, faq_schema(faq)], og_image=img(p), page_js=f"window.PRODUCT={json.dumps(p['slug'])};")
    write(f"{p['slug']}/index.html", out)

# ---------- blog ----------
# Articles live in data/blog/<slug>.md: a small front matter block, then simple markdown.
# Shop prices are tokens ({from:slug}, {table:slug} ...) so articles follow products.json.
BLOG_DIR = os.path.join(ROOT, "data", "blog")
BY_SLUG = {p["slug"]: p for p in PRODUCTS}

def load_posts():
    posts = []
    for fn in sorted(os.listdir(BLOG_DIR)):
        if not fn.endswith(".md"):
            continue
        with open(os.path.join(BLOG_DIR, fn), encoding="utf-8") as fh:
            _, head, body = fh.read().split("---\n", 2)
        meta = {"faq": [], "slug": fn[:-3], "body": body}
        for line in head.splitlines():
            k, _, v = line.partition(":")
            k, v = k.strip(), v.strip()
            if k == "faq":
                q, a = v.split("||")
                meta["faq"].append((q.strip(), a.strip()))
            elif k:
                meta[k] = v
        posts.append(meta)
    posts.sort(key=lambda b: int(b.get("order", 99)))
    return posts

POSTS = load_posts()
POST_SLUGS = {b["slug"] for b in POSTS}
def csv_list(v): return [x.strip() for x in (v or "").split(",") if x.strip()]

def expand_text(text):
    """Fill price and shop tokens. Used for titles, descriptions and body text."""
    def price(m):
        kind, slug = m.group(1), m.group(2)
        p = BY_SLUG[slug]
        return ksh(from_price(p) if kind == "from" else max_price(p))
    text = re.sub(r"\{(from|max):([a-z0-9-]+)\}", price, text)
    return (text.replace("{updated}", SITE["pricesUpdated"]).replace("{shop}", SITE["shopAddress"])
            .replace("{contact}", SITE["shopContact"]).replace("{phone}", SITE["phoneDisplay"]))

def inline(text, base):
    text = e(expand_text(text)).replace("&#x27;", "'").replace("&quot;", '"')
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    def link(m):
        label, target = m.group(1), m.group(2)
        kind, _, slug = target.partition(":")
        if kind == "post":
            assert slug in POST_SLUGS, f"broken post link: {slug}"
            return f'<a href="{base}blog/{slug}/">{label}</a>'
        if kind == "product":
            assert slug in BY_SLUG, f"broken product link: {slug}"
            return f'<a href="{base}{slug}/">{label}</a>'
        if target == "shop":
            return f'<a href="{base}#shop">{label}</a>'
        raise ValueError(f"unknown link target: {target}")
    return re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link, text)

def avail_label(p): return "In stock" if in_stock(p) else "On request"

def variant_table(p, base):
    has = {k: any(v.get(k) for v in p["variants"]) for k in ("color", "conn", "sim")}
    rows = sorted(p["variants"], key=lambda v: (STORAGE_ORDER.get(v["storage"], 9), v["cond"], v.get("conn") or "", v.get("sim") or "", v.get("price") or 0))
    head = "<th>Storage</th>" + ("<th>Colour</th>" if has["color"] else "") + ("<th>Connectivity</th>" if has["conn"] else "") + ("<th>SIM</th>" if has["sim"] else "") + "<th>Condition</th><th>Price</th>"
    body = ""
    for v in rows:
        body += f'<tr><td>{e(v["storage"])}</td>' + (f'<td>{e(v.get("color", ""))}</td>' if has["color"] else "") + (f'<td>{e(CONN[v.get("conn")])}</td>' if has["conn"] else "") + (f'<td>{e(SIM[v.get("sim")])}</td>' if has["sim"] else "")
        body += f'<td>{e(COND[v["cond"]])}</td><td><b>{ksh(v.get("price"))}</b>{" <small>(on request)</small>" if v.get("stock") is False else ""}</td></tr>'
    return f'<div class="table-wrap"><table class="price-table"><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'

def compare_table(items, base):
    body = "".join(f'<tr><td><a href="{base}{p["slug"]}/">{e(p["name"])}</a></td><td>{e(cond_label(p))}</td><td><b>{ksh(from_price(p))}</b></td><td>{avail_label(p)}</td></tr>' for p in items)
    return f'<div class="table-wrap"><table class="price-table"><thead><tr><th>Model</th><th>Condition</th><th>From</th><th>Stock</th></tr></thead><tbody>{body}</tbody></table></div>'

def render_post_body(md, base):
    out, para, items, toc = [], [], [], []
    def flush():
        if para:
            out.append(f"<p>{inline(' '.join(para), base)}</p>")
            para.clear()
        if items:
            out.append("<ul>" + "".join(f"<li>{inline(i, base)}</li>" for i in items) + "</ul>")
            items.clear()
    for line in md.splitlines():
        t = line.strip()
        block = re.fullmatch(r"\{(table|compare|cards):([a-z0-9,-]+)\}", t)
        if not t:
            flush()
        elif t.startswith("## "):
            flush()
            hid = re.sub(r"[^a-z0-9]+", "-", re.sub(r"\{[^}]*\}", "", t[3:]).lower()).strip("-")
            toc.append((hid, expand_text(t[3:])))
            out.append(f'<h2 id="{hid}">{inline(t[3:], base)}</h2>')
        elif t.startswith("### "):
            flush()
            out.append(f"<h3>{inline(t[4:], base)}</h3>")
        elif t.startswith("- "):
            if para:
                flush()
            items.append(t[2:])
        elif t.startswith("> "):
            flush()
            out.append(f'<p class="note">{inline(t[2:], base)}</p>')
        elif t == "{pricelist}":
            flush()
            out.append(compare_table([p for p in PRODUCTS if in_stock(p)] + [p for p in PRODUCTS if not in_stock(p)], base))
        elif block:
            flush()
            kind, slugs = block.group(1), [BY_SLUG[x] for x in block.group(2).split(",")]
            if kind == "table":
                out.append(variant_table(slugs[0], base))
            elif kind == "compare":
                out.append(compare_table(slugs, base))
            else:
                out.append('<div class="grid post-cards">' + "".join(card(p, base, 10 + i) for i, p in enumerate(slugs)) + "</div>")
        else:
            para.append(t)
    flush()
    return "\n".join(out), toc

def post_card(b, base):
    return f"""<article class="blog-card reveal"><span class="blog-cat">{e(b.get('category', 'Guide'))}</span>
<h3><a href="{base}blog/{b['slug']}/">{e(expand_text(b['h1']))}</a></h3>
<p>{e(expand_text(b['description']))}</p><a class="link-arrow" href="{base}blog/{b['slug']}/" aria-hidden="true" tabindex="-1">Read guide →</a></article>"""

def home_guides():
    picks = [b for b in POSTS if b.get("featured")][:3]
    return f"""<section class="section" style="padding-top:0"><div class="wrap">
  <div class="section-head"><div><span class="eyebrow">iPhone guides</span><h2>Buy smarter in Kenya.</h2><p>Prices, model comparisons and buying advice for Kenyan buyers.</p></div><a class="link-arrow" href="blog/">All guides →</a></div>
  <div class="blog-grid">{''.join(post_card(b, '') for b in picks)}</div>
</div></section>"""

def guide_links(p, base):
    posts = [b for b in POSTS if p["slug"] in csv_list(b.get("products"))][:3]
    if not posts:
        return ""
    links = "".join(f'<li><a href="{base}blog/{b["slug"]}/">{e(expand_text(b["h1"]))}</a></li>' for b in posts)
    return f'<section class="section prose" style="padding-top:0"><h2>Guides for this model</h2><ul>{links}</ul></section>'

def build_blog():
    target = os.path.join(ROOT, "blog")
    if os.path.isdir(target):
        shutil.rmtree(target)
    base = "../../"
    titles = set()
    for b in POSTS:
        title, desc = expand_text(b["title"]), expand_text(b["description"])
        assert title not in titles, f"duplicate title: {title}"
        titles.add(title)
        if len(title) > 70: print(f"  long title ({len(title)}): {title}")
        if len(desc) > 165: print(f"  long description ({len(desc)}): {b['slug']}")
        body, toc = render_post_body(b["body"], base)
        words = len(re.sub(r"<[^>]+>", " ", body).split())
        hero = BY_SLUG.get(b.get("image"))
        hero_html = f'<div class="post-hero"><img src="{base}{img(hero)}" alt="{e(hero["name"])} in Kenya" width="800" height="800" fetchpriority="high"></div>' if hero else ""
        toc_html = '<nav class="toc" aria-label="In this guide"><b>In this guide</b><ol>' + "".join(f'<li><a href="#{h}">{e(t)}</a></li>' for h, t in toc) + "</ol></nav>" if len(toc) > 2 else ""
        faq_html_block = f'<section class="post-faq"><h2 id="faq">Frequently asked questions</h2><div class="faq">{faq_html([(q, expand_text(a)) for q, a in b["faq"]])}</div></section>' if b["faq"] else ""
        rel = [x for x in POSTS if x["slug"] in csv_list(b.get("related"))]
        for r in csv_list(b.get("related")):
            assert r in POST_SLUGS, f"{b['slug']}: unknown related post {r}"
        rel_html = f'<section class="section" style="padding-top:20px"><div class="section-head"><div><span class="eyebrow">Keep reading</span><h2>Related guides.</h2></div><a class="link-arrow" href="{base}blog/">All guides →</a></div><div class="blog-grid">{"".join(post_card(x, base) for x in rel[:3])}</div></section>' if rel else ""
        cta = f"""<div class="post-cta"><div><h2>Ready to choose your iPhone?</h2><p>Visit our shop to pick and pay: <b>{e(SITE['shopAddress'])}</b>. Ask for {e(SITE['shopContact'])}, or check stock on WhatsApp first.</p></div>
<div class="post-cta-btns"><a class="btn btn-wa" href="{wa('Hello ' + SITE['brand'] + ', I read your guide: ' + expand_text(b['h1']) + '. Is this available?')}" target="_blank" rel="noopener">{ICONS['wa']}Ask on WhatsApp</a><a class="btn btn-ghost btn-light" href="{base}#shop">See all iPhones</a></div></div>"""
        page = f"""<div class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="{base}">Home</a><span>›</span><a href="{base}blog/">Blog</a><span>›</span><span>{e(expand_text(b['h1']))}</span></nav>
<article class="post">
<header class="post-head"><span class="eyebrow">{e(b.get('category', 'Guide'))}</span><h1>{e(expand_text(b['h1']))}</h1>
<p class="post-meta">By the {e(SITE['brand'])} team · Published <time datetime="{b['date']}">{fmt_date(b['date'])}</time> · {max(1, round(words / 200))} min read · Our prices updated {e(SITE['pricesUpdated'])}</p></header>
{hero_html}
{toc_html}
<div class="post-body prose">{body}</div>
{faq_html_block}
{cta}
</article>
{rel_html}
</div>"""
        url = f"{URL}/blog/{b['slug']}/"
        image = f"{URL}/{img(hero)}" if hero else f"{URL}/images/og.jpg"
        schema = [
            {"@context": "https://schema.org", "@type": "BlogPosting", "headline": expand_text(b["h1"]), "description": desc, "image": image,
             "datePublished": b["date"], "dateModified": b.get("modified", b["date"]), "inLanguage": "en-KE", "mainEntityOfPage": url,
             "author": {"@type": "Organization", "name": SITE["brand"], "url": URL + "/"},
             "publisher": {"@type": "Organization", "name": SITE["brand"], "logo": {"@type": "ImageObject", "url": f"{URL}/assets/icon-512.png"}},
             "about": {"@type": "Place", "name": "Kenya"}},
            {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": URL + "/"},
                {"@type": "ListItem", "position": 2, "name": "Blog", "item": URL + "/blog/"},
                {"@type": "ListItem", "position": 3, "name": expand_text(b["h1"]), "item": url}]},
        ]
        if b["faq"]:
            schema.append(faq_schema([(q, expand_text(a)) for q, a in b["faq"]]))
        write(f"blog/{b['slug']}/index.html", layout(base=base, path=f"blog/{b['slug']}/", title=title, desc=desc, body=page, schema=schema,
              og_image=(img(hero) if hero else "images/og.jpg"), og_type="article",
              extra_head=f'\n<meta property="article:published_time" content="{b["date"]}">'))
    # index
    groups = []
    for cat in ("Buying guide", "Current models", "Older models"):
        items = [b for b in POSTS if b.get("category") == cat]
        groups.append(f'<section class="blog-group"><h2>{e(cat + "s" if cat == "Buying guide" else cat)}</h2><div class="blog-grid">{"".join(post_card(b, "../") for b in items)}</div></section>')
    body = f"""<div class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="../">Home</a><span>›</span><span>Blog</span></nav>
<section class="section" style="padding-top:28px"><div class="section-head"><div><span class="eyebrow">iPhone guides for Kenya</span><h1 class="blog-title">iPhone prices and buying advice in Kenya.</h1><p>Honest guides to iPhone prices in KSh, Ex-UK phones, older models and where to buy in Nairobi. Our prices updated {e(SITE['pricesUpdated'])}.</p></div></div>
{''.join(groups)}</section></div>"""
    schema = [{"@context": "https://schema.org", "@type": "Blog", "name": f"{SITE['brand']} iPhone guides for Kenya", "url": URL + "/blog/", "inLanguage": "en-KE",
               "blogPost": [{"@type": "BlogPosting", "headline": expand_text(b["h1"]), "url": f"{URL}/blog/{b['slug']}/", "datePublished": b["date"]} for b in POSTS]}]
    write("blog/index.html", layout(base="../", path="blog/", title=f"iPhone Prices & Buying Guides for Kenya | {SITE['brand']}",
          desc="Guides to iPhone prices in Kenya: current and older models, Ex-UK phones, instalments, repairs and where to buy in Nairobi.", body=body, schema=schema, og_image="images/og.jpg"))
    print(f"Built {len(POSTS)} blog posts.")

def fmt_date(iso):
    d = datetime.date.fromisoformat(iso)
    return f"{d.day} {d.strftime('%B %Y')}"

def build_wallpapers():
    base = "../"
    items = "".join(f"""<figure id="{s}" class="reveal" style="margin:0"><a class="wall" href="{base}images/wallpapers/{s}.jpg" download="{s}-iphone-wallpaper-i-phones.jpg" aria-label="Download {e(n)} wallpaper"><img src="{base}images/wallpapers/{s}-thumb.webp" alt="{e(n)} iPhone wallpaper HD" width="360" height="780" loading="lazy"><span class="wall-time">9:41</span><span class="wall-name">{e(n)}{ICONS['download']}</span></a></figure>""" for s, n in WALLS)
    body = f"""<div class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="{base}">Home</a><span>›</span><span>Wallpapers</span></nav>
<section class="section" style="padding-top:28px">
<div class="section-head"><div><span class="eyebrow">Free downloads</span><h2>iPhone wallpapers in HD.</h2>
<p>{len(WALLS)} free wallpapers sized for iPhone (1290 × 2796), inspired by the iPhone 17 and iPhone 18 colours. Tap a wallpaper to download it, then go to Settings › Wallpaper on your iPhone.</p></div></div>
<div class="walls">{items}</div>
</section>
<section class="section" style="padding-top:0">{cta_band(base, PRODUCTS[0])}</section>
</div>"""
    out = layout(base=base, path="wallpapers/", title=f"Free iPhone Wallpapers HD (iPhone 17 & 18 Colours) | {SITE['brand']}",
                 desc="Download free HD iPhone wallpapers inspired by the iPhone 17 and iPhone 18 colours: Cosmic Orange, Deep Blue, Burgundy, Glacier and more. Sized for every iPhone.",
                 body=body, schema=[org_schema()], og_image="images/wallpapers/cosmic-orange-thumb.webp")
    write("wallpapers/index.html", out)

def build_misc():
    urls = [("", "1.0", "daily")] + [(f"{p['slug']}/", "0.9", "weekly") for p in PRODUCTS] + [("wallpapers/", "0.5", "monthly"), ("blog/", "0.8", "weekly")] + [(f"blog/{b['slug']}/", "0.7", "monthly") for b in POSTS]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f"  <url><loc>{URL}/{u}</loc><lastmod>{TODAY}</lastmod><changefreq>{f}</changefreq><priority>{pr}</priority></url>\n" for u, pr, f in urls) + "</urlset>\n"
    write("sitemap.xml", sm)
    write("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {URL}/sitemap.xml\n")
    write("manifest.webmanifest", json.dumps({"name": SITE["brand"], "short_name": SITE["brandShort"], "start_url": "./", "display": "standalone",
        "background_color": "#f5f5f3", "theme_color": "#0d0d0f", "icons": [{"src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png"}]}, indent=1))
    body = f"""<div class="wrap" style="text-align:center;padding:100px 0"><span class="eyebrow">404</span><h1 style="font-size:52px;letter-spacing:-.04em;margin:12px 0">This page went missing.</h1>
<p style="color:var(--muted)">But your next iPhone didn't.</p><a class="btn btn-dark" href="{URL}/">Browse iPhones</a></div>"""
    write("404.html", layout(base=URL + "/", path="404.html", title=f"Page not found | {SITE['brand']}", desc="Page not found.", body=body, schema=[], og_image="images/og.jpg", robots="noindex"))

def build_brand_assets():
    from PIL import Image, ImageDraw, ImageFont
    star = "M12 2l2.6 6.4L21 9l-5 4.3L17.5 20 12 16.6 6.5 20 8 13.3 3 9l6.4-.6z"
    write("assets/favicon.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0d0d0f"/><g transform="translate(6 6) scale(.83)"><path fill="#d6b07a" d="{star}"/></g></svg>')
    def icon(size):
        im = Image.new("RGB", (size, size), (13, 13, 15)); d = ImageDraw.Draw(im)
        pts = [(12, 2), (14.6, 8.4), (21, 9), (16, 13.3), (17.5, 20), (12, 16.6), (6.5, 20), (8, 13.3), (3, 9), (9.4, 8.4)]
        k = size / 24 * .62; off = size * .19
        d.polygon([(x * k + off, y * k + off) for x, y in pts], fill=(214, 176, 122))
        im.save(os.path.join(ROOT, "assets", f"icon-{size}.png"))
    icon(192); icon(512)
    # Open Graph share image 1200x630
    og = Image.new("RGB", (1200, 630), (245, 245, 243))
    ph = Image.open(os.path.join(ROOT, "images", "phones", "iphone-18-pro-max-1.webp")).convert("RGB").resize((600, 600))
    og.paste(ph, (600, 15))
    d = ImageDraw.Draw(og)
    def font(sz, bold=True):
        for f in (["arialbd.ttf", "seguisb.ttf"] if bold else ["arial.ttf", "segoeui.ttf"]):
            try: return ImageFont.truetype(f, sz)
            except OSError: pass
        return ImageFont.load_default()
    d.text((70, 120), SITE["brand"].upper(), font=font(26), fill=(168, 131, 79))
    d.text((70, 170), "iPhones in Kenya", font=font(68), fill=(13, 13, 15))
    d.text((70, 250), "iPhone 12 to 18 Pro Max & iPad", font=font(40, False), fill=(61, 61, 66))
    lowest = min(from_price(p) for p in PRODUCTS if from_price(p) and in_stock(p))
    d.text((70, 320), f"From {ksh(lowest)}", font=font(44), fill=(13, 13, 15))
    d.rounded_rectangle((70, 420, 470, 490), radius=35, fill=(31, 174, 85))
    d.text((100, 437), f"WhatsApp {SITE['phoneDisplay']}", font=font(30), fill=(255, 255, 255))
    og.save(os.path.join(ROOT, "images", "og.jpg"), "JPEG", quality=86)

def build_catalog():
    # read by api/order.js so emailed prices come from our data, not the browser
    cat = {p["slug"]: {"name": p["name"], "colors": [c["name"] for c in p["colors"]],
                       "variants": [{k: v.get(k) for k in ("storage", "sim", "cond", "price", "color", "conn") if k in ("storage", "sim", "cond", "price") or v.get(k)} for v in p["variants"]]} for p in PRODUCTS}
    write("api/_catalog.json", json.dumps(cat, ensure_ascii=False, separators=(",", ":")))

def write(rel, content):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)

if __name__ == "__main__":
    # remove model folders that no longer exist in products.json
    keep = {p["slug"] for p in PRODUCTS}
    for d in os.listdir(ROOT):
        if d.startswith("iphone-") and os.path.isdir(os.path.join(ROOT, d)) and d not in keep:
            shutil.rmtree(os.path.join(ROOT, d))
    build_brand_assets()
    build_home()
    for p in PRODUCTS: build_product(p)
    build_wallpapers()
    build_blog()
    build_misc()
    build_catalog()
    print(f"Built {len(PRODUCTS)} product pages + home, wallpapers, sitemap.")
