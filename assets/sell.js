/* Seller app (/sell/): email OTP login, profile, listings, photos, packages and payment */
(function () {
  "use strict";
  var app = document.getElementById("sell-app");
  if (!app) return;
  var cfg = null, me = null, view = "", state = {};
  function $(s, el) { return (el || app).querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ksh(n) { return "KSh " + Number(n).toLocaleString("en-KE"); }
  function api(path, body, method) {
    var o = { credentials: "same-origin", method: method || (body ? "POST" : "GET") };
    if (body) { o.headers = { "Content-Type": "application/json" }; o.body = JSON.stringify(body); }
    return fetch("/api/m/" + path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) { var e = new Error(b.error || "Something went wrong"); e.status = r.status; throw e; } return b; });
    });
  }
  function busy(btn, on, text) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.label = btn.innerHTML; btn.textContent = text || "Please wait…"; } else if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  function msg(text, kind) { var m = $(".sell-msg"); if (m) { m.textContent = text || ""; m.className = "sell-msg " + (kind || "err"); } }
  function options(list, sel, blank) { return (blank ? '<option value="">' + esc(blank) + "</option>" : "") + list.map(function (x) { var v = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? " selected" : "") + ">" + esc(t) + "</option>"; }).join(""); }
  function go(v) { location.hash = v; }

  /* ---------- views ---------- */
  function viewLogin() {
    app.innerHTML = '<div class="sell-card"><h2>Log in or create an account</h2><p class="mk-small">We will email you a 6-digit code. No password needed.</p>' +
      '<form id="f-email"><label class="field"><span>Email address</span><input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>' +
      '<button class="btn btn-dark btn-block">Email me a code</button><p class="sell-msg"></p></form></div>';
    $("#f-email").addEventListener("submit", function (e) {
      e.preventDefault(); var email = this.email.value.trim(), b = $("button", this); busy(b, true, "Sending code…");
      api("auth/request/", { email: email }).then(function () { state.email = email; viewCode(); }).catch(function (er) { msg(er.message); busy(b, false); });
    });
  }
  function viewCode() {
    app.innerHTML = '<div class="sell-card"><h2>Check your email</h2><p class="mk-small">We sent a code to <b>' + esc(state.email) + '</b>. It expires in 10 minutes. Check your spam folder if you do not see it.</p>' +
      '<form id="f-code"><label class="field"><span>6-digit code</span><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required placeholder="123456"></label>' +
      '<button class="btn btn-dark btn-block">Log in</button><p class="sell-msg"></p></form><button class="link-arrow" id="b-back" type="button">← Use a different email</button></div>';
    $("#b-back").onclick = viewLogin;
    $("input", app).focus();
    $("#f-code").addEventListener("submit", function (e) {
      e.preventDefault(); var b = $("button", this); busy(b, true, "Checking…");
      api("auth/verify/", { email: state.email, code: this.code.value }).then(boot).catch(function (er) { msg(er.message); busy(b, false); });
    });
  }
  function viewProfile() {
    var u = me.user, first = !u.name;
    app.innerHTML = '<div class="sell-card"><h2>' + (first ? "Set up your seller profile" : "Your profile") + '</h2><p class="mk-small">Buyers see your name. Your WhatsApp number is shared only when a buyer taps "Contact seller".</p>' +
      '<form id="f-prof"><label class="field"><span>Name buyers will see</span><input name="name" required maxlength="60" value="' + esc(u.name || "") + '" placeholder="e.g. Brian O. or Brian Phones"></label>' +
      '<label class="field"><span>WhatsApp number</span><input name="phone" type="tel" required value="' + esc(u.phone ? "0" + u.phone.slice(3) : "") + '" placeholder="0712 345 678"></label>' +
      '<div class="field"><span>Account type</span><div class="seg"><label class="option sell-radio"><input type="radio" name="type" value="individual"' + (u.accountType !== "dealer" ? " checked" : "") + '><b>Individual</b><small>Sell one phone at a time</small></label>' +
      '<label class="option sell-radio"><input type="radio" name="type" value="dealer"' + (u.accountType === "dealer" ? " checked" : "") + '><b>Dealer</b><small>Many phones, monthly plan</small></label></div></div>' +
      (first ? '<label class="sell-check"><input type="checkbox" name="terms" required> I agree to the <a href="../market/terms/" target="_blank">marketplace rules</a> and <a href="../privacy/" target="_blank">privacy policy</a>.</label>' : "") +
      '<button class="btn btn-dark btn-block">Save profile</button><p class="sell-msg"></p></form>' + (first ? "" : '<button class="link-arrow" type="button" onclick="location.hash=\'\'">← Back to my listings</button>') + "</div>";
    $("#f-prof").addEventListener("submit", function (e) {
      e.preventDefault(); var f = this, b = $("button", f); busy(b, true);
      api("me/profile/", { name: f.name.value, phone: f.phone.value, accountType: f.type.value, terms: f.terms ? f.terms.checked : true })
        .then(function () { return refresh(); }).then(function () { go(""); route(); }).catch(function (er) { msg(er.message); busy(b, false); });
    });
  }
  var STATUS = { pending_payment: ["Awaiting payment", "warn"], pending_approval: ["Waiting for approval", "info"], active: ["Live", "ok"], sold: ["Sold", "muted"], expired: ["Expired", "muted"], rejected: ["Rejected", "err"] };
  function viewDashboard() {
    var u = me.user, dealer = u.accountType === "dealer", sub = me.subscription, ps = me.pendingSubscription;
    var head = '<div class="sell-head"><div><h2>Hi, ' + esc(u.name) + '</h2><p class="mk-small">' + esc(u.email) + " · " + (dealer ? "Dealer account" : "Individual seller") + ' · <a href="#profile">Edit profile</a> · <a href="#" id="b-logout">Log out</a>' + (u.staff ? ' · <a href="../admin/">Dashboard</a>' : "") + "</p></div>" +
      '<a class="btn btn-dark" href="#new">+ Post a phone</a></div>';
    var plan = "";
    if (dealer) {
      plan = sub ? '<div class="sell-plan ok"><b>' + esc(cfg.packages.dealer[sub.plan].name) + " plan active</b><span>" + sub.live + (sub.limit ? " of " + sub.limit : "") + " phones live · renews or expires on " + new Date(sub.expiresAt).toLocaleDateString("en-KE") + '</span><a href="#plan">Renew or upgrade</a></div>'
        : ps ? '<div class="sell-plan info"><b>' + esc(cfg.packages.dealer[ps.plan].name) + (ps.status === "pending_approval" ? " paid, waiting for approval" : " awaiting payment") + "</b>" + (ps.status === "pending_payment" ? '<a href="#plan">Complete payment</a>' : "<span>We will activate it shortly.</span>") + "</div>"
        : '<div class="sell-plan warn"><b>Choose a dealer plan to put your phones live.</b><a class="btn btn-dark btn-sm" href="#plan">See dealer plans</a></div>';
    }
    app.innerHTML = head + plan + '<div id="my-list" class="sell-list"><p class="mk-status">Loading your phones…</p></div>';
    $("#b-logout").onclick = function (e) { e.preventDefault(); api("auth/logout/", {}).then(function () { me = null; viewLogin(); }); };
    api("my/listings/").then(function (r) {
      var box = $("#my-list");
      if (!r.listings.length) { box.innerHTML = '<div class="mk-empty"><b>You have not posted any phones yet.</b><a class="btn btn-dark btn-sm" href="#new">Post your first phone</a></div>'; return; }
      box.innerHTML = r.listings.map(function (l) {
        var st = STATUS[l.status] || [l.status, "muted"], pay = l.payment;
        var note = l.status === "pending_payment" && pay && pay.status === "pending" && pay.method === "mpesa" ? "M-Pesa code received. We are confirming it." : l.status === "rejected" ? (l.rejectReason || "") : l.status === "active" && l.expiresAt ? "Live until " + new Date(l.expiresAt).toLocaleDateString("en-KE") : l.status === "active" ? "Live until sold" : "";
        var acts = (l.status === "pending_payment" && !dealer && !(pay && pay.status === "pending" && pay.method === "mpesa") ? '<a class="btn btn-wa btn-sm" href="#pay/' + l.id + '">Pay to publish</a>' : "") +
          (["expired", "rejected"].indexOf(l.status) > -1 && !dealer ? '<a class="btn btn-wa btn-sm" href="#pay/' + l.id + '">Relist</a>' : "") +
          (l.status === "active" ? '<a class="btn btn-ghost btn-sm" href="../m/' + l.id + '/" target="_blank">View</a><button class="btn btn-ghost btn-sm" data-act="sold" data-id="' + l.id + '">Mark sold</button>' : "") +
          (l.status !== "sold" ? '<a class="btn btn-ghost btn-sm" href="#edit/' + l.id + '">Edit</a>' : "") + '<button class="btn btn-ghost btn-sm" data-act="delete" data-id="' + l.id + '">Delete</button>';
        return '<div class="sell-item"><img src="' + esc(l.photos[0]) + '" alt="" width="84" height="84"><div class="sell-item-main"><b>' + esc(l.title) + "</b><span>" + ksh(l.price) + " · " + esc(l.area) + ", " + esc(l.county) + '</span><span class="sell-status ' + st[1] + '">' + st[0] + "</span>" + (note ? "<small>" + esc(note) + "</small>" : "") +
          (l.status === "active" ? "<small>" + l.views + " views · " + l.contacts + " WhatsApp contacts</small>" : "") + '</div><div class="sell-acts">' + acts + "</div></div>";
      }).join("");
      state.listings = r.listings;
    }).catch(function (e) { $("#my-list").innerHTML = '<p class="sell-msg err">' + esc(e.message) + "</p>"; });
  }
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "delete" && !confirm("Delete this listing? This cannot be undone.")) return;
    if (act === "sold" && !confirm("Mark this phone as sold? It will be removed from the marketplace.")) return;
    busy(b, true); api("listings/" + b.getAttribute("data-id") + "/" + act + "/", {}).then(route).catch(function (er) { alert(er.message); busy(b, false); });
  });

  function viewForm(existing) {
    var l = existing || {}, dealer = me.user.accountType === "dealer";
    state.photos = (l.photos || []).slice();
    var brands = Object.keys(cfg.brands), conds = Object.keys(cfg.conditions).map(function (k) { return [k, cfg.conditions[k]]; });
    var pk = cfg.packages.individual;
    app.innerHTML = '<div class="sell-card wide"><h2>' + (existing ? "Edit your listing" : "Post a phone for sale") + '</h2><form id="f-list" novalidate>' +
      '<div class="grid2"><label class="field"><span>Brand</span><select name="brand" required>' + options(brands, l.brand, "Choose brand") + "</select></label>" +
      '<label class="field"><span>Model</span><select name="model" required></select></label></div>' +
      '<label class="field" id="other-wrap" hidden><span>Type the model</span><input name="model_other" maxlength="60" placeholder="e.g. Galaxy S10"></label>' +
      '<div class="grid2"><label class="field"><span>Condition</span><select name="condition" required>' + options(conds, l.condition, "Choose condition") + "</select></label>" +
      '<label class="field"><span>Storage</span><select name="storage">' + options(cfg.storage, l.storage, "Choose storage") + "</select></label></div>" +
      '<div class="grid2"><label class="field"><span>Price (KSh)</span><input name="price" inputmode="numeric" required placeholder="e.g. 45000" value="' + esc(l.price || "") + '"></label>' +
      '<label class="field"><span>Colour <small>(optional)</small></span><input name="color" maxlength="30" value="' + esc(l.color || "") + '"></label></div>' +
      '<div class="grid2"><label class="field"><span>County</span><select name="county" required>' + options(Object.keys(cfg.locations), l.county, "Choose county") + "</select></label>" +
      '<label class="field"><span>Constituency</span><select name="constituency" required></select></label></div>' +
      '<label class="field"><span>Town or estate</span><input name="area" required maxlength="80" placeholder="e.g. Kilimani, Thika town" value="' + esc(l.area || "") + '"></label>' +
      '<label class="field"><span>Description</span><textarea name="description" rows="4" maxlength="2000" placeholder="Condition, battery health, what is in the box, any faults or repairs">' + esc(l.description || "") + "</textarea></label>" +
      '<label class="field"><span>IMEI <small>(optional, private: helps us check for stolen phones)</small></span><input name="imei" inputmode="numeric" maxlength="17" value="' + esc(l.imei || "") + '"></label>' +
      '<div class="field"><span>Photos <small>(up to ' + cfg.maxPhotos + '; the first is the cover)</small></span><div class="sell-photos" id="photos"></div><label class="btn btn-ghost btn-sm sell-add"><input type="file" accept="image/*" multiple hidden id="file">+ Add photos</label><small class="sell-upl"></small></div>' +
      (!existing && !dealer ? '<div class="field"><span>Package</span><div class="sell-pkgs">' + Object.keys(pk).map(function (k, i) { return '<label class="option sell-radio"><input type="radio" name="package" value="' + k + '"' + (i === 2 ? " checked" : "") + "><b>" + esc(pk[k].name) + " · " + ksh(pk[k].price) + "</b><small>" + esc(pk[k].blurb) + "</small></label>"; }).join("") + "</div></div>" : "") +
      '<button class="btn btn-dark btn-block" type="submit">' + (existing ? "Save changes" : dealer ? "Post phone" : "Continue to payment") + '</button><p class="sell-msg"></p></form><button class="link-arrow" type="button" onclick="location.hash=\'\'">← Back</button></div>';
    var f = $("#f-list");
    function models() {
      var list = cfg.brands[f.brand.value] || [];
      f.model.innerHTML = options(list.concat([["__other", "Other model (type it)"]]), l.model && list.indexOf(l.model) < 0 && l.brand === f.brand.value ? "__other" : l.model, "Choose model");
      if (l.model && list.indexOf(l.model) < 0 && l.brand === f.brand.value) f.model_other.value = l.model;
      if (f.brand.value === "Other") f.model.value = "__other";
      other();
    }
    function other() { $("#other-wrap").hidden = f.model.value !== "__other"; }
    function consts() { f.constituency.innerHTML = options(cfg.locations[f.county.value] || [], l.constituency, "Choose constituency"); }
    f.brand.onchange = function () { l.model = ""; models(); };
    f.model.onchange = other;
    f.county.onchange = function () { l.constituency = ""; consts(); };
    models(); consts(); drawPhotos();
    $("#file").onchange = function () { upload(Array.prototype.slice.call(this.files)); this.value = ""; };
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.uploading) { msg("Wait for your photos to finish uploading."); return; }
      var data = { brand: f.brand.value, model: f.model.value, model_other: f.model_other.value, condition: f.condition.value, storage: f.storage.value, price: f.price.value, color: f.color.value,
        county: f.county.value, constituency: f.constituency.value, area: f.area.value, description: f.description.value, imei: f.imei.value, photos: state.photos, package: f.package ? f.package.value : "" };
      var b = $('button[type="submit"]', f); busy(b, true, "Saving…");
      (existing ? api("listings/" + existing.id + "/update/", data) : api("listings/", data))
        .then(function (r) { if (existing || r.status === "active") { go(""); route(); } else go("pay/" + r.id); })
        .catch(function (er) { msg(er.message); busy(b, false); });
    });
  }
  function drawPhotos() {
    var box = $("#photos"); if (!box) return;
    box.innerHTML = state.photos.map(function (p, i) { return '<div class="sell-ph"><img src="' + esc(p) + '" alt=""><button type="button" data-rm="' + i + '" aria-label="Remove photo">×</button>' + (i ? '<button type="button" data-first="' + i + '" class="sell-cover">Make cover</button>' : '<span class="sell-cover on">Cover</span>') + "</div>"; }).join("");
    box.onclick = function (e) {
      var rm = e.target.getAttribute("data-rm"), first = e.target.getAttribute("data-first");
      if (rm != null) state.photos.splice(+rm, 1);
      if (first != null) state.photos.unshift(state.photos.splice(+first, 1)[0]);
      drawPhotos();
    };
  }
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error("Could not read that photo")); }, "image/webp", 0.82);
      };
      img.onerror = function () { reject(new Error("That file is not a photo we can read")); };
      img.src = url;
    });
  }
  function upload(files) {
    var room = cfg.maxPhotos - state.photos.length, note = $(".sell-upl");
    files = files.slice(0, Math.max(0, room));
    if (!files.length) { note.textContent = "You can add up to " + cfg.maxPhotos + " photos."; return; }
    state.uploading = true; var done = 0;
    files.reduce(function (p, file) {
      return p.then(function () {
        note.textContent = "Uploading photo " + (done + 1) + " of " + files.length + "…";
        return shrink(file).then(function (blob) {
          return fetch("/api/m/upload/", { method: "POST", credentials: "same-origin", headers: { "Content-Type": blob.type || "image/webp" }, body: blob });
        }).then(function (r) { return r.json().then(function (b) { if (!r.ok) throw new Error(b.error || "Upload failed"); return b; }); })
          .then(function (b) { state.photos.push(b.url); done++; drawPhotos(); });
      });
    }, Promise.resolve()).then(function () { note.textContent = ""; }).catch(function (e) { note.textContent = e.message; }).then(function () { state.uploading = false; });
  }

  function viewPay(kind, listing) {
    var plan, amount, title;
    if (kind === "dealer") {
      var dp = cfg.packages.dealer, cur = (me.pendingSubscription && me.pendingSubscription.plan) || "gold";
      app.innerHTML = '<div class="sell-card wide"><h2>Choose a dealer plan</h2><p class="mk-small">Plans run for 30 days. Your phones go live as soon as the plan is approved.</p><form id="f-plan"><div class="sell-pkgs">' +
        Object.keys(dp).map(function (k) { return '<label class="option sell-radio"><input type="radio" name="plan" value="' + k + '"' + (k === cur ? " checked" : "") + "><b>" + esc(dp[k].name) + " · " + ksh(dp[k].price) + "/month</b><small>" + esc(dp[k].blurb) + "</small></label>"; }).join("") +
        '</div><div id="pay-box"></div></form><button class="link-arrow" type="button" onclick="location.hash=\'\'">← Back</button></div>';
      var f = $("#f-plan");
      var draw = function () { payBox({ kind: "dealer", plan: f.plan.value }, dp[f.plan.value].price, dp[f.plan.value].name); };
      f.onchange = draw; draw();
      return;
    }
    var pk = cfg.packages.individual;
    app.innerHTML = '<div class="sell-card wide"><h2>Publish your listing</h2><p class="mk-small">' + esc(listing.title) + " · " + ksh(listing.price) + '</p><form id="f-pkg"><div class="sell-pkgs">' +
      Object.keys(pk).map(function (k) { return '<label class="option sell-radio"><input type="radio" name="package" value="' + k + '"' + (k === (listing.package || "gold") ? " checked" : "") + "><b>" + esc(pk[k].name) + " · " + ksh(pk[k].price) + "</b><small>" + esc(pk[k].blurb) + "</small></label>"; }).join("") +
      '</div><div id="pay-box"></div></form><button class="link-arrow" type="button" onclick="location.hash=\'\'">← Back to my listings</button></div>';
    var fp = $("#f-pkg");
    var drawL = function () {
      var k = fp.package.value;
      api("listings/" + listing.id + "/package/", { package: k }).catch(function () {});
      payBox({ kind: "listing", listingId: listing.id }, pk[k].price, pk[k].name);
    };
    fp.onchange = drawL; drawL();
  }
  function payBox(target, amount, name) {
    var pb = cfg.paybill;
    $("#pay-box").innerHTML = '<div class="pay-total"><span>' + esc(name) + "</span><b>" + ksh(amount) + "</b></div>" +
      (cfg.paystack ? '<button class="btn btn-wa btn-block" type="button" id="b-paystack">Pay online with M-Pesa or card</button><p class="mk-small" style="text-align:center">Secure payment by Paystack. You come back here when done.</p><div class="pay-or"><span>or pay by Paybill</span></div>' : "") +
      '<div class="pay-paybill"><div><span>Business no.</span><b>' + esc(pb.number) + '</b></div><div><span>Account no.</span><b>' + esc(pb.account) + '</b></div><div><span>Amount</span><b>' + ksh(amount) + "</b></div><small>Paid to " + esc(pb.name) + " (" + esc(pb.bank) + ")</small></div>" +
      '<label class="field"><span>M-Pesa transaction code</span><input id="mpesa" maxlength="10" placeholder="e.g. SJK3H7XYZ1" style="text-transform:uppercase"></label><button class="btn btn-dark btn-block" type="button" id="b-mpesa">I have paid by Paybill</button><p class="sell-msg"></p>';
    var ps = $("#b-paystack");
    if (ps) ps.onclick = function () { busy(ps, true, "Opening payment…"); api("pay/start/", Object.assign({ method: "paystack" }, target)).then(function (r) { location.href = r.url; }).catch(function (e) { msg(e.message); busy(ps, false); }); };
    $("#b-mpesa").onclick = function () {
      var b = this; busy(b, true, "Sending…");
      api("pay/start/", Object.assign({ method: "mpesa", code: $("#mpesa").value }, target)).then(function () {
        app.innerHTML = '<div class="sell-card"><h2>Thank you</h2><p>We received your M-Pesa code. Our team will confirm the payment and approve your ' + (target.kind === "dealer" ? "plan" : "listing") + ', usually within business hours.</p><a class="btn btn-dark" href="#">Back to my listings</a></div>';
      }).catch(function (e) { msg(e.message); busy(b, false); });
    };
  }

  /* ---------- routing ---------- */
  function refresh() { return api("me/").then(function (r) { me = r; return r; }); }
  function route() {
    if (!me || !me.user) return viewLogin();
    if (!me.user.name || !me.user.phone) return viewProfile();
    var h = location.hash.replace(/^#/, ""), parts = h.split("/");
    view = parts[0];
    if (view === "profile") return viewProfile();
    if (view === "new") return viewForm(null);
    if (view === "plan") return me.user.accountType === "dealer" ? viewPay("dealer") : go("");
    if (view === "edit" || view === "pay") {
      return api("my/listings/").then(function (r) {
        var l = r.listings.filter(function (x) { return x.id === parts[1]; })[0];
        if (!l) return go("");
        if (view === "edit") viewForm(l); else viewPay("listing", l);
      });
    }
    refresh().then(viewDashboard);
  }
  function boot() {
    var ref = new URLSearchParams(location.search).get("reference");
    Promise.all([api("config/").then(function (c) { cfg = c; }), refresh()]).then(function () {
      if (ref && me.user) {
        history.replaceState(null, "", location.pathname);
        app.innerHTML = '<div class="sell-card"><p class="mk-status">Confirming your payment…</p></div>';
        return api("pay/verify/?reference=" + encodeURIComponent(ref)).then(function (r) {
          app.innerHTML = r.status === "paid" ? '<div class="sell-card"><h2>Payment received ✓</h2><p>Thank you. Our team will approve your listing shortly. You will see it go live in My listings.</p><a class="btn btn-dark" href="#">Back to my listings</a></div>'
            : '<div class="sell-card"><h2>Payment not completed</h2><p>We could not confirm this payment yet. If you were charged, contact us through the chat with reference <b>' + esc(ref) + '</b>.</p><a class="btn btn-dark" href="#">Back to my listings</a></div>';
        });
      }
      route();
    }).catch(function (e) {
      app.innerHTML = e.status === 503 ? '<div class="sell-card"><h2>Selling opens soon</h2><p>We are getting the marketplace ready. Check back shortly, or chat with us using the button below.</p></div>' : '<div class="sell-card"><p class="sell-msg err">' + esc(e.message) + "</p></div>";
    });
  }
  window.addEventListener("hashchange", function () { if (cfg) route(); });
  boot();
})();
