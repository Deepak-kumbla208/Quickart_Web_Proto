/* ====================================================================
   QuickKart prototype — Round 3 (September 2026): filters, the Orders
   workspace and the Customers section.

   Loads after quickkart.js and quickkart-2026-09.js. The same filter bar
   is used on every admin screen that needs one; exports follow it.
   ==================================================================== */

/* ---------------- 1. Filter bar (shared) ---------------- */
UI.filters = UI.filters || { dash: { date: "30" } };
UI.adminOrderFilter = "action"; // Orders opens on "Needs action"
function F(screen) { return UI.filters[screen] || (UI.filters[screen] = {}); }
const DATE_PRESETS = [["", "Any time"], ["today", "Today"], ["yesterday", "Yesterday"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["month", "This month"], ["custom", "Custom dates…"]];
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
// { from, to } in ms (to exclusive), or null for "any time".
function dateRangeOf(preset, fromStr, toStr) {
  const today = startOfToday();
  switch (preset) {
    case "today": return { from: today, to: null };
    case "yesterday": return { from: today - 86400000, to: today };
    case "7": return { from: Date.now() - 7 * 86400000, to: null };
    case "30": return { from: Date.now() - 30 * 86400000, to: null };
    case "month": { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth(), 1).getTime(), to: null }; }
    case "custom": {
      const from = fromStr ? new Date(`${fromStr}T00:00:00`).getTime() : null;
      const to = toStr ? new Date(`${toStr}T00:00:00`).getTime() + 86400000 : null;
      return from || to ? { from, to } : null;
    }
    default: return null;
  }
}
function inRange(ts, r) { return !r || ((r.from == null || ts >= r.from) && (r.to == null || ts < r.to)); }
function rangeLabel(preset, fromStr, toStr) {
  if (preset === "custom") return fromStr || toStr ? `${fromStr || "…"} to ${toStr || "…"}` : "Custom dates";
  return (DATE_PRESETS.find((p) => p[0] === (preset || "")) || DATE_PRESETS[0])[1];
}
// Filter bar (Round 3, redesigned): search box + filter pills + sort.
// An unused filter is a dashed "+ Label" pill; once set it becomes a solid chip
// "Label | Value ×". Pills open a small menu (not the browser's select list).
// fields: [{ key, label, options: [[value, label]] | groups: [{ label, options }], all? }]
// date:   { key, label } → presets + From/To dates inside the menu
// sort:   [[value, label]] — first one is the default
if (!Icon.plusCircle) Icon.plusCircle = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>';
if (!Icon.sortArrows) Icon.sortArrows = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3"/></svg>';
if (!Icon.xCircle) Icon.xCircle = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8 8l8 8M16 8l-8 8"/></svg>';
function fieldOptions(fd) { return fd.groups ? fd.groups.flatMap((g) => g.options) : fd.options; }
function fmenuHTML(screen, key, title, bodyHTML) {
  return `<div class="fmenu" role="dialog" aria-label="${esc(title)}"><div class="fmenu-title">${esc(title)}</div>${bodyHTML}</div>`;
}
function filterBarHTML(screen, cfg) {
  const f = F(screen);
  const open = UI.openFilter;
  const isOpen = (key) => open === `${screen}:${key}`;
  const pill = (key, label, valueLabel, menu) => {
    const active = !!valueLabel;
    return `
    <div class="fpill-wrap ${isOpen(key) ? "is-open" : ""}">
      <button type="button" class="fpill ${active ? "on" : ""}" data-action="toggle-fmenu" data-screen="${screen}" data-key="${key}" aria-haspopup="true" aria-expanded="${isOpen(key)}">
        ${active ? `<span class="fpill-label">${esc(label)}</span><span class="fpill-sep"></span><span class="fpill-value">${esc(valueLabel)}</span>${ic("chevronDown")}` : `${ic("plusCircle")}<span>${esc(label)}</span>`}
      </button>
      ${active ? `<button type="button" class="fpill-x" data-action="pick-filter" data-screen="${screen}" data-key="${key}" data-value="" aria-label="Clear ${esc(label)} filter">${ic("xCircle")}</button>` : ""}
      ${isOpen(key) ? menu : ""}
    </div>`;
  };
  const optionRows = (key, options, current) => options.map(([v, l]) => {
    const on = String(current || "") === String(v);
    return `<button type="button" class="fmenu-opt ${on ? "on" : ""}" role="option" aria-selected="${on}" data-action="pick-filter" data-screen="${screen}" data-key="${key}" data-value="${esc(v)}"><span>${esc(l)}</span>${on ? ic("check") : ""}</button>`;
  }).join("");
  // Date pill
  const date = cfg.date ? (() => {
    const k = cfg.date.key || "date";
    const cur = f[k] || "";
    const value = cur ? rangeLabel(cur, f[`${k}From`], f[`${k}To`]) : "";
    const menu = fmenuHTML(screen, k, `Filter by ${cfg.date.label.toLowerCase()} date`, `
      <div class="fmenu-list" role="listbox">${optionRows(k, DATE_PRESETS.filter(([v]) => v !== "custom"), cur)}
        <button type="button" class="fmenu-opt ${cur === "custom" ? "on" : ""}" data-action="pick-filter" data-screen="${screen}" data-key="${k}" data-value="custom" data-keep="1"><span>Custom dates…</span>${cur === "custom" ? ic("check") : ""}</button>
      </div>
      ${cur === "custom" ? `<div class="fmenu-dates">
        <label><span>From</span><input type="date" class="input" value="${esc(f[`${k}From`] || "")}" data-action="set-filter" data-screen="${screen}" data-key="${k}From" data-keep="1" /></label>
        <label><span>To</span><input type="date" class="input" value="${esc(f[`${k}To`] || "")}" data-action="set-filter" data-screen="${screen}" data-key="${k}To" data-keep="1" /></label>
        <button type="button" class="btn btn-primary btn-sm btn-block" data-action="close-fmenu">Done</button>
      </div>` : ""}`);
    return pill(k, cfg.date.label, value, menu);
  })() : "";
  // Other pills
  const fields = (cfg.fields || []).filter(Boolean).map((fd) => {
    const cur = f[fd.key] || "";
    const hit = cur ? fieldOptions(fd).find(([v]) => String(v) === String(cur)) : null;
    const list = fd.groups
      ? fd.groups.map((g) => `<div class="fmenu-group">${esc(g.label)}</div>${optionRows(fd.key, g.options, cur)}`).join("")
      : optionRows(fd.key, fd.options, cur);
    const menu = fmenuHTML(screen, fd.key, `Filter by ${fd.label.toLowerCase()}`, `<div class="fmenu-list" role="listbox">${list}</div>`);
    return pill(fd.key, fd.label, hit ? hit[1] : "", menu);
  }).join("");
  // Sort (right-aligned, never "active")
  const sort = cfg.sort ? (() => {
    const cur = f.sort || cfg.sort[0][0];
    const label = (cfg.sort.find(([v]) => v === cur) || cfg.sort[0])[1];
    return `
    <div class="fpill-wrap fsort ${isOpen("sort") ? "is-open" : ""}">
      <button type="button" class="fsort-btn" data-action="toggle-fmenu" data-screen="${screen}" data-key="sort" aria-haspopup="true" aria-expanded="${isOpen("sort")}">${ic("sortArrows")}<span>${esc(label)}</span>${ic("chevronDown")}</button>
      ${isOpen("sort") ? fmenuHTML(screen, "sort", "Sort by", `<div class="fmenu-list" role="listbox">${optionRows("sort", cfg.sort, cur)}</div>`) : ""}
    </div>`;
  })() : "";
  const activeCount = Object.keys(f).filter((k) => !["sort", "view", "q"].includes(k) && !/(From|To)$/.test(k) && f[k]).length + (f.q ? 1 : 0);
  return `
  <div class="fbar" role="search">
    ${cfg.search ? `
    <div class="fsearch">
      ${ic("search")}
      <input type="search" class="fsearch-input" value="${esc(f.q || "")}" oninput="onFilterSearch('${screen}', this.value)" placeholder="${esc(cfg.search)}" aria-label="${esc(cfg.search)}" autocomplete="off" />
      <button type="button" class="fsearch-x" data-action="clear-search" data-screen="${screen}" aria-label="Clear search">${ic("xCircle")}</button>
    </div>` : ""}
    <div class="fpills">
      ${date}${fields}
      ${activeCount ? `<button type="button" class="fclear" data-action="clear-filters" data-screen="${screen}">Clear filters</button>` : ""}
    </div>
    ${sort}
  </div>`;
}
function resultCountHTML(shown, total, noun) {
  return `<div class="fcount">${shown === total ? `${total} ${noun}` : `Showing <b>${shown}</b> of ${total} ${noun}`}</div>`;
}
// Screens whose results are redrawn in place while typing in the search box,
// so the search keeps focus.
const FILTER_RESULTS = {};
function onFilterSearch(screen, value) {
  F(screen).q = value;
  const el = document.getElementById(`fres-${screen}`);
  if (el && FILTER_RESULTS[screen]) el.innerHTML = FILTER_RESULTS[screen]();
  else render();
}
const qmatch = (q, ...fields) => !q || fields.some((x) => String(x || "").toLowerCase().includes(q.toLowerCase().trim()));

/* ---------------- 2. One-time demo data for this round ---------------- */
(function migrateRound3() {
  if (loadLS("migrated_2026_09_r3", false)) return;
  const today = isoDate(new Date());
  const tpl = State.slotSettings.templates;
  let n = 0;
  // Give existing orders a delivery type so filters and the slot view have something to show.
  State.orders = State.orders.map((o) => {
    if (o.fulfillment === "pickup" || o.deliverySpeed) return o;
    n++;
    if (n % 3 === 0 && o.branchId && tpl.length) {
      const open = !TERMINAL_STATUSES.includes(o.status);
      const slot = tpl[open ? (n % tpl.length) : (n % tpl.length)];
      const date = open ? today : isoDate(new Date(o.createdAt + 86400000));
      const key = slotKey(o.branchId, date, slot.id);
      return { ...o, deliverySpeed: "scheduled", slotKey: key, scheduledSlot: open ? slotLabelFromKey(key) || `${date}, ${fmtSlotRange(slot)}` : `${date}, ${fmtSlotRange(slot)}` };
    }
    return { ...o, deliverySpeed: "express" };
  });
  // A few older customers, so the "Last order: not in 30+ / 90+ days" filters have something to find.
  const old = [["Rahul Verma", "91110001", 45], ["Mei Lin Goh", "91110002", 70], ["Suresh Pillai", "91110003", 120], ["Nadia Rahman", "91110004", 150]];
  old.forEach(([name, mobile, daysAgo], i) => {
    [0, 6].forEach((extra, k) => {
      const it = SEED_ITEMS[(i * 7 + k * 3) % SEED_ITEMS.length];
      const qty = 2 + k;
      const at = Date.now() - (daysAgo + extra) * 86400000;
      State.orders.push({ id: genId("QK"), invoiceNo: genId("INV-"), customerName: name, contactName: name, contactMobile: mobile, address: "Home - 21 Clementi Ave 2, #08-110, Singapore 120021", branchId: 2, items: [{ id: it.id, name: it.name, unit: it.unit, price: it.price, eta: it.eta, qty, delivered: null }], total: it.price * qty + 4.9, deliveryFee: 4.9, walletApplied: 0, discount: 0, paymentMethod: k ? "Cash on Delivery" : "PayNow", status: "delivered", deliverySpeed: "express", deliveryPartnerId: 2, rating: 4, riderEarning: RIDER_FLAT_FEE, createdAt: at, statusHistory: [{ status: "new", at }, { status: "delivered", at: at + 3600000 }] });
    });
  });
  State.orders.sort((a, b) => b.createdAt - a.createdAt);
  persist("orders");
  saveLS("migrated_2026_09_r3", true);
})();
Object.assign(State, {
  customerMeta: loadLS("customerMeta", {}),
  demoCustomerName: loadLS("demoCustomerName", "Customer"),
});
PERSIST_KEYS.push("customerMeta", "demoCustomerName");
(function screenPermissionsRound3() {
  const c = PERMISSION_SCREENS.find((s) => s.key === "customers");
  if (c) c.editable = true; // wallet credit, block, notes, message (Round 3)
})();

/* ---------------- 3. Order helpers: type, payment, timing, issues ---------------- */
function orderKind(o) {
  if (o.fulfillment === "pickup") return "pickup";
  if (o.slotKey || o.deliverySpeed === "scheduled" || o.scheduledSlot) return "scheduled";
  return "express";
}
const KIND_META = { express: { label: "Express", tone: "blue" }, scheduled: { label: "Scheduled", tone: "gray" }, pickup: { label: "Pickup", tone: "green" } };
const ONLINE_METHODS = ["PayNow", "GrabPay", "Credit / Debit Card", "QuickKart Wallet"];
function orderPayStatus(o) {
  if (["cancelled", "returned"].includes(o.status)) return { key: "refunded", label: "Refunded / void", tone: "gray" };
  if (o.paymentMethod === "Cash on Delivery") return o.status === "delivered" ? { key: "paid", label: "Cash collected", tone: "green" } : { key: "collect", label: "To collect", tone: "yellow" };
  return { key: "paid", label: "Paid", tone: "green" };
}
function orderSlotWindow(o) {
  const f = o.slotKey ? findSlotByKey(o.slotKey) : null;
  if (!f) return null;
  const at = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); const d = new Date(`${f.date}T00:00:00`); d.setHours(h, m, 0, 0); return d.getTime(); };
  return { ...f, startMs: at(f.slot.start), endMs: at(f.slot.end) };
}
function timeAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
function minsText(m) {
  m = Math.round(Math.abs(m));
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
  const d = Math.floor(m / 1440);
  return `${d} day${d === 1 ? "" : "s"}`;
}
// One short badge telling staff whether the order is on time.
function orderTiming(o) {
  if (TERMINAL_STATUSES.includes(o.status)) return null;
  const now = Date.now();
  const age = (now - o.createdAt) / 60000;
  if (o.status === "new" && age > 10) return { late: true, tone: "red", label: `Not confirmed · ${minsText(age)}` };
  const kind = orderKind(o);
  if (kind === "scheduled") {
    const w = orderSlotWindow(o);
    if (w) {
      if (now > w.endMs) return { late: true, tone: "red", label: "Slot ended — not delivered" };
      if (PREP_STATUSES.includes(o.status) && w.startMs - now < 30 * 60000) return { late: w.startMs < now, tone: w.startMs < now ? "red" : "yellow", label: w.startMs < now ? "Slot started — not packed" : `Slot in ${minsText((w.startMs - now) / 60000)} — not packed` };
      return { late: false, tone: "gray", label: `Slot ${slotDayLabel(w.date).toLowerCase()} ${fmtClock(w.slot.start)}` };
    }
  }
  if (kind === "express") {
    const eta = Math.max(...o.items.map((i) => i.eta || 20), 20) + 15;
    const due = o.createdAt + eta * 60000;
    if (now > due) return { late: true, tone: "red", label: `Express overdue ${minsText((now - due) / 60000)}` };
    return { late: false, tone: "blue", label: `Due in ${minsText((due - now) / 60000)}` };
  }
  if (kind === "pickup" && age > 60 && PREP_STATUSES.includes(o.status)) return { late: false, tone: "yellow", label: `Waiting ${minsText(age)}` };
  return { late: false, tone: "gray", label: `Placed ${timeAgo(o.createdAt)}` };
}
function orderIssues(o) {
  return {
    unavailable: o.items.some((i) => i.unavailable && !i.resolution),
    returnReq: !!o.returnRequest && returnRequestCurrentKey(o.returnRequest) !== "completed",
  };
}
function needsAction(o) {
  const iss = orderIssues(o);
  if (iss.returnReq) return true;
  if (TERMINAL_STATUSES.includes(o.status)) return false;
  const t = orderTiming(o);
  return o.status === "new" || iss.unavailable || !!(t && t.late);
}
function needsActionReason(o) {
  const iss = orderIssues(o);
  const t = orderTiming(o);
  return iss.returnReq ? "Return requested" : iss.unavailable ? "Item unavailable — customer to choose" : t && t.late ? t.label : o.status === "new" ? "Confirm this order" : "";
}

/* ---------------- 4. Admin ▸ Orders (workspace) ---------------- */
function scopedOrders() {
  const ids = scopedBranchIds();
  return State.orders.filter((o) => !ids || ids.includes(o.branchId));
}
// Every filter except the status tab (tab counts are computed from this).
function ordersBase() {
  const f = F("orders");
  const r = dateRangeOf(f.date, f.dateFrom, f.dateTo);
  return scopedOrders().filter((o) => {
    if (!inRange(o.createdAt, r)) return false;
    if (!qmatch(f.q, o.id, o.customerName, o.contactMobile)) return false;
    if (f.type && orderKind(o) !== f.type) return false;
    if (f.slot) {
      const [d, s] = f.slot.split("|");
      const w = o.slotKey ? o.slotKey.split("|") : [];
      if (w[1] !== d || (s !== "*" && w[2] !== s)) return false;
    }
    if (f.pay && o.paymentMethod !== f.pay) return false;
    if (f.payStatus && orderPayStatus(o).key !== f.payStatus) return false;
    if (f.rider === "none" ? !!o.deliveryPartnerId || o.fulfillment === "pickup" : f.rider && String(o.deliveryPartnerId) !== f.rider) return false;
    if (f.issue) {
      const iss = orderIssues(o);
      if (f.issue === "unavailable" && !iss.unavailable) return false;
      if (f.issue === "return" && !iss.returnReq) return false;
      if (f.issue === "late" && !(orderTiming(o) || {}).late) return false;
    }
    return true;
  });
}
function sortOrders(list) {
  const s = F("orders").sort || "newest";
  const slotStart = (o) => { const w = orderSlotWindow(o); return w ? w.startMs : Infinity; };
  return list.slice().sort((a, b) => s === "oldest" ? a.createdAt - b.createdAt : s === "amount" ? b.total - a.total : s === "slot" ? slotStart(a) - slotStart(b) : b.createdAt - a.createdAt);
}
function ordersFiltered() {
  const tab = UI.adminOrderFilter || "action";
  const base = ordersBase();
  const list = tab === "all" ? base : tab === "action" ? base.filter(needsAction) : base.filter((o) => o.status === tab);
  return sortOrders(list);
}
function adminOrdersV2() {
  const view = F("orders").view || "list";
  const inScope = scopedOrders();
  const today = startOfToday();
  const todays = inScope.filter((o) => o.createdAt >= today);
  const open = inScope.filter((o) => !TERMINAL_STATUSES.includes(o.status));
  const late = open.filter((o) => (orderTiming(o) || {}).late);
  const riders = State.partners.filter((p) => { const ids = scopedBranchIds(); return !ids || ids.includes(p.branchId); });
  const slotGroups = slotDays().map((d) => ({ label: d.label, options: [[`${d.date}|*`, `${d.label} — all slots`], ...State.slotSettings.templates.map((t) => [`${d.date}|${t.id}`, `${d.label} ${fmtSlotRange(t)}`])] }));
  FILTER_RESULTS.orders = ordersResultsHTML;
  return `
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-label">Orders today</div><div class="stat-value">${todays.length}</div><div class="stat-sub"><span>${todays.filter((o) => orderKind(o) === "express").length} express · ${todays.filter((o) => orderKind(o) === "scheduled").length} scheduled · ${todays.filter((o) => orderKind(o) === "pickup").length} pickup</span></div></div>
    <div class="stat-card"><div class="stat-label">In progress</div><div class="stat-value">${open.length}</div><div class="stat-sub"><span>${open.filter((o) => o.status === "new").length} waiting to be confirmed</span></div></div>
    <div class="stat-card ${late.length ? "stat-alert" : ""}"><div class="stat-label">Late now</div><div class="stat-value">${late.length}</div><div class="stat-sub"><span>${late.length ? "Open the Needs action tab" : "Everything on time"}</span></div></div>
    <div class="stat-card"><div class="stat-label">Sales today</div><div class="stat-value">${money(todays.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0))}</div><div class="stat-sub"><span>Excludes cancelled</span></div></div>
  </div>
  <div class="admin-toolbar">
    <div class="seg" role="tablist" aria-label="View">
      ${[["list", "List"], ["slot", "By slot"], ["board", "Board"]].map(([k, l]) => `<button type="button" class="seg-btn ${view === k ? "active" : ""}" data-action="set-filter-btn" data-screen="orders" data-key="view" data-value="${k}" role="tab" aria-selected="${view === k}">${l}</button>`).join("")}
    </div>
    ${exportButtonsHTML("orders")}
  </div>
  ${filterBarHTML("orders", {
    search: "Order no, customer or mobile…",
    date: { key: "date", label: "Placed" },
    fields: [
      { key: "type", label: "Type", options: [["express", "Express"], ["scheduled", "Scheduled"], ["pickup", "Pickup"]] },
      { key: "slot", label: "Slot", all: "Any slot", groups: slotGroups },
      { key: "pay", label: "Payment", options: [...State.deliverySettings.paymentMethods.map((m) => [m.name, m.name]), ["QuickKart Wallet", "QuickKart Wallet"]] },
      { key: "payStatus", label: "Paid?", options: [["paid", "Paid / collected"], ["collect", "Cash to collect"], ["refunded", "Refunded / void"]] },
      { key: "rider", label: "Rider", options: [["none", "Not assigned"], ...riders.map((p) => [String(p.id), p.name])] },
      { key: "issue", label: "Issues", all: "Any", options: [["late", "Late"], ["unavailable", "Item unavailable"], ["return", "Return requested"]] },
    ],
    sort: [["newest", "Newest first"], ["oldest", "Oldest first"], ["slot", "Slot time"], ["amount", "Amount (high → low)"]],
  })}
  <div id="fres-orders">${ordersResultsHTML()}</div>
  ${UI.orderDrawerId ? orderDrawerHTML() : ""}`;
}
function ordersResultsHTML() {
  const view = F("orders").view || "list";
  const base = ordersBase();
  if (view === "board") return ordersBoardHTML(sortOrders(base));
  const tabs = ["action", "all", ...TIMELINE_STEPS, "cancelled", "returned"];
  const countFor = (t) => t === "all" ? base.length : t === "action" ? base.filter(needsAction).length : base.filter((o) => o.status === t).length;
  const cur = UI.adminOrderFilter || "action";
  const list = ordersFiltered();
  return `
  <div class="pill-row">
    ${tabs.map((t) => `<button class="pill ${cur === t ? "active" : ""} ${t === "action" ? "pill-action" : ""}" data-action="admin-order-filter" data-filter="${t}">${t === "all" ? "All" : t === "action" ? "Needs action" : STATUS_META[t].label} <span class="pill-count">${countFor(t)}</span></button>`).join("")}
  </div>
  ${resultCountHTML(list.length, base.length, "orders")}
  ${view === "slot" ? ordersBySlotHTML(list) : ordersListHTML(list)}`;
}
function orderRowHTML(o) {
  const kind = orderKind(o);
  const t = orderTiming(o);
  const pay = orderPayStatus(o);
  const branch = findBranch(o.branchId);
  const reason = UI.adminOrderFilter === "action" ? needsActionReason(o) : "";
  return `
  <button type="button" class="ord-row ${UI.orderDrawerId === o.id ? "is-open" : ""}" data-action="open-order" data-id="${o.id}">
    <span class="ord-id"><b>#${esc(o.id)}</b><span class="qk-muted small">${fmtDateTime(o.createdAt)}</span></span>
    <span class="ord-cust"><b>${esc(o.customerName)}</b><span class="qk-muted small">${o.contactMobile ? fmtMobile(o.contactMobile) : "—"}</span></span>
    <span class="ord-type"><span class="badge badge-${KIND_META[kind].tone}-soft">${KIND_META[kind].label}</span><span class="qk-muted small">${kind === "scheduled" && (o.slotKey || o.scheduledSlot) ? esc((o.slotKey && slotLabelFromKey(o.slotKey)) || o.scheduledSlot) : branch ? esc(branch.name) : ""}</span></span>
    <span class="ord-amt"><b class="qk-num">${money(o.total)}</b><span class="qk-muted small">${o.items.reduce((n, i) => n + i.qty, 0)} items · <span class="tone-${pay.tone}">${pay.label}</span></span></span>
    <span class="ord-status"><span class="badge badge-${STATUS_META[o.status].tone}-soft">${STATUS_META[o.status].label}</span>${t ? `<span class="badge badge-${t.tone}-soft timing">${esc(t.label)}</span>` : ""}${reason && (!t || reason !== t.label) ? `<span class="small tone-red">${esc(reason)}</span>` : ""}</span>
  </button>`;
}
function ordersListHTML(list) {
  if (!list.length) return `<div class="empty-state"><div class="empty-title">${UI.adminOrderFilter === "action" ? "Nothing needs action" : "No orders match"}</div><div class="empty-hint">${UI.adminOrderFilter === "action" ? "New, late and problem orders show up here." : "Try another tab or clear the filters."}</div></div>`;
  return `<div class="ord-list">${list.slice(0, 200).map(orderRowHTML).join("")}</div>`;
}
// Orders grouped by the delivery window they must leave in — how a store plans its day.
function ordersBySlotHTML(list) {
  const groups = new Map();
  list.forEach((o) => {
    const kind = orderKind(o);
    const w = orderSlotWindow(o);
    let key, label, sortKey, meta = "";
    if (kind === "express") { key = "express"; label = "Express — as soon as possible"; sortKey = "0"; }
    else if (kind === "pickup") { key = "pickup"; label = "Pickup at the store"; sortKey = "9"; }
    else if (w) {
      key = o.slotKey; sortKey = `1${w.date}${w.slot.start}`;
      label = `${slotDayLabel(w.date)} · ${fmtSlotRange(w.slot)} · ${(findBranch(w.storeId) || {}).name || ""}`;
      const inf = slotInfo(w.storeId, w.date, w.slot);
      meta = `${inf.booked}/${inf.cap} booked`;
    } else { key = "older"; label = "Scheduled (earlier days)"; sortKey = "8"; }
    if (!groups.has(key)) groups.set(key, { label, sortKey, meta, orders: [] });
    groups.get(key).orders.push(o);
  });
  if (!groups.size) return ordersListHTML([]);
  return [...groups.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map((g) => {
    const packed = g.orders.filter((o) => !PREP_STATUSES.includes(o.status)).length;
    return `
    <div class="slot-group-card">
      <div class="slot-group-head"><b>${esc(g.label)}</b><span class="qk-muted small">${g.orders.length} order${g.orders.length === 1 ? "" : "s"} · ${packed} packed or further${g.meta ? ` · ${g.meta}` : ""}</span></div>
      <div class="ord-list">${g.orders.map(orderRowHTML).join("")}</div>
    </div>`;
  }).join("");
}
const BOARD_COLUMNS = ["new", "confirmed", "picking", "packing", "ready_for_rider", "picked_up"];
function boardNextStep(o) {
  if (o.fulfillment === "pickup" && o.status === "packing") return { status: "delivered", label: "Mark picked up" };
  if (PREP_STATUSES.includes(o.status)) return { status: TIMELINE_STEPS[TIMELINE_STEPS.indexOf(o.status) + 1], label: ADVANCE_LABEL[o.status] };
  if (o.status === "ready_for_rider") return o.fulfillment === "pickup" ? null : { status: "picked_up", label: "Mark picked up" };
  if (o.status === "picked_up") return { status: "delivered", label: "Mark delivered" };
  return null;
}
function ordersBoardHTML(list) {
  const editable = canEdit(currentUser(), "orders");
  const deliveredToday = list.filter((o) => o.status === "delivered" && o.createdAt >= startOfToday()).length;
  return `
  ${resultCountHTML(list.filter((o) => BOARD_COLUMNS.includes(o.status)).length, list.filter((o) => BOARD_COLUMNS.includes(o.status)).length, "open orders")}
  <div class="board">
    ${BOARD_COLUMNS.map((st) => {
      const col = list.filter((o) => o.status === st);
      return `
      <div class="board-col">
        <div class="board-col-head">${STATUS_META[st].label}<span class="pill-count">${col.length}</span></div>
        ${col.map((o) => {
          const t = orderTiming(o);
          const next = boardNextStep(o);
          const rider = findPartner(o.deliveryPartnerId);
          return `
          <div class="board-card ${t && t.late ? "is-late" : ""}" data-action="open-order" data-id="${o.id}" role="button" tabindex="0">
            <div class="row"><b>#${esc(o.id)}</b><span class="qk-num">${money(o.total)}</span></div>
            <div class="small">${esc(o.customerName)} · ${o.items.reduce((n, i) => n + i.qty, 0)} items</div>
            <div class="board-card-tags"><span class="badge badge-${KIND_META[orderKind(o)].tone}-soft">${KIND_META[orderKind(o)].label}</span>${t ? `<span class="badge badge-${t.tone}-soft">${esc(t.label)}</span>` : ""}</div>
            ${st === "ready_for_rider" && o.fulfillment !== "pickup" ? `<div class="small qk-muted">${rider ? `Rider: ${esc(rider.name)}` : "Waiting for a rider"}</div>` : ""}
            ${editable && next ? `<button type="button" class="btn btn-sm btn-primary-soft btn-block" data-action="set-order-status" data-id="${o.id}" data-status="${next.status}">${esc(next.label)} →</button>` : ""}
          </div>`;
        }).join("") || `<div class="board-empty">Nothing here</div>`}
      </div>`;
    }).join("")}
  </div>
  <div class="qk-muted small" style="margin-top:8px">${deliveredToday} delivered today. Cancelled and returned orders are in the List view.</div>`;
}

/* ---------------- 5. Order side panel (details + picking) ---------------- */
function orderDrawerHTML() {
  const o = State.orders.find((x) => x.id === UI.orderDrawerId);
  if (!o) return "";
  const editable = canEdit(currentUser(), "orders");
  const kind = orderKind(o);
  const t = orderTiming(o);
  const pay = orderPayStatus(o);
  const branch = findBranch(o.branchId);
  const next = boardNextStep(o);
  const picking = PREP_STATUSES.includes(o.status) && o.status !== "new";
  const picked = o.picked || {};
  const pickedCount = o.items.filter((_, i) => picked[i]).length;
  const riders = branchRiders(o.branchId).filter((p) => p.active !== false || p.id === o.deliveryPartnerId);
  const custKey = o.customerName || "Unknown";
  const history = o.statusHistory || [];
  const itemTotal = o.itemTotal != null ? o.itemTotal : o.items.reduce((s, i) => s + i.price * i.qty, 0);
  return `
  <div class="drawer-overlay" data-action="close-order-drawer"></div>
  <aside class="order-drawer" role="dialog" aria-modal="true" aria-label="Order ${esc(o.id)}">
    <div class="drawer-head">
      <div><div class="drawer-title">#${esc(o.id)} <span class="badge badge-${STATUS_META[o.status].tone}-soft">${STATUS_META[o.status].label}</span></div>
        <div class="qk-muted small">${fmtDateTime(o.createdAt)} · ${timeAgo(o.createdAt)}${t ? ` · <span class="tone-${t.tone}">${esc(t.label)}</span>` : ""}</div></div>
      <button class="dialog-close" data-action="close-order-drawer" aria-label="Close">${ic("close")}</button>
    </div>
    <div class="drawer-actions">
      ${editable && next ? `<button class="btn btn-primary btn-sm" data-action="set-order-status" data-id="${o.id}" data-status="${next.status}">${esc(next.label)}</button>` : ""}
      <button class="btn btn-outline btn-sm" data-action="print-pick-slip" data-id="${o.id}">${ic("package")} Picking slip</button>
      <button class="btn btn-outline btn-sm" data-action="open-invoice" data-id="${o.id}">${ic("receipt")} Invoice</button>
      ${editable && [...PREP_STATUSES, "ready_for_rider"].includes(o.status) ? `<button class="btn btn-outline-danger btn-sm" data-action="open-admin-cancel" data-id="${o.id}">Cancel order</button>` : ""}
    </div>
    <div class="drawer-body">
      <section class="drawer-sec">
        <div class="drawer-sec-title">Items ${picking ? `<span class="badge badge-${pickedCount === o.items.length ? "green" : "blue"}-soft">${pickedCount} of ${o.items.length} picked</span>` : ""}</div>
        ${picking ? `<div class="qk-muted small" style="margin-bottom:6px">Tick each item as you pick it. Can't find one? Mark it unavailable — the customer then chooses a swap or a refund.</div>` : ""}
        ${o.items.map((it, idx) => {
          if (it.unavailable && !it.resolution) return adminOrderItemRow(o, it, idx, editable);
          const cat = (findItem(it.id) || {}).cat || "";
          return `
          <div class="pick-row ${picked[idx] ? "is-picked" : ""}">
            ${picking && editable ? `<input type="checkbox" class="pick-check" ${picked[idx] ? "checked" : ""} data-action="toggle-picked" data-id="${o.id}" data-idx="${idx}" aria-label="Picked ${esc(it.name)}" />` : ""}
            <span class="pick-qty">${it.qty}×</span>
            <span class="pick-name">${esc(it.name)}${it.resolution === "swap" ? " <span class='badge badge-blue-soft'>Swapped</span>" : it.resolution ? " <span class='badge badge-gray-soft'>Refunded</span>" : ""}<span class="qk-muted small">${esc(it.unit || "")}${cat ? ` · ${esc(cat)}` : ""}</span></span>
            <span class="qk-num">${money(it.price * it.qty)}</span>
            ${picking && editable && !picked[idx] && !it.resolution ? `<button class="link-btn link-danger small" data-action="mark-item-unavailable" data-id="${o.id}" data-idx="${idx}">Not available</button>` : ""}
          </div>`;
        }).join("")}
      </section>
      <section class="drawer-sec">
        <div class="drawer-sec-title">Customer</div>
        <div><b>${esc(o.contactName || o.customerName)}</b>${o.contactMobile ? ` · <a href="${telHref(o.contactMobile)}">${fmtMobile(o.contactMobile)}</a>` : ""}</div>
        <div class="qk-muted small">${esc(o.address)}</div>
        ${o.deliveryInstructions ? `<div class="drawer-note">${ic("alert")} ${esc(o.deliveryInstructions)}</div>` : ""}
        ${canView(currentUser(), "customers") ? `<button class="link-btn small" data-action="open-customer" data-key="${esc(custKey)}">View customer →</button>` : ""}
      </section>
      <section class="drawer-sec">
        <div class="drawer-sec-title">Delivery</div>
        <div class="row small"><span>Type</span><span><span class="badge badge-${KIND_META[kind].tone}-soft">${KIND_META[kind].label}</span></span></div>
        ${o.scheduledSlot ? `<div class="row small"><span>Slot</span><span>${esc(o.scheduledSlot)}</span></div>` : ""}
        <div class="row small"><span>${kind === "pickup" ? "Pickup store" : "Store"}</span><span>${branch ? esc(branch.name) : "—"}</span></div>
        ${kind !== "pickup" && DISPATCH_STATUSES.includes(o.status) && editable ? `
        <label class="field"><span class="field-label">Rider (${branch ? esc(branch.name) : "store"} riders)</span>
          <select class="input" data-action="assign-partner" data-order="${o.id}" ${!o.branchId ? "disabled" : ""}>
            <option value="">Unassigned</option>
            ${riders.map((p) => `<option value="${p.id}" ${o.deliveryPartnerId === p.id ? "selected" : ""}>${esc(p.name)} (${esc(p.code)})</option>`).join("")}
          </select></label>` : o.deliveryPartnerId ? `<div class="row small"><span>Rider</span><span>${esc((findPartner(o.deliveryPartnerId) || {}).name || "—")}</span></div>` : ""}
      </section>
      <section class="drawer-sec">
        <div class="drawer-sec-title">Payment <span class="badge badge-${pay.tone}-soft">${pay.label}</span></div>
        <div class="row small"><span>Method</span><span>${esc(o.paymentMethod)}</span></div>
        <div class="row small"><span>Items</span><span class="qk-num">${money(itemTotal)}</span></div>
        ${o.couponDiscount ? `<div class="row small"><span>Coupon ${esc(o.couponCode || "")}</span><span class="qk-num">− ${money(o.couponDiscount)}</span></div>` : ""}
        <div class="row small"><span>Delivery fee</span><span class="qk-num">${o.deliveryFee ? money(o.deliveryFee) : "FREE"}</span></div>
        ${o.expressCharge ? `<div class="row small"><span>Express charge</span><span class="qk-num">${money(o.expressCharge)}</span></div>` : ""}
        ${o.walletApplied ? `<div class="row small"><span>Wallet used</span><span class="qk-num">− ${money(o.walletApplied)}</span></div>` : ""}
        <div class="row"><b>Total</b><b class="qk-num">${money(o.total)}</b></div>
      </section>
      ${o.returnRequest || o.rating || (o.itemRatings && Object.keys(o.itemRatings).length) ? `
      <section class="drawer-sec">
        <div class="drawer-sec-title">After delivery</div>
        ${o.returnRequest ? `<div class="small">${o.returnRequest.resolution === "replacement" ? "Replacement" : "Refund"} request — ${esc(RETURN_STEPS.find((s) => s.key === returnRequestCurrentKey(o.returnRequest)).label)} (${esc(o.returnRequest.reason)})</div>` : ""}
        ${o.rating ? `<div class="small">Rating: ${"★".repeat(o.rating)}${"☆".repeat(5 - o.rating)}</div>` : ""}
        ${adminOrderRatingsHTML(o)}
      </section>` : ""}
      <section class="drawer-sec">
        <div class="drawer-sec-title">Timeline</div>
        <ol class="drawer-timeline">
          ${history.map((h) => `<li><span class="tl-dot"></span><b>${esc((STATUS_META[h.status] || { label: h.status }).label)}</b><span class="qk-muted small">${fmtDateTime(h.at)}${h.reason ? ` · ${esc(h.reason)}` : ""}</span></li>`).join("")}
        </ol>
      </section>
    </div>
  </aside>`;
}
function printHtmlDocument(title, bodyHtml) {
  const css = "body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000;margin:24px;line-height:1.4}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{padding:6px;border-bottom:1px solid #ddd;text-align:left}th{background:#f2f2f2}.box{display:inline-block;width:14px;height:14px;border:1.5px solid #000}h1{font-size:16px;margin:0 0 4px}.muted{color:#555}.note{border:1px solid #999;padding:6px;margin-top:8px}.cat td{background:#fafafa;font-weight:700}";
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:820px;height:1160px;border:0;";
  document.body.appendChild(frame);
  const d = frame.contentWindow.document;
  d.open(); d.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${esc(title)}</title><style>${css}</style></head><body>${bodyHtml}</body></html>`); d.close();
  setTimeout(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) {} setTimeout(() => frame.remove(), 60000); }, 300);
}
function printPickSlip(o) {
  const byCat = {};
  o.items.forEach((it) => { if (it.resolution) return; const c = (findItem(it.id) || {}).cat || "Other"; (byCat[c] = byCat[c] || []).push(it); });
  const rows = Object.keys(byCat).sort().map((c) => `<tr class="cat"><td colspan="4">${esc(c)}</td></tr>${byCat[c].map((it) => `<tr><td><span class="box"></span></td><td><b>${it.qty}</b></td><td>${esc(it.name)}${it.unavailable ? " — UNAVAILABLE" : ""}</td><td>${esc(it.unit || "")}</td></tr>`).join("")}`).join("");
  const branch = findBranch(o.branchId);
  printHtmlDocument(`Picking slip #${o.id}`, `
    <h1>Picking slip · #${esc(o.id)}</h1>
    <div class="muted">${esc(branch ? branch.name : "")} · ${KIND_META[orderKind(o)].label}${o.scheduledSlot ? ` · ${esc(o.scheduledSlot)}` : ""} · placed ${fmtDateTime(o.createdAt)}</div>
    <div style="margin-top:8px"><b>${esc(o.contactName || o.customerName)}</b> ${o.contactMobile ? fmtMobile(o.contactMobile) : ""}<br>${esc(o.address)}</div>
    ${o.deliveryInstructions ? `<div class="note">Note: ${esc(o.deliveryInstructions)}</div>` : ""}
    <table><thead><tr><th style="width:30px">✓</th><th style="width:40px">Qty</th><th>Item</th><th>Unit</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="muted">Items sorted by aisle (category). ${o.items.reduce((n, i) => n + i.qty, 0)} units in total.</p>`);
}

/* ---------------- 6. Customers ---------------- */
function customerMeta(key) { return State.customerMeta[key] || { notes: [], credits: [], messages: [], blocked: null }; }
function saveCustomerMeta(key, patch) { State.customerMeta = { ...State.customerMeta, [key]: { ...customerMeta(key), ...patch } }; persist("customerMeta"); }
function isCustomerBlocked(name) { return !!customerMeta(name || (State.session && State.session.name) || "").blocked; }
function walletHistoryFor(c) {
  const rows = [];
  c.orders.forEach((o) => {
    if (o.walletApplied > 0) rows.push({ at: o.createdAt, amount: -o.walletApplied, text: `Used on order #${o.id}` });
    o.items.forEach((it) => { if (it.resolution === "wallet") rows.push({ at: o.createdAt, amount: round2(it.price * it.qty * 1.1), text: `${it.name} unavailable on #${o.id} (+10% bonus)` }); });
  });
  customerMeta(c.key).credits.forEach((cr) => rows.push({ at: cr.at, amount: cr.amount, text: `Goodwill credit — ${cr.reason} (by ${cr.by})` }));
  return rows.sort((a, b) => b.at - a.at);
}
function customerRecords() {
  const base = customersFromOrders();
  return base.map((c) => {
    const billable = c.orders.filter((o) => o.status !== "cancelled");
    const wallet = walletHistoryFor(c);
    const stores = {};
    c.orders.forEach((o) => { if (o.branchId) stores[o.branchId] = (stores[o.branchId] || 0) + 1; });
    const favStoreId = Number(Object.keys(stores).sort((a, b) => stores[b] - stores[a])[0]) || null;
    const meta = customerMeta(c.key);
    return {
      ...c, favStoreId, walletHistory: wallet,
      walletBalance: Math.max(0, round2(wallet.reduce((s, r) => s + r.amount, 0))),
      aov: billable.length ? c.totalSpent / billable.length : 0,
      openOrders: c.orders.filter((o) => !TERMINAL_STATUSES.includes(o.status)).length,
      pendingRefund: c.orders.some((o) => orderIssues(o).returnReq || o.items.some((i) => i.unavailable && !i.resolution)),
      addresses: [...new Set(c.orders.filter((o) => o.fulfillment !== "pickup").map((o) => o.address))],
      blocked: meta.blocked, notes: meta.notes,
    };
  });
}
function customersFiltered(all) {
  const f = F("customers");
  const now = Date.now();
  const list = all.filter((c) => {
    if (!qmatch(f.q, c.name, c.mobile)) return false;

    if (f.last === "7" && c.lastOrderAt < now - 7 * 86400000) return false;
    if (f.last === "30" && c.lastOrderAt < now - 30 * 86400000) return false;
    if (f.last === "30plus" && c.lastOrderAt >= now - 30 * 86400000) return false;
    if (f.last === "90plus" && c.lastOrderAt >= now - 90 * 86400000) return false;
    if (f.spend) { const [lo, hi] = f.spend.split("-").map(Number); if (c.totalSpent < lo || (hi && c.totalSpent >= hi)) return false; }
    if (f.orders === "1" && c.orderCount !== 1) return false;
    if (f.orders === "2-5" && (c.orderCount < 2 || c.orderCount > 5)) return false;
    if (f.orders === "6+" && c.orderCount < 6) return false;
    if (f.store && String(c.favStoreId) !== f.store) return false;
    if (f.flag === "wallet" && !(c.walletBalance > 0)) return false;
    if (f.flag === "open" && !c.openOrders) return false;
    if (f.flag === "refund" && !c.pendingRefund) return false;
    if (f.flag === "blocked" && !c.blocked) return false;
    return true;
  });
  const s = f.sort || "last";
  return list.sort((a, b) => s === "spent" ? b.totalSpent - a.totalSpent : s === "orders" ? b.orderCount - a.orderCount : s === "name" ? a.name.localeCompare(b.name) : b.lastOrderAt - a.lastOrderAt);
}
function adminCustomersV2() {
  if (UI.customerKey) return customerDetailHTML(UI.customerKey);
  const all = customerRecords();
  const monthStart = dateRangeOf("month").from;
  const repeat = all.filter((c) => c.orderCount >= 2).length;
  const billableOrders = all.reduce((n, c) => n + c.orders.filter((o) => o.status !== "cancelled").length, 0);
  FILTER_RESULTS.customers = customersResultsHTML;
  return `
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-label">Customers</div><div class="stat-value">${all.length}</div><div class="stat-sub"><span>Everyone who has ordered</span></div></div>
    <div class="stat-card"><div class="stat-label">New this month</div><div class="stat-value">${all.filter((c) => c.firstOrderAt >= monthStart).length}</div><div class="stat-sub"><span>First order this month</span></div></div>
    <div class="stat-card"><div class="stat-label">Repeat rate</div><div class="stat-value">${all.length ? pct((repeat / all.length) * 100) : "0%"}</div><div class="stat-sub"><span>${repeat} ordered more than once</span></div></div>
    <div class="stat-card"><div class="stat-label">Average order</div><div class="stat-value">${money(billableOrders ? all.reduce((s, c) => s + c.totalSpent, 0) / billableOrders : 0)}</div><div class="stat-sub"><span>Across all customers</span></div></div>
  </div>
  <div class="admin-toolbar"><span></span>${exportButtonsHTML("customers")}</div>
  ${filterBarHTML("customers", {
    search: "Name or mobile…",
    fields: [

      { key: "last", label: "Last order", all: "Any time", options: [["7", "In the last 7 days"], ["30", "In the last 30 days"], ["30plus", "Not in 30+ days"], ["90plus", "Not in 90+ days"]] },
      { key: "spend", label: "Total spent", options: [["0-50", "Under S$50"], ["50-200", "S$50 – 200"], ["200-500", "S$200 – 500"], ["500-0", "S$500 +"]] },
      { key: "orders", label: "Orders", options: [["1", "1 order"], ["2-5", "2 – 5"], ["6+", "6 +"]] },
      { key: "store", label: "Usual store", options: State.branches.map((b) => [String(b.id), b.name]) },
      { key: "flag", label: "Show only", all: "Everyone", options: [["open", "Has an open order"], ["refund", "Refund / return pending"], ["wallet", "Has wallet balance"], ["blocked", "Blocked"]] },
    ],
    sort: [["last", "Last order"], ["spent", "Total spent"], ["orders", "Most orders"], ["name", "Name A–Z"]],
  })}
  <div id="fres-customers">${customersResultsHTML()}</div>`;
}
function customersResultsHTML() {
  const all = customerRecords();
  const list = customersFiltered(all);
  if (!list.length) return `${resultCountHTML(0, all.length, "customers")}<div class="empty-state"><div class="empty-title">No customers match</div></div>`;
  return `
  ${resultCountHTML(list.length, all.length, "customers")}
  <div class="cust-list">
    <div class="cust-row cust-head"><span>Customer</span><span>Status</span><span class="r">Orders</span><span class="r">Spent</span><span class="r">Avg order</span><span>Last order</span><span class="r">Wallet</span></div>
    ${list.map((c) => `
    <button type="button" class="cust-row" data-action="open-customer" data-key="${esc(c.key)}">
      <span class="cust-name"><span class="avatar">${esc(c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</span><span><b>${esc(c.name)}</b><span class="qk-muted small">${c.mobile ? fmtMobile(c.mobile) : "No mobile"}</span></span></span>
      <span>${c.blocked ? `<span class="badge badge-red">Blocked</span> ` : ""}${c.openOrders ? `<span class="badge badge-blue-soft">${c.openOrders} open order${c.openOrders === 1 ? "" : "s"}</span>` : c.blocked ? "" : `<span class="qk-muted small">—</span>`}</span>
      <span class="r">${c.orderCount}</span>
      <span class="r qk-num">${money(c.totalSpent)}</span>
      <span class="r qk-num">${money(c.aov)}</span>
      <span class="small">${timeAgo(c.lastOrderAt)}</span>
      <span class="r qk-num">${c.walletBalance ? money(c.walletBalance) : "—"}</span>
    </button>`).join("")}
  </div>`;
}
function customerDetailHTML(key) {
  const c = customerRecords().find((x) => x.key === key);
  if (!c) { UI.customerKey = null; return adminCustomersV2(); }
  const editable = canEdit(currentUser(), "customers");
  const returns = c.orders.filter((o) => o.returnRequest || o.status === "cancelled" || o.status === "returned" || o.items.some((i) => i.resolution === "original" || i.resolution === "wallet"));
  const rated = c.orders.filter((o) => o.rating || (o.itemRatings && Object.keys(o.itemRatings).length));
  return `
  <button class="link-btn" data-action="close-customer">${ic("chevronLeft")} All customers</button>
  <div class="summary-card cust-hero">
    <span class="avatar avatar-lg">${esc(c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</span>
    <div class="cust-hero-info">
      <div class="drawer-title">${esc(c.name)} ${c.blocked ? `<span class="badge badge-red">Blocked</span>` : ""}</div>
      <div class="qk-muted small">${c.mobile ? `<a href="${telHref(c.mobile)}">${fmtMobile(c.mobile)}</a> · ` : ""}Customer since ${fmtDate(c.firstOrderAt)} · last order ${timeAgo(c.lastOrderAt)}${c.favStoreId ? ` · usually ${esc((findBranch(c.favStoreId) || {}).name || "")}` : ""}</div>
      ${c.blocked ? `<div class="notice notice-danger" style="margin-top:8px">${ic("alert")}<span>Blocked by ${esc(c.blocked.by)} on ${fmtDate(c.blocked.at)} — ${esc(c.blocked.reason)}. They can browse but can't place orders.</span></div>` : ""}
    </div>
    ${editable ? `<div class="cust-actions">
      <button class="btn btn-outline btn-sm" data-action="open-customer-modal" data-kind="credit" data-key="${esc(c.key)}">${ic("wallet")} Add wallet credit</button>
      <button class="btn btn-outline btn-sm" data-action="open-customer-modal" data-kind="message" data-key="${esc(c.key)}">${ic("bell")} Send message</button>
      <button class="btn btn-sm ${c.blocked ? "btn-primary-soft" : "btn-outline-danger"}" data-action="open-customer-modal" data-kind="${c.blocked ? "unblock" : "block"}" data-key="${esc(c.key)}">${c.blocked ? "Unblock" : "Block"}</button>
    </div>` : ""}
  </div>
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-label">Orders</div><div class="stat-value">${c.orderCount}</div><div class="stat-sub"><span>${c.openOrders} open</span></div></div>
    <div class="stat-card"><div class="stat-label">Total spent</div><div class="stat-value">${money(c.totalSpent)}</div><div class="stat-sub"><span>Excludes cancelled</span></div></div>
    <div class="stat-card"><div class="stat-label">Average order</div><div class="stat-value">${money(c.aov)}</div><div class="stat-sub"><span>&nbsp;</span></div></div>
    <div class="stat-card"><div class="stat-label">Wallet</div><div class="stat-value">${money(c.walletBalance)}</div><div class="stat-sub"><span>${c.walletHistory.length} movements</span></div></div>
  </div>
  <div class="cust-grid">
    <div>
      <div class="summary-card">
        <div class="summary-card-title">Orders</div>
        <div class="ord-list">${c.orders.map(orderRowHTML).join("")}</div>
      </div>
      <div class="summary-card" style="margin-top:14px">
        <div class="summary-card-title">Returns, refunds & cancellations</div>
        ${returns.length ? returns.map((o) => `<div class="row small"><span>#${esc(o.id)} · ${fmtDate(o.createdAt)}</span><span>${o.returnRequest ? `${o.returnRequest.resolution === "replacement" ? "Replacement" : "Refund"} — ${esc(RETURN_STEPS.find((s) => s.key === returnRequestCurrentKey(o.returnRequest)).label)}` : o.status === "cancelled" ? "Cancelled" : o.status === "returned" ? "Returned" : "Item refunded"}</span></div>`).join("") : `<div class="qk-muted small">None.</div>`}
      </div>
    </div>
    <div>
      <div class="summary-card">
        <div class="summary-card-title">Staff notes</div>
        ${editable ? `<form class="note-form" data-action="add-customer-note" data-key="${esc(c.key)}"><input class="input" name="text" maxlength="240" placeholder="e.g. Prefers a call before delivery" /><button class="btn btn-primary btn-sm" type="submit">Add</button></form>` : ""}
        ${c.notes.length ? c.notes.map((n) => `<div class="note-item"><div class="small">${esc(n.text)}</div><div class="qk-muted small">${esc(n.by)} · ${fmtDateTime(n.at)}</div></div>`).join("") : `<div class="qk-muted small">No notes yet. Notes are only seen by staff.</div>`}
      </div>
      <div class="summary-card" style="margin-top:14px">
        <div class="summary-card-title">Wallet history</div>
        ${c.walletHistory.length ? c.walletHistory.map((w) => `<div class="row small"><span>${esc(w.text)}<span class="qk-muted"> · ${fmtDate(w.at)}</span></span><span class="qk-num ${w.amount < 0 ? "tone-red" : "tone-green"}">${w.amount < 0 ? "−" : "+"} ${money(Math.abs(w.amount))}</span></div>`).join("") : `<div class="qk-muted small">No wallet movements.</div>`}
      </div>
      <div class="summary-card" style="margin-top:14px">
        <div class="summary-card-title">Saved addresses</div>
        ${c.addresses.length ? c.addresses.map((a) => `<div class="small addr-line">${ic("pin")} ${esc(a)}</div>`).join("") : `<div class="qk-muted small">Pickup only.</div>`}
      </div>
      <div class="summary-card" style="margin-top:14px">
        <div class="summary-card-title">Ratings & feedback</div>
        ${rated.length ? rated.map((o) => `<div class="small"><b>#${esc(o.id)}</b> ${o.rating ? `${"★".repeat(o.rating)}${"☆".repeat(5 - o.rating)}` : ""}${adminOrderRatingsHTML(o)}</div>`).join("") : `<div class="qk-muted small">No ratings yet.</div>`}
      </div>
      ${customerMeta(c.key).messages.length ? `
      <div class="summary-card" style="margin-top:14px">
        <div class="summary-card-title">Messages sent</div>
        ${customerMeta(c.key).messages.map((m) => `<div class="note-item"><div class="small">${esc(m.text)}</div><div class="qk-muted small">${esc(m.channel)} · ${esc(m.by)} · ${fmtDateTime(m.at)}</div></div>`).join("")}
      </div>` : ""}
    </div>
  </div>`;
}
const GOODWILL_CAP = 50; // S$ per customer per rolling 30 days (D39; a per-shop setting later)
function customerModal() {
  const m = UI.modal;
  const c = customerRecords().find((x) => x.key === m.key);
  if (!c) return "";
  const usedRecently = customerMeta(c.key).credits.filter((cr) => cr.at >= Date.now() - 30 * 86400000).reduce((s, cr) => s + cr.amount, 0);
  const left = Math.max(0, GOODWILL_CAP - usedRecently);
  const title = { credit: "Add wallet credit", message: "Send a message", block: "Block customer", unblock: "Unblock customer" }[m.kind];
  const body = m.kind === "credit" ? `
    <div class="qk-muted small" style="margin-bottom:10px">Goodwill credit goes straight into ${esc(c.name)}'s wallet and shows in their wallet history. Limit: ${money(GOODWILL_CAP)} per customer in 30 days — <b>${money(left)}</b> left.</div>
    <label class="field"><span class="field-label">Amount (S$) *</span><input class="input" type="number" name="amount" min="0.5" max="${left}" step="0.5" required ${left ? "" : "disabled"} /></label>
    <label class="field"><span class="field-label">Reason *</span><select class="input" name="reason"><option>Late delivery</option><option>Damaged item</option><option>Wrong item</option><option>Missing item</option><option>Service recovery</option></select></label>
    <label class="field"><span class="field-label">Note</span><input class="input" name="note" placeholder="Optional — e.g. order number" /></label>`
  : m.kind === "message" ? `
    <label class="field"><span class="field-label">Send by</span><select class="input" name="channel">${["Push", "SMS", "Email"].map((ch) => `<option ${State.notificationConfig[ch.toLowerCase()] && !State.notificationConfig[ch.toLowerCase()].enabled ? "disabled" : ""}>${ch}</option>`).join("")}</select></label>
    <label class="field"><span class="field-label">Message *</span><textarea class="input" name="text" rows="3" maxlength="300" required placeholder="e.g. Sorry, your order is running 15 minutes late."></textarea></label>
    <div class="qk-muted small">For one-off service messages. Order updates are sent automatically from the templates in Setup ▸ Notifications.</div>`
  : m.kind === "block" ? `
    <div class="notice notice-warn" style="margin-bottom:10px">${ic("alert")}<span>${esc(c.name)} will still be able to log in and browse, but checkout is blocked. Open orders are not cancelled.</span></div>
    <label class="field"><span class="field-label">Reason *</span><select class="input" name="reason"><option>Repeated cash-on-delivery refusals</option><option>Abusive behaviour</option><option>Suspected fraud</option><option>Other</option></select></label>`
  : `<div class="qk-muted small">${esc(c.name)} will be able to place orders again.</div>`;
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>${title} · ${esc(c.name)}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <form class="dialog-body" data-action="save-customer-modal">
        ${body}
        ${m.error ? `<div class="field-error">${esc(m.error)}</div>` : ""}
        <div class="form-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button type="submit" class="btn ${m.kind === "block" ? "btn-outline-danger" : "btn-primary"}" ${m.kind === "credit" && !left ? "disabled" : ""}>${title}</button></div>
      </form>
    </div>
  </div>`;
}

/* ---------------- 7. Catalogue with filters ---------------- */
function catalogueFiltered() {
  const f = F("catalog");
  const list = State.items.filter((i) => {
    if (!qmatch(f.q, i.name, i.brand, i.sku, i.barcode)) return false;
    if (f.cat && i.cat !== f.cat) return false;
    if (f.brand && i.brand !== f.brand) return false;
    if (f.supplier && String(i.supplierId) !== f.supplier) return false;
    if (f.status === "selling" && !i.stock) return false;
    if (f.status === "off" && i.stock) return false;
    if (f.status === "outall" && (!i.stock || customerItemAvailable(i))) return false;
    if (f.offer === "discount" && !(i.mrp > i.price)) return false;
    if (f.offer === "bogo" && !i.bogo) return false;
    if (f.margin && !(i.price && (i.price - (i.costPrice || 0)) / i.price * 100 < Number(f.margin))) return false;
    return true;
  });
  const margin = (i) => (i.price ? (i.price - (i.costPrice || 0)) / i.price : 0);
  const s = f.sort || "name";
  return list.sort((a, b) => s === "priceAsc" ? a.price - b.price : s === "priceDesc" ? b.price - a.price : s === "marginAsc" ? margin(a) - margin(b) : s === "marginDesc" ? margin(b) - margin(a) : a.name.localeCompare(b.name));
}
function adminCatalogV2() {
  const editable = canEdit(currentUser(), "catalog");
  FILTER_RESULTS.catalog = catalogueResultsHTML;
  const brands = [...new Set(State.items.map((i) => i.brand).filter(Boolean))].sort();
  return `
  <div class="admin-toolbar">
    <div class="qk-muted small">The product master, shared by every store. Quantities live per store in Masters ▸ Stock.</div>
    <div class="filter-pill-row">
      ${editable ? `<button class="btn btn-primary btn-sm" data-action="new-item">${ic("plus")} Add product</button><button class="btn btn-outline btn-sm" data-action="open-import" data-entity="products">${ic("upload")} Import</button>` : ""}
      ${exportButtonsHTML("catalog")}
    </div>
  </div>
  ${filterBarHTML("catalog", {
    search: "Name, brand, SKU or barcode…",
    fields: [
      { key: "cat", label: "Category", options: State.categories.map((c) => [c.name, c.name]) },
      { key: "brand", label: "Brand", options: brands.map((b) => [b, b]) },
      { key: "supplier", label: "Supplier", options: State.suppliers.map((s) => [String(s.id), s.name]) },
      { key: "status", label: "Status", options: [["selling", "Selling"], ["off", "Switched off"], ["outall", "Out of stock everywhere"]] },
      { key: "offer", label: "Offers", all: "Any", options: [["discount", "Discounted (price below MRP)"], ["bogo", "Buy 1 Get 1"]] },
      { key: "margin", label: "Margin", all: "Any", options: [["10", "Below 10%"], ["20", "Below 20%"], ["30", "Below 30%"]] },
    ],
    sort: [["name", "Name A–Z"], ["priceAsc", "Price low → high"], ["priceDesc", "Price high → low"], ["marginAsc", "Margin low → high"], ["marginDesc", "Margin high → low"]],
  })}
  <div id="fres-catalog">${catalogueResultsHTML()}</div>`;
}
function catalogueResultsHTML() {
  const editable = canEdit(currentUser(), "catalog");
  const items = catalogueFiltered();
  return `
  ${resultCountHTML(items.length, State.items.length, "products")}
  <div class="admin-table">
    ${items.map((item) => {
      const margin = item.price ? Math.round(((item.price - (item.costPrice || 0)) / item.price) * 100) : 0;
      return `
      <div class="admin-row">
        <img src="${item.image}" class="admin-row-img" alt="" />
        <div class="admin-row-info">
          <div class="admin-row-name">${esc(item.name)}</div>
          <div class="qk-muted small">${esc(item.sku || "")} · ${item.brand ? `${esc(item.brand)} · ` : ""}${esc(item.cat)} · ${esc(supplierName(item.supplierId))}</div>
          <div class="qk-muted small">Price <b>${money(item.price)}</b>${item.mrp > item.price ? ` <s>${money(item.mrp)}</s>` : ""} · Cost ${money(item.costPrice || 0)} · <span class="${margin < 20 ? "tone-red" : ""}">Margin ${margin}%</span>${item.bogo ? ` · <span class="badge badge-green-soft">BOGO</span>` : ""} ${!item.stock ? '<span class="badge badge-red-soft">Switched off</span>' : !customerItemAvailable(item) ? '<span class="badge badge-red-soft">Out of stock everywhere</span>' : ""}</div>
        </div>
        ${editable ? `
        <label class="stock-toggle" title="Selling — switch off to hide it everywhere"><input type="checkbox" ${item.stock ? "checked" : ""} data-action="toggle-stock" data-id="${item.id}" /><span>${item.stock ? "Selling" : "Off"}</span></label>
        <button class="icon-btn" data-action="edit-item" data-id="${item.id}" aria-label="Edit">${ic("edit")}</button>
        <button class="icon-btn icon-btn-danger" data-action="delete-item" data-id="${item.id}" aria-label="Delete">${ic("trash")}</button>` : `
        <span class="badge badge-${item.stock ? "green" : "red"}">${item.stock ? "Selling" : "Off"}</span>`}
      </div>`;
    }).join("")}
    ${items.length === 0 ? `<div class="empty-state"><div class="empty-title">No products match</div></div>` : ""}
  </div>`;
}

/* ---------------- 8. Stock filters (on hand + history) ---------------- */
function stockItemsFiltered(branchId) {
  const f = F("stock");
  const val = (i) => Math.max(storeQty(branchId, i.id) || 0, 0) * (i.costPrice || 0);
  const list = State.items.filter((i) => {
    if (!qmatch(f.q, i.name, i.sku, i.cat)) return false;
    const k = stockStatus(branchId, i).key;
    if (f.status && !(f.status === "out" ? k === "out" || k === "negative" : k === f.status)) return false;
    if (f.cat && i.cat !== f.cat) return false;
    if (f.supplier && String(i.supplierId) !== f.supplier) return false;
    if (f.selling === "on" && !branchStockFor(branchId, i.id).stock) return false;
    if (f.selling === "off" && branchStockFor(branchId, i.id).stock) return false;
    return true;
  });
  const s = f.sort || "name";
  const q = (i) => storeQty(branchId, i.id) || 0;
  return list.sort((a, b) => s === "qtyAsc" ? q(a) - q(b) : s === "qtyDesc" ? q(b) - q(a) : s === "value" ? val(b) - val(a) : a.name.localeCompare(b.name));
}
function stockFilterBarHTML() {
  return filterBarHTML("stock", {
    search: "Name, SKU or category…",
    fields: [
      { key: "status", label: "Status", options: [["low", "Low stock"], ["out", "Out of stock"], ["negative", "Negative"], ["ok", "In stock"]] },
      { key: "cat", label: "Category", options: State.categories.map((c) => [c.name, c.name]) },
      { key: "supplier", label: "Supplier", options: State.suppliers.map((s) => [String(s.id), s.name]) },
      { key: "selling", label: "Selling here", all: "Any", options: [["on", "Selling"], ["off", "Switched off here"]] },
    ],
    sort: [["name", "Name A–Z"], ["qtyAsc", "Quantity low → high"], ["qtyDesc", "Quantity high → low"], ["value", "Stock value"]],
  });
}
function stockMovesFiltered(branchId) {
  const f = F("stockHistory");
  const r = dateRangeOf(f.date, f.dateFrom, f.dateTo);
  return State.stockMoves.filter((m) => {
    if (branchId != null && m.branchId !== branchId) return false;
    if (!inRange(m.at, r)) return false;
    if (f.type && m.type !== f.type) return false;
    if (f.by && m.by !== f.by) return false;
    if (f.q) { const i = findItem(m.itemId) || {}; if (!qmatch(f.q, i.name, i.sku, m.ref, m.note)) return false; }
    return true;
  });
}
function stockHistoryFilterBarHTML(branchId) {
  const people = [...new Set(State.stockMoves.filter((m) => m.branchId === branchId).map((m) => m.by))];
  return filterBarHTML("stockHistory", {
    search: "Product, SKU or reference…",
    date: { key: "date", label: "When" },
    fields: [
      { key: "type", label: "Movement", options: Object.entries(STOCK_MOVE_TYPES).map(([k, t]) => [k, t.label]) },
      { key: "by", label: "By", all: "Anyone", options: people.map((p) => [p, p]) },
    ],
  });
}

/* ---------------- 9. Delivery partners & users filters ---------------- */
function partnerStatusKey(p) { return p.active === false ? "inactive" : riderIsBusy(p.id) ? "busy" : riderIsReady(p.id) ? "ready" : "offline"; }
function partnersFilterBarHTML() {
  return filterBarHTML("partners", {
    fields: [
      { key: "status", label: "Status", options: [["ready", "Ready"], ["busy", "On delivery"], ["offline", "Offline"], ["inactive", "Inactive"]] },
      { key: "vehicle", label: "Vehicle", options: VEHICLE_TYPES.map((v) => [v, v]) },
    ],
  });
}
function partnersFiltered(list) {
  const f = F("partners");
  return list.filter((p) => qmatch(f.q, p.name, p.code, p.mobile) && (!f.status || partnerStatusKey(p) === f.status) && (!f.vehicle || p.vehicle === f.vehicle));
}

/* ---------------- 10. Dashboard date range ---------------- */
function dashRange() {
  const f = F("dash");
  const preset = f.date || "30";
  return { preset, label: rangeLabel(preset, f.dateFrom, f.dateTo), range: dateRangeOf(preset, f.dateFrom, f.dateTo) };
}

/* ---------------- 11. Handlers ---------------- */
function setFilter(screen, key, value) {
  const f = F(screen);
  if (value === "" || value == null) delete f[key]; else f[key] = value;
  if (key === "date" && value !== "custom") { delete f.dateFrom; delete f.dateTo; }
  render();
}
(function wrapExistingActions() {
  const adminTab = Actions["admin-tab"];
  Actions["admin-tab"] = (el) => { UI.customerKey = null; UI.orderDrawerId = null; UI.openFilter = null; adminTab(el); };
  const login = Submits["submit-login"];
  Submits["submit-login"] = (form) => {
    login(form);
    if (State.session && State.session.role === "customer") { State.demoCustomerName = State.session.name; persist("demoCustomerName"); }
  };
})();
// A filter menu closes on a click outside it, or on Esc.
document.addEventListener("click", (ev) => {
  if (!UI.openFilter) return;
  if (ev.target.closest(".fmenu") || ev.target.closest('[data-action="toggle-fmenu"]')) return;
  UI.openFilter = null; render();
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && UI.openFilter) { UI.openFilter = null; render(); }
});
Object.assign(Actions, {
  "set-filter"(el) { setFilter(el.dataset.screen, el.dataset.key, el.value); },
  "toggle-fmenu"(el) { const id = `${el.dataset.screen}:${el.dataset.key}`; UI.openFilter = UI.openFilter === id ? null : id; render(); },
  "close-fmenu"() { UI.openFilter = null; render(); },
  "pick-filter"(el) { if (!el.dataset.keep) UI.openFilter = null; setFilter(el.dataset.screen, el.dataset.key, el.dataset.value); },
  "clear-search"(el) { F(el.dataset.screen).q = ""; render(); const box = document.querySelector(".fsearch-input"); if (box) box.focus(); },
  "set-filter-btn"(el) { setFilter(el.dataset.screen, el.dataset.key, el.dataset.value); },
  "clear-filters"(el) { const f = F(el.dataset.screen); const keep = { sort: f.sort, view: f.view }; UI.filters[el.dataset.screen] = Object.fromEntries(Object.entries(keep).filter(([, v]) => v)); render(); },
  "open-order"(el) { UI.orderDrawerId = el.dataset.id; if (UI.adminTab !== "orders") { UI.adminTab = "orders"; UI.adminOrderFilter = "all"; UI.customerKey = null; } render(); },
  "close-order-drawer"() { UI.orderDrawerId = null; render(); },
  "toggle-picked"(el) {
    const id = el.dataset.id, idx = Number(el.dataset.idx);
    State.orders = State.orders.map((o) => o.id === id ? { ...o, picked: { ...(o.picked || {}), [idx]: el.checked } } : o);
    persist("orders"); render();
  },
  "mark-item-unavailable"(el) {
    const id = el.dataset.id, idx = Number(el.dataset.idx);
    const o = State.orders.find((x) => x.id === id);
    if (!o || !window.confirm(`Mark "${o.items[idx].name}" as unavailable? The customer will be asked to pick a swap or a refund.`)) return;
    State.orders = State.orders.map((x) => x.id === id ? { ...x, items: x.items.map((it, i) => i === idx ? { ...it, unavailable: true } : it) } : x);
    persist("orders"); showToast(`${o.items[idx].name} marked unavailable — offer a swap or refund below`, "danger"); render();
  },
  "print-pick-slip"(el) { const o = State.orders.find((x) => x.id === el.dataset.id); if (o) printPickSlip(o); },
  "open-customer"(el) { UI.customerKey = el.dataset.key; UI.orderDrawerId = null; UI.adminTab = "customers"; window.scrollTo(0, 0); render(); },
  "close-customer"() { UI.customerKey = null; render(); },
  "open-customer-modal"(el) { UI.modal = { type: "customerModal", kind: el.dataset.kind, key: el.dataset.key }; render(); },
});
Object.assign(Submits, {
  "add-customer-note"(form) {
    const text = String(new FormData(form).get("text") || "").trim();
    if (!text) return;
    const key = form.dataset.key;
    saveCustomerMeta(key, { notes: [{ at: Date.now(), by: (currentUser() || {}).name || "Admin", text }, ...customerMeta(key).notes] });
    showToast("Note added"); render();
  },
  "save-customer-modal"(form) {
    const fd = new FormData(form);
    const m = UI.modal;
    const by = (currentUser() || {}).name || "Admin";
    const meta = customerMeta(m.key);
    if (m.kind === "credit") {
      const amount = round2(fd.get("amount"));
      const used = meta.credits.filter((cr) => cr.at >= Date.now() - 30 * 86400000).reduce((s, cr) => s + cr.amount, 0);
      if (!(amount > 0)) { UI.modal.error = "Enter an amount"; render(); return; }
      if (amount > GOODWILL_CAP - used + 0.001) { UI.modal.error = `Only ${money(Math.max(0, GOODWILL_CAP - used))} left this month for this customer`; render(); return; }
      const reason = [fd.get("reason"), String(fd.get("note") || "").trim()].filter(Boolean).join(" · ");
      saveCustomerMeta(m.key, { credits: [...meta.credits, { at: Date.now(), by, amount, reason }] });
      if (m.key === State.demoCustomerName) { State.wallet = round2(State.wallet + amount); persist("wallet"); }
      showToast(`${money(amount)} added to ${m.key}'s wallet`);
    } else if (m.kind === "message") {
      const text = String(fd.get("text") || "").trim();
      if (!text) { UI.modal.error = "Write a message"; render(); return; }
      saveCustomerMeta(m.key, { messages: [{ at: Date.now(), by, channel: fd.get("channel"), text }, ...meta.messages] });
      showToast(`${fd.get("channel")} message sent to ${m.key} (prototype — nothing is really sent)`);
    } else if (m.kind === "block") {
      saveCustomerMeta(m.key, { blocked: { at: Date.now(), by, reason: fd.get("reason") } });
      showToast(`${m.key} blocked — checkout is disabled for them`, "danger");
    } else {
      saveCustomerMeta(m.key, { blocked: null });
      showToast(`${m.key} unblocked`);
    }
    UI.modal = null; render();
  },
});

/* ---------------- 12. Exports follow the filters ---------------- */
Object.assign(EXPORTS, {
  orders: () => ({ name: "orders", columns: ["Order no", "Placed", "Customer", "Mobile", "Store", "Type", "Slot", "Status", "On time?", "Items", "Item total", "Delivery fee", "Express charge", "Coupon discount", "Wallet used", "Total", "Payment", "Payment status", "Rider"],
    rows: (F("orders").view === "board" ? sortOrders(ordersBase()) : ordersFiltered()).map((o) => { const t = orderTiming(o); return [o.id, fmtDateTime(o.createdAt), o.customerName, o.contactMobile || "", (findBranch(o.branchId) || {}).name || "", KIND_META[orderKind(o)].label, o.scheduledSlot || "", STATUS_META[o.status].label, t ? t.label : "", o.items.reduce((n, i) => n + i.qty, 0), round2(o.itemTotal != null ? o.itemTotal : o.items.reduce((s, i) => s + i.price * i.qty, 0)), round2(o.deliveryFee), round2(o.expressCharge), round2(o.couponDiscount), round2(o.walletApplied), round2(o.total), o.paymentMethod, orderPayStatus(o).label, (findPartner(o.deliveryPartnerId) || {}).name || ""]; }) }),
  customers: () => ({ name: "customers", columns: ["Name", "Mobile", "Orders", "Total spent", "Average order", "First order", "Last order", "Usual store", "Wallet", "Open orders", "Blocked"],
    rows: customersFiltered(customerRecords()).map((c) => [c.name, c.mobile, c.orderCount, round2(c.totalSpent), round2(c.aov), fmtDate(c.firstOrderAt), fmtDate(c.lastOrderAt), (findBranch(c.favStoreId) || {}).name || "", round2(c.walletBalance), c.openOrders, c.blocked ? "yes" : "no"]) }),
  catalog: () => ({ name: "products", columns: ["SKU", "Name", "Category", "Brand", "Unit", "MRP", "Price", "Cost price", "Margin %", "Supplier code", "Reorder level", "Barcode", "Selling"],
    rows: catalogueFiltered().map((i) => [i.sku, i.name, i.cat, i.brand || "", i.unit, round2(i.mrp), round2(i.price), round2(i.costPrice), i.price ? Math.round(((i.price - (i.costPrice || 0)) / i.price) * 1000) / 10 : 0, (State.suppliers.find((s) => s.id === i.supplierId) || {}).code || "", i.reorderLevel || 0, i.barcode || "", i.stock ? "yes" : "no"]) }),
  inventory: () => {
    const ids = scopedBranchIds();
    const stores = ids ? State.branches.filter((b) => ids.includes(b.id)) : State.branches;
    const rows = [];
    stores.forEach((b) => stockItemsFiltered(b.id).forEach((i) => { const q = storeQty(b.id, i.id); rows.push([b.name, i.sku, i.name, i.cat, q == null ? "" : q, i.reorderLevel || 0, stockStatus(b.id, i).label, round2(i.costPrice), round2(Math.max(q || 0, 0) * (i.costPrice || 0))]); }));
    return { name: "stock", columns: ["Store", "SKU", "Product", "Category", "On hand", "Reorder level", "Status", "Cost price", "Stock value"], rows };
  },
  stockHistory: () => {
    const ids = scopedBranchIds();
    const moves = stockMovesFiltered(ids && ids.length === 1 ? ids[0] : null).filter((m) => !ids || ids.includes(m.branchId));
    return { name: "stock-history", columns: ["Date", "Store", "SKU", "Product", "Movement", "Qty", "Balance", "Unit cost", "Reference", "Note", "By"],
      rows: moves.map((m) => { const i = findItem(m.itemId) || {}; return [fmtDateTime(m.at), (findBranch(m.branchId) || {}).name || "", i.sku || "", i.name || "", (STOCK_MOVE_TYPES[m.type] || {}).label || m.type, m.qty, m.balance, m.unitCost == null ? "" : round2(m.unitCost), m.ref, m.note, m.by]; }) };
  },
  partners: () => {
    const ids = scopedBranchIds();
    return { name: "delivery-partners", columns: ["Code", "Name", "Mobile", "Email", "Vehicle", "Store", "Status", "Deliveries"],
      rows: partnersFiltered(State.partners.filter((p) => !ids || ids.includes(p.branchId))).map((p) => [p.code, p.name, p.mobile, p.email || "", p.vehicle || "", (findBranch(p.branchId) || {}).name || "", { ready: "Ready", busy: "On delivery", offline: "Offline", inactive: "Inactive" }[partnerStatusKey(p)], State.orders.filter((o) => o.deliveryPartnerId === p.id && o.status === "delivered").length]) };
  },
});

/* ---------------- 13. What's changed ---------------- */
WHATS_NEW.unshift({ area: "Admin panel — filters, Orders, Customers (round 3)", items: [
  ["Filter bar", "Same bar on Orders, Customers, Catalogue, Stock, Stock history, Delivery Partners, Users and the Dashboard: a search box (with clear ×) and Sort on top; filters below as dashed '+ Filter' pills that open a small menu and become solid chips ('Type | Express ×') once set — × clears one, 'Clear filters' clears all. 'Showing X of Y' tells you how much is hidden. Excel/CSV export downloads exactly what the filters show."],
  ["Orders — today at a glance", "Stats on top: orders today (express / scheduled / pickup), in progress, late now, sales today."],
  ["Orders — Needs action", "First tab: new orders not yet confirmed, late orders, items marked unavailable waiting for the customer, and return requests — each with its reason."],
  ["Orders — timing badges", "Every open order says if it's on time: 'Not confirmed · 14 min', 'Express overdue 5 min', 'Slot in 20 min — not packed', 'Slot ended — not delivered'."],
  ["Orders — three views", "List · By slot (today's orders grouped under each delivery window with booked/capacity, express and pickup in their own groups) · Board (a column per stage with a one-tap 'next step' button on each card)."],
  ["Orders — side panel", "Click any order: items as a picking checklist (tick as you pick, 'Not available' starts the swap/refund flow), customer with call link and notes, delivery and rider, payment and bill, return/rating, timeline. Print a picking slip sorted by category, or the invoice."],
  ["Orders — filters", "Placed date (presets or custom), type, delivery slot, payment method, paid / cash to collect / refunded, rider (or not assigned), issues (late, item unavailable, return)."],
  ["Customers — overview", "Stats (customers, new this month, repeat rate, average order) and a table with orders, spent, average order, last order, wallet and open orders / blocked."],
  ["Customers — filters", "Last order, total spent, number of orders, usual store, and 'show only' (open order, refund pending, wallet balance, blocked)."],
  ["Customers — detail page", "Profile, orders (open one to jump to its order panel), returns/refunds/cancellations, staff notes, wallet history, saved addresses, ratings and feedback, messages sent."],
  ["Customers — actions", "Add goodwill wallet credit (reason required, S$50 per customer per 30 days), send a one-off message (push / SMS / email), block / unblock (blocked customers can browse but checkout is disabled)."],
  ["Catalogue & Stock filters", "Catalogue: category, brand, supplier, selling / switched off / out everywhere, offers, low margin, sort by price or margin. Stock: status, category, supplier, selling here, sort by quantity or value. Stock history: date, movement type, who, search."],
  ["Dashboard", "Date range now includes yesterday, this month and custom dates; Top selling items follows the range."],
] });
