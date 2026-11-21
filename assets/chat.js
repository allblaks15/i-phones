/* "Chat with us" widget on every page. Messages are answered by staff from /admin/. */
(function () {
  "use strict";
  var root = document.getElementById("chat");
  if (!root) return;
  var fab = root.querySelector(".chat-fab"), panel = root.querySelector(".chat-panel"), body = root.querySelector(".chat-body"), dot = root.querySelector(".chat-dot");
  var KEY = "ip_chat", st = load(), timer = null, seen = {};
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function api(path, data) {
    var o = data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {};
    return fetch("/api/m/" + path, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) { var e = new Error(b.error || "Could not send. Please try again."); e.status = r.status; throw e; } return b; }); });
  }
  var wa = "https://wa.me/" + root.getAttribute("data-wa");
  function start() {
    body.innerHTML = '<div class="chat-msgs"><div class="cm them"><p>Hi 👋 How can we help? Ask about a phone, an order or selling on the marketplace.</p></div></div>' +
      '<form class="chat-form chat-start"><input name="name" maxlength="60" placeholder="Your name (optional)" autocomplete="name"><input name="contact" maxlength="80" placeholder="Phone or email, so we can reply (optional)">' +
      '<textarea name="message" rows="3" maxlength="1500" placeholder="Type your message" required></textarea><button class="btn btn-dark btn-block">Send</button>' +
      '<small>Prefer WhatsApp? <a href="' + wa + '" target="_blank" rel="noopener">Message us</a></small><p class="chat-err"></p></form>';
    body.querySelector("form").onsubmit = function (e) {
      e.preventDefault(); var f = this, b = f.querySelector("button"); b.disabled = true;
      api("chat/start/", { name: f.name.value, contact: f.contact.value, message: f.message.value, page: location.pathname })
        .then(function (r) { st = { token: r.token, after: 0 }; save(); thread(); })
        .catch(function (er) { f.querySelector(".chat-err").textContent = er.status === 503 ? "Chat is not available yet. Please WhatsApp us." : er.message; b.disabled = false; });
    };
  }
  function thread() {
    body.innerHTML = '<div class="chat-msgs" aria-live="polite"></div><form class="chat-form"><textarea name="message" rows="2" maxlength="1500" placeholder="Type a message" required></textarea><button class="btn btn-dark" aria-label="Send">Send</button></form>';
    seen = {}; st.after = 0; poll();
    body.querySelector("form").onsubmit = function (e) {
      e.preventDefault(); var f = this, t = f.message.value; if (!t.trim()) return; f.message.value = "";
      api("chat/send/", { token: st.token, message: t }).then(poll).catch(function (er) { if (er.status === 404) { st = {}; save(); start(); } else alert(er.message); });
    };
  }
  function poll() {
    if (!st.token) return Promise.resolve();
    return api("chat/poll/?token=" + encodeURIComponent(st.token) + "&after=" + (st.after || 0)).then(function (r) {
      var box = body.querySelector(".chat-msgs"), fresh = false;
      r.messages.forEach(function (m) {
        if (seen[m.id]) return; seen[m.id] = 1; st.after = Math.max(st.after || 0, m.at);
        if (m.from === "staff") { fresh = true; st.lastStaff = Math.max(st.lastStaff || 0, m.at); }
        if (box) { box.insertAdjacentHTML("beforeend", '<div class="cm ' + (m.from === "staff" ? "them" : "me") + '"><p>' + esc(m.body) + "</p>" + (m.from === "staff" ? "<small>" + esc(m.name || "i-phones") + "</small>" : "") + "</div>"); box.scrollTop = box.scrollHeight; }
      });
      if (box && !box.querySelector(".cm.them")) box.insertAdjacentHTML("afterbegin", '<div class="cm them"><p>Thanks, we have your message and will reply here soon. Keep this page open or come back later.</p></div>');
      save();
      dot.hidden = !(fresh && panel.hidden && (st.lastStaff || 0) > (st.read || 0));
    }).catch(function (er) { if (er.status === 404) { st = {}; save(); } });
  }
  function schedule() { clearInterval(timer); if (st.token) timer = setInterval(function () { if (!document.hidden) poll(); }, panel.hidden ? 30000 : 4000); }
  fab.addEventListener("click", function () {
    var open = panel.hidden; panel.hidden = !open; fab.setAttribute("aria-expanded", String(open)); root.classList.toggle("open", open);
    if (open) { st.read = Date.now(); save(); dot.hidden = true; if (st.token) thread(); else start(); }
    schedule();
  });
  root.querySelector(".chat-x").addEventListener("click", function () { fab.click(); });
  if (st.token) { poll(); schedule(); }
})();
