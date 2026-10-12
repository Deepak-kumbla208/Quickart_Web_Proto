/* ====================================================================
   QuickKart prototype — Round 15 (12 October 2026): the RIDER APP, rebuilt
   as a phone app on the rider APIs the backend finished (P11-1 / P11-2 /
   P11-3, MRs !94 / !95 / !96, decisions D95 / D96 / D97). Every change of
   the day is here.

   Until now the rider portal was a desktop page with a top bar (Round 4,
   touched up in Round 7). It is now a real rider app — one phone-width
   screen with a bottom tab bar — so the frontend developer can build
   quickkart-delivery-partner from it. Nothing else in the prototype moves.

   A. Login = mobile number + 6-digit code (POST /rider/auth/otp/send and
      /otp/verify). No passwords, no sign-up: the shop adds its riders. An
      unknown number gets the same "code sent" answer but no code ever works.
      The code lasts 5 minutes, allows 3 tries, resend after 60 s.
      (Prototype only: the code is always 123456 — the dev servers do the
      same with DEV_FIXED_OTP — and demo riders can be tapped to fill in.)
   B. Deliveries tab — online / offline (POST /rider/availability: online
      starts a shift, offline ends it and gives the summary; offline with an
      order out is RIDER_ON_TRIP). The shift strip (deliveries, earnings,
      cash with you = GET /rider/me). Trips as GET /rider/deliveries gives
      them: express first, then one trip per slot, stops by postal code; each
      stop is Being packed / Ready to collect / On the way.
   C. One stop (GET /rider/deliveries/:id): customer, call, Navigate (Google
      Maps from the address — the real app uses lat/lng; the backend does
      no routing), the note, the cash to collect (the backend's figure, the
      rider cannot change it), the items. Order of work: Picked up from
      store (only when Ready) → report each item delivered / missing /
      damaged (only once picked up; can be changed until the order is
      delivered) → Delivered (every item reported; a cash order also needs
      "I collected the cash") or Couldn't deliver (reason 3–300 characters).
   D. History tab (GET /rider/deliveries/history): delivered and failed,
      newest first, paged — the fee and the cash taken. No rating.
   E. Me tab: profile, vehicle, trip size, home store (GET /rider/me), the
      shift figures, Go offline, notifications, Log out.
   F. Gone, because the API has nothing behind it: "Pause", the Earnings
      tab (today / week / month / all time, average rating), the amount-
      received box and change on cash. The fee is the shop's, per delivery.
   ==================================================================== */

/* ---------------- 0. Helpers ---------------- */
const R15_DEV_CODE = "123456";
Icon.navigate = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-8-8 18-2-8z"/></svg>';
Icon.refresh = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';

function r15Partner() { return State.session && State.session.partnerId != null ? findPartner(State.session.partnerId) : null; }
// What the rider hands over: a swapped line shows its replacement; removed or refunded lines are not listed (API: items).
function r15Lines(o) {
  const out = [];
  (o.items || []).forEach((it, idx) => {
    if (it.resolution === "removed") return;
    if (it.unavailable) {
      if (it.resolution === "swap" && it.changeRequest && it.changeRequest.altName) out.push({ idx, name: it.changeRequest.altName, unit: it.changeRequest.altUnit || "", qty: it.qty, mark: it.delivered || null });
      return;
    }
    out.push({ idx, name: it.name, unit: it.unit || "", qty: it.qty, mark: it.delivered || null });
  });
  return out;
}
function r15Units(o) { return r15Lines(o).reduce((s, l) => s + l.qty, 0); }
function r15MapsTo(text) { return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(text)}`; }
function r15StoreOf(o) { return findBranch(o.branchId) || null; }
function r15StoreMaps(b) {
  if (!b) return "#";
  return r15MapsTo(b.lat != null && b.lng != null ? `${b.lat},${b.lng}` : b.name);
}
function r15Name() { return (State.session && State.session.name) || "Rider"; }

/* ---------------- 1. Login: mobile + code ---------------- */
function r15Login() { return (UI.r15Login = UI.r15Login || { step: "mobile", mobile: "", error: null }); }
function r15SecsToResend(L) { return L.sentAt ? Math.max(0, Math.ceil((60000 - (Date.now() - L.sentAt)) / 1000)) : 0; }
function r15ResendLabel(L) { const s = r15SecsToResend(L); return s > 0 ? `Resend code in ${s} s` : "Resend code"; }

function r15LoginPage() {
  const L = r15Login();
  const demo = State.partners.filter((p) => p.active !== false && p.mobile).slice(0, 6);
  const tabs = [["customer", "Customer"], ["admin", "Admin"], ["delivery", "Delivery Partner"]];
  return `
  <div class="r15-stage"><div class="r15-phone r15-login">
    <div class="r15-login-top">
      <div class="brand-tile brand-tile-lg"><img src="${State.siteCustomization.branding.logoUrl}" alt="" /></div>
      <div class="r15-login-brand">QuickKart Rider</div>
      <div class="r15-login-sub">Deliver orders. Track your shift.</div>
    </div>
    <div class="r15-login-card">
      ${L.step === "mobile" ? `
      <form data-action="r15-send" novalidate>
        <div class="r15-h">Log in</div>
        <div class="qk-muted small" style="margin-bottom:12px">Enter the mobile number the shop gave for you. We'll text you a 6-digit code. There is no password and no sign-up — the shop adds its riders.</div>
        <label class="field"><span class="field-label">Mobile number</span>
          <div class="r15-phone-input"><span>+65</span><input class="input" name="mobile" inputmode="numeric" maxlength="8" autocomplete="tel-national" placeholder="8123 4567" value="${esc(L.mobile)}" /></div>
        </label>
        ${L.error ? `<div class="field-error">${esc(L.error)}</div>` : ""}
        <button class="btn btn-primary btn-lg btn-block" type="submit">Send code</button>
      </form>
      ${demo.length ? `
      <div class="r15-demo"><div class="small"><b>Prototype only</b> — tap a rider to fill the number. The code is always <b>${R15_DEV_CODE}</b> (a dev server does the same).</div>
        <div class="r15-demo-chips">${demo.map((p) => `<button type="button" class="fpill" data-action="r15-fill" data-mobile="${esc(p.mobile)}">${esc(p.name)} · ${esc(p.mobile)}</button>`).join("")}</div>
      </div>` : ""}
      ` : `
      <form data-action="r15-verify" novalidate>
        <div class="r15-h">Enter the code</div>
        <div class="qk-muted small" style="margin-bottom:12px">We sent a 6-digit code to <b>+65 ${esc(L.mobile)}</b>. It works once and lasts 5 minutes.</div>
        <label class="field"><span class="field-label">6-digit code</span><input class="input r15-code" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••" /></label>
        ${L.error ? `<div class="field-error">${esc(L.error)}</div>` : ""}
        <button class="btn btn-primary btn-lg btn-block" type="submit">Log in</button>
        <div class="r15-row-links">
          <button type="button" class="r15-link" id="r15Resend" data-action="r15-resend" ${r15SecsToResend(L) > 0 ? "disabled" : ""}>${r15ResendLabel(L)}</button>
          <button type="button" class="r15-link" data-action="r15-change-number">Change number</button>
        </div>
        <div class="qk-muted small" style="margin-top:10px">No code? Check the number, or ask the shop to add you — a number that isn't a rider gets no code.</div>
        <div class="qk-muted small" style="margin-top:6px">Prototype: the code is <b>${R15_DEV_CODE}</b>.</div>
      </form>`}
    </div>
    <div id="toastHolder" class="toast-holder"></div>
    <div class="r15-login-foot">Not a rider? ${tabs.filter((t) => t[0] !== "delivery").map((t) => `<button type="button" class="r15-link" data-action="set-login-role" data-role="${t[0]}">${t[1]} login</button>`).join(" · ")}</div>
  </div></div>`;
}
function r15SendCode(L) {
  const wait = r15SecsToResend(L);
  if (wait > 0) { L.error = `Wait ${wait} s before asking for another code.`; return false; }
  const p = State.partners.find((x) => x.active !== false && String(x.mobile) === L.mobile);
  Object.assign(L, { step: "code", sentAt: Date.now(), tries: 0, dead: false, error: null, riderId: p ? p.id : null });
  return true;
}
Actions["r15-fill"] = (el) => { const L = r15Login(); L.mobile = el.dataset.mobile; L.error = null; render(); };
Submits["r15-send"] = (form) => {
  const L = r15Login();
  L.mobile = String(new FormData(form).get("mobile") || "").replace(/\s/g, "");
  if (!/^[89]\d{7}$/.test(L.mobile)) { L.error = "Enter an 8-digit mobile number starting with 8 or 9."; render(); return; }
  r15SendCode(L); render();
};
Actions["r15-resend"] = () => {
  const L = r15Login();
  if (!r15SendCode(L)) { render(); return; }
  showToast("A new code was sent");
  render();
};
Actions["r15-change-number"] = () => { UI.r15Login = { step: "mobile", mobile: r15Login().mobile, error: null }; render(); };
Submits["r15-verify"] = (form) => {
  const L = r15Login();
  const code = String(new FormData(form).get("code") || "").trim();
  if (!/^\d{6}$/.test(code)) { L.error = "Enter the 6-digit code."; render(); return; }
  if (Date.now() - L.sentAt > 5 * 60000) { L.error = "That code has expired. Send a new one."; render(); return; }
  if (L.dead) { L.error = "Too many wrong tries — send a new code."; render(); return; }
  const p = L.riderId != null ? findPartner(L.riderId) : null;
  if (!p || p.active === false || code !== R15_DEV_CODE) {
    L.tries = (L.tries || 0) + 1;
    if (L.tries >= 3) { L.dead = true; L.error = "That code isn't right, and you've used all 3 tries. Send a new code."; }
    else L.error = `That code isn't right. ${3 - L.tries} ${3 - L.tries === 1 ? "try" : "tries"} left.`;
    render(); return;
  }
  State.session = { role: "delivery", name: p.name, partnerId: p.id };
  persist("session");
  UI.route = "delivery"; UI.r15Tab = "deliveries"; UI.r15Open = null; UI.r15Login = null;
  render();
};
// The resend countdown ticks without a re-render (so the code box keeps what was typed).
setInterval(() => {
  const el = document.getElementById("r15Resend");
  if (!el || !UI.r15Login) return;
  const secs = r15SecsToResend(UI.r15Login);
  el.disabled = secs > 0;
  el.textContent = r15ResendLabel(UI.r15Login);
}, 1000);
(() => {
  const login = window.viewLogin;
  window.viewLogin = () => (UI.loginRole === "delivery" ? r15LoginPage() : login());
  const setRole = Actions["set-login-role"];
  Actions["set-login-role"] = (el) => { if (el.dataset.role === "delivery") UI.r15Login = null; return setRole(el); };
})();

/* ---------------- 2. The trip model (the prototype's stand-in for rider_trips / rider_trip_stops) ---------------- */
const R15 = { RADIUS_M: 50, ACCURACY_M: 50, FAIL_WAIT_MIN: 5, BREAK_EVERY_MIN: 120, BREAK_MIN: 10, CASH_LIMIT: 300 };
// One trip per rider: { status: collecting | delivering | returning, firstPickupAt, startedAt, seq: [orderId…], cur: index }.
State.rtrips = loadLS("rtrips", {});
State.rdeposits = loadLS("rdeposits", []);          // cash handed in at the store
State.rbreaks = loadLS("rbreaks", {});              // { [partnerId]: { activeStart, lastEnd } }
State.rloc = loadLS("rloc", {});                    // the simulated phone location { [partnerId]: {lat,lng,acc,stale} }
const R15_DEFAULT_REASONS = ["Customer not available", "Wrong or incomplete address", "Customer refused the order", "Customer couldn't pay", "Can't find the location", "Other"];
State.failReasons = loadLS("failReasons", () => R15_DEFAULT_REASONS.map((label, i) => ({ id: i + 1, label, active: true })));
// Rider rules a shop can change (Business Settings): defaults are filled in once.
State.businessRules = { riderCashLimit: R15.CASH_LIMIT, riderBreakEveryMin: R15.BREAK_EVERY_MIN, riderBreakMin: R15.BREAK_MIN, ...State.businessRules };
const r15Rules = () => State.businessRules;
function r15SaveAll() { ["orders", "rtrips", "rdeposits", "rbreaks", "rloc", "failReasons", "readyQueue", "shiftStart"].forEach((k) => persist(k)); }

// A rider is assigned from Picking onward, not from Confirmed (decision 17): the assignable and rider stages lose "confirmed",
// and orders already assigned while confirmed are un-assigned once (the real migration does the same).
[RIDER_STAGES, ASSIGNABLE_STAGES].forEach((a) => { const i = a.indexOf("confirmed"); if (i >= 0) a.splice(i, 1); });
if (!loadLS("migrated_2026_10_r15", false)) {
  State.orders = State.orders.map((o) => (o.status === "confirmed" && o.deliveryPartnerId ? { ...o, deliveryPartnerId: null } : o));
  persist("orders"); saveLS("migrated_2026_10_r15", true);
}

const r15Tr = (pid) => State.rtrips[pid] || null;
const r15O = (id) => State.orders.find((o) => o.id === id);
function r15Patch(id, patch) { State.orders = State.orders.map((o) => (o.id === id ? { ...o, r15: { ...(o.r15 || {}), ...patch } } : o)); }
function r15SetStatus(id, status) { State.orders = State.orders.map((o) => (o.id === id ? { ...o, status, statusHistory: [...(o.statusHistory || []), { status, at: Date.now() }] } : o)); }
const r15Stage = (o) => (o.r15 && o.r15.stage) || "assigned";   // stop stage: assigned | picked_up | en_route | arrived | delivered | failed
// What the rider sees of an assigned, unpicked order: still being packed, or ready to collect.
const r15Pack = (o) => (o.status === "ready_for_rider" ? "ready" : "packing");
function r15Pin(o) {   // the customer's pin (the prototype derives one near the shop from the postal code)
  const b = findBranch(o.branchId) || State.branches[0] || { lat: 1.35, lng: 103.82 };
  let h = 0; for (const c of postalOf(o) || "000000") h = (h * 31 + c.charCodeAt(0)) % 9973;
  return { lat: b.lat + ((h % 200) - 100) / 100 * 0.025, lng: b.lng + (((h * 7) % 200) - 100) / 100 * 0.025 };
}
function r15StorePin(o) { const b = findBranch(o.branchId) || State.branches[0] || { lat: 1.35, lng: 103.82 }; return { lat: b.lat, lng: b.lng }; }
function r15Meters(a, b) {
  const R = 6371000, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function r15Loc(pid) { const p = findPartner(pid); const b = p && findBranch(p.branchId); return State.rloc[pid] || { lat: b ? b.lat : 1.35, lng: b ? b.lng : 103.82, acc: 8, stale: false }; }
// Decision 23: confirmed only when ≤ 50 m, accuracy ≤ 50 m and the fix is fresh; otherwise a plain reason.
function r15Gps(pid, pin) {
  const loc = r15Loc(pid), d = Math.round(r15Meters(loc, pin));
  if (loc.stale) return { ok: false, code: "FIX_STALE", dist: d, msg: "Your phone's location is out of date — wait a few seconds or move to open sky." };
  if (loc.acc > R15.ACCURACY_M) return { ok: false, code: "GPS_WEAK", dist: d, msg: "Your phone's location is weak (about " + Math.round(loc.acc) + " m off)." };
  if (d > R15.RADIUS_M) return { ok: false, code: "TOO_FAR", dist: d, msg: "You are about " + (Math.round(d / 10) * 10) + " m from the pin." };
  return { ok: true, dist: d };
}
function r15Cash(pid) {   // cash collected and not yet settled by a deposit (decision 24)
  const got = State.orders.filter((o) => o.deliveryPartnerId === pid && o.cashCollected && o.cashCollected.by === "rider").reduce((s, o) => s + o.cashCollected.amount, 0);
  const dep = State.rdeposits.filter((d) => d.partnerId === pid).reduce((s, d) => s + d.expected, 0);
  const held = Math.max(round2(got - dep), 0), limit = Number(r15Rules().riderCashLimit) || R15.CASH_LIMIT;
  return { held, limit, state: held > limit ? "over" : held >= limit * 0.8 ? "near" : "ok" };
}
function r15Assigned(pid) { return riderOpenOrders(pid); }
function r15Online(pid) { return !!State.shiftStart[pid]; }
function r15OnBreak(pid) { const b = State.rbreaks[pid]; if (!b || !b.activeStart) return false; if (Date.now() - b.activeStart >= Number(r15Rules().riderBreakMin) * 60000) { State.rbreaks = { ...State.rbreaks, [pid]: { lastEnd: b.activeStart + Number(r15Rules().riderBreakMin) * 60000, activeStart: null } }; persist("rbreaks"); r15Requeue(pid); return false; } return true; }
function r15Requeue(pid) {   // back in the dispatch queue unless busy, on break, or over the cash limit
  const p = findPartner(pid); if (!p || !p.branchId || !r15Online(pid)) return;
  if (r15Tr(pid) || r15OnBreak(pid) || r15Cash(pid).state === "over") return;
  const q = State.readyQueue[p.branchId] ? [...State.readyQueue[p.branchId]] : [];
  if (!q.includes(pid)) q.push(pid);
  State.readyQueue = { ...State.readyQueue, [p.branchId]: q }; persist("readyQueue");
}
function r15Unqueue(pid) { const p = findPartner(pid); if (!p) return; State.readyQueue = { ...State.readyQueue, [p.branchId]: (State.readyQueue[p.branchId] || []).filter((id) => id !== pid) }; persist("readyQueue"); }
function r15BreakInfo(pid) {   // why the break button is (not) available — always said in words
  const b = State.rbreaks[pid] || {}, every = Number(r15Rules().riderBreakEveryMin) * 60000;
  if (!r15Online(pid)) return { ok: false, why: "Go online first" };
  if (r15Tr(pid) || riderOnTrip(pid)) return { ok: false, why: "Finish your trip first" };
  const since = Math.max(State.shiftStart[pid] || 0, b.lastEnd || 0), left = since + every - Date.now();
  if (left > 0) return { ok: false, why: "Available in " + Math.ceil(left / 60000) + " min" };
  return { ok: true, why: "" };
}
// Start delivery is blocked while an assigned order is not picked up; say which one (startBlockedBy).
function r15Blocker(pid) {
  const tr = r15Tr(pid); if (!tr) return null;
  const left = r15Assigned(pid).filter((o) => r15Stage(o) === "assigned");
  if (!left.length) return null;
  const o = left[0];
  return { order: o, stage: r15Pack(o), minutes: Math.floor((Date.now() - (tr.firstPickupAt || Date.now())) / 60000) };
}
// The fixed order (decision 4): express, then slot, then nearest-next from the previous stop.
function r15Sequence(pid, ids) {
  const p = findPartner(pid), b = findBranch(p.branchId) || State.branches[0];
  const orders = ids.map(r15O);
  const groups = new Map(); orders.forEach((o) => { const k = tripKey(o); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); });
  const keys = [...groups.keys()].sort((a, c) => (a === "express" ? -1 : c === "express" ? 1 : a.localeCompare(c)));
  let at = { lat: b.lat, lng: b.lng }; const out = [];
  keys.forEach((k) => { const rest = [...groups.get(k)]; while (rest.length) { rest.sort((x, y) => r15Meters(at, r15Pin(x)) - r15Meters(at, r15Pin(y))); const n = rest.shift(); out.push(n.id); at = r15Pin(n); } });
  return out;
}
function r15Etc(o) { return o.r15 && o.r15.enRouteAt; }

/* ---------------- 3. Actions of the trip ---------------- */
function r15TakePhoto(purpose, orderId, next) { UI.modal = { type: "r15Photo", purpose, orderId, next, photo: null, state: "idle" }; render(); }
Actions["r15-pickup-open"] = (el) => {
  const o = r15O(el.dataset.id), pid = State.session.partnerId;
  if (!o) return;
  if (r15Pack(o) !== "ready") { showToast("The store is still packing it — you can't collect it yet", "danger"); return; }
  if (!r15Tr(pid) && r15Cash(pid).state === "over") { showToast("You are holding S$" + r15Cash(pid).held.toFixed(2) + ". Hand it to store staff before your next delivery.", "danger"); return; }
  r15TakePhoto("pickup", o.id, "pickup");
};
function r15DoPickup(orderId, photo) {
  const pid = State.session.partnerId, tr = r15Tr(pid) || { status: "collecting", firstPickupAt: Date.now(), seq: [], cur: 0 };
  r15Patch(orderId, { stage: "picked_up", pickupPhoto: photo, pickedAt: Date.now() });
  State.rtrips = { ...State.rtrips, [pid]: tr }; r15Unqueue(pid); r15SaveAll();
  showToast("Order collected — pick up the next one, or press Start delivery");
}
Actions["r15-start"] = () => {
  const pid = State.session.partnerId, tr = r15Tr(pid);
  if (!tr || tr.status !== "collecting") return;
  const bl = r15Blocker(pid);
  if (bl) { showToast("Waiting for order #" + bl.order.id + " — ask the store if this takes long", "danger"); return; }
  const ids = r15Assigned(pid).filter((o) => r15Stage(o) === "picked_up").map((o) => o.id);
  if (!ids.length) return;
  const seq = r15Sequence(pid, ids);
  ids.forEach((id) => r15SetStatus(id, "picked_up"));   // the customer is told "out for delivery" only now (decision 27)
  r15Patch(seq[0], { stage: "en_route", enRouteAt: Date.now() });
  State.rtrips = { ...State.rtrips, [pid]: { ...tr, status: "delivering", startedAt: Date.now(), seq, cur: 0 } };
  r15SaveAll(); render(); showToast("Delivery started — customer 1 of " + seq.length);
};
Actions["r15-next-stop"] = () => {
  const pid = State.session.partnerId, tr = r15Tr(pid); if (!tr || tr.status !== "delivering") return;
  r15Patch(tr.seq[tr.cur], { stage: "en_route", enRouteAt: Date.now() });
  r15SaveAll(); render();
};
function r15Advance(pid) {   // after a stop is finished
  const tr = r15Tr(pid), next = tr.cur + 1;
  State.rtrips = { ...State.rtrips, [pid]: next < tr.seq.length ? { ...tr, cur: next } : { ...tr, status: "returning", cur: tr.seq.length } };
  r15SaveAll();
}
const r15Cur = (pid) => { const tr = r15Tr(pid); return tr && tr.status === "delivering" ? r15O(tr.seq[tr.cur]) : null; };
// Arrival: a live GPS check (the real app sends it as the pings arrive); the fallback is always offered while blocked.
function r15CheckArrival(pid, silent) {
  const o = r15Cur(pid); if (!o || r15Stage(o) !== "en_route") return false;
  const g = r15Gps(pid, r15Pin(o)); if (!g.ok) return false;
  r15Patch(o.id, { stage: "arrived", arrivedAt: Date.now(), arrivedBy: "gps", arrivedDist: g.dist, arrivedAcc: Math.round(r15Loc(pid).acc) });
  r15SaveAll(); if (!silent) showToast("You've arrived"); return true;
}
Actions["r15-manual-arrive-open"] = () => { UI.modal = { type: "r15Manual", reason: "", error: null }; render(); };
Actions["r15-manual-pick"] = (el) => { UI.modal = { ...UI.modal, reason: el.dataset.reason, error: null }; render(); };
Submits["r15-manual-arrive"] = (form) => {
  const pid = State.session.partnerId, o = r15Cur(pid), reason = String(new FormData(form).get("reason") || "").trim();
  if (!o) { UI.modal = null; render(); return; }
  if (reason.length < 3) { UI.modal = { ...UI.modal, reason, error: "Give a reason (at least 3 characters)" }; render(); return; }
  const g = r15Gps(pid, r15Pin(o));
  r15Patch(o.id, { stage: "arrived", arrivedAt: Date.now(), arrivedBy: "manual", arrivedNote: reason, arrivedDist: g.dist, arrivedAcc: Math.round(r15Loc(pid).acc), arrivedCode: g.ok ? null : g.code });
  UI.modal = null; r15SaveAll(); render(); showToast("Arrival recorded — the store can see it");
};
Actions["r15-issue-open"] = () => { UI.modal = { type: "r15Issue", idx: null, qty: 1, kind: "missing", error: null }; render(); };
Actions["r15-issue-pick"] = (el) => { UI.modal = { ...UI.modal, idx: Number(el.dataset.idx), qty: 1, error: null }; render(); };
Actions["r15-issue-qty"] = (el) => { const o = r15Cur(State.session.partnerId); const l = o && r15Lines(o).find((x) => x.idx === UI.modal.idx); if (!l) return; const q = Math.min(Math.max(UI.modal.qty + Number(el.dataset.d), 1), l.qty); UI.modal = { ...UI.modal, qty: q }; render(); };
Actions["r15-issue-kind"] = (el) => { UI.modal = { ...UI.modal, kind: el.dataset.kind }; render(); };
Actions["r15-issue-save"] = () => {
  const o = r15Cur(State.session.partnerId), m = UI.modal; if (!o) return;
  if (m.idx == null) { UI.modal = { ...m, error: "Pick the product first" }; render(); return; }
  const l = r15Lines(o).find((x) => x.idx === m.idx), issues = [...((o.r15 && o.r15.issues) || [])];
  if (issues.length >= 20) { UI.modal = { ...m, error: "That is the most you can report for one order" }; render(); return; }
  issues.push({ idx: m.idx, name: l.name, qty: m.qty, kind: m.kind, at: Date.now() });
  r15Patch(o.id, { issues }); UI.modal = null; r15SaveAll(); render(); showToast("Reported to the store — no money moves");
};
Actions["r15-delivered"] = () => {
  const pid = State.session.partnerId, o = r15Cur(pid); if (!o) return;
  if (r15Stage(o) !== "arrived") { showToast("You haven't arrived yet", "danger"); return; }
  if (!(o.r15 && o.r15.deliveryPhoto)) { r15TakePhoto("delivery", o.id, "delivered"); return; }
  if (isCod(o) && !o.cashCollected) { UI.modal = { type: "r15Cash", orderId: o.id }; render(); return; }
  r15Finish(o);
};
function r15Finish(o) {
  const pid = State.session.partnerId;
  Actions["complete-delivery"]({ dataset: { id: o.id } });   // status delivered + the fee, as the shop's rules say
  r15Patch(o.id, { stage: "delivered", deliveredAt: Date.now() });
  r15Advance(pid); UI.modal = null; render();
  const d = r15O(o.id); showToast("Delivered · you earned " + money(d && d.riderEarning));
}
Actions["r15-cash-yes"] = () => {
  const o = r15O(UI.modal && UI.modal.orderId); if (!o) { UI.modal = null; render(); return; }
  State.orders = State.orders.map((x) => (x.id === o.id ? { ...x, cashCollected: { amount: cashToCollect(o), received: cashToCollect(o), at: Date.now(), by: "rider", byName: r15Name() } } : x));
  persist("orders"); r15Finish(o);
};
Actions["r15-fail-open"] = () => {
  const pid = State.session.partnerId, o = r15Cur(pid); if (!o || r15Stage(o) !== "arrived") return;
  const waited = Date.now() - (o.r15.arrivedAt || 0), need = R15.FAIL_WAIT_MIN * 60000;
  if (waited < need) { showToast("Wait at the door a little longer — " + Math.ceil((need - waited) / 60000) + " min left before you can report this", "danger"); return; }
  UI.modal = { type: "r15Fail", orderId: o.id, reasonId: null, note: "", error: null }; render();
};
Actions["r15-fail-reason"] = (el) => { UI.modal = { ...UI.modal, reasonId: Number(el.dataset.id), note: (document.querySelector("[name=note]") || {}).value || UI.modal.note, error: null }; render(); };
Submits["r15-fail-submit"] = (form) => {
  const m = UI.modal, note = String(new FormData(form).get("note") || "").trim().slice(0, 200), r = State.failReasons.find((x) => x.id === m.reasonId);
  if (!r) { UI.modal = { ...m, note, error: "Pick a reason" }; render(); return; }
  if (r.label === "Other" && note.length < 3) { UI.modal = { ...m, note, error: "Say what happened (at least 3 characters)" }; render(); return; }
  if (!m.confirmed) { UI.modal = { ...m, note, confirmed: true }; render(); return; }
  const pid = State.session.partnerId, o = r15O(m.orderId);
  const ok = failDelivery(m.orderId, r.label + (note ? " · " + note : ""), r15Name());
  r15Patch(m.orderId, { stage: "failed", failedAt: Date.now(), failLabel: r.label, failNote: note });
  if (ok && o) r15Advance(pid);
  UI.modal = null; render(); showToast("Reported as not delivered — the store takes it from here");
};
Actions["r15-back-store"] = () => {
  const pid = State.session.partnerId, tr = r15Tr(pid); if (!tr || tr.status !== "returning") return;
  const o = r15O(tr.seq[0]), g = r15Gps(pid, r15StorePin(o));
  if (!g.ok) { UI.modal = { type: "r15StoreFar", g, reason: "", error: null }; render(); return; }
  r15CloseTrip(pid, "gps");
};
Submits["r15-store-manual"] = (form) => {
  const pid = State.session.partnerId, reason = String(new FormData(form).get("reason") || "").trim();
  if (reason.length < 3) { UI.modal = { ...UI.modal, error: "Give a reason (at least 3 characters)" }; render(); return; }
  r15CloseTrip(pid, "manual", reason);
};
function r15CloseTrip(pid, by, note) {
  const { [pid]: gone, ...rest } = State.rtrips; State.rtrips = rest;
  UI.modal = null; r15Requeue(pid); r15SaveAll(); render();
  const c = r15Cash(pid);
  showToast(c.state === "over" ? "Back at store — hand in your cash (S$" + c.held.toFixed(2) + ") before your next order" : "Back at store" + (by === "manual" ? " — recorded for the store" : ""));
}

/* ---------------- 4. Online, offline, break ---------------- */
Actions["r15-online"] = () => {
  const p = r15Partner(); if (!p || !p.branchId) return;
  Actions["go-ready"](); r15Requeue(p.id); showToast("You're online — the shop can now give you orders");
};
Actions["r15-offline-ask"] = () => {
  const p = r15Partner(); if (!p) return;
  UI.modal = (r15Tr(p.id) || riderOnTrip(p.id)) ? { type: "r15Blocked" } : { type: "r15Offline" }; render();
};
Actions["r15-offline-confirm"] = () => {
  const p = r15Partner(); if (!p) return;
  if (r15Tr(p.id) || riderOnTrip(p.id)) { UI.modal = { type: "r15Blocked" }; render(); return; }
  const startedAt = State.shiftStart[p.id] || null, st = riderShiftStats(p.id, startedAt), c = r15Cash(p.id);
  r15Unqueue(p.id);
  State.shiftStart = { ...State.shiftStart, [p.id]: null }; State.rbreaks = { ...State.rbreaks, [p.id]: {} }; r15SaveAll();
  UI.modal = { type: "r15Summary", startedAt, endedAt: Date.now(), deliveries: st.deliveries, earnings: st.earnings, cash: c.held };
  render();
};
Actions["r15-break-start"] = () => {
  const pid = State.session.partnerId, bi = r15BreakInfo(pid);
  if (!bi.ok) { showToast(bi.why, "danger"); return; }
  State.rbreaks = { ...State.rbreaks, [pid]: { ...(State.rbreaks[pid] || {}), activeStart: Date.now() } }; r15Unqueue(pid); r15SaveAll(); render();
};
Actions["r15-break-end"] = () => {
  const pid = State.session.partnerId;
  State.rbreaks = { ...State.rbreaks, [pid]: { lastEnd: Date.now(), activeStart: null } }; persist("rbreaks"); r15Requeue(pid); render();
};

/* ---------------- 5. Photos ---------------- */
function r15SamplePhoto(label) {
  const c = document.createElement("canvas"); c.width = 240; c.height = 180; const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 240, 180); grad.addColorStop(0, "#1173C4"); grad.addColorStop(1, "#003D72");
  g.fillStyle = grad; g.fillRect(0, 0, 240, 180); g.fillStyle = "rgba(255,255,255,.9)"; g.font = "bold 16px sans-serif"; g.fillText(label, 14, 84);
  g.font = "12px sans-serif"; g.fillText(new Date().toLocaleString("en-SG"), 14, 108); g.fillText("sample photo (prototype)", 14, 160);
  return c.toDataURL("image/jpeg", 0.6);
}
Actions["r15-photo-sample"] = () => { UI.modal = { ...UI.modal, photo: r15SamplePhoto(UI.modal.purpose === "pickup" ? "Packed bag" : "Delivered at the door"), state: "ready" }; render(); };
Actions["r15-photo-file"] = (el) => {
  const f = el.files && el.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, 320 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); UI.modal = { ...UI.modal, photo: c.toDataURL("image/jpeg", 0.6), state: "ready" }; render(); }; img.src = rd.result; };
  rd.readAsDataURL(f);
};
Actions["r15-photo-use"] = () => {   // "upload": a moment of waiting, and a way to see a failed upload
  const m = UI.modal; if (!m.photo) return;
  UI.modal = { ...m, state: "uploading" }; render();
  setTimeout(() => {
    if (!UI.modal || UI.modal.type !== "r15Photo") return;
    if (UI.r15FailUpload) { UI.modal = { ...UI.modal, state: "failed" }; render(); return; }
    const mm = UI.modal; UI.modal = null;
    if (mm.next === "pickup") r15DoPickup(mm.orderId, mm.photo);
    else if (mm.next === "delivered") { r15Patch(mm.orderId, { deliveryPhoto: mm.photo, deliveryPhotoAt: Date.now() }); persist("orders"); }
    render();
  }, 700);
};
Actions["r15-photo-retake"] = () => { UI.modal = { ...UI.modal, photo: null, state: "idle" }; render(); };
function r15PhotoSheet() {
  const m = UI.modal, o = r15O(m.orderId), title = m.purpose === "pickup" ? "Photo of the packed order" : "Photo of the delivery";
  const hint = m.purpose === "pickup" ? "Take a clear photo of the bag before you take it." : "Take a photo that shows where you left it, or the handover.";
  return r15Sheet(`${title} · #${esc(m.orderId)}`, `
    <div class="qk-muted small" style="margin-bottom:10px">${hint} Only the store and admin can see it (kept 90 days).</div>
    ${m.photo ? `<img class="r15-photo-prev" src="${m.photo}" alt="" />` : `<div class="r15-photo-empty">${ic("package")}<span>No photo yet</span></div>`}
    ${m.state === "uploading" ? `<div class="notice" style="margin:10px 0">${ic("clock")}<span>Uploading… stay on this screen.</span></div>` : ""}
    ${m.state === "failed" ? `<div class="notice notice-danger" style="margin:10px 0">${ic("alert")}<span>Your photo has not reached us yet — stay on this screen and try again. Poor signal? Move closer to a window or call the store.</span></div>` : ""}
    ${!m.photo ? `
      <label class="btn btn-primary btn-lg btn-block r15-file">${ic("package")} Take a photo<input type="file" accept="image/*" capture="environment" data-action="r15-photo-file" hidden /></label>
      <button class="btn btn-outline btn-block" style="margin-top:8px" data-action="r15-photo-sample">Use a sample photo (prototype)</button>`
    : `<button class="btn btn-primary btn-lg btn-block" data-action="r15-photo-use" ${m.state === "uploading" ? "disabled" : ""}>${m.state === "failed" ? "Try again" : "Use this photo"}</button>
       <button class="btn btn-outline btn-block" style="margin-top:8px" data-action="r15-photo-retake" ${m.state === "uploading" ? "disabled" : ""}>Retake</button>`}`);
}

/* ---------------- 6. The shell and the four tabs ---------------- */
window.viewRiderShell = function () {
  const p = r15Partner();
  if (!p) return `<div class="r15-stage"><div class="r15-phone"><div class="r15-main"><div class="empty-state"><div class="empty-title">This rider is no longer active</div><button class="btn btn-primary" data-action="logout">Log in again</button></div></div></div></div>`;
  const online = r15Online(p.id), store = findBranch(p.branchId), onBreak = r15OnBreak(p.id);
  const tab = UI.r15Tab || "deliveries", cur = r15Cur(p.id);
  const tabs = [["deliveries", "Deliveries", "truck"], ["earnings", "Earnings", "wallet"], ["history", "History", "receipt"], ["me", "Me", "user"]];
  const body = tab === "earnings" ? r15EarningsView(p) : tab === "history" ? r15HistoryView(p) : tab === "me" ? r15MeView(p, online, store) : r15DeliveriesView(p, online, store, onBreak);
  const open = (r15Assigned(p.id).length) + (r15Tr(p.id) ? 0 : 0);
  return `
  <div class="r15-stage"><div class="r15-phone">
    <header class="r15-head">
      <div class="brand-tile"><img src="${State.siteCustomization.branding.logoUrl}" alt="" /></div>
      <div class="r15-head-title"><div class="r15-head-name">${esc(p.name)}</div><div class="r15-head-sub">${esc(store ? store.name : "No store")}${onBreak ? " · On break" : ""}</div></div>
      <button class="r15-head-btn" data-action="r15-refresh" aria-label="Refresh">${ic("refresh")}</button>
      <button class="r15-switch ${online ? "on" : ""}" data-action="${online ? "r15-offline-ask" : "r15-online"}" aria-label="${online ? "Go offline" : "Go online"}"><span class="r15-switch-dot"></span>${onBreak ? "Break" : online ? "Online" : "Offline"}</button>
    </header>
    <main class="r15-main">${body}</main>
    <nav class="r15-tabs">${tabs.map(([k, label, icon]) => `<button class="r15-tab ${tab === k ? "on" : ""}" data-action="r15-tab" data-tab="${k}">${ic(icon)}<span>${label}</span>${k === "deliveries" && open ? `<i class="r15-badge">${open}</i>` : ""}</button>`).join("")}</nav>
  </div></div>
  <div id="toastHolder" class="toast-holder"></div>
  ${modalLayer()}`;
};
Actions["r15-tab"] = (el) => { UI.r15Tab = el.dataset.tab; render(); };
Actions["r15-refresh"] = () => { render(); showToast("Up to date"); };

function r15CashBar(pid) {
  const c = r15Cash(pid), pct = Math.min(100, Math.round(c.held / c.limit * 100));
  const msg = c.state === "over" ? "Over the limit. Finish your trip, then hand the cash to store staff before your next order." : c.state === "near" ? "Nearly at your cash limit. Over it, you must hand cash in after returning to the store." : "";
  return `<div class="r15-cashbar ${c.state}"><div class="r15-cashbar-top"><span>${ic("wallet")} Cash with you</span><b>${money(c.held)} <i>of ${money(c.limit)}</i></b></div><div class="r15-progress"><i style="width:${pct}%"></i></div>${msg ? `<div class="r15-cashbar-msg">${msg}</div>` : ""}</div>`;
}
function r15ShiftStrip(p) {
  const startedAt = State.shiftStart[p.id], st = riderShiftStats(p.id, startedAt);
  return `<div class="r15-shift"><div class="r15-shift-top">${ic("clock")} Online since ${fmtTime(startedAt)}</div>
    <div class="r15-shift-grid"><div><b>${st.deliveries}</b><span>Deliveries</span></div><div><b>${money(st.earnings)}</b><span>Earned</span></div><div><b>${fmtDuration(Date.now() - startedAt)}</b><span>On shift</span></div></div></div>`;
}
function r15BreakCard(p, onBreak) {
  if (onBreak) {
    const b = State.rbreaks[p.id], left = Math.max(0, Number(r15Rules().riderBreakMin) * 60000 - (Date.now() - b.activeStart));
    return `<div class="r15-break on"><div><b>You're on a break</b><div class="qk-muted small">No new orders until it ends. It ends by itself.</div></div><div class="r15-break-clock" id="r15BreakLeft">${r15Mmss(left)}</div></div><button class="btn btn-primary btn-block" style="margin-top:10px" data-action="r15-break-end">Back online</button>`;
  }
  const bi = r15BreakInfo(p.id);
  return `<div class="r15-break"><div><b>Take a break</b><div class="qk-muted small">${Number(r15Rules().riderBreakMin)} minutes, once every ${Number(r15Rules().riderBreakEveryMin) / 60} hours online.</div></div><button class="btn ${bi.ok ? "btn-primary" : "btn-outline"} btn-sm" data-action="r15-break-start" ${bi.ok ? "" : "aria-disabled=\"true\""}>${bi.ok ? "Take a break" : esc(bi.why)}</button></div>`;
}
const r15Mmss = (ms) => { const s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };

function r15DeliveriesView(p, online, store, onBreak) {
  const tr = r15Tr(p.id), assigned = r15Assigned(p.id);
  let body = "";
  if (!online && !assigned.length) {
    body = `<div class="r15-offline-card"><div class="r15-offline-ico">${ic("truck")}</div><div class="r15-h">You're offline</div><div class="qk-muted small">Go online so the shop can give you orders. Your ${esc(p.vehicle || "vehicle")} carries ${riderCapacity(p)} order${riderCapacity(p) === 1 ? "" : "s"} per trip.</div><button class="btn btn-primary btn-lg btn-block" data-action="r15-online" style="margin-top:12px">Go online</button></div>`;
  } else if (onBreak) {
    body = r15BreakCard(p, true);
  } else if (tr && tr.status === "delivering") body = r15StopView(p, tr);
  else if (tr && tr.status === "returning") body = r15ReturnView(p, tr);
  else if (assigned.length) body = r15AssignedView(p, tr, assigned);
  else body = `<div class="empty-state"><div class="empty-title">No deliveries right now</div><div class="empty-hint">You're online — you'll get a "New delivery" alert when the shop gives you an order.</div></div>`;
  const showTop = online && !onBreak;
  return `${showTop ? r15ShiftStrip(p) : ""}${online ? r15CashBar(p.id) : ""}${body}${online && !onBreak && !tr ? r15BreakCard(p, false) : ""}${r15Demo(p)}`;
}

// 1. Assigned: items and the order number, a rough area, never a street, a name or a phone.
function r15AssignedView(p, tr, assigned) {
  const bl = r15Blocker(p.id), allPicked = tr && assigned.every((o) => r15Stage(o) === "picked_up");
  const over = !tr && r15Cash(p.id).state === "over";
  return `
  <div class="qk-muted small" style="margin:12px 2px 6px">${assigned.length} order${assigned.length === 1 ? "" : "s"} for you · collect each at <b>${esc((findBranch(p.branchId) || {}).name || "the store")}</b>
    <a class="r15-linkbtn" href="${r15StoreMaps(findBranch(p.branchId))}" target="_blank" rel="noopener">${ic("navigate")} Navigate</a></div>
  ${over ? `<div class="notice notice-danger" style="margin-bottom:10px">${ic("wallet")}<span>You are holding ${money(r15Cash(p.id).held)}. Hand it to store staff, who will record it, before your next delivery.</span></div>` : ""}
  ${assigned.map((o) => r15AssignedCard(o)).join("")}
  <div class="r15-startbar">
    ${bl ? `<div class="r15-wait">${ic("clock")}<span>Waiting for order #${esc(bl.order.id)} — ${bl.stage === "ready" ? "ready to collect, pick it up" : "still being packed"}. ${bl.minutes >= 1 ? `Waiting ${bl.minutes} min. ` : ""}Ask the store if this takes long. Waiting doesn't cost you anything.</span></div>` : ""}
    <button class="btn btn-primary btn-lg btn-block" data-action="r15-start" ${allPicked && !bl ? "" : "disabled"}>Start delivery</button>
  </div>`;
}
function r15AssignedCard(o) {
  const st = r15Stage(o), picked = st !== "assigned", ready = r15Pack(o) === "ready";
  const lines = r15Lines(o), express = orderKind(o) === "express";
  return `<div class="r15-card r15-order">
    <div class="r15-order-top"><b>#${esc(o.id)}</b>${express ? `<span class="badge badge-red-soft">Express</span>` : `<span class="badge badge-gray-soft">${esc(tripLabel(tripKey(o)))}</span>`}
      <span class="badge badge-${picked ? "green" : ready ? "blue" : "gray"}-soft">${picked ? "Picked up ✓" : ready ? "Ready to collect" : "Being packed"}</span></div>
    <div class="qk-muted small">Area ${esc((postalOf(o) || "").slice(0, 2) || "—")} · ${r15Units(o)} item${r15Units(o) === 1 ? "" : "s"}</div>
    <div class="r15-items">${lines.map((l) => `<div><b>${l.qty} ×</b> ${esc(l.name)}</div>`).join("")}</div>
    ${picked ? `<div class="r15-thumb"><img src="${(o.r15 && o.r15.pickupPhoto) || ""}" alt="" /><span class="qk-muted small">Pickup photo sent</span></div>`
      : `<button class="btn ${ready ? "btn-primary" : "btn-outline"} btn-block" data-action="r15-pickup-open" data-id="${esc(o.id)}" ${ready ? "" : "disabled"}>${ready ? "Pick up" : "Wait for the store to pack it"}</button>`}
  </div>`;
}

// 2. The current stop, in full. Later stops: postal sector, item count, a tag — nothing else.
function r15StopView(p, tr) {
  const o = r15Cur(p.id), st = r15Stage(o), n = tr.cur + 1, total = tr.seq.length;
  const lines = r15Lines(o), g = r15Gps(p.id, r15Pin(o)), cod = isCod(o), due = cod ? cashToCollect(o) : 0, issues = (o.r15 && o.r15.issues) || [];
  const express = orderKind(o) === "express";
  const waited = st === "arrived" ? Date.now() - (o.r15.arrivedAt || 0) : 0, failLeft = Math.max(0, R15.FAIL_WAIT_MIN * 60000 - waited);
  const hasPhoto = !!(o.r15 && o.r15.deliveryPhoto);
  if (st === "picked_up") {   // between stops: the "Go to customer N" button
    return `<div class="r15-next">${ic("truck")}<div class="r15-h">Customer ${n} of ${total}</div><div class="qk-muted small">${express ? "Express · " : ""}Area ${esc((postalOf(o) || "").slice(0, 2))} · ${r15Units(o)} item${r15Units(o) === 1 ? "" : "s"}</div>
      <button class="btn btn-primary btn-lg btn-block" style="margin-top:14px" data-action="r15-next-stop">Go to customer ${n}</button></div>${r15LaterStops(tr, 1)}`;
  }
  return `
  <div class="r15-stophead"><b>Customer ${n} of ${total}</b>${express ? `<span class="badge badge-red-soft">Express</span>` : ""}<span class="qk-muted small">#${esc(o.id)}</span></div>
  <div class="r15-stagebar ${st === "arrived" ? "r15-stage-on_the_way" : g.ok ? "r15-stage-ready" : "r15-stage-being_packed"}" id="r15Banner">
    ${st === "arrived" ? `${ic("check")}<span><b>You've arrived</b>${o.r15.arrivedBy === "manual" ? " (confirmed by you — the store can see it)" : ""}.</span>`
      : `${ic("pin")}<span><b>On the way.</b> <span id="r15Dist">${g.ok ? "You're at the pin — arriving…" : esc(g.msg)}</span></span>`}
  </div>
  ${st === "en_route" ? `<button class="r15-link r15-linkwide" data-action="r15-manual-arrive-open">I'm here but the app can't tell</button>` : ""}
  <div class="r15-card">
    <div class="r15-card-title">Customer</div>
    <div class="r15-cust"><div><b>${esc(o.contactName || o.customerName)}</b>${o.contactMobile ? `<div class="qk-muted small">${fmtMobile(o.contactMobile)}</div>` : ""}</div>${o.contactMobile ? `<a class="r15-roundbtn" href="${telHref("+65" + o.contactMobile)}" aria-label="Call">${ic("phone")}</a>` : ""}</div>
    <div class="r15-addr">${ic("pin")}<span>${esc(o.address)}</span></div>
    <a class="r15-navbtn r15-navbtn-wide" href="${r15MapsTo(o.address)}" target="_blank" rel="noopener">${ic("navigate")} Navigate</a>
    ${o.deliveryInstructions ? `<div class="notice notice-warn" style="margin-top:10px">${ic("bell")}<span>${esc(o.deliveryInstructions)}</span></div>` : ""}
  </div>
  ${cod ? `<div class="r15-cash">${ic("wallet")}<div><div class="small">Collect in cash at the door</div><b>${money(due)}</b></div><span class="small">The shop worked this out — you can't change it.</span></div>` : `<div class="r15-paid">${ic("check")} Paid online — no cash to collect</div>`}
  <div class="r15-card">
    <div class="r15-card-title"><span>Items</span><span class="qk-muted small">${r15Units(o)} item${r15Units(o) === 1 ? "" : "s"}</span></div>
    ${lines.map((l) => `<div class="r15-line"><div class="r15-line-name"><b>${l.qty} ×</b> ${esc(l.name)}</div></div>`).join("")}
    ${issues.length ? `<div class="r15-issues">${issues.map((i) => `<div class="r15-issue">${ic("alert")}<span>${i.qty} × ${esc(i.name)} — <b>${i.kind}</b></span></div>`).join("")}</div>` : ""}
    <button class="r15-link" data-action="r15-issue-open">Missing / damaged item?</button>
  </div>
  ${st === "arrived" ? `<div class="r15-card"><div class="r15-card-title">Delivery photo</div>
      ${hasPhoto ? `<div class="r15-thumb"><img src="${o.r15.deliveryPhoto}" alt="" /><button class="r15-link" data-action="r15-delivered">Retake</button></div>` : `<div class="qk-muted small">Take a photo before you press Delivered.</div>`}
    </div>` : ""}
  ${r15LaterStops(tr, 1)}
  <div class="r15-actionbar r15-actionbar-flow">
    <button class="btn btn-outline-danger" data-action="r15-fail-open" ${st === "arrived" ? "" : "disabled"}>${st === "arrived" && failLeft > 0 ? `Not delivered · <span id="r15FailWait">${r15Mmss(failLeft)}</span>` : "Not delivered"}</button>
    <button class="btn btn-primary btn-lg" data-action="r15-delivered" ${st === "arrived" ? "" : "disabled"}>${hasPhoto ? (cod && !o.cashCollected ? "Delivered · collect cash" : "Delivered") : "Take photo · Delivered"}</button>
  </div>`;
}
function r15LaterStops(tr, from) {
  const later = tr.seq.slice(tr.cur + from).map(r15O);
  if (!later.length) return "";
  return `<div class="r15-card r15-later"><div class="r15-card-title">Next stops <span class="qk-muted small">set by the system — express first, then slot, then nearest</span></div>
    ${later.map((o, i) => `<div class="r15-latrow">${ic("pin")}<span><b>Customer ${tr.cur + from + i + 1}</b> · area ${esc((postalOf(o) || "").slice(0, 2))} · ${r15Units(o)} item${r15Units(o) === 1 ? "" : "s"}${orderKind(o) === "express" ? ` <span class="badge badge-red-soft">Express</span>` : ` <span class="badge badge-gray-soft">${esc(tripLabel(tripKey(o)))}</span>`}</span><span class="qk-muted small">unlocks after customer ${tr.cur + from + i}</span></div>`).join("")}</div>`;
}
// 3. Back to the store.
function r15ReturnView(p, tr) {
  const o = r15O(tr.seq[0]), b = findBranch(o.branchId), c = r15Cash(p.id), g = r15Gps(p.id, r15StorePin(o));
  return `<div class="r15-next">${ic("store")}<div class="r15-h">All delivered — return to the store</div>
    <div class="qk-muted small">${esc(b ? b.name : "The store")}${g.dist != null ? " · about " + (g.dist < 1000 ? Math.round(g.dist / 10) * 10 + " m" : (g.dist / 1000).toFixed(1) + " km") + " away" : ""}</div>
    <a class="r15-navbtn r15-navbtn-wide" href="${r15StoreMaps(b)}" target="_blank" rel="noopener">${ic("navigate")} Return to store</a>
    ${c.held > 0 ? `<div class="notice notice-warn" style="margin-top:10px">${ic("wallet")}<span>You hold ${money(c.held)} in cash.${c.state === "over" ? " It is over your limit — hand it to store staff before your next order." : " Hand it in at the store."}</span></div>` : ""}
    <button class="btn btn-primary btn-lg btn-block" style="margin-top:12px" data-action="r15-back-store">I'm back at the store</button></div>`;
}

// Earnings: the shop's flat fee per delivery, in the shop's day; a failed stop pays nothing.
function r15EarningsView(p) {
  const range = UI.r15Range || "today", now = new Date(), sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dow = (now.getDay() + 6) % 7, from = range === "today" ? sod : range === "week" ? sod - dow * 86400000 : new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const rows = r15History(p.id).filter((r) => r.at >= from);
  const done = rows.filter((r) => r.outcome === "delivered"), total = done.reduce((s, r) => s + (r.earning || 0), 0);
  const byDay = new Map(); done.forEach((r) => { const k = new Date(r.at).toLocaleDateString("en-SG", { weekday: "short", day: "2-digit", month: "short" }); const v = byDay.get(k) || { n: 0, sum: 0 }; v.n++; v.sum += r.earning || 0; byDay.set(k, v); });
  return `
  <div class="pill-row r15-filters">${[["today", "Today"], ["week", "This week"], ["month", "This month"]].map(([k, l]) => `<button class="pill ${range === k ? "active" : ""}" data-action="r15-range" data-r="${k}">${l}</button>`).join("")}</div>
  <div class="r15-earn"><div class="qk-muted small">${range === "today" ? "Today" : range === "week" ? "This week (from Monday)" : "This month"}</div><div class="r15-earn-total">${money(total)}</div><div class="qk-muted small">${done.length} deliver${done.length === 1 ? "y" : "ies"} · ${money(riderDeliveryFee())} each</div></div>
  <div class="qk-muted small" style="margin:2px 2px 10px">Your cash with you is not income — it's the shop's money. See it on the Deliveries tab.</div>
  ${range !== "today" && byDay.size ? `<div class="r15-card"><div class="r15-card-title">By day</div>${[...byDay.entries()].map(([d, v]) => `<div class="row"><span>${d} <span class="qk-muted small">· ${v.n}</span></span><b>${money(v.sum)}</b></div>`).join("")}</div>` : ""}
  <div class="r15-card"><div class="r15-card-title">Deliveries</div>${rows.length ? rows.slice(0, 30).map((r) => `<div class="row"><span>#${esc(r.o.id)} <span class="qk-muted small">· ${fmtDateTime(r.at)}</span><br><span class="qk-muted small">${r.outcome === "delivered" ? "Delivered" : "Not delivered — no fee"}</span></span><b>${r.earning != null ? "+" + money(r.earning) : "—"}</b></div>`).join("") : `<div class="qk-muted small">Nothing in this period yet.</div>`}</div>`;
}
Actions["r15-range"] = (el) => { UI.r15Range = el.dataset.r; render(); };

/* ---------------- 7. History and Me ---------------- */
function r15HistoryView(p) {
  const all = r15History(p.id), f = UI.r15HistFilter || "all", rows = all.filter((r) => f === "all" || r.outcome === f), shown = UI.r15HistShown || 10;
  return `
  <div class="pill-row r15-filters">${[["all", "All"], ["delivered", "Delivered"], ["failed", "Not delivered"]].map(([k, l]) => `<button class="pill ${f === k ? "active" : ""}" data-action="r15-hist-filter" data-f="${k}">${l}</button>`).join("")}</div>
  ${rows.length ? rows.slice(0, shown).map((r) => `
    <div class="r15-hrow"><div class="r15-hrow-main">
      <div class="r15-hrow-top"><b>#${esc(r.o.id)}</b><span class="badge badge-${r.outcome === "delivered" ? "green" : "red"}-soft">${r.outcome === "delivered" ? "Delivered" : "Not delivered"}</span></div>
      <div class="qk-muted small">${fmtDateTime(r.at)} · ${esc(r.o.contactName || r.o.customerName)} · ${esc(postalOf(r.o) || "")}</div>
      ${r.outcome === "failed" ? `<div class="qk-muted small">${esc((r.o.r15 && r.o.r15.failLabel) || r.o.deliveryFailed.reason)}</div>` : ""}</div>
      <div class="r15-hrow-side"><b>${r.earning != null ? `+${money(r.earning)}` : "No fee"}</b>${r.o.cashCollected && r.o.cashCollected.by === "rider" ? `<span class="qk-muted small">Cash ${money(r.o.cashCollected.amount)}</span>` : ""}</div></div>`).join("")
    : `<div class="empty-state"><div class="empty-title">Nothing here yet</div><div class="empty-hint">Delivered and not-delivered orders show up here.</div></div>`}
  ${rows.length > shown ? `<button class="btn btn-outline btn-block" data-action="r15-hist-more">Load more (${rows.length - shown} left)</button>` : ""}`;
}
function r15History(pid) {
  const rows = [];
  State.orders.forEach((o) => {
    if (o.deliveryPartnerId !== pid) return;
    if (o.status === "delivered") rows.push({ o, outcome: "delivered", at: r15DeliveredAt(o), earning: o.riderEarning || 0 });
    else if (o.deliveryFailed && o.status === "cancelled") rows.push({ o, outcome: "failed", at: o.deliveryFailed.at, earning: null });
  });
  return rows.sort((a, b) => b.at - a.at);
}
function r15DeliveredAt(o) { const h = (o.statusHistory || []).find((s) => s.status === "delivered"); return (h && h.at) || o.createdAt; }
Actions["r15-hist-filter"] = (el) => { UI.r15HistFilter = el.dataset.f; UI.r15HistShown = 10; render(); };
Actions["r15-hist-more"] = () => { UI.r15HistShown = (UI.r15HistShown || 10) + 10; render(); };
function r15MeView(p, online, store) {
  const cap = riderCapacity(p), startedAt = State.shiftStart[p.id], st = riderShiftStats(p.id, online ? startedAt : null), pushOn = UI.r15Push !== false;
  return `
  <div class="r15-card r15-me"><div class="r15-avatar">${esc((p.name || "?").trim().charAt(0).toUpperCase())}</div><div><b>${esc(p.name)}</b><div class="qk-muted small">${esc(p.code)}${p.mobile ? ` · +65 ${esc(p.mobile)}` : ""}</div></div></div>
  <div class="r15-card"><div class="r15-card-title">Your set-up <span class="qk-muted small">the shop sets this</span></div>
    <div class="row"><span class="qk-muted">Vehicle</span><span>${esc(p.vehicle || "—")}</span></div>
    <div class="row"><span class="qk-muted">Orders per trip</span><span>${cap}</span></div>
    <div class="row"><span class="qk-muted">Home store</span><span>${esc(store ? store.name : "—")}</span></div>
    <div class="row"><span class="qk-muted">Cash limit</span><span>${money(Number(r15Rules().riderCashLimit))}</span></div></div>
  <div class="r15-card"><div class="r15-card-title">This shift</div>
    ${online ? `<div class="row"><span class="qk-muted">Online since</span><span>${fmtTime(startedAt)}</span></div><div class="row"><span class="qk-muted">Deliveries</span><span>${st.deliveries}</span></div><div class="row"><span class="qk-muted">Earned</span><span><b>${money(st.earnings)}</b></span></div><div class="row"><span class="qk-muted">Cash with you</span><span><b>${money(r15Cash(p.id).held)}</b></span></div>
      <button class="btn btn-outline-danger btn-block" style="margin-top:12px" data-action="r15-offline-ask">Go offline</button>`
    : `<div class="qk-muted small">You're offline — no shift running.</div><button class="btn btn-primary btn-block" style="margin-top:12px" data-action="r15-online">Go online</button>`}</div>
  ${online ? r15BreakCard(p, r15OnBreak(p.id)) : ""}
  <div class="r15-card"><div class="r15-card-title">Alerts and location</div>
    <label class="stock-toggle-lg"><input type="checkbox" data-action="r15-push" ${pushOn ? "checked" : ""} /><span>"New delivery" alerts on this phone</span></label>
    <div class="qk-muted small" style="margin-top:8px">While you are on a trip the app shares this phone's location with your customer (about every 15 seconds). It stops when the trip ends. Photos you take go only to the store and are deleted after 90 days.</div></div>
  <button class="btn btn-outline btn-block" data-action="logout">${ic("logout")}<span>Log out</span></button>
  <div class="qk-muted small" style="text-align:center;margin-top:10px">Logging out ends this phone's login only.</div>${r15Demo(p)}`;
}
Actions["r15-push"] = (el) => { UI.r15Push = !!el.checked; showToast(UI.r15Push ? "Alerts on" : "Alerts off"); render(); };

/* ---------------- 8. Prototype helpers (stand in for the phone's GPS, the clock and the packer) ---------------- */
function r15Demo(p) {
  if (!UI.r15DemoOpen) return `<button class="r15-demo-toggle" data-action="r15-demo-toggle">Prototype helpers</button>`;
  const cur = r15Cur(p.id), loc = r15Loc(p.id);
  const near = (m) => { const o = cur || r15Assigned(p.id)[0]; return o ? r15Pin(o) : null; };
  return `<div class="r15-demo2"><div class="r15-demo2-head"><b>Prototype helpers</b><button class="r15-link" data-action="r15-demo-toggle">Hide</button></div>
    <div class="qk-muted small">These stand in for what a real phone does. Your phone's location now: ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)} · accuracy ${Math.round(loc.acc)} m${loc.stale ? " · out of date" : ""}.</div>
    <div class="r15-demo-chips">
      <button class="fpill" data-action="r15-loc" data-w="store">At the store</button>
      <button class="fpill" data-action="r15-loc" data-w="near">At the customer's pin</button>
      <button class="fpill" data-action="r15-loc" data-w="far">300 m away</button>
      <button class="fpill" data-action="r15-loc" data-w="weak">Weak GPS</button>
      <button class="fpill" data-action="r15-loc" data-w="stale">Out-of-date fix</button></div>
    <div class="r15-demo-chips">
      <button class="fpill" data-action="r15-skip" data-w="pack">Store packs the next order</button>
      <button class="fpill" data-action="r15-skip" data-w="break">Skip 2 h on shift</button>
      <button class="fpill" data-action="r15-skip" data-w="door">Skip 5 min at the door</button></div>
    <label class="stock-toggle-lg"><input type="checkbox" data-action="r15-failupload" ${UI.r15FailUpload ? "checked" : ""} /><span>Make photo uploads fail (bad signal)</span></label></div>`;
}
Actions["r15-demo-toggle"] = () => { UI.r15DemoOpen = !UI.r15DemoOpen; render(); };
Actions["r15-failupload"] = (el) => { UI.r15FailUpload = !!el.checked; render(); };
Actions["r15-loc"] = (el) => {
  const pid = State.session.partnerId, cur = r15Cur(pid), tr = r15Tr(pid), first = r15Assigned(pid)[0], w = el.dataset.w;
  const target = tr && tr.status === "returning" ? r15StorePin(r15O(tr.seq[0])) : cur ? r15Pin(cur) : first ? r15StorePin(first) : null;
  const store = first ? r15StorePin(first) : (findBranch(findPartner(pid).branchId) || { lat: 1.35, lng: 103.82 });
  const off = (m, dir) => ({ lat: target.lat + (dir ? m / 111320 : 0), lng: target.lng + (dir ? 0 : m / 111320) });
  let loc;
  if (w === "store") loc = { ...store, acc: 8, stale: false };
  else if (!target) { showToast("No stop to be near right now", "danger"); return; }
  else if (w === "near") loc = { ...off(20, true), acc: 10, stale: false };
  else if (w === "far") loc = { ...off(300, true), acc: 10, stale: false };
  else if (w === "weak") loc = { ...off(20, true), acc: 120, stale: false };
  else loc = { ...off(20, true), acc: 10, stale: true };
  State.rloc = { ...State.rloc, [pid]: loc }; persist("rloc"); r15CheckArrival(pid, true); render();
};
Actions["r15-skip"] = (el) => {
  const pid = State.session.partnerId, w = el.dataset.w;
  if (w === "pack") { const o = r15Assigned(pid).find((x) => r15Pack(x) === "packing"); if (!o) { showToast("Nothing is waiting to be packed", "danger"); return; } r15SetStatus(o.id, "ready_for_rider"); persist("orders"); showToast("#" + o.id + " is packed"); }
  if (w === "break") { const b = State.rbreaks[pid] || {}; State.shiftStart = { ...State.shiftStart, [pid]: (State.shiftStart[pid] || Date.now()) - R15.BREAK_EVERY_MIN * 60000 }; State.rbreaks = { ...State.rbreaks, [pid]: { ...b, lastEnd: b.lastEnd ? b.lastEnd - R15.BREAK_EVERY_MIN * 60000 : b.lastEnd } }; persist("shiftStart"); persist("rbreaks"); showToast("Two hours later — the break button is available"); }
  if (w === "door") { const o = r15Cur(pid); if (!o || r15Stage(o) !== "arrived") { showToast("Arrive at a stop first", "danger"); return; } r15Patch(o.id, { arrivedAt: o.r15.arrivedAt - R15.FAIL_WAIT_MIN * 60000 }); persist("orders"); }
  render();
};
// Live bits that must not re-draw the screen: the distance text, the countdowns; and the moment of arrival.
setInterval(() => {
  if (!State.session || State.session.role !== "delivery") return;
  const pid = State.session.partnerId;
  const el = document.getElementById("r15Dist"), cur = r15Cur(pid);
  if (cur && r15Stage(cur) === "en_route") {
    if (r15CheckArrival(pid)) { render(); return; }
    const g = r15Gps(pid, r15Pin(cur));
    if (el) el.textContent = g.ok ? "You're at the pin — arriving…" : g.msg;
  }
  const bl = document.getElementById("r15BreakLeft");
  if (bl) { if (!r15OnBreak(pid)) { render(); } else bl.textContent = r15Mmss(Math.max(0, Number(r15Rules().riderBreakMin) * 60000 - (Date.now() - State.rbreaks[pid].activeStart))); }
  const fw = document.getElementById("r15FailWait");
  if (fw && cur && cur.r15 && cur.r15.arrivedAt) { const left = R15.FAIL_WAIT_MIN * 60000 - (Date.now() - cur.r15.arrivedAt); if (left <= 0) render(); else fw.textContent = r15Mmss(left); }
}, 1500);

/* ---------------- 9. Sheets ---------------- */
function r15Sheet(title, body) {
  return `<div class="overlay r15-overlay" data-action="close-modal-backdrop"><div class="dialog dialog-static r15-sheet" role="dialog" aria-modal="true" data-action="noop">
    <div class="dialog-head"><span>${title}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div><div class="dialog-body">${body}</div></div></div>`;
}
function r15CashSheet() {
  const o = r15O(UI.modal.orderId); if (!o) return "";
  const due = cashToCollect(o);
  return r15Sheet(`Cash on delivery · #${esc(o.id)}`, `
    <div class="r15-cash r15-cash-big">${ic("wallet")}<div><div class="small">Take this in cash</div><b>${money(due)}</b></div></div>
    <div class="qk-muted small" style="margin:8px 0 14px">${due !== round2(o.total) ? `The bill is ${money(o.total)}; the shop adjusted it for removed or swapped items. ` : ""}This is the shop's figure — you only confirm you took it.</div>
    <button class="btn btn-primary btn-lg btn-block" data-action="r15-cash-yes">I collected ${money(due)} · Delivered</button>
    <button class="btn btn-outline btn-block" style="margin-top:8px" data-action="close-modal">Not yet</button>`);
}
function r15FailSheet() {
  const m = UI.modal, o = r15O(m.orderId); if (!o) return "";
  const reasons = State.failReasons.filter((r) => r.active);
  if (m.confirmed) return r15Sheet(`Are you sure? · #${esc(o.id)}`, `
    <div class="notice notice-danger" style="margin-bottom:12px">${ic("alert")}<span><b>This cancels the order and refunds the customer.</b>${isCod(o) ? " (A cash order — nothing to refund.)" : ""} The items go back to the store, and the store sees your reason. You can't undo it.</span></div>
    <div class="row"><span class="qk-muted">Reason</span><span>${esc((State.failReasons.find((x) => x.id === m.reasonId) || {}).label)}${m.note ? " · " + esc(m.note) : ""}</span></div>
    <form data-action="r15-fail-submit" novalidate><input type="hidden" name="note" value="${esc(m.note)}" />
      <button class="btn btn-outline-danger btn-lg btn-block" style="margin-top:14px" type="submit">Yes, report as not delivered</button>
      <button type="button" class="btn btn-outline btn-block" style="margin-top:8px" data-action="close-modal">Go back</button></form>`);
  return r15Sheet(`Not delivered · #${esc(o.id)}`, `
    <div class="qk-muted small" style="margin-bottom:10px">Pick what happened. The next customer unlocks once you report it.</div>
    <div class="r15-reasons">${reasons.map((r) => `<button type="button" class="r15-reason ${m.reasonId === r.id ? "on" : ""}" data-action="r15-fail-reason" data-id="${r.id}">${esc(r.label)}</button>`).join("")}</div>
    <form data-action="r15-fail-submit" novalidate>
      <label class="field"><span class="field-label">Note <span class="qk-muted small">optional · 200 characters · no personal details</span></span><textarea class="input" name="note" rows="2" maxlength="200" placeholder="e.g. called twice, no answer">${esc(m.note || "")}</textarea></label>
      ${m.error ? `<div class="field-error">${esc(m.error)}</div>` : ""}
      <button class="btn btn-outline-danger btn-lg btn-block" type="submit">Continue</button>
      <button type="button" class="btn btn-outline btn-block" style="margin-top:8px" data-action="close-modal">Back</button></form>`);
}
function r15ManualSheet() {
  const m = UI.modal, pid = State.session.partnerId, o = r15Cur(pid), g = o ? r15Gps(pid, r15Pin(o)) : { msg: "" };
  return r15Sheet("I'm here but the app can't tell", `
    <div class="notice" style="margin-bottom:10px">${ic("pin")}<span>${esc(g.msg || "")} This is recorded and shown to the store with your reason, the distance and your phone's accuracy — it does not count against you.</span></div>
    <div class="r15-chips">${["The pin is in the wrong place", "No GPS signal here (lift, basement)", "The building entrance is far from the pin"].map((r) => `<button type="button" class="fpill ${m.reason === r ? "on" : ""}" data-action="r15-manual-pick" data-reason="${esc(r)}">${esc(r)}</button>`).join("")}</div>
    <form data-action="r15-manual-arrive" novalidate>
      <label class="field"><span class="field-label">Reason *</span><textarea class="input" name="reason" rows="2" maxlength="200">${esc(m.reason || "")}</textarea></label>
      ${m.error ? `<div class="field-error">${esc(m.error)}</div>` : ""}
      <button class="btn btn-primary btn-lg btn-block" type="submit">I have arrived</button>
      <button type="button" class="btn btn-outline btn-block" style="margin-top:8px" data-action="close-modal">Back</button></form>`);
}
function r15StoreFarSheet() {
  const m = UI.modal;
  return r15Sheet("You are not at the store yet", `
    <div class="notice" style="margin-bottom:10px">${ic("store")}<span>${esc(m.g.msg.replace("the pin", "the store"))} If the app can't tell, say so below — it is recorded for the store.</span></div>
    <form data-action="r15-store-manual" novalidate>
      <label class="field"><span class="field-label">Reason *</span><textarea class="input" name="reason" rows="2" maxlength="200" placeholder="e.g. I'm at the back entrance"></textarea></label>
      ${m.error ? `<div class="field-error">${esc(m.error)}</div>` : ""}
      <button class="btn btn-primary btn-lg btn-block" type="submit">I'm back at the store</button>
      <button type="button" class="btn btn-outline btn-block" style="margin-top:8px" data-action="close-modal">Keep going</button></form>`);
}
function r15IssueSheet() {
  const m = UI.modal, pid = State.session.partnerId, o = r15Cur(pid); if (!o) return "";
  const lines = r15Lines(o), sel = lines.find((l) => l.idx === m.idx);
  return r15Sheet("Missing or damaged", `
    <div class="qk-muted small" style="margin-bottom:8px">Tell the store. No money moves — the store decides about a refund.</div>
    <div class="r15-reasons">${lines.map((l) => `<button type="button" class="r15-reason ${m.idx === l.idx ? "on" : ""}" data-action="r15-issue-pick" data-idx="${l.idx}">${l.qty} × ${esc(l.name)}</button>`).join("")}</div>
    ${sel ? `<div class="r15-qtyrow"><span>How many?</span><div class="r15-stepper"><button type="button" data-action="r15-issue-qty" data-d="-1">${ic("minus")}</button><b>${m.qty}</b><button type="button" data-action="r15-issue-qty" data-d="1">${ic("plus")}</button></div></div>
      <div class="pill-row" style="margin:10px 0">${["missing", "damaged"].map((k) => `<button type="button" class="pill ${m.kind === k ? "active" : ""}" data-action="r15-issue-kind" data-kind="${k}">${k === "missing" ? "Missing" : "Damaged"}</button>`).join("")}</div>` : ""}
    ${m.error ? `<div class="field-error">${esc(m.error)}</div>` : ""}
    <button class="btn btn-primary btn-lg btn-block" data-action="r15-issue-save">Report to the store</button>
    <button class="btn btn-outline btn-block" style="margin-top:8px" data-action="close-modal">Back</button>`);
}
function r15OfflineSheet() {
  const p = r15Partner(), startedAt = p && State.shiftStart[p.id], st = riderShiftStats(p ? p.id : 0, startedAt || null), c = p ? r15Cash(p.id) : { held: 0 };
  return r15Sheet("Go offline?", `
    <div class="row"><span class="qk-muted">Online since</span><span>${startedAt ? fmtTime(startedAt) : "—"}</span></div><div class="row"><span class="qk-muted">Deliveries</span><span>${st.deliveries}</span></div>
    <div class="row"><span class="qk-muted">Earned</span><span><b>${money(st.earnings)}</b></span></div><div class="row"><span class="qk-muted">Cash with you</span><span><b>${money(c.held)}</b></span></div>
    <div class="qk-muted small" style="margin:8px 0 14px">Going offline ends your shift. The shop can't give you new orders until you go online again.</div>
    <button class="btn btn-outline-danger btn-lg btn-block" data-action="r15-offline-confirm">End shift</button><button class="btn btn-outline btn-block" style="margin-top:8px" data-action="close-modal">Keep going</button>`);
}
function r15BlockedSheet() {
  const p = r15Partner(), tr = p && r15Tr(p.id), n = p ? r15Assigned(p.id).filter((o) => r15Stage(o) !== "assigned" && o.status !== "delivered").length : 0;
  return r15Sheet("Finish your trip first", `<div class="notice notice-danger">${ic("alert")}<span>You have ${n || "an"} order${n === 1 ? "" : "s"} on your trip. Deliver ${n === 1 ? "it" : "them"}, or report ${n === 1 ? "it" : "them"} as not delivered, then come back to the store — then go offline.</span></div>
    <button class="btn btn-primary btn-block" style="margin-top:14px" data-action="close-modal">Back to deliveries</button>`);
}
function r15SummarySheet() {
  const m = UI.modal;
  return r15Sheet("Shift summary", `
    <div style="text-align:center;padding:4px 0 8px"><div style="color:var(--success)">${ic("check")}</div><div style="font-weight:800;margin-top:6px">You're offline</div><div class="qk-muted small">Here's how your shift went.</div></div>
    <div class="r15-card" style="margin:10px 0"><div class="row"><span class="qk-muted">Online</span><span>${m.startedAt ? `${fmtTime(m.startedAt)} – ${fmtTime(m.endedAt)}` : "—"}</span></div>
      <div class="row"><span class="qk-muted">Duration</span><span>${m.startedAt ? fmtDuration(m.endedAt - m.startedAt) : "—"}</span></div><div class="row"><span class="qk-muted">Deliveries</span><span>${m.deliveries}</span></div>
      <div class="row"><span class="qk-muted">Earned</span><span><b>${money(m.earnings)}</b></span></div><div class="row"><span class="qk-muted">Cash with you</span><span><b>${money(m.cash)}</b></span></div></div>
    ${m.cash > 0 ? `<div class="notice notice-warn">${ic("wallet")}<span>Hand ${money(m.cash)} in cash to the store.</span></div>` : ""}
    <button class="btn btn-primary btn-block" style="margin-top:14px" data-action="close-modal">Done</button>`);
}
(() => {
  const extra = window.extraModal;
  window.extraModal = (type) => ({ r15Photo: r15PhotoSheet, r15Cash: r15CashSheet, r15Fail: r15FailSheet, r15Manual: r15ManualSheet, r15StoreFar: r15StoreFarSheet, r15Issue: r15IssueSheet, r15Offline: r15OfflineSheet, r15Blocked: r15BlockedSheet, r15Summary: r15SummarySheet }[type] || (() => extra(type)))();
})();

/* ====================================================================
   ADMIN and CUSTOMER sides of the rider trip (the same Round 15)
   ==================================================================== */
const r15Actor = () => ({ actorType: "user", actorId: (currentUser() || {}).id });
function r15Audit(action, entity, entityId, before, after, name) { addAuditEvent({ action, entity, entityId, ...r15Actor(), before, after, names: { entity: name || String(entityId) } }); }
Object.assign(AUDIT_ACTION_TEXT, {
  "rider.cash_received": ["Riders", "received cash from"],
  "rider.cash_shortage": ["Riders", "recorded a cash shortage for"],
  "rider.cash_excess": ["Riders", "recorded a cash excess for"],
  "rider.trip_closed": ["Riders", "closed the trip of"],
  "order.photo_viewed": ["Orders", "viewed the delivery photos of order"],
  "failure_reasons.updated": ["Setup", "changed the not-delivered reasons"],
  "business_settings.updated": AUDIT_ACTION_TEXT["business_settings.updated"] || ["Setup", "changed the business settings"],
});
Object.assign(AUDIT_FIELD_LABEL, { expected: "Expected", counted: "Counted", difference: "Difference", stops: "Orders on the trip", reason: "Reason", reasons: "Reasons", "rider.cashLimit": "Rider cash limit (S$)", "rider.breakEveryMin": "Break every (min)", "rider.breakMin": "Break length (min)" });

/* ---- A. A tiny map (the real apps use a map SDK; this is only to show what is on it) ---- */
function r15Map(points, h) {
  const W = 300, H = h || 150, pad = 22;
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  let minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  if (maxLat - minLat < 0.003) { minLat -= 0.0015; maxLat += 0.0015; } if (maxLng - minLng < 0.003) { minLng -= 0.0015; maxLng += 0.0015; }
  const X = (g) => pad + (g - minLng) / (maxLng - minLng) * (W - 2 * pad), Y = (t) => H - pad - (t - minLat) / (maxLat - minLat) * (H - 2 * pad);
  const color = { store: "#00569D", customer: "#E21622", rider: "#008351" };
  return `<svg class="r15-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map"><rect width="${W}" height="${H}" rx="10" fill="#E9F1F8"/>
    <path d="M0 ${H * 0.35} Q ${W * 0.4} ${H * 0.2} ${W} ${H * 0.45}" stroke="#fff" stroke-width="8" fill="none"/><path d="M${W * 0.3} 0 Q ${W * 0.4} ${H * 0.5} ${W * 0.7} ${H}" stroke="#fff" stroke-width="6" fill="none"/>
    ${points.map((p) => `<g><circle cx="${X(p.lng).toFixed(1)}" cy="${Y(p.lat).toFixed(1)}" r="${p.kind === "rider" ? 7 : 6}" fill="${color[p.kind]}" stroke="#fff" stroke-width="2.5"/>${p.label ? `<text x="${(X(p.lng) + 10).toFixed(1)}" y="${(Y(p.lat) + 4).toFixed(1)}" font-size="10" font-weight="700" fill="#0F2233">${esc(p.label)}</text>` : ""}</g>`).join("")}</svg>`;
}

/* ---- B. Orders: a rider is assigned from Picking onward; who can be given an order now ---- */
(() => {
  const fit = window.riderFit;
  window.riderFit = (p, orders) => {
    const f = fit(p, orders);
    if (p.active === false) return f;
    const why = r15OnBreak(p.id) ? "On a break" : r15Tr(p.id) && !riderOnTrip(p.id) ? "Collecting orders at the store" : r15Cash(p.id).state === "over" && !r15Tr(p.id) ? "Deposit cash first" : null;
    if (why) { f.canTake = false; f.suggested = false; f.blocker = why; f.warning = ""; f.notes = why === "Deposit cash first" ? [`Holds ${money(r15Cash(p.id).held)} — over the limit`] : []; }
    return f;
  };
  const modal = window.assignRiderModal;
  window.assignRiderModal = () => {
    let html = modal();
    State.partners.forEach((p) => {
      const why = p.active !== false && (r15OnBreak(p.id) || (r15Cash(p.id).state === "over" && !r15Tr(p.id)));
      if (why) html = html.split(`<button type="button" class="link-btn as-force" data-action="assign-ask-force" data-partner="${p.id}">Assign anyway…</button>`).join(`<span class="qk-muted small">can't be given orders now</span>`);
    });
    return html;
  };
  const assign = Actions["assign-rider"];
  Actions["assign-rider"] = (el) => {
    const p = findPartner(Number(el.dataset.partner));
    if (p && r15OnBreak(p.id)) { showToast(`${p.name} is on a break`, "danger"); return; }
    if (p && r15Cash(p.id).state === "over" && !r15Tr(p.id)) { showToast(`${p.name} holds ${money(r15Cash(p.id).held)} — receive the cash first (Partners)`, "danger"); return; }
    return assign(el);
  };
})();

/* ---- C. Order drawer: the proof the rider took, and the flags (photos are for the store and admin only) ---- */
function r15ProofHTML(o) {
  const r = o.r15; if (!r || (!r.pickupPhoto && !r.deliveryPhoto && !r.arrivedAt && !(r.issues || []).length && !r.failLabel)) return "";
  const photo = (src, cap) => src ? `<figure class="r15-proof"><img src="${src}" alt="" /><figcaption>${cap}</figcaption></figure>` : "";
  const arrived = r.arrivedAt ? (r.arrivedBy === "manual"
    ? `<div class="notice notice-warn" style="margin:6px 0">${ic("pin")}<span><b>Arrived — rider confirmed, phone location unavailable.</b> ${fmtDateTime(r.arrivedAt)}. Reason: “${esc(r.arrivedNote || "")}”. ${r.arrivedDist != null ? `About ${Math.round(r.arrivedDist)} m from the pin, phone accuracy ${r.arrivedAcc || "?"} m.` : ""} Nothing to do unless it happens a lot.</span></div>`
    : `<div class="qk-muted small" style="margin:6px 0">${ic("check")} Arrived ${fmtDateTime(r.arrivedAt)} — confirmed by the rider's phone location (${r.arrivedDist != null ? Math.round(r.arrivedDist) : "?"} m from the pin).</div>`) : "";
  return `<div class="drawer-sec r15-proofsec"><div class="drawer-sec-title">Rider's proof</div>
    <div class="r15-proofrow">${photo(r.pickupPhoto, "Pickup · " + (r.pickedAt ? fmtDateTime(r.pickedAt) : ""))}${photo(r.deliveryPhoto, "Delivery · " + (r.deliveryPhotoAt || r.deliveredAt ? fmtDateTime(r.deliveryPhotoAt || r.deliveredAt) : ""))}</div>
    ${arrived}
    ${(r.issues || []).length ? `<div class="notice notice-warn" style="margin:6px 0">${ic("alert")}<span><b>Reported by the rider:</b> ${r.issues.map((i) => `${i.qty} × ${esc(i.name)} ${i.kind}`).join(" · ")}. No money moved — decide on a refund under Returns.</span></div>` : ""}
    ${r.failLabel ? `<div class="notice notice-danger" style="margin:6px 0">${ic("alert")}<span><b>Not delivered:</b> ${esc(r.failLabel)}${r.failNote ? " — " + esc(r.failNote) : ""}. The items went back to stock.</span></div>` : ""}
    <div class="qk-muted small">Photos are kept 90 days. Viewing them is recorded in the audit log.</div></div>`;
}
(() => {
  const drawer = window.orderDrawerHTML;
  window.orderDrawerHTML = () => {
    let html = drawer();
    const o = State.orders.find((x) => x.id === UI.orderDrawerId);
    if (!o || !html) return html;
    // Once the rider holds the order, only Close trip (Partners) changes it: no advance, no cancel here (the API refuses, 409 ALREADY_PICKED_UP).
    const held = o.r15 && ["picked_up", "en_route", "arrived"].includes(o.r15.stage) && !["delivered", "cancelled"].includes(o.status);
    if (held) {
      html = html.replace(/<button class="btn btn-primary btn-sm" data-action="set-order-status"[^>]*>[^<]*<\/button>/, "")
        .replace(/<button class="btn btn-outline-danger btn-sm" data-action="open-admin-cancel"[^>]*>[^<]*<\/button>/, "")
        .replace('<div class="drawer-actions">', `<div class="notice" style="margin:8px 0">${ic("truck")}<span>The rider has this order. To change it, close their trip under Delivery Partners.</span></div><div class="drawer-actions">`);
    }
    const proof = r15ProofHTML(o);
    if (!proof) return html;
    UI.r15Viewed = UI.r15Viewed || {};
    if ((o.r15.pickupPhoto || o.r15.deliveryPhoto) && !UI.r15Viewed[o.id]) { UI.r15Viewed[o.id] = true; r15Audit("order.photo_viewed", "order", o.id, null, { photos: [o.r15.pickupPhoto ? "pickup" : null, o.r15.deliveryPhoto ? "delivery" : null].filter(Boolean).join(", ") }, "#" + o.id); }
    return html.replace('<div class="drawer-actions">', `${proof}<div class="drawer-actions">`);
  };
})();

/* ---- D. Partners: state, cash, Receive cash, Close trip, and who is where ---- */
function r15RiderState(p) {
  if (p.active === false) return { label: "Inactive", tone: "red" };
  const tr = r15Tr(p.id);
  if (r15OnBreak(p.id)) return { label: "On a break", tone: "yellow" };
  if (tr) return { label: tr.status === "collecting" ? "Collecting orders" : tr.status === "returning" ? "Returning to store" : "On a trip", tone: "yellow" };
  if (riderOnTrip(p.id)) return { label: "On a trip", tone: "yellow" };
  return r15Online(p.id) ? { label: "Online", tone: "green" } : { label: "Offline", tone: "gray" };
}
function r15AdminBlock(p, editable) {
  const st = r15RiderState(p), c = r15Cash(p.id), tr = r15Tr(p.id), bl = tr && tr.status === "collecting" ? r15Blocker(p.id) : null;
  const waitMin = bl ? Math.floor((Date.now() - tr.firstPickupAt) / 60000) : 0;
  const pct = Math.min(100, Math.round(c.held / c.limit * 100));
  return `<div class="r15a"><div class="r15a-row"><span class="badge badge-${st.tone}">${st.label}</span>
      ${c.state === "over" && !tr ? `<span class="badge badge-red">Waiting to deposit ${money(c.held)}</span>` : c.state === "over" ? `<span class="badge badge-red-soft">Over the cash limit</span>` : ""}
      ${bl && waitMin >= 5 ? `<span class="badge badge-yellow">Waiting ${waitMin} min for #${esc(bl.order.id)}</span>` : ""}</div>
    <div class="r15a-cash ${c.state}"><div><span class="qk-muted small">Cash held</span> <b>${money(c.held)}</b> <span class="qk-muted small">of ${money(c.limit)}</span></div><div class="r15-progress"><i style="width:${pct}%"></i></div></div>
    ${editable ? `<div class="r15a-actions">${c.held > 0 ? `<button class="btn btn-primary-soft btn-sm" data-action="r15a-cash-open" data-id="${p.id}">Receive cash</button>` : ""}${tr ? `<button class="btn btn-outline-danger btn-sm" data-action="r15a-close-open" data-id="${p.id}">Close trip…</button>` : ""}</div>` : ""}</div>`;
}
(() => {
  const base = window.adminPartners;
  window.adminPartners = () => {
    const editable = canEdit(currentUser(), "partners");
    const html = base();
    const parts = html.split('<div class="partner-card">');
    const out = parts.map((chunk, i) => {
      if (i === 0) return chunk;
      const m = chunk.match(/data-action="toggle-partner-orders" data-id="(\d+)"/);
      const p = m && findPartner(Number(m[1]));
      return p ? chunk.replace(/<span class="badge badge-(?:red|yellow|green|gray)">(?:Inactive|On delivery|Ready|Offline)<\/span>/, "").replace('<div class="form-actions">', `${r15AdminBlock(p, editable)}<div class="form-actions">`) : chunk;
    });
    return out.join('<div class="partner-card">');
  };
})();
Actions["r15a-cash-open"] = (el) => { UI.modal = { type: "r15aCash", partnerId: Number(el.dataset.id), error: null, counted: "" }; render(); };
Submits["r15a-cash-save"] = (form) => {
  const m = UI.modal, p = findPartner(m.partnerId), c = r15Cash(m.partnerId);
  const raw = String(new FormData(form).get("counted") || "").trim(), counted = Number(raw);
  if (raw === "" || !isFinite(counted) || counted < 0 || counted > 100000) { UI.modal = { ...m, counted: raw, error: "Enter the amount you counted (S$0 or more)" }; render(); return; }
  const diff = round2(counted - c.held);
  State.rdeposits = [...State.rdeposits, { id: Date.now(), partnerId: p.id, branchId: p.branchId, expected: c.held, counted: round2(counted), diff, by: (currentUser() || {}).name || "Staff", at: Date.now() }];
  persist("rdeposits"); r15Requeue(p.id);
  r15Audit("rider.cash_received", "partner", p.id, null, { expected: c.held, counted: round2(counted), difference: diff }, p.name);
  if (diff < 0) r15Audit("rider.cash_shortage", "partner", p.id, null, { expected: c.held, counted: round2(counted), difference: diff }, p.name);
  if (diff > 0) r15Audit("rider.cash_excess", "partner", p.id, null, { expected: c.held, counted: round2(counted), difference: diff }, p.name);
  UI.modal = null; render();
  showToast(diff === 0 ? `Received ${money(counted)} from ${p.name}` : `Received ${money(counted)} — ${diff < 0 ? "a shortage" : "an excess"} of ${money(Math.abs(diff))} is recorded. ${p.name} can take orders again.`);
};
function r15aCashModal() {
  const m = UI.modal, p = findPartner(m.partnerId); if (!p) return "";
  const c = r15Cash(p.id), last = State.rdeposits.filter((d) => d.partnerId === p.id).slice(-1)[0];
  return `<div class="overlay" data-action="close-modal-backdrop"><div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
    <div class="dialog-head"><span>Receive cash · ${esc(p.name)}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
    <form class="dialog-body" data-action="r15a-cash-save" novalidate>
      <div class="row"><span class="qk-muted">The system says ${esc(p.name.split(" ")[0])} holds</span><b>${money(c.held)}</b></div>
      <label class="field" style="margin-top:10px"><span class="field-label">Amount you counted (S$)</span><input class="input" type="number" name="counted" min="0" step="0.05" value="${esc(m.counted)}" autofocus /></label>
      ${m.error ? `<div class="field-error">${esc(m.error)}</div>` : ""}
      <div class="qk-muted small" style="margin:8px 0 12px">This settles ${money(c.held)} for the rider. If the count differs, the difference is saved as a shortage or an excess for the admin to see — the rider sees the same figures.</div>
      ${last ? `<div class="qk-muted small">Last time: expected ${money(last.expected)}, counted ${money(last.counted)}${last.diff ? `, difference ${money(last.diff)}` : ""} (${fmtDateTime(last.at)}).</div>` : ""}
      <div class="form-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Record the cash</button></div></form></div></div>`;
}
Actions["r15a-close-open"] = (el) => { UI.modal = { type: "r15aClose", partnerId: Number(el.dataset.id), error: null, reason: "" }; render(); };
Submits["r15a-close-save"] = (form) => {
  const m = UI.modal, p = findPartner(m.partnerId), tr = r15Tr(m.partnerId), fd = new FormData(form), reason = String(fd.get("reason") || "").trim();
  if (reason.length < 3) { UI.modal = { ...m, reason, error: "Give a reason (at least 3 characters)" }; render(); return; }
  if (!tr) { UI.modal = null; render(); return; }
  const stops = r15Assigned(p.id).filter((o) => !["delivered", "failed", "cancelled"].includes(r15Stage(o)) && o.status !== "delivered" && o.status !== "cancelled");
  const done = [];
  stops.forEach((o) => {
    const choice = fd.get("s_" + o.id) || "back";
    if (choice === "failed" && o.status === "picked_up") { failDelivery(o.id, "Trip closed by the store — " + reason, (currentUser() || {}).name || "Store"); r15Patch(o.id, { stage: "failed", failedAt: Date.now(), failLabel: "Trip closed by the store", failNote: reason }); done.push(`#${o.id} failed`); }
    else { State.orders = State.orders.map((x) => (x.id === o.id ? { ...x, deliveryPartnerId: null, status: x.status === "picked_up" ? "ready_for_rider" : x.status, r15: { stage: "assigned" } } : x)); done.push(`#${o.id} back to ready`); }
  });
  const { [p.id]: gone, ...rest } = State.rtrips; State.rtrips = rest;
  persist("orders"); persist("rtrips"); r15Requeue(p.id);
  r15Audit("rider.trip_closed", "partner", p.id, { status: tr.status, stops: stops.map((o) => "#" + o.id).join(", ") }, { reason, stops: done.join("; ") }, p.name);
  UI.modal = null; render(); showToast(`Trip closed — ${done.length ? done.join(", ") : "no open orders"}`);
};
function r15aCloseModal() {
  const m = UI.modal, p = findPartner(m.partnerId), tr = r15Tr(m.partnerId); if (!p || !tr) return "";
  const stops = r15Assigned(p.id).filter((o) => !["delivered", "failed", "cancelled"].includes(r15Stage(o)) && o.status !== "delivered" && o.status !== "cancelled");
  return `<div class="overlay" data-action="close-modal-backdrop"><div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
    <div class="dialog-head"><span>Close the trip · ${esc(p.name)}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
    <form class="dialog-body" data-action="r15a-close-save" novalidate>
      <div class="notice notice-warn" style="margin-bottom:10px">${ic("alert")}<span>Use this when a trip is stuck — the rider lost their phone, can't get back to the store, or a photo won't upload. It ends the trip and is recorded in the audit log.</span></div>
      ${stops.length ? stops.map((o) => `<div class="r15a-stoprow"><b>#${esc(o.id)}</b> <span class="qk-muted small">${esc(o.contactName || o.customerName)} · ${esc(r15Stage(o).replace("_", " "))}</span>
        <label class="radio-row"><input type="radio" name="s_${o.id}" value="back" checked /> Put it back to <b>ready for rider</b> (nobody has it)</label>
        ${o.status === "picked_up" ? `<label class="radio-row"><input type="radio" name="s_${o.id}" value="failed" /> Mark it <b>failed</b> — cancel, refund, return the items to stock</label>` : ""}</div>`).join("") : `<div class="qk-muted small">No open orders on this trip.</div>`}
      <label class="field" style="margin-top:10px"><span class="field-label">Reason *</span><input class="input" name="reason" value="${esc(m.reason)}" maxlength="200" placeholder="e.g. Rider's phone was stolen" /></label>
      ${m.error ? `<div class="field-error">${esc(m.error)}</div>` : ""}
      <div class="form-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Keep the trip</button><button type="submit" class="btn btn-outline-danger">Close the trip</button></div></form></div></div>`;
}

/* ---- E. Business Settings ▸ Delivery & Payments ▸ Not-delivered reasons (the Super Admin edits) ---- */
function r15ReasonsHTML() {
  const rs = State.failReasons, sa = isSuperAdmin(currentUser());
  if (!sa) return `<div class="summary-card" style="max-width:420px; margin-top:16px"><div class="summary-card-title">Not-delivered reasons</div><div class="qk-muted small">What a rider can pick when they can't deliver. Only the Super Admin changes this list.</div><ul class="r15a-ro">${rs.filter((r) => r.active).map((r) => `<li>${esc(r.label)}</li>`).join("")}</ul></div>`;
  return `<div class="summary-card" style="max-width:420px; margin-top:16px"><div class="summary-card-title">Not-delivered reasons</div>
    <div class="qk-muted small">The riders pick one of these when they can't deliver. “Other” asks the rider to say what happened. A reason already used keeps its old name in the past orders — changes apply from now on.</div>
    ${rs.map((r, i) => `<div class="r15a-reason ${r.active ? "" : "off"}"><input class="input" id="r15reason_${r.id}" value="${esc(r.label)}" maxlength="60" ${r.label === "Other" ? "readonly" : ""} />
      <div class="r15a-reason-btns"><button class="icon-btn" data-action="r15-reason-up" data-id="${r.id}" ${i === 0 ? "disabled" : ""} aria-label="Up">↑</button><button class="icon-btn" data-action="r15-reason-down" data-id="${r.id}" ${i === rs.length - 1 ? "disabled" : ""} aria-label="Down">↓</button>
      ${r.label === "Other" ? "" : `<button class="btn btn-outline btn-sm" data-action="r15-reason-save" data-id="${r.id}">Rename</button>`}<button class="btn ${r.active ? "btn-outline" : "btn-primary-soft"} btn-sm" data-action="r15-reason-toggle" data-id="${r.id}">${r.active ? "Switch off" : "Switch on"}</button></div></div>`).join("")}
    <form data-action="r15-reason-add" class="r15a-add" novalidate><input class="input" name="label" maxlength="60" placeholder="Add a reason, e.g. Gate was locked" /><button class="btn btn-primary" type="submit">Add</button></form>
    ${UI.r15ReasonErr ? `<div class="field-error">${esc(UI.r15ReasonErr)}</div>` : ""}</div>`;
}
function r15SaveReasons(before) { persist("failReasons"); r15Audit("failure_reasons.updated", "failure_reasons", "list", { reasons: before.filter((r) => r.active).map((r) => r.label).join(", ") }, { reasons: State.failReasons.filter((r) => r.active).map((r) => r.label).join(", ") }, "Not-delivered reasons"); render(); }
Actions["r15-reason-toggle"] = (el) => { const b = State.failReasons; const id = Number(el.dataset.id); if (b.find((r) => r.id === id).active && b.filter((r) => r.active).length <= 1) { UI.r15ReasonErr = "At least one reason must stay on."; render(); return; } UI.r15ReasonErr = null; State.failReasons = b.map((r) => (r.id === id ? { ...r, active: !r.active } : r)); r15SaveReasons(b); };
Actions["r15-reason-save"] = (el) => { const b = State.failReasons, id = Number(el.dataset.id), v = (document.getElementById("r15reason_" + id).value || "").trim(); if (v.length < 2 || b.some((r) => r.id !== id && r.label.toLowerCase() === v.toLowerCase())) { UI.r15ReasonErr = v.length < 2 ? "A reason needs at least 2 characters." : "That reason already exists."; render(); return; } UI.r15ReasonErr = null; State.failReasons = b.map((r) => (r.id === id ? { ...r, label: v } : r)); r15SaveReasons(b); };
Actions["r15-reason-up"] = (el) => { const b = [...State.failReasons], i = b.findIndex((r) => r.id === Number(el.dataset.id)); if (i > 0) { [b[i - 1], b[i]] = [b[i], b[i - 1]]; const before = State.failReasons; State.failReasons = b; r15SaveReasons(before); } };
Actions["r15-reason-down"] = (el) => { const b = [...State.failReasons], i = b.findIndex((r) => r.id === Number(el.dataset.id)); if (i >= 0 && i < b.length - 1) { [b[i + 1], b[i]] = [b[i], b[i + 1]]; const before = State.failReasons; State.failReasons = b; r15SaveReasons(before); } };
Submits["r15-reason-add"] = (form) => { const v = String(new FormData(form).get("label") || "").trim(), b = State.failReasons; if (v.length < 2) { UI.r15ReasonErr = "A reason needs at least 2 characters."; render(); return; } if (b.some((r) => r.label.toLowerCase() === v.toLowerCase())) { UI.r15ReasonErr = "That reason already exists."; render(); return; } UI.r15ReasonErr = null; const other = b.findIndex((r) => r.label === "Other"); const nr = { id: Math.max(...b.map((r) => r.id)) + 1, label: v, active: true }; const list = [...b]; list.splice(other >= 0 ? other : list.length, 0, nr); State.failReasons = list; r15SaveReasons(b); };

/* ---- F. Business Settings: the cash limit and the break rule ---- */
function r15RiderRulesCard(editable) {
  const r = r15Rules();
  return `<div class="summary-card" style="max-width:420px; margin-top:16px"><div class="summary-card-title">Rider cash and breaks</div>
    <div class="qk-muted small">A rider may go over the cash limit inside one trip; after returning to the store they must hand the cash to store staff (Partners ▸ Receive cash) before taking new orders. Changes apply from the next event.</div>
    <label class="field" style="margin-top:10px"><span class="field-label">Cash a rider may hold (S$)</span><input class="input" type="number" min="0" max="5000" step="10" id="r15CashLimit" value="${Number(r.riderCashLimit)}" ${editable ? "" : "disabled"} /></label>
    <label class="field"><span class="field-label">A break is allowed every (minutes online)</span><input class="input" type="number" min="30" max="480" step="10" id="r15BreakEvery" value="${Number(r.riderBreakEveryMin)}" ${editable ? "" : "disabled"} /></label>
    <label class="field"><span class="field-label">A break lasts (minutes)</span><input class="input" type="number" min="1" max="60" step="1" id="r15BreakLen" value="${Number(r.riderBreakMin)}" ${editable ? "" : "disabled"} /></label>
    ${editable ? `<button class="btn btn-primary btn-block" data-action="r15-save-rider-rules">Save</button>` : ""}</div>`;
}
(() => {
  const panel = window.adminDeliveryPanel;
  window.adminDeliveryPanel = (editable) => `${panel(editable)}${r15RiderRulesCard(editable)}${r15ReasonsHTML()}`;
})();
Actions["r15-save-rider-rules"] = () => {
  const lim = Number(document.getElementById("r15CashLimit").value), every = Number(document.getElementById("r15BreakEvery").value), len = Number(document.getElementById("r15BreakLen").value);
  if (!(lim >= 0 && lim <= 5000)) { showToast("Cash limit: must be S$0–5000", "danger"); return; }
  if (!(Number.isInteger(every) && every >= 30 && every <= 480)) { showToast("Break every: must be 30–480 minutes", "danger"); return; }
  if (!(Number.isInteger(len) && len >= 1 && len <= 60)) { showToast("Break length: must be 1–60 minutes", "danger"); return; }
  const b = r15Rules(), before = { "rider.cashLimit": b.riderCashLimit, "rider.breakEveryMin": b.riderBreakEveryMin, "rider.breakMin": b.riderBreakMin };
  State.businessRules = { ...b, riderCashLimit: lim, riderBreakEveryMin: every, riderBreakMin: len }; persist("businessRules");
  r15Audit("business_settings.updated", "business_settings", "rider", before, { "rider.cashLimit": lim, "rider.breakEveryMin": every, "rider.breakMin": len }, "Business settings");
  showToast("Rider rules saved"); render();
};

/* ---- G. The rider sees what the store recorded; the customer sees the moving rider ---- */
(() => {
  const me = window.r15MeView;
  window.r15MeView = (p, online, store) => {
    const last = State.rdeposits.filter((d) => d.partnerId === p.id).slice(-1)[0];
    const card = last ? `<div class="r15-card"><div class="r15-card-title">Last cash handed in <span class="qk-muted small">${fmtDateTime(last.at)}</span></div><div class="row"><span class="qk-muted">Expected</span><span>${money(last.expected)}</span></div><div class="row"><span class="qk-muted">Counted by the store</span><span>${money(last.counted)}</span></div><div class="row"><span class="qk-muted">Difference</span><span>${last.diff === 0 ? "None" : (last.diff < 0 ? "Short " : "Over ") + money(Math.abs(last.diff))}</span></div></div>` : "";
    return me(p, online, store).replace('<div class="r15-card"><div class="r15-card-title">This shift</div>', `${card}<div class="r15-card"><div class="r15-card-title">This shift</div>`);
  };
  // While the rider is out with the order the banner said "Delivered — enjoy!" (it shows the NEXT step); say what is happening now.
  const stepInfo = window.currentStepInfo;
  window.currentStepInfo = (order) => (order.status === "picked_up" && order.fulfillment !== "pickup" ? { label: "Out for Delivery", desc: "Your rider is on the way." } : stepInfo(order));
  const banner = window.orderStatusBannerHTML;
  window.orderStatusBannerHTML = (order) => {
    const html = banner(order);
    const r = order.r15, p = findPartner(order.deliveryPartnerId);
    if (!r || !p || order.status !== "picked_up" || !["en_route", "arrived"].includes(r.stage)) return html;
    const loc = r15Loc(p.id), pin = r15Pin(order), name = esc(p.name.split(" ")[0]);
    let line;
    if (r.stage === "arrived") line = `${name} has arrived with your order.`;
    else if (loc.stale) line = "Rider location unavailable right now.";
    else { const mins = Math.max(5, Math.ceil(r15Meters(loc, pin) / 333 / 5) * 5); line = `${name} is about ${mins} min away <span class="qk-muted small">(may vary)</span>`; }
    const map = loc.stale ? "" : r15Map([{ ...pin, kind: "customer", label: "You" }, { lat: loc.lat, lng: loc.lng, kind: "rider", label: name }], 130);
    return `${html}<div class="r15-custcard">${map}<div class="r15-custcard-line">${ic("truck")}<span>${line}</span></div></div>`;
  };
})();
(() => {
  const extra = window.extraModal;
  window.extraModal = (type) => (type === "r15aCash" ? r15aCashModal() : type === "r15aClose" ? r15aCloseModal() : extra(type));
})();

/* ---------------- What's new ---------------- */
WHATS_NEW.unshift({ area: "Round 15 — the rider app and rider trips", items: [
  ["The rider app, as a phone app", "Deliveries, Earnings, History and Me, built on the rider APIs and the new rider-trip design (docs/13). It shows as a phone in the middle of the page on a computer. Log in with the mobile number and a code (prototype: always 123456)."],
  ["The trip, step by step", "Assigned orders show the items and a rough area only — no street, name or phone. Pick each one up with a photo, then press Start delivery. Customer 1 appears in full with a map button; Delivered unlocks when the phone is at the pin; a photo is taken before Delivered; then 'Go to customer 2'. After the last one: Return to store, then 'I'm back at the store'. The order is set by the system: express, then slot, then nearest-next."],
  ["Missing or damaged, not delivered", "A small 'Missing / damaged item?' button asks for the product, how many, and which — nothing moves money; the store decides. 'Not delivered' is available 5 minutes after arriving, from the shop's list of reasons, behind a confirmation that says the order is cancelled and refunded."],
  ["Arrival by GPS, with a way out", "Arrival needs the phone within 50 m, accuracy within 50 m and a fresh fix; otherwise the app says why (too far, weak GPS, out of date). 'I'm here but the app can't tell' records a manual arrival with a reason — shown neutrally to the store."],
  ["Cash and breaks", "A cash bar shows what the rider holds against the shop's limit (warning near it). Over the limit after returning, the rider can't pick up new orders until store staff record the cash. A break is 10 minutes once every 2 hours online and ends by itself."],
  ["Admin", "Orders: a rider can be assigned from Picking (not Confirmed); the order drawer shows the pickup and delivery photos, the arrival, the reports and the not-delivered reason. Partners: each rider's state, cash held, 'Waiting N min', Receive cash (counted amount, shortage or excess saved) and Close trip. Business Settings ▸ Delivery & Payments: Rider cash and breaks, and the Not-delivered reasons (the Super Admin edits the list)."],
  ["Customer", "'Out for delivery' now starts when the rider presses Start delivery. While their order is the rider's current stop the customer sees the moving rider and 'about N min' (may vary); never other customers' stops."],
] });
