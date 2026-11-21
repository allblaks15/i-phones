// Local test server that mimics the Vercel setup: static files + the /api functions + rewrites.
// Uses SQLite, prints emails instead of sending them and fakes Paystack. Never use for production.
//   node tools/devserver.js [port]
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, ".devdata");
Object.assign(process.env, {
  DATABASE_URL: process.env.DATABASE_URL || "sqlite:" + path.join(DATA, "market.db"),
  MAIL_DEV: "log", PAYSTACK_DEV: "mock", BLOB_DEV_DIR: path.join(DATA, "blob"), DEV_INSECURE_COOKIE: "1",
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || "admin@test.local", SITE_URL: process.env.SITE_URL || "http://127.0.0.1:" + (process.argv[2] || 8100),
});
const market = require(path.join(ROOT, "api", "m.js"));
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".xml": "application/xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

function shim(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
  return res;
}
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let p = decodeURIComponent(u.pathname);
  let m;
  if ((m = p.match(/^\/api\/m\/?(.*)$/))) { req.url = "/api/m?path=" + encodeURIComponent(m[1]) + (u.search ? "&" + u.search.slice(1) : ""); return market(req, shim(res)); }
  if ((m = p.match(/^\/m\/([a-z0-9]+)\/?$/))) { req.url = "/api/m?path=page/" + m[1]; return market(req, shim(res)); }
  if (p === "/market-sitemap.xml") { req.url = "/api/m?path=sitemap"; return market(req, shim(res)); }
  if (p.startsWith("/__blob/")) p = path.join(DATA, "blob", path.basename(p)); else p = path.join(ROOT, p);
  if (!p.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  fs.readFile(p, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", TYPES[path.extname(p)] || "application/octet-stream");
    res.end(buf);
  });
}).listen(Number(process.argv[2] || 8100), "127.0.0.1", () => console.log("dev server on http://127.0.0.1:" + (process.argv[2] || 8100)));
