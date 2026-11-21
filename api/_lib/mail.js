// Shared SMTP sender (implicit TLS, AUTH LOGIN). No dependencies.
// Env: SMTP_HOST, SMTP_SERVERNAME, SMTP_PORT, SMTP_USER, SMTP_PASS. Set MAIL_DEV=log to print instead of sending.
const tls = require("tls");
const crypto = require("crypto");

function b64(s) { return Buffer.from(s, "utf8").toString("base64"); }
function wrap76(s) { return s.replace(/.{1,76}/g, "$&\r\n"); }

function smtpSend({ from, to, subject, text, html, fromName = "i-phones Orders" }) {
  if (process.env.MAIL_DEV === "log") { console.log(`[mail] to=${to} subject=${subject}\n${text}`); return Promise.resolve(); }
  const host = process.env.SMTP_HOST;
  const servername = process.env.SMTP_SERVERNAME || host;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const boundary = "b_" + crypto.randomBytes(12).toString("hex");
  const domain = (user.split("@")[1] || "localhost");
  const message = [
    `From: "${fromName}" <${from}>`,
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

module.exports = { smtpSend };
