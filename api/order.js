// POST /api/order — emails a copy of every WhatsApp order to the shop owner.
// SMTP settings live in Vercel environment variables, never in this repo:
//   SMTP_HOST, SMTP_SERVERNAME, SMTP_PORT, SMTP_USER, SMTP_PASS, ORDER_EMAIL_TO
const tls = require("tls");
const crypto = require("crypto");
const CATALOG = require("./_catalog.json");

const COND = { new: "Brand New", refurb: "Ex-UK (Refurbished)" };
const SIM = { dual: "Physical SIM + eSIM", esim: "eSIM only" };
const hits = new Map(); // naive per-instance rate limit

function clean(v, max = 120) {
  return String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function ksh(n) { return n == null ? "Price on request" : "KSh " + Number(n).toLocaleString("en-KE"); }
function b64(s) { return Buffer.from(s, "utf8").toString("base64"); }
function wrap76(s) { return s.replace(/.{1,76}/g, "$&\r\n"); }
function kePhone(p) {
  const d = p.replace(/\D/g, "");
  if (/^0[17]\d{8}$/.test(d)) return "254" + d.slice(1);
  if (/^254[17]\d{8}$/.test(d)) return d;
  return "";
}

function smtpSend({ from, to, subject, text, html }) {
  const host = process.env.SMTP_HOST;
  const servername = process.env.SMTP_SERVERNAME || host;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const boundary = "b_" + crypto.randomBytes(12).toString("hex");
  const domain = (user.split("@")[1] || "localhost");
  const message = [
    `From: "i-phones Orders" <${from}>`,
    `To: <${to}>`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(text)),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(html)),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const steps = [
    [null, 220],
    [`EHLO ${domain}`, 250],
    ["AUTH LOGIN", 334],
    [b64(user), 334],
    [b64(pass), 235],
    [`MAIL FROM:<${from}>`, 250],
    [`RCPT TO:<${to}>`, 250],
    ["DATA", 354],
    [message.replace(/^\./gm, "..") + "\r\n.", 250],
    ["QUIT", 221],
  ];

  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host, port, servername });
    sock.setTimeout(15000, () => { sock.destroy(); reject(new Error("SMTP timeout")); });
    sock.on("error", reject);
    let buf = "", i = 0;
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      // wait for the final line of a (possibly multi-line) reply: "250 ok" not "250-..."
      const lines = buf.split("\r\n").filter(Boolean);
      const last = lines[lines.length - 1] || "";
      if (!buf.endsWith("\r\n") || !/^\d{3} /.test(last)) return;
      const code = Number(last.slice(0, 3));
      buf = "";
      if (code !== steps[i][1]) { sock.destroy(); return reject(new Error(`SMTP ${code} at step ${i}`)); }
      i++;
      if (i >= steps.length) { sock.end(); return resolve(); }
      sock.write(steps[i][0] + "\r\n");
    });
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false }); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  if (body.website) return res.status(200).json({ ok: true }); // honeypot: bots fill hidden field

  const product = CATALOG[clean(body.slug, 60)];
  if (!product) return res.status(400).json({ ok: false, error: "Unknown product" });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 8) return res.status(429).json({ ok: false });
  recent.push(now); hits.set(ip, recent);

  const o = {
    color: clean(body.color, 40),
    storage: clean(body.storage, 10),
    sim: product.variants.some((v) => v.sim) ? clean(body.sim, 10) : null,
    conn: product.variants.some((v) => v.conn) ? clean(body.conn, 10) : null,
    cond: clean(body.cond, 10),
    mode: body.mode === "pickup" ? "pickup" : "delivery",
    area: clean(body.area, 120),
    name: clean(body.name, 60),
    phone: clean(body.phone, 20),
    invoice: /^IPH-\d{6}-[A-Z0-9]{4}$/.test(String(body.invoice || "")) ? body.invoice : "—",
  };
  if (!product.colors.includes(o.color)) o.color = product.colors[0];
  // price is looked up server-side so the email can't be spoofed
  const variant = product.variants.find((v) => v.storage === o.storage && v.cond === o.cond &&
    (o.sim == null || v.sim === o.sim) && (o.conn == null || v.conn === o.conn) && (!v.color || v.color === o.color));
  const price = variant ? variant.price : null;
  const page = `${process.env.SITE_URL || "https://www.i-phones.co.ke"}/${clean(body.slug, 60)}/`;
  const wa = kePhone(o.phone);

  const rows = [
    ["Invoice", o.invoice],
    ["Model", product.name],
    ["Colour", o.color],
    ["Storage", o.storage],
    ...(o.conn ? [["Connectivity", o.conn === "5g" ? "Wi-Fi + 5G" : "Wi-Fi"]] : []),
    ...(o.sim ? [["SIM", SIM[o.sim] || o.sim]] : []),
    ["Condition", COND[o.cond] || o.cond],
    ["Price", ksh(price)],
    ["Fulfilment", o.mode === "pickup" ? "Shop pickup" : "Delivery to: " + (o.area || "(not given yet)")],
    ["Customer name", o.name || "—"],
    ["Customer phone", o.phone || "— (check WhatsApp)"],
    ["Time", new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }) + " EAT"],
  ];
  const subject = `New order ${o.invoice}: ${product.name} ${o.storage} – ${ksh(price)}` + (o.mode === "pickup" ? " (pickup)" : o.area ? ` (${o.area})` : "");
  const text = "New WhatsApp order from i-phones.co.ke\n\n" + rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n\nProduct page: ${page}\n` + (wa ? `Reply on WhatsApp: https://wa.me/${wa}\n` : "") +
    "\nThe customer was sent to WhatsApp 0704 839 296 with this invoice and told to visit the shop to pick & pay.";
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
<h2 style="margin:0 0 4px">New iPhone order</h2>
<p style="margin:0 0 16px;color:#666">Sent from i-phones.co.ke. The customer has the invoice and was told to visit the shop to pick &amp; pay.</p>
<table style="width:100%;border-collapse:collapse">${rows.map(([k, v]) =>
    `<tr><td style="padding:9px 12px;border-bottom:1px solid #eee;color:#666;width:38%">${esc(k)}</td><td style="padding:9px 12px;border-bottom:1px solid #eee;font-weight:bold">${esc(v)}</td></tr>`).join("")}</table>
<p style="margin:20px 0 0"><a href="${esc(page)}" style="color:#a8834f">View product page</a>${wa ? ` &nbsp;·&nbsp; <a href="https://wa.me/${wa}" style="color:#1fae55;font-weight:bold">Reply to customer on WhatsApp</a>` : ""}</p>
</div>`;

  try {
    await smtpSend({ from: process.env.SMTP_USER, to: process.env.ORDER_EMAIL_TO, subject, text, html });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("order email failed:", err.message);
    return res.status(502).json({ ok: false });
  }
};
