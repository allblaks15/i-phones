"""Generate the free iPhone wallpapers (1290x2796) + small preview thumbnails."""
import os, random
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images", "wallpapers")
os.makedirs(OUT, exist_ok=True)
W, H = 1290, 2796

WALLS = [
    ("cosmic-orange", "Cosmic Orange", (28, 14, 8), [(228, 106, 44), (255, 170, 90), (120, 40, 20), (255, 214, 160)]),
    ("deep-blue", "Deep Blue", (8, 12, 26), [(44, 58, 120), (70, 110, 200), (20, 28, 60), (150, 180, 240)]),
    ("burgundy", "Burgundy", (20, 6, 10), [(120, 34, 50), (190, 70, 90), (60, 14, 24), (240, 150, 160)]),
    ("glacier", "Glacier", (196, 214, 226), [(255, 255, 255), (150, 190, 215), (210, 230, 240), (120, 160, 200)]),
    ("sage", "Sage", (30, 38, 30), [(150, 175, 130), (90, 120, 85), (210, 220, 180), (60, 80, 60)]),
    ("lavender", "Lavender", (40, 30, 60), [(190, 170, 230), (130, 100, 200), (240, 220, 250), (90, 70, 150)]),
    ("desert-titanium", "Desert Titanium", (44, 34, 26), [(200, 165, 130), (150, 115, 85), (240, 215, 185), (100, 75, 55)]),
    ("midnight", "Midnight", (4, 4, 8), [(40, 40, 60), (90, 70, 140), (20, 50, 80), (160, 120, 200)]),
    ("champagne-gold", "Champagne Gold", (14, 12, 10), [(168, 131, 79), (230, 196, 140), (80, 60, 35), (255, 235, 200)]),
    ("savanna-dusk", "Savanna Dusk", (24, 10, 20), [(240, 120, 60), (200, 60, 90), (90, 40, 120), (255, 190, 110)]),
    ("ocean-mombasa", "Mombasa Ocean", (2, 20, 30), [(0, 150, 170), (30, 90, 160), (120, 220, 210), (10, 50, 90)]),
    ("graphite", "Graphite", (18, 18, 20), [(90, 90, 96), (150, 150, 156), (50, 50, 56), (200, 200, 205)]),
]

def make(slug, colors_base, blobs, seed):
    rnd = random.Random(seed)
    s = 4  # draw small then scale up for smooth gradients
    w, h = W // s, H // s
    img = Image.new("RGB", (w, h), colors_base)
    # soft colour fields
    for c in blobs:
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        r = rnd.randint(int(w * .35), int(w * .7))
        cx = rnd.randint(0, w)
        cy = rnd.randint(int(h * .1), int(h * .9))
        d.ellipse([cx - r, cy - int(r * 1.4), cx + r, cy + int(r * 1.4)], fill=c + (rnd.randint(170, 235),))
        layer = layer.filter(ImageFilter.GaussianBlur(rnd.randint(28, 50)))
        img.paste(layer, (0, 0), layer)
    # glowing ribbons (iOS-style light folds)
    for k in range(3):
        c = blobs[(k + 1) % len(blobs)]
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        r = rnd.randint(int(w * .8), int(w * 1.4))
        cx = rnd.choice([-int(r * .35), w + int(r * .35)])
        cy = rnd.randint(int(h * .2), int(h * .8))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c + (255,), width=rnd.randint(18, 34))
        glow = layer.filter(ImageFilter.GaussianBlur(14))
        img.paste(glow, (0, 0), glow)
        core = layer.filter(ImageFilter.GaussianBlur(4))
        img.paste(core, (0, 0), core)
    img = img.filter(ImageFilter.GaussianBlur(3)).resize((W, H), Image.BICUBIC)
    img = ImageEnhance.Color(img).enhance(1.25)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    noise = Image.effect_noise((W, H), 9).convert("RGB")
    return Image.blend(img, noise, 0.03)

for i, (slug, name, base, blobs) in enumerate(WALLS):
    im = make(slug, base, blobs, i * 7 + 3)
    im.save(os.path.join(OUT, f"{slug}.jpg"), "JPEG", quality=88, optimize=True, progressive=True)
    th = im.copy(); th.thumbnail((360, 780))
    th.save(os.path.join(OUT, f"{slug}-thumb.webp"), "WEBP", quality=78)
    print(slug, os.path.getsize(os.path.join(OUT, f"{slug}.jpg")) // 1024, "KB")
