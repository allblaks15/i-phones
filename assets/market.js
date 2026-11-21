/* Marketplace: browse page (/market/) and listing pages (/m/<id>/) */
(function () {
  "use strict";
  var BASE = document.documentElement.getAttribute("data-base") || "";
  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ksh(n) { return "KSh " + Number(n).toLocaleString("en-KE"); }
  function api(path, opts) {
    return fetch("/api/m/" + path, Object.assign({ credentials: "same-origin" }, opts || {})).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) { var e = new Error(b.error || "Something went wrong"); e.status = r.status; throw e; } return b; });
    });
  }
  function ago(t) {
    var d = (Date.now() - t) / 60000;
    if (d < 60) return Math.max(1, Math.round(d)) + " min ago";
    if (d < 1440) return Math.round(d / 60) + " h ago";
    return Math.round(d / 1440) + " d ago";
  }
  function card(l) {
    var photo = l.photos[0] || "";
    var badges = (l.isDemo ? '<span class="mk-badge demo">Sample</span>' : "") + (l.rank >= 3 ? '<span class="mk-badge top">Top</span>' : "") + (l.seller && l.seller.dealer ? '<span class="mk-badge dealer">Dealer</span>' : "");
    return '<a class="mk-card" href="' + BASE + "m/" + esc(l.id) + '/"><div class="mk-card-img"><img src="' + esc(photo) + '" alt="' + esc(l.title) + '" loading="lazy" width="400" height="400">' +
      '<div class="mk-badges">' + badges + "</div></div><div class=\"mk-card-body\"><b class=\"mk-price\">" + ksh(l.price) + "</b><h3>" + esc(l.title) + "</h3>" +
      '<span class="mk-cond c-' + esc(l.condition) + '">' + esc(l.conditionLabel) + "</span><small>📍 " + esc(l.area) + ", " + esc(l.county) + " · " + ago(l.createdAt) + "</small></div></a>";
  }
  function soon(el) { el.innerHTML = '<div class="mk-empty"><b>The marketplace is opening soon.</b><span>Want to sell your phone? <a href="' + BASE + 'sell/">Get ready to list it</a>.</span></div>'; }

  /* ---------- browse ---------- */
  var grid = $("#mk-grid"), form = $("#mk-filters");
  if (grid && form) {
    var page = 1, cfg = null, status = $("#mk-status"), more = $("#mk-more");
    var params = new URLSearchParams(location.search);
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name && params.get(el.name)) el.value = params.get(el.name); });
    function fillModels() {
      var sel = form.elements.model, b = form.elements.brand.value, keep = params.get("model") || sel.value;
      sel.innerHTML = '<option value="">All models</option>' + ((cfg && cfg.brands[b]) || []).map(function (m) { return '<option' + (m === keep ? " selected" : "") + ">" + esc(m) + "</option>"; }).join("");
      sel.disabled = !b || !(cfg && cfg.brands[b] && cfg.brands[b].length);
    }
    function query() {
      var p = new URLSearchParams();
      Array.prototype.forEach.call(form.elements, function (el) { if (el.name && el.value) p.set(el.name, el.value); });
      return p;
    }
    function load(reset) {
      if (reset) { page = 1; grid.innerHTML = ""; }
      status.textContent = "Loading phones…";
      var p = query(); p.set("page", page);
      api("listings/?" + p.toString()).then(function (r) {
        grid.insertAdjacentHTML("beforeend", r.listings.map(card).join(""));
        status.textContent = grid.children.length ? "" : "No phones match your search yet. Try fewer filters.";
        more.hidden = !r.more;
      }).catch(function (e) { status.textContent = ""; if (e.status === 503) soon(grid); else status.textContent = e.message; });
    }
    var t;
    form.addEventListener("input", function (e) {
      if (e.target.name === "brand") { params.delete("model"); fillModels(); }
      clearTimeout(t); t = setTimeout(function () { history.replaceState(null, "", "?" + query().toString()); load(true); }, e.target.name === "q" || e.target.name === "min" || e.target.name === "max" ? 400 : 0);
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); load(true); });
    more.addEventListener("click", function () { page++; load(false); });
    api("config/").then(function (c) { cfg = c; fillModels(); }).catch(function () {});
    load(true);
  }

  /* ---------- homepage: latest marketplace phones ---------- */
  var latest = $("#mk-latest");
  if (latest) {
    api("listings/?per=8").then(function (r) {
      latest.innerHTML = r.listings.length ? r.listings.map(card).join("") : '<div class="mk-empty"><b>Be the first to sell your phone here.</b><a class="btn btn-dark btn-sm" href="' + BASE + 'sell/">Sell your phone</a></div>';
    }).catch(function (e) { if (e.status === 503) soon(latest); else latest.innerHTML = ""; });
  }

  /* ---------- listing page ---------- */
  var main = $("#gallery-main");
  if (main && $(".mk-photo")) {
    document.addEventListener("click", function (e) {
      var t = e.target.closest(".thumbs button");
      if (!t) return;
      main.src = t.getAttribute("data-src");
      Array.prototype.forEach.call(document.querySelectorAll(".thumbs button"), function (x) { x.setAttribute("aria-current", x === t ? "true" : "false"); });
    });
  }
  var contact = $("[data-contact]");
  if (contact) {
    contact.addEventListener("click", function () {
      contact.disabled = true;
      var label = contact.innerHTML; contact.textContent = "Opening WhatsApp…";
      api("contact/" + contact.getAttribute("data-contact") + "/", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
        .then(function (r) { location.href = r.url; })
        .catch(function (e) { alert(e.message); })
        .then(function () { setTimeout(function () { contact.disabled = false; contact.innerHTML = label; }, 1500); });
    });
  }
  var similar = $("#mk-similar");
  if (similar) {
    api("listings/?per=4&brand=" + encodeURIComponent(similar.getAttribute("data-brand")) + "&exclude=" + encodeURIComponent(similar.getAttribute("data-exclude")))
      .then(function (r) { similar.innerHTML = r.listings.map(card).join("") || '<p class="mk-status">No similar phones right now.</p>'; })
      .catch(function () { similar.innerHTML = ""; });
  }
})();
