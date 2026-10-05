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

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Stock transfers & Home Screen as built (round 11)", items: [
  ["Order cancelled", "Cancelling an order cancels its transfer requests that were not sent yet — Transfers ▸ Done shows them as \"Cancelled · with the order\". One already on the way still arrives: Mark received adds it to the store's stock."],
  ["Mark received", "A transfer for an order covers the short item only while the order is open and the item isn't marked unavailable; otherwise the units simply join the store's stock, and the toast says so."],
  ["Decline with a note", "Stock ▸ Transfers ▸ Decline: a note box next to the reason. The lists show the reason and the note, and who did the last step."],
  ["Not enough to send", "With negative stock not allowed, Accept & send and Send to store say \"Only 2 on hand at QuickKart Clementi — this business does not allow negative stock\"."],
  ["Deleting a product or a store", "Not while a stock transfer of the product — or to or from the store — is still requested or on the way: receive, decline or cancel it first."],
  ["Combo price", "Marketing ▸ Home Screen ▸ Deals & Combos: the bundle price must be below what its products cost apart — \"Bundle price must be below S$11.70 — what these products cost apart\". A combo holds at most 10 products."],
  ["Home Screen limits", "At most 20 tiles in a section, 10 promo sections, 20 products in a promo section and 30 combos — the message says to delete one first. Titles up to 80 characters, subtitles up to 200."],
  ["Home Screen in the audit log", "Setup ▸ Audit log shows every Home Screen change: sections switched, edited, added, deleted or reordered; tiles; combos; theme & branding — with before and after."],
] });
