"""Download freely licensed phone photos from Wikimedia Commons for SAMPLE marketplace listings.

Writes images/market/photo-<slug>.webp (800x800) and data/market/photo_credits.json.
Licences used here (CC BY, CC BY-SA, CC0) require crediting the author; credits appear on
each sample listing and on /credits/. Images are resized/padded, so derivatives of CC BY-SA
files stay under CC BY-SA.
"""
import io, json, os, re, html, urllib.parse, urllib.request
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images", "market")
UA = {"User-Agent": "i-phones-site-builder/1.0 (https://i-phones.co.ke)"}

# (brand, model as listed, Commons file title)
PICKS = [
    ("Samsung", "Galaxy S24 Ultra", "File:SAMSUNG Galaxy S24 Ultra.jpg"),
    ("Samsung", "Galaxy S23", "File:Back of the Samsung Galaxy S23.jpg"),
    ("Samsung", "Galaxy A55", "File:Samsung Galaxy A55 5G 2024 (cropped).jpg"),
    ("Samsung", "Galaxy Z Flip5", "File:20230729 삼성 갤럭시 z 플립5.jpg"),
    ("Samsung", "Galaxy S23 Ultra", "File:Samsung Galaxy S23 Ultra, 512 GB, Lavender"),
    ("Tecno", "Camon 40 Pro", "File:Tecno Camon 40 Pro 5G.jpg"),
    ("Tecno", "Spark 20", "File:Tecno Spark 20.jpg"),
    ("Infinix", "Note 50 Pro", "File:Infinix Note 50 Pro 4G.jpg"),
    ("Xiaomi", "Redmi Note 14 Pro+", "File:Redmi Note 14 ProPlus.jpg"),
    ("Xiaomi", "Redmi 15C", "File:Rear of the Redmi 15C.jpg"),
    ("Google", "Pixel 8 Pro", "File:Google Pixel 8 Pro.jpg"),
    ("Google", "Pixel 8", "File:Google Pixel 8 Rose rear.jpg"),
    ("Google", "Pixel 7", "File:Google Pixel 7 20230416 HOF00361 RAW-Export.png"),
    ("Oppo", "Reno 6 Pro+", "File:OPPO Reno 6 Pro+ back.jpg"),
    ("Huawei", "Nova 15", "File:Huawei nova 15 rear.jpg"),
    ("Vivo", "Y31d", "File:Vivo Y31d rear panel.jpg"),
    ("itel", "A50", "File:Itel A50 rear.jpg"),
    ("itel", "S23", "File:Itel S23 front.jpg"),
    ("Nokia", "G11 Plus", "File:Nokia G11 plus.jpg"),
    ("OnePlus", "OnePlus Nord", "File:OnePlus AC2003 with a broken screen, 12.jpg"),
]
OK_LICENCES = re.compile(r"^(CC0|Public domain|CC BY(-SA)? [234]\.0)", re.I)

def api(params):
    u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(dict(params, format="json"))
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60))

def resolve(title):
    """Exact title, or the first search hit whose title starts with the given prefix."""
    d = api({"action": "query", "titles": title, "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 1000})
    page = next(iter(d["query"]["pages"].values()))
    if "imageinfo" in page:
        return page
    d = api({"action": "query", "generator": "search", "gsrnamespace": 6, "gsrsearch": re.sub(r"[^\w ]+", " ", title.replace("File:", "")), "gsrlimit": 20,
             "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 1000})
    for p in d.get("query", {}).get("pages", {}).values():
        if p["title"].startswith(title):
            return p
    raise SystemExit("not found: " + title)

def square(im):
    im = im.convert("RGB")
    bg = im.resize((80, 80)).filter(ImageFilter.GaussianBlur(8)).resize((800, 800))
    bg = Image.blend(bg, Image.new("RGB", (800, 800), (242, 242, 240)), 0.55)
    im.thumbnail((760, 760))
    bg.paste(im, ((800 - im.width) // 2, (800 - im.height) // 2))
    return bg

def main():
    os.makedirs(OUT, exist_ok=True)
    credits = {}
    for brand, model, title in PICKS:
        p = resolve(title)
        ii = p["imageinfo"][0]; m = ii.get("extmetadata", {})
        lic = m.get("LicenseShortName", {}).get("value", "")
        if not OK_LICENCES.match(lic):
            raise SystemExit(f"licence not allowed for {p['title']}: {lic}")
        author = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html.unescape(m.get("Artist", {}).get("value", "")))).strip() or "Unknown"
        slug = re.sub(r"[^a-z0-9]+", "-", f"{brand} {model}".lower()).strip("-")
        raw = urllib.request.urlopen(urllib.request.Request(ii["thumburl"], headers=UA), timeout=90).read()
        square(Image.open(io.BytesIO(raw))).save(os.path.join(OUT, f"photo-{slug}.webp"), "WEBP", quality=80, method=6)
        credits[f"/images/market/photo-{slug}.webp"] = {"brand": brand, "model": model, "file": p["title"], "author": author[:80],
            "licence": lic, "licenceUrl": m.get("LicenseUrl", {}).get("value", ""), "source": ii["descriptionurl"]}
        print(f"{brand:8} {model:20} {lic:14} {author[:40]}")
    json.dump(credits, open(os.path.join(ROOT, "data", "market", "photo_credits.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
