/* Staff dashboard (/admin/): approvals, payments, listings, chats, team and sample data */
(function () {
  "use strict";
  var app = document.getElementById("admin-app");
  if (!app) return;
  var me = null, tab = "approvals", timer = null, openChat = null;
  function $(s, el) { return (el || app).querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ksh(n) { return "KSh " + Number(n).toLocaleString("en-KE"); }
  function when(t) { return new Date(t).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  function api(path, body) {
    var o = { credentials: "same-origin", method: body ? "POST" : "GET" };
    if (body) { o.headers = { "Content-Type": "application/json" }; o.body = JSON.stringify(body); }
    return fetch("/api/m/" + path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) { var e = new Error(b.error || "Something went wrong"); e.status = r.status; throw e; } return b; });
    });
  }
  function login(step, email) {
    if (step === "code") {
      app.innerHTML = '<div class="sell-card"><h2>Enter your code</h2><p class="mk-small">Sent to ' + esc(email) + '</p><form id="f"><label class="field"><span>6-digit code</span><input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></label><button class="btn btn-dark btn-block">Log in</button><p class="sell-msg"></p></form></div>';
      $("#f").onsubmit = function (e) { e.preventDefault(); api("auth/verify/", { email: email, code: this.code.value }).then(boot).catch(function (er) { $(".sell-msg").textContent = er.message; }); };
      return;
    }
    app.innerHTML = '<div class="sell-card"><h2>Staff login</h2><p class="mk-small">Admins and editors log in with their email.</p><form id="f"><label class="field"><span>Email</span><input name="email" type="email" required autocomplete="email"></label><button class="btn btn-dark btn-block">Email me a code</button><p class="sell-msg"></p></form></div>';
    $("#f").onsubmit = function (e) { e.preventDefault(); var em = this.email.value.trim(); api("auth/request/", { email: em }).then(function () { login("code", em); }).catch(function (er) { $(".sell-msg").textContent = er.message; }); };
  }
  function shell(counts) {
    var tabs = [["approvals", "Approvals", counts.pendingListings + counts.pendingSubs], ["payments", "Paybill payments", counts.pendingPayments], ["listings", "Listings", counts.liveListings], ["chats", "Chats", counts.openChats]];
    if (me.role === "admin") tabs.push(["team", "Team", 0], ["demo", "Sample data", counts.demo]);
    app.innerHTML = '<div class="adm-head"><div><h1>Dashboard</h1><p class="mk-small">' + esc(me.email) + " · " + esc(me.role) + ' · <a href="../sell/">Seller view</a> · <a href="#" id="logout">Log out</a></p></div><div class="adm-stats"><span><b>' + counts.liveListings + "</b> live listings</span><span><b>" + counts.users + "</b> sellers</span></div></div>" +
      '<nav class="adm-tabs">' + tabs.map(function (t) { return '<button data-tab="' + t[0] + '"' + (t[0] === tab ? ' aria-current="true"' : "") + ">" + t[1] + (t[2] ? " <i>" + t[2] + "</i>" : "") + "</button>"; }).join("") + '</nav><div id="pane" class="adm-pane"></div>';
    $("#logout").onclick = function (e) { e.preventDefault(); api("auth/logout/", {}).then(function () { location.reload(); }); };
    app.querySelector(".adm-tabs").onclick = function (e) { var b = e.target.closest("[data-tab]"); if (b) { tab = b.getAttribute("data-tab"); openChat = null; refresh(); } };
  }
  function listingRow(l, actions) {
    return '<div class="adm-row"><img src="' + esc(l.photos[0]) + '" alt="" width="72" height="72"><div class="adm-main"><b><a href="../m/' + l.id + '/" target="_blank">' + esc(l.title) + "</a> · " + ksh(l.price) + "</b><span>" + esc(l.conditionLabel) + " · " + esc(l.area) + ", " + esc(l.constituency) + ", " + esc(l.county) + "</span>" +
      "<span>Seller: " + esc(l.seller.name) + (l.seller.dealer ? " (dealer)" : "") + " · " + esc(l.seller.email) + (l.seller.phone ? " · 0" + esc(l.seller.phone.slice(3)) : "") + "</span>" +
      "<span>Package: " + esc(l.package || "-") + (l.imei ? " · IMEI " + esc(l.imei) : "") + (l.isDemo ? " · SAMPLE" : "") + "</span>" + (l.description ? "<small>" + esc(l.description) + "</small>" : "") + '</div><div class="adm-acts">' + actions + "</div></div>";
  }
  var panes = {
    approvals: function (p) {
      return api("admin/queue/").then(function (r) {
        p.innerHTML = "<h2>Dealer plans waiting for approval</h2>" + (r.subscriptions.map(function (s) {
          return '<div class="adm-row"><div class="adm-main"><b>' + esc(s.planName) + " · " + ksh(s.price) + "</b><span>" + esc(s.seller.name) + " · " + esc(s.seller.email) + (s.seller.phone ? " · 0" + esc(s.seller.phone.slice(3)) : "") + '</span><small>Payment confirmed. Approving activates the plan for 30 days and puts their phones live.</small></div><div class="adm-acts"><button class="btn btn-dark btn-sm" data-do="subscriptions/' + s.id + '/approve">Approve</button><button class="btn btn-ghost btn-sm" data-do="subscriptions/' + s.id + '/reject">Reject</button></div></div>';
        }).join("") || '<p class="mk-status">None right now.</p>') +
          "<h2>Paid listings waiting for approval</h2>" + (r.listings.map(function (l) {
            return listingRow(l, '<button class="btn btn-dark btn-sm" data-do="listings/' + l.id + '/approve">Approve</button><button class="btn btn-ghost btn-sm" data-reject="' + l.id + '">Reject</button>');
          }).join("") || '<p class="mk-status">None right now.</p>') + '<p class="mk-small">Listings paid by Paybill appear under <b>Paybill payments</b> first. Confirm the payment there to approve them in one step.</p>';
      });
    },
    payments: function (p) {
      return api("admin/payments/?status=pending").then(function (r) {
        var rows = r.payments.filter(function (x) { return x.method === "mpesa"; });
        p.innerHTML = '<h2>Paybill payments to confirm</h2><p class="mk-small">Check each code against your M-Pesa / NCBA statement before confirming. Confirming also approves the listing or dealer plan.</p>' + (rows.map(function (x) {
          return '<div class="adm-row"><div class="adm-main"><b>' + esc(x.reference.replace("MPESA-", "")) + " · " + ksh(x.amount) + "</b><span>" + (x.kind === "dealer" ? "Dealer plan: " + esc(x.package) : "Listing: " + esc(x.listingTitle || x.targetId) + " (" + esc(x.package) + ")") + "</span><span>" + esc(x.seller.name) + " · " + esc(x.seller.email) + "</span><small>Submitted " + when(x.createdAt) + '</small></div><div class="adm-acts"><button class="btn btn-dark btn-sm" data-do="payments/' + x.id + '/confirm" data-confirm="Confirm you have received ' + ksh(x.amount) + " with code " + esc(x.reference.replace("MPESA-", "")) + '?">Confirm &amp; approve</button><button class="btn btn-ghost btn-sm" data-do="payments/' + x.id + '/reject" data-confirm="Reject this payment code?">Reject</button></div></div>';
        }).join("") || '<p class="mk-status">No Paybill payments waiting.</p>');
      });
    },
    listings: function (p) {
      var st = p.dataset.st || "active", qq = p.dataset.q || "";
      return api("admin/listings/?status=" + st + "&q=" + encodeURIComponent(qq)).then(function (r) {
        p.innerHTML = '<div class="adm-filter"><select id="st">' + ["active", "pending_payment", "pending_approval", "sold", "expired", "rejected", "deleted"].map(function (s) { return "<option" + (s === st ? " selected" : "") + ">" + s + "</option>"; }).join("") + '</select><input id="qq" placeholder="Search title, seller or email" value="' + esc(qq) + '"></div>' +
          (r.listings.map(function (l) {
            return listingRow(l, (l.status === "active" ? '<button class="btn btn-ghost btn-sm" data-do="listings/' + l.id + '/sold">Mark sold</button><button class="btn btn-ghost btn-sm" data-reject="' + l.id + '">Take down</button>' : "") + '<button class="btn btn-ghost btn-sm" data-do="listings/' + l.id + '/delete" data-confirm="Delete this listing?">Delete</button>');
          }).join("") || '<p class="mk-status">No listings.</p>');
        $("#st", p).onchange = function () { p.dataset.st = this.value; panes.listings(p); };
        $("#qq", p).onchange = function () { p.dataset.q = this.value; panes.listings(p); };
      });
    },
    chats: function (p) {
      if (openChat) return api("admin/chats/" + openChat + "/").then(function (r) {
        var c = r.chat;
        p.innerHTML = '<button class="link-arrow" id="back">← All chats</button><h2>' + esc(c.name || "Visitor") + '</h2><p class="mk-small">' + esc(c.contact || "No contact given") + (c.page ? " · on " + esc(c.page) : "") + '</p><div class="adm-thread">' +
          r.messages.map(function (m) { return '<div class="cm ' + (m.from === "staff" ? "me" : "them") + '"><p>' + esc(m.body) + "</p><small>" + (m.from === "staff" ? esc(m.name || "Staff") + " · " : "") + when(m.at) + "</small></div>"; }).join("") +
          '</div><form id="rf" class="adm-reply"><textarea name="m" rows="2" placeholder="Type your reply" required></textarea><button class="btn btn-dark">Send</button></form><button class="btn btn-ghost btn-sm" data-do="chats/' + c.id + '/close">Close chat</button>';
        var th = $(".adm-thread", p); th.scrollTop = th.scrollHeight;
        $("#back", p).onclick = function () { openChat = null; refresh(); };
        $("#rf", p).onsubmit = function (e) { e.preventDefault(); var t = this.m.value; this.m.value = ""; api("admin/chats/" + c.id + "/reply/", { message: t }).then(function () { panes.chats(p); }).catch(function (er) { alert(er.message); }); };
      });
      return api("admin/chats/").then(function (r) {
        p.innerHTML = "<h2>Chats</h2>" + (r.chats.map(function (c) {
          return '<button class="adm-chat' + (c.unread ? " unread" : "") + '" data-chat="' + c.id + '"><b>' + esc(c.name || "Visitor") + (c.unread ? " <i>" + c.unread + "</i>" : "") + "</b><span>" + esc(c.last || "") + "</span><small>" + when(c.lastAt) + (c.status === "closed" ? " · closed" : "") + "</small></button>";
        }).join("") || '<p class="mk-status">No chats yet.</p>');
      });
    },
    team: function (p) {
      return api("admin/users/").then(function (r) {
        p.innerHTML = '<h2>Add an editor</h2><p class="mk-small">Editors can approve listings, confirm Paybill payments and answer chats. They log in with their own email.</p><form id="tf" class="adm-filter"><input name="email" type="email" placeholder="editor@example.com" required><button class="btn btn-dark btn-sm">Make editor</button></form>' +
          "<h2>People</h2>" + r.users.map(function (u) {
            return '<div class="adm-row"><div class="adm-main"><b>' + esc(u.name || "(no name yet)") + " · " + esc(u.role) + "</b><span>" + esc(u.email) + (u.phone ? " · 0" + esc(u.phone.slice(3)) : "") + " · " + esc(u.accountType) + " · " + u.live + ' live</span></div><div class="adm-acts">' +
              (u.role === "editor" ? '<button class="btn btn-ghost btn-sm" data-role="' + esc(u.email) + '" data-r="seller">Remove editor</button>' : u.role === "seller" ? '<button class="btn btn-ghost btn-sm" data-role="' + esc(u.email) + '" data-r="editor">Make editor</button>' : "") + "</div></div>";
          }).join("");
        $("#tf", p).onsubmit = function (e) { e.preventDefault(); api("admin/users/role/", { email: this.email.value, role: "editor" }).then(refresh).catch(function (er) { alert(er.message); }); };
      });
    },
    demo: function (p) {
      return api("admin/overview/").then(function (c) {
        p.innerHTML = "<h2>Sample data</h2><p>Sample sellers and listings show visitors how the marketplace works. They are labelled <b>Sample</b>, cannot be contacted and are hidden from Google. Remove them once real sellers are listing.</p>" +
          "<p><b>" + c.demo + "</b> sample sellers loaded.</p>" + (c.demo ? '<button class="btn btn-dark" data-do="demo/clear" data-confirm="Remove all sample sellers and listings?">Remove all sample data</button>' : '<button class="btn btn-dark" data-do="demo/seed">Load 25 sample sellers and 15 sample dealers</button>');
      });
    },
  };
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-do]");
    if (b) { if (b.dataset.confirm && !confirm(b.dataset.confirm)) return; b.disabled = true; api("admin/" + b.getAttribute("data-do") + "/", {}).then(function () { if (/chats\/.*close/.test(b.dataset.do)) openChat = null; refresh(); }).catch(function (er) { alert(er.message); b.disabled = false; }); return; }
    var r = e.target.closest("[data-reject]");
    if (r) { var why = prompt("Reason shown to the seller:", "Photos or description do not meet the marketplace rules"); if (why === null) return; api("admin/listings/" + r.getAttribute("data-reject") + "/reject/", { reason: why }).then(refresh).catch(function (er) { alert(er.message); }); return; }
    var c = e.target.closest("[data-chat]");
    if (c) { openChat = c.getAttribute("data-chat"); refresh(); return; }
    var ro = e.target.closest("[data-role]");
    if (ro) api("admin/users/role/", { email: ro.getAttribute("data-role"), role: ro.getAttribute("data-r") }).then(refresh).catch(function (er) { alert(er.message); });
  });
  function refresh() {
    return api("admin/overview/").then(function (counts) {
      var keep = $("#pane") && $("#pane").dataset;
      shell(counts);
      var p = $("#pane"); if (keep) { p.dataset.st = keep.st || ""; p.dataset.q = keep.q || ""; }
      p.innerHTML = '<p class="mk-status">Loading…</p>';
      return panes[tab](p);
    }).catch(function (e) { $("#pane") ? ($("#pane").innerHTML = '<p class="sell-msg err">' + esc(e.message) + "</p>") : alert(e.message); });
  }
  function boot() {
    api("me/").then(function (r) {
      if (!r.user) return login();
      if (!r.user.staff) { app.innerHTML = '<div class="sell-card"><h2>No access</h2><p>This dashboard is for i-phones staff. <a href="../sell/">Go to your seller account</a>.</p></div>'; return; }
      me = r.user; refresh();
      clearInterval(timer);
      timer = setInterval(function () { if (tab === "chats" && !document.hidden) { var t = document.activeElement; if (!t || t.tagName !== "TEXTAREA") refresh(); } }, 8000);
    }).catch(function (e) { app.innerHTML = '<div class="sell-card"><p class="sell-msg err">' + esc(e.message) + "</p></div>"; });
  }
  boot();
})();
