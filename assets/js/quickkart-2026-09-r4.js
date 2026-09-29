/* ====================================================================
   QuickKart prototype — Round 4 (September 2026): manual rider assignment.

   Automatic round robin is gone: it could not handle different vehicle
   sizes or delivery slots. The admin assigns riders, and the screen does
   the thinking: each rider's load against their vehicle's capacity, the
   slot and area they're already carrying, and how long they've waited.

   - A vehicle carries a number of orders per trip (Setup ▸ Business
     Settings ▸ Delivery & Payments, overridable per rider).
   - A rider can be assigned from "Confirmed" onwards and is required
     before "Out for delivery".
   - Orders for the same rider and slot are one trip in the rider app.
   - Two ways to assign: the Assign rider dialog (one order) and the
     Dispatch view on Orders (tick several orders, fill a vehicle).
   ==================================================================== */

/* ---------------- 1. Vehicles and capacity ---------------- */
if (!VEHICLE_TYPES.includes("Truck")) VEHICLE_TYPES.push("Truck");
const DEFAULT_VEHICLE_CAPACITY = { "Bicycle": 1, "On foot": 1, "Motorcycle": 2, "Car": 4, "Van": 10, "Truck": 25 };
State.deliverySettings = { ...State.deliverySettings, vehicleCapacity: { ...DEFAULT_VEHICLE_CAPACITY, ...(State.deliverySettings.vehicleCapacity || {}) } };
// Stages where an order can have a rider (assigned but not yet delivered).
const RIDER_STAGES = ["confirmed", "picking", "packing", "ready_for_rider", "picked_up"];
const ASSIGNABLE_STAGES = ["confirmed", "picking", "packing", "ready_for_rider"];
function riderCapacity(p) {
  if (p && p.capacity) return Number(p.capacity);
  return State.deliverySettings.vehicleCapacity[p && p.vehicle] || 1;
}
function riderOpenOrders(partnerId) {
  return State.orders.filter((o) => o.deliveryPartnerId === partnerId && RIDER_STAGES.includes(o.status) && o.fulfillment !== "pickup");
}
function riderLoad(partnerId) { return riderOpenOrders(partnerId).length; }
// "Online" now means the rider tapped Go online (the old ready queue) or is out on a trip.
function riderOnline(p) { return riderIsReady(p.id) || riderLoad(p.id) > 0; }
function tripKey(o) {
  if (orderKind(o) === "express") return "express";
  const w = o.slotKey ? o.slotKey.split("|") : null;
  return w ? `${w[1]}|${w[2]}` : "other";
}
function tripLabel(key) {
  if (key === "express") return "Express";
  if (key === "other") return "Scheduled";
  const [date, slotId] = key.split("|");
  const slot = State.slotSettings.templates.find((t) => t.id === slotId) || (slotsFor(0, date).find((t) => t.id === slotId));
  return slot ? `${slotDayLabel(date)} ${fmtSlotRange(slot)}` : slotDayLabel(date);
}
function sectorOf(o) { const p = postalOf(o); return p ? p.slice(0, 2) : ""; }
function riderIdleMinutes(p) {
  const delivered = State.orders.filter((o) => o.deliveryPartnerId === p.id && o.status === "delivered").map((o) => statusAt(o, "delivered") || o.createdAt);
  const since = Math.max(State.shiftStart[p.id] || 0, ...delivered, 0);
  return since ? (Date.now() - since) / 60000 : null;
}

// One-time demo fleet so every store has a mix of vehicles to choose from (prototype data only).
(function seedDemoFleet() {
  if (loadLS("migrated_2026_09_r4", false)) return;
  const fleet = [
    ["PTR-1004", "Hassan Ali", "Van", 1, "96110044"], ["PTR-1005", "Arjun Singh", "Bicycle", 1, "96110055"],
    ["PTR-1006", "Mei Ling Goh", "Car", 1, "96110066"], ["PTR-1007", "Kumar Raj", "Truck", 2, "96110077"],
    ["PTR-1008", "Daniel Teo", "Motorcycle", 2, "96110088"], ["PTR-1009", "Siti Rahim", "Car", 3, "96110099"],
  ];
  let id = nextId(State.partners);
  fleet.forEach(([code, name, vehicle, branchId, mobile]) => {
    if (State.partners.some((p) => p.code === code)) return;
    State.partners.push({ id: id++, code, name, mobile, email: "", vehicle, active: true, branchId });
  });
  // Most of them start online (the old "ready queue").
  const online = {};
  State.partners.forEach((p) => { if (p.active !== false && p.code !== "PTR-1009") (online[p.branchId] = online[p.branchId] || []).push(p.id); });
  State.readyQueue = { ...State.readyQueue, ...online };
  State.partners.forEach((p, i) => { if (online[p.branchId] && online[p.branchId].includes(p.id) && !State.shiftStart[p.id]) State.shiftStart[p.id] = Date.now() - (15 + i * 9) * 60000; });
  persist("partners"); persist("readyQueue"); persist("shiftStart");
  saveLS("migrated_2026_09_r4", true);
})();

/* ---------------- 2. How well a rider fits the orders being assigned ---------------- */
function riderFit(p, orders) {
  const carrying = riderOpenOrders(p.id);
  const load = carrying.length;
  const cap = riderCapacity(p);
  const need = orders.filter((o) => o.deliveryPartnerId !== p.id).length;
  const free = cap - load;
  const online = riderOnline(p);
  const active = p.active !== false;
  const riderTrips = new Set(carrying.map(tripKey));
  const wantTrips = new Set(orders.map(tripKey));
  const slotMatch = load > 0 && [...wantTrips].every((k) => riderTrips.has(k));
  const slotConflict = load > 0 && [...wantTrips].some((k) => !riderTrips.has(k));
  const areaMatch = load > 0 && orders.some((o) => carrying.some((c) => sectorOf(c) && sectorOf(c) === sectorOf(o)));
  const idle = load === 0 ? riderIdleMinutes(p) : null;
  const canTake = active && online && free >= need;
  const blocker = !active ? "Inactive" : !online ? "Offline" : free <= 0 ? "Full" : free < need ? `Room for ${free} only` : "";
  const notes = [];
  if (slotMatch) notes.push(`Same slot · ${tripLabel([...riderTrips][0])}`);
  if (areaMatch) notes.push(`same area S${orders.map(sectorOf).find(Boolean) || ""}`);
  if (load === 0 && online && idle != null) notes.push(`Waiting ${fmtDur(idle)}`);
  if (load === 0 && online && idle == null) notes.push("Online");
  const warning = slotConflict ? `Carrying the ${[...riderTrips].map(tripLabel).join(", ")} slot` : "";
  const score = (slotMatch ? 4 : 0) + (areaMatch ? 2 : 0) + (load === 0 ? 1 : 0) + Math.min((idle || 0) / 120, 0.9);
  return { p, load, cap, free, need, online, canTake, blocker, notes, warning, score, suggested: canTake && !slotConflict && (slotMatch || load === 0) };
}
function assignCandidates(orders) {
  const branchId = orders[0] && orders[0].branchId;
  const fits = State.partners.filter((p) => p.branchId === branchId).map((p) => riderFit(p, orders));
  const suggested = fits.filter((f) => f.suggested).sort((a, b) => b.score - a.score).slice(0, 2);
  const available = fits.filter((f) => f.canTake && !suggested.includes(f)).sort((a, b) => b.score - a.score);
  const cannot = fits.filter((f) => !f.canTake).sort((a, b) => (a.p.active === false) - (b.p.active === false) || b.free - a.free);
  return { suggested, available, cannot };
}

/* ---------------- 3. The Assign rider dialog (one order, or several from Dispatch) ---------------- */
function riderChipHTML(o) {
  const editable = canEdit(currentUser(), "orders");
  const rider = findPartner(o.deliveryPartnerId);
  if (o.fulfillment === "pickup") return `<span class="qk-muted small">Customer collects</span>`;
  const canChange = editable && ASSIGNABLE_STAGES.includes(o.status);
  const label = rider ? `${esc(rider.name)} · ${esc(rider.vehicle || "")} ${riderLoad(rider.id)}/${riderCapacity(rider)}` : o.status === "ready_for_rider" ? "No rider — assign now" : "Assign rider";
  if (!canChange) return rider ? `<span class="qk-muted small">${ic("truck")} ${esc(rider.name)}</span>` : "";
  return `<button type="button" class="rider-chip ${rider ? "has" : o.status === "ready_for_rider" ? "needs" : ""}" data-action="open-assign" data-id="${o.id}" aria-haspopup="dialog">${ic("truck")}<span>${label}</span>${ic("chevronDown")}</button>`;
}
function assignRowHTML(f, m) {
  const pct = Math.min(100, (f.load / f.cap) * 100);
  const confirming = m.confirmFor === f.p.id;
  const current = m.ids.length === 1 && State.orders.find((o) => o.id === m.ids[0]).deliveryPartnerId === f.p.id;
  return `
  <div class="as-row ${f.canTake ? "" : "is-off"} ${current ? "is-current" : ""}">
    <button type="button" class="as-pick" data-action="assign-rider" data-partner="${f.p.id}" ${f.canTake || confirming ? "" : "disabled"} aria-label="Assign ${esc(f.p.name)}">
      <span class="avatar">${esc(f.p.name.split(" ").map((w) => w[0]).slice(0, 2).join(""))}</span>
      <span class="as-main"><b>${esc(f.p.name)}</b> <span class="qk-muted">· ${esc(f.p.vehicle || "")}</span>${current ? ` <span class="badge badge-blue-soft">Current</span>` : ""}
        <span class="as-sub">${f.blocker ? `<span class="tone-red">${esc(f.blocker)}</span>` : esc(f.notes.join(" · "))}${f.warning ? ` <span class="tone-yellow">⚠ ${esc(f.warning)}</span>` : ""}</span>
      </span>
      <span class="as-load"><span class="load-num">${f.load}/${f.cap}</span><span class="load-bar ${f.free <= 0 ? "full" : ""}"><i style="width:${pct}%"></i></span></span>
    </button>
    ${!f.canTake && f.p.active !== false ? (confirming
      ? `<div class="as-confirm">${esc(f.p.name)} is ${esc(f.blocker.toLowerCase())}. Assign anyway? <button type="button" class="btn btn-sm btn-outline-danger" data-action="assign-rider" data-partner="${f.p.id}" data-force="1">Assign anyway</button> <button type="button" class="link-btn" data-action="assign-cancel-force">Cancel</button></div>`
      : `<button type="button" class="link-btn as-force" data-action="assign-ask-force" data-partner="${f.p.id}">Assign anyway…</button>`) : ""}
  </div>`;
}
function assignRiderModal() {
  const m = UI.modal;
  const orders = m.ids.map((id) => State.orders.find((o) => o.id === id)).filter(Boolean);
  if (!orders.length) return "";
  const c = assignCandidates(orders);
  const one = orders.length === 1 ? orders[0] : null;
  const slotEnds = orders.map(orderSlotWindow).filter(Boolean).map((w) => (w.endMs - Date.now()) / 60000).filter((mins) => mins < 25);
  const current = one && findPartner(one.deliveryPartnerId);
  const section = (title, list) => list.length ? `<div class="as-group">${title}</div>${list.map((f) => assignRowHTML(f, m)).join("")}` : "";
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static dialog-user" role="dialog" aria-modal="true" aria-labelledby="as-title" data-action="noop">
      <div class="dialog-head"><span id="as-title">${one ? `Assign rider · #${esc(one.id)}` : `Assign ${orders.length} orders`}</span><button class="dialog-close" data-action="close-modal" aria-label="Close">${ic("close")}</button></div>
      <div class="dialog-body">
        <div class="as-summary">
          ${[...new Set(orders.map(tripKey))].map((k) => `<span class="tag">${esc(tripLabel(k))}</span>`).join("")}
          ${[...new Set(orders.map(sectorOf).filter(Boolean))].map((s) => `<span class="tag">Area S${s}</span>`).join("")}
          <span class="qk-muted small">${orders.reduce((n, o) => n + orderUnits(o), 0)} units · ${esc((findBranch(orders[0].branchId) || {}).name || "")} riders</span>
        </div>
        ${slotEnds.length ? `<div class="notice notice-warn">${ic("alert")}<span>The slot ends in ${fmtDur(Math.max(0, Math.min(...slotEnds)))} — pick a rider who can leave now.</span></div>` : ""}
        ${section("Suggested", c.suggested)}
        ${section("Available", c.available)}
        ${section("Can't take it", c.cannot)}
        ${!c.suggested.length && !c.available.length && !c.cannot.length ? `<div class="empty-state"><div class="empty-title">No riders at this store</div><div class="empty-hint">Add one under Delivery Masters ▸ Delivery Partners.</div></div>` : ""}
        ${current ? `<button type="button" class="link-btn link-danger" data-action="unassign-rider" style="margin-top:10px">Remove ${esc(current.name)} from this order</button>` : ""}
        <div class="qk-muted small" style="margin-top:10px">Load = orders the rider holds now / what their vehicle carries per trip. Suggested riders already carry the same slot and area, or are free and have waited longest.</div>
      </div>
    </div>
  </div>`;
}

/* ---------------- 4. Dispatch view: tick orders, fill a vehicle ---------------- */
UI.dispatchSel = UI.dispatchSel || [];
function dispatchQueue() {
  return ordersBase().filter((o) => o.fulfillment !== "pickup" && ASSIGNABLE_STAGES.includes(o.status) && !o.deliveryPartnerId);
}
function ordersDispatchHTML() {
  const queue = dispatchQueue();
  UI.dispatchSel = UI.dispatchSel.filter((id) => queue.some((o) => o.id === id));
  const sel = new Set(UI.dispatchSel);
  const groups = new Map();
  queue.forEach((o) => { const k = tripKey(o); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); });
  const order = [...groups.keys()].sort((a, b) => (a === "express" ? -1 : b === "express" ? 1 : a.localeCompare(b)));
  const ids = scopedBranchIds();
  const riders = State.partners.filter((p) => p.active !== false && (!ids || ids.includes(p.branchId)));
  const selOrders = queue.filter((o) => sel.has(o.id));
  const multiStore = new Set(selOrders.map((o) => o.branchId)).size > 1;
  return `
  <div class="dispatch-grid">
    <section class="dispatch-col" aria-label="Orders waiting for a rider">
      <div class="rail-title">Waiting for a rider <span class="qk-muted small">${queue.length} order${queue.length === 1 ? "" : "s"}</span></div>
      ${queue.length ? order.map((k) => {
        const list = groups.get(k).slice().sort((a, b) => sectorOf(a).localeCompare(sectorOf(b)));
        const allOn = list.every((o) => sel.has(o.id));
        return `
        <div class="dq-group">
          <label class="dq-head"><input type="checkbox" ${allOn ? "checked" : ""} data-action="dispatch-toggle-group" data-key="${esc(k)}" aria-label="Select all in ${esc(tripLabel(k))}" /><b>${esc(tripLabel(k))}</b><span class="qk-muted small">${list.length} order${list.length === 1 ? "" : "s"}</span></label>
          ${list.map((o) => `
          <label class="dq-row ${sel.has(o.id) ? "on" : ""}">
            <input type="checkbox" ${sel.has(o.id) ? "checked" : ""} data-action="dispatch-toggle" data-id="${o.id}" aria-label="Select order ${esc(o.id)}" />
            <span class="dq-id"><b>#${esc(o.id)}</b><span class="stage-chip st-${o.status}">${esc(stageLabel(o.status))}</span></span>
            <span class="small">${esc(o.customerName)}</span>
            <span class="small qk-muted">S${sectorOf(o) || "?"} · ${orderUnits(o)} units${isCold(o) ? " · Chilled" : ""}</span>
            <button type="button" class="link-btn small" data-action="open-order" data-id="${o.id}">Open</button>
          </label>`).join("")}
        </div>`;
      }).join("") : `<div class="ops-empty">${ic("check")}<div class="empty-title">Every order has a rider</div><div class="empty-hint">Confirmed and packed orders without a rider appear here.</div></div>`}
    </section>
    <section class="dispatch-col" aria-label="Riders and their load">
      <div class="rail-title">Riders · load <span class="qk-muted small">orders now / per trip</span></div>
      ${riders.map((p) => {
        const load = riderLoad(p.id), cap = riderCapacity(p);
        const trips = [...new Set(riderOpenOrders(p.id).map(tripKey))].map(tripLabel);
        const room = cap - load;
        const fitsSel = selOrders.length && room >= selOrders.length && riderOnline(p) && !multiStore && selOrders.every((o) => o.branchId === p.branchId);
        return `
        <div class="dr-row ${fitsSel ? "fits" : ""}">
          <div class="dr-top"><b>${esc(p.name)}</b><span class="qk-muted small">${esc(p.vehicle || "")}</span><span class="load-num">${load}/${cap}</span></div>
          <span class="load-bar ${room <= 0 ? "full" : ""}"><i style="width:${Math.min(100, (load / cap) * 100)}%"></i></span>
          <div class="small qk-muted">${!riderOnline(p) ? "Offline" : trips.length ? `Carrying ${esc(trips.join(", "))}` : "Online · free"}${room <= 0 ? ` · <span class="tone-red">full</span>` : ""}</div>
        </div>`;
      }).join("") || `<div class="qk-muted small">No riders for this store.</div>`}
    </section>
  </div>
  <div class="dispatch-bar ${selOrders.length ? "" : "is-empty"}" role="region" aria-label="Assign selected orders">
    <span><b>${selOrders.length}</b> selected${selOrders.length ? ` · ${selOrders.reduce((n, o) => n + orderUnits(o), 0)} units` : " — tick orders that should travel together"}</span>
    ${multiStore ? `<span class="tone-yellow small">Selected orders are from different stores — pick one store's orders.</span>` : ""}
    <span class="dispatch-actions">
      ${selOrders.length ? `<button type="button" class="link-btn" data-action="dispatch-clear">Clear</button>` : ""}
      <button type="button" class="btn btn-primary btn-sm" data-action="dispatch-assign" ${selOrders.length && !multiStore ? "" : "disabled"}>${ic("truck")} Assign to a rider…</button>
    </span>
  </div>`;
}

/* ---------------- 5. Setup ▸ Business Settings ▸ Delivery: vehicle capacity ---------------- */
function vehicleCapacityCardHTML(editable) {
  const cap = State.deliverySettings.vehicleCapacity;
  return `
  <div class="summary-card" style="max-width:420px; margin-top:16px">
    <div class="summary-card-title">Vehicle capacity</div>
    <div class="qk-muted small">How many orders each vehicle carries on one trip. Used when assigning riders; you can override it for one rider in their profile.</div>
    <div class="cap-grid">
      ${VEHICLE_TYPES.map((v) => `<label class="field"><span class="field-label">${esc(v)}</span><input class="input" type="number" min="1" max="99" id="cap_${v.replace(/\W/g, "")}" value="${cap[v] || 1}" ${editable ? "" : "disabled"} /></label>`).join("")}
    </div>
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-vehicle-capacity">Save capacity</button>` : ""}
  </div>`;
}

/* ---------------- 6. Handlers ---------------- */
function assignOrders(ids, partnerId) {
  const p = findPartner(partnerId);
  State.orders = State.orders.map((o) => ids.includes(o.id) ? { ...o, deliveryPartnerId: partnerId, riderAssignedAt: Date.now() } : o);
  persist("orders");
  return p;
}
(function wrapRound4() {
  // A rider is required before "Out for delivery".
  const setStatus = Actions["set-order-status"];
  Actions["set-order-status"] = (el) => {
    const o = State.orders.find((x) => x.id === el.dataset.id);
    if (el.dataset.status === "__assign") { UI.modal = { type: "assignRider", ids: [el.dataset.id] }; render(); return; }
    if (o && el.dataset.status === "picked_up" && o.fulfillment !== "pickup" && !o.deliveryPartnerId) {
      showToast("Assign a rider before it goes out for delivery", "danger");
      UI.modal = { type: "assignRider", ids: [o.id] }; render(); return;
    }
    setStatus(el);
  };
  const extra = extraModal;
  window.extraModal = (type) => type === "assignRider" ? assignRiderModal() : extra(type);
  // Rider form: optional capacity override.
  const savePartner = Submits["save-partner"];
  Submits["save-partner"] = (form) => {
    const raw = new FormData(form).get("capacity");
    const before = State.partners.map((p) => p.id);
    const editingId = UI.modal && UI.modal.form && UI.modal.form.id;
    savePartner(form);
    if (UI.modal) return; // validation failed, the form is still open
    const id = editingId || State.partners.map((p) => p.id).find((x) => !before.includes(x));
    State.partners = State.partners.map((p) => p.id === id ? { ...p, capacity: raw ? Math.max(1, Math.floor(Number(raw))) : null } : p);
    persist("partners"); render();
  };
})();
// On the ready-to-dispatch stage without a rider, the next step is "Assign rider".
// (Assigned to window rather than declared, so it wraps Round 3's version instead of replacing it.)
const boardNextStepR3 = window.boardNextStep;
window.boardNextStep = function (o) {
  if (o.status === "ready_for_rider" && o.fulfillment !== "pickup" && !o.deliveryPartnerId) return { status: "__assign", label: "Assign rider" };
  return boardNextStepR3(o);
};
Object.assign(Actions, {
  "open-assign"(el) { UI.modal = { type: "assignRider", ids: [el.dataset.id] }; render(); },
  "assign-ask-force"(el) { UI.modal.confirmFor = Number(el.dataset.partner); render(); },
  "assign-cancel-force"() { UI.modal.confirmFor = null; render(); },
  "assign-rider"(el) {
    const ids = UI.modal.ids;
    const pid = Number(el.dataset.partner);
    const p = assignOrders(ids, pid);
    UI.dispatchSel = UI.dispatchSel.filter((id) => !ids.includes(id));
    UI.modal = null;
    showToast(`${ids.length === 1 ? `#${ids[0]}` : `${ids.length} orders`} → ${p.name} (${p.vehicle}) · now ${riderLoad(pid)}/${riderCapacity(p)}${el.dataset.force ? " — over capacity" : ""}`, el.dataset.force ? "danger" : "success");
    render();
  },
  "unassign-rider"() {
    const id = UI.modal.ids[0];
    State.orders = State.orders.map((o) => o.id === id ? { ...o, deliveryPartnerId: null, riderAssignedAt: null } : o);
    persist("orders"); UI.modal = null; showToast(`Rider removed from #${id}`); render();
  },
  "dispatch-toggle"(el) {
    const id = el.dataset.id;
    UI.dispatchSel = el.checked ? [...new Set([...UI.dispatchSel, id])] : UI.dispatchSel.filter((x) => x !== id);
    render();
  },
  "dispatch-toggle-group"(el) {
    const ids = dispatchQueue().filter((o) => tripKey(o) === el.dataset.key).map((o) => o.id);
    UI.dispatchSel = el.checked ? [...new Set([...UI.dispatchSel, ...ids])] : UI.dispatchSel.filter((x) => !ids.includes(x));
    render();
  },
  "dispatch-clear"() { UI.dispatchSel = []; render(); },
  "dispatch-assign"() { if (UI.dispatchSel.length) { UI.modal = { type: "assignRider", ids: [...UI.dispatchSel] }; render(); } },
  "save-vehicle-capacity"() {
    const cap = {};
    VEHICLE_TYPES.forEach((v) => { const el = document.getElementById(`cap_${v.replace(/\W/g, "")}`); cap[v] = Math.max(1, Math.floor(Number(el && el.value) || 1)); });
    State.deliverySettings = { ...State.deliverySettings, vehicleCapacity: cap };
    persist("deliverySettings"); showToast("Vehicle capacity saved"); render();
  },
});

/* ---------------- 7. What's changed ---------------- */
WHATS_NEW.unshift({ area: "Rider assignment (round 4)", items: [
  ["Manual assignment", "Automatic round robin is removed. The admin assigns riders from 'Confirmed' onwards; a rider is required before 'Out for delivery' (the Out-for-delivery step asks for one)."],
  ["Vehicle capacity", "Orders per trip by vehicle — Bicycle / On foot 1, Motorcycle 2, Car 4, Van 10, Truck 25 — in Setup ▸ Business Settings ▸ Delivery & Payments, with a per-rider override in the rider's profile. Truck added as a vehicle."],
  ["Assign rider dialog", "Opened from the rider chip on the order row, the order panel and board cards. Riders grouped Suggested / Available / Can't take it, each with load (3/10), vehicle, waiting time and slot. Suggested = already carrying the same slot and area with room, or free and waiting longest. Warnings for a different slot and a slot about to end. Full or offline riders need 'Assign anyway'. The current rider can be removed."],
  ["Dispatch view", "New view on Orders: orders waiting for a rider grouped by slot (express first, by postcode area), riders with load bars on the right. Tick orders (or a whole slot) and 'Assign to a rider…' lists only riders with room for all of them."],
  ["Trips in the rider app", "A rider sees all orders assigned to them, grouped into trips by slot and sorted by postcode; orders still being packed show as 'Being packed'. 'Ready for next order' is now 'Go online'."],
] });
