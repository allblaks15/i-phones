/* i-phones — storefront behaviour (no dependencies) */
(function () {
  "use strict";
  var SITE = window.SITE || {};
  var PRODUCTS = window.PRODUCTS || [];
  var BASE = document.documentElement.getAttribute("data-base") || "";

  var WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.43 9.43 0 0 1-4.8-1.31l-.35-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.68c0 5.2-4.24 9.43-9.44 9.43zm8.03-17.46A11.3 11.3 0 0 0 12.05.7C5.79.7.7 5.79.7 12.04c0 2 .52 3.95 1.52 5.67L.6 23.3l5.72-1.5a11.3 11.3 0 0 0 5.42 1.38h.01c6.25 0 11.34-5.09 11.35-11.34 0-3.03-1.18-5.88-3.32-8.02z"/></svg>';

  var LABELS = {
    sim: { dual: "Physical SIM + eSIM", esim: "eSIM only" },
    cond: { "new": "Brand New", refurb: "Ex-UK (Refurbished)" }
  };
  var STORAGE_ORDER = { "64GB": 0, "128GB": 1, "256GB": 2, "512GB": 3, "1TB": 4, "2TB": 5 };

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function ksh(n) { return n == null ? "Price on request" : "KSh " + Number(n).toLocaleString("en-KE"); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ""; localStorage.setItem(k, v); } catch (e) { return ""; } }
  function bySlug(slug) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].slug === slug) return PRODUCTS[i]; return null; }
  function available(v) { return v.price != null && v.stock !== false; }
  function cheapest(list) {
    var best = null;
    list.forEach(function (v) {
      if (!best) { best = v; return; }
      var a = available(v), b = available(best);
      if (a && !b) best = v;
      else if (a === b && (v.price || 9e9) < (best.price || 9e9)) best = v;
    });
    return best;
  }
  function waLink(text) { return "https://wa.me/" + SITE.whatsapp + "?text=" + encodeURIComponent(text); }

  /* ---------- Configurator ---------- */
  function Configurator(product, mount, opts) {
    opts = opts || {};
    var dims = ["storage"];
    if (product.variants.some(function (v) { return v.sim; })) dims.push("sim");
    var conds = uniq(product.variants.map(function (v) { return v.cond; }));
    if (conds.length > 1) dims.push("cond");
    var start = cheapest(product.variants);
    var state = {
      color: product.colors[0].name,
      storage: start.storage, sim: start.sim, cond: start.cond,
      mode: store("kl_mode") || "delivery",
      area: store("kl_area"), name: store("kl_name"), phone: store("kl_phone")
    };
    var listeners = [];

    function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
    function matches(v, s) { return dims.every(function (d) { return v[d] === s[d]; }); }
    function current() { return product.variants.filter(function (v) { return matches(v, state); })[0] || null; }
    function values(d) {
      var vals = uniq(product.variants.map(function (v) { return v[d]; }));
      if (d === "storage") vals.sort(function (a, b) { return STORAGE_ORDER[a] - STORAGE_ORDER[b]; });
      return vals;
    }
    function choose(d, val) {
      state[d] = val;
      if (!current()) {
        var pick = cheapest(product.variants.filter(function (v) { return v[d] === val; }));
        dims.forEach(function (k) { state[k] = pick[k]; });
      }
      render();
    }
    function optionPrice(d, val) {
      var trial = {}; dims.forEach(function (k) { trial[k] = state[k]; }); trial[d] = val;
      var exact = product.variants.filter(function (v) { return matches(v, trial); })[0];
      if (exact) return { v: exact, exact: true };
      return { v: cheapest(product.variants.filter(function (v) { return v[d] === val; })), exact: false };
    }

    function message() {
      var v = current();
      var lines = [
        "Hello " + SITE.brand + " 👋",
        product.preorder ? "I'd like to *pre-order*:" : "I'm interested in ordering:",
        "",
        "📱 *" + product.name + "*",
        "• Colour: " + state.color,
        "• Storage: " + state.storage
      ];
      if (dims.indexOf("sim") > -1) lines.push("• SIM: " + LABELS.sim[state.sim]);
      lines.push("• Condition: " + LABELS.cond[state.cond]);
      lines.push("• Price: " + ksh(v && v.price));
      lines.push("");
      if (state.mode === "pickup") lines.push("🏬 I will *pick it up from your shop*.");
      else lines.push("🚚 Please *deliver* to: " + (state.area ? state.area : "(I'll share my location)"));
      if (state.name) lines.push("👤 Name: " + state.name);
      lines.push("");
      lines.push((product.preorder ? "When can I get it? " : "Is it available? ") + SITE.siteUrl + "/" + product.slug + "/");
      return lines.join("\n");
    }

    function render() {
      var v = current();
      var oos = v && v.stock === false;
      var h = "";
      h += '<div class="opt"><div class="opt-label">Colour <span data-k="color">' + esc(state.color) + '</span></div><div class="swatches" role="radiogroup" aria-label="Colour">';
      product.colors.forEach(function (c) {
        h += '<button type="button" class="swatch" role="radio" aria-checked="' + (c.name === state.color) + '" aria-label="' + esc(c.name) + '" title="' + esc(c.name) + '" data-color="' + esc(c.name) + '"><i style="background:' + c.hex + '"></i></button>';
      });
      h += "</div></div>";
      dims.forEach(function (d) {
        var title = { storage: "Storage", sim: "SIM type", cond: "Condition" }[d];
        h += '<div class="opt"><div class="opt-label">' + title + '</div><div class="options" role="radiogroup" aria-label="' + title + '">';
        values(d).forEach(function (val) {
          var op = optionPrice(d, val);
          var label = d === "storage" ? val : LABELS[d][val];
          var sub = op.v.price == null ? "Ask for price" : (op.exact ? ksh(op.v.price) : "from " + ksh(op.v.price));
          if (op.v.stock === false) sub = "On request";
          h += '<button type="button" class="option' + (op.exact ? "" : " dim") + '" role="radio" aria-checked="' + (state[d] === val) + '" data-dim="' + d + '" data-val="' + esc(val) + '"><b>' + esc(label) + "</b><small>" + sub + "</small></button>";
        });
        h += "</div></div>";
      });
      h += '<div class="order-box"><h2>How do you want it?</h2><p>We reply on WhatsApp within minutes.</p>';
      h += '<div class="seg" role="radiogroup" aria-label="Delivery or pickup">';
      h += '<button type="button" class="option" role="radio" data-mode="delivery" aria-checked="' + (state.mode === "delivery") + '"><b>🚚 Deliver to me</b><small>Same-day in Nairobi</small></button>';
      h += '<button type="button" class="option" role="radio" data-mode="pickup" aria-checked="' + (state.mode === "pickup") + '"><b>🏬 Shop pickup</b><small>' + esc(SITE.shopCity || "Nairobi") + " shop</small></button></div>";
      h += '<div style="height:14px"></div>';
      if (state.mode === "delivery") {
        h += '<label class="field"><span>Delivery location (town / estate)</span><input name="area" list="kl-areas" autocomplete="address-level2" placeholder="e.g. Westlands, Nairobi" value="' + esc(state.area) + '"></label>';
      }
      h += '<label class="field"><span>Your name <small style="color:var(--muted);font-weight:500">(optional)</small></span><input name="name" autocomplete="given-name" placeholder="e.g. Wanjiku" value="' + esc(state.name) + '"></label>';
      h += '<label class="field"><span>Phone number <small style="color:var(--muted);font-weight:500">(optional, so we can call you back)</small></span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="e.g. 0712 345 678" value="' + esc(state.phone) + '"></label>';
      h += '<input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">';
      h += '<a class="btn btn-wa btn-block" data-wa target="_blank" rel="noopener" href="#">' + WA_ICON + (oos ? "Ask availability on WhatsApp" : "Order on WhatsApp · " + ksh(v && v.price)) + "</a>";
      h += '<p class="order-note">No payment now. Confirm with us on WhatsApp first.</p></div>';
      mount.innerHTML = h;
      updateLink();
      listeners.forEach(function (fn) { fn(v, state); });
    }
    function updateLink() {
      var a = $("[data-wa]", mount);
      if (a) a.href = waLink(message());
    }

    var lastSent = 0;
    function sendOrder() {
      if (Date.now() - lastSent < 4000) return; // ignore double taps
      lastSent = Date.now();
      var payload = JSON.stringify({
        slug: product.slug, color: state.color, storage: state.storage, sim: state.sim, cond: state.cond,
        mode: state.mode, area: state.area, name: state.name, phone: state.phone, website: state.website || ""
      });
      try {
        fetch("/api/order/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true })
          .catch(function () {});
      } catch (err) {
        try { navigator.sendBeacon("/api/order/", new Blob([payload], { type: "application/json" })); } catch (e2) {}
      }
    }

    mount.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b || !mount.contains(b)) return;
      if (b.dataset.color) { state.color = b.dataset.color; render(); }
      else if (b.dataset.dim) choose(b.dataset.dim, b.dataset.val === "null" ? null : b.dataset.val);
      else if (b.dataset.mode) { state.mode = b.dataset.mode; store("kl_mode", state.mode); render(); }
    });
    mount.addEventListener("input", function (e) {
      if (e.target.name === "area") { state.area = e.target.value; store("kl_area", state.area); }
      if (e.target.name === "name") { state.name = e.target.value; store("kl_name", state.name); }
      if (e.target.name === "phone") { state.phone = e.target.value; store("kl_phone", state.phone); }
      if (e.target.name === "website") state.website = e.target.value;
      updateLink();
    });
    mount.addEventListener("click", function (e) {
      if (e.target.closest("[data-wa]")) { updateLink(); track(product); sendOrder(); }
    });

    ensureAreaList();
    render();
    return {
      onChange: function (fn) { listeners.push(fn); fn(current(), state); },
      link: function () { return waLink(message()); },
      send: sendOrder
    };
  }

  function ensureAreaList() {
    if ($("#kl-areas") || !SITE.deliveryAreas) return;
    var dl = document.createElement("datalist");
    dl.id = "kl-areas";
    dl.innerHTML = SITE.deliveryAreas.map(function (a) { return '<option value="' + esc(a) + '">'; }).join("");
    document.body.appendChild(dl);
  }
  function track(p) {
    try { if (window.gtag) window.gtag("event", "whatsapp_order", { item_name: p.name }); } catch (e) {}
    try { if (window.fbq) window.fbq("track", "Contact", { content_name: p.name }); } catch (e) {}
  }

  /* ---------- Quick order drawer ---------- */
  var modal = $("#quick-order");
  var lastFocus = null;
  function openQuick(slug) {
    var p = bySlug(slug);
    if (!p || !modal) return;
    lastFocus = document.activeElement;
    $(".qo-head", modal).innerHTML = '<img src="' + BASE + "images/phones/" + p.slug + '-1.webp" alt="' + esc(p.name) + '" width="88" height="88"><div><h2>' + esc(p.name) + '</h2><a href="' + BASE + p.slug + '/">View full specs →</a></div>';
    var priceEl = $(".qo-price", modal);
    var cfg = Configurator(p, $(".qo-body", modal));
    cfg.onChange(function (v) { priceEl.textContent = ksh(v && v.price); });
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(function () { $(".modal-close", modal).focus(); }, 50);
  }
  function closeQuick() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener("click", function (e) {
    var q = e.target.closest("[data-quick]");
    if (q) { e.preventDefault(); openQuick(q.getAttribute("data-quick")); }
    if (e.target.closest("[data-close]")) closeQuick();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeQuick(); closeDrawer(); } });

  /* ---------- Mobile nav ---------- */
  var drawer = $("#drawer");
  function closeDrawer() { if (drawer) { drawer.classList.remove("open"); document.body.style.overflow = ""; } }
  $$("[data-menu]").forEach(function (b) { b.addEventListener("click", function () { drawer.classList.add("open"); document.body.style.overflow = "hidden"; }); });
  $$("[data-menu-close], #drawer nav a").forEach(function (b) { b.addEventListener("click", closeDrawer); });

  /* ---------- Shop filters ---------- */
  var grid = $("#grid");
  if (grid) {
    var cards = $$(".card", grid);
    var f = { series: "all", cond: "all", budget: "all", sort: "featured" };
    var params = new URLSearchParams(location.search);
    ["series", "cond", "budget"].forEach(function (k) { if (params.get(k)) f[k] = params.get(k); });

    function apply() {
      var shown = 0;
      cards.forEach(function (c) {
        var price = +c.dataset.price, ok = true;
        if (f.series !== "all" && c.dataset.series !== f.series) ok = false;
        if (f.cond !== "all" && c.dataset.conds.indexOf(f.cond) < 0) ok = false;
        if (f.budget === "under-80k" && price >= 80000) ok = false;
        if (f.budget === "80k-150k" && (price < 80000 || price > 150000)) ok = false;
        if (f.budget === "over-150k" && price <= 150000) ok = false;
        c.hidden = !ok;
        if (ok) shown++;
      });
      var sorted = cards.slice();
      if (f.sort === "low") sorted.sort(function (a, b) { return a.dataset.price - b.dataset.price; });
      else if (f.sort === "high") sorted.sort(function (a, b) { return b.dataset.price - a.dataset.price; });
      else if (f.sort === "newest") sorted.sort(function (a, b) { return b.dataset.year - a.dataset.year || b.dataset.price - a.dataset.price; });
      else sorted.sort(function (a, b) { return a.dataset.order - b.dataset.order; });
      sorted.forEach(function (c) { grid.appendChild(c); });
      $("#empty").hidden = shown > 0;
      $$("[data-filter]").forEach(function (b) {
        var parts = b.getAttribute("data-filter").split(":");
        b.setAttribute("aria-pressed", String(f[parts[0]] === parts[1]));
      });
      var sel = $("#sort"); if (sel) sel.value = f.sort;
    }
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-filter]");
      if (!b) return;
      var parts = b.getAttribute("data-filter").split(":");
      if (parts[0] === "budget" || parts[0] === "series") {
        f.series = "all"; f.budget = "all";
      }
      f[parts[0]] = parts[1];
      apply();
      if (b.tagName === "A") { e.preventDefault(); $("#shop").scrollIntoView({ behavior: "smooth" }); }
    });
    var sortSel = $("#sort");
    if (sortSel) sortSel.addEventListener("change", function () { f.sort = sortSel.value; apply(); });
    apply();
  }

  /* ---------- Product page ---------- */
  var pdpMount = $("#configurator");
  if (pdpMount && window.PRODUCT) {
    var product = bySlug(window.PRODUCT);
    var cfg = Configurator(product, pdpMount);
    var priceEl = $("#pdp-price"), bbPrice = $("#bb-price"), bbSub = $("#bb-sub"), bbBtn = $("#bb-btn");
    cfg.onChange(function (v, s) {
      if (priceEl) priceEl.textContent = ksh(v && v.price);
      if (bbPrice) bbPrice.textContent = ksh(v && v.price);
      if (bbSub) bbSub.textContent = product.name + " · " + s.storage + " · " + s.color;
      if (bbBtn) bbBtn.href = cfg.link();
    });
    if (bbBtn) bbBtn.addEventListener("click", function () { bbBtn.href = cfg.link(); track(product); cfg.send(); });

    // gallery
    var main = $("#gallery-main");
    $$(".thumbs button").forEach(function (t) {
      t.addEventListener("click", function () {
        main.src = t.dataset.src;
        $$(".thumbs button").forEach(function (x) { x.setAttribute("aria-current", "false"); });
        t.setAttribute("aria-current", "true");
      });
    });

    // sticky buy bar appears once the order box scrolls away
    var bar = $(".buybar");
    if (bar && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (en) {
        var anyVisible = en.some(function (x) { return x.isIntersecting; });
        bar.classList.toggle("show", !anyVisible && window.scrollY > 300);
      }, { threshold: 0 });
      io.observe(pdpMount);
    }
  }

  /* ---------- Reveal on scroll ---------- */
  if ("IntersectionObserver" in window) {
    var rio = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("in"); rio.unobserve(x.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    $$(".reveal").forEach(function (el) { rio.observe(el); });
  } else {
    $$(".reveal").forEach(function (el) { el.classList.add("in"); });
  }

  /* live clock on wallpaper previews */
  var t = new Date(), hh = t.getHours() % 12 || 12, mm = ("0" + t.getMinutes()).slice(-2);
  $$(".wall-time").forEach(function (el) { el.textContent = hh + ":" + mm; });
})();
