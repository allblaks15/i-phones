// Marketplace API: one function, routed by path (/api/m/<path>/ is rewritten to /api/m?path=<path>).
// Secrets come from environment variables only:
//   DATABASE_URL, AUTH_SECRET, ADMIN_EMAILS, PAYSTACK_SECRET_KEY, BLOB_READ_WRITE_TOKEN, SITE_URL, SMTP_* (see _lib/mail.js)
const crypto = require("crypto");
const { q, one } = require("./_lib/db.js");
const { smtpSend } = require("./_lib/mail.js");
const CFG = require("./_lib/market.json");

const SITE = process.env.SITE_URL || CFG.site.url;
const DAY = 86400000;
const now = () => Date.now();
const id = (n = 10) => crypto.randomBytes(16).toString("base64url").replace(/[-_]/g, "").slice(0, n).toLowerCase();
const sha = (s) => crypto.createHash("sha256").update(String(s) + (process.env.AUTH_SECRET || "dev-secret")).digest("hex");
const clean = (v, max = 200) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const cleanText = (v, max = 3000) => String(v == null ? "" : v).replace(/\r\n/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").trim().slice(0, max);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ksh = (n) => "KSh " + Number(n).toLocaleString("en-KE");
const isEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(e);
function kePhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (/^0[17]\d{8}$/.test(d)) return "254" + d.slice(1);
  if (/^254[17]\d{8}$/.test(d)) return d;
  if (/^[17]\d{8}$/.test(d)) return "254" + d;
  return "";
}
const admins = () => (process.env.ADMIN_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
const isStaff = (u) => u && (u.role === "admin" || u.role === "editor");
const pkgFor = (type, plan) => (CFG.packages[type] || {})[plan];

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

// ---------- request helpers ----------
function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => { size += c.length; if (size > 3 * 1024 * 1024) { reject(new HttpError(413, "Upload too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function cookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function setSession(res, token, maxAge) {
  const secure = process.env.DEV_INSECURE_COOKIE ? "" : "; Secure";
  res.setHeader("Set-Cookie", `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}
async function currentUser(req) {
  const t = cookies(req).sid;
  if (!t) return null;
  const s = await one("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > $2", [sha(t), now()]);
  return s;
}
const hits = new Map();
function limit(key, max, windowMs) {
  const t = now(), arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
  if (arr.length >= max) fail(429, "Too many requests. Please wait a few minutes and try again.");
  arr.push(t); hits.set(key, arr);
}

// ---------- listing helpers ----------
const LIVE = "status = 'active' AND (expires_at IS NULL OR expires_at > $1)";
function publicListing(r, withSeller = true) {
  const o = {
    id: r.id, title: r.title, brand: r.brand, model: r.model, condition: r.condition, conditionLabel: CFG.conditions[r.condition] || r.condition,
    storage: r.storage, color: r.color, price: Number(r.price), county: r.county, constituency: r.constituency, area: r.area,
    description: r.description, photos: JSON.parse(r.photos || "[]"), rank: Number(r.rank), package: r.package,
    isDemo: !!Number(r.is_demo), createdAt: Number(r.created_at), views: Number(r.views || 0),
  };
  if (withSeller) o.seller = { id: r.user_id, name: r.seller_name, dealer: r.account_type === "dealer" };
  return o;
}
function ownerListing(r) {
  return Object.assign(publicListing(r, false), { status: r.status, rejectReason: r.reject_reason, expiresAt: r.expires_at == null ? null : Number(r.expires_at), contacts: Number(r.contacts || 0), imei: r.imei || "" });
}
function validPhotoUrl(u) {
  return typeof u === "string" && u.length < 400 && (/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/market\/[A-Za-z0-9._\/-]+$/.test(u) || /^\/images\/market\/[a-z0-9._-]+$/.test(u) || (process.env.BLOB_DEV_DIR && /^\/__blob\/[A-Za-z0-9._-]+$/.test(u)));
}
function listingInput(b) {
  const brand = clean(b.brand, 40);
  if (!CFG.brands[brand]) fail(400, "Choose a phone brand.");
  let model = clean(b.model, 60);
  if (model === "__other" || brand === "Other") model = clean(b.model_other, 60);
  if (!model) fail(400, "Choose or type the phone model.");
  if (brand !== "Other" && b.model !== "__other" && !CFG.brands[brand].includes(model)) fail(400, "Choose a model from the list, or pick Other.");
  const condition = clean(b.condition, 20);
  if (!CFG.conditions[condition]) fail(400, "Choose the phone's condition.");
  const storage = clean(b.storage, 10);
  if (storage && !CFG.storage.includes(storage)) fail(400, "Choose a storage size.");
  const price = Math.round(Number(String(b.price || "").replace(/[^\d.]/g, "")));
  if (!(price >= 500 && price <= 2000000)) fail(400, "Enter a price between KSh 500 and KSh 2,000,000.");
  const county = clean(b.county, 40);
  if (!CFG.locations[county]) fail(400, "Choose a county.");
  const constituency = clean(b.constituency, 60);
  if (!CFG.locations[county].includes(constituency)) fail(400, "Choose a constituency.");
  const area = clean(b.area, 80);
  if (area.length < 2) fail(400, "Enter your town or estate.");
  const photos = Array.isArray(b.photos) ? b.photos.filter(validPhotoUrl).slice(0, CFG.maxPhotos) : [];
  if (!photos.length) fail(400, "Add at least one photo.");
  const prefix = brand === "Apple" || brand === "Other" || model.toLowerCase().startsWith(brand.toLowerCase()) ? "" : brand + " ";
  return {
    brand, model, condition, storage, price, county, constituency, area, photos,
    color: clean(b.color, 30), description: cleanText(b.description, 2000), imei: clean(b.imei, 20).replace(/\D/g, "").slice(0, 17),
    title: clean(`${prefix}${model}${storage ? " " + storage : ""}`, 120),
  };
}
async function activeSub(userId) {
  return one("SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' AND expires_at > $2 ORDER BY expires_at DESC", [userId, now()]);
}
async function liveCount(userId) {
  return Number((await one(`SELECT COUNT(*) AS n FROM listings WHERE user_id = $2 AND ${LIVE}`, [now(), userId])).n);
}

// ---------- payments ----------
async function markPaid(payment, by) {
  const updated = await q("UPDATE payments SET status = 'paid', paid_at = $1, verified_by = $2 WHERE id = $3 AND status <> 'paid' RETURNING *", [now(), by, payment.id]);
  if (!updated.length) return false;
  if (payment.kind === "listing") await q("UPDATE listings SET status = 'pending_approval', updated_at = $1 WHERE id = $2 AND status IN ('pending_payment','expired','rejected')", [now(), payment.target_id]);
  else await q("UPDATE subscriptions SET status = 'pending_approval' WHERE id = $1 AND status = 'pending_payment'", [payment.target_id]);
  return true;
}
async function paystack(path, opts = {}) {
  if (process.env.PAYSTACK_DEV === "mock") return mockPaystack(path, opts);
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) fail(503, "Card and M-Pesa online payments are not set up yet. Use the Paybill option.");
  const res = await fetch("https://api.paystack.co" + path, { ...opts, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.status) fail(502, "Payment provider error: " + (body.message || res.status));
  return body.data;
}
function mockPaystack(path, opts) {
  if (path === "/transaction/initialize") { const b = JSON.parse(opts.body); return { authorization_url: `${b.callback_url}?reference=${b.reference}`, reference: b.reference }; }
  const ref = path.split("/").pop();
  return { status: "success", reference: ref, currency: "KES", amount: Number(ref.split("_")[1] || 0) * 100 };
}
async function confirmPaystack(reference) {
  const p = await one("SELECT * FROM payments WHERE reference = $1 AND method = 'paystack'", [reference]);
  if (!p) fail(404, "Payment not found.");
  if (p.status === "paid") return p;
  const d = await paystack("/transaction/verify/" + encodeURIComponent(reference));
  if (d.status === "success" && d.currency === "KES" && Number(d.amount) === Number(p.amount) * 100) { await markPaid(p, "paystack"); return Object.assign(p, { status: "paid" }); }
  if (["failed", "abandoned", "reversed"].includes(d.status)) await q("UPDATE payments SET status = 'failed' WHERE id = $1 AND status = 'pending'", [p.id]);
  return p;
}

// ---------- approvals ----------
async function approveListing(l) {
  const pkg = pkgFor("individual", l.package);
  const exp = pkg && pkg.days ? now() + pkg.days * DAY : null;
  await q("UPDATE listings SET status = 'active', approved_at = $1, expires_at = $2, rank = $3, reject_reason = NULL, updated_at = $1 WHERE id = $4", [now(), exp, pkg ? pkg.rank : 1, l.id]);
}
async function approveSub(s) {
  const pkg = pkgFor("dealer", s.plan);
  const current = await activeSub(s.user_id);
  const start = current ? Number(current.expires_at) : now();
  const exp = start + pkg.days * DAY;
  await q("UPDATE subscriptions SET status = 'active', starts_at = $1, expires_at = $2 WHERE id = $3", [start, exp, s.id]);
  // bring the dealer's unsold listings live under the new plan, newest first, up to the plan limit
  const rows = await q("SELECT id FROM listings WHERE user_id = $1 AND status IN ('active','pending_payment','expired') ORDER BY created_at DESC", [s.user_id]);
  const keep = pkg.limit == null ? rows : rows.slice(0, pkg.limit);
  for (const r of keep) await q("UPDATE listings SET status = 'active', package = $1, rank = $2, expires_at = $3, approved_at = COALESCE(approved_at, $4), updated_at = $4 WHERE id = $5", ["dealer-" + s.plan, pkg.rank, exp, now(), r.id]);
}

// ---------- seller WhatsApp link ----------
function contactLink(l, seller) {
  const url = `${SITE}/m/${l.id}/`;
  const text = `Hi ${seller.name}, I saw your ${l.title} for ${ksh(l.price)} on i-phones.co.ke: ${url} I am interested. Is it still available?`;
  return `https://wa.me/${seller.phone}?text=${encodeURIComponent(text)}`;
}

// ---------- page rendering (listing detail, server-side for SEO and WhatsApp previews) ----------
let TPL = null;
function renderListingPage(l, seller) {
  if (!TPL) TPL = require("fs").readFileSync(require("path").join(__dirname, "_lib", "listing.html"), "utf8");
  const photos = JSON.parse(l.photos || "[]");
  const abs = (u) => (u.startsWith("http") ? u : SITE + u);
  const loc = `${l.area}, ${l.constituency}, ${l.county}`;
  const cond = CFG.conditions[l.condition] || l.condition;
  const title = `${l.title} for Sale in ${l.county} – ${ksh(l.price)} | i-phones`;
  const desc = clean(`${cond} ${l.title} for ${ksh(l.price)} in ${loc}. ${l.description || ""}`, 158);
  const demo = !!Number(l.is_demo);
  const isApple = l.brand === "Apple";
  const gallery = photos.map((p, i) => `<button type="button" data-src="${esc(p)}" aria-label="Photo ${i + 1}"${i === 0 ? ' aria-current="true"' : ""}><img src="${esc(p)}" alt="" width="76" height="76" loading="lazy"></button>`).join("");
  const facts = [["Brand", l.brand], ["Model", l.model], ["Condition", cond], ["Storage", l.storage], ["Colour", l.color], ["Location", loc], ["Seller", (seller.name || "Seller") + (seller.account_type === "dealer" ? " (Dealer)" : "")]]
    .filter((x) => x[1]).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
  const body = `<div class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="../../">Home</a><span>›</span><a href="../../market/">Marketplace</a><span>›</span><a href="../../market/?brand=${encodeURIComponent(l.brand)}">${esc(l.brand)}</a><span>›</span><span>${esc(l.title)}</span></nav>
<div class="pdp">
  <div class="gallery"><div class="gallery-main mk-photo">${demo ? '<span class="badge">Sample listing</span>' : Number(l.rank) >= 3 ? '<span class="badge gold">Top listing</span>' : ""}<img id="gallery-main" src="${esc(photos[0] || "")}" alt="${esc(l.title)} for sale in ${esc(l.county)}" width="800" height="800"></div><div class="thumbs">${photos.length > 1 ? gallery : ""}</div></div>
  <div class="pdp-info">
    <span class="eyebrow">${esc(cond)} · ${esc(l.county)}</span>
    <h1>${esc(l.title)}</h1>
    <p class="tagline">📍 ${esc(loc)}</p>
    <div class="pdp-price"><strong>${ksh(l.price)}</strong><span>Listed ${new Date(Number(l.created_at)).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</span></div>
    ${demo ? '<p class="mk-demo-note">This is a sample listing that shows how the marketplace works. It is not a real phone for sale.</p><button class="btn btn-wa btn-block" disabled>Contact seller on WhatsApp</button>'
      : `<button class="btn btn-wa btn-block" data-contact="${esc(l.id)}">${CFG.waIcon}Contact seller on WhatsApp</button><p class="order-note">Meet in a safe public place and inspect the phone before you pay.</p>`}
    ${isApple ? `<div class="mk-new-cta"><b>Prefer a brand-new iPhone?</b><span>Buy new from i-phones, with our shop in Nairobi.</span><a class="btn btn-dark btn-sm" href="https://wa.me/${CFG.site.whatsapp}?text=${encodeURIComponent("Hello i-phones, I'd like a brand-new " + l.model + ". I saw a listing on your marketplace: " + SITE + "/m/" + l.id + "/")}" target="_blank" rel="noopener">Ask i-phones on WhatsApp</a></div>` : ""}
    <div class="specs" style="margin-top:18px"><table><tbody>${facts}</tbody></table></div>
    ${l.description ? `<div class="mk-desc"><h2>Description</h2><p>${esc(l.description).replace(/\n/g, "<br>")}</p></div>` : ""}
    <div class="mk-safety"><b>Stay safe</b><ul><li>Never send money before seeing the phone.</li><li>Check the IMEI by dialling *#06# and make sure iCloud or Google account is signed out.</li><li>Meet in a busy public place.</li></ul><a href="../../market/terms/">Marketplace rules</a></div>
  </div>
</div>
<section class="section" style="padding-top:10px"><div class="section-head"><div><span class="eyebrow">More phones</span><h2>Similar phones for sale.</h2></div><a class="link-arrow" href="../../market/?brand=${encodeURIComponent(l.brand)}">All ${esc(l.brand)} phones →</a></div><div class="mk-grid" id="mk-similar" data-brand="${esc(l.brand)}" data-exclude="${esc(l.id)}"></div></section>
</div>`;
  const schema = demo ? "" : `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: l.title, brand: { "@type": "Brand", name: l.brand }, image: photos.map(abs), description: desc,
    offers: { "@type": "Offer", price: Number(l.price), priceCurrency: "KES", availability: "https://schema.org/InStock", itemCondition: l.condition === "new" ? "https://schema.org/NewCondition" : l.condition === "damaged" ? "https://schema.org/DamagedCondition" : l.condition === "ex-uk" ? "https://schema.org/RefurbishedCondition" : "https://schema.org/UsedCondition", url: `${SITE}/m/${l.id}/`, areaServed: { "@type": "Place", name: l.county + ", Kenya" } } }).replace(/</g, "\\u003c")}</script>`;
  return TPL.split("%%TITLE%%").join(esc(title)).split("%%DESC%%").join(esc(desc)).split("%%ID%%").join(esc(l.id))
    .split("%%OGIMG%%").join(esc(photos[0] ? abs(photos[0]) : SITE + "/images/og.jpg")).replace("%%SCHEMA%%", schema)
    .replace("%%ROBOTS%%", demo ? "noindex,follow" : "index,follow").replace("%%BODY%%", body);
}

// ---------- routes ----------
const routes = {};
const on = (method, pattern, fn) => { (routes[method] = routes[method] || []).push([new RegExp("^" + pattern + "$"), fn]); };

on("GET", "config", async () => ({ brands: CFG.brands, conditions: CFG.conditions, storage: CFG.storage, packages: CFG.packages, locations: CFG.locations, maxPhotos: CFG.maxPhotos, paybill: CFG.paybill, paystack: !!(process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_DEV) }));

// auth
on("POST", "auth/request", async ({ body, ip }) => {
  const email = clean(body.email, 200).toLowerCase();
  if (!isEmail(email)) fail(400, "Enter a valid email address.");
  limit("otp-ip:" + ip, 10, 3600000); limit("otp:" + email, 5, 3600000);
  const code = String(crypto.randomInt(100000, 1000000));
  await q("DELETE FROM otps WHERE email = $1 OR expires_at < $2", [email, now()]);
  await q("INSERT INTO otps (email, code_hash, expires_at, attempts, created_at) VALUES ($1, $2, $3, 0, $4)", [email, sha(email + ":" + code), now() + 10 * 60000, now()]);
  await smtpSend({ from: process.env.SMTP_USER, to: email, fromName: "i-phones Marketplace", subject: `Your i-phones login code: ${code}`,
    text: `Your i-phones login code is ${code}\n\nIt expires in 10 minutes. If you did not ask for it, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto"><h2>Your login code</h2><p style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you did not ask for it, you can ignore this email.</p><p style="color:#888">i-phones.co.ke marketplace</p></div>` });
  return { ok: true };
});
on("POST", "auth/verify", async ({ body, res }) => {
  const email = clean(body.email, 200).toLowerCase(), code = clean(body.code, 10).replace(/\D/g, "");
  const row = await one("SELECT * FROM otps WHERE email = $1 AND expires_at > $2", [email, now()]);
  if (!row) fail(400, "That code has expired. Request a new one.");
  if (Number(row.attempts) >= 5) fail(429, "Too many wrong codes. Request a new one.");
  if (row.code_hash !== sha(email + ":" + code)) { await q("UPDATE otps SET attempts = attempts + 1 WHERE email = $1", [email]); fail(400, "Wrong code. Check your email and try again."); }
  await q("DELETE FROM otps WHERE email = $1", [email]);
  let u = await one("SELECT * FROM users WHERE email = $1", [email]);
  if (!u) { await q("INSERT INTO users (id, email, created_at) VALUES ($1, $2, $3)", [id(12), email, now()]); u = await one("SELECT * FROM users WHERE email = $1", [email]); }
  if (admins().includes(email) && u.role !== "admin") { await q("UPDATE users SET role = 'admin' WHERE id = $1", [u.id]); u.role = "admin"; }
  const token = crypto.randomBytes(32).toString("base64url");
  await q("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [sha(token), u.id, now() + 30 * DAY]);
  setSession(res, token, 30 * 86400);
  return { ok: true };
});
on("POST", "auth/logout", async ({ req, res }) => { const t = cookies(req).sid; if (t) await q("DELETE FROM sessions WHERE token_hash = $1", [sha(t)]); setSession(res, "", 0); return { ok: true }; });

on("GET", "me", async ({ user }) => {
  if (!user) return { user: null };
  const sub = user.account_type === "dealer" ? await activeSub(user.id) : null;
  const pendingSub = await one("SELECT * FROM subscriptions WHERE user_id = $1 AND status IN ('pending_payment','pending_approval') ORDER BY created_at DESC", [user.id]);
  return { user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, accountType: user.account_type, staff: isStaff(user) },
    subscription: sub && { plan: sub.plan, expiresAt: Number(sub.expires_at), limit: pkgFor("dealer", sub.plan).limit, live: await liveCount(user.id) },
    pendingSubscription: pendingSub && { id: pendingSub.id, plan: pendingSub.plan, status: pendingSub.status } };
});
on("POST", "me/profile", async ({ user, body }) => {
  if (!user) fail(401, "Please log in.");
  const name = clean(body.name, 60), phone = kePhone(body.phone);
  if (name.length < 2) fail(400, "Enter your name as buyers will see it.");
  if (!phone) fail(400, "Enter a Kenyan WhatsApp number, like 0712 345 678.");
  const type = body.accountType === "dealer" ? "dealer" : "individual";
  if (!body.terms && !user.name) fail(400, "Please accept the marketplace rules.");
  await q("UPDATE users SET name = $1, phone = $2, account_type = $3 WHERE id = $4", [name, phone, type, user.id]);
  return { ok: true };
});

// seller listings
on("GET", "my/listings", async ({ user }) => {
  if (!user) fail(401, "Please log in.");
  const rows = await q("SELECT * FROM listings WHERE user_id = $1 AND status <> 'deleted' ORDER BY created_at DESC", [user.id]);
  const pays = await q("SELECT target_id, status, method FROM payments WHERE user_id = $1 AND kind = 'listing' ORDER BY created_at DESC", [user.id]);
  return { listings: rows.map((r) => Object.assign(ownerListing(r), { payment: pays.find((p) => p.target_id === r.id) || null })) };
});
on("POST", "listings", async ({ user, body }) => {
  if (!user) fail(401, "Please log in.");
  if (!user.name || !user.phone) fail(400, "Complete your profile first.");
  limit("create:" + user.id, 30, 3600000);
  const v = listingInput(body);
  let status = "pending_payment", pkg = null, rank = 1, exp = null;
  if (user.account_type === "dealer") {
    const sub = await activeSub(user.id);
    if (sub) {
      const plan = pkgFor("dealer", sub.plan);
      if (plan.limit == null || (await liveCount(user.id)) < plan.limit) { status = "active"; pkg = "dealer-" + sub.plan; rank = plan.rank; exp = Number(sub.expires_at); }
      else fail(400, `Your ${plan.name} plan allows ${plan.limit} live phones. Mark one as sold or upgrade your plan.`);
    }
  } else {
    pkg = clean(body.package, 10);
    if (!pkgFor("individual", pkg)) fail(400, "Choose a listing package.");
    rank = pkgFor("individual", pkg).rank;
  }
  const lid = id(8);
  await q(`INSERT INTO listings (id, user_id, brand, model, title, condition, storage, color, price, county, constituency, area, description, photos, imei, package, rank, status, expires_at, approved_at, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$21)`,
  [lid, user.id, v.brand, v.model, v.title, v.condition, v.storage, v.color, v.price, v.county, v.constituency, v.area, v.description, JSON.stringify(v.photos), v.imei, pkg, rank, status, exp, status === "active" ? now() : null, now()]);
  return { id: lid, status };
});
on("POST", "listings/([a-z0-9]+)/update", async ({ user, body, m }) => {
  if (!user) fail(401, "Please log in.");
  const l = await one("SELECT * FROM listings WHERE id = $1 AND user_id = $2", [m[1], user.id]);
  if (!l || l.status === "deleted") fail(404, "Listing not found.");
  const v = listingInput(body);
  await q(`UPDATE listings SET brand=$1, model=$2, title=$3, condition=$4, storage=$5, color=$6, price=$7, county=$8, constituency=$9, area=$10, description=$11, photos=$12, imei=$13, updated_at=$14 WHERE id=$15`,
    [v.brand, v.model, v.title, v.condition, v.storage, v.color, v.price, v.county, v.constituency, v.area, v.description, JSON.stringify(v.photos), v.imei, now(), l.id]);
  return { ok: true };
});
on("POST", "listings/([a-z0-9]+)/(sold|delete|package)", async ({ user, body, m }) => {
  if (!user) fail(401, "Please log in.");
  const l = await one("SELECT * FROM listings WHERE id = $1 AND user_id = $2", [m[1], user.id]);
  if (!l) fail(404, "Listing not found.");
  if (m[2] === "package") {
    const pkg = clean(body.package, 10);
    if (!pkgFor("individual", pkg) || user.account_type === "dealer") fail(400, "Choose a listing package.");
    if (!["pending_payment", "expired", "rejected"].includes(l.status)) fail(400, "This listing is already paid for.");
    await q("UPDATE listings SET package = $1, rank = $2, status = 'pending_payment', updated_at = $3 WHERE id = $4", [pkg, pkgFor("individual", pkg).rank, now(), l.id]);
  } else await q("UPDATE listings SET status = $1, updated_at = $2 WHERE id = $3", [m[2] === "sold" ? "sold" : "deleted", now(), l.id]);
  return { ok: true };
});

// photo upload: raw image body, already resized in the browser
on("POST", "upload", async ({ user, req, raw }) => {
  if (!user) fail(401, "Please log in.");
  limit("upload:" + user.id, 120, 3600000);
  const type = String(req.headers["content-type"] || "").split(";")[0];
  const ext = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" }[type];
  if (!ext) fail(400, "Photos must be JPG, PNG or WebP.");
  if (!raw.length || raw.length > 2.5 * 1024 * 1024) fail(400, "Each photo must be under 2.5 MB.");
  const name = `${user.id}-${id(10)}.${ext}`;
  if (process.env.BLOB_DEV_DIR) { require("fs").mkdirSync(process.env.BLOB_DEV_DIR, { recursive: true }); require("fs").writeFileSync(require("path").join(process.env.BLOB_DEV_DIR, name), raw); return { url: "/__blob/" + name }; }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) fail(503, "Photo storage is not set up yet.");
  const res = await fetch(`https://blob.vercel-storage.com/market/${name}`, { method: "PUT", body: raw,
    headers: { authorization: `Bearer ${token}`, "x-api-version": "11", "x-content-type": type, "x-vercel-blob-access": "public", "x-add-random-suffix": "0", "x-cache-control-max-age": "31536000" } });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.url) fail(502, "Could not save the photo. Please try again.");
  return { url: out.url };
});

// payments
on("POST", "pay/start", async ({ user, body }) => {
  if (!user) fail(401, "Please log in.");
  let kind, target, pkgKey, amount;
  if (body.kind === "dealer") {
    if (user.account_type !== "dealer") fail(400, "Switch your account to Dealer first.");
    pkgKey = clean(body.plan, 10); const plan = pkgFor("dealer", pkgKey); if (!plan) fail(400, "Choose a dealer plan.");
    let sub = await one("SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'pending_payment' ORDER BY created_at DESC", [user.id]);
    if (sub) await q("UPDATE subscriptions SET plan = $1 WHERE id = $2", [pkgKey, sub.id]);
    else { const sid = id(10); await q("INSERT INTO subscriptions (id, user_id, plan, status, created_at) VALUES ($1, $2, $3, 'pending_payment', $4)", [sid, user.id, pkgKey, now()]); sub = { id: sid }; }
    kind = "dealer"; target = sub.id; amount = plan.price;
  } else {
    const l = await one("SELECT * FROM listings WHERE id = $1 AND user_id = $2", [clean(body.listingId, 20), user.id]);
    if (!l || l.status !== "pending_payment") fail(400, "This listing does not need payment.");
    const plan = pkgFor("individual", l.package); if (!plan) fail(400, "Choose a listing package first.");
    kind = "listing"; target = l.id; pkgKey = l.package; amount = plan.price;
  }
  if (body.method === "mpesa") {
    const code = clean(body.code, 20).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{10}$/.test(code)) fail(400, "Enter the 10-character M-Pesa transaction code from your confirmation SMS.");
    if (await one("SELECT id FROM payments WHERE reference = $1", ["MPESA-" + code])) fail(400, "That M-Pesa code has already been used.");
    await q("INSERT INTO payments (id, user_id, kind, target_id, package, amount, method, reference, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,'mpesa',$7,'pending',$8)", [id(12), user.id, kind, target, pkgKey, amount, "MPESA-" + code, now()]);
    return { ok: true, method: "mpesa" };
  }
  const reference = `ip_${amount}_${id(12)}`;
  await q("INSERT INTO payments (id, user_id, kind, target_id, package, amount, method, reference, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,'paystack',$7,'pending',$8)", [id(12), user.id, kind, target, pkgKey, amount, reference, now()]);
  const d = await paystack("/transaction/initialize", { method: "POST", body: JSON.stringify({ email: user.email, amount: amount * 100, currency: "KES", reference, callback_url: `${SITE}/sell/`, metadata: { kind, target, package: pkgKey } }) });
  return { url: d.authorization_url };
});
on("GET", "pay/verify", async ({ user, query }) => {
  if (!user) fail(401, "Please log in.");
  const p = await confirmPaystack(clean(query.reference, 80));
  return { status: p.status };
});
on("POST", "pay/webhook", async ({ req, raw }) => {
  const key = process.env.PAYSTACK_SECRET_KEY || "";
  const sig = crypto.createHmac("sha512", key).update(raw).digest("hex");
  if (!key || sig !== req.headers["x-paystack-signature"]) fail(401, "Bad signature");
  const evt = JSON.parse(raw.toString("utf8"));
  if (evt.event === "charge.success" && evt.data && evt.data.reference) await confirmPaystack(evt.data.reference).catch(() => {});
  return { ok: true };
});

// public browsing
on("GET", "listings", async ({ query }) => {
  const where = [LIVE], params = [now()];
  const add = (sql, v) => { params.push(v); where.push(sql.replace("?", "$" + params.length)); };
  if (query.brand && CFG.brands[query.brand]) add("l.brand = ?", query.brand);
  if (query.model) add("l.model = ?", clean(query.model, 60));
  if (query.condition && CFG.conditions[query.condition]) add("l.condition = ?", query.condition);
  if (query.county && CFG.locations[query.county]) add("l.county = ?", query.county);
  if (query.min) add("l.price >= ?", Number(query.min) || 0);
  if (query.max) add("l.price <= ?", Number(query.max) || 0);
  if (query.seller) add("l.user_id = ?", clean(query.seller, 20));
  if (query.exclude) add("l.id <> ?", clean(query.exclude, 20));
  if (query.q) add("LOWER(l.title || ' ' || l.area || ' ' || l.county) LIKE ?", "%" + clean(query.q, 60).toLowerCase() + "%");
  const order = { new: "l.created_at DESC", low: "l.price ASC", high: "l.price DESC" }[query.sort] || "l.rank DESC, l.is_demo ASC, l.created_at DESC";
  const per = Math.min(48, Math.max(1, Number(query.per) || 24)), page = Math.max(1, Number(query.page) || 1);
  const w = where.join(" AND ").replace(/\b(status|expires_at)\b/g, "l.$1");
  const rows = await q(`SELECT l.*, u.name AS seller_name, u.account_type FROM listings l JOIN users u ON u.id = l.user_id WHERE ${w} ORDER BY ${order} LIMIT ${per + 1} OFFSET ${(page - 1) * per}`, params);
  return { listings: rows.slice(0, per).map((r) => publicListing(r)), more: rows.length > per, page };
});
on("POST", "contact/([a-z0-9]+)", async ({ m, ip }) => {
  limit("contact:" + ip, 60, 3600000);
  const l = await one(`SELECT l.*, u.name AS seller_name, u.phone AS seller_phone FROM listings l JOIN users u ON u.id = l.user_id WHERE l.id = $2 AND l.${LIVE.replace(/expires_at/, "l.expires_at")}`, [now(), m[1]]);
  if (!l || Number(l.is_demo)) fail(404, "This listing is no longer available.");
  await q("UPDATE listings SET contacts = contacts + 1 WHERE id = $1", [l.id]);
  return { url: contactLink(l, { name: l.seller_name, phone: l.seller_phone }) };
});
on("GET", "page/([a-z0-9]+)", async ({ m, res }) => {
  const l = await one("SELECT l.*, u.name AS seller_name, u.account_type FROM listings l JOIN users u ON u.id = l.user_id WHERE l.id = $1", [m[1]]);
  const live = l && l.status === "active" && (l.expires_at == null || Number(l.expires_at) > now());
  if (!live) { res.statusCode = l && l.status === "sold" ? 410 : 404; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Listing not available | i-phones</title><body style="font-family:sans-serif;text-align:center;padding:80px 16px"><h1>This phone is no longer listed</h1><p>It may have been sold.</p><p><a href="/market/">Browse phones for sale</a></p>`); return null; }
  q("UPDATE listings SET views = views + 1 WHERE id = $1", [l.id]).catch(() => {});
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
  res.end(renderListingPage(l, { name: l.seller_name, account_type: l.account_type }));
  return null;
});
on("GET", "sitemap", async ({ res }) => {
  const rows = await q(`SELECT id, updated_at FROM listings WHERE ${LIVE} AND is_demo = 0 ORDER BY created_at DESC LIMIT 5000`, [now()]);
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` + rows.map((r) => `  <url><loc>${SITE}/m/${r.id}/</loc><lastmod>${new Date(Number(r.updated_at)).toISOString().slice(0, 10)}</lastmod></url>`).join("\n") + "\n</urlset>\n");
  return null;
});

// live chat (visitor side)
on("POST", "chat/start", async ({ body, ip }) => {
  limit("chat-start:" + ip, 10, 3600000);
  const msg = cleanText(body.message, 1500);
  if (!msg) fail(400, "Type a message.");
  const token = crypto.randomBytes(24).toString("base64url"), cid = id(12), t = now();
  await q("INSERT INTO chats (id, token_hash, name, contact, page, status, unread_staff, created_at, last_at) VALUES ($1,$2,$3,$4,$5,'open',1,$6,$6)", [cid, sha(token), clean(body.name, 60), clean(body.contact, 80), clean(body.page, 200), t]);
  await q("INSERT INTO chat_messages (id, chat_id, sender, body, created_at) VALUES ($1,$2,'visitor',$3,$4)", [id(12), cid, msg, t]);
  return { token };
});
async function chatByToken(token) { const c = await one("SELECT * FROM chats WHERE token_hash = $1", [sha(token || "")]); if (!c) fail(404, "Chat not found."); return c; }
on("POST", "chat/send", async ({ body, ip }) => {
  limit("chat-send:" + ip, 60, 600000);
  const c = await chatByToken(body.token), msg = cleanText(body.message, 1500);
  if (!msg) fail(400, "Type a message.");
  await q("INSERT INTO chat_messages (id, chat_id, sender, body, created_at) VALUES ($1,$2,'visitor',$3,$4)", [id(12), c.id, msg, now()]);
  await q("UPDATE chats SET last_at = $1, unread_staff = unread_staff + 1, status = 'open' WHERE id = $2", [now(), c.id]);
  return { ok: true };
});
on("GET", "chat/poll", async ({ query }) => {
  const c = await chatByToken(query.token);
  const rows = await q("SELECT id, sender, staff_name, body, created_at FROM chat_messages WHERE chat_id = $1 AND created_at > $2 ORDER BY created_at ASC LIMIT 100", [c.id, Number(query.after) || 0]);
  return { messages: rows.map((r) => ({ id: r.id, from: r.sender, name: r.staff_name, body: r.body, at: Number(r.created_at) })) };
});

// ---------- staff (admin + editor) ----------
function staff(user) { if (!isStaff(user)) fail(403, "Staff only."); return user; }
function adminOnly(user) { if (!user || user.role !== "admin") fail(403, "Admin only."); return user; }
on("GET", "admin/overview", async ({ user }) => {
  staff(user);
  const n = async (sql, p = []) => Number((await one(sql, p)).n);
  return {
    pendingListings: await n("SELECT COUNT(*) AS n FROM listings WHERE status = 'pending_approval'"),
    pendingSubs: await n("SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'pending_approval'"),
    pendingPayments: await n("SELECT COUNT(*) AS n FROM payments WHERE status = 'pending' AND method = 'mpesa'"),
    liveListings: await n(`SELECT COUNT(*) AS n FROM listings WHERE ${LIVE}`, [now()]),
    openChats: await n("SELECT COUNT(*) AS n FROM chats WHERE unread_staff > 0"),
    users: await n("SELECT COUNT(*) AS n FROM users WHERE is_demo = 0"),
    demo: await n("SELECT COUNT(*) AS n FROM users WHERE is_demo = 1"),
    role: user.role,
  };
});
on("GET", "admin/payments", async ({ user, query }) => {
  staff(user);
  const st = ["pending", "paid", "failed"].includes(query.status) ? query.status : "pending";
  const rows = await q(`SELECT p.*, u.email, u.name, u.phone, l.title FROM payments p JOIN users u ON u.id = p.user_id LEFT JOIN listings l ON l.id = p.target_id WHERE p.status = $1 ORDER BY p.created_at DESC LIMIT 200`, [st]);
  return { payments: rows.map((r) => ({ id: r.id, kind: r.kind, package: r.package, amount: Number(r.amount), method: r.method, reference: r.reference, status: r.status, createdAt: Number(r.created_at), seller: { name: r.name, email: r.email, phone: r.phone }, listingTitle: r.title, targetId: r.target_id })) };
});
on("POST", "admin/payments/([a-z0-9]+)/(confirm|reject)", async ({ user, m }) => {
  staff(user);
  const p = await one("SELECT * FROM payments WHERE id = $1", [m[1]]);
  if (!p) fail(404, "Payment not found.");
  if (m[2] === "reject") { await q("UPDATE payments SET status = 'failed', verified_by = $1 WHERE id = $2 AND status = 'pending'", [user.email, p.id]); return { ok: true }; }
  await markPaid(p, user.email);
  // confirming a Paybill payment also approves the seller, as one step
  if (p.kind === "listing") { const l = await one("SELECT * FROM listings WHERE id = $1", [p.target_id]); if (l && l.status === "pending_approval") await approveListing(l); }
  else { const s = await one("SELECT * FROM subscriptions WHERE id = $1", [p.target_id]); if (s && s.status === "pending_approval") await approveSub(s); }
  return { ok: true };
});
on("GET", "admin/queue", async ({ user }) => {
  staff(user);
  const ls = await q("SELECT l.*, u.name AS seller_name, u.email, u.phone, u.account_type FROM listings l JOIN users u ON u.id = l.user_id WHERE l.status = 'pending_approval' ORDER BY l.updated_at ASC LIMIT 200", []);
  const subs = await q("SELECT s.*, u.name, u.email, u.phone FROM subscriptions s JOIN users u ON u.id = s.user_id WHERE s.status = 'pending_approval' ORDER BY s.created_at ASC", []);
  return { listings: ls.map((r) => Object.assign(ownerListing(r), { seller: { name: r.seller_name, email: r.email, phone: r.phone, dealer: r.account_type === "dealer" } })),
    subscriptions: subs.map((s) => ({ id: s.id, plan: s.plan, planName: pkgFor("dealer", s.plan).name, price: pkgFor("dealer", s.plan).price, seller: { name: s.name, email: s.email, phone: s.phone } })) };
});
on("POST", "admin/listings/([a-z0-9]+)/(approve|reject|delete|sold)", async ({ user, body, m }) => {
  staff(user);
  const l = await one("SELECT * FROM listings WHERE id = $1", [m[1]]);
  if (!l) fail(404, "Listing not found.");
  if (m[2] === "approve") {
    if (l.status !== "pending_approval" && !(l.status === "rejected" && l.approved_at)) fail(400, "Only paid listings waiting for approval can be approved.");
    await approveListing(l);
  } else if (m[2] === "reject") await q("UPDATE listings SET status = 'rejected', reject_reason = $1, updated_at = $2 WHERE id = $3", [clean(body.reason, 200) || "Did not meet the marketplace rules", now(), l.id]);
  else await q("UPDATE listings SET status = $1, updated_at = $2 WHERE id = $3", [m[2] === "sold" ? "sold" : "deleted", now(), l.id]);
  return { ok: true };
});
on("POST", "admin/subscriptions/([a-z0-9]+)/(approve|reject)", async ({ user, m }) => {
  staff(user);
  const s = await one("SELECT * FROM subscriptions WHERE id = $1", [m[1]]);
  if (!s || s.status !== "pending_approval") fail(400, "This plan is not waiting for approval.");
  if (m[2] === "approve") await approveSub(s); else await q("UPDATE subscriptions SET status = 'rejected' WHERE id = $1", [s.id]);
  return { ok: true };
});
on("GET", "admin/listings", async ({ user, query }) => {
  staff(user);
  const st = clean(query.status, 20) || "active", params = [st];
  let sql = "SELECT l.*, u.name AS seller_name, u.email, u.phone, u.account_type FROM listings l JOIN users u ON u.id = l.user_id WHERE l.status = $1";
  if (query.q) { params.push("%" + clean(query.q, 60).toLowerCase() + "%"); sql += ` AND LOWER(l.title || ' ' || u.email || ' ' || COALESCE(u.name,'')) LIKE $${params.length}`; }
  const rows = await q(sql + " ORDER BY l.updated_at DESC LIMIT 200", params);
  return { listings: rows.map((r) => Object.assign(ownerListing(r), { seller: { name: r.seller_name, email: r.email, phone: r.phone, dealer: r.account_type === "dealer" } })) };
});
on("GET", "admin/users", async ({ user }) => {
  staff(user);
  const rows = await q("SELECT u.*, (SELECT COUNT(*) FROM listings l WHERE l.user_id = u.id AND l.status = 'active') AS live FROM users u WHERE u.is_demo = 0 ORDER BY u.created_at DESC LIMIT 300", []);
  return { users: rows.map((u) => ({ id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, accountType: u.account_type, live: Number(u.live), createdAt: Number(u.created_at) })) };
});
on("POST", "admin/users/role", async ({ user, body }) => {
  adminOnly(user);
  const email = clean(body.email, 200).toLowerCase(), role = body.role === "editor" ? "editor" : "seller";
  if (!isEmail(email)) fail(400, "Enter a valid email.");
  if (admins().includes(email)) fail(400, "That account is an admin.");
  const ex = await one("SELECT id FROM users WHERE email = $1", [email]);
  if (ex) await q("UPDATE users SET role = $1 WHERE id = $2", [role, ex.id]);
  else await q("INSERT INTO users (id, email, role, created_at) VALUES ($1, $2, $3, $4)", [id(12), email, role, now()]);
  return { ok: true };
});
on("GET", "admin/chats", async ({ user }) => {
  staff(user);
  const rows = await q("SELECT c.*, (SELECT body FROM chat_messages m WHERE m.chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_body FROM chats c ORDER BY c.unread_staff DESC, c.last_at DESC LIMIT 100", []);
  return { chats: rows.map((c) => ({ id: c.id, name: c.name, contact: c.contact, page: c.page, status: c.status, unread: Number(c.unread_staff), lastAt: Number(c.last_at), last: c.last_body })) };
});
on("GET", "admin/chats/([a-z0-9]+)", async ({ user, m }) => {
  staff(user);
  const c = await one("SELECT * FROM chats WHERE id = $1", [m[1]]);
  if (!c) fail(404, "Chat not found.");
  await q("UPDATE chats SET unread_staff = 0 WHERE id = $1", [c.id]);
  const rows = await q("SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC", [c.id]);
  return { chat: { id: c.id, name: c.name, contact: c.contact, page: c.page, status: c.status }, messages: rows.map((r) => ({ from: r.sender, name: r.staff_name, body: r.body, at: Number(r.created_at) })) };
});
on("POST", "admin/chats/([a-z0-9]+)/(reply|close)", async ({ user, body, m }) => {
  staff(user);
  const c = await one("SELECT * FROM chats WHERE id = $1", [m[1]]);
  if (!c) fail(404, "Chat not found.");
  if (m[2] === "close") { await q("UPDATE chats SET status = 'closed', unread_staff = 0 WHERE id = $1", [c.id]); return { ok: true }; }
  const msg = cleanText(body.message, 1500);
  if (!msg) fail(400, "Type a reply.");
  await q("INSERT INTO chat_messages (id, chat_id, sender, staff_name, body, created_at) VALUES ($1,$2,'staff',$3,$4,$5)", [id(12), c.id, (user.name || "i-phones team").split(" ")[0], msg, now()]);
  await q("UPDATE chats SET last_at = $1, unread_staff = 0 WHERE id = $2", [now(), c.id]);
  return { ok: true };
});
on("POST", "admin/demo/(seed|clear)", async ({ user, m }) => {
  adminOnly(user);
  if (m[1] === "clear") {
    await q("DELETE FROM listings WHERE is_demo = 1", []);
    await q("DELETE FROM subscriptions WHERE user_id IN (SELECT id FROM users WHERE is_demo = 1)", []);
    await q("DELETE FROM users WHERE is_demo = 1", []);
    return { ok: true };
  }
  const DEMO = require("./_lib/demo.json"), t = now();
  if (Number((await one("SELECT COUNT(*) AS n FROM users WHERE is_demo = 1", [])).n)) fail(400, "Sample data is already loaded.");
  for (const s of DEMO.sellers) {
    await q("INSERT INTO users (id, email, name, phone, role, account_type, is_demo, created_at) VALUES ($1,$2,$3,NULL,'seller',$4,1,$5)", [s.id, s.id + "@sample.invalid", s.name, s.dealer ? "dealer" : "individual", t - s.ageDays * DAY]);
    if (s.dealer) await q("INSERT INTO subscriptions (id, user_id, plan, status, starts_at, expires_at, created_at) VALUES ($1,$2,$3,'active',$4,$5,$4)", [id(10), s.id, s.plan, t, t + 30 * DAY]);
    for (const l of s.listings) {
      const pkg = s.dealer ? pkgFor("dealer", s.plan) : pkgFor("individual", l.package);
      await q(`INSERT INTO listings (id, user_id, brand, model, title, condition, storage, color, price, county, constituency, area, description, photos, package, rank, status, expires_at, approved_at, is_demo, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'active',$17,$18,1,$18,$18)`,
      [id(8), s.id, l.brand, l.model, l.title, l.condition, l.storage, l.color, l.price, l.county, l.constituency, l.area, l.description, JSON.stringify(l.photos),
        s.dealer ? "dealer-" + s.plan : l.package, pkg.rank, pkg.days ? t + pkg.days * DAY : null, t - l.ageHours * 3600000]);
    }
  }
  return { ok: true, sellers: DEMO.sellers.length };
});

// ---------- handler ----------
module.exports = async (req, res) => {
  const url = new URL(req.url, "http://x");
  const path = (url.searchParams.get("path") || url.pathname.replace(/^\/api\/m\/?/, "")).replace(/^\/+|\/+$/g, "");
  const query = Object.fromEntries(url.searchParams);
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "local";
  try {
    const list = routes[req.method] || [];
    let match = null, fn = null;
    for (const [re, f] of list) { const mm = path.match(re); if (mm) { match = mm; fn = f; break; } }
    if (!fn) fail(404, "Not found");
    let raw = Buffer.alloc(0), body = {};
    if (req.method === "POST") {
      raw = await readRaw(req);
      const ct = String(req.headers["content-type"] || "");
      if (ct.startsWith("application/json")) { try { body = JSON.parse(raw.toString("utf8") || "{}"); } catch { fail(400, "Bad JSON"); } }
      else if (path !== "upload" && path !== "pay/webhook") fail(415, "Send JSON");
    }
    const user = await currentUser(req);
    const out = await fn({ req, res, raw, body, query, m: match, user, ip });
    if (out === null) return;
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(out));
  } catch (e) {
    const status = e.status || (e.code === "NO_DB" ? 503 : 500);
    if (status >= 500) console.error("market api error:", path, e.message);
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: status >= 500 && e.code !== "NO_DB" && !(e instanceof HttpError) ? "Something went wrong. Please try again." : e.message }));
  }
};
