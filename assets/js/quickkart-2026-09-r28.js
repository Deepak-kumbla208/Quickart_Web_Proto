/* Round 28 (2026-11-13): no postal sector on the Orders screens.
   "S46" was the first two digits of the delivery postal code — a rough "which part of town" hint from before
   Delivery Zones (Round 26). The zone now says where an order goes, and postal codes don't mark areas in every
   country, so the hint is dropped:
   - Orders ▸ Queue (and the other order lists): the customer line shows the postal code without "S(46)".
   - Orders ▸ Dispatch: a waiting order's row shows its units (and Chilled) without "S46 ·".
   - The Assign rider dialog: no "Area S46" tag at the top, and a rider's line no longer says "same area S46"
     (the zone and the zone tags say it instead). */
(function () {
  // Order list rows: Round 3 writes `S(<sector>) <postal code> · <time ago>`; keep the postal code and the time.
  const QUEUE_SECTOR = /(<span class="qk-muted small">)S\([0-9]{2}\) /;
  const row = window.opsRowHTML;
  window.opsRowHTML = function (o) {
    return row.apply(this, arguments).replace(QUEUE_SECTOR, (match, open) => open);
  };

  // Dispatch rows: Round 26 writes `S<sector> · <units> units`; keep everything after the sector.
  const SECTOR = /(<span class="small qk-muted">)S(?:[0-9]{2}|\?) · /g;
  const dispatch = window.ordersDispatchHTML;
  window.ordersDispatchHTML = function () {
    return dispatch.apply(this, arguments).replace(SECTOR, (match, open) => open);
  };

  // Assign rider dialog: drop Round 4's "Area S46" tag from the top line …
  const AREA_TAG = /<span class="tag">Area S[0-9]{2}<\/span>/g;
  const modal = window.assignRiderModal;
  window.assignRiderModal = function () {
    return modal.apply(this, arguments).replace(AREA_TAG, "");
  };
  // … and its "same area S46" note from each rider's line.
  const fit = window.riderFit;
  window.riderFit = (p, orders) => {
    const f = fit(p, orders);
    if (f && Array.isArray(f.notes)) f.notes = f.notes.filter((n) => !/^same area /i.test(n));
    return f;
  };
})();

/* Same day — who moves an order once it is ready (the user's decisions, 2026-11-13):
   - A DELIVERY order is picked up and delivered by the rider only, in the rider app (pickup photo, GPS check at the
     door, cash and earnings). Staff no longer get "Mark picked up" / "Mark delivered"; they assign or change the rider,
     and the existing recoveries stay: Close trip (Delivery Partners) and Delivery failed.
   - A PICKUP order (the customer collects at the store) is finished with ONE tap, "Hand over". */
(function () {
  const nextBefore = window.boardNextStep;
  window.boardNextStep = function (o) {
    const next = nextBefore(o);
    if (!next || next.status === "__assign") return next;
    if (o.fulfillment === "pickup") {
      return o.status === "ready_for_rider" ? { status: "delivered", label: "Hand over" } : next;
    }
    return next.status === "picked_up" || next.status === "delivered" ? null : next;
  };

  // The order panel says who takes the next step when it is the rider's.
  const RIDER_NOTE = `<div class="notice" style="margin:8px 0">${ic("truck")}<span>The rider picks this order up and delivers it in the rider app — their photo and location are the proof. If something goes wrong: change the rider, Close trip (Delivery Partners) or Delivery failed.</span></div>`;
  const drawer = window.orderDrawerHTML;
  window.orderDrawerHTML = function () {
    const html = drawer.apply(this, arguments);
    const o = State.orders.find((x) => x.id === UI.orderDrawerId);
    if (!o || !html || o.fulfillment === "pickup") return html;
    const ridersTurn = (o.status === "ready_for_rider" && o.deliveryPartnerId) || o.status === "picked_up";
    if (!ridersTurn || html.includes("The rider has this order.")) return html;
    return html.replace('<div class="drawer-actions">', `${RIDER_NOTE}<div class="drawer-actions">`);
  };
})();

WHATS_NEW.unshift({ area: "Round 28 — the rider's steps are the rider's (2026-11-13)", items: [
  ["Delivery orders", "Staff no longer mark a delivery order picked up or delivered — the rider does both in the rider app (photo at pickup, location at the door, cash). The order panel says so; staff can still change the rider, Close trip under Delivery Partners, or record Delivery failed."],
  ["Pickup orders", "One tap: \"Hand over\" finishes a pickup order when the customer collects it (it was \"Mark picked up\")."],
] });

WHATS_NEW.unshift({ area: "Round 28 — no postal sector on the Orders screens (2026-11-13)", items: [
  ["Order lists", "Orders ▸ Queue (and the other order lists): the customer line shows the postal code and how long ago — the \"S(46)\" postal sector in front of it is gone."],
  ["Dispatch rows", "Orders ▸ Dispatch: a waiting order shows its units (and Chilled) — the \"S46\" postal sector is gone. The zone heading above the rows says where the orders go."],
  ["Assign rider dialog", "No \"Area S46\" tag at the top, and a rider's line no longer says \"same area S46\" — the zone at the top and the Zone rider / Out-of-zone / Loading this zone and slot tags cover it."],
] });
