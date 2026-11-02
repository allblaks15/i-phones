"""Map each target keyword to the article that covers it. Writes data/keyword-map.csv.
Usage: python tools/keyword_map.py keywords.xlsx"""
import csv, os, re, sys, collections
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OFF_TOPIC = r"huawei|tecno|tigi|ipod|smart watch|elite digital"
GHOST = (r"iphone (1|2|3|9)( |$)|iphone 9|iphone 10 (plus|pro|max)|iphone 10x|iphone 11 (mini|plus|max)|iphone 12 (plus|max)|iphone 13 (plus|max pro)|iphone 14 mini"
         r"|iphone (6|7|8) pro|iphone (7|8)s|iphone x (plus|pro|max pro)|iphone xs plus|iphone xr max|iphone s ?\d|iphone s price|iphone max price|iphone pro price")
RULES = [  # first match wins
    (r"screen|battery|motherboard", "iphone-screen-and-battery-replacement-cost-in-kenya"),
    (r"charger|cable|earphones", "iphone-charger-and-accessories-in-kenya"),
    (r"installment", "buy-iphone-on-installments-in-kenya"),
    (r"a1332|a1387|iphone (2|3|3gs|4|4s|5|5c|5s)( |$)|iphone 5 s", "old-iphones-in-kenya"),
    (r"a1586", "iphone-6-price-in-kenya"),
    (GHOST, "iphone-models-that-do-not-exist"),
    (r"iphone 16|16 pro", "iphone-16-price-in-kenya"),
    (r"iphone 15|15 pro", "iphone-15-price-in-kenya"),
    (r"14 ?pro ?max|pro max 14", "iphone-14-pro-max-price-in-kenya"),
    (r"14 ?pro", "iphone-14-pro-price-in-kenya"),
    (r"iphone ?14", "iphone-14-price-in-kenya"),
    (r"13 ?pro ?max|pro max 13|i13", "iphone-13-pro-max-price-in-kenya"),
    (r"13 ?pro", "iphone-13-pro-price-in-kenya"),
    (r"iphone ?13", "iphone-13-price-in-kenya"),
    (r"12 ?pro ?max|pro max 12", "iphone-12-pro-max-price-in-kenya"),
    (r"12 ?pro", "iphone-12-pro-price-in-kenya"),
    (r"iphone ?12", "iphone-12-price-in-kenya"),
    (r"(iphone |apple )?11 ?pro|pro( max)? 11|iphone ?11|apple 11", "iphone-11-price-in-kenya"),
    (r"xs|x max|10s|10 max", "iphone-xs-max-price-in-kenya"),
    (r"xr|10r", "iphone-xr-price-in-kenya"),
    (r"iphone ?x|iphone 10|price of iphone 10", "iphone-x-price-in-kenya"),
    (r"(iphone|apple) se|^se |5se|price of iphone se", "iphone-se-price-in-kenya"),
    (r"iphone ?8", "iphone-8-price-in-kenya"),
    (r"iphone ?7", "iphone-7-price-in-kenya"),
    (r"iphone ?6|iphone six", "iphone-6-price-in-kenya"),
    (r"refurbished|second hand|used ", "refurbished-iphones-in-kenya"),
    (r"cheap", "cheapest-iphone-in-kenya"),
    (r"latest|most expensive", "latest-iphone-price-in-kenya"),
    (r"jumia|jiji|safaricom|buy |for sale|sale |kilimall", "where-to-buy-iphone-in-kenya"),
]

def norm(k):
    k = k.lower().strip()
    k = re.sub(r"\bi phones?\b", lambda m: m.group(0).replace(" ", ""), k)
    k = re.sub(r"apple iphone", "iphone", k)
    k = re.sub(r"\b(\d\d?) ?(pro|max)", r"\1 \2", k)
    k = re.sub(r"^(\d\d) pro", r"iphone \1 pro", k)
    k = re.sub(r"\b(xr|xs|x)\b price", r"iphone \1 price", k) if not k.startswith("iphone") and "iphone" not in k else k
    k = re.sub(r"iphone(\d)", r"iphone \1", k)
    return k

def assign(k):
    n = norm(k)
    if re.search(OFF_TOPIC, n):
        return ""
    for pat, slug in RULES:
        if re.search(pat, n):
            return slug
    return "iphone-prices-in-kenya"

if __name__ == "__main__":
    ws = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True).worksheets[0]
    kws = [r[0].strip() for r in ws.iter_rows(values_only=True) if r[0]]
    rows = [(k, assign(k)) for k in kws]
    existing = {f[:-3] for f in os.listdir(os.path.join(ROOT, "data", "blog"))}
    missing = {s for _, s in rows if s and s not in existing}
    assert not missing, missing
    with open(os.path.join(ROOT, "data", "keyword-map.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh); w.writerow(["keyword", "article"]); w.writerows([(k, f"/blog/{s}/" if s else "(off-topic, skipped)") for k, s in rows])
    c = collections.Counter(s for _, s in rows)
    print(len(kws), "keywords;", sum(1 for _, s in rows if s), "mapped;", c[""], "skipped")
    for s, n in c.most_common():
        print(f"{n:4} {s or '(skipped)'}")
    print("unused articles:", existing - set(c))
    print("skipped:", [k for k, s in rows if not s])
