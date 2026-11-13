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

WHATS_NEW.unshift({ area: "Round 28 — no postal sector on the Orders screens (2026-11-13)", items: [
  ["Order lists", "Orders ▸ Queue (and the other order lists): the customer line shows the postal code and how long ago — the \"S(46)\" postal sector in front of it is gone."],
  ["Dispatch rows", "Orders ▸ Dispatch: a waiting order shows its units (and Chilled) — the \"S46\" postal sector is gone. The zone heading above the rows says where the orders go."],
  ["Assign rider dialog", "No \"Area S46\" tag at the top, and a rider's line no longer says \"same area S46\" — the zone at the top and the Zone rider / Out-of-zone / Loading this zone and slot tags cover it."],
] });
