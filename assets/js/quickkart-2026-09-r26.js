/* ====================================================================
   MyShopza prototype — Round 26 (2026-11-06): DELIVERY ZONES and
   SMART DISPATCH. A proposal for the user to confirm — nothing is in
   the backend yet (no decision, no plan step, no API).

   Agreed with the user on 2026-11-06, after studying the van-sales tool
   "I Fortigo" (its Route Definition: an ordered line of map points plus
   the users allowed on it) and how delivery platforms do it (Swiggy's
   logistic zones, Zepto / Blinkit batching, Onfleet teams, Spoke and
   Upper drawn zones):

   - The drawn areas are DELIVERY ZONES. "Route" stays the stop order of
     one trip, which the backend already works out (express, slot,
     nearest next).
   - A zone has ONE list of riders, all equal; a rider may be in several
     zones. When none of them is free, any free rider of the store is
     suggested, marked OUT-OF-ZONE. The admin can always assign anyone.
   - Zones of one store never overlap and stay inside its delivery circle.
   - SMART DISPATCH decides in this order:
       1. the promised time — never suggest a rider who would be late;
       2. the zone's riders before out-of-zone riders;
       3. fair turns — the rider first back to the store goes next (the
          store's ready queue); a tie goes to fewer deliveries per hour
          online today;
       4. filling the trip — orders of the same zone and slot go
          together, up to the rider's capacity (vehicle orders per trip
          or the rider's own override). An order for a zone and slot a
          rider is already loading at the store joins that trip while
          there is room: it does not use a new turn.
   - A per-shop mode: Manual / Suggest (default) / Auto.

   A. Delivery Masters ▸ Delivery Zones (was "Routes · to discuss"): a
      street map per store with its delivery circle; draw a zone by
      clicking its corners; code, name, colour, riders, on / off; the
      orders waiting now as dots. Map: Leaflet + OpenStreetMap, loaded
      only on this screen.
   B. An order takes the zone its delivery pin falls in (here the
      prototype's demo pin near the store, `r15Pin`); outside every zone
      it is "No zone" and any rider of the store can take it.
   C. Orders ▸ Dispatch: the mode banner, Suggested trips ("zone · slot ·
      N orders → rider", Assign trip / Choose rider…), orders grouped by
      slot then zone, riders with their turn, zones and deliveries / hour.
   D. Assign rider dialog: each rider marked Zone rider / Out-of-zone,
      their turn, deliveries today, and the estimate ("arrives ~6:42 PM"
      or "~8 min late"). Choosing a rider who was not suggested asks
      first (Suggest / Auto) and is marked in the audit log.
   E. Business Settings ▸ Delivery & Payments ▸ Riders & fleet: Smart
      dispatch (the mode and the minutes per drop).
   F. Delivery Partners: each rider's zones. Order drawer: the order's
      zone. Rider app: the zone name on every stop.

   The estimate: when the orders will be packed (the shop's own stage
   targets), then the stops in the trip's usual order at 20 km/h in a
   straight line plus the minutes per drop; a scheduled order is not
   delivered before its window opens. No Google calls (that question
   stays open). The real backend would check shapes with a geometry
   library (Turf.js); the checks below are the prototype's own.
   ==================================================================== */

/* ---------------- 1. Data: zones, settings, small helpers ---------------- */
const R26_COLOURS = ["#2563EB", "#16A34A", "#D97706", "#7C3AED", "#DB2777", "#0D9488", "#DC2626", "#4B5563"];
const R26_SPEED_KMH = 20;   // the backend's fixed assumed speed (the rider ETA rule)
const r26R6 = (x) => Math.round(x * 1e6) / 1e6;
const r26Clock = (ms) => fmtClock(new Date(ms).toTimeString().slice(0, 5));
// A time with its day when it isn't today: "9:15 PM yesterday", "9:15 PM, 4 Nov".
function r26When(ms) {
  const day = (x) => { const d = new Date(x); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const diff = Math.round((day(Date.now()) - day(ms)) / 86400000);
  if (diff === 0) return r26Clock(ms);
  if (diff === 1) return `${r26Clock(ms)} yesterday`;
  if (diff === -1) return `${r26Clock(ms)} tomorrow`;
  return `${r26Clock(ms)}, ${new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}
// Minutes as people read them: "12 min", "1 h 20 min", "13 h", "2 days" — never "1149 min".
function r26Dur(min) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  if (m < 1440) { const h = Math.floor(m / 60), r = m % 60; return h < 10 && r ? `${h} h ${r} min` : `${Math.round(m / 60)} h`; }
  const d = Math.round(m / 1440);
  return `${d} day${d === 1 ? "" : "s"}`;
}
const r26Order = (id) => State.orders.find((o) => o.id === id);
function r26Rules() {
  const r = State.businessRules || {};
  return { mode: ["manual", "suggest", "auto"].includes(r.dispatchMode) ? r.dispatchMode : "suggest", dropMin: Number(r.dropMinutes) || 3 };
}

State.zones = loadLS("zones", null);
// Demo zones, once: three wedges around each store (north, east, south), inside its circle; the west is left open so
// some orders show as "No zone". Each zone gets two of the store's riders, so a rider is in two zones.
(function r26SeedZones() {
  if (Array.isArray(State.zones)) return;
  const NAMES = {
    1: [["TAM-N", "Pasir Ris side"], ["TAM-E", "Simei & Changi"], ["TAM-S", "Bedok side"]],
    2: [["JW-N", "Tengah side"], ["JW-E", "Jurong East side"], ["JW-S", "Boon Lay & Pioneer"]],
    3: [["AMK-N", "Yishun side"], ["AMK-E", "Serangoon side"], ["AMK-S", "Bishan side"]],
  };
  const WEDGES = [[-45, 45], [45, 150], [150, 250]];   // degrees from north, clockwise; 250°–315° stays open
  const zones = [];
  let id = 1;
  State.branches.forEach((b) => {
    const names = NAMES[b.id] || [[`S${b.id}-N`, "North"], [`S${b.id}-E`, "East"], [`S${b.id}-S`, "South"]];
    const riders = State.partners.filter((p) => p.branchId === b.id && p.active !== false).map((p) => p.id);
    const r = Math.min(0.036, (Number(b.radiusKm) || 6) * 0.9 / 111);   // ≈ 4 km, always inside the circle
    const k = Math.cos(b.lat * Math.PI / 180);
    WEDGES.forEach(([from, to], i) => {
      const points = [[r26R6(b.lat), r26R6(b.lng)]];
      for (let s = 0; s <= 6; s++) {
        const a = (from + (to - from) * s / 6) * Math.PI / 180;
        points.push([r26R6(b.lat + r * Math.cos(a)), r26R6(b.lng + r * Math.sin(a) / k)]);
      }
      const riderIds = riders.length ? [...new Set([riders[i % riders.length], riders[(i + 1) % riders.length]])] : [];
      zones.push({ id: id++, branchId: b.id, code: names[i][0], name: names[i][1], colour: R26_COLOURS[i], active: true, points, riderIds, createdAt: Date.now() });
    });
  });
  State.zones = zones;
  persist("zones");
})();

/* ---------------- 2. Geometry (a flat km grid around the store — fine at city scale) ---------------- */
const r26Proj = (points, lat0) => points.map(([lat, lng]) => [lng * Math.cos(lat0 * Math.PI / 180) * 111.32, lat * 110.57]);
const r26Orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const R26_EPS = 1e-9;
// Two segments cross properly; touching at an end or running along each other is not a crossing.
function r26Cross(a, b, c, d) {
  const o1 = r26Orient(a, b, c), o2 = r26Orient(a, b, d), o3 = r26Orient(c, d, a), o4 = r26Orient(c, d, b);
  return ((o1 > R26_EPS && o2 < -R26_EPS) || (o1 < -R26_EPS && o2 > R26_EPS)) && ((o3 > R26_EPS && o4 < -R26_EPS) || (o3 < -R26_EPS && o4 > R26_EPS));
}
// Where a point is: "in", "on" the border, or "out".
function r26Where(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    const onLine = Math.abs(r26Orient(a, b, p)) <= R26_EPS
      && p[0] >= Math.min(a[0], b[0]) - R26_EPS && p[0] <= Math.max(a[0], b[0]) + R26_EPS
      && p[1] >= Math.min(a[1], b[1]) - R26_EPS && p[1] <= Math.max(a[1], b[1]) + R26_EPS;
    if (onLine) return "on";
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? "in" : "out";
}
function r26SelfCross(P) {
  const n = P.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (r26Cross(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return true;
    }
  }
  return false;
}
// Two zones share some area. Sharing a border (a line or a corner) is fine.
function r26Overlap(P, Q) {
  for (let i = 0; i < P.length; i++) {
    for (let j = 0; j < Q.length; j++) {
      if (r26Cross(P[i], P[(i + 1) % P.length], Q[j], Q[(j + 1) % Q.length])) return true;
    }
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const centre = (A) => [A.reduce((s, p) => s + p[0], 0) / A.length, A.reduce((s, p) => s + p[1], 0) / A.length];
  const probe = (A, B) => A.some((p) => r26Where(p, B) === "in")
    || A.some((p, i) => r26Where(mid(p, A[(i + 1) % A.length]), B) === "in")
    || r26Where(centre(A), B) === "in";
  return probe(P, Q) || probe(Q, P);
}
function r26AreaKm2(P) {
  let s = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}
// What is wrong with a shape, in words. `active` false skips the overlap check (an off zone may overlap).
function r26ShapeErrors(points, branchId, ignoreId, active) {
  const b = findBranch(branchId);
  if (!b) return ["Pick a store first."];
  if (points.length < 3) return ["Draw at least 3 corners."];
  const errs = [];
  if (points.length > 100) errs.push("A zone can have at most 100 corners.");
  const P = r26Proj(points, b.lat);
  if (r26SelfCross(P)) errs.push("The zone's lines cross each other — undo the last corners and draw it again, going around the area in order.");
  const out = points.filter(([lat, lng]) => haversineKm(lat, lng, b.lat, b.lng) > Number(b.radiusKm) + 1e-6).length;
  if (out) errs.push(`${out} corner${out === 1 ? " is" : "s are"} outside ${b.name}'s ${b.radiusKm} km delivery circle — keep the zone inside it.`);
  if (active) {
    const hit = State.zones.filter((z) => z.branchId === branchId && z.active && z.id !== ignoreId && r26Overlap(P, r26Proj(z.points, b.lat)));
    if (hit.length) errs.push(`It overlaps ${hit.map((z) => z.code).join(", ")} — zones of one store can't overlap. Move the shared border.`);
  }
  return errs;
}

/* ---------------- 3. The zone of an order ---------------- */
function r26Inside(o, z) {
  const b = findBranch(o.branchId);
  if (!b || z.branchId !== o.branchId) return false;
  const pin = r15Pin(o);
  return r26Where(r26Proj([[pin.lat, pin.lng]], b.lat)[0], r26Proj(z.points, b.lat)) !== "out";
}
// The backend stamps it when the order is placed (and again for waiting orders when zones are saved).
function r26ZoneOf(o) {
  if (!o || o.fulfillment === "pickup") return null;
  return State.zones.find((z) => z.active && r26Inside(o, z)) || null;
}
const r26ZoneText = (z) => (z ? `${z.code} · ${z.name}` : "No zone");
const r26Dot = (z) => `<i class="r26-dot" style="background:${z ? z.colour : "#9CA3AF"}"></i>`;
const r26ZoneChip = (z) => `<span class="r26-chip">${r26Dot(z)}${esc(r26ZoneText(z))}</span>`;
const r26RiderZone = (o) => { const z = r26ZoneOf(o); return z ? `${r26Dot(z)}${esc(z.name)} · ` : ""; };

/* ---------------- 4. Smart dispatch: turns, the estimate, the ranking ---------------- */
// Free = online, at the store, holding nothing, and nothing stops them (trip, break, cash).
function r26Free(p) {
  return p.active !== false && r15Online(p.id) && riderLoad(p.id) === 0 && !riderOnTrip(p.id) && !r15Tr(p.id) && !r15OnBreak(p.id) && r15Cash(p.id).state !== "over";
}
function r26Today(p) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const n = State.orders.filter((o) => o.deliveryPartnerId === p.id && o.status === "delivered" && (statusAt(o, "delivered") || o.createdAt) >= start.getTime()).length;
  const since = Math.max(start.getTime(), State.shiftStart[p.id] || Date.now());
  const hours = Math.max(0.5, (Date.now() - since) / 3600000);
  return { n, perHour: Math.round((n / hours) * 10) / 10 };
}
// Turn 1 = the free rider first back to the store: the store's ready queue order; riders not in it come after, longest
// waiting first; a tie goes to fewer deliveries per hour online today.
function r26Turns(branchId) {
  const q = State.readyQueue[branchId] || [];
  const pos = (p) => (q.indexOf(p.id) >= 0 ? q.indexOf(p.id) : 1000);
  const riders = State.partners.filter((p) => p.branchId === branchId && r26Free(p));
  riders.sort((a, b) => pos(a) - pos(b)
    || Math.round(riderIdleMinutes(b) || 0) - Math.round(riderIdleMinutes(a) || 0)
    || r26Today(a).perHour - r26Today(b).perHour
    || a.name.localeCompare(b.name));
  return new Map(riders.map((p, i) => [p.id, i + 1]));
}
// Minutes of store work still ahead before an order can leave (the shop's stage targets, less time already spent).
const R26_STORE_STAGES = ["new", "confirmed", "picking"];
function r26ReadyInMin(o) {
  const i = R26_STORE_STAGES.indexOf(o.status);
  if (i < 0) return 0;
  const spent = Math.max(0, (Date.now() - (statusAt(o, o.status) || o.createdAt)) / 60000);
  const current = Math.max(2, (Number(STAGE_SLA_MIN[o.status]) || 0) - spent);
  return current + R26_STORE_STAGES.slice(i + 1).reduce((n, s) => n + (Number(STAGE_SLA_MIN[s]) || 0), 0);
}
// The soonest anyone could reach this customer: the packing left, then straight from the store.
function r26SoonestMs(o) {
  const b = findBranch(o.branchId);
  let t = Date.now() + r26ReadyInMin(o) * 60000 + (b ? (r15Meters({ lat: b.lat, lng: b.lng }, r15Pin(o)) / 1000 / R26_SPEED_KMH) * 3600000 : 0);
  const w = orderKind(o) === "scheduled" ? orderSlotWindow(o) : null;
  if (w && t < w.startMs) t = w.startMs;
  return t;
}
// Minutes an order will be late whoever takes it (its promised time has passed, or packing and the drive alone take too long).
const r26MissedMin = (o) => Math.max(0, Math.ceil((r26SoonestMs(o) - promisedAtMs(o)) / 60000));
function r26MissedText(o) {
  const at = r26When(promisedAtMs(o));
  return promisedAtMs(o) <= Date.now() ? `already past its promised time (${at})` : `can't make its promised time (${at}) whoever takes it`;
}
// One run of a trip: leave when the last order is packed, then express → slot by slot → nearest next, minutes at each door.
function r26Run(b, list) {
  if (!list.length) return [];
  const drop = r26Rules().dropMin;
  let t = Date.now() + Math.max(0, ...list.map(r26ReadyInMin)) * 60000;
  const groups = new Map();
  list.forEach((o) => { const k = tripKey(o); groups.set(k, [...(groups.get(k) || []), o]); });
  const keys = [...groups.keys()].sort((a, c) => (a === "express" ? -1 : c === "express" ? 1 : a.localeCompare(c)));
  let at = { lat: b.lat, lng: b.lng };
  const stops = [];
  keys.forEach((k) => {
    const rest = [...groups.get(k)];
    while (rest.length) {
      rest.sort((x, y) => r15Meters(at, r15Pin(x)) - r15Meters(at, r15Pin(y)));
      const o = rest.shift(), pin = r15Pin(o);
      t += (r15Meters(at, pin) / 1000 / R26_SPEED_KMH) * 3600000;
      const w = orderKind(o) === "scheduled" ? orderSlotWindow(o) : null;
      if (w && t < w.startMs) t = w.startMs;   // never before the window opens
      stops.push({ o, arriveMs: t, lateMin: Math.max(0, Math.ceil((t - promisedAtMs(o)) / 60000)) });
      t += drop * 60000;
      at = pin;
    }
  });
  return stops;
}
// When each customer would be reached if this rider took these orders (with what they already hold at the store).
// lateMin counts only the lateness this choice causes: a new order's own lateness (unless it is late whoever takes
// it), and the extra minutes it adds to the orders the rider already holds — not lateness those already had.
function r26Estimate(p, orders) {
  const b = findBranch(orders[0].branchId) || findBranch(p.branchId);
  const held = riderOpenOrders(p.id).filter((o) => o.status !== "picked_up" && !orders.some((x) => x.id === o.id));
  const stops = r26Run(b, [...held, ...orders]);
  const alone = new Map(r26Run(b, held).map((s) => [s.o.id, s.lateMin]));
  stops.forEach((s) => {
    s.mine = !held.includes(s.o);
    s.missed = s.mine && r26MissedMin(s.o) > 0;
    s.causedMin = !s.mine ? Math.max(0, s.lateMin - (alone.get(s.o.id) || 0)) : s.missed ? 0 : s.lateMin;
  });
  const mine = stops.filter((s) => s.mine);
  const most = (list) => Math.max(0, ...list.map((s) => s.causedMin));
  return {
    stops,
    lateMin: most(stops),                                  // decides "on time"
    ownLateMin: most(mine),                                // the new orders' own lateness this rider causes
    heldLateMin: most(stops.filter((s) => !s.mine)),       // lateness added to the rider's other orders
    missed: mine.filter((s) => s.missed).map((s) => s.o),  // late whoever takes them → the soonest rider
    lastMs: Math.max(...mine.map((s) => s.arriveMs)),
  };
}
// One tag for a rider's estimate (the Assign rider dialog).
function r26EstTag(est, p) {
  if (est.ownLateMin > 0) return `<span class="r26-tag late">~${esc(r26Dur(est.ownLateMin))} late</span>`;
  if (est.heldLateMin > 0) return `<span class="r26-tag late">+${esc(r26Dur(est.heldLateMin))} late for ${esc(p.name)}'s other orders</span>`;
  if (est.missed.length) return `<span class="tone-yellow">Arrives ~${esc(r26When(est.lastMs))} · past the promised time</span>`;
  return `<span class="tone-green">Arrives by ~${esc(r26Clock(est.lastMs))}</span>`;
}
// Why the earliest rider still isn't on time (the dialog notice and the Dispatch card).
function r26LateText(f) {
  const e = f.r26.est;
  return e.ownLateMin > 0
    ? `the earliest is ${f.p.name}, about ${r26Dur(e.ownLateMin)} late`
    : `${f.p.name} could take it, but it would add about ${r26Dur(e.heldLateMin)} of lateness to the orders ${f.p.name} already has`;
}
function r26Info(p, orders) {
  const zones = [...new Set(orders.map(r26ZoneOf))].filter(Boolean);
  const zoneRider = zones.every((z) => z.riderIds.includes(p.id));
  const held = riderOpenOrders(p.id).filter((o) => o.status !== "picked_up" && !orders.includes(o));
  const z0 = r26ZoneOf(orders[0]), k0 = tripKey(orders[0]);
  const loadingSame = held.length > 0 && !riderOnTrip(p.id) && held.every((h) => tripKey(h) === k0 && r26ZoneOf(h) === z0);
  return { zoned: zones.length > 0, zoneRider, outOfZone: zones.length > 0 && !zoneRider, loadingSame, turn: r26Turns(p.branchId).get(p.id) || null, today: r26Today(p), est: r26Estimate(p, orders) };
}
// The agreed order: on time → zone rider → already loading this zone and slot → turn → fewer per hour → name.
// An order that is late whoever takes it goes to the rider who gets there soonest (then the same order).
function r26Rank(fits) {
  return [...fits].sort((a, b) =>
    Number(a.r26.est.lateMin > 0) - Number(b.r26.est.lateMin > 0) || a.r26.est.lateMin - b.r26.est.lateMin
    || (a.r26.est.missed.length ? Math.round((a.r26.est.lastMs - b.r26.est.lastMs) / 60000) : 0)
    || Number(b.r26.zoneRider) - Number(a.r26.zoneRider)
    || Number(b.r26.loadingSame) - Number(a.r26.loadingSame)
    || (a.r26.turn || 999) - (b.r26.turn || 999)
    || a.r26.today.perHour - b.r26.today.perHour
    || a.p.name.localeCompare(b.p.name));
}
function r26WhyNot(f, best) {
  if (!best) return "";
  if (f.r26.est.ownLateMin > 0) return `would be about ${r26Dur(f.r26.est.ownLateMin)} late`;
  if (f.r26.est.heldLateMin > 0) return `it would add about ${r26Dur(f.r26.est.heldLateMin)} of lateness to the orders ${f.p.name} already has`;
  if (f.warning) return f.warning.charAt(0).toLowerCase() + f.warning.slice(1);
  if (f.r26.est.missed.length && f.r26.est.lastMs - best.r26.est.lastMs >= 60000) return `${best.p.name} gets there sooner (~${r26When(best.r26.est.lastMs)})`;
  if (f.r26.outOfZone && best.r26.zoneRider) return "not a rider of this zone";
  if (best.r26.loadingSame && !f.r26.loadingSame) return `${best.p.name} is already loading this zone and slot`;
  if (f.r26.turn && best.r26.turn && f.r26.turn > best.r26.turn) return `it's ${best.p.name}'s turn (turn ${best.r26.turn}; ${f.p.name} is turn ${f.r26.turn})`;
  if (!f.r26.turn && best.r26.turn) return `${f.p.name} is not free yet`;
  return "another rider fits better";
}

/* ---------------- 5. The Assign rider dialog ---------------- */
window.assignCandidates = (orders) => {
  const branchId = orders[0] && orders[0].branchId;
  const fits = State.partners.filter((p) => p.branchId === branchId && p.active !== false).map((p) => {
    const f = riderFit(p, orders);
    f.r26 = r26Info(p, orders);
    return f;
  });
  const clear = r26Rank(fits.filter((f) => f.canTake));
  const best = clear.find((f) => !f.warning && f.r26.est.lateMin === 0) || null;
  return {
    suggested: best ? [best] : [],
    available: clear.filter((f) => f !== best),
    cannot: fits.filter((f) => !f.canTake).sort((a, b) => Number(Boolean(a.onTrip)) - Number(Boolean(b.onTrip)) || b.free - a.free),
    best,
    earliest: clear.find((f) => !f.warning) || clear[0] || null,
  };
};
(() => {
  const row = window.assignRowHTML;
  window.assignRowHTML = (f, m) => {
    const html = row(f, m);
    if (!f.r26) return html;
    const i = f.r26;
    const tags = [
      i.outOfZone ? `<span class="r26-tag warn">Out-of-zone</span>` : i.zoned ? `<span class="r26-tag">Zone rider</span>` : "",
      i.loadingSame ? `<span class="r26-tag">Loading this zone and slot</span>` : "",
      i.turn ? `<span class="r26-tag soft">Turn ${i.turn}</span>` : "",
      `<span class="qk-muted">${i.today.n} delivered today · ${i.today.perHour}/h</span>`,
      f.canTake ? r26EstTag(i.est, f.p) : "",
    ].filter(Boolean).join("");
    return html.replace('<span class="as-sub">', `<span class="as-sub r26-sub">${tags}</span><span class="as-sub">`);
  };
  const modal = window.assignRiderModal;
  window.assignRiderModal = () => {
    let html = modal();
    const m = UI.modal;
    const orders = m.ids.map(r26Order).filter(Boolean);
    if (!html || !orders.length) return html;
    const c = assignCandidates(orders);
    const mode = r26Rules().mode;
    const zones = [...new Set(orders.map(r26ZoneOf))];
    html = html.replace('<div class="as-summary">', `<div class="as-summary">${zones.map(r26ZoneChip).join("")}`);
    if (mode === "manual") html = html.replace('<div class="as-group">Suggested</div>', '<div class="as-group">Best match <span class="qk-muted small">(a hint — Manual mode)</span></div>');
    let top = "";
    const missed = orders.filter((o) => r26MissedMin(o) > 0);
    if (missed.length) top += `<div class="notice notice-warn r26-note">${ic("clock")}<span>${missed.length === 1
      ? `<b>#${esc(missed[0].id)} is ${esc(r26MissedText(missed[0]))}.</b>`
      : missed.length === orders.length && missed.every((o) => promisedAtMs(o) <= Date.now())
        ? `<b>All ${missed.length} orders are already past their promised time.</b>`
        : `<b>${missed.length} of these orders will be late whoever takes them</b> (${missed.map((o) => `#${esc(o.id)}`).join(", ")}).`} The suggestion is the rider who gets there soonest — tell the customer.</span></div>`;
    if (!c.best && c.earliest && c.earliest.r26.est.lateMin > 0) top += `<div class="notice notice-danger r26-note">${ic("alert")}<span><b>${c.earliest.r26.est.ownLateMin > 0 ? "No rider can reach every customer on time." : "No rider can take this without making other orders late."}</b> ${esc(r26LateText(c.earliest).replace(/^./, (x) => x.toUpperCase()))}. Assign someone anyway, move the order to a later slot, or tell the customer.</span></div>`;
    const pid = m.r26Confirm;
    const pick = pid && c.available.concat(c.suggested).find((f) => f.p.id === pid);
    if (pick && c.best) {
      top += `<div class="notice notice-warn r26-confirm r26-note">${ic("alert")}<span><b>${esc(pick.p.name)} wasn't suggested</b> — ${esc(r26WhyNot(pick, c.best))}. The suggestion is ${esc(c.best.p.name)}. Assign ${esc(pick.p.name)} anyway? It is noted in the audit log.
        <span class="r26-confirm-btns"><button type="button" class="btn btn-sm btn-primary" data-action="assign-rider" data-partner="${pick.p.id}" data-r26ok="1">Assign ${esc(pick.p.name)}</button><button type="button" class="link-btn" data-action="r26-confirm-cancel">Cancel</button></span></span></div>`;
    }
    if (top) html = html.replace('<div class="dialog-body">', `<div class="dialog-body">${top}`);
    return html.replace(/<div class="qk-muted small" style="margin-top:10px">[\s\S]*?<\/div>(\s*<\/div>\s*<\/div>\s*<\/div>\s*)$/,
      `<div class="qk-muted small" style="margin-top:10px">Smart dispatch: the promised time first, then the zone's riders, then fair turns (first back to the store goes next; a tie goes to fewer deliveries per hour today), then filling the trip up to the rider's capacity. An order that will be late whoever takes it goes to the rider who gets there soonest, and a rider's other orders count only for the lateness this choice adds to them. The estimate is the packing time left plus 20 km/h in a straight line and ${r26Rules().dropMin} min at each door. Offline or full riders need “Assign anyway”; a rider out on a trip can't be given anything.</div>$1`);
  };
  // Choosing a rider who was not suggested asks first (Suggest / Auto), and the audit entry says so.
  const assign = Actions["assign-rider"];
  Actions["assign-rider"] = (el) => {
    const m = UI.modal;
    if (!m || m.type !== "assignRider") return assign(el);
    const pid = Number(el.dataset.partner);
    const orders = m.ids.map(r26Order).filter(Boolean);
    const c = orders.length ? assignCandidates(orders) : { best: null };
    const notSuggested = Boolean(c.best && c.best.p.id !== pid);
    if (notSuggested && r26Rules().mode !== "manual" && !el.dataset.force && !el.dataset.r26ok) { UI.modal = { ...m, r26Confirm: pid }; render(); return; }
    const ids = [...m.ids], via = m.via;
    const before = State.auditEvents.length;
    assign(el);
    const added = State.auditEvents.length - before;
    if (added <= 0 || (!notSuggested && !via)) return;
    const extra = { ...(via ? { via } : {}), ...(notSuggested ? { notSuggested: true, suggestedRider: c.best.p.name } : {}) };
    State.auditEvents = State.auditEvents.map((e, i) => (i < added && e.action === "order.rider_assigned" && ids.includes(e.entityId) ? { ...e, after: { ...(e.after || {}), ...extra } } : e));
    persist("auditEvents");
  };
})();
Actions["r26-confirm-cancel"] = () => { if (UI.modal) { UI.modal = { ...UI.modal, r26Confirm: null }; render(); } };

/* ---------------- 6. Orders ▸ Dispatch: suggested trips, slot → zone, riders' turns ---------------- */
// The trips Smart dispatch suggests now. Each rider gets at most one suggested trip at a time.
function r26Plan(queue) {
  const trips = [], stuck = [];
  const startBy = (o) => promisedAtMs(o) - remainingTargetMins(o) * 60000;
  const byStore = new Map();
  queue.forEach((o) => byStore.set(o.branchId, [...(byStore.get(o.branchId) || []), o]));
  byStore.forEach((orders, branchId) => {
    const used = new Set();
    const groups = new Map();
    orders.forEach((o) => { const z = r26ZoneOf(o); const k = `${z ? z.id : 0}|${tripKey(o)}`; groups.set(k, [...(groups.get(k) || []), o]); });
    const list = [...groups.values()].map((g) => g.sort((a, b) => startBy(a) - startBy(b))).sort((a, b) => startBy(a[0]) - startBy(b[0]));
    list.forEach((g) => {
      let rest = [...g];
      while (rest.length) {
        const first = rest[0];
        const fits = State.partners.filter((p) => p.branchId === branchId && p.active !== false && !used.has(p.id))
          .map((p) => { const f = riderFit(p, [first]); f.r26 = r26Info(p, [first]); return f; })
          .filter((f) => f.canTake && !f.warning);
        const ranked = r26Rank(fits);
        const best = ranked.find((f) => f.r26.est.lateMin === 0);
        if (!best) { stuck.push({ order: first, earliest: ranked[0] || null, taken: !ranked.length && used.size > 0 }); rest = rest.slice(1); continue; }
        const take = [first];
        for (const o of rest.slice(1)) {
          if (take.length >= best.free) break;
          if (r26Estimate(best.p, [...take, o]).lateMin === 0) take.push(o);
        }
        trips.push({ branchId, zone: r26ZoneOf(first), key: tripKey(first), orders: take, fit: best, info: r26Info(best.p, take) });
        used.add(best.p.id);
        rest = rest.filter((o) => !take.includes(o));
      }
    });
  });
  return { trips, stuck };
}
function r26ModeBanner(mode, plan, editable) {
  const t = {
    manual: ["Manual", "You pick every rider; the Assign rider dialog marks the best match."],
    suggest: ["Suggest", "Smart dispatch suggests trips below — tap Assign trip, or choose another rider yourself."],
    auto: ["Auto", "Smart dispatch assigns these trips by itself as soon as their orders reach Picking; you can still change any of them."],
  }[mode];
  const run = mode === "auto" && editable && plan && plan.trips.length
    ? `<span class="r26-mode-run"><button type="button" class="btn btn-primary-soft btn-sm" data-action="r26-auto-run">Run auto dispatch now</button><span class="qk-muted small">prototype only — the real one runs every minute</span></span>` : "";
  return `<div class="r26-mode">${ic("sparkle")}<span><b>Smart dispatch · ${t[0]}</b> — ${t[1]} <span class="qk-muted small">Change it under Business Settings ▸ Delivery & Payments.</span></span>${run}</div>`;
}
function r26TripCard(t, editable) {
  const f = t.fit, p = f.p, ids = t.orders.map((o) => o.id).join(",");
  const why = [
    f.r26.loadingSame ? "already loading this zone and slot" : f.r26.turn ? `turn ${f.r26.turn}` : "",
    !t.zone ? "no zone — any rider" : t.info.zoneRider ? "zone rider" : "out-of-zone — the zone's riders are busy",
    `${f.r26.today.n} delivered today · ${f.r26.today.perHour}/h`,
  ].filter(Boolean).join(" · ");
  return `<div class="r26-trip">
    <div class="r26-trip-head">${r26Dot(t.zone)}<b>${esc(r26ZoneText(t.zone))}</b><span class="tag">${esc(tripLabel(t.key))}</span></div>
    <div class="small">${t.orders.map((o) => `<button type="button" class="link-btn small" data-action="open-order" data-id="${esc(o.id)}">#${esc(o.id)}</button>`).join(" ")} <span class="qk-muted">· ${t.orders.length} order${t.orders.length === 1 ? "" : "s"}</span></div>
    <div class="r26-trip-rider">${ic("truck")}<b>${esc(p.name)}</b><span class="qk-muted small">${esc(p.vehicle || "")} · ${f.load + t.orders.length}/${f.cap}</span>${!t.zone || t.info.zoneRider ? "" : `<span class="r26-tag warn">Out-of-zone</span>`}</div>
    <div class="qk-muted small">${esc(why)}</div>
    ${r26TripTiming(t)}
    ${editable ? `<div class="r26-trip-actions"><button type="button" class="btn btn-primary btn-sm" data-action="r26-assign-trip" data-ids="${esc(ids)}" data-partner="${p.id}">Assign trip</button><button type="button" class="btn btn-outline btn-sm" data-action="r26-choose" data-ids="${esc(ids)}">Choose rider…</button></div>` : ""}
  </div>`;
}
// The trip's timing line: all on time, or the orders that are late whoever takes them.
function r26TripTiming(t) {
  const e = t.info.est, last = `Last drop ~${esc(r26When(e.lastMs))}`;
  if (!e.missed.length) return `<div class="small tone-green">${ic("clock")} ${last} · every order on time</div>`;
  const passed = e.missed.filter((o) => promisedAtMs(o) <= Date.now()).length;
  const why = e.missed.length === 1 && t.orders.length === 1 ? esc(r26MissedText(e.missed[0]))
    : passed === t.orders.length ? `all ${passed} already past their promised time`
    : `${e.missed.length} of ${t.orders.length} orders late whoever takes them`;
  return `<div class="small tone-yellow">${ic("clock")} ${last} · ${why} — the soonest rider</div>`;
}
function r26StuckCard(s, editable) {
  const z = r26ZoneOf(s.order);
  const missed = r26MissedMin(s.order) > 0 ? `#${esc(s.order.id)} is ${esc(r26MissedText(s.order))}. ` : "";
  const text = !s.earliest && s.taken ? "Every free rider here already has a suggested trip above — it waits for the next one free."
    : !s.earliest ? "No free rider at this store right now — it waits; the at-risk alert warns the staff."
    : s.earliest.r26.est.ownLateMin > 0 ? `No rider can make the promised time — ${esc(r26LateText(s.earliest))}.`
    : `No rider can take it without making other orders late — ${esc(r26LateText(s.earliest))}.`;
  return `<div class="r26-trip stuck">
    <div class="r26-trip-head">${r26Dot(z)}<b>${esc(r26ZoneText(z))}</b><span class="tag">${esc(tripLabel(tripKey(s.order)))}</span></div>
    <div class="small"><button type="button" class="link-btn small" data-action="open-order" data-id="${esc(s.order.id)}">#${esc(s.order.id)}</button></div>
    <div class="small tone-red">${ic("alert")} ${missed}${text}</div>
    ${editable ? `<div class="r26-trip-actions"><button type="button" class="btn btn-outline btn-sm" data-action="r26-choose" data-ids="${esc(s.order.id)}">Choose rider…</button></div>` : ""}
  </div>`;
}
window.ordersDispatchHTML = function () {
  const queue = dispatchQueue();
  UI.dispatchSel = UI.dispatchSel.filter((id) => queue.some((o) => o.id === id));
  const sel = new Set(UI.dispatchSel);
  const editable = canEdit(currentUser(), "orders");
  const mode = r26Rules().mode;
  const plan = mode === "manual" || !queue.length ? null : r26Plan(queue);
  const groups = new Map();
  queue.forEach((o) => { const k = tripKey(o); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); });
  const order = [...groups.keys()].sort((a, b) => (a === "express" ? -1 : b === "express" ? 1 : a.localeCompare(b)));
  const ids = scopedBranchIds();
  const riders = State.partners.filter((p) => p.active !== false && (!ids || ids.includes(p.branchId)));
  const selOrders = queue.filter((o) => sel.has(o.id));
  const multiStore = new Set(selOrders.map((o) => o.branchId)).size > 1;
  const turns = new Map();
  new Set(riders.map((p) => p.branchId)).forEach((bid) => r26Turns(bid).forEach((n, pid) => turns.set(pid, n)));
  const rowHTML = (o) => `
          <label class="dq-row ${sel.has(o.id) ? "on" : ""}">
            <input type="checkbox" ${sel.has(o.id) ? "checked" : ""} data-action="dispatch-toggle" data-id="${o.id}" aria-label="Select order ${esc(o.id)}" />
            <span class="dq-id"><b>#${esc(o.id)}</b><span class="stage-chip st-${o.status}">${esc(stageLabel(o.status))}</span></span>
            <span class="small">${esc(o.customerName)}</span>
            <span class="small qk-muted">S${sectorOf(o) || "?"} · ${orderUnits(o)} units${isCold(o) ? " · Chilled" : ""}</span>
            <button type="button" class="link-btn small" data-action="open-order" data-id="${o.id}">Open</button>
          </label>`;
  const zoneBlocks = (list) => {
    const byZone = new Map();
    list.forEach((o) => { const z = r26ZoneOf(o); const k = z ? z.id : 0; if (!byZone.has(k)) byZone.set(k, { z, orders: [] }); byZone.get(k).orders.push(o); });
    return [...byZone.values()].sort((a, b) => (!a.z ? 1 : !b.z ? -1 : a.z.code.localeCompare(b.z.code)))
      .map(({ z, orders }) => `<div class="r26-zhead">${r26Dot(z)}<b>${esc(r26ZoneText(z))}</b><span class="qk-muted">${orders.length}</span></div>${orders.map(rowHTML).join("")}`).join("");
  };
  return `
  ${r26ModeBanner(mode, plan, editable)}
  ${plan && (plan.trips.length || plan.stuck.length) ? `<section class="r26-plan" aria-label="Suggested trips">
    <div class="rail-title">Suggested trips <span class="qk-muted small">promised time first · zone riders · fair turns · fill the trip</span></div>
    <div class="r26-trips">${plan.trips.map((t) => r26TripCard(t, editable)).join("")}${plan.stuck.map((s) => r26StuckCard(s, editable)).join("")}</div>
  </section>` : ""}
  <div class="dispatch-grid">
    <section class="dispatch-col" aria-label="Orders waiting for a rider">
      <div class="rail-title">Waiting for a rider <span class="qk-muted small">${queue.length} order${queue.length === 1 ? "" : "s"} · by slot, then zone</span></div>
      ${queue.length ? order.map((k) => {
        const list = groups.get(k);
        const allOn = list.every((o) => sel.has(o.id));
        return `
        <div class="dq-group">
          <label class="dq-head"><input type="checkbox" ${allOn ? "checked" : ""} data-action="dispatch-toggle-group" data-key="${esc(k)}" aria-label="Select all in ${esc(tripLabel(k))}" /><b>${esc(tripLabel(k))}</b><span class="qk-muted small">${list.length} order${list.length === 1 ? "" : "s"}</span></label>
          ${zoneBlocks(list)}
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
        const zs = State.zones.filter((z) => z.active && z.riderIds.includes(p.id));
        const today = r26Today(p);
        return `
        <div class="dr-row ${fitsSel ? "fits" : ""}">
          <div class="dr-top"><b>${esc(p.name)}</b><span class="qk-muted small">${esc(p.vehicle || "")}</span>${turns.has(p.id) ? `<span class="r26-tag soft">Turn ${turns.get(p.id)}</span>` : ""}<span class="load-num">${load}/${cap}</span></div>
          <span class="load-bar ${room <= 0 ? "full" : ""}"><i style="width:${Math.min(100, (load / cap) * 100)}%"></i></span>
          <div class="small qk-muted">${!riderOnline(p) ? "Offline" : trips.length ? `Carrying ${esc(trips.join(", "))}` : "Online · free"}${room <= 0 ? ` · <span class="tone-red">full</span>` : ""} · ${today.n} today · ${today.perHour}/h</div>
          <div class="r26-dzones">${zs.length ? zs.map((z) => `<span class="r26-chip">${r26Dot(z)}${esc(z.code)}</span>`).join("") : `<span class="qk-muted small">No zone</span>`}</div>
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
};
Object.assign(Actions, {
  // One tap: the same path as the dialog (every rule and the audit entry), marked "Smart dispatch".
  "r26-assign-trip"(el) {
    const ids = String(el.dataset.ids || "").split(",").filter(Boolean);
    if (!ids.length) return;
    UI.modal = { type: "assignRider", ids, via: "Smart dispatch" };
    Actions["assign-rider"]({ dataset: { partner: String(el.dataset.partner), r26ok: "1" } });
  },
  "r26-choose"(el) { UI.modal = { type: "assignRider", ids: String(el.dataset.ids || "").split(",").filter(Boolean) }; render(); },
  // Auto mode, simulated: the backend would do this every minute for orders that reached Picking.
  "r26-auto-run"() {
    const plan = r26Plan(dispatchQueue());
    let n = 0;
    plan.trips.forEach((t) => {
      const ids = t.orders.filter((o) => ["picking", "ready_for_rider"].includes(o.status)).map((o) => o.id);
      if (!ids.length) return;
      assignOrders(ids, t.fit.p.id);
      ids.forEach((id) => addAuditEvent({ action: "order.rider_assigned", entity: "order", entityId: id, actorType: "system", actorId: null, before: { riderId: null }, after: { riderId: t.fit.p.name, via: "Auto dispatch" }, names: { entity: `#${id}` } }));
      n += ids.length;
    });
    UI.dispatchSel = [];
    showToast(n ? `Auto dispatch assigned ${n} order${n === 1 ? "" : "s"}` : "Nothing to assign yet — auto dispatch waits until orders reach Picking", n ? "success" : "danger");
    render();
  },
});

/* ---------------- 7. Delivery Masters ▸ Delivery Zones ---------------- */
UI.r26 = UI.r26 || { branchId: null, draw: null, view: {}, confirmDel: null, mapFailed: false };
(function r26Screen() {
  const screen = PERMISSION_SCREENS.find((s) => s.key === "routes");
  if (screen) screen.label = "Delivery Zones";   // the real permission key would be `zones`
  Object.assign(AUDIT_ACTION_TEXT, {
    "zone.created": ["Delivery Zones", "created zone"],
    "zone.updated": ["Delivery Zones", "changed zone"],
    "zone.deleted": ["Delivery Zones", "deleted zone"],
  });
  AUDIT_ENTITY_LABEL.zone = "Delivery Zones";
  Object.assign(AUDIT_FIELD_LABEL, {
    code: "Code", colour: "Colour", corners: "Corners", riders: "Riders", via: "Assigned by",
    notSuggested: "Not the suggested rider", suggestedRider: "Suggested rider",
    "dispatch.mode": "Dispatch mode", "dispatch.dropMinutes": "Minutes per drop",
  });
})();
function r26Stores() { const ids = scopedBranchIds(); return State.branches.filter((b) => !ids || ids.includes(b.id)); }
function r26Branch() {
  const list = r26Stores();
  const b = list.find((x) => x.id === UI.r26.branchId) || list[0] || null;
  if (b) UI.r26.branchId = b.id;
  return b;
}
const r26OrdersIn = (z) => State.orders.filter((o) => o.fulfillment !== "pickup" && o.status !== "cancelled" && r26Inside(o, z));
const r26Snapshot = (z) => ({ code: z.code, name: z.name, colour: z.colour, active: z.active, corners: z.points.length, riders: z.riderIds.map((id) => (findPartner(id) || {}).name).filter(Boolean).join(", ") || "none" });
function r26ZoneCard(z, b, editable, waiting) {
  const w = waiting.filter((o) => r26ZoneOf(o) === z).length;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = z.active ? r26OrdersIn(z).filter((o) => o.createdAt >= start.getTime()).length : 0;
  const riders = z.riderIds.map(findPartner).filter(Boolean);
  const area = r26AreaKm2(r26Proj(z.points, b.lat));
  let confirm = "";
  if (UI.r26.confirmDel === z.id) {
    const used = r26OrdersIn(z).length;
    confirm = used
      ? `<div class="notice notice-warn r26-confirm">${ic("alert")}<span>${used} order${used === 1 ? " was" : "s were"} in this zone, so it can't be deleted — switch it off instead (its orders become "No zone").
          <span class="r26-confirm-btns">${z.active ? `<button type="button" class="btn btn-sm btn-outline" data-action="r26-toggle" data-id="${z.id}">Switch off</button>` : ""}<button type="button" class="link-btn" data-action="r26-del-cancel">Cancel</button></span></span></div>`
      : `<div class="notice notice-danger r26-confirm">${ic("trash")}<span>Delete ${esc(z.code)}? Its riders stay riders of the store.
          <span class="r26-confirm-btns"><button type="button" class="btn btn-sm btn-outline-danger" data-action="r26-del" data-id="${z.id}">Delete</button><button type="button" class="link-btn" data-action="r26-del-cancel">Cancel</button></span></span></div>`;
  }
  return `<div class="r26-zone ${z.active ? "" : "off"}">
    <div class="r26-zone-head">${r26Dot(z)}<b>${esc(z.code)}</b><span>${esc(z.name)}</span>${z.active ? "" : `<span class="badge badge-gray-soft">Off</span>`}</div>
    <div class="qk-muted small">${z.points.length} corners · about ${area.toFixed(1)} km²${z.active ? ` · ${w} waiting now · ${today} today` : ""}</div>
    <div class="r26-riders">${riders.length ? riders.map((p) => `<span class="r26-rchip ${r15Online(p.id) ? "on" : ""}" title="${r15Online(p.id) ? "Online" : "Offline"}">${esc(p.name)}</span>`).join("") : `<span class="tone-yellow small">No riders — its orders go to any free rider of the store</span>`}</div>
    ${editable && !UI.r26.draw ? `<div class="r26-zone-actions">
      <button type="button" class="btn btn-outline btn-sm" data-action="r26-edit" data-id="${z.id}">${ic("edit")} Edit</button>
      <button type="button" class="btn btn-outline btn-sm" data-action="r26-redraw" data-id="${z.id}">${ic("pin")} Redraw</button>
      <button type="button" class="btn btn-outline btn-sm" data-action="r26-toggle" data-id="${z.id}">${z.active ? "Switch off" : "Switch on"}</button>
      <button type="button" class="link-btn link-danger" data-action="r26-del-ask" data-id="${z.id}">Delete</button>
    </div>` : ""}
    ${confirm}
  </div>`;
}
function r26DrawBar(d) {
  return `<div class="r26-drawbar"><span class="r26-drawtext">${ic("pin")}<span><b>${d.zoneId ? "Redraw the zone" : "Draw the new zone"}</b> — click the map at each corner, in order around the area. <span id="r26DrawCount" class="qk-muted">${d.points.length} corner${d.points.length === 1 ? "" : "s"}</span></span></span>
    <span class="r26-draw-btns">
      <button type="button" class="btn btn-outline btn-sm" data-action="r26-undo">Undo last corner</button>
      <button type="button" class="btn btn-outline btn-sm" data-action="r26-clear">Clear</button>
      <button type="button" class="link-btn" data-action="r26-draw-cancel">Cancel</button>
      <button type="button" class="btn btn-primary btn-sm" data-action="r26-draw-done">Done</button>
    </span>
    ${d.error ? `<div class="field-error r26-drawerr">${esc(d.error)}</div>` : ""}
  </div>`;
}
window.adminRoutesTBD = function () {
  const b = r26Branch();
  if (!b) return `<div class="empty-state"><div class="empty-title">No store</div><div class="empty-hint">Add a store under Setup ▸ Stores first.</div></div>`;
  const editable = canEdit(currentUser(), "routes");
  const zones = State.zones.filter((z) => z.branchId === b.id);
  const waiting = dispatchQueue().filter((o) => o.branchId === b.id);
  const noZone = waiting.filter((o) => !r26ZoneOf(o)).length;
  const d = UI.r26.draw && UI.r26.draw.branchId === b.id ? UI.r26.draw : null;
  return `<div class="r26-page">
    <div class="r26-top">
      <div class="filter-pill-row">${r26Stores().map((s) => `<button type="button" class="filter-pill ${s.id === b.id ? "active" : ""}" data-action="r26-store" data-id="${s.id}">${esc(s.name)}</button>`).join("")}</div>
      ${editable && !d ? `<button type="button" class="btn btn-primary btn-sm" data-action="r26-new">${ic("plus")} New zone</button>` : ""}
    </div>
    <div class="qk-muted small">A zone is an area inside ${esc(b.name)}'s ${esc(String(b.radiusKm))} km delivery circle with its own riders. An order takes the zone its delivery pin falls in; outside every zone it is "No zone" and any rider of the store can take it. Zones of one store can't overlap. Smart dispatch (Orders ▸ Dispatch) suggests a zone's own riders first.</div>
    <div class="r26-cols">
      <div class="r26-mapcol">
        ${d ? r26DrawBar(d) : ""}
        <div id="r26Map" class="r26-map" data-branch="${b.id}">${window.L ? "" : `<div class="r26-maploading">${UI.r26.mapFailed ? "The map could not load (no internet?). The zones are listed on the right." : "Loading the map…"}</div>`}</div>
        <div class="qk-muted small">Dots = orders waiting for a rider now, in their zone's colour (grey = no zone). Dashed circle = the store's delivery radius. Map data © OpenStreetMap contributors.</div>
      </div>
      <div class="r26-list">
        ${zones.map((z) => r26ZoneCard(z, b, editable, waiting)).join("") || `<div class="empty-state"><div class="empty-title">No zones yet</div><div class="empty-hint">Every order of this store is "No zone" — any rider can take it. ${editable ? "Tap New zone and click the map to draw one." : ""}</div></div>`}
        <div class="r26-zone nozone"><div class="r26-zone-head">${r26Dot(null)}<b>No zone</b></div><div class="qk-muted small">${noZone} waiting now · orders outside every zone go to any free rider of the store.</div></div>
      </div>
    </div>
  </div>`;
};

/* ---- The map (Leaflet, loaded on first use) ---- */
const R26_LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
let r26LeafletLoading = null;
let r26MapObj = null;
function r26LoadLeaflet() {
  if (window.L || r26LeafletLoading) return;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = R26_LEAFLET + "leaflet.min.css";
  document.head.appendChild(css);
  r26LeafletLoading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = R26_LEAFLET + "leaflet.min.js";
    s.onload = () => { resolve(); render(); };
    s.onerror = () => { UI.r26.mapFailed = true; r26LeafletLoading = null; resolve(); render(); };
    document.head.appendChild(s);
  });
}
function r26MountMap() {
  if (r26MapObj) { try { r26MapObj.remove(); } catch (e) { /* the old container is gone already */ } r26MapObj = null; }
  const el = document.getElementById("r26Map");
  if (!el) return;
  if (!window.L) { r26LoadLeaflet(); return; }
  const b = findBranch(Number(el.dataset.branch));
  if (!b) return;
  const L = window.L;
  const map = L.map(el, { scrollWheelZoom: true });
  r26MapObj = map;
  const v = UI.r26.view[b.id];
  if (v) map.setView(v.c, v.z);
  else {
    const dLat = b.radiusKm / 110.57, dLng = b.radiusKm / (111.32 * Math.cos(b.lat * Math.PI / 180));
    map.fitBounds([[b.lat - dLat, b.lng - dLng], [b.lat + dLat, b.lng + dLng]], { padding: [8, 8] });
  }
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
  L.circle([b.lat, b.lng], { radius: b.radiusKm * 1000, color: "#00569D", weight: 1.5, dashArray: "6 6", fill: false, interactive: false }).addTo(map);
  L.circleMarker([b.lat, b.lng], { radius: 8, color: "#fff", weight: 2, fillColor: "#00569D", fillOpacity: 1 }).bindTooltip(b.name).addTo(map);
  const d = UI.r26.draw && UI.r26.draw.branchId === b.id ? UI.r26.draw : null;
  State.zones.filter((z) => z.branchId === b.id && !(d && d.zoneId === z.id)).forEach((z) => {
    L.polygon(z.points, { color: z.colour, weight: 2, fillOpacity: z.active ? 0.18 : 0.04, dashArray: z.active ? null : "4 6" })
      .bindTooltip(`${z.code} · ${z.name}${z.active ? "" : " (off)"}`, { sticky: true }).addTo(map);
  });
  dispatchQueue().filter((o) => o.branchId === b.id).forEach((o) => {
    const z = r26ZoneOf(o), pin = r15Pin(o);
    L.circleMarker([pin.lat, pin.lng], { radius: 5, color: "#fff", weight: 1.5, fillColor: z ? z.colour : "#6B7280", fillOpacity: 1 })
      .bindTooltip(`#${o.id} · ${z ? z.code : "No zone"} · ${tripLabel(tripKey(o))}`).addTo(map);
  });
  if (d) {
    const layer = L.layerGroup().addTo(map);
    const draw = () => {
      layer.clearLayers();
      if (d.points.length >= 2) L.polygon(d.points, { color: "#111827", weight: 2, dashArray: "5 5", fillOpacity: 0.08, interactive: false }).addTo(layer);
      d.points.forEach((p, i) => L.circleMarker(p, { radius: i === 0 ? 6 : 4, color: "#111827", weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(layer));
      const c = document.getElementById("r26DrawCount");
      if (c) c.textContent = `${d.points.length} corner${d.points.length === 1 ? "" : "s"}`;
    };
    draw();
    map.getContainer().style.cursor = "crosshair";
    map.on("click", (e) => { d.points.push([r26R6(e.latlng.lat), r26R6(e.latlng.lng)]); d.error = null; draw(); });
  }
  map.on("moveend", () => { const c = map.getCenter(); UI.r26.view[b.id] = { c: [c.lat, c.lng], z: map.getZoom() }; });
}
(() => {
  const after = window.afterRender;
  window.afterRender = () => { after(); r26MountMap(); };
})();

/* ---- The zone form ---- */
function r26ZoneModal() {
  const m = UI.modal, f = m.form, e = m.errors || {}, b = findBranch(f.branchId);
  const riders = State.partners.filter((p) => p.branchId === f.branchId && p.active !== false);
  const area = f.points.length >= 3 ? r26AreaKm2(r26Proj(f.points, b.lat)) : 0;
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static dialog-user" role="dialog" aria-modal="true" aria-labelledby="r26-title" data-action="noop">
      <div class="dialog-head"><span id="r26-title">${f.id ? `Edit zone ${esc(f.code)}` : "New zone"} · ${esc(b.name)}</span><button class="dialog-close" data-action="close-modal" aria-label="Close">${ic("close")}</button></div>
      <form class="dialog-body" data-action="r26-zone-save" novalidate>
        <div class="r26-shape">${r26Dot({ colour: f.colour })}<span>${f.points.length} corners · about ${area.toFixed(1)} km²</span><button type="button" class="link-btn" data-action="r26-redraw-form">Redraw on the map</button></div>
        ${e.shape ? `<div class="field-error">${e.shape.map(esc).join("<br>")}</div>` : ""}
        <div class="r26-two">
          <label class="field"><span class="field-label">Code</span><input class="input ${e.code ? "invalid" : ""}" name="code" maxlength="20" value="${esc(f.code)}" placeholder="e.g. TAM-N" /></label>
          <label class="field"><span class="field-label">Name</span><input class="input ${e.name ? "invalid" : ""}" name="name" maxlength="60" value="${esc(f.name)}" placeholder="e.g. Pasir Ris side" /></label>
        </div>
        ${e.code ? `<div class="field-error">${esc(e.code)}</div>` : ""}${e.name ? `<div class="field-error">${esc(e.name)}</div>` : ""}
        <div class="field"><span class="field-label">Colour on the map</span>
          <div class="r26-swatches">${R26_COLOURS.map((c) => `<label class="r26-sw" title="${c}"><input type="radio" name="colour" value="${c}" ${f.colour === c ? "checked" : ""} /><i style="background:${c}"></i></label>`).join("")}</div></div>
        <div class="field"><span class="field-label">Riders of this zone <span class="qk-muted small">— all equal; a rider can be in several zones</span></span>
          <div class="r26-riderpick">${riders.map((p) => {
            const other = State.zones.filter((z) => z.id !== f.id && z.riderIds.includes(p.id)).map((z) => (z.active ? z.code : `${z.code} (off)`));
            return `<label class="r26-rp"><input type="checkbox" name="riders" value="${p.id}" ${f.riderIds.includes(p.id) ? "checked" : ""} /><span><b>${esc(p.name)}</b> <span class="qk-muted small">${esc(p.vehicle || "")} · ${riderCapacity(p)} per trip${other.length ? ` · also ${esc(other.join(", "))}` : ""}</span></span></label>`;
          }).join("") || `<div class="qk-muted small">This store has no riders yet (Delivery Masters ▸ Delivery Partners).</div>`}</div>
          <div class="qk-muted small">If the zone has no riders, or all of them are busy, its orders are suggested to any free rider of the store, marked Out-of-zone.</div></div>
        <label class="r26-check"><input type="checkbox" name="active" ${f.active ? "checked" : ""} /><span>Zone is on <span class="qk-muted small">— off: its orders become "No zone"</span></span></label>
        <div class="form-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">${f.id ? "Save zone" : "Create zone"}</button></div>
      </form>
    </div>
  </div>`;
}
(() => {
  const extra = window.extraModal;
  window.extraModal = (type) => (type === "r26Zone" ? r26ZoneModal() : extra(type));
})();
function r26ReadForm(form) {
  const fd = new FormData(form);
  return {
    code: String(fd.get("code") || "").trim(),
    name: String(fd.get("name") || "").trim(),
    colour: String(fd.get("colour") || R26_COLOURS[0]),
    active: fd.get("active") === "on",
    riderIds: fd.getAll("riders").map(Number),
  };
}
Submits["r26-zone-save"] = (form) => {
  const m = UI.modal;
  const f = { ...m.form, ...r26ReadForm(form) };
  const errors = {};
  if (!f.code) errors.code = "Give the zone a short code, e.g. TAM-N.";
  else if (!/^[A-Za-z0-9_-]{1,20}$/.test(f.code)) errors.code = "Code: letters, numbers, - and _ only, up to 20 characters, no spaces.";
  else if (State.zones.some((z) => z.branchId === f.branchId && z.id !== f.id && z.code.toLowerCase() === f.code.toLowerCase())) errors.code = `${f.code} is already a zone of this store.`;
  if (f.name.length < 2) errors.name = "Give the zone a name, e.g. Pasir Ris side.";
  const shape = r26ShapeErrors(f.points, f.branchId, f.id, f.active);
  if (shape.length) errors.shape = shape;
  if (Object.keys(errors).length) { UI.modal = { ...m, form: f, errors }; render(); return; }
  const data = { branchId: f.branchId, code: f.code, name: f.name, colour: f.colour, active: f.active, points: f.points, riderIds: f.riderIds };
  if (f.id) {
    const old = State.zones.find((z) => z.id === f.id);
    const next = { ...old, ...data };
    State.zones = State.zones.map((z) => (z.id === f.id ? next : z));
    const a = r26Snapshot(old), b2 = r26Snapshot(next);
    const before = {}, after = {};
    Object.keys(b2).forEach((k) => { if (String(a[k]) !== String(b2[k])) { before[k] = a[k]; after[k] = b2[k]; } });
    if (JSON.stringify(old.points) !== JSON.stringify(next.points) && !("corners" in after)) { before.corners = `${old.points.length} (old shape)`; after.corners = `${next.points.length} (new shape)`; }
    if (Object.keys(after).length) r15Audit("zone.updated", "zone", f.id, before, after, `Zone ${next.code}`);
    showToast(`Zone ${next.code} saved`);
  } else {
    const id = Math.max(0, ...State.zones.map((z) => z.id)) + 1;
    const z = { id, ...data, createdAt: Date.now() };
    State.zones = [...State.zones, z];
    r15Audit("zone.created", "zone", id, null, r26Snapshot(z), `Zone ${z.code}`);
    showToast(`Zone ${z.code} created`);
  }
  persist("zones");
  UI.modal = null;
  render();
};
Object.assign(Actions, {
  "r26-store"(el) { UI.r26.branchId = Number(el.dataset.id); UI.r26.draw = null; UI.r26.confirmDel = null; render(); },
  "r26-new"() {
    const b = r26Branch();
    if (!b) return;
    UI.r26.confirmDel = null;
    UI.r26.draw = { branchId: b.id, zoneId: null, points: [], form: null, fromForm: false, error: null };
    render();
  },
  "r26-edit"(el) {
    const z = State.zones.find((x) => x.id === Number(el.dataset.id));
    if (!z) return;
    UI.r26.confirmDel = null;
    UI.modal = { type: "r26Zone", form: { ...z, riderIds: [...z.riderIds], points: z.points.map((p) => [...p]) }, errors: {} };
    render();
  },
  "r26-redraw"(el) {
    const z = State.zones.find((x) => x.id === Number(el.dataset.id));
    if (!z) return;
    UI.r26.confirmDel = null;
    UI.r26.draw = { branchId: z.branchId, zoneId: z.id, points: z.points.map((p) => [...p]), form: { ...z, riderIds: [...z.riderIds] }, fromForm: false, error: null };
    render();
  },
  "r26-redraw-form"() {
    const m = UI.modal;
    const form = document.querySelector('form[data-action="r26-zone-save"]');
    const f = { ...m.form, ...(form ? r26ReadForm(form) : {}) };
    UI.modal = null;
    UI.r26.draw = { branchId: f.branchId, zoneId: f.id || null, points: f.points.map((p) => [...p]), form: f, fromForm: true, error: null };
    render();
  },
  "r26-undo"() { const d = UI.r26.draw; if (d) { d.points.pop(); d.error = null; render(); } },
  "r26-clear"() { const d = UI.r26.draw; if (d) { d.points = []; d.error = null; render(); } },
  "r26-draw-cancel"() {
    const d = UI.r26.draw;
    UI.r26.draw = null;
    if (d && d.fromForm) UI.modal = { type: "r26Zone", form: d.form, errors: {} };
    render();
  },
  "r26-draw-done"() {
    const d = UI.r26.draw;
    if (!d) return;
    const active = d.form ? d.form.active !== false : true;
    const errs = r26ShapeErrors(d.points, d.branchId, d.zoneId, active);
    if (errs.length) { d.error = errs.join(" "); render(); return; }
    const base = d.form || { id: null, branchId: d.branchId, code: "", name: "", colour: R26_COLOURS[State.zones.filter((z) => z.branchId === d.branchId).length % R26_COLOURS.length], active: true, riderIds: [] };
    UI.r26.draw = null;
    UI.modal = { type: "r26Zone", form: { ...base, points: d.points }, errors: {} };
    render();
  },
  "r26-toggle"(el) {
    const z = State.zones.find((x) => x.id === Number(el.dataset.id));
    if (!z) return;
    if (!z.active) {
      const errs = r26ShapeErrors(z.points, z.branchId, z.id, true);
      if (errs.length) { showToast(`Can't switch ${z.code} on: ${errs[0]}`, "danger"); return; }
    }
    State.zones = State.zones.map((x) => (x.id === z.id ? { ...x, active: !z.active } : x));
    persist("zones");
    r15Audit("zone.updated", "zone", z.id, { active: z.active }, { active: !z.active }, `Zone ${z.code}`);
    UI.r26.confirmDel = null;
    showToast(z.active ? `${z.code} is off — its orders are "No zone" now` : `${z.code} is on`);
    render();
  },
  "r26-del-ask"(el) { UI.r26.confirmDel = Number(el.dataset.id); render(); },
  "r26-del-cancel"() { UI.r26.confirmDel = null; render(); },
  "r26-del"(el) {
    const z = State.zones.find((x) => x.id === Number(el.dataset.id));
    if (!z || r26OrdersIn(z).length) return;
    State.zones = State.zones.filter((x) => x.id !== z.id);
    persist("zones");
    r15Audit("zone.deleted", "zone", z.id, r26Snapshot(z), null, `Zone ${z.code}`);
    UI.r26.confirmDel = null;
    showToast(`Zone ${z.code} deleted`);
    render();
  },
});

/* ---------------- 8. Business Settings ▸ Delivery & Payments ▸ Smart dispatch ---------------- */
function r26DispatchCard(editable) {
  const r = r26Rules();
  const opt = (v, title, desc) => `<label class="r26-radio"><input type="radio" name="r26mode" value="${v}" ${r.mode === v ? "checked" : ""} ${editable ? "" : "disabled"} /><span><b>${title}</b><span class="qk-muted small">${desc}</span></span></label>`;
  return `<div class="summary-card" style="max-width:420px; margin-top:16px"><div class="summary-card-title">Smart dispatch</div>
    <div class="qk-muted small">How riders are chosen for the orders waiting at a store: the promised time first, then the zone's own riders, then fair turns (first back to the store goes next; a tie goes to fewer deliveries per hour today), then filling the trip up to the rider's capacity.</div>
    <div class="r26-radios">
      ${opt("manual", "Manual", "You pick every rider. The Assign rider dialog still marks the best match.")}
      ${opt("suggest", "Suggest (recommended)", "Orders ▸ Dispatch shows suggested trips; you tap Assign trip or choose another rider.")}
      ${opt("auto", "Auto", "Trips are assigned by themselves once their orders reach Picking; you can still change any of them.")}
    </div>
    <label class="field"><span class="field-label">Minutes at each customer's door</span><input class="input" type="number" min="1" max="30" step="1" id="r26DropMin" value="${r.dropMin}" ${editable ? "" : "disabled"} /></label>
    <div class="qk-muted small">Travel is estimated at 20 km/h in a straight line — the same rule as the rider's ETA. Zones are drawn under Delivery Masters ▸ Delivery Zones.</div>
    ${editable ? `<button type="button" class="btn btn-primary btn-block" data-action="r26-save-dispatch">Save</button>` : ""}</div>`;
}
(() => {
  const panel = window.adminDeliveryPanel;
  window.adminDeliveryPanel = (editable) => `${panel(editable)}${r26DispatchCard(editable)}`;
})();
Actions["r26-save-dispatch"] = () => {
  const picked = document.querySelector('input[name="r26mode"]:checked');
  const mode = picked ? picked.value : "suggest";
  const drop = Number((document.getElementById("r26DropMin") || {}).value);
  if (!(Number.isInteger(drop) && drop >= 1 && drop <= 30)) { showToast("Minutes at each door: must be 1–30", "danger"); return; }
  const r = r26Rules();
  State.businessRules = { ...(State.businessRules || {}), dispatchMode: mode, dropMinutes: drop };
  persist("businessRules");
  if (r.mode !== mode || r.dropMin !== drop) r15Audit("business_settings.updated", "business_settings", "dispatch", { "dispatch.mode": r.mode, "dispatch.dropMinutes": r.dropMin }, { "dispatch.mode": mode, "dispatch.dropMinutes": drop }, "Business settings");
  showToast("Smart dispatch saved");
  render();
};

/* ---------------- 9. Partners, the order drawer and the rider app show the zone ---------------- */
(() => {
  const partners = window.adminPartners;
  window.adminPartners = () => {
    const parts = partners().split('<div class="partner-card">');
    return parts.map((chunk, i) => {
      if (i === 0) return chunk;
      const m = chunk.match(/data-action="toggle-partner-orders" data-id="(\d+)"/);
      const p = m && findPartner(Number(m[1]));
      if (!p) return chunk;
      const zs = State.zones.filter((z) => z.active && z.riderIds.includes(p.id));
      const line =`<div class="r26-pzones small">${ic("pin")}${zs.length ? zs.map(r26ZoneChip).join("") : `<span class="qk-muted">Not in a zone — suggested for "No zone" orders, or when a zone's riders are busy</span>`}<span class="qk-muted">· set under Delivery Zones</span></div>`;
      return chunk.includes('<div class="form-actions">') ? chunk.replace('<div class="form-actions">', `${line}<div class="form-actions">`) : chunk;
    }).join('<div class="partner-card">');
  };
  const drawer = window.orderDrawerHTML;
  window.orderDrawerHTML = () => {
    const html = drawer();
    const o = r26Order(UI.orderDrawerId);
    if (!html || !o || o.fulfillment === "pickup" || !html.includes('<div class="drawer-actions">')) return html;
    const z = r26ZoneOf(o);
    return html.replace('<div class="drawer-actions">', `<div class="r26-dzone small">${ic("pin")}Delivery zone: ${r26ZoneChip(z)}${z ? "" : `<span class="qk-muted">outside every zone — any rider of the store</span>`}</div><div class="drawer-actions">`);
  };
  const card = window.r15AssignedCard;
  window.r15AssignedCard = (o) => card(o).replace('<div class="qk-muted small">Area ', `<div class="qk-muted small">${r26RiderZone(o)}Area `);
  const stop = window.r15StopView;
  window.r15StopView = (p, tr) => {
    const html = stop(p, tr);
    const o = r15Cur(p.id);
    if (!o || !tr) return html;
    const at = `Customer ${tr.cur + 1} of ${tr.seq.length}</div><div class="qk-muted small">`;
    return html.replace(at, () => at + r26RiderZone(o));
  };
  const later = window.r15LaterStops;
  window.r15LaterStops = (tr, from) => {
    let html = later(tr, from);
    tr.seq.slice(tr.cur + from).map(r15O).forEach((o, i) => {
      if (!o) return;
      const at = `<b>Customer ${tr.cur + from + i + 1}</b> · area `;
      html = html.replace(at, () => `<b>Customer ${tr.cur + from + i + 1}</b> · ${r26RiderZone(o)}area `);
    });
    return html;
  };
})();

/* ---------------- 10. What's changed ---------------- */
WHATS_NEW.unshift({ area: "Round 26 — Delivery Zones and Smart dispatch (proposal, 2026-11-06)", items: [
  ["Delivery Masters ▸ Delivery Zones", "Replaces \"Routes · to discuss\". Per store: a street map with the delivery circle; New zone → click the corners on the map → code, name, colour, riders, on/off. Edit, Redraw, Switch off, Delete (only a zone no order was ever in — otherwise switch it off). A zone must stay inside the store's circle, its lines may not cross, and zones of one store may not overlap. The orders waiting now show as dots in their zone's colour."],
  ["Zone riders", "Each zone has one list of riders, all equal; a rider can be in several zones (shown on Delivery Partners). When none of them is free, any free rider of the store is suggested, marked Out-of-zone. The admin can always assign anyone."],
  ["An order's zone", "From its delivery pin: inside a zone → that zone; outside every zone → \"No zone\" (any rider of the store). Shown in the order drawer and on the rider's stops."],
  ["Smart dispatch", "Orders ▸ Dispatch: Suggested trips — \"zone · slot · N orders → rider\" with Assign trip / Choose rider…. The order of thinking: the promised time first (never a rider who would be late), then the zone's riders, then fair turns (first back to the store goes next; a tie goes to fewer deliveries per hour today), then filling the trip up to the rider's capacity. An order for a zone and slot a rider is already loading joins that trip while there is room. Orders no rider can make on time are listed with the earliest rider and how late."],
  ["Assign rider dialog", "Each rider shows Zone rider / Out-of-zone, their turn, deliveries today and per hour, and the estimate (\"Arrives by ~6:42 PM\" or \"~8 min late\"). Choosing someone who was not suggested asks first and says why they weren't (e.g. \"it's Hassan's turn\"); the audit entry notes it."],
  ["Business Settings ▸ Smart dispatch", "Delivery & Payments ▸ Riders & fleet: Manual / Suggest (default) / Auto, and the minutes at each customer's door. Auto assigns trips once their orders reach Picking (the prototype has a \"Run auto dispatch now\" button for it)."],
  ["The estimate", "The packing time still ahead (the shop's stage targets), then the trip's usual stop order at 20 km/h in a straight line plus the minutes at each door; a scheduled order is never delivered before its window opens. No Google calls."],
  ["Late orders (fix, 2026-11-07)", "Lateness now counts only what a choice causes. An order that will be late whoever takes it (its promised time has passed, or packing and the drive alone take too long) is no longer stuck: it goes to the rider who gets there soonest, and the card says \"already past its promised time (9:15 PM yesterday)\". A rider's other orders count only for the extra lateness the new order adds to them. Each card and dialog shows the order's own lateness, and long delays read in hours (\"about 13 h late\"), never \"1149 min\"."],
] });

/* ---------------- 11. Styles ---------------- */
(function r26Styles() {
  const style = document.createElement("style");
  style.textContent = `
    .r26-page { display: grid; gap: 10px; }
    .r26-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: space-between; }
    .r26-cols { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr); gap: 14px; align-items: start; }
    @media (max-width: 900px) { .r26-cols { grid-template-columns: 1fr; } }
    .r26-mapcol { display: grid; gap: 6px; }
    .r26-map { height: 480px; border-radius: var(--r-lg); border: 1px solid var(--line); overflow: hidden; background: #E9F1F8; position: relative; z-index: 0; }
    .r26-maploading { display: grid; place-items: center; height: 100%; color: var(--muted, #6B7280); }
    .r26-drawbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 10px; border: 1px solid #FCD34D; border-radius: var(--r-md); background: #FFFBEB; }
    .r26-drawtext { display: flex; gap: 6px; align-items: flex-start; flex: 1 1 300px; }
    .r26-drawtext > svg { flex: none; margin-top: 2px; }
    .r26-draw-btns { display: flex; gap: 6px; margin-left: auto; flex-wrap: wrap; align-items: center; }
    .r26-drawerr { width: 100%; }
    .r26-list { display: grid; gap: 10px; }
    .r26-zone { border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; background: #fff; display: grid; gap: 6px; }
    .r26-zone.off { background: #F9FAFB; opacity: .8; }
    .r26-zone.nozone { background: #F9FAFB; }
    .r26-zone-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .r26-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; flex: none; }
    .r26-riders, .r26-dzones { display: flex; flex-wrap: wrap; gap: 6px; }
    .r26-rchip { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: #F3F4F6; color: #374151; }
    .r26-rchip.on::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #16A34A; margin-right: 5px; vertical-align: middle; }
    .r26-zone-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .r26-confirm > span { display: block; }
    .r26-note { margin-bottom: 10px; }
    .r26-confirm-btns { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
    .r26-chip { display: inline-flex; align-items: center; font-size: 12px; padding: 1px 8px; border-radius: 999px; background: #F3F4F6; white-space: nowrap; }
    .r26-mode { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 12px; border-radius: var(--r-md); background: #EEF4FB; margin-bottom: 10px; }
    .r26-mode-run { display: inline-flex; gap: 8px; align-items: center; margin-left: auto; }
    .r26-plan { margin-bottom: 12px; }
    .r26-trips { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
    .r26-trip { border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; background: #fff; display: grid; gap: 5px; align-content: start; }
    .r26-trip.stuck { border-color: #FCA5A5; background: #FEF2F2; }
    .r26-trip-head, .r26-trip-rider { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .r26-trip-actions { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
    .r26-zhead { display: flex; align-items: center; gap: 6px; font-size: 12px; margin: 8px 0 2px 4px; color: #374151; }
    .r26-sub { display: flex !important; flex-wrap: wrap; gap: 4px 8px; align-items: center; margin-top: 2px; }
    .r26-tag { font-size: 11px; padding: 1px 7px; border-radius: 999px; background: #E0F2FE; color: #075985; white-space: nowrap; }
    .r26-tag.soft { background: #F3F4F6; color: #374151; }
    .r26-tag.warn { background: #FEF3C7; color: #92400E; }
    .r26-tag.late { background: #FEE2E2; color: #991B1B; }
    .r26-radios { display: grid; gap: 6px; margin: 10px 0; }
    .r26-radio { display: flex; gap: 8px; align-items: flex-start; padding: 6px 8px; border: 1px solid var(--line); border-radius: var(--r-md); cursor: pointer; }
    .r26-radio > span { display: grid; }
    .r26-swatches { display: flex; gap: 8px; flex-wrap: wrap; }
    .r26-sw { position: relative; }
    .r26-sw input { position: absolute; opacity: 0; width: 0; height: 0; }
    .r26-sw i { display: block; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 1px var(--line); cursor: pointer; }
    .r26-sw input:checked + i { box-shadow: 0 0 0 2px #111827; }
    .r26-sw input:focus-visible + i { outline: 2px solid #2563EB; outline-offset: 2px; }
    .r26-riderpick { display: grid; gap: 4px; max-height: 210px; overflow: auto; border: 1px solid var(--line); border-radius: var(--r-md); padding: 6px 8px; margin-bottom: 4px; }
    .r26-rp, .r26-check { display: flex; gap: 8px; align-items: center; }
    .r26-check { margin: 8px 0; }
    .r26-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .r26-shape { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 10px; background: #F9FAFB; border-radius: var(--r-md); margin-bottom: 8px; }
    .r26-pzones, .r26-dzone { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 6px 0; }
    .r26-map .leaflet-container { font: inherit; }
  `;
  document.head.appendChild(style);
})();
