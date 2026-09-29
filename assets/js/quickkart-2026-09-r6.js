/* ====================================================================
   QuickKart prototype — Round 6 (September 2026).

   A. Stock transfers are requests, not instant moves:
        short store: Request N from <store>
        other store: Accept & send (its stock goes down now) — or Decline, with a reason
        short store: Mark received (its stock goes up; the order line is settled)
      The Stock ▸ "Send to store" button uses the same flow (starts at "Sent").
   B. Unavailable items (substitution):
      - Setup ▸ Business Settings ▸ Stock Rules: wallet refund bonus %, how long
        the customer has to answer, and what happens if they don't.
      - Cash-on-delivery orders: swap, or remove the item and pay less at the
        door — never a wallet or card refund for money that wasn't paid.
      - The customer sees a countdown; when it runs out the default applies.
      - The store sees "Waiting for customer · N min left", what was chosen and
        by whom, and can record an answer given by phone.
      - An order can't be marked packed while an item waits for the customer
        or is still short.
   ==================================================================== */

/* ---------------- 1. Settings ---------------- */
const DEFAULT_SUBSTITUTION = { walletBonusPct: 10, answerMins: 10, noAnswer: "wallet" };
State.deliverySettings = { ...State.deliverySettings, substitution: { ...DEFAULT_SUBSTITUTION, ...(State.deliverySettings.substitution || {}) } };
function subSettings() { return State.deliverySettings.substitution; }
function walletBonusPct() { return Number(subSettings().walletBonusPct) || 0; }
const NO_ANSWER_LABEL = {
  wallet: "refund to the wallet",
  original: "refund to the original payment method",
  offered: "accept the store's replacement (if it costs the same or less), otherwise refund to the wallet",
};
function isCod(o) { return o.paymentMethod === "Cash on Delivery"; }

/* ---------------- 2. Unavailable lines ---------------- */
function offeredAlt(it) {
  if (it.changeRequest && it.changeRequest.refundOnly) return null;
  if (it.changeRequest && it.changeRequest.altId) return { id: it.changeRequest.altId, name: it.changeRequest.altName, unit: it.changeRequest.altUnit, price: it.changeRequest.altPrice, byStore: true };
  const cat = findItem(it.id);
  const alt = cat && cat.altId ? findItem(cat.altId) : null;
  return alt ? { id: alt.id, name: alt.name, unit: alt.unit, price: alt.price, byStore: false } : null;
}
function pendingLine(it) { return it.unavailable && !it.resolution; }
// The answer window starts when the customer was told (or when the store made an offer, which restarts it).
function lineDeadline(it) {
  const mins = Number(subSettings().answerMins) || 0;
  if (!mins) return null;
  const base = (it.changeRequest && it.changeRequest.offeredAt) || it.unavailableAt;
  return base ? base + mins * 60000 : null;
}
function minsLeft(it) { const d = lineDeadline(it); return d == null ? null : (d - Date.now()) / 60000; }
function noAnswerAction(o, it) {
  const pref = subSettings().noAnswer;
  if (pref === "offered") {
    const alt = offeredAlt(it);
    if (alt && alt.byStore && alt.price <= it.price) return "swap";
    return isCod(o) ? "removed" : "wallet";
  }
  if (isCod(o)) return "removed";
  return pref;
}
function noAnswerText(o, it) {
  const a = noAnswerAction(o, it);
  return a === "swap" ? `swap it for ${offeredAlt(it).name}` : a === "removed" ? "remove it from your bill" : a === "original" ? `refund it to ${o.paymentMethod}` : "refund it to your wallet";
}
const RESOLUTION_TEXT = { swap: "Swapped", wallet: "Refunded to wallet", original: "Refunded to payment method", removed: "Removed from the bill" };
const RESOLVED_BY_TEXT = { customer: "by the customer", store: "by the store (customer answered by phone)", auto: "automatically — no answer in time" };

/**
 * One place that settles an unavailable line, whoever decides: the customer, the store on
 * the customer's behalf, or the timer. Cash-on-delivery orders are never refunded money
 * that wasn't paid — "wallet"/"original" become "removed" (the customer pays less).
 * Returns { ok } or { ok: false, needsPayment } when a dearer swap must be paid first.
 */
function resolveLine(orderId, idx, requested, by, method) {
  const o = State.orders.find((x) => x.id === orderId);
  const it = o && o.items[idx];
  if (!it || !pendingLine(it)) return { ok: false };
  const cod = isCod(o);
  let res = requested;
  if (cod && (res === "wallet" || res === "original")) res = "removed";
  if (!cod && res === "removed") res = "wallet";
  const refund = round2(it.price * it.qty);
  let patch = {}, delta = 0, credit = 0, notice = "";
  if (res === "swap") {
    const alt = offeredAlt(it);
    if (!alt) return { ok: false };
    const diff = round2(alt.price * it.qty - refund);
    if (diff > 0.01 && !cod && !method) return { ok: false, needsPayment: diff };
    patch = { id: alt.id, name: alt.name, unit: alt.unit, price: alt.price, originalName: it.name };
    delta = diff;
    if (!cod && diff < -0.01) credit = -diff;
    notice = `${it.name} was replaced with ${alt.name} on order #${o.id}${diff > 0.01 ? cod ? ` — pay ${money(diff)} more at the door` : ` — ${money(diff)} paid via ${method}` : diff < -0.01 ? cod ? ` — you pay ${money(-diff)} less` : ` — ${money(-diff)} back to your wallet` : ""}.`;
  } else if (res === "wallet") {
    credit = round2(refund * (1 + walletBonusPct() / 100));
    delta = -refund;
    notice = `${money(credit)} credited to your wallet for ${it.name}${walletBonusPct() ? ` (includes a ${walletBonusPct()}% bonus)` : ""}.`;
  } else if (res === "original") {
    delta = -refund;
    notice = `${money(refund)} for ${it.name} will be refunded to your ${o.paymentMethod} within 3–5 business days.`;
  } else if (res === "removed") {
    delta = -refund;
    notice = `${it.name} was removed from order #${o.id} — you'll pay ${money(refund)} less at the door.`;
  }
  State.orders = State.orders.map((x) => x.id !== o.id ? x : {
    ...x, total: Math.max(0, round2(x.total + delta)),
    items: x.items.map((line, i) => i !== idx ? line : { ...line, ...patch, unavailable: false, resolution: res, resolvedAt: Date.now(), resolvedBy: by, ...(credit ? { creditAmount: credit } : {}) }),
  });
  if (credit) { State.wallet = round2(State.wallet + credit); persist("wallet"); }
  persist("orders");
  pushNotice(by === "auto" ? `No answer in time, so we chose for you: ${notice}` : notice);
  return { ok: true, res };
}
// Runs before every render: stamp when a line became unavailable, and apply the default once time is up.
function substitutionSweep() {
  let changed = false;
  State.orders.forEach((o) => {
    if (TERMINAL_STATUSES.includes(o.status)) return;
    o.items.forEach((it, idx) => {
      if (!pendingLine(it)) return;
      if (!it.unavailableAt) { it.unavailableAt = Date.now(); changed = true; return; }
      const d = lineDeadline(it);
      if (d != null && Date.now() >= d) resolveLine(o.id, idx, noAnswerAction(o, it), "auto");
    });
  });
  if (changed) persist("orders");
}

/* ---------------- 3. Customer app: the unavailable item ---------------- */
window.orderItemRowHTML = function (order, it, idx) {
  if (pendingLine(it)) {
    const alt = offeredAlt(it);
    const cod = isCod(order);
    const refund = round2(it.price * it.qty);
    const credit = round2(refund * (1 + walletBonusPct() / 100));
    const diff = alt ? round2((alt.price - it.price) * it.qty) : 0;
    const left = minsLeft(it);
    return `
    <div class="oos-order-item">
      <div class="oos-order-title">${ic("alert")} ${esc(it.name)} is out of stock</div>
      <div class="qk-muted small">${it.changeRequest && it.changeRequest.refundOnly ? "The store confirmed there's no replacement." : alt && alt.byStore ? "The store suggests this replacement:" : "Sorry about that. Choose what you'd like:"}</div>
      ${left != null ? `<div class="oos-timer">${ic("clock")} Please choose within <b>${fmtDur(Math.max(0, left))}</b> — otherwise we'll ${esc(noAnswerText(order, it))}.</div>` : ""}
      <div class="oos-order-actions">
        ${alt ? `<button class="btn btn-primary btn-sm" data-action="resolve-item" data-order="${order.id}" data-idx="${idx}" data-res="swap">Swap for ${esc(alt.name)} (${money(alt.price)})${diff > 0.01 ? ` — ${cod ? "pay" : "pay"} ${money(diff)} more` : diff < -0.01 ? cod ? ` — pay ${money(-diff)} less` : ` — get ${money(-diff)} back` : ""}</button>` : ""}
        ${cod ? `<button class="btn btn-outline btn-sm" data-action="resolve-item" data-order="${order.id}" data-idx="${idx}" data-res="removed">Remove it — pay ${money(refund)} less at the door</button>` : `
        <button class="btn btn-primary-soft btn-sm" data-action="resolve-item" data-order="${order.id}" data-idx="${idx}" data-res="wallet">Refund ${money(credit)} to wallet — instant${walletBonusPct() ? `, includes ${walletBonusPct()}% bonus` : ""}</button>
        <button class="btn btn-outline btn-sm" data-action="resolve-item" data-order="${order.id}" data-idx="${idx}" data-res="original">Refund ${money(refund)} to ${esc(order.paymentMethod)} (3–5 business days)</button>`}
      </div>
    </div>`;
  }
  const payQty = it.bogo ? Math.ceil(it.qty / 2) : it.qty;
  const res = it.resolution;
  const label = res === "swap" ? ` <span class="qk-muted small">(replaced ${esc(it.originalName || "")})</span>` : res ? ` <span class="qk-muted small">(${esc(RESOLUTION_TEXT[res] || "refunded").toLowerCase()}${it.creditAmount && res === "wallet" ? ` · ${money(it.creditAmount)}` : ""}${it.resolvedBy === "auto" ? " · chosen automatically" : ""})</span>` : "";
  const struck = res && res !== "swap";
  return `<div class="summary-row"><span class="${struck ? "oos-struck" : ""}">${it.qty} × ${esc(it.name)}${it.bogo ? ` <span class="badge badge-green">BOGO</span>` : ""}</span>${label ? `<span class="summary-row-note">${label}</span>` : ""}<span class="qk-num">${struck ? "—" : money(it.price * payQty)}</span></div>`;
};
// Customer choices and the "pay the difference" step go through resolveLine.
window.resolveUnavailable = function (order, itemIdx, resolution, method) {
  const r = resolveLine(order.id, itemIdx, resolution, "customer", method);
  if (!r.ok && r.needsPayment) { UI.payDiffFor = { orderId: order.id, itemIdx }; UI.modal = { type: "payDiff" }; render(); return; }
  UI.payDiffFor = null; UI.modal = null; render();
};

/* ---------------- 4. Admin order panel: the unavailable item ---------------- */
window.adminOrderItemRow = function (order, it, idx, editable) {
  if (!pendingLine(it)) {
    const res = it.resolution;
    if (!res) return `<div class="row"><span>${it.qty} × ${esc(it.name)}</span><span>${money(it.price * it.qty)}</span></div>`;
    return `<div class="row"><span>${it.qty} × ${esc(it.name)} <span class="badge badge-${res === "swap" ? "blue" : "gray"}-soft">${esc(RESOLUTION_TEXT[res])}</span></span><span class="small qk-muted">${esc(RESOLVED_BY_TEXT[it.resolvedBy] || "")}</span></div>`;
  }
  const alt = offeredAlt(it);
  const left = minsLeft(it);
  const pickerOpen = UI.pickerFor && UI.pickerFor.orderId === order.id && UI.pickerFor.itemIdx === idx;
  const cod = isCod(order);
  return `
  <div class="oos-admin">
    <div class="row"><span><b>${it.qty} × ${esc(it.name)}</b> <span class="badge badge-red-soft">Unavailable</span></span><span>${money(it.price * it.qty)}</span></div>
    <div class="oos-admin-status">
      ${ic("clock")} <span>${it.changeRequest ? it.changeRequest.altId ? `Offered <b>${esc(it.changeRequest.altName)}</b> (${money(it.changeRequest.altPrice)})` : "Told the customer there's no replacement" : "Customer has been asked to choose"} — <b>waiting for the customer</b>${left != null ? ` · <span class="${left < 3 ? "tone-red" : ""}">${fmtDur(Math.max(0, left))} left</span>, then ${esc(noAnswerAction(order, it) === "swap" ? "swap" : RESOLUTION_TEXT[noAnswerAction(order, it)].toLowerCase())} automatically` : " · no time limit"}</span>
    </div>
    ${!editable ? "" : `
    ${pickerOpen ? `
      <div class="oos-admin-offer">
        <select class="input" id="altPick-${order.id}-${idx}"><option value="">Choose a replacement…</option>${State.items.filter((i) => i.stock && i.id !== it.id).map((i) => `<option value="${i.id}">${esc(i.name)} (${money(i.price)})</option>`).join("")}</select>
        <button class="btn btn-primary btn-sm" data-action="send-change-request" data-order="${order.id}" data-idx="${idx}">Offer it</button>
        <button class="btn btn-outline btn-sm" data-action="cancel-picker">Cancel</button>
      </div>` : !it.changeRequest ? `
      <div class="form-actions">
        <button class="btn btn-primary btn-sm" data-action="open-alt-picker" data-order="${order.id}" data-idx="${idx}">Offer a replacement</button>
        <button class="btn btn-outline btn-sm" data-action="send-change-request" data-order="${order.id}" data-idx="${idx}" data-noalt="1">No replacement — refund only</button>
      </div>` : ""}
    <div class="oos-admin-phone">
      <span class="small qk-muted">Customer answered by phone:</span>
      ${alt ? `<button class="btn btn-sm btn-outline" data-action="resolve-for-customer" data-order="${order.id}" data-idx="${idx}" data-res="swap">Swap for ${esc(alt.name)}</button>` : ""}
      ${cod ? `<button class="btn btn-sm btn-outline" data-action="resolve-for-customer" data-order="${order.id}" data-idx="${idx}" data-res="removed">Remove from bill</button>`
        : `<button class="btn btn-sm btn-outline" data-action="resolve-for-customer" data-order="${order.id}" data-idx="${idx}" data-res="wallet">Wallet refund</button>
           <button class="btn btn-sm btn-outline" data-action="resolve-for-customer" data-order="${order.id}" data-idx="${idx}" data-res="original">Refund to ${esc(order.paymentMethod)}</button>`}
    </div>`}
  </div>`;
};

/* ---------------- 5. Transfer requests ---------------- */
State.transfers = loadLS("transfers", []);
PERSIST_KEYS.push("transfers");
const TRANSFER_STATUS = {
  requested: { label: "Requested", tone: "yellow" },
  sent: { label: "On the way", tone: "blue" },
  received: { label: "Received", tone: "green" },
  declined: { label: "Declined", tone: "red" },
  cancelled: { label: "Cancelled", tone: "gray" },
};
const DECLINE_REASONS = ["Not enough stock", "Needed for our own orders", "No one available to send it", "Other"];
function actorName() { return (currentUser() || {}).name || "Admin"; }
function saveTransfers() { persist("transfers"); }
function createTransfer({ fromId, toId, itemId, qty, orderId, idx, note, status }) {
  const t = { id: genId("TR"), createdAt: Date.now(), fromId, toId, itemId, qty, orderId: orderId || null, idx: idx == null ? null : idx, note: note || "", status: "requested", history: [{ status: "requested", at: Date.now(), by: actorName() }] };
  State.transfers = [t, ...State.transfers];
  if (status === "sent") sendTransfer(t.id, true);
  saveTransfers();
  return t;
}
function transferById(id) { return State.transfers.find((t) => t.id === id); }
function setTransfer(id, patch, status, extra) {
  State.transfers = State.transfers.map((t) => t.id !== id ? t : { ...t, ...patch, status, history: [...t.history, { status, at: Date.now(), by: actorName(), ...(extra || {}) }] });
  saveTransfers();
}
// Sending takes the stock out of the sending store right away.
function sendTransfer(id, silent) {
  const t = transferById(id);
  const have = storeQty(t.fromId, t.itemId) || 0;
  if (!allowNegativeStock() && have < t.qty) return `Only ${have} in stock at ${findBranch(t.fromId).name}`;
  recordStockMove({ branchId: t.fromId, itemId: t.itemId, type: "transfer_out", qty: -t.qty, ref: `To ${findBranch(t.toId).name}${t.orderId ? ` for #${t.orderId}` : ""}`, note: t.note });
  setTransfer(id, {}, "sent");
  return null;
}
// Receiving adds it to the receiving store; an order's short line is settled with it.
function receiveTransfer(id) {
  const t = transferById(id);
  recordStockMove({ branchId: t.toId, itemId: t.itemId, type: "transfer_in", qty: t.qty, ref: `From ${findBranch(t.fromId).name}${t.orderId ? ` for #${t.orderId}` : ""}`, note: t.note });
  const o = t.orderId ? State.orders.find((x) => x.id === t.orderId) : null;
  if (o && o.items[t.idx]) {
    const line = o.items[t.idx];
    const settle = Math.min(t.qty, line.short || 0);
    // With negative stock off the order only took what the store had, so these units go straight to it.
    if (settle && !allowNegativeStock()) recordStockMove({ branchId: t.toId, itemId: t.itemId, type: "sale", qty: -settle, ref: `Order #${o.id} (transfer received)` });
    State.orders = State.orders.map((x) => x.id !== o.id ? x : { ...x, items: x.items.map((l, i) => i !== t.idx ? l : { ...l, short: (l.short || 0) - settle, shortCovered: (l.shortCovered || 0) + settle, shortCoveredFrom: findBranch(t.fromId).name }) });
    persist("orders");
  }
  setTransfer(id, {}, "received");
}
function lineTransfers(o, idx) { return State.transfers.filter((t) => t.orderId === o.id && t.idx === idx); }
function activeLineTransfer(o, idx) { return lineTransfers(o, idx).find((t) => t.status === "requested" || t.status === "sent"); }
function shortLeftToRequest(o, idx) {
  const it = o.items[idx];
  const open = lineTransfers(o, idx).filter((t) => t.status === "requested" || t.status === "sent").reduce((n, t) => n + t.qty, 0);
  return Math.max(0, (it.short || 0) - open);
}
function transferCounts(branchIds) {
  const inScope = (id) => !branchIds || branchIds.includes(id);
  return {
    toSend: State.transfers.filter((t) => t.status === "requested" && inScope(t.fromId)).length,
    toReceive: State.transfers.filter((t) => t.status === "sent" && inScope(t.toId)).length,
    waiting: State.transfers.filter((t) => t.status === "requested" && inScope(t.toId)).length,
  };
}

/* The order panel's short line (replaces Round 5's instant transfer). */
window.shortLineHTML = function (o, it, idx, editable) {
  const history = lineTransfers(o, idx);
  const received = history.filter((t) => t.status === "received");
  const receivedHTML = received.length ? `<div class="short-line ok small">${ic("check")} ${received.reduce((n, t) => n + t.qty, 0)} received from ${esc([...new Set(received.map((t) => findBranch(t.fromId).name))].join(", "))}</div>` : "";
  if (!(it.short > 0) || it.unavailable || it.resolution) return receivedHTML;
  const active = activeLineTransfer(o, idx);
  const lastDeclined = history.filter((t) => t.status === "declined")[0];
  const need = shortLeftToRequest(o, idx);
  const near = nearbyStock(o, it.id);
  const scopeIds = scopedBranchIds();
  const canReceiveHere = !scopeIds || scopeIds.includes(o.branchId);
  return `
  ${receivedHTML}
  <div class="short-line small">
    <span class="tag tag-warn">Short ${it.short} at this store</span>
    ${active ? `
      <span class="tr-chip tr-${active.status}">${esc(TRANSFER_STATUS[active.status].label)}: ${active.qty} from ${esc(findBranch(active.fromId).name.replace("QuickKart ", ""))} · ${timeAgo(active.history[active.history.length - 1].at)}</span>
      ${editable && active.status === "requested" ? `<button type="button" class="link-btn small" data-action="transfer-cancel" data-id="${active.id}">Cancel request</button>` : ""}
      ${editable && active.status === "sent" && canReceiveHere ? `<button type="button" class="btn btn-sm btn-primary" data-action="transfer-receive" data-id="${active.id}">Mark received</button>` : ""}` : ""}
    ${lastDeclined && !active ? `<span class="tone-red">${esc(findBranch(lastDeclined.fromId).name.replace("QuickKart ", ""))} declined: ${esc(lastDeclined.declineReason || "")}</span>` : ""}
  </div>
  ${editable && need > 0 && !active && PREP_STATUSES.includes(o.status) ? `
  <div class="short-line small">
    ${near.length ? near.slice(0, 3).map((n) => `<button type="button" class="btn btn-sm btn-outline" data-action="transfer-request" data-order="${o.id}" data-idx="${idx}" data-from="${n.b.id}" data-qty="${Math.min(need, n.qty)}">Request ${Math.min(need, n.qty)} from ${esc(n.b.name.replace("QuickKart ", ""))} <span class="qk-muted">(has ${n.qty})</span></button>`).join("") : `<span class="qk-muted">No other store has it — mark it Not available so the customer can choose.</span>`}
  </div>` : ""}`;
};

/* Stock ▸ Transfers */
function transfersHTML(branchId) {
  const editable = canEdit(currentUser(), "inventory");
  const inScope = (id) => branchId == null || id === branchId;
  const all = State.transfers;
  const toSend = all.filter((t) => t.status === "requested" && inScope(t.fromId));
  const toReceive = all.filter((t) => t.status === "sent" && inScope(t.toId));
  const waiting = all.filter((t) => t.status === "requested" && inScope(t.toId));
  const outgoing = all.filter((t) => t.status === "sent" && inScope(t.fromId));
  const done = all.filter((t) => ["received", "declined", "cancelled"].includes(t.status) && (inScope(t.fromId) || inScope(t.toId))).slice(0, 30);
  const row = (t, actions) => {
    const item = findItem(t.itemId) || {};
    const last = t.history[t.history.length - 1];
    return `
    <div class="tr-row">
      <span class="tr-what"><b>${t.qty} × ${esc(item.name || "")}</b><span class="qk-muted small">${esc(item.sku || "")}${t.orderId ? ` · for order <button class="link-btn small" data-action="open-order" data-id="${t.orderId}">#${esc(t.orderId)}</button>` : ""}${t.note ? ` · ${esc(t.note)}` : ""}</span></span>
      <span class="small">${esc(findBranch(t.fromId).name.replace("QuickKart ", ""))} → ${esc(findBranch(t.toId).name.replace("QuickKart ", ""))}</span>
      <span><span class="tr-chip tr-${t.status}">${esc(TRANSFER_STATUS[t.status].label)}</span><span class="qk-muted small"> ${timeAgo(last.at)}${t.status === "declined" && t.declineReason ? ` · ${esc(t.declineReason)}` : ""}</span></span>
      <span class="tr-act">${editable ? actions : ""}</span>
    </div>
    ${UI.declineFor === t.id ? `
    <div class="tr-decline">
      <label class="small" for="declineReason">Why can't you send it?</label>
      <select class="input input-sm" id="declineReason">${DECLINE_REASONS.map((r) => `<option>${r}</option>`).join("")}</select>
      <button type="button" class="btn btn-sm btn-outline-danger" data-action="transfer-decline" data-id="${t.id}">Decline</button>
      <button type="button" class="link-btn small" data-action="transfer-decline-cancel">Back</button>
    </div>` : ""}`;
  };
  const section = (title, hint, list, actions) => `
  <div class="tr-section">
    <div class="rail-title">${title} <span class="qk-muted small">${list.length}</span></div>
    ${hint ? `<div class="qk-muted small" style="margin:-4px 0 6px">${hint}</div>` : ""}
    ${list.length ? list.map((t) => row(t, actions(t))).join("") : `<div class="qk-muted small tr-empty">Nothing here.</div>`}
  </div>`;
  return `
  <div class="admin-toolbar"><div class="qk-muted small">A transfer is a request between stores: the other store accepts and sends it (its stock goes down), then the receiving store marks it received (its stock goes up). Every step is in Stock history.</div></div>
  <div class="tr-grid">
    ${section("To send", "Other stores asked for these. Accepting takes the stock out of your store now.", toSend, (t) => `<button type="button" class="btn btn-sm btn-primary" data-action="transfer-accept" data-id="${t.id}">Accept &amp; send</button><button type="button" class="btn btn-sm btn-outline" data-action="transfer-decline-open" data-id="${t.id}">Decline</button>`)}
    ${section("To receive", "On the way to you. Mark received when it arrives.", toReceive, (t) => `<button type="button" class="btn btn-sm btn-primary" data-action="transfer-receive" data-id="${t.id}">Mark received</button>`)}
    ${section("Waiting on other stores", "You asked; they haven't answered yet.", waiting, (t) => `<button type="button" class="link-btn small" data-action="transfer-cancel" data-id="${t.id}">Cancel</button>`)}
    ${section("Sent by you", "", outgoing, () => "")}
    ${section("Done", "Last 30.", done, () => "")}
  </div>`;
}

/* ---------------- 6. Hooks into earlier rounds ---------------- */
(function wrapRound6() {
  // Sweep unavailable lines before every render (auto-resolve when time is up).
  const baseRender = window.render;
  window.render = function () { substitutionSweep(); baseRender(); };

  // Packing guard: nothing waiting for the customer, nothing still short.
  const setStatus = Actions["set-order-status"];
  Actions["set-order-status"] = (el) => {
    const o = State.orders.find((x) => x.id === el.dataset.id);
    const packing = el.dataset.status === "ready_for_rider" || (o && o.fulfillment === "pickup" && o.status === "packing" && el.dataset.status === "delivered");
    if (o && packing) {
      const waiting = o.items.filter(pendingLine).length;
      const short = orderShortLines(o).length;
      if (waiting || short) {
        showToast(`Can't mark it packed yet: ${[waiting ? `${waiting} item${waiting > 1 ? "s" : ""} waiting for the customer` : "", short ? `${short} item${short > 1 ? "s" : ""} still short` : ""].filter(Boolean).join(", ")}`, "danger");
        UI.orderDrawerId = o.id; UI.adminTab = "orders"; render(); return;
      }
    }
    setStatus(el);
  };

  // Needs action: say exactly what the order is waiting for.
  const reason = window.needsActionReason;
  window.needsActionReason = (o) => {
    const pending = o.items.find(pendingLine);
    if (pending) { const left = minsLeft(pending); return `Item unavailable — waiting for customer${left != null ? ` (${fmtDur(Math.max(0, left))} left)` : ""}`; }
    const shortLines = orderShortLines(o);
    if (shortLines.length && PREP_STATUSES.includes(o.status)) {
      const t = activeLineTransfer(o, shortLines[0].idx);
      if (t) return t.status === "sent" ? `Transfer on the way from ${findBranch(t.fromId).name.replace("QuickKart ", "")} — mark received` : `Waiting for ${findBranch(t.fromId).name.replace("QuickKart ", "")} to send the transfer`;
      return "Short at this store — request a transfer or mark unavailable";
    }
    return reason(o);
  };

  // Orders ▸ right rail: stock transfer counts.
  const rail = window.opsRailHTML;
  window.opsRailHTML = (inScope) => {
    const c = transferCounts(scopedBranchIds());
    return `
    <div class="rail-card">
      <div class="rail-title">Stock transfers <button type="button" class="link-btn small" data-action="open-transfers">Open</button></div>
      <div class="rail-stage"><span class="small">To send to other stores</span><span class="small ${c.toSend ? "tone-red" : "qk-muted"}"><b>${c.toSend}</b></span></div>
      <div class="rail-stage"><span class="small">On the way to us</span><span class="small"><b>${c.toReceive}</b></span></div>
      <div class="rail-stage"><span class="small">Waiting on other stores</span><span class="small"><b>${c.waiting}</b></span></div>
    </div>${rail(inScope)}`;
  };

  // Settings: substitution rules under Stock Rules.
  const rules = window.adminStockRulesPanel;
  window.adminStockRulesPanel = (editable) => `${rules(editable)}${substitutionCardHTML(editable)}`;
})();
function substitutionCardHTML(editable) {
  const s = subSettings();
  const dis = editable ? "" : "disabled";
  return `
  <div class="summary-card" style="max-width:560px;margin-top:16px">
    <div class="summary-card-title">When an item is unavailable</div>
    <div class="qk-muted small">The customer is asked to choose: a replacement, a wallet refund or a refund to how they paid. Cash-on-delivery customers choose a replacement or removing the item (they pay less at the door).</div>
    <div class="field-grid-2" style="margin-top:10px">
      <label class="field"><span class="field-label">Wallet refund bonus (%)</span><input class="input" type="number" min="0" max="50" id="subBonus" value="${s.walletBonusPct}" ${dis} /><span class="qk-muted small">Extra on top when they pick a wallet refund. 0 = no bonus.</span></label>
      <label class="field"><span class="field-label">Time to answer (minutes)</span><input class="input" type="number" min="0" max="120" id="subMins" value="${s.answerMins}" ${dis} /><span class="qk-muted small">0 = wait as long as it takes.</span></label>
    </div>
    <label class="field"><span class="field-label">If the customer doesn't answer in time</span>
      <select class="input" id="subNoAnswer" ${dis}>${Object.entries(NO_ANSWER_LABEL).map(([k, l]) => `<option value="${k}" ${s.noAnswer === k ? "selected" : ""}>${esc(l[0].toUpperCase() + l.slice(1))}</option>`).join("")}</select>
      <span class="qk-muted small">Cash-on-delivery orders: the item is removed from the bill instead of refunded.</span></label>
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-substitution">Save</button>` : ""}
  </div>`;
}

/* ---------------- 7. Handlers ---------------- */
Object.assign(Actions, {
  "resolve-for-customer"(el) {
    const r = resolveLine(el.dataset.order, Number(el.dataset.idx), el.dataset.res, "store", "the customer's payment method");
    showToast(r.ok ? `Recorded: ${RESOLUTION_TEXT[r.res]}` : "Couldn't record that choice", r.ok ? "success" : "danger");
    render();
  },
  "save-substitution"() {
    const bonus = Math.min(50, Math.max(0, Number(document.getElementById("subBonus").value) || 0));
    const mins = Math.min(120, Math.max(0, Math.floor(Number(document.getElementById("subMins").value) || 0)));
    State.deliverySettings = { ...State.deliverySettings, substitution: { walletBonusPct: bonus, answerMins: mins, noAnswer: document.getElementById("subNoAnswer").value } };
    persist("deliverySettings"); showToast(`Saved: ${bonus}% wallet bonus, ${mins ? `${mins} min to answer` : "no time limit"}`); render();
  },
  "open-transfers"() { UI.adminTab = "inventory"; UI.invTab = "transfers"; UI.orderDrawerId = null; render(); },
  "transfer-request"(el) {
    const o = State.orders.find((x) => x.id === el.dataset.order);
    const idx = Number(el.dataset.idx);
    const t = createTransfer({ fromId: Number(el.dataset.from), toId: o.branchId, itemId: o.items[idx].id, qty: Number(el.dataset.qty), orderId: o.id, idx });
    showToast(`Asked ${findBranch(t.fromId).name} for ${t.qty} × ${o.items[idx].name}`); render();
  },
  "transfer-accept"(el) {
    const err = sendTransfer(el.dataset.id);
    showToast(err || "Accepted — marked as sent", err ? "danger" : "success"); render();
  },
  "transfer-decline-open"(el) { UI.declineFor = el.dataset.id; render(); },
  "transfer-decline-cancel"() { UI.declineFor = null; render(); },
  "transfer-decline"(el) {
    const reason = document.getElementById("declineReason").value;
    setTransfer(el.dataset.id, { declineReason: reason }, "declined", { reason });
    UI.declineFor = null; showToast("Declined — the other store has been told"); render();
  },
  "transfer-receive"(el) { receiveTransfer(el.dataset.id); showToast("Received — stock added"); render(); },
  "transfer-cancel"(el) { setTransfer(el.dataset.id, {}, "cancelled"); showToast("Request cancelled"); render(); },
});
// When the store offers a replacement, the customer's answer window restarts (offeredAt is set by the offer).

/* ---------------- 8. What's changed ---------------- */
WHATS_NEW.unshift({ area: "Transfers & unavailable items (round 6)", items: [
  ["Stock transfers are requests", "Short store: 'Request N from <store>' in the order panel. The other store sees it in Masters ▸ Stock ▸ Transfers ▸ To send: 'Accept & send' (its stock goes down) or 'Decline' with a reason. The short store taps 'Mark received' (its stock goes up and the order line is settled). The order line shows Requested / On the way / Received / Declined. 'Send to store' from the Stock screen uses the same flow. Orders' right rail counts transfers to send / on the way / waiting."],
  ["Unavailable item settings", "Setup ▸ Business Settings ▸ Stock Rules ▸ 'When an item is unavailable': wallet refund bonus % (default 10), time to answer (default 10 min, 0 = no limit), and what happens if there's no answer (wallet refund / original payment / accept the store's replacement)."],
  ["Customer answer with a countdown", "The customer sees 'Please choose within N min — otherwise we'll …'. When time runs out the default is applied automatically and the customer gets a notice. Cash-on-delivery customers choose a swap or removing the item (pay less at the door); they're never offered a wallet or card refund for money they haven't paid."],
  ["Store side", "The order panel shows 'waiting for the customer · N min left, then … automatically', what was chosen and by whom (customer / store by phone / automatically), and buttons to record an answer the customer gave by phone. Needs action says exactly what each order waits for."],
  ["Packing guard", "An order can't be marked packed while an item is waiting for the customer or still short; the order panel opens instead."],
] });
