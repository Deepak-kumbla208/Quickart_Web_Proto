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
      "goodwill.staffCapPerUserPerDay": g.staffPerUserDay, "slots.daysAhead": st.daysAhead, "slots.cutoffMinutes": st.cutoffMins,
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
      saveSlotSettings({ templates, retiredWindows, daysAhead, cutoffMins });
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

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Stock transfers, Home Screen, Business Settings, Delivery Slots & Notification providers as built (round 11)", items: [
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
] });
