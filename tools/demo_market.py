"""Generate SAMPLE marketplace data (data/market/demo.json) and placeholder photos.

Every seller and listing here is fictional and is flagged is_demo in the database:
the site labels them "Sample", hides their contact button and keeps them out of
Google. Load or remove them from the admin dashboard (Sample data tab).
"""
import json, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "images", "market")
os.makedirs(IMG_DIR, exist_ok=True)
rnd = random.Random(2026)

PEOPLE = ["Brian O.", "Faith W.", "Kevin M.", "Mercy A.", "Dennis K.", "Grace N.", "Collins O.", "Esther W.", "Victor K.", "Lucy C.",
          "Samuel M.", "Diana A.", "Peter K.", "Joy M.", "Allan B.", "Caroline N.", "Felix O.", "Sharon J.", "Ian N.", "Purity A.",
          "Mark W.", "Naomi W.", "Eric K.", "Linda M.", "Joseph M."]
DEALERS = [("Savanna Mobile", "gold"), ("Tausi Gadgets", "silver"), ("Nyota Phones", "gold"), ("Baraka Mobile Centre", "bronze"),
           ("Simba Tech Phones", "silver"), ("Pwani Phones", "gold"), ("Lakeside Mobiles", "bronze"), ("Rift Gadgets", "silver"),
           ("Mlima Phones", "bronze"), ("Upendo Mobiles", "silver"), ("Zuri Gadgets", "gold"), ("Amani Phone Store", "bronze"),
           ("Bahari Mobiles", "silver"), ("Kito Phones", "bronze"), ("Jiko Tech", "silver")]
PLACES = [("Nairobi", "Westlands", "Westlands"), ("Nairobi", "Starehe", "Nairobi CBD"), ("Nairobi", "Kibra", "Kilimani"),
          ("Nairobi", "Kasarani", "Kasarani"), ("Nairobi", "Embakasi East", "Utawala"), ("Nairobi", "Langata", "Karen"),
          ("Nairobi", "Roysambu", "Roysambu"), ("Kiambu", "Ruiru", "Ruiru"), ("Kiambu", "Thika Town", "Thika"), ("Kiambu", "Kiambaa", "Ruaka"),
          ("Machakos", "Mavoko", "Syokimau"), ("Kajiado", "Kajiado North", "Ngong"), ("Kajiado", "Kajiado East", "Kitengela"),
          ("Mombasa", "Mvita", "Mombasa CBD"), ("Mombasa", "Nyali", "Nyali"), ("Kisumu", "Kisumu Central", "Kisumu CBD"),
          ("Nakuru", "Nakuru Town East", "Nakuru CBD"), ("Uasin Gishu", "Kapseret", "Eldoret"), ("Nyeri", "Nyeri Town", "Nyeri"),
          ("Meru", "North Imenti", "Meru Town"), ("Kakamega", "Lurambi", "Kakamega"), ("Kisii", "Nyaribari Chache", "Kisii Town")]
# (brand, model, storage, condition, price, photo key)
APPLE = [("iPhone 13", "128GB", "used", 47000, "iphone-13"), ("iPhone 13 Pro Max", "256GB", "ex-uk", 72000, "iphone-13-pro-max"),
         ("iPhone 14 Pro", "256GB", "used", 74000, "iphone-14-pro"), ("iPhone 12 Pro", "128GB", "used", 41000, "iphone-12-pro"),
         ("iPhone 15 Pro Max", "256GB", "ex-uk", 98000, "iphone-15-pro-max"), ("iPhone 14 Pro Max", "256GB", "used", 86000, "iphone-14-pro-max"),
         ("iPhone 16 Pro", "256GB", "ex-uk", 115000, "iphone-16-pro"), ("iPhone 12 Pro Max", "256GB", "damaged", 26000, "iphone-12-pro-max"),
         ("iPhone 13 Pro", "256GB", "ex-uk", 63000, "iphone-13-pro"), ("iPhone 17 Pro Max", "256GB", "new", 178000, "iphone-17-pro-max"),
         ("iPhone 16", "128GB", "new", 106000, "iphone-16"), ("iPhone 14", "128GB", "used", 50000, "iphone-14"),
         ("iPhone 15", "128GB", "ex-uk", 72000, "iphone-15"), ("iPhone 17 Pro", "256GB", "new", 168000, "iphone-17-pro")]
OTHER = [("Samsung", "Galaxy S24 Ultra", "256GB", "used", 112000), ("Samsung", "Galaxy A55", "128GB", "new", 46000),
         ("Samsung", "Galaxy S23", "256GB", "ex-uk", 58000), ("Samsung", "Galaxy A15", "128GB", "new", 19500),
         ("Samsung", "Galaxy Z Flip5", "256GB", "used", 62000), ("Samsung", "Galaxy S22 Ultra", "256GB", "damaged", 24000),
         ("Tecno", "Camon 30 Pro", "256GB", "new", 33000), ("Tecno", "Spark 30", "128GB", "new", 15500), ("Tecno", "Pova 6 Pro", "256GB", "used", 21000),
         ("Infinix", "Note 40 Pro", "256GB", "new", 31000), ("Infinix", "Hot 50", "128GB", "new", 16500), ("Infinix", "Zero 30", "256GB", "used", 24000),
         ("Xiaomi", "Redmi Note 14 Pro", "256GB", "new", 36000), ("Xiaomi", "Redmi 13C", "128GB", "new", 13500), ("Xiaomi", "Poco X6 Pro", "256GB", "used", 29000),
         ("Google", "Pixel 8 Pro", "128GB", "ex-uk", 64000), ("Google", "Pixel 7", "128GB", "used", 32000), ("Oppo", "Reno 12", "256GB", "new", 42000),
         ("Vivo", "Y28", "128GB", "new", 18000), ("Huawei", "Nova 12", "256GB", "used", 27000), ("Honor", "X9b", "256GB", "new", 34000),
         ("OnePlus", "OnePlus 12", "256GB", "ex-uk", 78000), ("Nokia", "G42", "128GB", "used", 11000), ("itel", "S24", "128GB", "new", 12500)]
COLORS = {"Apple": ["Black", "White", "Blue", "Natural Titanium", "Graphite", "Silver", "Gold"], None: ["Black", "Blue", "Green", "Silver", "Purple", "Cream"]}
BRAND_TINT = {"Samsung": (40, 70, 150), "Tecno": (30, 120, 200), "Infinix": (20, 150, 110), "Xiaomi": (230, 110, 30), "Google": (60, 130, 230),
              "Oppo": (30, 140, 90), "Vivo": (60, 90, 200), "Huawei": (190, 40, 50), "Honor": (40, 120, 190), "OnePlus": (200, 30, 40), "Nokia": (20, 70, 160), "itel": (220, 30, 60)}
DESC = {"new": ["Brand new, sealed in the box. Comes with receipt.", "New and unused, full box with charger cable.", "Sealed box. Selling because I received two as gifts."],
        "ex-uk": ["Ex-UK in very good condition, no scratches on the screen. Battery health 88%.", "Clean Ex-UK unit, fully tested. Face ID and cameras all working.", "Ex-UK, minor marks on the frame. Comes with cable."],
        "used": ["Used for about a year, always in a case. Screen protector on since day one.", "Good condition, small scratch on the back. Battery holds a full day.", "Lightly used, everything works perfectly. Selling to upgrade."],
        "damaged": ["Cracked screen but the phone works and touch responds. Good for screen replacement or parts.", "Back glass cracked, everything else works. Selling as is.", "Phone does not charge reliably, likely the charging port. Selling for repair or parts."]}

def font(size, bold=True):
    for name in (["arialbd.ttf", "segoeuib.ttf"] if bold else ["arial.ttf", "segoeui.ttf"]):
        try: return ImageFont.truetype(name, size)
        except OSError: pass
    return ImageFont.load_default()

def placeholder(brand, model, color_i):
    """Illustrated product card (not a photo) for non-Apple sample listings."""
    slug = f"sample-{brand}-{model}".lower().replace(" ", "-").replace("+", "plus")
    path = os.path.join(IMG_DIR, slug + ".webp")
    if not os.path.exists(path):
        tint = BRAND_TINT.get(brand, (90, 90, 100))
        W = 800
        im = Image.new("RGB", (W, W), (246, 245, 242)); d = ImageDraw.Draw(im)
        glow = Image.new("RGBA", (W, W), (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
        g.ellipse((150, 120, 650, 620), fill=tint + (60,)); glow = glow.filter(ImageFilter.GaussianBlur(70)); im.paste(glow, (0, 0), glow)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((285, 120, 515, 600), radius=38, fill=(22, 22, 26))
        d.rounded_rectangle((295, 130, 505, 590), radius=30, fill=tuple(int(c * 0.55 + 255 * 0.45) for c in tint))
        d.rounded_rectangle((365, 142, 435, 156), radius=7, fill=(22, 22, 26))
        for k in range(3):
            d.rounded_rectangle((315, 200 + k * 26, 485, 212 + k * 26), radius=6, fill=(255, 255, 255, 120))
        f1, f2 = font(44), font(30, False)
        for text, fnt, y, col in ((brand, f1, 640, (20, 20, 24)), (model, f2, 696, (90, 90, 96))):
            w = d.textlength(text, font=fnt); d.text(((W - w) / 2, y), text, font=fnt, fill=col)
        im.save(path, "WEBP", quality=82)
    return f"/images/market/{slug}.webp"

def listing(brand, model, storage, cond, price, photos, package=None):
    place = rnd.choice(PLACES)
    color = rnd.choice(COLORS["Apple" if brand == "Apple" else None])
    prefix = "" if brand == "Apple" or model.lower().startswith(brand.lower()) else brand + " "
    return {"brand": brand, "model": model, "title": f"{prefix}{model} {storage}", "condition": cond, "storage": storage, "color": color,
            "price": int(round(price * rnd.uniform(0.95, 1.05) / 500) * 500), "county": place[0], "constituency": place[1], "area": place[2],
            "description": rnd.choice(DESC[cond]), "photos": photos, "package": package, "ageHours": rnd.randint(1, 24 * 20)}

def apple(i):
    m, st, c, p, key = APPLE[i % len(APPLE)]
    n = 4 if key not in ("iphone-16-pro", "iphone-17-pro-max", "iphone-17-pro") else 3
    return listing("Apple", m, st, c, p, [f"/images/phones/{key}-{k}.webp" for k in range(1, n + 1)])

def other(i):
    b, m, st, c, p = OTHER[i % len(OTHER)]
    return listing(b, m, st, c, p, [placeholder(b, m, i)])

def main():
    locs = json.load(open(os.path.join(ROOT, "data", "market", "locations.json"), encoding="utf-8"))
    for c, k, _ in PLACES: assert k in locs[c], (c, k)
    sellers = []
    for i, name in enumerate(PEOPLE):
        l = apple(i) if i % 2 == 0 else other(i)
        l["package"] = ["bronze", "silver", "gold"][i % 3]
        sellers.append({"id": f"demo-s{i + 1:02d}", "name": name, "dealer": False, "ageDays": rnd.randint(5, 200), "listings": [l]})
    j = 0
    for i, (name, plan) in enumerate(DEALERS):
        items = []
        for k in range(2 + (i % 2)):
            items.append(apple(j + 3) if (j % 3) else other(j + 7)); j += 1
        sellers.append({"id": f"demo-d{i + 1:02d}", "name": name, "dealer": True, "plan": plan, "ageDays": rnd.randint(30, 400), "listings": items})
    for s in sellers:
        for l in s["listings"]:
            for p in l["photos"]: assert os.path.exists(os.path.join(ROOT, p.lstrip("/"))), p
    json.dump({"sellers": sellers}, open(os.path.join(ROOT, "data", "market", "demo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(sellers), "sample sellers,", sum(len(s["listings"]) for s in sellers), "sample listings")

if __name__ == "__main__":
    main()
