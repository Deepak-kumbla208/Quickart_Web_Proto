/* ====================================================================
   QuickKart prototype — Round 18 (21 October 2026): THE DELIVERY
   PROMISE (backend decision D121, phase P20-1, MR !135; customer
   contract 0.23.0-draft).

   The backend now stores the time every order was promised for
   (`promisedAt`) and says, before the window is missed, whether it will
   be kept: `risk` = on time / at risk / late, from the shop's own stage
   targets — "at risk" when the stages still ahead (Preparing + Ready +
   Out for delivery by default) no longer fit before the promise. This
   round gives the admin prototype that third state and the two staff
   messages the backend sends.

   A. Orders — the timing badge (r3 `orderTiming`) gains AT RISK (amber):
      an open order whose remaining stage targets no longer fit before
      its due time, and which is not late yet. Express: "Due in 20 min ·
      at risk". Scheduled: the badge now counts down to the window's end
      for every stage ("Slot ends in 25 min" / "… · at risk") instead of
      only warning while packing; "Slot ended — not delivered" stays red.
      Pickup orders count their stages up to Ready (no rider leg). The
      stage targets are the thresholds — there is no new setting (D121).

   B. Message templates — four messages the backend added, in their
      places: "Delivery slot changed" and "Delivery running late"
      (customer, push) after the slot reminder; "Order at risk" and
      "Order late" (staff, push) before the rider's. Edited where the
      list lives (r11), like Rounds 16 and 17 edited earlier files.

   C. Delivery Slots ▸ orders in a slot — the note and the toast no
      longer say "the customer is not told": moving an order now gives
      it a new promise and pushes the customer (D121 5). Edited in r11.

   D. NOT in this round: the KPI tile "At risk / late" keeps the
      prototype's own stage-target rule; the real app reads the API's
      counts (`stages[].atRisk`, `today.atRisk`). Nothing about riders.
   ==================================================================== */

/* ---------------- A. The timing badge: at risk (D121) ---------------- */
// The stages still ahead of an order, by the shop's targets (STAGE_SLA_MIN is
// kept in step with Business Settings by r7). A pickup order has no rider leg.
const PROMISE_STAGE_ORDER = ["new", "confirmed", "picking", "ready_for_rider", "picked_up"];
function remainingTargetMins(o) {
  const from = PROMISE_STAGE_ORDER.indexOf(o.status);
  if (from < 0) return 0;
  const stages = PROMISE_STAGE_ORDER.slice(from);
  return stages
    .filter((s) => !(orderKind(o) === "pickup" && s === "picked_up"))
    .reduce((n, s) => n + (Number(STAGE_SLA_MIN[s]) || 0), 0);
}
// The time the order was promised for: the window's end, or placed + the longest
// item ETA + the express buffer — the same rule the backend freezes at placement.
function promisedAtMs(o) {
  const w = orderKind(o) === "scheduled" ? orderSlotWindow(o) : null;
  if (w) return w.endMs;
  const eta = Math.max(...o.items.map((i) => i.eta || 20), 20) + (window.timingSettings ? timingSettings().expressBufferMins : 15);
  return o.createdAt + eta * 60000;
}
// One short badge telling staff whether the order is on time — now with "at risk".
function orderTiming(o) {
  if (TERMINAL_STATUSES.includes(o.status)) return null;
  const now = Date.now();
  const age = (now - o.createdAt) / 60000;
  if (o.status === "new" && age > (window.timingSettings ? timingSettings().confirmAlertMins : 10)) return { late: true, tone: "red", label: `Not accepted · ${minsText(age)}` };
  const kind = orderKind(o);
  const due = promisedAtMs(o);
  const left = (due - now) / 60000;
  const atRisk = left >= 0 && left < remainingTargetMins(o);
  if (kind === "scheduled") {
    const w = orderSlotWindow(o);
    if (w) {
      if (now > w.endMs) return { late: true, tone: "red", label: "Slot ended — not delivered" };
      const base = `Slot ends in ${minsText(left)}`;
      return atRisk ? { late: false, atRisk: true, tone: "yellow", label: `${base} · at risk` } : { late: false, tone: "gray", label: `${base} (${slotDayLabel(w.date).toLowerCase()} ${fmtClock(w.slot.start)})` };
    }
  }
  if (kind === "express") {
    if (now > due) return { late: true, tone: "red", label: `Express overdue ${minsText((now - due) / 60000)}` };
    const base = `Due in ${minsText(left)}`;
    return atRisk ? { late: false, atRisk: true, tone: "yellow", label: `${base} · at risk` } : { late: false, tone: "blue", label: base };
  }
  if (kind === "pickup") {
    if (now > due) return { late: true, tone: "red", label: `Ready-by passed ${minsText((now - due) / 60000)}` };
    if (atRisk) return { late: false, atRisk: true, tone: "yellow", label: `Ready by ${fmtClock(new Date(due).toTimeString().slice(0, 5))} · at risk` };
    if (age > 60 && PREP_STATUSES.includes(o.status)) return { late: false, tone: "yellow", label: `Waiting ${minsText(age)}` };
  }
  return { late: false, tone: "gray", label: `Placed ${timeAgo(o.createdAt)}` };
}

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Round 18 — the delivery promise (D121)", items: [
  ["At risk, before late", "An order's timing badge turns amber — \"Due in 20 min · at risk\", \"Slot ends in 25 min · at risk\" — when the stages still ahead (the shop's own targets: Preparing, Ready, Out for delivery) no longer fit before the time the customer was promised. Red stays for late. The targets are the thresholds; there is no new setting."],
  ["Scheduled orders count down", "A scheduled order's badge now counts down to the end of its window at every stage, not only while it is being packed. Pickup orders count their stages up to Ready."],
  ["Two staff messages", "Message templates gains \"Order at risk (staff)\" and \"Order late (staff)\" — a push to the staff who handle that store's orders, sent by the backend's deadline watcher every 5 minutes, once per order and state. Reword or switch off like any other message."],
  ["Two customer messages", "\"Delivery slot changed\" (when the store moves an order — the customer is now told) and \"Delivery running late\" (a delivery order past its promised time, once)."],
  ["Moving an order tells the customer", "Delivery Slots ▸ the orders in a slot: the note and the toast no longer say the customer is not told — the move gives the order a new promised time and pushes the customer."],
] });
