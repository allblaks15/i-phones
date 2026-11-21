// Insert SAMPLE sellers into the marketplace database (same rules as the admin "Load sample data" button).
// Every row is flagged is_demo: labelled "Sample", not contactable, kept out of Google,
// and removed by "Remove all sample data" in the dashboard.
//   node tools/seed_samples.js [count]      (reads DATABASE_URL from the environment or .env.local)
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
if (!process.env.DATABASE_URL && fs.existsSync(path.join(ROOT, ".env.local"))) {
  for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = l.match(/^DATABASE_URL="?(.*?)"?$/); if (m) process.env.DATABASE_URL = m[1];
  }
}
const { q, one } = require(path.join(ROOT, "api", "_lib", "db.js"));
const CFG = require(path.join(ROOT, "api", "_lib", "market.json"));
const DEMO = require(path.join(ROOT, "api", "_lib", "demo.json"));
const DAY = 86400000, id = (n) => crypto.randomBytes(16).toString("base64url").replace(/[-_]/g, "").slice(0, n).toLowerCase();

(async () => {
  const want = Number(process.argv[2] || 15);
  const picks = DEMO.sellers.filter((s) => !s.dealer).slice(0, want);
  const t = Date.now();
  let added = 0, listings = 0;
  for (const s of picks) {
    if (await one("SELECT id FROM users WHERE id = $1", [s.id])) continue;
    await q("INSERT INTO users (id, email, name, phone, role, account_type, is_demo, created_at) VALUES ($1,$2,$3,NULL,'seller','individual',1,$4)", [s.id, s.id + "@sample.invalid", s.name, t - s.ageDays * DAY]);
    for (const l of s.listings) {
      const pkg = CFG.packages.individual[l.package];
      await q(`INSERT INTO listings (id, user_id, brand, model, title, condition, storage, color, price, county, constituency, area, description, photos, package, rank, status, expires_at, approved_at, is_demo, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'active',$17,$18,1,$18,$18)`,
      [id(8), s.id, l.brand, l.model, l.title, l.condition, l.storage, l.color, l.price, l.county, l.constituency, l.area, l.description, JSON.stringify(l.photos),
        l.package, pkg.rank, pkg.days ? t + pkg.days * DAY : null, t - l.ageHours * 3600000]);
      listings++;
    }
    added++;
  }
  const total = (await one("SELECT COUNT(*) AS n FROM users WHERE is_demo = 1", [])).n;
  console.log(`added ${added} sample sellers with ${listings} listings; sample sellers now in database: ${total}`);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
