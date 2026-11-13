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

/* Same day — a slimmer top on Orders (the user, 2026-11-13: two rows of boxes took more than half the screen before the
   first order; on a 1366 × 768 laptop no order showed at all). The Orders page is a work queue, so the list comes first:
   - The seven number boxes (Round 3) go. Live now = the stages added up, Riders = the Riders panel, At risk / late = the
     red rows and Needs action. What is shown nowhere else — orders today, packing time, on time, cash to collect —
     becomes one quiet "Today" line on the "Showing N of M orders" line (no extra height).
   - One stage bar across the full width (above the list and the side panel) is the only stage filter: Needs action
     (with how many are late or at risk), the stages, then All / Cancelled / Returned. The tabs row goes. The bar shows
     on Queue, By slot and Board — not on Dispatch and Returns, which have their own.
   - Search, filter chips and sort share one line when they fit (from 1366 wide); the chips wrap below on smaller screens.
   - The order card's button never covers the amount any more, and on a narrow list (a laptop with the side panel open)
     the amount and the button stack in the last column instead of running past the card. */
(function () {
  window.opsKpisHTML = () => "";
  window.opsPipelineHTML = () => ""; // the stage row and the tabs leave the list; stageBarHTML below replaces both

  function todayLineHTML() {
    const inScope = scopedOrders();
    const today = startOfToday();
    const yStart = today - 86400000, nowOffset = Date.now() - today;
    const todays = inScope.filter((o) => o.createdAt >= today);
    const ySame = inScope.filter((o) => o.createdAt >= yStart && o.createdAt < yStart + nowOffset).length;
    const open = inScope.filter((o) => !TERMINAL_STATUSES.includes(o.status));
    const packTimes = todays.map((o) => { const r = statusAt(o, "ready_for_rider") || (o.fulfillment === "pickup" ? statusAt(o, "delivered") : null); return r ? (r - o.createdAt) / 60000 : null; }).filter((x) => x != null);
    const avgPack = packTimes.length ? packTimes.reduce((a, b) => a + b, 0) / packTimes.length : null;
    const packTarget = STAGE_SLA_MIN.new + STAGE_SLA_MIN.confirmed + STAGE_SLA_MIN.picking;
    const deliveredToday = inScope.filter((o) => o.status === "delivered" && (statusAt(o, "delivered") || o.createdAt) >= today);
    const onTime = deliveredToday.filter((o) => {
      const at = statusAt(o, "delivered") || o.createdAt;
      const w = orderSlotWindow(o);
      if (w) return at <= w.endMs;
      if (orderKind(o) === "express") return at <= o.createdAt + (Math.max(...o.items.map((i) => i.eta || 20), 20) + (window.timingSettings ? timingSettings().expressBufferMins : 15)) * 60000;
      return true;
    }).length;
    const cod = open.filter((o) => orderPayStatus(o).key === "collect");
    const slow = avgPack != null && avgPack > packTarget;
    return `<span class="ops-today"><span class="ops-today-k">Today</span>
      <span title="${ySame} by this time yesterday"><b>${todays.length}</b> orders</span><i>·</i>
      <span>packed in <b class="${slow ? "tone-red" : ""}">${avgPack == null ? "—" : fmtDur(avgPack)}</b> (target ${packTarget}m)</span><i>·</i>
      <span><b>${onTime} of ${deliveredToday.length}</b> on time</span><i>·</i>
      <span><b>${money(cod.reduce((s, o) => s + o.total, 0))}</b> cash to collect</span>
    </span>`;
  }

  function stageBarHTML(base) {
    const cur = UI.adminOrderFilter || "action";
    const today = startOfToday();
    const open = base.filter((o) => !TERMINAL_STATUSES.includes(o.status));
    const late = open.filter((o) => { const s = orderSla(o); const t = orderTiming(o); return (s && s.state !== "ok") || (t && t.late); }).length;
    const action = base.filter(needsAction).length;
    const steps = PIPELINE.map(([k, label]) => {
      const list = k === "delivered" ? base.filter((o) => o.status === "delivered" && (statusAt(o, "delivered") || o.createdAt) >= today) : base.filter((o) => o.status === k);
      const slas = list.map(orderSla).filter(Boolean);
      const oldest = slas.length ? Math.max(...slas.map((s) => s.mins)) : null;
      const worst = slas.some((s) => s.state === "breach") ? "breach" : slas.some((s) => s.state === "risk") ? "risk" : "ok";
      const sub = k === "delivered" ? "today" : oldest != null ? `oldest ${fmtDur(oldest)}` : "";
      return `<button type="button" class="sb-step ${cur === k ? "active" : ""} ${list.length && k !== "delivered" ? "has-" + worst : ""}" data-action="admin-order-filter" data-filter="${k}" role="tab" aria-selected="${cur === k}" title="${esc(label)}">
        <span class="sb-label">${esc(label)}</span>
        <span class="sb-line"><span class="sb-count">${list.length}</span><span class="sb-sub">${sub}</span></span>
      </button>`;
    }).join("");
    const more = [["all", "All", base.length], ["cancelled", "Cancelled", base.filter((o) => o.status === "cancelled").length], ["returned", "Returned", base.filter((o) => o.status === "returned").length]]
      .map(([k, l, n]) => `<button type="button" class="sb-more-btn ${cur === k ? "active" : ""}" data-action="admin-order-filter" data-filter="${k}" role="tab" aria-selected="${cur === k}">${l} <span class="sb-more-n">${n}</span></button>`).join("");
    return `<div class="stagebar" role="tablist" aria-label="Orders">
      <button type="button" class="sb-action ${cur === "action" ? "active" : ""} ${action ? "urgent" : ""}" data-action="admin-order-filter" data-filter="action" role="tab" aria-selected="${cur === "action"}">
        <span class="sb-label">Needs action</span>
        <span class="sb-line"><span class="sb-count">${action}</span><span class="sb-sub">${late ? `${late} late<span class="sb-wide"> or at risk</span>` : "nothing late"}</span></span>
      </button>
      <div class="sb-steps">${steps}</div>
      <div class="sb-more">${more}</div>
    </div>`;
  }
  const barView = () => ["list", "slot", "board"].includes(F("orders").view || "list");

  // The Today numbers sit on the "Showing N of M orders" line (Board has no such line, so it gets one).
  const resultsBefore = window.ordersResultsHTML;
  window.ordersResultsHTML = function () {
    const html = resultsBefore.apply(this, arguments);
    if (!barView()) return html;
    const withLine = html.replace(/<div class="fcount">([\s\S]*?)<\/div>/, (m, inner) => `<div class="fcount fcount-row"><span>${inner}</span>${todayLineHTML()}</div>`);
    return withLine !== html ? withLine : `<div class="fcount fcount-row"><span></span>${todayLineHTML()}</div>${html}`;
  };

  // The stage bar goes above the list and the side panel; typing in the search box redraws it with the list.
  const screenBefore = window.adminOrdersV2;
  window.adminOrdersV2 = function () {
    let html = screenBefore.apply(this, arguments);
    if (barView()) html = html.replace('<div class="ops-grid">', `<div id="orders-stagebar">${stageBarHTML(ordersBase())}</div><div class="ops-grid">`);
    FILTER_RESULTS.orders = () => {
      const bar = document.getElementById("orders-stagebar");
      if (bar) bar.innerHTML = stageBarHTML(ordersBase());
      return ordersResultsHTML();
    };
    return html;
  };

  const style = document.createElement("style");
  style.textContent = `
  .ops-head { margin-bottom: 10px; }
  .ops-head-actions { margin-left: auto; }
  .ops-console .fbar { margin: 0 0 10px; }
  .ops-console .fsearch { flex: 1 1 190px; max-width: 300px; }
  .ops-console .fsearch-input { height: 36px; }
  .ops-console .fpills { flex: 0 0 auto; order: 1; gap: 6px; }
  /* Below ~1320 wide the chips no longer fit beside the search and sort: search and sort on one line, chips below. */
  @media (max-width: 1320px) { .ops-console .fpills { flex: 1 1 100%; order: 3; flex-wrap: wrap; } }
  .fcount-row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 16px; }
  .ops-today { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 2px 7px; color: var(--muted); }
  .ops-today b { color: var(--ink); }
  .ops-today b.tone-red { color: var(--sla-breach); }
  .ops-today i { font-style: normal; }
  .ops-today-k { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .stagebar { display: flex; align-items: stretch; background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin-bottom: 10px; }
  .sb-steps { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); flex: 1 1 auto; min-width: 0; border-left: 1px solid var(--line); }
  .sb-action, .sb-step { position: relative; display: flex; flex-direction: column; justify-content: center; gap: 1px; padding: 6px 10px 6px 18px; border: none; background: none; color: inherit; text-align: left; cursor: pointer; min-height: 52px; min-width: 0; transition: background-color .15s; }
  .sb-action { flex: 0 0 auto; padding-left: 14px; padding-right: 16px; }
  .sb-step + .sb-step::before { content: ""; position: absolute; left: -7px; top: 50%; width: 12px; height: 12px; border-top: 1px solid var(--line); border-right: 1px solid var(--line); background: inherit; transform: translateY(-50%) rotate(45deg); z-index: 1; }
  .sb-label { font-size: 11.5px; font-weight: 700; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .sb-line { display: flex; align-items: baseline; gap: 7px; min-width: 0; }
  .sb-count { font-size: 18px; font-weight: 800; line-height: 1.15; color: var(--ink); }
  .sb-sub { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sb-step:hover, .sb-action:hover { background: var(--bg); }
  .sb-step.active { background: var(--tint); box-shadow: inset 0 -3px 0 var(--primary); }
  .sb-step.has-risk .sb-sub { color: var(--sla-risk); font-weight: 700; }
  .sb-step.has-breach .sb-sub, .sb-step.has-breach .sb-count { color: var(--sla-breach); font-weight: 700; }
  .sb-action.urgent .sb-sub { color: var(--sla-breach); font-weight: 700; }
  .sb-action.active { background: var(--ink); }
  .sb-action.active .sb-label { color: #C9D2DE; }
  .sb-action.active .sb-count { color: #fff; }
  .sb-action.active.urgent .sb-sub { color: #FFB4B4; }
  .sb-action.active:not(.urgent) .sb-sub { color: #C9D2DE; }
  .sb-more { display: flex; align-items: center; gap: 2px; padding: 4px 8px; border-left: 1px solid var(--line); flex: 0 0 auto; }
  .sb-more-btn { border: none; background: none; padding: 5px 8px; border-radius: var(--r-pill); font-size: 12.5px; font-weight: 600; color: var(--muted); cursor: pointer; white-space: nowrap; }
  .sb-more-btn:hover { background: var(--bg); color: var(--ink); }
  .sb-more-btn.active { background: var(--ink); color: #fff; }
  .sb-more-n { font-weight: 800; }
  .sb-action:focus-visible, .sb-step:focus-visible, .sb-more-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
  @media (max-width: 1320px) { .sb-wide { display: none; } .sb-step { padding: 6px 6px 6px 15px; } .sb-more-btn { padding: 5px 6px; } }
  @media (max-width: 1100px) { .stagebar { flex-wrap: wrap; } .sb-steps { flex-basis: 100%; order: 3; border-left: none; border-top: 1px solid var(--line); } .sb-more { margin-left: auto; } }
  @media (max-width: 600px) { .sb-steps { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); } .sb-step + .sb-step::before { display: none; } }

  /* The order card: the button column was 132px but "Mark ready for rider" is 152px, so it covered the amount. The
     column is now 156px (fixed, so the columns still line up from card to card) … */
  .ops-list-col { container: orderlist / inline-size; }
  @media (min-width: 1101px) { .ops-row { grid-template-columns: 52px minmax(140px, 1.1fr) minmax(130px, 1fr) minmax(150px, 1.1fr) 118px 156px; } }
  /* … and on a narrow list the amount sits above the button in the last column, inside the card. */
  @container orderlist (min-width: 621px) and (max-width: 900px) {
    .ops-row { grid-template-columns: 48px minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr) 156px; grid-template-rows: auto auto; row-gap: 6px; }
    .ops-row > .sla-ring { grid-column: 1; grid-row: 1 / span 2; }
    .ops-row > .ops-id { grid-column: 2; grid-row: 1 / span 2; }
    .ops-row > .ops-cust { grid-column: 3; grid-row: 1 / span 2; }
    .ops-row > .ops-items { grid-column: 4; grid-row: 1 / span 2; }
    .ops-row > .ops-amt { grid-column: 5; grid-row: 1; align-self: end; align-items: flex-end; }
    .ops-row > .ops-act { grid-column: 5; grid-row: 2; align-self: start; justify-content: flex-end; }
    .ops-row > .ops-act:empty { display: none; }
    .ops-row > .ops-act .btn { width: auto; }
  }`;
  document.head.appendChild(style);
})();

WHATS_NEW.unshift({ area: "Round 28 — a slimmer top on Orders (2026-11-13)", items: [
  ["The list comes first", "The seven number boxes are gone, so the first order starts about a third of the way down (it was past half way; on a 1366 × 768 laptop no order showed at all)."],
  ["One stage bar", "Needs action (with how many are late or at risk), the stages, then All / Cancelled / Returned — one bar across the page, and it is also the filter. The tabs row under it is gone."],
  ["Today line", "Orders today, packing time against the target, deliveries on time and cash to collect sit in one line beside \"Showing N of M orders\". Live now, Riders and At risk were already on the page (the stages, the Riders panel, the red rows)."],
  ["Order card", "The button never covers the amount; on a laptop with the side panel open the amount and the button stack at the right of the card."],
] });
