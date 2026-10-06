/* ====================================================================
   QuickKart prototype — Round 12 (7 October 2026): staff status changes as
   the backend built them (P10-2d, MR !89, D90) on quickkart-api-service.
   Every change of the day is here.

   The backend's order screens (the console P10-2a, one order P10-2b, the
   status buttons P10-2d) already match what Rounds 3, 6 and 7 designed; the
   one thing that differed is what happens to the orders still waiting for
   Accept when a shop switches from Manual to Automatic confirmation. The
   prototype confirmed them all silently; the backend lets the OWNER CHOOSE
   when saving (D90 a, the user's answer of 7 October):

   A. Settings ▸ Delivery & Payments ▸ Order confirmation — saving Manual →
      Automatic while orders wait for Accept opens a question:
        "N orders are still waiting for Accept. Accept them now?"
        [Accept N orders and switch] [Switch, leave them waiting] [Back]
      With none waiting it saves straight away, as before. (Backend: the
      settings screen reads orders.waitingToAccept; the save may carry
      orders.acceptWaitingOrders — only on this switch.)
   B. "Leave them waiting" keeps those orders in "New — accept": the Orders
      stage list and board keep that stage while any order waits, even in
      Automatic mode, and orders placed afterwards still confirm themselves —
      they never accept the ones left waiting.
   D. (later the same day) The store's side of an unavailable item as P10-2c built it (D62 a, D91): "Not available" opens a
      dialog where the replacement is chosen when the line is marked — the default substitute, another product in stock
      at this store, or none — and the customer is told at once; only while the order is being picked or packed (not
      "Confirmed"), also on a line already ticked off (the tick comes off); the offer can be changed until the customer
      answers (restarts their time); no time limit is said in words; three new audit-log actions.
   E. (later the same day) Assigning riders as P10-3 built it (D60, D92): one suggested rider, the best match of those
      who can take the order now; riders who are switched off are not listed; "Assign the first N only" when a rider has
      room for some of the selected orders; assignments and removals in the audit log.
   C. The card's note changes from "switching to automatic confirms them" to
      what now happens: you are asked; and in Automatic mode it says how
      many are still waiting.
   ==================================================================== */

(function round12AcceptWaiting() {
  const waitingCount = () => State.orders.filter((o) => o.status === "new").length;
  const plural = (n) => `${n} order${n === 1 ? "" : "s"}`;

  // B. An order left waiting is never accepted by a later order's automatic confirmation.
  const autoConfirmBefore = autoConfirm;
  window.autoConfirm = (o) => (o.leftWaiting ? o : autoConfirmBefore(o));

  // B. The "New — accept" stage stays while anything waits for Accept, in either mode.
  window.applyConfirmationMode = function applyConfirmationModeR12() {
    const manual = confirmationMode() === "manual";
    const showNew = manual || waitingCount() > 0;
    PIPELINE.length = 0;
    PIPELINE_ALL.forEach(([k, label]) => {
      if (k === "new" && !showNew) return;
      PIPELINE.push([k, k === "new" ? "New — accept" : k === "confirmed" && !showNew ? "New (paid / COD)" : label]);
    });
    BOARD_COLUMNS.length = 0;
    BOARD_COLUMNS_ALL.forEach((k) => { if (k !== "new" || showNew) BOARD_COLUMNS.push(k); });
    ADVANCE_LABEL.new = "Accept order";
  };
  // Accepting the last waiting order (or one arriving) changes the stage list: follow it on every screen.
  const renderBefore = render;
  window.render = function renderR12(...args) {
    applyConfirmationMode();
    return renderBefore(...args);
  };
  applyConfirmationMode();

  // C. The card's wording.
  window.confirmationCardHTML = function confirmationCardHTMLR12(editable) {
    const mode = confirmationMode();
    const dis = editable ? "" : "disabled";
    const pending = waitingCount();
    const note = pending
      ? mode === "manual"
        ? `${plural(pending)} waiting to be accepted right now — when you switch to automatic you choose whether to accept them or leave them waiting.`
        : `${plural(pending)} still waiting to be accepted (left waiting when you switched) — accept or cancel them from the Orders screen.`
      : "";
    return `
  <div class="summary-card" style="max-width:560px; margin-top:16px">
    <div class="summary-card-title">Order confirmation</div>
    <div class="qk-muted small">How a new order enters your queue. Either way the customer sees "Confirmed" once they have paid; an unpaid online order only ever shows under "Awaiting payment". A change applies to orders placed afterwards.</div>
    <label class="stock-toggle-lg" style="margin-top:10px"><input type="radio" name="confirmMode" value="auto" ${mode === "auto" ? "checked" : ""} ${dis} /><span><b>Automatic</b> <span class="qk-muted small">— a paid or cash order is confirmed the moment it is placed; the first step is "Start picking". (Default)</span></span></label>
    <label class="stock-toggle-lg"><input type="radio" name="confirmMode" value="manual" ${mode === "manual" ? "checked" : ""} ${dis} /><span><b>Manual</b> <span class="qk-muted small">— every order waits as "New — accept" until your team taps Accept (or cancels it). The "accept" target and alert below apply.</span></span></label>
    ${note ? `<div class="qk-muted small" style="margin-top:6px">${note}</div>` : ""}
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-confirmation-mode">Save</button>` : ""}
  </div>`;
  };

  // A. The question, only on Manual → Automatic with orders waiting.
  const saveBefore = Actions["save-confirmation-mode"];
  Actions["save-confirmation-mode"] = () => {
    const el = document.querySelector('input[name="confirmMode"]:checked');
    const next = el && el.value === "manual" ? "manual" : "auto";
    const waiting = waitingCount();
    if (confirmationMode() === "manual" && next === "auto" && waiting > 0) {
      UI.modal = { type: "acceptWaiting", waiting };
      render();
      return;
    }
    return saveBefore();
  };

  function acceptWaitingModal() {
    const n = UI.modal.waiting;
    return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>Switch to automatic confirmation</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <div class="dialog-body">
        <div class="notice notice-warn" style="margin-bottom:10px">${ic("alert")}<span><b>${plural(n)} still ${n === 1 ? "waits" : "wait"} for Accept.</b> Orders placed from now on are accepted automatically. What about the ${n === 1 ? "one" : "ones"} already waiting?</span></div>
        <div class="qk-muted small" style="margin-bottom:12px">Accepted orders move to "Confirmed" so picking can start — the customer is not messaged again. Orders left waiting stay in "New — accept" until your team accepts or cancels them.</div>
        <div class="form-actions" style="flex-wrap:wrap; gap:8px">
          <button type="button" class="btn btn-outline" data-action="close-modal">Back</button>
          <button type="button" class="btn btn-outline" data-action="switch-auto-leave">Switch, leave them waiting</button>
          <button type="button" class="btn btn-primary" data-action="switch-auto-accept">Accept ${plural(n)} and switch</button>
        </div>
      </div>
    </div>
  </div>`;
  }
  const extraBefore = extraModal;
  window.extraModal = (type) => (type === "acceptWaiting" ? acceptWaitingModal() : extraBefore(type));

  Actions["switch-auto-accept"] = () => {
    const n = UI.modal ? UI.modal.waiting : waitingCount();
    UI.modal = null;
    // Orders left waiting at an earlier switch are accepted too: the flag only protects them from a later order.
    State.orders = State.orders.map((o) => (o.status === "new" && o.leftWaiting ? { ...o, leftWaiting: false } : o));
    saveBefore(); // the Round 7 save: Automatic, and every waiting order confirmed
    showToast(`Automatic confirmation on — ${plural(n)} accepted`);
  };
  Actions["switch-auto-leave"] = () => {
    const n = waitingCount();
    UI.modal = null;
    State.orders = State.orders.map((o) => (o.status === "new" ? { ...o, leftWaiting: true } : o));
    persist("orders");
    saveBefore(); // Automatic; the orders left waiting stay where they are
    showToast(`Automatic confirmation on — ${plural(n)} left waiting for Accept`);
  };
})();

/* ---------------- Later the same day: the store's side of an unavailable item as P10-2c built it (D62 a, D91) ---------------- */
/* In the real admin app (quickkart-api-service docs/08 §48): POST /admin/orders/:id/items/:itemId/unavailable
   { substituteProductId | noReplacement } (nothing = the product's default) — the first offer is made in the same call;
   …/offer changes an open offer; …/answered-by-phone { choice }. Marking and changing work only while the order is being
   picked or packed. The order panel's offer carries secondsLeft, ifNoAnswer and waitingFor. */
(function round12Unavailable() {
  const actorRef = () => ({ actorType: "user", actorId: (currentUser() || {}).id });
  const orderAudit = (action, id, before, after) =>
    addAuditEvent({ action, entity: "order", entityId: id, ...actorRef(), before, after, names: { entity: `#${id}` } });

  Object.assign(AUDIT_ACTION_TEXT, {
    "order.item_unavailable": ["Orders", "marked an item unavailable on order"],
    "order.offer_changed": ["Orders", "changed the offer for an unavailable item on order"],
    "order.answered_by_phone": ["Orders", "recorded a customer's phone answer on order"],
  });
  Object.assign(AUDIT_FIELD_LABEL, { item: "Item", replacement: "Replacement", choice: "Customer's answer" });

  /* A. "Not available" opens a small dialog: the replacement is chosen when the line is marked (the customer is told at
        once, with that offer) — it used to ask only "mark it?" and offer afterwards. Only while picking or packing. */
  const stockedHere = (o, exceptId) =>
    State.items.filter((i) => i.stock && i.id !== exceptId && (storeQty(o.branchId, i.id) || 0) > 0);
  const defaultAlt = (o, it) => {
    const cat = findItem(it.id);
    const alt = cat && cat.altId ? findItem(cat.altId) : null;
    return alt && alt.stock && (storeQty(o.branchId, alt.id) || 0) > 0 ? alt : null;
  };

  Actions["mark-item-unavailable"] = (el) => {
    UI.modal = { type: "markUnavailable", orderId: el.dataset.id, idx: Number(el.dataset.idx) };
    render();
  };

  function markUnavailableModal() {
    const m = UI.modal;
    const o = State.orders.find((x) => x.id === m.orderId);
    const it = o && o.items[m.idx];
    if (!it) return "";
    const cat = findItem(it.id);
    const alt = cat && cat.altId ? findItem(cat.altId) : null;
    const altOk = defaultAlt(o, it);
    const mins = Number(subSettings().answerMins) || 0;
    const others = stockedHere(o, it.id);
    const choice = m.choice || (altOk ? "default" : "none");
    // Each control has its own action: inside the dialog's "noop" the radio click would be cancelled.
    const radio = (value, disabled, body) =>
      `<label class="stock-toggle-lg"><input type="radio" name="muChoice" value="${value}" data-action="mu-set" ${choice === value ? "checked" : ""} ${disabled ? "disabled" : ""} /><span>${body}</span></label>`;
    return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>Not available · ${esc(it.name)}</span><button class="dialog-close" data-action="close-modal" aria-label="Close">${ic("close")}</button></div>
      <div class="dialog-body">
        <div class="qk-muted small" style="margin-bottom:10px">${it.qty} × ${esc(it.name)} on #${esc(o.id)}. The customer is told straight away with the offer you choose${mins ? ` and has <b>${mins} min</b> to answer` : " — there is no time limit, so the order waits for their answer or a phone call"}. You can change the offer until they answer.</div>
        ${radio("default", !altOk, `<b>${alt ? `Offer ${esc(alt.name)} (${money(alt.price)})` : "Offer the product's default substitute"}</b> <span class="qk-muted small">${alt ? (altOk ? "— this product's default substitute" : "— out of stock at this store") : "— this product has none"}</span>`)}
        ${radio("other", !others.length, `<b>Offer another product</b> <select class="input input-sm" id="muOther" data-action="mu-set" ${others.length ? "" : "disabled"}>${others.map((i) => `<option value="${i.id}" ${String(m.other) === String(i.id) ? "selected" : ""}>${esc(i.name)} (${money(i.price)})</option>`).join("")}</select> <span class="qk-muted small">— only products in stock at this store</span>`)}
        ${radio("none", false, `<b>No replacement — refund only</b> <span class="qk-muted small">— the customer chooses ${isCod(o) ? "to remove it and pay less" : "a wallet credit or a refund"}</span>`)}
        <div class="form-actions" style="margin-top:12px">
          <button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button>
          <button type="button" class="btn btn-primary" data-action="mark-unavailable-confirm">Mark unavailable &amp; tell the customer</button>
        </div>
      </div>
    </div>
  </div>`;
  }
  const extraBefore = extraModal;
  window.extraModal = (type) => (type === "markUnavailable" ? markUnavailableModal() : extraBefore(type));

  Actions["mu-set"] = (el) => {
    if (el.tagName === "SELECT") { UI.modal.other = el.value; UI.modal.choice = "other"; } else UI.modal.choice = el.value;
    render();
  };
  Actions["mark-unavailable-confirm"] = () => {
    const m = UI.modal;
    const o = State.orders.find((x) => x.id === m.orderId);
    const it = o && o.items[m.idx];
    if (!it) return;
    const choice = m.choice || (defaultAlt(o, it) ? "default" : "none");
    let request = null; // null = the product's own default stands
    let replacement = "None";
    if (choice === "default") {
      replacement = (defaultAlt(o, it) || {}).name || "None";
    } else if (choice === "other") {
      const alt = findItem(Number((document.getElementById("muOther") || {}).value));
      if (!alt) { showToast("Choose the replacement product", "danger"); return; }
      request = { altId: alt.id, altName: alt.name, altUnit: alt.unit, altPrice: alt.price, offeredAt: Date.now() };
      replacement = alt.name;
    } else {
      request = { refundOnly: true, offeredAt: Date.now() };
    }
    const idx = m.idx;
    State.orders = State.orders.map((x) => x.id !== o.id ? x : {
      ...x,
      // Ticked off, then found missing: there is nothing on the shelf to have picked.
      picked: { ...(x.picked || {}), [idx]: false },
      items: x.items.map((line, i) => i !== idx ? line : { ...line, unavailable: true, unavailableAt: Date.now(), ...(request ? { changeRequest: request } : {}) }),
    });
    persist("orders");
    pushNotice(`${it.name} is out of stock on order #${o.id}. ${replacement === "None" ? "The store has no replacement — you can choose a refund." : `The store suggests ${replacement}.`}`);
    orderAudit("order.item_unavailable", o.id, null, { item: it.name, replacement });
    UI.modal = null;
    showToast(`${it.name} marked unavailable — the customer has been told`, "danger");
    render();
  };

  /* B. The panel: the offer can be changed until it is answered (it used to lock after the first offer); the picker lists
        only products in stock at this store; "no time limit" is said in words; every line says who it waits for. */
  const rowBefore = adminOrderItemRow;
  window.adminOrderItemRow = function adminOrderItemRowR12(order, it, idx, editable) {
    if (!pendingLine(it)) return rowBefore(order, it, idx, editable);
    const req = it.changeRequest;
    const alt = offeredAlt(it);
    const left = minsLeft(it);
    const cod = isCod(order);
    const pickerOpen = UI.pickerFor && UI.pickerFor.orderId === order.id && UI.pickerFor.itemIdx === idx;
    const offer = req
      ? req.refundOnly ? "No replacement offered — refund only" : `Offered <b>${esc(req.altName)}</b> (${money(req.altPrice)})`
      : alt ? `Suggested <b>${esc(alt.name)}</b> (${money(alt.price)}) — the product's default` : "No replacement — refund only";
    const then = left != null
      ? ` · <span class="${left < 3 ? "tone-red" : ""}">${fmtDur(Math.max(0, left))} left</span>, then ${esc(noAnswerAction(order, it) === "swap" ? "swap" : RESOLUTION_TEXT[noAnswerAction(order, it)].toLowerCase())} automatically`
      : " · no time limit — waiting for their answer or a phone call";
    const btn = (action, label, cls, extra) => `<button class="btn ${cls} btn-sm" data-action="${action}" data-order="${order.id}" data-idx="${idx}" ${extra || ""}>${label}</button>`;
    const phone = (res, label) => btn("resolve-for-customer", label, "btn-outline", `data-res="${res}"`);
    return `
  <div class="oos-admin">
    <div class="row"><span><b>${it.qty} × ${esc(it.name)}</b> <span class="badge badge-red-soft">Unavailable</span></span><span>${money(it.price * it.qty)}</span></div>
    <div class="oos-admin-status">${ic("clock")} <span>${offer} — <b>waiting for the customer</b>${then}</span></div>
    ${!editable ? "" : `
    ${pickerOpen ? `
      <div class="oos-admin-offer">
        <select class="input" id="altPick-${order.id}-${idx}"><option value="">Choose a replacement…</option>${stockedHere(order, it.id).map((i) => `<option value="${i.id}">${esc(i.name)} (${money(i.price)})</option>`).join("")}</select>
        ${btn("send-change-request", req ? "Change to this" : "Offer it", "btn-primary")}
        ${btn("cancel-picker", "Cancel", "btn-outline")}
      </div>` : `
      <div class="form-actions">
        ${btn("open-alt-picker", req && !req.refundOnly ? "Offer another replacement" : "Offer a replacement", req ? "btn-outline" : "btn-primary")}
        ${!req || !req.refundOnly ? btn("send-change-request", "No replacement — refund only", "btn-outline", 'data-noalt="1"') : ""}
      </div>
      ${req ? `<div class="qk-muted small">Changing the offer tells the customer again and restarts their time.</div>` : ""}`}
    <div class="oos-admin-phone">
      <span class="small qk-muted">Customer answered by phone:</span>
      ${alt ? phone("swap", `Swap for ${esc(alt.name)}`) : ""}
      ${cod ? phone("removed", "Remove from bill") : `${phone("wallet", "Wallet refund")} ${phone("original", `Refund to ${esc(order.paymentMethod)}`)}`}
    </div>`}
  </div>`;
  };

  /* C. The audit log gets the three actions the backend records. */
  const changeBefore = Actions["send-change-request"];
  Actions["send-change-request"] = (el) => {
    const order = State.orders.find((o) => o.id === el.dataset.order);
    const idx = Number(el.dataset.idx);
    const before = order && order.items[idx] && order.items[idx].changeRequest;
    changeBefore(el);
    const after = ((State.orders.find((o) => o.id === el.dataset.order) || {}).items || [])[idx];
    const req = after && after.changeRequest;
    if (!req || req === before) return; // nothing was chosen
    orderAudit("order.offer_changed", order.id, { replacement: before ? (before.refundOnly ? "None" : before.altName) : "Default" }, { item: order.items[idx].name, replacement: req.refundOnly ? "None" : req.altName });
  };
  const phoneBefore = Actions["resolve-for-customer"];
  Actions["resolve-for-customer"] = (el) => {
    const order = State.orders.find((o) => o.id === el.dataset.order);
    const name = order && order.items[Number(el.dataset.idx)] && order.items[Number(el.dataset.idx)].name;
    phoneBefore(el);
    const line = ((State.orders.find((o) => o.id === el.dataset.order) || {}).items || [])[Number(el.dataset.idx)];
    if (order && line && line.resolution && line.resolvedBy === "store") {
      orderAudit("order.answered_by_phone", order.id, null, { item: name, choice: RESOLUTION_TEXT[line.resolution] });
    }
  };
})();

/* ---------------- Later the same day: assigning riders as P10-3 built it (D60, D92) ---------------- */
/* In the real admin app (docs/08 §49): GET /admin/orders/dispatch; GET …/:orderId/rider-options; POST …/:orderId/assign
   { partnerId, force? }; …/unassign; POST /admin/orders/assign { partnerId, orderIds, force? } with a result per order.
   The prototype's Round 4 / 7 dialog already matches most of it; these are the differences. */
(function round12AssignRiders() {
  const actorRef = () => ({ actorType: "user", actorId: (currentUser() || {}).id });
  const orderAudit = (action, id, before, after) =>
    addAuditEvent({ action, entity: "order", entityId: id, ...actorRef(), before, after, names: { entity: `#${id}` } });
  Object.assign(AUDIT_ACTION_TEXT, {
    "order.rider_assigned": ["Orders", "assigned a rider to order"],
    "order.rider_unassigned": ["Orders", "took the rider off order"],
  });
  Object.assign(AUDIT_FIELD_LABEL, { riderId: "Rider", forced: "Assigned anyway" });

  /* A. One suggestion, not two: the best match of the riders who can take it now (same slot +4, same area +2, free +1,
        waiting up to +0.9 — 0.015 a minute); riders who are switched off are not listed at all. */
  const fitBefore = riderFit;
  window.riderFit = (p, orders) => {
    const f = fitBefore(p, orders);
    if (f.load === 0) {
      const idle = riderIdleMinutes(p) || 0;
      f.score += Math.min(idle * 0.015, 0.9) - Math.min(idle / 120, 0.9);
    }
    return f;
  };
  window.assignCandidates = (orders) => {
    const branchId = orders[0] && orders[0].branchId;
    const fits = State.partners.filter((p) => p.branchId === branchId && p.active !== false).map((p) => riderFit(p, orders));
    const clear = fits.filter((f) => f.canTake).sort((a, b) => b.score - a.score || a.load - b.load || a.p.name.localeCompare(b.p.name));
    return {
      suggested: clear.slice(0, 1),
      available: clear.slice(1),
      cannot: fits.filter((f) => !f.canTake).sort((a, b) => Number(Boolean(a.onTrip)) - Number(Boolean(b.onTrip)) || b.free - a.free),
    };
  };

  /* B. Several orders and a rider with room for only some: besides "Assign anyway" (all of them), "Assign the first N" —
        the first ones go through and the rest stay waiting, as the backend's bulk call answers per order. */
  const rowBefore = assignRowHTML;
  window.assignRowHTML = (f, m) => {
    const html = rowBefore(f, m);
    const partial = m.ids.length > 1 && f.p.active !== false && f.online && !f.onTrip && f.free > 0 && f.need > f.free;
    if (!partial) return html;
    return html.replace(/<\/div>\s*$/, `<button type="button" class="link-btn as-force" data-action="assign-first-fit" data-partner="${f.p.id}">Assign the first ${f.free} only</button></div>`);
  };
  const modalBefore = assignRiderModal;
  window.assignRiderModal = () =>
    modalBefore().replace(
      "Suggested riders already carry the same slot and area, or are free and have waited longest.",
      "The suggested rider is the best match of those who can take it now: same slot, same area, free, waiting longest. A rider who is offline or full needs “Assign anyway”; a rider out on a trip can't be given anything. The rider is told in their app once it is built.",
    );

  /* C. The audit log gets every assignment and removal (who, from whom, and whether “Assign anyway” was used). */
  const riderName = (id) => (id ? (findPartner(id) || {}).name || null : null);
  const assignBefore = Actions["assign-rider"];
  Actions["assign-rider"] = (el) => {
    const ids = [...UI.modal.ids];
    const pid = Number(el.dataset.partner);
    const prev = new Map(State.orders.filter((o) => ids.includes(o.id)).map((o) => [o.id, o.deliveryPartnerId]));
    assignBefore(el);
    ids.forEach((id) => {
      const now = State.orders.find((o) => o.id === id);
      if (!now || now.deliveryPartnerId !== pid || prev.get(id) === pid) return;
      orderAudit("order.rider_assigned", id, { riderId: riderName(prev.get(id)) }, { riderId: riderName(pid), ...(el.dataset.force ? { forced: true } : {}) });
    });
  };
  const unassignBefore = Actions["unassign-rider"];
  Actions["unassign-rider"] = () => {
    const id = UI.modal.ids[0];
    const prev = (State.orders.find((o) => o.id === id) || {}).deliveryPartnerId;
    unassignBefore();
    const now = State.orders.find((o) => o.id === id);
    if (prev && now && !now.deliveryPartnerId) orderAudit("order.rider_unassigned", id, { riderId: riderName(prev) }, { riderId: null });
  };
  Actions["assign-first-fit"] = (el) => {
    const pid = Number(el.dataset.partner);
    const p = findPartner(pid);
    if (!p || riderOnTrip(pid)) return;
    const ids = [...UI.modal.ids];
    const room = Math.max(0, riderCapacity(p) - riderLoad(pid));
    const mine = ids.filter((id) => (State.orders.find((o) => o.id === id) || {}).deliveryPartnerId !== pid);
    const take = mine.slice(0, room);
    const left = mine.slice(take.length);
    const prev = new Map(State.orders.map((o) => [o.id, o.deliveryPartnerId]));
    assignOrders(take, pid);
    take.forEach((id) => orderAudit("order.rider_assigned", id, { riderId: riderName(prev.get(id)) }, { riderId: p.name }));
    UI.dispatchSel = UI.dispatchSel.filter((id) => !take.includes(id));
    UI.modal = null;
    showToast(`${take.length} assigned to ${p.name} · now ${riderLoad(pid)}/${riderCapacity(p)}${left.length ? ` — ${left.length} still waiting for a rider (${p.name} is full)` : ""}`, left.length ? "danger" : "success");
    render();
  };
})();

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Round 12 — confirmation switch, unavailable items, assigning riders", items: [
  ["Manual → Automatic asks", "Settings ▸ Delivery & Payments ▸ Order confirmation: switching from Manual to Automatic while orders wait for Accept now asks — \"Accept N orders and switch\" or \"Switch, leave them waiting\" (it used to accept them silently). With none waiting it saves straight away."],
  ["Orders left waiting", "They stay in \"New — accept\" (the stage stays on the Orders screen even in Automatic mode); orders placed afterwards still confirm themselves and never accept them."],
  ["The card's note", "It now says what happens, and in Automatic mode how many are still waiting."],
  ["Not available (P10-2c)", "The Not available button opens a dialog: offer the product's default substitute, another product in stock at this store, or no replacement — the customer is told at once with that offer. Only while the order is being picked or packed; a line already ticked off can still be marked (the tick comes off)."],
  ["Changing the offer", "An unavailable line's offer can be changed until the customer answers — another replacement, or none — which tells them again and restarts their time. The panel says who the line waits for and how long is left, or that there is no time limit."],
  ["Assigning riders (P10-3)", "One Suggested rider (the best match of those who can take it now); switched-off riders are not listed; a rider with room for only some of the selected orders also offers 'Assign the first N only'. Assigning, removing a rider, the phone answer and every unavailable-item change are in the audit log."],
] });
