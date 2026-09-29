/* ====================================================================
   QuickKart prototype — Round 5 (September 2026).

   1. Vehicle types are the business's own list: add, rename, change the
      orders-per-trip capacity, remove (only when no rider uses it).
   2. An order always goes to the nearest store that delivers to the
      address — stock never blocks checkout or moves the order. When that
      store is short, the order line is flagged "Short" and the store
      decides: transfer the missing units from a nearby store (one tap), or
      mark the item unavailable (the customer then picks a swap or refund).
   ==================================================================== */

/* ---------------- 1. Vehicle types ---------------- */
function vehicleTypes() { return Object.keys(State.deliverySettings.vehicleCapacity); }
// The rider form, filters and exports read VEHICLE_TYPES — keep it in step with the business's list.
function syncVehicleTypes() { VEHICLE_TYPES.splice(0, VEHICLE_TYPES.length, ...vehicleTypes()); }
syncVehicleTypes();
function ridersUsing(name) { return State.partners.filter((p) => p.vehicle === name).length; }
function saveVehicleCapacity(map) {
  State.deliverySettings = { ...State.deliverySettings, vehicleCapacity: map };
  persist("deliverySettings");
  syncVehicleTypes();
}
function vehicleCapacityCardHTML(editable) {
  const cap = State.deliverySettings.vehicleCapacity;
  const err = UI.vehicleTypeError;
  return `
  <div class="summary-card vt-card" style="max-width:520px; margin-top:16px">
    <div class="summary-card-title">Vehicle types</div>
    <div class="qk-muted small">Your fleet's vehicle types and how many orders each carries on one trip. Riders pick one of these; you can still override the capacity for one rider in their profile.</div>
    <div class="vt-table" role="table" aria-label="Vehicle types">
      <div class="vt-row vt-head" role="row"><span role="columnheader">Vehicle</span><span role="columnheader">Orders per trip</span><span role="columnheader">Riders</span><span></span></div>
      ${vehicleTypes().map((v, i) => {
        const used = ridersUsing(v);
        return `
        <div class="vt-row" role="row">
          <input class="input input-sm" id="vt_name_${i}" data-orig="${esc(v)}" value="${esc(v)}" maxlength="30" aria-label="Vehicle name" ${editable ? "" : "disabled"} />
          <input class="input input-sm" id="vt_cap_${i}" type="number" min="1" max="99" value="${cap[v]}" aria-label="Orders per trip for ${esc(v)}" ${editable ? "" : "disabled"} />
          <span class="small qk-num">${used}</span>
          ${editable ? `<button type="button" class="icon-btn icon-btn-danger" data-action="remove-vehicle-type" data-name="${esc(v)}" ${used || vehicleTypes().length <= 1 ? `disabled title="${used ? `${used} rider(s) use ${esc(v)} — move them to another vehicle first` : "Keep at least one vehicle type"}"` : ""} aria-label="Remove ${esc(v)}">${ic("trash")}</button>` : "<span></span>"}
        </div>`;
      }).join("")}
    </div>
    ${editable ? `
    <div class="vt-add">
      <input class="input input-sm" id="vt_new_name" maxlength="30" placeholder="New vehicle, e.g. E-scooter" aria-label="New vehicle name" />
      <input class="input input-sm" id="vt_new_cap" type="number" min="1" max="99" placeholder="Orders" aria-label="Orders per trip for the new vehicle" />
      <button type="button" class="btn btn-outline btn-sm" data-action="add-vehicle-type">${ic("plus")} Add</button>
    </div>
    ${err ? `<div class="field-error">${esc(err)}</div>` : ""}
    <button class="btn btn-primary btn-block" data-action="save-vehicle-types" style="margin-top:10px">Save changes</button>` : ""}
  </div>`;
}

/* ---------------- 2. "Short at this store" ---------------- */
function orderShortLines(o) {
  return o.items.map((it, idx) => ({ it, idx })).filter(({ it }) => it.short > 0 && !it.unavailable && !it.resolution);
}
// Other active stores that have the item, nearest first.
function nearbyStock(o, itemId) {
  const here = findBranch(o.branchId);
  return State.branches
    .filter((b) => b.active && b.id !== o.branchId && (storeQty(b.id, itemId) || 0) > 0 && branchStockFor(b.id, itemId).stock)
    .map((b) => ({ b, qty: storeQty(b.id, itemId), km: here ? haversineKm(here.lat, here.lng, b.lat, b.lng) : 0 }))
    .sort((a, c) => a.km - c.km);
}
function shortLineHTML(o, it, idx, editable) {
  if (!(it.short > 0) || it.unavailable || it.resolution) return it.shortCoveredFrom ? `<div class="short-line ok small">${ic("check")} ${it.shortCovered} transferred from ${esc(it.shortCoveredFrom)}</div>` : "";
  const near = nearbyStock(o, it.id);
  const best = near.find((n) => n.qty >= it.short) || near[0];
  return `
  <div class="short-line small">
    <span class="tag tag-warn">Short ${it.short} at this store</span>
    ${near.length ? `<span class="qk-muted">${near.slice(0, 2).map((n) => `${esc(n.b.name.replace("QuickKart ", ""))} has ${n.qty}`).join(" · ")}</span>` : `<span class="qk-muted">No other store has it</span>`}
    ${editable && best && PREP_STATUSES.includes(o.status) ? `<button type="button" class="btn btn-sm btn-outline" data-action="transfer-for-order" data-order="${o.id}" data-idx="${idx}" data-from="${best.b.id}">Transfer ${Math.min(it.short, best.qty)} from ${esc(best.b.name.replace("QuickKart ", ""))}</button>` : ""}
  </div>`;
}
(function wrapRound5() {
  // A short line needs the store's decision, so the order lands in "Needs action".
  const needs = window.needsAction;
  window.needsAction = (o) => needs(o) || (PREP_STATUSES.includes(o.status) && orderShortLines(o).length > 0);
  const reason = window.needsActionReason;
  window.needsActionReason = (o) => { const r = reason(o); return r && r !== "Confirm this order" ? r : orderShortLines(o).length && PREP_STATUSES.includes(o.status) ? "Short at this store — transfer or mark unavailable" : r; };
})();

/* ---------------- 3. Handlers ---------------- */
Object.assign(Actions, {
  "add-vehicle-type"() {
    const name = String((document.getElementById("vt_new_name") || {}).value || "").trim();
    const cap = Math.floor(Number((document.getElementById("vt_new_cap") || {}).value));
    const exists = vehicleTypes().some((v) => v.toLowerCase() === name.toLowerCase());
    UI.vehicleTypeError = !name ? "Give the vehicle a name" : exists ? `${name} already exists` : !(cap >= 1 && cap <= 99) ? "Orders per trip must be 1–99" : null;
    if (UI.vehicleTypeError) { render(); return; }
    saveVehicleCapacity({ ...State.deliverySettings.vehicleCapacity, [name]: cap });
    showToast(`${name} added — ${cap} order${cap === 1 ? "" : "s"} per trip`); render();
  },
  "remove-vehicle-type"(el) {
    const name = el.dataset.name;
    if (ridersUsing(name) || vehicleTypes().length <= 1) return;
    const map = { ...State.deliverySettings.vehicleCapacity }; delete map[name];
    UI.vehicleTypeError = null; saveVehicleCapacity(map); showToast(`${name} removed`); render();
  },
  "save-vehicle-types"() {
    const rows = vehicleTypes().map((orig, i) => ({ orig, name: String(document.getElementById(`vt_name_${i}`).value || "").trim(), cap: Math.floor(Number(document.getElementById(`vt_cap_${i}`).value)) }));
    const names = rows.map((r) => r.name.toLowerCase());
    UI.vehicleTypeError = rows.some((r) => !r.name) ? "Every vehicle needs a name" : names.some((n, i) => names.indexOf(n) !== i) ? "Two vehicles have the same name" : rows.some((r) => !(r.cap >= 1 && r.cap <= 99)) ? "Orders per trip must be 1–99" : null;
    if (UI.vehicleTypeError) { render(); return; }
    const map = {};
    rows.forEach((r) => { map[r.name] = r.cap; });
    // A renamed vehicle stays on the riders who had it.
    const renamed = rows.filter((r) => r.name !== r.orig);
    if (renamed.length) { State.partners = State.partners.map((p) => { const r = renamed.find((x) => x.orig === p.vehicle); return r ? { ...p, vehicle: r.name } : p; }); persist("partners"); }
    saveVehicleCapacity(map); showToast("Vehicle types saved"); render();
  },
});

/* ---------------- 4. What's changed ---------------- */
WHATS_NEW.unshift({ area: "Vehicle types & nearest store (round 5)", items: [
  ["Vehicle types", "Setup ▸ Business Settings ▸ Delivery & Payments ▸ Vehicle types: add your own (e.g. E-scooter, Mini truck) with orders per trip, rename (riders keep it), change capacity, remove when no rider uses it. The rider form, filters and assign screens use this list."],
  ["Order goes to the nearest store", "Checkout never blocks or re-routes because of stock: the order always goes to the nearest store that delivers to the address (pickup: the chosen store)."],
  ["Short at this store", "If that store doesn't have enough, the line is flagged 'Short N at this store' (stock stops at zero, or goes negative if allowed). The order lands in Needs action with a 'Short at store' tag and filter. In the order panel the store sees which nearby stores have it and can request a transfer (round 6), or mark the item unavailable (swap / refund flow)."],
] });
