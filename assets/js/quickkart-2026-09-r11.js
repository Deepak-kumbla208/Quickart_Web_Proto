/* ====================================================================
   QuickKart prototype — Round 11 (5 October 2026): stock transfers (P9-4b,
   MR !78, D58 a, D81) and, later the same day, the Home Screen (P9-5,
   MR !79, D82) as the backend built them on quickkart-api-service. Every
   change of the day is here.

   Stock transfers — Round 6 already has the flow (request → Accept & send /
   Decline → Mark received, and "Send to store"); this lines up the rules.

   A. Mark received settles the order's short line only while the order is
      still open and the line is not marked unavailable — otherwise the
      units simply join the store's stock (the toast says which).
   B. Cancelling an order cancels its transfer requests that were not sent
      yet ("Cancelled with the order"); one already on the way still
      arrives, and its units join the stock.
   C. Decline: an optional note next to the reason; the lists show the
      reason, the note and who did the last step.
   D. Not enough to send (negative stock off): the backend's words — "Only 2
      on hand at QuickKart Clementi — this business does not allow negative
      stock" — on Accept & send and on Stock ▸ Transfer (Send to store).
   E. A product with a transfer still requested or on the way can't be
      deleted, nor a store with one to or from it (D81 b) — the backend's
      words.

   Home Screen (Marketing ▸ Home Screen) — the editor already does what
   P9-5 built (sections on/off and dragged, rails, banners, promo sections,
   tiles with their category / tag / icon, combos, theme & branding); this
   adds the backend's checks:
   F. A combo's bundle price must be below what its products cost apart
      ("Bundle price must be below S$11.70 — what these products cost
      apart"); a combo holds at most 10 products.
   G. Limits: 20 tiles a section, 10 promo sections, 20 products a promo
      section, 30 combos ("The home page holds at most … — delete one
      first").
   H. Titles at most 80 characters, subtitles 200.
   I. Every Home Screen change is in Setup ▸ Audit log (the backend audits
      them): sections, tiles, combos, the order, theme & branding.

   Business Settings (Setup ▸ Business Settings) — later the same day, as
   P9-6 (MR !80) built it; every card keeps its own Save:
   J. Company Profile: Website, WhatsApp number and Timezone boxes; legal
      name, trading-as and UEN required; the UEN, GST number, SFA licence,
      email and phones checked with the backend's words, shown by the box.
   K. Payment methods: the last one on cannot be switched off — checkout
      needs one for every order, even one the wallet pays in full.
   L. Delivery & Payments ▸ Order rules (new card): customers may cancel
      until (new / confirmed / picking / packing — never once it is ready
      for the rider), the most of one item per order (1–99), returns within
      N days of delivery (0 = none; applies at once).
   M. Delivery & Payments ▸ Rider pay (new card): what a rider earns per
      delivery (was a fixed S$5.00); an order keeps its amount.
   N. Stock Rules ▸ Goodwill limits: the staff credit has its own period,
      and a per-staff-member daily limit (default S$200; above it only the
      Super Admin) — Customers ▸ Add wallet credit enforces both.
   P. Order timing targets: the alert and the express buffer go to 240 min.
   Q. Peak-hour time sections: at least one, at most 24, names ≤ 40.
   R. The demo follows the new settings: the customer's Cancel and Return
      buttons, the cart's per-item limit, the rider's earnings.
   S. Every Business Settings save is one entry in Setup ▸ Audit log.

   Delivery Slots (Delivery Masters ▸ Delivery Slots) — later again, as P9-6b
   (MR !81, D59) built it:
   T. Slot times: changed only by the Super Admin or Business Settings edit;
      1–9999 orders a slot; a slot ends after it starts ("00:00" = midnight);
      a window listed twice refused; the cut-off up to 10080 minutes. A slot
      time whose hours change is a new window — orders booked in the old one
      stay there, listed as "No longer offered" under their day.
   U. A store's day: the override box on a one-off slot is its own capacity
      (no Reset); a one-off slot can't be deleted while booked, can't repeat
      a window the day has, and starts empty (no demo bookings).
   V. Move to…: any open, not-full, not-started slot of the store on any of
      its days (staff are not held to the customer's cut-off); Orders edit
      may move too; "The customer is not told" next to it.
   W. "Open another date": any date up to 60 days ahead.
   X. Slot times, a day's capacity, close / reopen, one-off slots and moved
      orders are in Setup ▸ Audit log.

   Notification providers (Setup ▸ Notifications) — later again, as P9-8a
   (D65, D83) built it: there is NO QuickKart shared provider.
   Y. Every card is the business's own account (the "Use QuickKart's shared
      provider" choice is gone), with "Set up" / "Not set up" — not set up
      sends nothing, and without SMS customers can't log in. SMS off stops
      the SMS messages, never the login codes.
   Z. Channels & providers is the Super Admin's only (others see the
      templates); every save or switch emails every Super Admin and is in the
      audit log; Send test goes to you only (your email, your own mobile,
      Firebase as a dry run), at most 5 in 10 minutes.

   Message templates (Setup ▸ Notifications ▸ Message templates) — later
   again, as P9-8b (D51 b, D84) built it:
   AA. Each message has its own channels (fixed) and a separate text for
       each: a tab per channel with its subject (email / push), text,
       on / off, preview and Reset. The login code and the admin links are
       always on. The backend's checks: only the message's placeholders,
       {{code}} first in the login SMS, the reset / invite link kept, the
       lengths (SMS 480, push 65 / 240, email 150 / 5000).
   AB. New messages: Order placed (email receipt), Delivery slot reminder
       (push — Delivery Slots ▸ "Remind customers before their slot"),
       Cash reminder, Message from the store, Order assigned to you
       ("Not sent yet" — later screens).

   Promotions and Coupons (Marketing) — later again, as P9-7 (MR !84,
   D85) built them:
   AC. Promotions are home-page slides only — no notification ("Create &
       show to customers"); a title (≤ 80) and a picture needed, subtitle
       ≤ 200; at most 20 live; only with the plan's Promotions feature.
   AD. Coupons: "Starts on" as well as the last day (whole days); total
       uses, uses per customer and first order only; the backend's checks
       on the code, the value per type (none for free delivery), the cap
       (percent only) and the dates, shown by the box.
   AE. The list: Live / Scheduled / Paused / Expired / Used up, times used
       and the discount given, a state filter, the export's new columns;
       the customer's checkout follows the dates and the limits.
   AF. Promotions and coupons are in Setup ▸ Audit log.

   In the real admin app (quickkart-api-service docs/08 §36): the lists are
   GET /admin/stock-transfers?view=to_send|to_receive|waiting|sent|done, the
   badge GET /admin/stock-transfers/counts, "Request N from <store> (has
   12)" GET /admin/stock-transfers/stores (every other store's count of the
   one product — a Store Manager sees it too, D81 a); POST to ask or (send:
   true) to send; PATCH …/send, …/decline, …/cancel, …/receive. Every
   transfer carries `actions` — show only those buttons.
   ==================================================================== */

(function round11() {
  const OPEN = ["requested", "sent"];
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const notEnough = (have, store) => `Only ${have} on hand at ${store} — this business does not allow negative stock`;

  /* D. Accept & send: the backend's words when the store has too few. */
  const baseSend = window.sendTransfer;
  window.sendTransfer = function (id, silent) {
    const t = transferById(id);
    const have = storeQty(t.fromId, t.itemId) || 0;
    if (!allowNegativeStock() && have < t.qty) return notEnough(have, findBranch(t.fromId).name);
    return baseSend(id, silent);
  };

  /* D. Stock ▸ Transfer (Send to store): the same words. */
  const baseSaveMove = Submits["save-stock-move"];
  Submits["save-stock-move"] = (form, ev) => {
    const m = UI.modal;
    if (m && m.mode === "transfer") {
      const fd = new FormData(form);
      const itemId = Number(fd.get("itemId"));
      const qty = Math.floor(Number(fd.get("qty")));
      const onHand = storeQty(m.branchId, itemId) || 0;
      if (Number.isFinite(qty) && qty > 0 && !allowNegativeStock() && qty > onHand) {
        UI.modal.error = notEnough(onHand, findBranch(m.branchId).name);
        if (!m.itemId) UI.modal.itemId = itemId;
        render();
        return;
      }
    }
    return baseSaveMove(form, ev);
  };

  /* A. Mark received: the order line only while the order is open and the line still short and available. */
  const baseReceive = window.receiveTransfer;
  function settlesLine(t) {
    const o = t.orderId ? State.orders.find((x) => x.id === t.orderId) : null;
    const line = o && o.items[t.idx];
    return Boolean(line && !TERMINAL_STATUSES.includes(o.status) && !line.unavailable && !line.resolution && (line.short || 0) > 0);
  }
  window.receiveTransfer = function (id) {
    const t = transferById(id);
    if (!t.orderId || settlesLine(t)) return baseReceive(id);
    // The order closed, or the line was marked unavailable: the units simply join the store's stock.
    recordStockMove({ branchId: t.toId, itemId: t.itemId, type: "transfer_in", qty: t.qty, ref: `From ${findBranch(t.fromId).name} for #${t.orderId}`, note: t.note });
    setTransfer(id, { settledQty: 0 }, "received");
  };
  Actions["transfer-receive"] = (el) => {
    const t = transferById(el.dataset.id);
    const forOrder = t.orderId && settlesLine(t);
    const joins = t.orderId && !forOrder;
    receiveTransfer(el.dataset.id);
    showToast(joins
      ? `Received — added to ${findBranch(t.toId).name}'s stock (order #${t.orderId} no longer needs it)`
      : forOrder ? `Received — order #${t.orderId}'s short item is covered` : "Received — stock added");
    render();
  };

  /* B. A cancelled order's requests that were not sent yet are cancelled with it (any cancel path). */
  function cancelWithOrders() {
    const cancelled = new Set(State.orders.filter((o) => o.status === "cancelled").map((o) => o.id));
    const stale = State.transfers.filter((t) => t.status === "requested" && t.orderId && cancelled.has(t.orderId));
    if (!stale.length) return;
    const ids = new Set(stale.map((t) => t.id));
    State.transfers = State.transfers.map((t) => !ids.has(t.id) ? t : {
      ...t,
      status: "cancelled",
      withOrder: true,
      history: [...t.history, { status: "cancelled", at: Date.now(), by: "", withOrder: true }],
    });
    saveTransfers();
  }
  const baseRender = window.render;
  window.render = function () { cancelWithOrders(); baseRender(); };

  /* C. Decline with an optional note. */
  Actions["transfer-decline"] = (el) => {
    const reason = document.getElementById("declineReason").value;
    const note = String((document.getElementById("declineNote") || {}).value || "").trim().slice(0, 500);
    setTransfer(el.dataset.id, { declineReason: reason, declineNote: note }, "declined", { reason, note });
    UI.declineFor = null;
    showToast("Declined — it shows under Done for the other store");
    render();
  };

  /* C. Stock ▸ Transfers: Round 6's lists, with the decline note, "with the order" and who did the last step. */
  window.transfersHTML = function (branchId) {
    const editable = canEdit(currentUser(), "inventory");
    const inScope = (id) => branchId == null || id === branchId;
    const all = State.transfers;
    const toSend = all.filter((t) => t.status === "requested" && inScope(t.fromId));
    const toReceive = all.filter((t) => t.status === "sent" && inScope(t.toId));
    const waiting = all.filter((t) => t.status === "requested" && inScope(t.toId));
    const outgoing = all.filter((t) => t.status === "sent" && inScope(t.fromId));
    const done = all.filter((t) => ["received", "declined", "cancelled"].includes(t.status) && (inScope(t.fromId) || inScope(t.toId))).slice(0, 30);
    const why = (t, last) => {
      if (t.status === "declined" && t.declineReason) return ` · ${esc(t.declineReason)}${t.declineNote ? ` — ${esc(t.declineNote)}` : ""}`;
      if (t.status === "cancelled" && t.withOrder) return " · with the order";
      if (t.status === "received" && t.settledQty === 0 && t.orderId) return " · joined the stock";
      return last.by ? ` · ${esc(last.by)}` : "";
    };
    const row = (t, actions, declineHere) => {
      const item = findItem(t.itemId) || {};
      const last = t.history[t.history.length - 1];
      return `
      <div class="tr-row">
        <span class="tr-what"><b>${t.qty} × ${esc(item.name || "")}</b><span class="qk-muted small">${esc(item.sku || "")}${t.orderId ? ` · for order <button class="link-btn small" data-action="open-order" data-id="${t.orderId}">#${esc(t.orderId)}</button>` : ""}${t.note ? ` · ${esc(t.note)}` : ""}</span></span>
        <span class="small">${esc(findBranch(t.fromId).name.replace("QuickKart ", ""))} → ${esc(findBranch(t.toId).name.replace("QuickKart ", ""))}</span>
        <span><span class="tr-chip tr-${t.status}">${esc(TRANSFER_STATUS[t.status].label)}</span><span class="qk-muted small"> ${timeAgo(last.at)}${why(t, last)}</span></span>
        <span class="tr-act">${editable ? actions : ""}</span>
      </div>
      ${declineHere && UI.declineFor === t.id ? `
      <div class="tr-decline">
        <label class="small" for="declineReason">Why can't you send it?</label>
        <select class="input input-sm" id="declineReason">${DECLINE_REASONS.map((r) => `<option>${r}</option>`).join("")}</select>
        <input class="input input-sm" id="declineNote" maxlength="500" placeholder="Note (optional)" aria-label="Note (optional)" />
        <button type="button" class="btn btn-sm btn-outline-danger" data-action="transfer-decline" data-id="${t.id}">Decline</button>
        <button type="button" class="link-btn small" data-action="transfer-decline-cancel">Back</button>
      </div>` : ""}`;
    };
    const section = (title, hint, list, actions, declineHere = false) => `
    <div class="tr-section">
      <div class="rail-title">${title} <span class="qk-muted small">${list.length}</span></div>
      ${hint ? `<div class="qk-muted small" style="margin:-4px 0 6px">${hint}</div>` : ""}
      ${list.length ? list.map((t) => row(t, actions(t), declineHere)).join("") : `<div class="qk-muted small tr-empty">Nothing here.</div>`}
    </div>`;
    return `
    <div class="admin-toolbar"><div class="qk-muted small">A transfer is a request between stores: the other store accepts and sends it (its stock goes down), then the receiving store marks it received (its stock goes up). Every step is in Stock history. A request for an order is cancelled if the order is cancelled before it is sent.</div></div>
    <div class="tr-grid">
      ${section("To send", "Other stores asked for these. Accepting takes the stock out of your store now.", toSend, (t) => `<button type="button" class="btn btn-sm btn-primary" data-action="transfer-accept" data-id="${t.id}">Accept &amp; send</button><button type="button" class="btn btn-sm btn-outline" data-action="transfer-decline-open" data-id="${t.id}">Decline</button>`, true)}
      ${section("To receive", "On the way to you. Mark received when it arrives.", toReceive, (t) => `<button type="button" class="btn btn-sm btn-primary" data-action="transfer-receive" data-id="${t.id}">Mark received</button>`)}
      ${section("Waiting on other stores", "You asked; they haven't answered yet.", waiting, (t) => `<button type="button" class="link-btn small" data-action="transfer-cancel" data-id="${t.id}">Cancel</button>`)}
      ${section("Sent by you", "", outgoing, () => "")}
      ${section("Done", "Last 30.", done, () => "")}
    </div>`;
  };

  /* E. Deleting a product (D81 b): not while a transfer of it is requested or on the way. */
  const baseDeleteItem = Actions["delete-item"];
  Actions["delete-item"] = (el) => {
    const item = findItem(Number(el.dataset.id));
    // A store still holding it is Round 10's message, as the backend checks that first.
    const holds = item && State.branches.some((b) => (storeQty(b.id, item.id) || 0) !== 0);
    const open = item ? State.transfers.filter((t) => t.itemId === item.id && OPEN.includes(t.status)).length : 0;
    if (item && !holds && open) {
      showToast(`${plural(open, "stock transfer", "stock transfers")} of this product ${open === 1 ? "is" : "are"} still open — receive, decline or cancel ${open === 1 ? "it" : "them"} first`, "danger");
      return;
    }
    return baseDeleteItem(el);
  };

  /* E. Deleting a store (D81 b): not while a transfer to or from it is requested or on the way. */
  const baseDeleteBranch = Actions["delete-branch"];
  Actions["delete-branch"] = (el) => {
    const b = findBranch(Number(el.dataset.id));
    const activeOrders = b && State.orders.some((o) => o.branchId === b.id && !TERMINAL_STATUSES.includes(o.status));
    const open = b ? State.transfers.filter((t) => (t.fromId === b.id || t.toId === b.id) && OPEN.includes(t.status)).length : 0;
    if (b && !activeOrders && open) {
      showToast(`This store has ${plural(open, "open stock transfer", "open stock transfers")} — receive, decline or cancel ${open === 1 ? "it" : "them"} first`, "danger");
      return;
    }
    return baseDeleteBranch(el);
  };
})();

/* ---------------- Later the same day: the Home Screen as P9-5 built it (MR !79, D82) ---------------- */
/* In the real admin app (quickkart-api-service docs/08 §37): GET /admin/home-sections (every section with `editable`
   and its tiles), PATCH / POST / DELETE and PUT …/order; tiles under …/:sectionId/tiles; /admin/combos (each with
   `membersTotal` and `saving`); GET / PUT /admin/site-customization (all eleven colours, the logo, `defaults`). */
(function round11HomeScreen() {
  const LIMITS = { tiles: 20, promoSections: 10, promoProducts: 20, combos: 30, comboProducts: 10 };
  const TITLE_MAX = 80;
  const SUBTITLE_MAX = 200;
  const limit = (n, what) => `The home page holds at most ${n} ${what} — delete one first`;
  const textProblem = (fd) => {
    if (String(fd.get("title") || "").trim().length > TITLE_MAX) return `Keep the title to ${TITLE_MAX} characters`;
    if (String(fd.get("subtitle") || "").trim().length > SUBTITLE_MAX) return `Keep the subtitle to ${SUBTITLE_MAX} characters`;
    return null;
  };
  // F, G, H. A check before the save the earlier rounds built (Round 10's picture rules still run after it).
  const guard = (key, check) => {
    const base = Submits[key];
    Submits[key] = (form, ev) => {
      const problem = check(form, new FormData(form));
      if (problem) { UI.modal.error = problem; render(); return; }
      return base(form, ev);
    };
  };
  guard("save-section-edit", (_form, fd) => textProblem(fd));
  guard("save-promo-section", (_form, fd) => {
    const adding = !(UI.modal.form || {}).id;
    if (adding && State.homeSections.filter((s) => s.type === "promo").length >= LIMITS.promoSections) {
      return limit(LIMITS.promoSections, "promo sections");
    }
    if (fd.getAll("itemIds").length > LIMITS.promoProducts) return `A promo section shows at most ${LIMITS.promoProducts} products`;
    return textProblem(fd);
  });
  guard("save-tile", (form, fd) => {
    const section = State.homeSections.find((s) => s.id === Number(form.dataset.section));
    if (form.dataset.tile === "new" && (section.tiles || []).length >= LIMITS.tiles) return limit(LIMITS.tiles, "tiles in one section");
    return textProblem(fd);
  });
  guard("save-combo", (form, fd) => {
    const section = State.homeSections.find((s) => s.id === Number(form.dataset.section));
    const itemIds = fd.getAll("itemIds").map(Number);
    const price = Number(fd.get("bundlePrice")) || 0;
    if (form.dataset.combo === "new" && (section.combos || []).length >= LIMITS.combos) return limit(LIMITS.combos, "combos");
    if (itemIds.length > LIMITS.comboProducts) return `A combo holds at most ${LIMITS.comboProducts} products`;
    const text = textProblem(fd);
    if (text) return text;
    // An empty title, no products or no price: the form's own messages, as before.
    if (!String(fd.get("title") || "").trim() || !itemIds.length || price <= 0) return null;
    const apart = Math.round(comboIndividualTotal({ itemIds }) * 100) / 100;
    if (price >= apart) return `Bundle price must be below ${money(apart)} — what these products cost apart`;
    return null;
  });

  // I. Every Home Screen change in the audit log, as the backend records them.
  Object.assign(AUDIT_ACTION_TEXT, {
    "home_section.created": ["Home sections", "added home section"],
    "home_section.updated": ["Home sections", "changed home section"],
    "home_section.deleted": ["Home sections", "deleted home section"],
    "home_section.reordered": ["Home sections", "reordered the home sections"],
    "home_tile.created": ["Home tiles", "added a tile to"],
    "home_tile.updated": ["Home tiles", "changed a tile of"],
    "home_tile.deleted": ["Home tiles", "deleted a tile of"],
    "home_tile.reordered": ["Home tiles", "reordered the tiles of"],
    "combo.created": ["Combos", "added combo"],
    "combo.updated": ["Combos", "changed combo"],
    "combo.deleted": ["Combos", "deleted combo"],
    "combo.reordered": ["Combos", "reordered the combos"],
    "site_customization.updated": ["Theme & branding", "changed the theme & branding"],
  });
  Object.assign(AUDIT_ENTITY_LABEL, {
    home_section: "Home sections",
    home_tile: "Home tiles",
    combo: "Combos",
    site_customization: "Theme & branding",
  });
  Object.assign(AUDIT_FIELD_LABEL, {
    enabled: "Shown", title: "Title", subtitle: "Subtitle", image: "Picture", poolKey: "Products from", itemIds: "Products",
    icon: "Icon", catId: "Category", tag: "Tag", bundlePrice: "Bundle price", logoUrl: "Logo", logoSize: "Logo size",
  });

  const SECTION_FIELDS = ["enabled", "title", "subtitle", "image", "poolKey", "itemIds"];
  const TILE_FIELDS = ["title", "subtitle", "image", "icon", "catId", "tag"];
  const COMBO_FIELDS = ["title", "subtitle", "image", "bundlePrice", "itemIds"];
  const snap = () => JSON.parse(JSON.stringify({ sections: State.homeSections, site: State.siteCustomization || {} }));
  const labelOf = (s) => homeSectionLabel(s);
  // An uploaded picture is a long data: address — the log says so instead of storing it again.
  const shown = (v) => (typeof v === "string" && v.startsWith("data:") ? "(uploaded picture)" : v ?? null);
  const pick = (r, keys) => Object.fromEntries(keys.map((k) => [k, shown(r[k])]));
  const changedKeys = (a, b, keys) => keys.filter((k) => !auditSame(a[k], b[k]));
  const inOrder = (list) => [...list].sort((x, y) => (x.order || 0) - (y.order || 0));

  function recordHome(before, actor) {
    if (!actor) return;
    const by = { actorType: "user", actorId: actor.id };
    const after = snap();
    const was = new Map(before.sections.map((s) => [s.id, s]));
    const now = new Map(after.sections.map((s) => [s.id, s]));
    for (const s of after.sections) {
      const o = was.get(s.id);
      const names = { entity: labelOf(s) };
      if (!o) {
        addAuditEvent({ action: "home_section.created", entity: "home_section", entityId: s.id, ...by, after: pick(s, SECTION_FIELDS), names });
        continue;
      }
      const ch = changedKeys(o, s, SECTION_FIELDS);
      if (ch.length) addAuditEvent({ action: "home_section.updated", entity: "home_section", entityId: s.id, ...by, before: pick(o, ch), after: pick(s, ch), names });
      for (const [list, entity, fields] of [["tiles", "home_tile", TILE_FIELDS], ["combos", "combo", COMBO_FIELDS]]) {
        const oldList = o[list] || [];
        const newList = s[list] || [];
        const oldById = new Map(oldList.map((x) => [x.id, x]));
        const newById = new Map(newList.map((x) => [x.id, x]));
        const nameOf = (x) => ({ entity: entity === "combo" ? x.title : labelOf(s) });
        for (const x of newList) {
          const ox = oldById.get(x.id);
          if (!ox) { addAuditEvent({ action: `${entity}.created`, entity, entityId: x.id, ...by, after: pick(x, fields), names: nameOf(x) }); continue; }
          const c = changedKeys(ox, x, fields);
          if (c.length) addAuditEvent({ action: `${entity}.updated`, entity, entityId: x.id, ...by, before: { title: ox.title, ...pick(ox, c) }, after: { title: x.title, ...pick(x, c) }, names: nameOf(x) });
        }
        for (const ox of oldList) {
          if (!newById.has(ox.id)) addAuditEvent({ action: `${entity}.deleted`, entity, entityId: ox.id, ...by, before: pick(ox, ["title"]), names: nameOf(ox) });
        }
        const kept = (l) => inOrder(l).filter((x) => oldById.has(x.id) && newById.has(x.id)).map((x) => x.id);
        if (!auditSame(kept(oldList), kept(newList))) {
          addAuditEvent({
            action: `${entity}.reordered`, entity, entityId: entity === "combo" ? null : s.id, ...by,
            before: { order: inOrder(oldList).map((x) => x.title) }, after: { order: inOrder(newList).map((x) => x.title) },
            names: entity === "combo" ? {} : { entity: labelOf(s) },
          });
        }
      }
    }
    for (const o of before.sections) {
      if (!now.has(o.id)) addAuditEvent({ action: "home_section.deleted", entity: "home_section", entityId: o.id, ...by, before: pick(o, ["title"]), names: { entity: labelOf(o) } });
    }
    const kept = (l) => inOrder(l).filter((s) => was.has(s.id) && now.has(s.id)).map((s) => s.id);
    if (!auditSame(kept(before.sections), kept(after.sections))) {
      addAuditEvent({
        action: "home_section.reordered", entity: "home_section", entityId: null, ...by,
        before: { order: inOrder(before.sections).map(labelOf) }, after: { order: inOrder(after.sections).map(labelOf) },
      });
    }
    const t0 = before.site.theme || {};
    const t1 = after.site.theme || {};
    const b0 = before.site.branding || {};
    const b1 = after.site.branding || {};
    const colours = [...new Set([...Object.keys(t0), ...Object.keys(t1)])].filter((k) => !auditSame(t0[k], t1[k]));
    const logo = ["logoUrl", "logoSize"].filter((k) => !auditSame(b0[k], b1[k]));
    if (colours.length || logo.length) {
      addAuditEvent({
        action: "site_customization.updated", entity: "site_customization", entityId: null, ...by,
        before: { ...pick(t0, colours), ...pick(b0, logo) }, after: { ...pick(t1, colours), ...pick(b1, logo) },
      });
    }
  }
  const audited = (table, name) => {
    const base = table[name];
    if (!base) return;
    table[name] = function (...args) {
      const actor = currentUser();
      const before = snap();
      const result = base.apply(this, args);
      recordHome(before, actor);
      return result;
    };
  };
  ["save-section-edit", "save-promo-section", "save-tile", "save-combo"].forEach((n) => audited(Submits, n));
  ["toggle-home-section", "delete-promo-section", "delete-tile", "delete-combo", "save-theme", "reset-theme"].forEach((n) => audited(Actions, n));
  ["reorderHomeSection", "reorderSectionTiles", "reorderCombos"].forEach((n) => audited(window, n));
})();

/* ---------------- Later the same day: Business Settings as P9-6 built it (MR !80) ---------------- */
/* In the real admin app (quickkart-api-service docs/08 §38): GET /admin/settings answers every setting grouped as these
   cards; PATCH /admin/settings takes only what a card sends — each card keeps its own Save. A refused value is a 422
   naming the field (errors["company.uen"] …) — show it by the box. */
const DEFAULT_BUSINESS_RULES = {
  timezone: "Asia/Singapore",
  customerCancelUntil: "confirmed",
  maxQtyPerItem: 99,
  returnWindowDays: 7,
  riderDeliveryFee: RIDER_FLAT_FEE,
};
State.businessRules = { ...DEFAULT_BUSINESS_RULES, ...loadLS("businessRules", {}) };
function businessRules() { return State.businessRules; }
function riderDeliveryFee() { return Number(businessRules().riderDeliveryFee); }
State.deliverySettings = {
  ...State.deliverySettings,
  goodwill: { staffDays: 30, staffPerUserDay: 200, ...State.deliverySettings.goodwill },
};

(function round11BusinessSettings() {
  const UEN = /^[0-9A-Z]{8,9}[A-Z]$/;
  const GST_REG_NO = /^(?:[0-9A-Z]{8,9}[A-Z]|M[0-9A-Z]-?[0-9]{7}-?[0-9A-Z])$/;
  const PHONE = /^\+?(?=.*[0-9])[0-9 ()-]+$/;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const WEBSITE = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;
  const TIMEZONES = ["Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Jakarta", "Asia/Bangkok", "Asia/Manila", "Asia/Hong_Kong", "Asia/Kolkata", "Asia/Dubai", "Australia/Sydney", "Europe/London"];
  const CANCEL_STEPS = ["new", "confirmed", "picking", "packing"];
  const CANCEL_LABEL = {
    new: "New — until the store confirms it",
    confirmed: "Confirmed — until picking starts (default)",
    picking: "Picking — until packing starts",
    packing: "Packing — until it's ready for the rider",
  };
  const DAY = 86400000;
  const LAST_METHOD = "Keep at least one payment method on — customers could not place any order";
  const regNo = (v) => String(v || "").replace(/\s/g, "").toUpperCase();
  const wholeIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const amountIn = (v, max) => Number.isFinite(v) && v >= 0 && v <= max && Math.round(v * 100) === v * 100;
  const dis = (editable) => (editable ? "" : "disabled");

  /* J. Company Profile: Website, WhatsApp and Timezone boxes; the backend's checks, by the box. */
  window.adminCompanyProfilePanel = (editable) => {
    const c = { ...State.companyProfile, timezone: businessRules().timezone, ...(UI.cpDraft || {}) };
    const err = UI.cpErrors || {};
    const box = (id, key, label, attrs = "") => `<label class="field"><span class="field-label">${label}</span><input class="input" id="${id}" value="${esc(c[key] || "")}" ${attrs} ${dis(editable)} />${err[key] ? `<span class="field-error">${esc(err[key])}</span>` : ""}</label>`;
    const zones = TIMEZONES.includes(c.timezone) ? TIMEZONES : [c.timezone, ...TIMEZONES];
    return `
  <div class="summary-card" style="max-width:480px">
    <div class="summary-card-title">Company Profile</div>
    <div class="qk-muted small">Shown on the customer site footer, the tax invoice, and the login page.</div>
    ${box("cpName", "name", "Legal company name *")}
    ${box("cpTradingAs", "tradingAs", "Trading as *")}
    ${box("cpAddress1", "address1", "Address line 1")}
    ${box("cpAddress2", "address2", "Address line 2")}
    <div class="field-grid-2">
      ${box("cpUen", "uen", "UEN *", 'placeholder="e.g. 201912345K"')}
      ${box("cpGstReg", "gstReg", "GST Reg. No.", 'placeholder="Empty = not GST-registered"')}
    </div>
    ${box("cpSfaLicence", "sfaLicence", "SFA Licence No.")}
    <div class="field-grid-2">
      ${box("cpEmail", "email", "Support email", 'type="email"')}
      ${box("cpPhone", "phone", "Support phone")}
    </div>
    <div class="field-grid-2">
      ${box("cpSupportHours", "supportHours", "Support hours")}
      ${box("cpWhatsapp", "whatsapp", "WhatsApp number", 'placeholder="Optional"')}
    </div>
    ${box("cpWebsite", "website", "Website", 'placeholder="e.g. www.yourshop.sg"')}
    <label class="field"><span class="field-label">Timezone</span>
      <select class="input" id="cpTimezone" ${dis(editable)}>${zones.map((z) => `<option ${z === c.timezone ? "selected" : ""}>${esc(z)}</option>`).join("")}</select>
      <span class="qk-muted small">Order dates, invoices, delivery-slot days and reports follow it.</span>
    </label>
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-company-profile">Save</button>` : ""}
  </div>`;
  };
  Actions["save-company-profile"] = () => {
    const val = (id) => document.getElementById(id).value.trim();
    const draft = {
      name: val("cpName"), tradingAs: val("cpTradingAs"), address1: val("cpAddress1"), address2: val("cpAddress2"),
      uen: regNo(val("cpUen")), gstReg: regNo(val("cpGstReg")), sfaLicence: regNo(val("cpSfaLicence")),
      email: val("cpEmail"), phone: val("cpPhone"), supportHours: val("cpSupportHours"),
      whatsapp: val("cpWhatsapp"), website: val("cpWebsite"), timezone: document.getElementById("cpTimezone").value,
    };
    const errors = {};
    if (draft.name.length < 1 || draft.name.length > 150) errors.name = "Must be 1–150 characters";
    if (draft.tradingAs.length < 1 || draft.tradingAs.length > 100) errors.tradingAs = "Must be 1–100 characters";
    if (!UEN.test(draft.uen)) errors.uen = "Must be a UEN: 9 or 10 letters and digits ending in a letter, e.g. 201912345K";
    if (draft.gstReg && !GST_REG_NO.test(draft.gstReg)) errors.gstReg = "Must be a GST registration number: your UEN, or an M number such as M2-0012345-6";
    if (draft.sfaLicence && !/^[0-9A-Z][0-9A-Z/-]{0,29}$/.test(draft.sfaLicence)) errors.sfaLicence = "Must be 1–30 letters, digits, dashes or slashes";
    if (draft.email && !EMAIL.test(draft.email)) errors.email = "Must be a valid email address";
    for (const key of ["phone", "whatsapp"]) {
      if (draft[key] && (!PHONE.test(draft[key]) || draft[key].length < 3 || draft[key].length > 30)) errors[key] = "Only digits, spaces, brackets, dashes and a leading + (3–30)";
    }
    if (draft.website && !WEBSITE.test(draft.website)) errors.website = "Must be a website address";
    if (Object.keys(errors).length) { UI.cpDraft = draft; UI.cpErrors = errors; render(); return; }
    const { timezone, ...profile } = draft;
    State.companyProfile = { ...State.companyProfile, ...profile };
    State.businessRules = { ...businessRules(), timezone };
    UI.cpDraft = null; UI.cpErrors = null;
    persist("companyProfile"); persist("businessRules"); showToast("Company profile updated"); render();
  };
  const baseTab = Actions["set-business-tab"];
  Actions["set-business-tab"] = (el) => { UI.cpDraft = null; UI.cpErrors = null; return baseTab(el); };

  /* K. Payment methods: the last one on cannot be switched off (checkout needs one for every order). */
  const enabledCount = () => State.deliverySettings.paymentMethods.filter((m) => m.enabled).length;
  const baseToggle = Actions["toggle-payment-method"];
  Actions["toggle-payment-method"] = (el) => {
    const m = State.deliverySettings.paymentMethods.find((x) => x.name === el.dataset.name);
    if (m && m.enabled && enabledCount() <= 1) { showToast(LAST_METHOD, "danger"); return; }
    return baseToggle(el);
  };

  /* L, M. Delivery & Payments: an "Order rules" card and a "Rider pay" card after the timing targets. */
  function orderRulesCardHTML(editable) {
    const r = businessRules();
    return `
  <div class="summary-card" style="max-width:560px; margin-top:16px">
    <div class="summary-card-title">Order rules</div>
    <div class="qk-muted small">What your customers may do with an order.</div>
    <label class="field" style="margin-top:10px"><span class="field-label">Customers may cancel until</span>
      <select class="input" id="ruleCancelUntil" ${dis(editable)}>${CANCEL_STEPS.map((s) => `<option value="${s}" ${r.customerCancelUntil === s ? "selected" : ""}>${CANCEL_LABEL[s]}</option>`).join("")}</select>
      <span class="qk-muted small">Never once the order is ready for the rider. Applies to open orders at once.</span>
    </label>
    <div class="field-grid-2">
      <label class="field"><span class="field-label">Most of one item per order</span><input class="input" type="number" min="1" max="99" id="ruleMaxQty" value="${r.maxQtyPerItem}" ${dis(editable)} /><span class="qk-muted small">1–99. A customer can't add more of one product than this.</span></label>
      <label class="field"><span class="field-label">Returns accepted within (days of delivery)</span><input class="input" type="number" min="0" max="90" id="ruleReturnDays" value="${r.returnWindowDays}" ${dis(editable)} /><span class="qk-muted small">0–90; 0 = no returns. Unlike the other settings, a change applies at once — also to orders already delivered.</span></label>
    </div>
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-order-rules">Save</button>` : ""}
  </div>`;
  }
  function riderPayCardHTML(editable) {
    return `
  <div class="summary-card" style="max-width:420px; margin-top:16px">
    <div class="summary-card-title">Rider pay</div>
    <div class="qk-muted small">A flat amount for each completed delivery, shown in the rider app's Earnings. An order keeps the amount it was delivered with.</div>
    <label class="field" style="margin-top:10px"><span class="field-label">Rider earns per delivery (S$)</span><input class="input" type="number" min="0" max="1000" step="0.1" id="riderFeeInput" value="${riderDeliveryFee()}" ${dis(editable)} /></label>
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-rider-pay">Save</button>` : ""}
  </div>`;
  }
  const deliveryPanel = window.adminDeliveryPanel;
  window.adminDeliveryPanel = (editable) => {
    let html = deliveryPanel(editable);
    // K. The last method on: its Disable button is off, with the reason.
    const on = State.deliverySettings.paymentMethods.filter((m) => m.enabled);
    if (on.length === 1) {
      const name = esc(on[0].name);
      html = html.replace(`data-action="toggle-payment-method" data-name="${name}">Disable`, `data-action="toggle-payment-method" data-name="${name}" disabled title="${LAST_METHOD}">Disable`);
    }
    return `${html}${orderRulesCardHTML(editable)}${riderPayCardHTML(editable)}`;
  };
  Object.assign(Actions, {
    "save-order-rules"() {
      const cancel = document.getElementById("ruleCancelUntil").value;
      const maxQty = Number(document.getElementById("ruleMaxQty").value);
      const days = Number(document.getElementById("ruleReturnDays").value);
      if (!wholeIn(maxQty, 1, 99)) { showToast("Most of one item: must be 1–99", "danger"); return; }
      if (!wholeIn(days, 0, 90)) { showToast("Returns: must be 0–90 days", "danger"); return; }
      State.businessRules = { ...businessRules(), customerCancelUntil: cancel, maxQtyPerItem: maxQty, returnWindowDays: days };
      persist("businessRules"); showToast("Order rules saved"); render();
    },
    "save-rider-pay"() {
      const fee = Number(document.getElementById("riderFeeInput").value);
      if (!amountIn(fee, 1000)) { showToast("Rider pay: must be S$0–1000", "danger"); return; }
      State.businessRules = { ...businessRules(), riderDeliveryFee: fee };
      persist("businessRules"); showToast(`Riders now earn ${money(fee)} per delivery`); render();
    },
  });

  /* N. Goodwill limits: the staff credit's own period and a per-staff-member daily limit (D66 d). */
  window.goodwillCapsCardHTML = (editable) => {
    const g = goodwillSettings();
    const field = (id, label, value, min, max, help) => `<label class="field"><span class="field-label">${label}</span><input class="input" type="number" min="${min}" max="${max}" step="1" id="${id}" value="${value}" ${dis(editable)} />${help ? `<span class="qk-muted small">${help}</span>` : ""}</label>`;
    return `
  <div class="summary-card" style="max-width:560px;margin-top:16px">
    <div class="summary-card-title">Goodwill limits</div>
    <div class="qk-muted small">Two separate limits per customer, each over its own rolling period, so one never eats into the other. The refund part of an unavailable item is always paid in full — only the bonus counts.</div>
    <div class="field-grid-2" style="margin-top:10px">
      ${field("gwBonusCap", "Unavailable-item bonus cap (S$)", g.bonusCap, 0, 1000, "The wallet bonus stops once a customer has received this much in the period. 0 = no bonus.")}
      ${field("gwDays", "Bonus period (days)", g.days, 1, 365)}
      ${field("gwStaffCap", "Staff goodwill credit cap (S$)", g.staffCap, 0, 1000, "The most your team can add to one customer's wallet from Customers ▸ Add wallet credit.")}
      ${field("gwStaffDays", "Staff credit period (days)", g.staffDays, 1, 365)}
    </div>
    ${field("gwStaffPerDay", "Most one staff member can credit per day (S$)", g.staffPerUserDay, 0, 10000, "Across all customers. Above it only the Super Admin can add credit.")}
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-goodwill-caps">Save</button>` : ""}
  </div>`;
  };
  Actions["save-goodwill-caps"] = () => {
    const num = (id) => Number(document.getElementById(id).value);
    const next = {
      ...goodwillSettings(),
      bonusCap: num("gwBonusCap"), days: num("gwDays"),
      staffCap: num("gwStaffCap"), staffDays: num("gwStaffDays"), staffPerUserDay: num("gwStaffPerDay"),
    };
    if (!amountIn(next.bonusCap, 1000) || !amountIn(next.staffCap, 1000)) { showToast("Caps: must be S$0–1000", "danger"); return; }
    if (!amountIn(next.staffPerUserDay, 10000)) { showToast("Per staff member per day: must be S$0–10000", "danger"); return; }
    if (!wholeIn(next.days, 1, 365) || !wholeIn(next.staffDays, 1, 365)) { showToast("Periods: must be 1–365 days", "danger"); return; }
    State.deliverySettings = { ...State.deliverySettings, goodwill: next };
    persist("deliverySettings");
    showToast(`Saved: bonus up to ${money(next.bonusCap)} per ${next.days} days, staff credit up to ${money(next.staffCap)} per ${next.staffDays} days`);
    render();
  };

  /* O. Customers ▸ Add wallet credit: the staff period, and what this staff member may still add today. */
  const isToday = (at) => new Date(at).toDateString() === new Date().toDateString();
  const creditedToday = (name) =>
    customerRecords().reduce((s, c) => s + customerMeta(c.key).credits.filter((cr) => cr.by === name && isToday(cr.at)).reduce((t, cr) => t + cr.amount, 0), 0);
  const dailyLeft = () => {
    const me = currentUser();
    if (!me || isSuperAdmin(me)) return Infinity;
    return Math.max(0, round2(goodwillSettings().staffPerUserDay - creditedToday(me.name)));
  };
  const baseModal = window.customerModal;
  window.customerModal = () => {
    const m = UI.modal;
    const g = goodwillSettings();
    const days = g.days;
    g.days = g.staffDays; // Round 7's dialog reads the period from here; the staff credit has its own.
    let html;
    try { html = baseModal(); } finally { g.days = days; }
    if (!m || m.kind !== "credit") return html;
    const today = dailyLeft();
    if (today === Infinity) return html;
    const note = `<div class="qk-muted small" style="margin:-4px 0 10px">You can add <b>${money(today)}</b> more today (${money(g.staffPerUserDay)} a day per staff member — above that only the Super Admin).</div>`;
    return html
      .replace("This is separate from the bonus on unavailable items.</div>", `This is separate from the bonus on unavailable items.</div>${note}`)
      .replace(/(name="amount" min="0.5" max=")([0-9.]+)(")/, (_m, a, max, b) => `${a}${Math.min(Number(max), today)}${b}`);
  };
  const baseCredit = Submits["save-customer-modal"];
  Submits["save-customer-modal"] = (form) => {
    const m = UI.modal;
    if (!m || m.kind !== "credit") return baseCredit(form);
    const g = goodwillSettings();
    const amount = round2(new FormData(form).get("amount"));
    const used = customerMeta(m.key).credits.filter((cr) => cr.at >= Date.now() - g.staffDays * DAY).reduce((s, cr) => s + cr.amount, 0);
    if (amount > g.staffCap - used + 0.001) { UI.modal.error = `Only ${money(Math.max(0, g.staffCap - used))} left in this period for this customer`; render(); return; }
    if (amount > dailyLeft() + 0.001) { UI.modal.error = `You can add ${money(dailyLeft())} more today — above ${money(g.staffPerUserDay)} a day only the Super Admin can add credit`; render(); return; }
    const days = g.days;
    g.days = g.staffDays;
    try { return baseCredit(form); } finally { g.days = days; }
  };

  /* P. Timing targets: the alert and the express buffer go up to 240 minutes, like the stages. */
  const timingCard = window.timingCardHTML;
  window.timingCardHTML = (editable) => timingCard(editable).replace(/max="120"/g, 'max="240"');

  /* Q. Peak-hour time sections: at least one, at most 24, names up to 40 characters. */
  const baseSections = Submits["save-peak-sections"];
  Submits["save-peak-sections"] = (form, ev) => {
    const rows = readPeakRows();
    const err = !rows.length ? "Keep at least one section"
      : rows.length > 24 ? "At most 24 sections"
      : rows.some((r) => String(r.name || "").trim().length > 40) ? "Keep each name to 40 characters" : null;
    if (err) { UI.modal.rows = rows; UI.modal.error = err; render(); return; }
    return baseSections(form, ev);
  };

  /* R. The demo follows the settings: the customer's Cancel and Return buttons, the cart limit, rider earnings. */
  const baseDetail = window.orderDetailHTML;
  window.orderDetailHTML = (order) => {
    let html = baseDetail(order);
    const r = businessRules();
    const step = CANCEL_STEPS.indexOf(order.status);
    if (step < 0 || step > CANCEL_STEPS.indexOf(r.customerCancelUntil)) {
      html = html.replace(/<button[^>]*data-kind="cancel"[^>]*>[\s\S]*?<\/button>/, "");
    }
    if (order.status === "delivered" && !order.returnRequest) {
      const delivered = [...(order.statusHistory || [])].reverse().find((h) => h.status === "delivered");
      // The demo's seed orders carry no "delivered" step: their last step (or placing time) stands in for it.
      const deliveredAt = delivered ? delivered.at : (order.statusHistory || []).reduce((m, h) => Math.max(m, h.at || 0), order.createdAt || 0);
      const open = r.returnWindowDays > 0 && Date.now() <= deliveredAt + r.returnWindowDays * DAY;
      if (!open) {
        const why = r.returnWindowDays > 0 ? `Returns can be requested within ${r.returnWindowDays} day${r.returnWindowDays === 1 ? "" : "s"} of delivery` : "This shop does not accept returns";
        html = html.replace(/<button[^>]*data-kind="return"[^>]*>[\s\S]*?<\/button>/, `<span class="qk-muted small">${why}</span>`);
      }
    }
    return html;
  };
  const baseInc = window.incCart;
  window.incCart = (id) => {
    const max = businessRules().maxQtyPerItem;
    if ((State.cart[id] || 0) >= max) { showToast(`You can order at most ${max} of this item`, "danger"); return; }
    return baseInc(id);
  };
  const fixEarning = (id, wasDelivered) => {
    const fee = riderDeliveryFee();
    if (wasDelivered || fee === RIDER_FLAT_FEE) return;
    let changed = false;
    State.orders = State.orders.map((o) => {
      if (o.id !== id || o.status !== "delivered" || o.riderEarning !== RIDER_FLAT_FEE) return o;
      changed = true;
      return { ...o, riderEarning: fee };
    });
    if (changed) { persist("orders"); render(); }
  };
  for (const name of ["set-order-status", "complete-delivery"]) {
    const base = Actions[name];
    Actions[name] = (el) => {
      const id = el.dataset.id;
      const was = State.orders.find((o) => o.id === id);
      const result = base(el);
      fixEarning(id, !!was && was.status === "delivered");
      return result;
    };
  }
  const baseEarnings = window.riderEarnings;
  window.riderEarnings = (orders) =>
    baseEarnings(orders).replace(`${money(RIDER_FLAT_FEE)} earned per completed delivery.`, `${money(riderDeliveryFee())} earned per completed delivery.`);

  /* S. Every Business Settings save is one "business_settings.updated" entry in Setup ▸ Audit log, with what changed. */
  const SETTINGS_LABEL = {
    "company.legalName": "Legal company name", "company.tradingAs": "Trading as", "company.address1": "Address line 1",
    "company.address2": "Address line 2", "company.uen": "UEN", "company.gstRegNo": "GST Reg. No.", "company.sfaLicence": "SFA Licence No.",
    "company.supportEmail": "Support email", "company.supportPhone": "Support phone", "company.supportHours": "Support hours",
    "company.whatsappNumber": "WhatsApp number", "company.website": "Website", timezone: "Timezone",
    "tax.name": "Tax name", "tax.rate": "Tax rate (%)", "tax.inclusive": "Prices include tax", "tax.onDeliveryFee": "GST on the delivery fee",
    "tax.onExpressCharge": "GST on the express charge", "delivery.fee": "Delivery fee", "delivery.freeDeliveryThreshold": "Free delivery above",
    "delivery.expressEnabled": "Express delivery", "delivery.expressCharge": "Express charge", paymentMethods: "Payment methods on",
    "orders.confirmation": "Order confirmation", "orders.customerCancelUntil": "Customers may cancel until", "orders.maxQtyPerItem": "Most of one item",
    "orders.returnWindowDays": "Returns within (days)", "timing.stageTargets.new": "Accept a new order (min)", "timing.stageTargets.confirmed": "Start picking (min)",
    "timing.stageTargets.picking": "Picking (min)", "timing.stageTargets.packing": "Packing (min)", "timing.stageTargets.readyForRider": "Waiting for the rider (min)",
    "timing.stageTargets.pickedUp": "Out for delivery (min)", "timing.notAcceptedAlertMinutes": "\"Not accepted\" alert (min)",
    "timing.expressDueBufferMinutes": "Express due buffer (min)", "stock.allowNegativeStock": "Negative stock allowed", "stock.costPriceMethod": "Cost price on receiving",
    "unavailableItems.bonusPercent": "Wallet refund bonus (%)", "unavailableItems.answerMinutes": "Time to answer (min)", "unavailableItems.noAnswer": "If no answer",
    "goodwill.bonusCapAmount": "Bonus cap", "goodwill.bonusCapDays": "Bonus period (days)", "goodwill.staffCapAmount": "Staff credit cap",
    "goodwill.staffCapDays": "Staff credit period (days)", "goodwill.staffCapPerUserPerDay": "Staff credit per person per day",
    "slots.daysAhead": "Days customers can book ahead", "slots.cutoffMinutes": "Stop taking orders before a slot (min)",
    "slots.reminderMinutes": "Slot reminder (min before)",
    "riders.deliveryFee": "Rider earns per delivery", timeSections: "Peak-hour time sections",
  };
  function settingsSnapshot() {
    const c = State.companyProfile, t = State.tax, d = State.deliverySettings, r = businessRules();
    const tm = timingSettings(), g = goodwillSettings(), s = subSettings(), st = State.slotSettings || {};
    return {
      "company.legalName": c.name, "company.tradingAs": c.tradingAs, "company.address1": c.address1 || null, "company.address2": c.address2 || null,
      "company.uen": c.uen || null, "company.gstRegNo": c.gstReg || null, "company.sfaLicence": c.sfaLicence || null, "company.supportEmail": c.email || null,
      "company.supportPhone": c.phone || null, "company.supportHours": c.supportHours || null, "company.whatsappNumber": c.whatsapp || null,
      "company.website": c.website || null, timezone: r.timezone,
      "tax.name": t.name, "tax.rate": t.rate, "tax.inclusive": t.inclusive !== false, "tax.onDeliveryFee": !!t.taxOnDeliveryFee, "tax.onExpressCharge": !!t.taxOnExpressCharge,
      "delivery.fee": d.deliveryFee, "delivery.freeDeliveryThreshold": d.freeDeliveryThreshold, "delivery.expressEnabled": d.expressEnabled !== false,
      "delivery.expressCharge": d.expressCharge, paymentMethods: d.paymentMethods.filter((m) => m.enabled).map((m) => m.name),
      "orders.confirmation": confirmationMode(), "orders.customerCancelUntil": r.customerCancelUntil, "orders.maxQtyPerItem": r.maxQtyPerItem,
      "orders.returnWindowDays": r.returnWindowDays, "timing.stageTargets.new": tm.new, "timing.stageTargets.confirmed": tm.confirmed,
      "timing.stageTargets.picking": tm.picking, "timing.stageTargets.packing": tm.packing, "timing.stageTargets.readyForRider": tm.ready_for_rider,
      "timing.stageTargets.pickedUp": tm.picked_up, "timing.notAcceptedAlertMinutes": tm.confirmAlertMins, "timing.expressDueBufferMinutes": tm.expressBufferMins,
      "stock.allowNegativeStock": !!d.allowNegativeStock, "stock.costPriceMethod": d.costPriceMethod || "average",
      "unavailableItems.bonusPercent": s.walletBonusPct, "unavailableItems.answerMinutes": s.answerMins, "unavailableItems.noAnswer": s.noAnswer,
      "goodwill.bonusCapAmount": g.bonusCap, "goodwill.bonusCapDays": g.days, "goodwill.staffCapAmount": g.staffCap, "goodwill.staffCapDays": g.staffDays,
      "goodwill.staffCapPerUserPerDay": g.staffPerUserDay, "slots.daysAhead": st.daysAhead, "slots.cutoffMinutes": st.cutoffMins, "slots.reminderMinutes": st.reminderMins == null ? 60 : st.reminderMins,
      "riders.deliveryFee": r.riderDeliveryFee, timeSections: (State.peakSections || []).map((p) => `${p.name} ${p.start}–${p.end}`),
    };
  }
  Object.assign(AUDIT_ACTION_TEXT, { "business_settings.updated": ["Business settings", "changed the business settings"] });
  Object.assign(AUDIT_ENTITY_LABEL, { business_settings: "Business settings" });
  Object.assign(AUDIT_FIELD_LABEL, SETTINGS_LABEL);
  const audited = (table, name) => {
    const base = table[name];
    if (!base) return;
    table[name] = function (...args) {
      const actor = currentUser();
      const before = settingsSnapshot();
      const result = base.apply(this, args);
      const after = settingsSnapshot();
      const changed = Object.keys(after).filter((k) => !auditSame(before[k], after[k]));
      if (actor && changed.length) {
        addAuditEvent({
          action: "business_settings.updated", entity: "business_settings", entityId: null, actorType: "user", actorId: actor.id,
          before: Object.fromEntries(changed.map((k) => [k, before[k]])), after: Object.fromEntries(changed.map((k) => [k, after[k]])),
        });
      }
      return result;
    };
  };
  [
    "save-company-profile", "save-tax", "save-delivery-fee", "toggle-payment-method", "save-express", "save-fee-tax", "save-confirmation-mode",
    "save-timing", "save-order-rules", "save-rider-pay", "save-stock-rules", "save-cost-method", "save-substitution", "save-goodwill-caps",
  ].forEach((n) => audited(Actions, n));
  ["save-peak-sections", "save-slot-templates"].forEach((n) => audited(Submits, n));
})();

/* ---------------- Later the same day: Delivery Slots as P9-6b built it (MR !81, D59) ---------------- */
/* In the real admin app (quickkart-api-service docs/08 §39): GET / PUT /admin/delivery-slots/templates (the whole list);
   GET /admin/delivery-slots/:storeId (the days; ?format=xlsx) and …/:storeId/:date (up to 60 days); PUT / DELETE
   …/:date/:window/override; POST …/close and …/reopen; POST …/:date/extra and DELETE …/:date/:window; GET …/orders;
   POST /admin/orders/:orderId/move-slot. A slot is named by its times: a slot time whose hours change is a new window,
   and orders booked in the old one stay there ("No longer offered"). */
(function round11DeliverySlots() {
  const DAY = 86400000;
  const MAX_CAPACITY = 9999;
  const HORIZON_DAYS = 60;
  const endsAfterStart = (s, e) => (e > s) || (e === "00:00" && s !== "00:00");
  const range = (s) => fmtSlotRange(s);
  const todayIso = () => isoDate(new Date());
  const canEditTimes = () => { const u = currentUser(); return !!u && (isSuperAdmin(u) || canEdit(u, "tax")); };
  const canEditSlots = () => canEdit(currentUser(), "slots");
  const canMove = () => { const u = currentUser(); return !!u && (canEdit(u, "slots") || canEdit(u, "orders")); };
  const audit = (action, entityId, before, after, names) => {
    const u = currentUser();
    if (u) addAuditEvent({ action, entity: action.split(".")[0], entityId, actorType: "user", actorId: u.id, before, after, names });
  };
  const started = (date, slot) => {
    if (date !== todayIso()) return date < todayIso();
    const [h, m] = slot.start.split(":").map(Number);
    const at = new Date(); at.setHours(h, m, 0, 0);
    return Date.now() >= at.getTime();
  };
  const dateLabel = (date) => slotDayLabel(date);
  // Windows that were slot times once — the "No longer offered" rows name them by their hours.
  const retiredWindow = (slotId) => (State.slotSettings.retiredWindows || {})[slotId] || null;
  const ordersIn = (key) => State.orders.filter((o) => o.slotKey === key && o.status !== "cancelled");

  /* A–C. The Slot times card: changed only by the Super Admin or Business Settings edit; 1–9999 orders a slot; a slot
     ends after it starts ("00:00" = midnight); the cut-off up to a week (10080 minutes). */
  function templatesCardHTML() {
    const st = State.slotSettings;
    const editable = canEditTimes();
    const dis = editable ? "" : "disabled";
    return `
  <div class="summary-card">
    <div class="summary-card-title">Slot times — used every day, at every store</div>
    <div class="qk-muted small" style="margin-bottom:10px">Each row is a delivery window customers can pick. Capacity is how many orders one store accepts in that window (1–9999); change a single day's number below with an override. A slot that ends at midnight ends at 00:00.${editable ? "" : " Only the Super Admin or someone with Business Settings at edit can change slot times."}</div>
    <form data-action="save-slot-templates">
      <div class="slot-tpl-grid">
        <div class="slot-tpl-head"><span>From</span><span>To</span><span>Orders per slot</span><span></span></div>
        ${st.templates.map((t, i) => `
          <div class="slot-tpl-row">
            <input class="input" type="time" name="start_${i}" value="${esc(t.start)}" ${dis} />
            <input class="input" type="time" name="end_${i}" value="${esc(t.end)}" ${dis} />
            <input class="input" type="number" min="1" max="${MAX_CAPACITY}" name="cap_${i}" value="${t.capacity}" ${dis} />
            ${editable ? `<button type="button" class="icon-btn icon-btn-danger" data-action="remove-slot-template" data-idx="${i}" aria-label="Remove">${ic("trash")}</button>` : "<span></span>"}
          </div>`).join("")}
      </div>
      <div class="field-grid-2" style="margin-top:12px">
        <label class="field"><span class="field-label">Days customers can book ahead (1–14)</span><input class="input" type="number" min="1" max="14" name="daysAhead" value="${st.daysAhead}" ${dis} /></label>
        <label class="field"><span class="field-label">Stop taking orders before a slot starts (minutes)</span><input class="input" type="number" min="0" max="10080" name="cutoffMins" value="${st.cutoffMins}" ${dis} /><span class="qk-muted small">Customers only — your team can still move an order into a slot until it starts.</span></label>
        <label class="field"><span class="field-label">Remind customers before their slot (minutes)</span><input class="input" type="number" min="0" max="480" name="reminderMins" value="${st.reminderMins == null ? 60 : st.reminderMins}" ${dis} /><span class="qk-muted small">A push this long before the slot starts — 0 = no reminder. The wording is in Notifications ▸ Message templates.</span></label>
      </div>
      ${editable ? `<div class="form-actions"><button type="button" class="btn btn-outline" data-action="add-slot-template">${ic("plus")} Add slot time</button><button type="submit" class="btn btn-primary">Save slot times</button></div>` : ""}
    </form>
  </div>`;
  }

  /* D–F. A store's day: the override box (a one-off slot's own capacity), Close / Reopen, a one-off slot deleted only
     when nobody is booked, "No longer offered" windows, Move to… any open, not-full, not-started slot of the store. */
  function moveOptionsHTML(branch, fromKey) {
    const dates = [...new Set([...slotDays().map((d) => d.date), UI.slotOtherDate].filter(Boolean))];
    return dates.map((date) => {
      const opts = slotsFor(branch.id, date)
        .map((s) => ({ s, inf: slotInfo(branch.id, date, s) }))
        .filter(({ s, inf }) => inf.key !== fromKey && !inf.closed && inf.booked < inf.cap && !started(date, s))
        .map(({ s, inf }) => `<option value="${inf.key}">${esc(range(s))} (${inf.booked}/${inf.cap})</option>`)
        .join("");
      return opts ? `<optgroup label="${esc(dateLabel(date))}">${opts}</optgroup>` : "";
    }).join("");
  }
  function ordersListHTML(branch, key, orders) {
    const movable = canMove();
    return `<div class="slot-orders">
      ${orders.length ? orders.map((o) => `<div class="row"><span>#${o.id} · ${esc(o.customerName)} <span class="badge badge-${STATUS_META[o.status].tone}-soft">${STATUS_META[o.status].label}</span></span>
        ${movable && ["new", "confirmed", "picking", "packing", "ready_for_rider"].includes(o.status) ? `<select class="input input-sm" data-action="move-slot-order" data-id="${o.id}"><option value="">Move to…</option>${moveOptionsHTML(branch, key)}</select>` : ""}</div>`).join("")
        : `<div class="qk-muted small">No prototype orders in this slot yet (the booked number includes demo bookings).</div>`}
      ${orders.length && movable ? `<div class="qk-muted small" style="margin-top:6px">${ic("alert")} The customer is not told when you move their order — call or message them.</div>` : ""}
    </div>`;
  }
  window.adminSlotDayCard = (branch, d, editable) => {
    const slots = slotsFor(branch.id, d.date);
    const infos = slots.map((s) => ({ s, inf: slotInfo(branch.id, d.date, s) }));
    const offered = new Set(slots.map((s) => s.id));
    const retired = {};
    State.orders.forEach((o) => {
      if (o.status === "cancelled" || !o.slotKey) return;
      const [store, date, slotId] = String(o.slotKey).split("|");
      if (Number(store) === branch.id && date === d.date && !offered.has(slotId)) (retired[slotId] = retired[slotId] || []).push(o);
    });
    const retiredIds = Object.keys(retired);
    const totalBooked = infos.reduce((n, x) => n + x.inf.booked, 0) + retiredIds.reduce((n, id) => n + retired[id].length, 0);
    const totalCap = infos.filter((x) => !x.inf.closed).reduce((n, x) => n + x.inf.cap, 0);
    return `
  <div class="summary-card slot-day-card">
    <div class="summary-card-title">${esc(d.label)} <span class="qk-muted small" style="font-weight:600">${d.date} · ${totalBooked}/${totalCap} orders booked</span></div>
    <div class="slot-admin-rows">
      ${infos.map(({ s, inf }) => {
        const orders = ordersIn(inf.key);
        const open = UI.openSlotKey === inf.key;
        return `
        <div class="slot-admin-row">
          <div class="slot-admin-time"><b>${range(s)}</b>${s.extra ? ` <span class="badge badge-blue-soft">One-off</span>` : ""}</div>
          <div class="slot-admin-bar">
            <div class="fill-track"><div class="fill-bar fill-${inf.level}" style="width:${Math.max(inf.fill, 2)}%"></div></div>
            <span class="small"><b>${inf.booked}</b> / ${inf.cap} booked · ${pct(inf.fill)}</span>
          </div>
          <span class="badge slot-badge fill-${inf.level}">${SLOT_LEVEL_LABEL[inf.level]}</span>
          ${editable ? `
          <label class="slot-override" title="${s.extra ? "This one-off slot's capacity" : "Capacity for this slot on this day only"}">
            <input class="input" type="number" min="0" max="${MAX_CAPACITY}" placeholder="${s.capacity}" value="${s.extra ? s.capacity : inf.overridden ? inf.cap : ""}" data-action="set-slot-override" data-key="${inf.key}" />
            ${s.extra ? `<span class="qk-muted small">Capacity</span>` : inf.overridden ? `<button class="link-btn" data-action="clear-slot-override" data-key="${inf.key}">Reset</button>` : `<span class="qk-muted small">Override</span>`}
          </label>
          <button class="btn btn-sm ${inf.closed ? "btn-primary-soft" : "btn-outline"}" data-action="toggle-slot-closed" data-key="${inf.key}">${inf.closed ? "Reopen" : "Close"}</button>
          ${s.extra ? `<button class="icon-btn icon-btn-danger" data-action="remove-extra-slot" data-store="${branch.id}" data-date="${d.date}" data-id="${s.id}" aria-label="Delete one-off slot">${ic("trash")}</button>` : ""}` : ""}
          <button class="link-btn" data-action="toggle-slot-orders" data-key="${inf.key}">${open ? "Hide" : "Orders"} (${orders.length})</button>
        </div>
        ${open ? ordersListHTML(branch, inf.key, orders) : ""}`;
      }).join("")}
      ${retiredIds.map((slotId) => {
        const key = slotKey(branch.id, d.date, slotId);
        const w = retiredWindow(slotId);
        const open = UI.openSlotKey === key;
        return `
        <div class="slot-admin-row">
          <div class="slot-admin-time"><b>${w ? range(w) : "A removed slot"}</b> <span class="badge badge-yellow-soft">No longer offered</span></div>
          <div class="slot-admin-bar"><span class="small qk-muted">${retired[slotId].length} order${retired[slotId].length === 1 ? "" : "s"} still booked — move ${retired[slotId].length === 1 ? "it" : "them"} or deliver as booked</span></div>
          <button class="link-btn" data-action="toggle-slot-orders" data-key="${key}">${open ? "Hide" : "Orders"} (${retired[slotId].length})</button>
        </div>
        ${open ? ordersListHTML(branch, key, retired[slotId]) : ""}`;
      }).join("")}
    </div>
    ${editable ? `
    <form class="slot-extra-form" data-action="add-extra-slot" data-store="${branch.id}" data-date="${d.date}">
      <span class="small qk-muted">Add a one-off slot for ${esc(d.label.toLowerCase())}:</span>
      <input class="input" type="time" name="start" required /><input class="input" type="time" name="end" required />
      <input class="input" type="number" min="1" max="${MAX_CAPACITY}" name="capacity" placeholder="Orders" required />
      <button type="submit" class="btn btn-sm btn-primary-soft">${ic("plus")} Add</button>
    </form>` : ""}
  </div>`;
  };

  /* E. Another date, up to 60 days ahead — e.g. to close a slot on a holiday. */
  window.adminSlots = () => {
    const branchIds = scopedBranchIds();
    const editable = canEditSlots();
    if (!branchIds || branchIds.length !== 1) {
      return `${templatesCardHTML()}<div style="margin-top:16px">${storePickerHTML("Manage slots", "Bookings and capacity are per store. Pick a store to see how full each slot is and to override a day's capacity.")}</div>`;
    }
    const branch = findBranch(branchIds[0]);
    const days = slotDays();
    const max = isoDate(new Date(Date.now() + HORIZON_DAYS * DAY));
    const other = UI.slotOtherDate && !days.some((d) => d.date === UI.slotOtherDate) ? { date: UI.slotOtherDate, label: dateLabel(UI.slotOtherDate) } : null;
    return `
  <div class="admin-toolbar">
    <div class="qk-muted small">Bookings at <b>${esc(branch.name)}</b>. Customers see the colours, not the numbers; a full slot can't be picked.</div>
    ${exportButtonsHTML("slots")}
  </div>
  <div class="row" style="gap:8px;align-items:center;margin-bottom:10px">
    <span class="small qk-muted">Open another date:</span>
    <input class="input input-sm" type="date" min="${todayIso()}" max="${max}" value="${esc(UI.slotOtherDate || "")}" data-action="pick-slot-date" style="max-width:170px" />
    ${UI.slotOtherDate ? `<button class="link-btn" data-action="clear-slot-date">Close it</button>` : ""}
  </div>
  ${slotLegendHTML(true)}
  ${days.map((d) => adminSlotDayCard(branch, d, editable)).join("")}
  ${other ? adminSlotDayCard(branch, other, editable) : ""}
  <div style="margin-top:16px">${templatesCardHTML()}</div>`;
  };

  /* The handlers, each with the backend's checks and an audit entry. */
  const isExtraKey = (key) => {
    const [store, date, slotId] = key.split("|");
    return (State.slotSettings.extras[`${store}|${date}`] || []).some((e) => e.id === slotId);
  };
  const slotName = (key) => {
    const f = findSlotByKey(key);
    return f ? `${findBranch(f.storeId).name} · ${f.date} · ${range(f.slot)}` : key;
  };
  Object.assign(Actions, {
    "pick-slot-date"(el) {
      const v = el.value;
      const max = isoDate(new Date(Date.now() + HORIZON_DAYS * DAY));
      if (v && (v < todayIso() || v > max)) { showToast(`Pick a date from today to ${max}`, "danger"); return; }
      UI.slotOtherDate = v || null; render();
    },
    "clear-slot-date"() { UI.slotOtherDate = null; render(); },
    "set-slot-override"(el) {
      const key = el.dataset.key;
      const [store, date, slotId] = key.split("|");
      const raw = el.value.trim();
      const cap = Math.floor(Number(raw));
      if (raw !== "" && (!Number.isFinite(cap) || cap < 0 || cap > MAX_CAPACITY)) { showToast(`Capacity must be 0–${MAX_CAPACITY}`, "danger"); render(); return; }
      if (isExtraKey(key)) {
        if (raw === "") { render(); return; } // a one-off slot always has its own capacity
        const k = `${store}|${date}`;
        const was = (State.slotSettings.extras[k] || []).find((e) => e.id === slotId).capacity;
        if (was === cap) return;
        saveSlotSettings({ extras: { ...State.slotSettings.extras, [k]: State.slotSettings.extras[k].map((e) => (e.id === slotId ? { ...e, capacity: cap } : e)) } });
        audit("delivery_slot.capacity_changed", key, { slot: slotName(key), capacity: was }, { slot: slotName(key), capacity: cap });
        showToast("One-off slot capacity updated"); render(); return;
      }
      const overrides = { ...State.slotSettings.overrides };
      const was = overrides[key] ?? null;
      if (raw === "") delete overrides[key]; else overrides[key] = cap;
      if ((overrides[key] ?? null) === was) return;
      saveSlotSettings({ overrides });
      audit(raw === "" ? "delivery_slot.capacity_reset" : "delivery_slot.capacity_changed", key, { slot: slotName(key), capacity: was }, { slot: slotName(key), capacity: raw === "" ? null : cap });
      showToast("Capacity for this slot on this day updated"); render();
    },
    "clear-slot-override"(el) {
      const key = el.dataset.key;
      const overrides = { ...State.slotSettings.overrides };
      if (!(key in overrides)) return;
      const was = overrides[key];
      delete overrides[key]; saveSlotSettings({ overrides });
      audit("delivery_slot.capacity_reset", key, { slot: slotName(key), capacity: was }, { slot: slotName(key), capacity: null });
      render();
    },
    "toggle-slot-closed"(el) {
      const key = el.dataset.key;
      const closed = { ...State.slotSettings.closed };
      const closing = !closed[key];
      if (closing) closed[key] = true; else delete closed[key];
      saveSlotSettings({ closed });
      audit(closing ? "delivery_slot.closed" : "delivery_slot.reopened", key, { slot: slotName(key), closed: !closing }, { slot: slotName(key), closed: closing });
      showToast(closing ? "Slot closed for this day — booked orders keep it" : "Slot reopened"); render();
    },
    "remove-extra-slot"(el) {
      const k = `${el.dataset.store}|${el.dataset.date}`;
      const key = `${k}|${el.dataset.id}`;
      const info = findSlotByKey(key);
      const booked = info ? slotInfo(info.storeId, info.date, info.slot).booked : 0;
      if (booked > 0) { showToast(`${booked} order${booked === 1 ? " is" : "s are"} booked in this slot — move ${booked === 1 ? "it" : "them"} to another slot first`, "danger"); return; }
      const name = slotName(key);
      saveSlotSettings({ extras: { ...State.slotSettings.extras, [k]: (State.slotSettings.extras[k] || []).filter((s) => s.id !== el.dataset.id) } });
      audit("delivery_slot.one_off_removed", key, { slot: name }, null);
      showToast("One-off slot deleted"); render();
    },
    "move-slot-order"(el) {
      const to = el.value; if (!to) return;
      const o = State.orders.find((x) => x.id === el.dataset.id); if (!o) return;
      const target = findSlotByKey(to);
      if (!target) return;
      const inf = slotInfo(target.storeId, target.date, target.slot);
      const problem = inf.closed ? "That slot is closed for the day — reopen it first"
        : started(target.date, target.slot) ? "That slot has already started"
        : inf.booked >= inf.cap ? `That slot is full — ${inf.booked} of ${inf.cap} booked` : null;
      if (problem) { showToast(problem, "danger"); render(); return; }
      const fromName = o.slotKey ? (findSlotByKey(o.slotKey) ? slotLabelFromKey(o.slotKey) : (() => { const w = retiredWindow(String(o.slotKey).split("|")[2]); return w ? range(w) : "a removed slot"; })()) : "";
      const from = o.slotKey;
      State.slotBookings = { ...State.slotBookings, [from]: Math.max((State.slotBookings[from] || 0) - 1, 0), [to]: (State.slotBookings[to] || 0) + 1 };
      State.orders = State.orders.map((x) => (x.id === o.id ? { ...x, slotKey: to, scheduledSlot: slotLabelFromKey(to) } : x));
      persist("slotBookings"); persist("orders");
      audit("order.slot_moved", o.id, { slot: fromName }, { slot: slotLabelFromKey(to) }, { entity: `#${o.id}` });
      showToast(`#${o.id} moved to ${slotLabelFromKey(to)} — the customer is not told, let them know`); render();
    },
  });

  Object.assign(Submits, {
    "save-slot-templates"(form) {
      if (!canEditTimes()) return;
      const fd = new FormData(form);
      const was = State.slotSettings.templates;
      const rows = was.map((t, i) => ({ ...t, start: String(fd.get(`start_${i}`) || ""), end: String(fd.get(`end_${i}`) || ""), capacity: Number(fd.get(`cap_${i}`)) }));
      const daysAhead = Number(fd.get("daysAhead"));
      const cutoffMins = Number(fd.get("cutoffMins"));
      const reminderMins = Number(fd.get("reminderMins"));
      const seen = new Set();
      let problem = null;
      for (const r of rows) {
        if (!r.start || !r.end || !endsAfterStart(r.start, r.end)) { problem = 'Each slot must end after it starts ("00:00" = midnight)'; break; }
        if (!Number.isInteger(r.capacity) || r.capacity < 1 || r.capacity > MAX_CAPACITY) { problem = `Orders per slot must be 1–${MAX_CAPACITY}`; break; }
        const w = `${r.start}-${r.end}`;
        if (seen.has(w)) { problem = `${range(r)} is listed twice`; break; }
        seen.add(w);
      }
      if (!problem && !(Number.isInteger(daysAhead) && daysAhead >= 1 && daysAhead <= 14)) problem = "Days ahead must be 1–14";
      if (!problem && !(Number.isInteger(cutoffMins) && cutoffMins >= 0 && cutoffMins <= 10080)) problem = "The cut-off must be 0–10080 minutes";
      if (!problem && !(Number.isInteger(reminderMins) && reminderMins >= 0 && reminderMins <= 480)) problem = "The reminder must be 0–480 minutes (0 = no reminder)";
      if (problem) { showToast(problem, "danger"); return; }
      // A slot time whose hours change is a new window: it gets a new id, and orders booked in the old one stay there.
      const retiredWindows = { ...(State.slotSettings.retiredWindows || {}) };
      const wasById = new Map(was.map((t) => [t.id, t]));
      const templates = rows.map((r) => {
        const old = wasById.get(r.id);
        if (old && (old.start !== r.start || old.end !== r.end)) {
          retiredWindows[old.id] = { start: old.start, end: old.end };
          const id = `s${Date.now()}${Math.floor(Math.random() * 1000)}`;
          audit("slot_template.updated", id, { slot: range(old), capacity: old.capacity }, { slot: range(r), capacity: r.capacity });
          return { ...r, id };
        }
        if (old && old.capacity !== r.capacity) audit("slot_template.updated", r.id, { slot: range(old), capacity: old.capacity }, { slot: range(r), capacity: r.capacity });
        if (!old) audit("slot_template.created", r.id, null, { slot: range(r), capacity: r.capacity });
        return r;
      });
      saveSlotSettings({ templates, retiredWindows, daysAhead, cutoffMins, reminderMins });
      showToast("Slot times saved"); render();
    },
    "add-extra-slot"(form) {
      const fd = new FormData(form);
      const start = String(fd.get("start") || ""), end = String(fd.get("end") || ""), capacity = Number(fd.get("capacity"));
      if (!start || !end || !endsAfterStart(start, end)) { showToast('The slot must end after it starts ("00:00" = midnight)', "danger"); return; }
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) { showToast(`Orders per slot must be 1–${MAX_CAPACITY}`, "danger"); return; }
      const storeId = Number(form.dataset.store), date = form.dataset.date;
      if (slotsFor(storeId, date).some((s) => s.start === start && s.end === end)) { showToast(`${range({ start, end })} is already a slot that day`, "danger"); return; }
      const k = `${storeId}|${date}`;
      const id = `x${Date.now()}`;
      saveSlotSettings({ extras: { ...State.slotSettings.extras, [k]: [...(State.slotSettings.extras[k] || []), { id, start, end, capacity }] } });
      audit("delivery_slot.one_off_added", `${k}|${id}`, null, { slot: slotName(`${k}|${id}`), capacity });
      showToast("One-off slot added"); render();
    },
  });
  // Adding and removing a row save at once in the prototype: audited then. A removed slot time keeps its hours on
  // record, so orders still booked in it are listed by them.
  const baseAdd = Actions["add-slot-template"];
  Actions["add-slot-template"] = (el) => {
    if (!canEditTimes()) return;
    const result = baseAdd(el);
    const t = State.slotSettings.templates[State.slotSettings.templates.length - 1];
    if (t) audit("slot_template.created", t.id, null, { slot: range(t), capacity: t.capacity });
    return result;
  };
  const baseRemove = Actions["remove-slot-template"];
  Actions["remove-slot-template"] = (el) => {
    if (!canEditTimes()) return;
    const t = State.slotSettings.templates[Number(el.dataset.idx)];
    const before = State.slotSettings.templates.length;
    const result = baseRemove(el);
    if (t && State.slotSettings.templates.length < before) {
      saveSlotSettings({ retiredWindows: { ...(State.slotSettings.retiredWindows || {}), [t.id]: { start: t.start, end: t.end } } });
      audit("slot_template.deleted", t.id, { slot: range(t), capacity: t.capacity }, null);
    }
    return result;
  };
  // One-off slots start empty: the demo bookings that colour the slot times never fill them.
  const baseDemo = window.demoBooked;
  window.demoBooked = (key, defaultCap) => (isExtraKey(key) ? 0 : baseDemo(key, defaultCap));

  /* G. The audit log names them. */
  Object.assign(AUDIT_ACTION_TEXT, {
    "slot_template.created": ["Slot times", "added a slot time"],
    "slot_template.updated": ["Slot times", "changed a slot time"],
    "slot_template.deleted": ["Slot times", "removed a slot time"],
    "delivery_slot.capacity_changed": ["Delivery slots", "changed a day's capacity"],
    "delivery_slot.capacity_reset": ["Delivery slots", "reset a day's capacity"],
    "delivery_slot.closed": ["Delivery slots", "closed a slot for a day"],
    "delivery_slot.reopened": ["Delivery slots", "reopened a slot"],
    "delivery_slot.one_off_added": ["Delivery slots", "added a one-off slot"],
    "delivery_slot.one_off_removed": ["Delivery slots", "deleted a one-off slot"],
    "order.slot_moved": ["Orders", "moved an order to another slot"],
  });
  Object.assign(AUDIT_ENTITY_LABEL, { slot_template: "Slot times", delivery_slot: "Delivery slots", order: "Orders" });
  Object.assign(AUDIT_FIELD_LABEL, { slot: "Slot", capacity: "Capacity", closed: "Closed" });
})();

/* ---------------- Later the same day: Notification providers as P9-8a built it (D65, D83) ---------------- */
/* In the real admin app (quickkart-api-service docs/08 §40): GET /admin/notifications/providers; PUT and PATCH
   /admin/notifications/providers/:channel; POST …/:channel/test — the Super Admin only. There is no QuickKart shared
   provider (D83): each business sets up its own email, SMS and Firebase; a channel without one sends nothing, and
   without SMS customers can't log in. */
(function round11NotificationProviders() {
  const TEST_LIMIT = 5;
  const TEST_WINDOW_MS = 10 * 60 * 1000;
  const label = (ch) => (ch === "sms" ? "SMS" : ch === "push" ? "Push" : "Email");
  const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
  const maskEmail = (e) => (e && e.includes("@") ? `${e[0]}***${e.slice(e.lastIndexOf("@"))}` : "");
  const audit = (action, entityId, before, after) => {
    const u = currentUser();
    if (u) addAuditEvent({ action, entity: action.split(".")[0], entityId, actorType: "user", actorId: u.id, before, after });
  };

  /* A. No shared provider: every card is the business's own account (the old "Use QuickKart's shared provider"
     choice is gone). */
  (() => {
    const cfg = State.notificationConfig || {};
    const next = { ...cfg };
    let changed = false;
    ["email", "sms", "push"].forEach((ch) => {
      if (next[ch] && next[ch].mode !== "own") { next[ch] = { ...next[ch], mode: "own" }; changed = true; }
    });
    if (changed) { State.notificationConfig = next; persist("notificationConfig"); }
  })();

  // A provider is saved when its required boxes are (the backend says "configured").
  const configured = (ch, c) => {
    if (ch === "push") return filled(c.projectId) && !!c.serviceAccountSet;
    if (ch === "sms") return filled(c.accountId) && !!c.tokenSet && filled(c.senderId);
    switch (c.provider) {
      case "SendGrid": return !!c.apiKeySet && filled(c.fromEmail);
      case "Mailgun": return filled(c.domain) && !!c.apiKeySet && filled(c.fromEmail);
      case "Amazon SES": return filled(c.accountId) && !!c.secretAccessKeySet && filled(c.fromEmail);
      case "Postmark": return !!c.serverTokenSet && filled(c.fromEmail);
      default: return filled(c.host) && filled(c.username) && !!c.passwordSet && filled(c.fromEmail);
    }
  };
  const NOT_SET_UP = {
    email: "Not set up yet — nothing is sent by email (order emails, password-reset links) until you add your provider.",
    sms: "Not set up yet — <b>customers can't log in</b> until you add an SMS provider: login codes go only by SMS.",
    push: "Not set up yet — push needs your own Firebase project and your own branded app build.",
  };
  const OFF = {
    email: "Off — nothing is sent by email, whatever the templates say.",
    sms: "Off — no SMS messages are sent, whatever the templates say. <b>Login codes still go</b> while a provider is set up — customers must always be able to log in.",
    push: "Off — no push notifications are sent, whatever the templates say.",
  };

  /* B. The card: the business's own fields always; "Set up" / "Not set up" next to the title. */
  window.notifChannelCard = function (ch, title, icon, editable, ownFields) {
    const c = State.notificationConfig[ch];
    const dis = editable ? "" : "disabled";
    const ready = configured(ch, c);
    return `
  <div class="summary-card notif-card ${c.enabled ? "" : "is-off"}">
    <div class="notif-card-head">
      <div class="summary-card-title" style="margin:0">${ic(icon)} ${title} <span class="badge ${ready ? "badge-green-soft" : "badge-yellow-soft"}">${ready ? "Set up" : "Not set up"}</span></div>
      <label class="stock-toggle"><input type="checkbox" ${c.enabled ? "checked" : ""} data-action="toggle-notif-channel" data-ch="${ch}" ${dis} /><span>${c.enabled ? "On" : "Off"}</span></label>
    </div>
    ${c.enabled ? `
    ${ready ? "" : `<div class="notice notice-warn" style="margin:8px 0">${ic("alert")}<span>${NOT_SET_UP[ch]}</span></div>`}
    <form data-action="save-notif-channel" data-ch="${ch}">
      ${ownFields(c, dis)}
      ${editable ? `<div class="form-actions"><button type="button" class="btn btn-outline" data-action="test-notif-channel" data-ch="${ch}">Send test</button><button type="submit" class="btn btn-primary">Save ${title.toLowerCase()}</button></div>` : ""}
    </form>` : `<div class="qk-muted small">${OFF[ch]}</div>`}
  </div>`;
  };

  /* C. The providers are the Super Admin's only — they decide where login codes and password-reset emails go. Anyone
     else with Notifications sees the message templates only. */
  window.adminNotifications = function () {
    const me = currentUser();
    const owner = isSuperAdmin(me);
    const tab = owner ? UI.notifTab || "channels" : "templates";
    const editable = canEdit(me, "notifications");
    return `
  <div class="pill-row">
    ${owner ? `<button class="pill ${tab === "channels" ? "active" : ""}" data-action="notif-tab" data-tab="channels">Channels &amp; providers</button>` : ""}
    <button class="pill ${tab === "templates" ? "active" : ""}" data-action="notif-tab" data-tab="templates">Message templates</button>
  </div>
  ${tab === "channels" ? `<div class="notice notice-ok" style="margin-bottom:14px">${ic("bell")}<span>Your business's <b>own</b> accounts — there is no QuickKart shared provider. One setting for all ${State.branches.length} stores. Passwords and keys are stored encrypted and are <b>never shown again</b> after saving. Only the Super Admin sees this tab, and every change emails every Super Admin.</span></div>` : ""}
  ${tab === "templates" ? notifTemplatesHTML(editable) : notifChannelsHTML(owner)}`;
  };

  /* D. Saves and the on / off switch: audited; every Super Admin is told by email. */
  const save = Actions["save-notif-channel"];
  Actions["save-notif-channel"] = (form) => {
    const ch = form.dataset.ch;
    const before = JSON.stringify(State.notificationConfig[ch]);
    save(form);
    const now = State.notificationConfig[ch];
    if (JSON.stringify(now) === before) return; // refused (missing boxes) or nothing changed
    audit("notification_provider.updated", ch, null, { channel: ch, provider: now.provider || "Firebase" });
    showToast(`${label(ch)} settings saved — every Super Admin gets an email about the change`);
  };
  // A real form submit goes through Submits — Round 7 registered its handler under Actions only, so the browser kept
  // using the Round 1 save (no provider, no "saved" flags). Both names now run the same handler.
  Submits["save-notif-channel"] = Actions["save-notif-channel"];
  const toggle = Actions["toggle-notif-channel"];
  Actions["toggle-notif-channel"] = (el) => {
    const ch = el.dataset.ch;
    const was = !!State.notificationConfig[ch].enabled;
    toggle(el);
    if (was === !!State.notificationConfig[ch].enabled) return;
    audit("notification_provider.updated", ch, { channel: ch, enabled: was }, { channel: ch, enabled: !was });
    showToast(`${label(ch)} switched ${was ? "off" : "on"} — every Super Admin gets an email about it`);
  };

  /* E. Send test: with the saved settings, to you only; 5 per 10 minutes; a plain pass / fail. */
  Actions["test-notif-channel"] = (el) => {
    const ch = el.dataset.ch;
    const c = State.notificationConfig[ch];
    const me = currentUser() || {};
    if (!configured(ch, c)) { showToast("Save a provider for this channel first, then send a test", "danger"); return; }
    if (ch === "sms" && !filled(me.mobile)) { showToast("The test SMS goes only to you — add your mobile number to your own profile first", "danger"); return; }
    const recent = (UI.notifTests || []).filter((t) => Date.now() - t < TEST_WINDOW_MS);
    if (recent.length >= TEST_LIMIT) { showToast("Too many tests — wait a few minutes and try again", "danger"); return; }
    UI.notifTests = [...recent, Date.now()];
    audit("notification_provider.tested", ch, null, { channel: ch, provider: c.provider || "Firebase", ok: true });
    const msg = ch === "push"
      ? "Firebase accepted the settings (a dry run — nothing was delivered)"
      : `Test ${ch === "sms" ? "SMS" : "email"} sent to ${ch === "sms" ? `****${String(me.mobile).slice(-4)}` : maskEmail(me.email)}`;
    showToast(`${msg} (prototype — nothing is really sent)`);
  };

  /* F. The audit log names them. */
  Object.assign(AUDIT_ACTION_TEXT, {
    "notification_provider.updated": ["Notifications", "changed a notification provider"],
    "notification_provider.tested": ["Notifications", "sent a notification test"],
  });
  Object.assign(AUDIT_ENTITY_LABEL, { notification_provider: "Notifications" });
})();

/* ---------------- Later the same day: Message templates as P9-8b built it (D51 b, D84) ---------------- */
/* In the real admin app (quickkart-api-service docs/08 §41): GET /admin/notifications/templates; PUT and DELETE
   /admin/notifications/templates/:key/:channel; POST …/:key/:channel/preview. A message has its own channels — fixed
   by the backend — and a separate text for each; the shop rewords a channel, switches it off (never the login code or
   the admin links) or resets it. Placeholders are the message's own. */
(function round11MessageTemplates() {
  const DEFS = {"messages":[{"key":"auth.otp","name":"Login code","audience":"customer","about":"A customer logs in, changes their mobile or deletes their account.","alwaysOn":true,"placeholders":["code","minutes","shopName"],"startsWith":"{{code}}","channels":{"sms":{"body":"{{code}} is your verification code. It expires in {{minutes}} minutes. Never share this code."}}},{"key":"order.placed","name":"Order placed","audience":"customer","about":"The shop takes an order — at checkout for cash and wallet orders, when the payment succeeds for online ones.","placeholders":["orderNo","total","items","fulfilmentNote","paymentNote","shopName","customerName"],"channels":{"email":{"subject":"We've got your order {{orderNo}}","body":"Hi {{customerName}},\n\nThank you for your order {{orderNo}} from {{shopName}} — {{items}}, {{total}}.\n\n{{fulfilmentNote}}\n{{paymentNote}}\n\nYou can follow your order in the {{shopName}} app."}}},{"key":"order.confirmed","name":"Order confirmed","audience":"customer","about":"The shop confirms an order (at once when confirmation is automatic).","placeholders":["orderNo","total","shopName","customerName"],"channels":{"push":{"subject":"Order confirmed","body":"{{shopName}} has confirmed your order {{orderNo}} ({{total}})."}}},{"key":"order.slot_reminder","name":"Delivery slot reminder","audience":"customer","about":"Before a delivery slot starts — as many minutes before as Business Settings ▸ Slot reminder says.","placeholders":["orderNo","slot","shopName","customerName"],"channels":{"push":{"subject":"Your delivery is coming up","body":"Your order {{orderNo}} from {{shopName}} arrives today between {{slot}}."}}},{"key":"order.out_for_delivery","name":"Out for delivery","audience":"customer","about":"The rider leaves the store with a delivery order.","placeholders":["orderNo","shopName","customerName"],"channels":{"push":{"subject":"On its way","body":"Your order {{orderNo}} is on its way to you."}}},{"key":"order.cash_reminder","name":"Cash reminder","audience":"customer","about":"A cash-on-delivery order leaves the store with the rider.","sentFrom":"cash on delivery (P10-2b / P11-3)","placeholders":["orderNo","cashToCollect","shopName","customerName"],"channels":{"push":{"subject":"Please keep {{cashToCollect}} ready","body":"Your order {{orderNo}} is on its way. Please keep {{cashToCollect}} in cash ready for the rider."}}},{"key":"order.ready_for_pickup","name":"Ready to collect","audience":"customer","about":"A pickup order is packed and waiting at the counter.","placeholders":["orderNo","storeName","shopName","customerName"],"channels":{"push":{"subject":"Ready to collect","body":"Your order {{orderNo}} is ready to collect at {{storeName}}."}}},{"key":"order.delivered","name":"Delivered","audience":"customer","about":"A delivery order is handed over.","placeholders":["orderNo","shopName","customerName"],"channels":{"push":{"subject":"Delivered","body":"Your order {{orderNo}} has been delivered. Thank you for shopping with {{shopName}}!"}}},{"key":"order.collected","name":"Collected","audience":"customer","about":"A pickup order is collected.","placeholders":["orderNo","shopName","customerName"],"channels":{"push":{"subject":"Collected","body":"You have collected order {{orderNo}}. Thank you for shopping with {{shopName}}!"}}},{"key":"order.cancelled","name":"Order cancelled","audience":"customer","about":"An order is cancelled — by the customer, the shop, or because it was not paid in time.","placeholders":["orderNo","reason","refundNote","shopName","customerName"],"channels":{"push":{"subject":"Order cancelled","body":"Your order {{orderNo}} was cancelled: {{reason}}.{{refundNote}}"}}},{"key":"order.item_unavailable","name":"Item unavailable","audience":"customer","about":"The store does not have an item and offers a substitute, wallet credit or a refund.","placeholders":["orderNo","itemName","shopName","customerName"],"channels":{"push":{"subject":"An item is unavailable","body":"{{itemName}} on your order {{orderNo}} is unavailable. Tap to choose a substitute or a refund."}}},{"key":"order.substitution_auto","name":"We chose for you","audience":"customer","about":"The customer did not answer an unavailable-item offer in time, so the shop's rule was applied.","placeholders":["orderNo","itemName","decision","shopName","customerName"],"channels":{"push":{"subject":"We chose for you","body":"No answer in time for {{itemName}} on your order {{orderNo}}, so we chose for you: {{decision}}."}}},{"key":"product.back_in_stock","name":"Back in stock","audience":"customer","about":"A product a customer asked about can be bought again.","placeholders":["productName","shopName","customerName"],"channels":{"push":{"subject":"Back in stock","body":"{{productName}} is back in stock at {{shopName}}. Order it before it runs out!"}}},{"key":"customer.message","name":"Message from the store","audience":"customer","about":"A staff member writes to one customer from the Customers screen.","sentFrom":"the Customers screen (P10-5)","placeholders":["message","shopName","customerName"],"channels":{"email":{"subject":"A message from {{shopName}}","body":"Hi {{customerName}},\n\n{{message}}"},"sms":{"body":"{{shopName}}: {{message}}"},"push":{"subject":"A message from {{shopName}}","body":"{{message}}"}}},{"key":"auth.password_reset","name":"Admin password reset","audience":"staff","about":"A staff member asks to reset their admin password (\"Forgot password\").","alwaysOn":true,"placeholders":["resetLink","minutes","shopName"],"mustContain":"{{resetLink}}","channels":{"email":{"subject":"Reset your {{shopName}} admin password","body":"Someone asked to reset the password of your {{shopName}} admin account.\n\nTo choose a new password, open this link within {{minutes}} minutes. It works once:\n{{resetLink}}\n\nIf it wasn't you, ignore this email — your password stays as it is."}}},{"key":"auth.user_invite","name":"Admin invite","audience":"staff","about":"The Super Admin adds a staff member without typing a password for them.","alwaysOn":true,"placeholders":["inviteLink","hours","shopName"],"mustContain":"{{inviteLink}}","channels":{"email":{"subject":"Your {{shopName}} admin account","body":"You have been given an admin account for {{shopName}}.\n\nTo choose your password, open this link within {{hours}} hours. It works once:\n{{inviteLink}}\n\nThen log in with this email address and your new password. If you did not expect this email, you can ignore it."}}},{"key":"stock.low","name":"Low stock","audience":"staff","about":"A store's count of a product falls to its reorder level — to the staff who manage that store's stock.","placeholders":["productName","sku","storeName","quantity","reorderLevel","shopName","customerName"],"channels":{"email":{"subject":"Low stock at {{storeName}}: {{productName}}","body":"{{productName}} ({{sku}}) is down to {{quantity}} at {{storeName}} — at or below its reorder level of {{reorderLevel}}.\n\nReceive stock on the Stock screen of the admin app. You will hear about this product at {{storeName}} again only after it is back above {{reorderLevel}}."}}},{"key":"rider.assigned","name":"Order assigned to you","audience":"rider","about":"A rider is given an order.","sentFrom":"rider assignment (P10-3 / P11)","placeholders":["orderNo","slot","stops","shopName","customerName"],"channels":{"push":{"subject":"New delivery","body":"Order {{orderNo}} · {{slot}} · {{stops}} stop(s) on your trip. Open the app to see the details."}}}],"info":{"shopName":["Your shop’s name (the trading name)","Kent Mart"],"customerName":["The person’s name (\"there\" when unknown)","Priya"],"code":["The 6-digit login code — must start the SMS","482913"],"minutes":["How many minutes it works","10"],"hours":["How many hours the link works","72"],"resetLink":["The reset link — must stay in","https://admin.kentmart.sg/reset-password?token=…"],"inviteLink":["The link to choose a password — must stay in","https://admin.kentmart.sg/set-password?token=…"],"orderNo":["The order number","QK-0512"],"total":["The amount of the order","S$42.50"],"items":["How many items (\"3 items\")","3 items"],"fulfilmentNote":["Delivery or pickup, as one sentence","Delivery on Mon 6 Oct, 6:00 PM – 7:00 PM."],"paymentNote":["How it is paid, as one sentence","Pay S$42.50 in cash when it arrives."],"slot":["The delivery slot","6:00 PM – 7:00 PM"],"cashToCollect":["The cash to keep ready","S$42.50"],"storeName":["The store","Clementi"],"reason":["Why it was cancelled","the store closed early today"],"refundNote":["Where the money goes — empty when nothing was paid"," Your payment will be refunded to the way you paid."],"itemName":["The item","Fresh Milk 1L"],"decision":["What the shop chose","a wallet credit of S$6.38"],"productName":["The product","Fresh Milk 1L"],"message":["What the staff member wrote","Your order will be about 15 minutes late — sorry!"],"sku":["The product’s SKU","QK-0101"],"quantity":["How many are left","4"],"reorderLevel":["The reorder level","10"],"stops":["Stops on the rider’s trip","3"]}};
  const MESSAGES = DEFS.messages;
  const INFO = DEFS.info;
  const LIMITS = { email: { subject: 150, body: 5000 }, sms: { subject: null, body: 480 }, push: { subject: 65, body: 240 } };
  const CHANNELS = ["email", "sms", "push"];
  const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
  const label = (ch) => (ch === "sms" ? "SMS" : ch === "push" ? "Push" : "Email");
  const AUDIENCE = { customer: "Customer", staff: "Staff", rider: "Rider" };
  const byKey = (key) => MESSAGES.find((m) => m.key === key);
  const chans = (def) => CHANNELS.filter((ch) => def.channels[ch]);
  const shopName = () => (State.companyProfile && State.companyProfile.tradingAs) || "QuickKart";
  const audit = (action, entityId, before, after) => {
    const u = currentUser();
    if (u) addAuditEvent({ action, entity: action.split(".")[0], entityId, actorType: "user", actorId: u.id, before, after });
  };

  // The shop's own wording: { key: { channel: { subject, body, enabled } } } — a part equal to the default is not kept.
  State.messageTemplates = loadLS("messageTemplates", {});
  if (Array.isArray(PERSIST_KEYS) && !PERSIST_KEYS.includes("messageTemplates")) PERSIST_KEYS.push("messageTemplates");
  const saved = (key, ch) => ((State.messageTemplates[key] || {})[ch]) || null;
  const effective = (def, ch) => {
    const own = saved(def.key, ch);
    const fallback = def.channels[ch];
    return {
      subject: LIMITS[ch].subject === null ? "" : ((own && own.subject) || fallback.subject || ""),
      body: (own && own.body) || fallback.body,
      enabled: def.alwaysOn ? true : !own || own.enabled !== false,
      customised: !!own && !!(own.subject || own.body),
    };
  };

  // The backend's checks (D84 b), so the prototype refuses what the API refuses.
  function problems(def, ch, d) {
    const errs = [];
    const lim = LIMITS[ch];
    const check = (field, v) => {
      const stripped = v.replace(PLACEHOLDER, "");
      if (stripped.includes("{{") || stripped.includes("}}")) errs.push(`${field}: write placeholders as {{name}}`);
      const unknown = [...new Set([...v.matchAll(PLACEHOLDER)].map((m) => m[1]))].filter((p) => !def.placeholders.includes(p));
      if (unknown.length) errs.push(`${field}: this message has no ${unknown.map((p) => `{{${p}}}`).join(", ")}`);
    };
    if (lim.subject !== null) {
      const s = d.subject.trim();
      if (!s) errs.push(`${ch === "email" ? "Subject" : "Title"}: required`);
      else if (s.length > lim.subject) errs.push(`${ch === "email" ? "Subject" : "Title"}: at most ${lim.subject} characters`);
      if (/[\r\n]/.test(s)) errs.push(`${ch === "email" ? "Subject" : "Title"}: one line only`);
      check(ch === "email" ? "Subject" : "Title", s);
    }
    const b = d.body.trim();
    if (!b) errs.push("Message: required");
    else if (b.length > lim.body) errs.push(`Message: at most ${lim.body} characters`);
    check("Message", b);
    if (def.startsWith && !b.startsWith(def.startsWith)) errs.push(`Message: must start with ${def.startsWith} — phones fill the code in from the start of the SMS`);
    if (def.mustContain && !b.includes(def.mustContain)) errs.push(`Message: must contain ${def.mustContain} — without the link the email is useless`);
    return errs;
  }
  const fill = (def, text) =>
    String(text || "").replace(PLACEHOLDER, (m, k) => (k === "shopName" ? shopName() : INFO[k] ? INFO[k][1] : m));
  const previewHTML = (def, ch, d) =>
    `${LIMITS[ch].subject === null ? "" : `<div style="font-weight:700">${esc(fill(def, d.subject))}</div>`}<div style="white-space:pre-wrap">${esc(fill(def, d.body))}</div>`;
  const errorsHTML = (errs) => (errs.length ? `<div class="field-error">${errs.map(esc).join("<br>")}</div>` : "");

  /* A. The list: each message with its own channels — on, off, or reworded (✎). */
  window.notifTemplatesHTML = function (editable) {
    const cfg = State.notificationConfig;
    return `
  <div class="qk-muted small" style="margin-bottom:10px">Each message has its own channels, each with its own words. <code>{{placeholders}}</code> are filled in when the message is sent.</div>
  <div class="admin-table">
    ${MESSAGES.map((def) => `
      <div class="admin-row">
        <div class="admin-row-info">
          <div class="admin-row-name">${esc(def.name)} <span class="badge badge-gray-soft">${AUDIENCE[def.audience]}</span>${def.sentFrom ? ` <span class="badge badge-yellow-soft" title="Sent once ${esc(def.sentFrom)} is built">Not sent yet</span>` : ""}</div>
          <div class="qk-muted small">${esc(def.about)}</div>
        </div>
        ${chans(def).map((ch) => {
          const e = effective(def, ch);
          const on = e.enabled && (!cfg[ch] || cfg[ch].enabled);
          return `<span class="badge badge-${on ? "green" : "gray"}-soft" title="${cfg[ch] && !cfg[ch].enabled ? "Channel is off" : ""}">${label(ch)}${e.enabled ? "" : " — off"}${e.customised ? " ✎" : ""}</span>`;
        }).join("")}
        ${editable ? `<button class="icon-btn" data-action="edit-template" data-key="${def.key}" aria-label="Edit">${ic("edit")}</button>` : ""}
      </div>`).join("")}
  </div>`;
  };

  /* B. The dialog: a tab per channel — its own subject (email / push), text, on / off, preview and Reset. */
  window.templateFormModal = function () {
    const m = UI.modal;
    const def = byKey(m.key);
    if (!def) return "";
    const ch = m.channel;
    const d = m.drafts[ch];
    const lim = LIMITS[ch];
    return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static dialog-user" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>${esc(def.name)}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <form class="dialog-body" data-action="save-template">
        <div class="qk-muted small" style="margin-bottom:8px">${esc(def.about)}${def.sentFrom ? ` <b>Not sent yet</b> — it comes with ${esc(def.sentFrom)}.` : ""}</div>
        <div class="pill-row" style="margin-bottom:10px">${chans(def).map((c) => `<button type="button" class="pill ${c === ch ? "active" : ""}" data-action="tpl-channel" data-ch="${c}">${label(c)}${m.drafts[c].enabled ? "" : " (off)"}</button>`).join("")}</div>
        ${def.alwaysOn
          ? `<div class="qk-muted small" style="margin-bottom:8px">Always on — ${def.key === "auth.otp" ? "customers log in with this code" : "staff need this link to get into their account"}.</div>`
          : `<label class="stock-toggle" style="margin-bottom:8px"><input type="checkbox" ${d.enabled ? "checked" : ""} data-action="tpl-enabled" /><span>${d.enabled ? "On" : "Off"} — sent by ${label(ch)}</span></label>`}
        ${lim.subject === null ? "" : `<label class="field"><span class="field-label">${ch === "email" ? "Email subject" : "Push title"} <span class="qk-muted small" id="tplSubjectCount">${d.subject.length}/${lim.subject}</span></span><input class="input" name="subject" value="${esc(d.subject)}" oninput="onTemplateDraft(this)" /></label>`}
        <label class="field"><span class="field-label">Message <span class="qk-muted small" id="tplBodyCount">${d.body.length}/${lim.body}</span></span><textarea class="input" name="body" rows="${ch === "email" ? 7 : 4}" oninput="onTemplateDraft(this)">${esc(d.body)}</textarea></label>
        <div class="qk-muted small">Placeholders: ${def.placeholders.map((p) => `<code title="${esc(INFO[p] ? `${INFO[p][0]} — e.g. ${p === "shopName" ? shopName() : INFO[p][1]}` : p)}">{{${p}}}</code>`).join(" ")}</div>
        <div class="template-preview"><div class="qk-muted small" style="font-weight:700">Preview</div><div id="templatePreview">${previewHTML(def, ch, d)}</div></div>
        <div id="templateErrors">${errorsHTML(problems(def, ch, d))}</div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" data-action="reset-template">Reset ${label(ch).toLowerCase()} to default</button>
          <button type="submit" class="btn btn-primary">Save ${label(ch).toLowerCase()}</button>
        </div>
      </form>
    </div>
  </div>`;
  };
  // Typing: the preview, the counters and the problems follow without re-rendering (the cursor stays).
  window.onTemplateDraft = function (el) {
    const m = UI.modal;
    if (!m || m.type !== "templateForm") return;
    const def = byKey(m.key);
    const d = m.drafts[m.channel];
    d[el.name] = el.value;
    const lim = LIMITS[m.channel];
    const set = (id, html) => { const n = document.getElementById(id); if (n) n.innerHTML = html; };
    set("templatePreview", previewHTML(def, m.channel, d));
    set("templateErrors", errorsHTML(problems(def, m.channel, d)));
    set("tplBodyCount", `${d.body.length}/${lim.body}`);
    if (lim.subject !== null) set("tplSubjectCount", `${d.subject.length}/${lim.subject}`);
  };

  Actions["edit-template"] = (el) => {
    const def = byKey(el.dataset.key);
    if (!def) return;
    const drafts = {};
    chans(def).forEach((ch) => { const e = effective(def, ch); drafts[ch] = { subject: e.subject, body: e.body, enabled: e.enabled }; });
    UI.modal = { type: "templateForm", key: def.key, channel: chans(def)[0], drafts };
    render();
  };
  Actions["tpl-channel"] = (el) => { if (UI.modal) { UI.modal.channel = el.dataset.ch; render(); } };
  Actions["tpl-enabled"] = (el) => { if (UI.modal) { UI.modal.drafts[UI.modal.channel].enabled = el.checked; render(); } };

  /* C. Save one channel: refused like the API; a part equal to the default keeps no copy; audited. */
  Submits["save-template"] = () => {
    const m = UI.modal;
    const def = byKey(m.key);
    const ch = m.channel;
    const d = m.drafts[ch];
    const errs = problems(def, ch, d);
    if (errs.length) { showToast(errs[0], "danger"); render(); return; }
    const fallback = def.channels[ch];
    const subject = LIMITS[ch].subject === null || d.subject.trim() === fallback.subject ? null : d.subject.trim();
    const body = d.body.trim() === fallback.body ? null : d.body.trim();
    const before = effective(def, ch);
    const all = { ...State.messageTemplates, [def.key]: { ...(State.messageTemplates[def.key] || {}) } };
    if (!subject && !body && d.enabled) delete all[def.key][ch];
    else all[def.key][ch] = { subject, body, enabled: d.enabled };
    State.messageTemplates = all;
    persist("messageTemplates");
    const after = effective(def, ch);
    if (before.subject !== after.subject || before.body !== after.body || before.enabled !== after.enabled) {
      audit("notification_template.updated", `${def.key}/${ch}`, { channel: ch, subject: before.subject, enabled: before.enabled }, { channel: ch, subject: after.subject, enabled: after.enabled });
    }
    showToast(`${def.name} — ${label(ch)} saved`);
    render();
  };
  Actions["reset-template"] = () => {
    const m = UI.modal;
    const def = byKey(m.key);
    const ch = m.channel;
    if (saved(def.key, ch)) {
      const all = { ...State.messageTemplates, [def.key]: { ...(State.messageTemplates[def.key] || {}) } };
      delete all[def.key][ch];
      State.messageTemplates = all;
      persist("messageTemplates");
      audit("notification_template.reset", `${def.key}/${ch}`, null, { channel: ch });
    }
    const e = effective(def, ch);
    m.drafts[ch] = { subject: e.subject, body: e.body, enabled: e.enabled };
    showToast(`${def.name} — ${label(ch)} back to the default`);
    render();
  };

  /* D. The audit log names them. */
  Object.assign(AUDIT_ACTION_TEXT, {
    "notification_template.updated": ["Notifications", "changed a message's wording"],
    "notification_template.reset": ["Notifications", "reset a message to the default"],
  });
  Object.assign(AUDIT_ENTITY_LABEL, { notification_template: "Message templates" });
})();

/* ---------------- Later the same day: Promotions and Coupons as P9-7 built them (MR !84, D85) ---------------- */
/* In the real admin app (quickkart-api-service docs/08 §42): /admin/promotions — only with the business's Promotions
   feature (`features.promotions` in /admin/auth/me) — and /admin/coupons: GET (paged; a coupon with `status`,
   `summary`, `timesUsed`, `discountGiven`), POST, PATCH /:id with only what changes, DELETE /:id. A coupon's dates are
   business days: `startsOn` (from the start of that day) and `expiresOn` (the last day it works). */
(function round11PromotionsCoupons() {
  const LIVE_MAX = 20;
  const TITLE_MAX = 80;
  const SUBTITLE_MAX = 200;
  const DESCRIPTION_MAX = 200;
  const USES_MAX = 1000000;
  const CODE = /^[A-Z0-9][A-Z0-9_-]{1,29}$/;
  const AMOUNT = /^\d{1,7}(\.\d{1,2})?$/;
  const tooMany = `At most ${LIVE_MAX} promotions can be live at once — switch one off or delete one first`;

  /* Business days ↔ moments (the browser's day stands in for the shop's timezone). */
  const pad = (n) => String(n).padStart(2, "0");
  const dayOf = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dayStart = (s) => { const d = new Date(`${s}T00:00:00`); return Number.isNaN(d.getTime()) || dayOf(d.getTime()) !== s ? null : d.getTime(); };
  const dayAfter = (s) => { const t = dayStart(s); if (t === null) return null; const d = new Date(t); d.setDate(d.getDate() + 1); return d.getTime(); };
  const lastDay = (expiresAt) => dayOf(expiresAt - 1); // the day of its very last moment
  const shown = (v) => (typeof v === "string" && v.startsWith("data:") ? "(uploaded picture)" : v ?? null);
  const by = (u) => ({ actorType: "user", actorId: u.id });

  /* ================= Promotions ================= */
  const liveCount = () => State.promotions.filter((p) => p.enabled).length;
  const PROMO_FIELDS = ["title", "subtitle", "image", "enabled"];
  const snapPromos = () => JSON.parse(JSON.stringify(State.promotions));
  function recordPromos(before, actor) {
    if (!actor) return;
    const was = new Map(before.map((p) => [p.id, p]));
    const now = new Map(State.promotions.map((p) => [p.id, p]));
    const pick = (p, keys) => Object.fromEntries(keys.map((k) => [k, p[k] === "" ? null : shown(p[k])]));
    for (const p of State.promotions) {
      const o = was.get(p.id);
      const names = { entity: p.title };
      if (!o) { addAuditEvent({ action: "promotion.created", entity: "promotion", entityId: String(p.id), ...by(actor), after: pick(p, PROMO_FIELDS.filter((k) => p[k] !== "" && p[k] != null)), names }); continue; }
      const ch = PROMO_FIELDS.filter((k) => !auditSame(o[k], p[k]));
      if (ch.length) addAuditEvent({ action: "promotion.updated", entity: "promotion", entityId: String(p.id), ...by(actor), before: pick(o, ch), after: pick(p, ch), names });
    }
    for (const o of before) {
      if (!now.has(o.id)) addAuditEvent({ action: "promotion.deleted", entity: "promotion", entityId: String(o.id), ...by(actor), before: pick(o, ["title", "enabled"]), names: { entity: o.title } });
    }
  }

  /* AC. The screen: what a promotion is, how many are live, no "pushed to customers". */
  window.adminPromotions = function () {
    const editable = canEdit(currentUser(), "promotions");
    return `
    <div class="admin-toolbar">
      ${editable ? `<button class="btn btn-primary" data-action="new-promo">${ic("plus")} New promotion</button>` : "<span></span>"}
      <span class="qk-muted small">${liveCount()} of ${LIVE_MAX} live</span>
    </div>
    <div class="qk-muted small" style="margin-top:8px">A promotion is an extra slide on the customer home page's top carousel, after the Home Screen's own slides, newest first. Customers see it at once — <b>no notification is sent</b>. Part of your plan's Promotions feature: without it this screen is hidden and customers see no promotions.</div>
    <div class="admin-table" style="margin-top:12px">
      ${State.promotions.map((p) => `
        <div class="admin-row admin-row-promo">
          ${p.image ? `<img src="${esc(p.image)}" class="admin-row-img" alt="" />` : ""}
          <div class="admin-row-info"><div class="admin-row-name">${esc(p.title)}</div><div class="qk-muted small">${esc(p.subtitle || "")}</div></div>
          <span class="badge badge-${p.enabled ? "green" : "yellow"}">${p.enabled ? "Live" : "Paused"}</span>
          ${editable ? `
          <button class="btn btn-sm ${p.enabled ? "btn-outline-danger" : "btn-primary-soft"}" data-action="toggle-promo" data-id="${p.id}">${p.enabled ? "Disable" : "Enable"}</button>
          <button class="icon-btn" data-action="edit-promo" data-id="${p.id}">${ic("edit")}</button>
          <button class="icon-btn icon-btn-danger" data-action="delete-promo" data-id="${p.id}">${ic("trash")}</button>` : ""}
        </div>`).join("")}
      ${State.promotions.length === 0 ? `<div class="empty-state"><div class="empty-title">No promotions yet</div></div>` : ""}
    </div>`;
  };

  /* AC. The form: required title and picture, the lengths, the backend's wording. */
  const basePromoForm = window.promoFormModal;
  window.promoFormModal = function () {
    const err = UI.modal && UI.modal.error;
    const noPicture = !(UI.modal && UI.modal.form && UI.modal.form.image);
    return basePromoForm()
      // No picture yet: the stock preview is only a placeholder.
      .replace('class="form-media-preview"', noPicture ? 'class="form-media-preview" style="opacity:.3"' : 'class="form-media-preview"')
      .replace("Create & push to customers", "Create & show to customers")
      .replace(">Banner image URL<", ">Banner picture *<")
      .replace('<span class="field-label">Title</span>', '<span class="field-label">Title *</span>')
      .replace('name="title"', `name="title" maxlength="${TITLE_MAX}"`)
      .replace('name="subtitle"', `name="subtitle" maxlength="${SUBTITLE_MAX}"`)
      .replace('<div class="form-actions">', `<div class="qk-muted small">Shown on the home page as soon as it is saved. No notification is sent.</div>
        ${err ? `<div class="field-error">${esc(err)}</div>` : ""}
        <div class="form-actions">`);
  };

  const baseSavePromo = Submits["save-promo"];
  Submits["save-promo"] = (form, ev) => {
    const fd = new FormData(form);
    const f = UI.modal.form;
    const title = String(fd.get("title") || "").trim();
    const subtitle = String(fd.get("subtitle") || "").trim();
    const image = String(fd.get("image") || "").trim();
    const fail = (message) => { UI.modal.form = { ...f, title, subtitle, image: image || f.image }; UI.modal.error = message; render(); };
    if (!title) return fail("Enter a title");
    if (title.length > TITLE_MAX) return fail(`Keep the title to ${TITLE_MAX} characters`);
    if (subtitle.length > SUBTITLE_MAX) return fail(`Keep the subtitle to ${SUBTITLE_MAX} characters`);
    if (!image && !f.image) return fail("Add a picture — upload one or paste an https:// link");
    if (!f.id && liveCount() >= LIVE_MAX) return fail(tooMany);
    const actor = currentUser();
    const before = snapPromos();
    // The Round 1 save announced "pushed to customers" — nothing is pushed (D85 a).
    const keepNotice = window.pushNotice;
    window.pushNotice = () => {};
    try { baseSavePromo(form, ev); } finally { window.pushNotice = keepNotice; }
    if (UI.modal) return; // a later check (Round 10's picture link) kept the form open
    recordPromos(before, actor);
    showToast(f.id ? `"${title}" saved` : `"${title}" is on the home page now`);
  };

  Actions["toggle-promo"] = (el) => {
    const p = State.promotions.find((x) => x.id === Number(el.dataset.id));
    if (!p) return;
    if (!p.enabled && liveCount() >= LIVE_MAX) { showToast(tooMany, "danger"); return; }
    const actor = currentUser();
    const before = snapPromos();
    State.promotions = State.promotions.map((x) => (x.id === p.id ? { ...x, enabled: !p.enabled } : x));
    persist("promotions");
    recordPromos(before, actor);
    showToast(p.enabled ? `"${p.title}" is off the home page` : `"${p.title}" is on the home page again`);
    render();
  };

  const baseDeletePromo = Actions["delete-promo"];
  Actions["delete-promo"] = (el, ev) => {
    const actor = currentUser();
    const before = snapPromos();
    baseDeletePromo(el, ev);
    recordPromos(before, actor);
  };

  /* ================= Coupons ================= */
  // Coupons saved before this round have no dates, limits or first-order flag; WELCOME15 is first-order only, as the
  // backend's seed has it.
  const terms = (c) => ({
    startsAt: null, usageLimitTotal: null, usageLimitPerCustomer: null, description: "",
    ...c,
    firstOrderOnly: c.firstOrderOnly ?? c.code === "WELCOME15",
  });
  // Orders that used it — cancelled ones too (D41). A new coupon with a deleted one's code starts from 0.
  const usesOf = (c) => State.orders.filter((o) => o.couponCode === c.code && (!c.createdAt || o.createdAt >= c.createdAt));
  const figures = (c) => {
    const uses = usesOf(c);
    return { timesUsed: uses.length, discountGiven: uses.reduce((s, o) => s + (o.couponDiscount || 0), 0) };
  };
  // The first that applies, as the backend answers `status` (D85 e).
  const statusOf = (raw, now = Date.now()) => {
    const c = terms(raw);
    if (!c.enabled) return "paused";
    if (c.expiresAt && c.expiresAt <= now) return "expired";
    if (c.startsAt && c.startsAt > now) return "scheduled";
    if (c.usageLimitTotal != null && figures(c).timesUsed >= c.usageLimitTotal) return "used_up";
    return "live";
  };
  const STATUS = { live: ["Live", "green"], scheduled: ["Scheduled", "blue"], paused: ["Paused", "yellow"], expired: ["Expired", "gray"], used_up: ["Used up", "gray"] };
  const summaryOf = (c) => {
    const kind = c.type === "percent" ? `${Number(c.value)}% off${c.maxDiscount ? ` (up to ${money(c.maxDiscount)})` : ""}` : c.type === "flat" ? `${money(c.value)} off` : "Free delivery";
    return c.minOrder > 0 ? `${kind} · min. order ${money(c.minOrder)}` : kind;
  };
  const datesOf = (c) => {
    const from = c.startsAt ? `From ${fmtDate(c.startsAt)}` : "";
    const until = c.expiresAt ? `Last day ${fmtDate(dayStart(lastDay(c.expiresAt)))}` : "No expiry";
    return [from, until].filter(Boolean).join(" · ");
  };
  const limitsOf = (c) => [
    c.usageLimitPerCustomer != null ? `${c.usageLimitPerCustomer} per customer` : "",
    c.usageLimitTotal != null ? `${c.usageLimitTotal.toLocaleString("en-SG")} in total` : "",
    c.firstOrderOnly ? "First order only" : "",
  ].filter(Boolean).join(" · ");

  const COUPON_FIELDS = ["code", "description", "type", "value", "minOrder", "maxDiscount", "startsOn", "expiresOn", "enabled", "usageLimitTotal", "usageLimitPerCustomer", "firstOrderOnly"];
  const auditView = (raw) => {
    const c = terms(raw);
    return { ...c, startsOn: c.startsAt ? dayOf(c.startsAt) : null, expiresOn: c.expiresAt ? lastDay(c.expiresAt) : null, description: c.description || null };
  };
  const snapCoupons = () => JSON.parse(JSON.stringify(State.coupons));
  function recordCoupons(before, actor) {
    if (!actor) return;
    const was = new Map(before.map((c) => [c.id, auditView(c)]));
    const now = new Set(State.coupons.map((c) => c.id));
    const pick = (c, keys) => Object.fromEntries(keys.map((k) => [k, c[k] ?? null]));
    for (const raw of State.coupons) {
      const c = auditView(raw);
      const o = was.get(c.id);
      const names = { entity: c.code };
      if (!o) { addAuditEvent({ action: "coupon.created", entity: "coupon", entityId: String(c.id), ...by(actor), after: pick(c, COUPON_FIELDS.filter((k) => c[k] != null)), names }); continue; }
      const ch = COUPON_FIELDS.filter((k) => !auditSame(o[k] ?? null, c[k] ?? null));
      if (ch.length) addAuditEvent({ action: "coupon.updated", entity: "coupon", entityId: String(c.id), ...by(actor), before: pick(o, ch), after: pick(c, ch), names });
    }
    for (const o of was.values()) {
      if (!now.has(o.id)) addAuditEvent({ action: "coupon.deleted", entity: "coupon", entityId: String(o.id), ...by(actor), before: pick(o, ["code", "type", "enabled"]), names: { entity: o.code } });
    }
  }

  /* AE. The list: the state of each coupon, its use, a filter. */
  window.adminCoupons = function () {
    const editable = canEdit(currentUser(), "coupons");
    const filter = UI.couponStatusFilter || "all";
    const list = State.coupons
      .filter((c) => filter === "all" || statusOf(c) === filter)
      .slice().sort((a, b) => a.code.localeCompare(b.code));
    return `
    <div class="admin-toolbar">
      ${editable ? `<button class="btn btn-primary" data-action="new-coupon">${ic("plus")} New coupon</button>` : "<span></span>"}
      <div style="display:flex;gap:8px;align-items:center">
        <select class="input input-sm" data-action="coupon-status-filter" aria-label="Show">
          ${[["all", "All coupons"], ...Object.entries(STATUS).map(([k, [label]]) => [k, label])].map(([k, label]) => `<option value="${k}" ${filter === k ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        ${exportButtonsHTML("coupons")}
      </div>
    </div>
    <div class="admin-table" style="margin-top:12px">
      ${list.map((raw) => {
        const c = terms(raw);
        const [label, tone] = STATUS[statusOf(c)];
        const f = figures(c);
        const limits = limitsOf(c);
        return `
        <div class="admin-row">
          <div class="admin-row-info">
            <div class="admin-row-name">${esc(c.code)}</div>
            <div class="qk-muted small">${esc(summaryOf(c))} · ${esc(datesOf(c))}</div>
            <div class="qk-muted small">${limits ? `${esc(limits)} · ` : ""}Used ${f.timesUsed}×${f.timesUsed ? ` · ${money(f.discountGiven)} off in total` : ""}</div>
          </div>
          <span class="badge badge-${tone}">${label}</span>
          ${editable ? `
          <button class="btn btn-sm ${c.enabled ? "btn-outline-danger" : "btn-primary-soft"}" data-action="toggle-coupon" data-id="${c.id}">${c.enabled ? "Disable" : "Enable"}</button>
          <button class="icon-btn" data-action="edit-coupon" data-id="${c.id}">${ic("edit")}</button>
          <button class="icon-btn icon-btn-danger" data-action="delete-coupon" data-id="${c.id}">${ic("trash")}</button>` : ""}
        </div>`;
      }).join("")}
      ${list.length === 0 ? `<div class="empty-state"><div class="empty-title">${State.coupons.length ? "No coupons in this state" : "No coupons yet"}</div></div>` : ""}
    </div>`;
  };
  Actions["coupon-status-filter"] = (el) => { UI.couponStatusFilter = el.value; render(); };

  /* AD. The form: the new boxes, the boxes each type uses, the problems by the box. */
  // The form holds what was typed (text), so a problem or a type change never loses it.
  const formOf = (raw) => {
    const c = terms(raw);
    return {
      id: c.id, code: c.code, description: c.description || "", type: c.type,
      value: c.type === "freeship" ? "" : String(c.value ?? ""), minOrder: String(c.minOrder || 0),
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : "",
      startsOn: c.startsAt ? dayOf(c.startsAt) : "", expiresOn: c.expiresAt ? lastDay(c.expiresAt) : "",
      usageLimitTotal: c.usageLimitTotal != null ? String(c.usageLimitTotal) : "",
      usageLimitPerCustomer: c.usageLimitPerCustomer != null ? String(c.usageLimitPerCustomer) : "",
      firstOrderOnly: !!c.firstOrderOnly, enabled: c.enabled !== false,
    };
  };
  const readForm = (form) => {
    const fd = new FormData(form);
    const text = (k) => String(fd.get(k) ?? "");
    return {
      code: text("code"), description: text("description"), type: text("type") || "percent", value: text("value"),
      minOrder: text("minOrder"), maxDiscount: text("maxDiscount"), startsOn: text("startsOn"), expiresOn: text("expiresOn"),
      usageLimitTotal: text("usageLimitTotal"), usageLimitPerCustomer: text("usageLimitPerCustomer"),
      firstOrderOnly: fd.get("firstOrderOnly") === "on", enabled: fd.get("enabled") === "on",
    };
  };
  Actions["new-coupon"] = () => {
    UI.modal = { type: "couponForm", form: formOf({ code: "", type: "percent", value: 10, minOrder: 0, maxDiscount: null, enabled: true, firstOrderOnly: false }), errors: {} };
    render();
  };
  Actions["edit-coupon"] = (el) => {
    const c = State.coupons.find((x) => x.id === Number(el.dataset.id));
    if (!c) return;
    UI.modal = { type: "couponForm", form: formOf(c), errors: {} };
    render();
  };
  Actions["coupon-type"] = (el) => {
    UI.modal.form = { ...UI.modal.form, ...readForm(el.closest("form")) };
    render();
  };

  window.couponFormModal = function () {
    const f = UI.modal.form;
    const err = UI.modal.errors || {};
    const box = (name, label, attrs, hint) => `
      <label class="field"><span class="field-label">${label}</span><input class="input ${err[name] ? "invalid" : ""}" name="${name}" value="${esc(f[name] ?? "")}" ${attrs} /></label>
      ${err[name] ? `<div class="field-error">${esc(err[name])}</div>` : hint ? `<div class="qk-muted small" style="margin:-8px 0 4px">${hint}</div>` : ""}`;
    return `
    <div class="overlay" data-action="close-modal-backdrop">
      <div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
        <div class="dialog-head"><span>${f.id ? "Edit coupon" : "New coupon"}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
        <form class="dialog-body" data-action="save-coupon">
          ${box("code", "Coupon code *", 'placeholder="e.g. QUICK10" maxlength="30" style="text-transform:uppercase" autocomplete="off"', "2–30 letters, digits, - and _ — saved in capitals.")}
          ${box("description", "Description", `placeholder="Shown to customers in their coupon list" maxlength="${DESCRIPTION_MAX}"`)}
          <div class="field-grid-2">
            <label class="field"><span class="field-label">Type</span>
              <select class="input" name="type" data-action="coupon-type">
                <option value="percent" ${f.type === "percent" ? "selected" : ""}>Percent off</option>
                <option value="flat" ${f.type === "flat" ? "selected" : ""}>Flat amount off</option>
                <option value="freeship" ${f.type === "freeship" ? "selected" : ""}>Free delivery</option>
              </select>
            </label>
            ${f.type === "freeship"
              ? `<div class="field"><span class="field-label">Value</span><div class="qk-muted small" style="padding-top:8px">None — the delivery fee is waived.</div></div>`
              : `<div>${box("value", f.type === "percent" ? "Percent off *" : "Amount off (S$) *", `inputmode="decimal" placeholder="${f.type === "percent" ? "0.01–100" : "e.g. 5"}"`)}</div>`}
          </div>
          <div class="field-grid-2">
            <div>${box("minOrder", "Min. order (S$)", 'inputmode="decimal"', "On the cart after BOGO and combos.")}</div>
            <div>${f.type === "percent" ? box("maxDiscount", "Max discount (S$)", 'inputmode="decimal" placeholder="No cap"', "Optional cap on the % off.") : ""}</div>
          </div>
          <div class="field-grid-2">
            <div>${box("startsOn", "Starts on", 'type="date"', "Empty = from now. Before it customers don't see it.")}</div>
            <div>${box("expiresOn", "Last day", 'type="date"', "Works to the end of this day. Empty = never expires.")}</div>
          </div>
          <div class="field-grid-2">
            <div>${box("usageLimitTotal", "Total uses", 'type="number" min="1" max="1000000" step="1" placeholder="No limit"', "By all customers together.")}</div>
            <div>${box("usageLimitPerCustomer", "Uses per customer", 'type="number" min="1" max="1000000" step="1" placeholder="No limit"')}</div>
          </div>
          <label class="stock-toggle-lg"><input type="checkbox" name="firstOrderOnly" ${f.firstOrderOnly ? "checked" : ""} /><span>First order only — every order a customer ever placed counts, cancelled ones too</span></label>
          <label class="stock-toggle-lg"><input type="checkbox" name="enabled" ${f.enabled !== false ? "checked" : ""} /><span>Active — customers can apply this code</span></label>
          ${f.id && figures(terms(State.coupons.find((c) => c.id === f.id) || {})).timesUsed ? `<div class="qk-muted small">This coupon has been used — orders already placed keep their bill.</div>` : ""}
          <div class="form-actions">
            <button type="button" class="btn btn-outline btn-block" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary btn-block">${f.id ? "Save changes" : "Create coupon"}</button>
          </div>
        </form>
      </div>
    </div>`;
  };

  /* AD. The save: the backend's checks (D85 b, c). */
  Submits["save-coupon"] = (form) => {
    const raw = readForm(form);
    const f = UI.modal.form;
    const existing = f.id ? State.coupons.find((c) => c.id === f.id) : null;
    const errors = {};
    const code = raw.code.trim().toUpperCase();
    if (!code) errors.code = "Enter a coupon code";
    else if (!CODE.test(code)) errors.code = "2–30 letters, digits, - and _, starting with a letter or digit";
    else if (State.coupons.some((c) => c.code.toUpperCase() === code && c.id !== f.id)) errors.code = "Another coupon already uses this code";
    const description = raw.description.trim();
    if (description.length > DESCRIPTION_MAX) errors.description = `Keep it to ${DESCRIPTION_MAX} characters`;
    const amount = (key, text, fallback) => {
      const s = text.trim() || fallback;
      if (s === "") return null;
      if (!AMOUNT.test(s)) { errors[key] = 'Enter an amount such as "12.50"'; return null; }
      return Number(s);
    };
    const type = raw.type;
    let value = 0;
    if (type !== "freeship") {
      value = amount("value", raw.value, "");
      if (value === null && !errors.value) errors.value = "Enter the value";
      else if (type === "percent" && (value <= 0 || value > 100)) errors.value = "A percentage from 0.01 to 100";
      else if (type === "flat" && value <= 0) errors.value = "Must be more than 0";
    }
    const minOrder = amount("minOrder", raw.minOrder, "0");
    let maxDiscount = null;
    if (type === "percent") {
      maxDiscount = amount("maxDiscount", raw.maxDiscount, "");
      if (maxDiscount !== null && maxDiscount <= 0) errors.maxDiscount = "Must be more than 0 — or leave it empty for no cap";
    }
    // A date box still showing the saved day keeps the saved moment — only a changed day is saved anew.
    const was = existing ? formOf(existing) : null;
    const startsSame = !!was && raw.startsOn === was.startsOn;
    const expiresSame = !!was && raw.expiresOn === was.expiresOn;
    const startsAt = startsSame ? existing.startsAt ?? null : raw.startsOn ? dayStart(raw.startsOn) : null;
    if (raw.startsOn && startsAt === null) errors.startsOn = "Must be a real date";
    const expiresAt = expiresSame ? existing.expiresAt ?? null : raw.expiresOn ? dayAfter(raw.expiresOn) : null;
    if (raw.expiresOn && expiresAt === null) errors.expiresOn = "Must be a real date";
    // An expiry that is set must be today or later; an old coupon's past expiry stays while other fields change.
    const expiryChanged = !expiresSame;
    if (expiryChanged && expiresAt !== null && expiresAt <= Date.now()) errors.expiresOn = "Must be today or later";
    if (startsAt !== null && expiresAt !== null && startsAt >= expiresAt && !errors.startsOn) errors.startsOn = "Must be on or before the last day";
    const uses = (key) => {
      const s = raw[key].trim();
      if (!s) return null;
      const n = Number(s);
      if (!Number.isInteger(n) || n < 1 || n > USES_MAX) { errors[key] = "A whole number from 1 to 1,000,000 — or empty for no limit"; return null; }
      return n;
    };
    const usageLimitTotal = uses("usageLimitTotal");
    const usageLimitPerCustomer = uses("usageLimitPerCustomer");
    if (Object.keys(errors).length) {
      UI.modal.form = { ...f, ...raw };
      UI.modal.errors = errors;
      render();
      return;
    }

    const data = {
      code, description, type, value, minOrder, maxDiscount, startsAt, expiresAt,
      usageLimitTotal, usageLimitPerCustomer, firstOrderOnly: raw.firstOrderOnly, enabled: raw.enabled,
    };
    const actor = currentUser();
    const before = snapCoupons();
    if (existing) {
      State.coupons = State.coupons.map((c) => (c.id === f.id ? { ...c, ...data } : c));
    } else {
      const id = State.coupons.length ? Math.max(...State.coupons.map((c) => c.id)) + 1 : 1;
      State.coupons.push({ ...data, id, createdAt: Date.now() });
    }
    persist("coupons");
    recordCoupons(before, actor);
    UI.modal = null;
    showToast(existing ? `${code} updated` : `${code} created`);
    render();
  };

  for (const name of ["toggle-coupon", "delete-coupon"]) {
    const base = Actions[name];
    Actions[name] = (el, ev) => {
      const actor = currentUser();
      const before = snapCoupons();
      base(el, ev);
      recordCoupons(before, actor);
    };
  }

  /* AE. The export: the backend's columns. */
  EXPORTS.coupons = () => ({
    name: "coupons",
    columns: ["Code", "Type", "Value", "Min order", "Max discount", "Status", "Starts", "Expires", "Total uses limit", "Per customer limit", "First order only", "Times used", "Discount given", "Description", "Added"],
    rows: State.coupons.slice().sort((a, b) => a.code.localeCompare(b.code)).map((raw) => {
      const c = terms(raw);
      const f = figures(c);
      return [c.code, c.type, Number(c.value || 0).toFixed(2), Number(c.minOrder || 0).toFixed(2), c.maxDiscount != null ? Number(c.maxDiscount).toFixed(2) : "",
        statusOf(c), c.startsAt ? dayOf(c.startsAt) : "", c.expiresAt ? lastDay(c.expiresAt) : "", c.usageLimitTotal ?? "", c.usageLimitPerCustomer ?? "",
        c.firstOrderOnly ? "Yes" : "No", f.timesUsed, f.discountGiven.toFixed(2), c.description || "", c.createdAt ? fmtDateTime(c.createdAt) : ""];
    }),
  });

  /* AE. The customer's checkout follows the dates and the limits, in the backend's order and words. */
  window.couponEligibility = function (coupon, subtotal) {
    if (!coupon) return { ok: false, reason: "Invalid coupon code" };
    const c = terms(coupon);
    const no = (reason) => ({ ok: false, reason });
    const now = Date.now();
    if (!c.enabled) return no("This coupon is no longer active");
    if (c.startsAt && c.startsAt > now) return no("This coupon is not active yet");
    if (c.expiresAt && c.expiresAt <= now) return no("This coupon has expired");
    const uses = usesOf(c);
    if (c.usageLimitTotal != null && uses.length >= c.usageLimitTotal) return no("This coupon has been fully claimed");
    const me = State.session && State.session.role === "customer" ? State.session.name : null;
    if (me && c.usageLimitPerCustomer != null && uses.filter((o) => o.customerName === me).length >= c.usageLimitPerCustomer) {
      return no("You have already used this coupon");
    }
    if (me && c.firstOrderOnly && State.orders.some((o) => o.customerName === me)) return no("This coupon is only for your first order");
    if (subtotal < (c.minOrder || 0)) return no(`Add ${money(c.minOrder - subtotal)} more to use ${c.code}`);
    return { ok: true };
  };

  /* AF. The audit log names them. */
  Object.assign(AUDIT_ACTION_TEXT, {
    "promotion.created": ["Promotions", "added promotion"],
    "promotion.updated": ["Promotions", "changed promotion"],
    "promotion.deleted": ["Promotions", "deleted promotion"],
    "coupon.created": ["Coupons", "added coupon"],
    "coupon.updated": ["Coupons", "changed coupon"],
    "coupon.deleted": ["Coupons", "deleted coupon"],
  });
  Object.assign(AUDIT_ENTITY_LABEL, { promotion: "Promotions", coupon: "Coupons" });
  Object.assign(AUDIT_FIELD_LABEL, {
    code: "Code", description: "Description", type: "Type", value: "Value", minOrder: "Min. order", maxDiscount: "Max discount",
    startsOn: "Starts on", expiresOn: "Last day", usageLimitTotal: "Total uses", usageLimitPerCustomer: "Uses per customer",
    firstOrderOnly: "First order only",
  });
})();

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Stock transfers, Home Screen, Business Settings, Delivery Slots, Notifications, Promotions & Coupons as built (round 11)", items: [
  ["Order cancelled", "Cancelling an order cancels its transfer requests that were not sent yet — Transfers ▸ Done shows them as \"Cancelled · with the order\". One already on the way still arrives: Mark received adds it to the store's stock."],
  ["Mark received", "A transfer for an order covers the short item only while the order is open and the item isn't marked unavailable; otherwise the units simply join the store's stock, and the toast says so."],
  ["Decline with a note", "Stock ▸ Transfers ▸ Decline: a note box next to the reason. The lists show the reason and the note, and who did the last step."],
  ["Not enough to send", "With negative stock not allowed, Accept & send and Send to store say \"Only 2 on hand at QuickKart Clementi — this business does not allow negative stock\"."],
  ["Deleting a product or a store", "Not while a stock transfer of the product — or to or from the store — is still requested or on the way: receive, decline or cancel it first."],
  ["Combo price", "Marketing ▸ Home Screen ▸ Deals & Combos: the bundle price must be below what its products cost apart — \"Bundle price must be below S$11.70 — what these products cost apart\". A combo holds at most 10 products."],
  ["Home Screen limits", "At most 20 tiles in a section, 10 promo sections, 20 products in a promo section and 30 combos — the message says to delete one first. Titles up to 80 characters, subtitles up to 200."],
  ["Home Screen in the audit log", "Setup ▸ Audit log shows every Home Screen change: sections switched, edited, added, deleted or reordered; tiles; combos; theme & branding — with before and after."],
  ["Company Profile", "Setup ▸ Business Settings ▸ Company Profile: new Website, WhatsApp number and Timezone boxes. Legal name, trading-as and UEN are required; the UEN, GST number, email and phones are checked and the problem shows by the box — replace the placeholder UEN (2024XXXXXXA) before saving."],
  ["Order rules", "Delivery & Payments ▸ Order rules (new): until when customers may cancel (default: until picking starts — never once the order is ready for the rider), the most of one item per order (1–99), and returns within N days of delivery (0 = no returns). The customer app follows them."],
  ["Rider pay", "Delivery & Payments ▸ Rider pay (new): what a rider earns per completed delivery — was a fixed S$5.00. The rider app's Earnings follow it; an order keeps the amount it was delivered with."],
  ["Payment methods", "The last payment method that is on can't be switched off — checkout needs one for every order, even one the wallet pays in full."],
  ["Goodwill limits", "Stock Rules ▸ Goodwill limits: the staff credit has its own period, and a new limit per staff member per day (S$200; above it only the Super Admin). Customers ▸ Add wallet credit shows what you can still add today."],
  ["Business Settings in the audit log", "Every Business Settings save — including slot days and peak-hour sections — is one entry in Setup ▸ Audit log with what changed."],
  ["Slot times", "Delivery Slots ▸ Slot times: only the Super Admin or Business Settings edit can change them; each slot takes 1–9999 orders and ends after it starts (00:00 = midnight). Change a slot's hours and the orders already booked in the old window stay there — the day lists them as \"No longer offered\"."],
  ["One-off slots", "A one-off slot's capacity box changes its own capacity, it starts empty, and it can't be deleted while orders are booked in it — move them first."],
  ["Move to…", "Move an order to any open slot of the store that isn't full or started, on any of its days — staff aren't held to the customer's cut-off. Orders edit may move too. The customer is not told: let them know."],
  ["Another date", "Delivery Slots ▸ \"Open another date\": any day up to 60 days ahead, e.g. to close a slot on a holiday."],
  ["No QuickKart shared provider", "Setup ▸ Notifications ▸ Channels & providers: each business uses its own email (SMTP, SendGrid, Amazon SES, Mailgun, Postmark), SMS (Twilio, Vonage, Amazon SNS) and Firebase — the \"Use QuickKart's shared provider\" choice is gone. A card says \"Not set up\" until its provider is saved: nothing is sent on it, and without SMS customers can't log in."],
  ["Super Admin only", "Only the Super Admin sees Channels & providers — they decide where login codes and password-reset emails go; others with Notifications see the message templates. Every save, and every switch on or off, emails every Super Admin and shows in Setup ▸ Audit log."],
  ["SMS off", "Switching SMS off stops the SMS messages — never the login codes: customers must always be able to log in."],
  ["Send test", "Uses the saved settings and goes to you only: email to your address, SMS to your own mobile (add it to your profile first), push as a Firebase dry run (nothing delivered). At most 5 tests in 10 minutes."],
  ["Message templates", "Notifications ▸ Message templates: each message has its own channels, each with its own words — a tab per channel with its subject (email / push), text, On / Off, a live preview and Reset to default. Only the message's own {{placeholders}}; the login code must start with {{code}}, the reset and invite emails keep their link; SMS up to 480 characters (SMS costs you)."],
  ["Always on", "The login code and the admin password-reset and invite emails can be reworded but never switched off."],
  ["New messages", "Order placed — an email receipt when you take the order. Delivery slot reminder — a push before the slot. Cash reminder, Message from the store and Order assigned to you are worded now and marked \"Not sent yet\" until their screens are built."],
  ["Slot reminder", "Delivery Slots ▸ Slot times: \"Remind customers before their slot (minutes)\" — 60 by default, 0 = no reminder."],
  ["Promotions", "Marketing ▸ Promotions: a promotion is an extra slide on the home page's top carousel. No notification is sent, so the button now reads \"Create & show to customers\". A title (up to 80 characters) and a picture are needed; at most 20 can be live at once."],
  ["Coupon dates", "Marketing ▸ Coupons: a coupon can start on a later day (\"Starts on\") as well as end (\"Last day\") — whole days. Before it starts customers don't see it, and its code says \"This coupon is not active yet\"."],
  ["Coupon limits", "New boxes: total uses, uses per customer (empty = no limit) and First order only — checkout already followed them in the backend. WELCOME15 is first-order only, as in the backend's seed."],
  ["Coupon list", "Each coupon shows Live, Scheduled, Paused, Expired or Used up, how often it was used and the discount it gave; a filter by state. The export has the new columns."],
  ["Coupon rules", "Code 2–30 letters, digits, - and _ (saved in capitals); percent 0.01–100, flat above 0; free delivery has no value and the cap is for percent coupons only; problems show by the box."],
  ["Promotions & coupons in the audit log", "Setup ▸ Audit log shows promotions and coupons added, changed, switched on or off and deleted."],
] });
