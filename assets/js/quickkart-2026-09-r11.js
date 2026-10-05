/* ====================================================================
   QuickKart prototype — Round 11 (5 October 2026): stock transfers as the
   backend built them (P9-4b, MR !78, D58 a, D81) on quickkart-api-service.
   Round 6 already has the flow (request → Accept & send / Decline → Mark
   received, and "Send to store"); this round lines up the rules.

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

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Stock transfers as built (round 11)", items: [
  ["Order cancelled", "Cancelling an order cancels its transfer requests that were not sent yet — Transfers ▸ Done shows them as \"Cancelled · with the order\". One already on the way still arrives: Mark received adds it to the store's stock."],
  ["Mark received", "A transfer for an order covers the short item only while the order is open and the item isn't marked unavailable; otherwise the units simply join the store's stock, and the toast says so."],
  ["Decline with a note", "Stock ▸ Transfers ▸ Decline: a note box next to the reason. The lists show the reason and the note, and who did the last step."],
  ["Not enough to send", "With negative stock not allowed, Accept & send and Send to store say \"Only 2 on hand at QuickKart Clementi — this business does not allow negative stock\"."],
  ["Deleting a product or a store", "Not while a stock transfer of the product — or to or from the store — is still requested or on the way: receive, decline or cancel it first."],
] });
