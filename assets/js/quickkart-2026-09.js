/* ====================================================================
   QuickKart prototype — Director change set, September 2026.

   Everything new from the directors' Admin Panel + Notification brief
   lives in this file so the frontend team can read the changes in one
   place. It loads after quickkart.js and extends it: new screens, new
   modals, and new Actions/Submits handlers are added to the objects
   that file already defines. Small hooks inside quickkart.js call into
   the functions below (search for "2026-09" there).

   The in-app "What's changed" page (login screen and admin sidebar)
   lists every change in plain language — see whatsNewModal() below.
   ==================================================================== */

/* ---------------- 1. Sidebar: screens, names and groups ---------------- */
function reorderAdminScreens() {
  const byKey = Object.fromEntries(PERMISSION_SCREENS.map((s) => [s.key, s]));
  byKey.users.label = "Users & Roles";
  byKey.catalog.label = "Catalogue";
  byKey.inventory.label = "Stock";
  byKey.partners.label = "Delivery Partners";
  byKey.suppliers = { key: "suppliers", label: "Suppliers", icon: "package", editable: true };
  byKey.slots = { key: "slots", label: "Delivery Slots", icon: "clock", editable: true };
  byKey.routes = { key: "routes", label: "Routes · to discuss", icon: "pin", editable: true };
  byKey.notifications = { key: "notifications", label: "Notifications", icon: "bell", editable: true };
  // Same order as the sidebar, so the permission grid on roles/users reads the same way.
  const order = ADMIN_NAV.flatMap((n) => n.keys || [n.key]);
  PERMISSION_SCREENS.splice(0, PERMISSION_SCREENS.length, ...order.map((k) => byKey[k]).filter(Boolean));
  BRANCH_SCOPED_TABS.push("slots");
}
// Sidebar layout (Round 2): daily screens on top, the rest in groups that open
// and close. Permissions stay per screen; a group shows only if the user can
// see at least one screen in it.
Icon.settings = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const ADMIN_NAV = [
  { key: "dashboard" },
  { key: "orders" },
  { key: "reports" },
  { group: "masters", label: "Masters", icon: "boxes", keys: ["catalog", "categories", "brands", "inventory", "suppliers", "customers"] },
  { group: "delivery", label: "Delivery Masters", icon: "truck", keys: ["slots", "partners", "routes"] },
  { group: "marketing", label: "Marketing", icon: "megaphone", keys: ["promotions", "coupons", "homeScreen"] },
  { group: "setup", label: "Setup", icon: "settings", keys: ["tax", "stores", "users", "notifications"] },
];
reorderAdminScreens();
function adminNavGroupOf(key) { return ADMIN_NAV.find((n) => n.keys && n.keys.includes(key)) || null; }
function adminPageTitle(key) {
  const screen = PERMISSION_SCREENS.find((t) => t.key === key);
  const g = adminNavGroupOf(key);
  return `${g ? `<span class="crumb">${esc(g.label)} ›</span> ` : ""}${esc(screen ? screen.label : "Admin")}`;
}
function adminNavHTML(visibleTabs) {
  const can = new Set(visibleTabs.map((t) => t.key));
  const item = (key, sub) => {
    const t = PERMISSION_SCREENS.find((x) => x.key === key);
    return `<button class="dash-nav-item ${sub ? "dash-nav-sub" : ""} ${UI.adminTab === key ? "active" : ""}" data-action="admin-tab" data-tab="${key}">${ic(t.icon)}<span>${esc(t.label)}</span></button>`;
  };
  const openState = UI.navOpen || {};
  return ADMIN_NAV.map((n) => {
    if (!n.keys) return can.has(n.key) ? item(n.key, false) : "";
    const keys = n.keys.filter((k) => can.has(k));
    if (!keys.length) return "";
    const holdsActive = keys.includes(UI.adminTab);
    const open = openState[n.group] != null ? openState[n.group] || holdsActive : holdsActive;
    return `
    <div class="dash-nav-group ${open ? "open" : ""} ${holdsActive ? "has-active" : ""}">
      <button class="dash-nav-item dash-nav-group-head" data-action="toggle-nav-group" data-group="${n.group}" aria-expanded="${open}">${ic(n.icon)}<span>${esc(n.label)}</span><span class="dash-nav-chev">${ic("chevronDown")}</span></button>
      ${open ? `<div class="dash-nav-group-items">${keys.map((k) => item(k, true)).join("")}</div>` : ""}
    </div>`;
  }).join("");
}

// What a Store Manager gets on the new screens unless a Super Admin changes it.
const STORE_MANAGER_NEW_SCREEN_DEFAULTS = { suppliers: "view", slots: "edit", routes: "view", notifications: "none" };

/* ---------------- 2. Seed data for the new areas ---------------- */
const SEED_SUPPLIERS = [
  { id: 1, code: "SUP-001", name: "FreshHarvest Produce Pte Ltd", contactPerson: "Tan Mei Ling", phone: "62781234", email: "orders@freshharvest.sg", address: "15 Pasir Panjang Wholesale Centre, Singapore 110015", uen: "201912345K", paymentTerms: "14 days", leadTimeDays: 1, active: true, notes: "Daily 6am delivery to all stores" },
  { id: 2, code: "SUP-002", name: "Dairy Farmers Distribution", contactPerson: "Ravi Menon", phone: "63456789", email: "sales@dairyfarmers.sg", address: "8 Senoko Loop, Singapore 758168", uen: "200811223M", paymentTerms: "30 days", leadTimeDays: 2, active: true, notes: "" },
  { id: 3, code: "SUP-003", name: "Spice Route Traders", contactPerson: "Kavitha R", phone: "62983344", email: "kavitha@spiceroute.sg", address: "41 Serangoon Road, Singapore 217969", uen: "201533445D", paymentTerms: "30 days", leadTimeDays: 3, active: true, notes: "Indian & Asian dry goods" },
  { id: 4, code: "SUP-004", name: "Asia Pacific Beverages & Snacks", contactPerson: "Jason Lim", phone: "68612200", email: "jason.lim@apbs.sg", address: "2 Tuas Avenue 13, Singapore 638977", uen: "199904567E", paymentTerms: "45 days", leadTimeDays: 4, active: true, notes: "" },
  { id: 5, code: "SUP-005", name: "CleanHome Distributors", contactPerson: "Nur Farhana", phone: "67441122", email: "farhana@cleanhome.sg", address: "10 Ubi Crescent, Singapore 408564", uen: "201722110G", paymentTerms: "COD", leadTimeDays: 5, active: true, notes: "Household, personal & baby care" },
];
const CATEGORY_DEFAULT_SUPPLIER = {
  "Fresh Fruits": 1, "Vegetables": 1, "Meat & Seafood": 1, "Dairy & Eggs": 2, "Frozen Foods": 2,
  "Rice & Grains": 3, "Indian Groceries": 3, "Asian Groceries": 3, "Snacks": 4, "Beverages": 4,
  "Household": 5, "Personal Care": 5, "Pharmacy": 5, "Pet Care": 5, "Baby Care": 5,
};
const SEED_EXTRA_ROLES = [
  { id: "role_picker", name: "Picker / Packer", isSystem: false, locked: false, permissions: { dashboard: "none", orders: "edit", inventory: "view", slots: "view" } },
  { id: "role_inventory", name: "Inventory Manager", isSystem: false, locked: false, permissions: { dashboard: "view", catalog: "edit", categories: "edit", brands: "edit", inventory: "edit", suppliers: "edit", reports: "view" } },
];
const DEFAULT_SLOT_SETTINGS = {
  daysAhead: 3,
  cutoffMins: 30,
  // Time windows offered every day, at every store, with their default capacity.
  templates: [
    { id: "s0900", start: "09:00", end: "11:00", capacity: 20 },
    { id: "s1100", start: "11:00", end: "13:00", capacity: 20 },
    { id: "s1400", start: "14:00", end: "16:00", capacity: 15 },
    { id: "s1600", start: "16:00", end: "18:00", capacity: 20 },
    { id: "s1800", start: "18:00", end: "20:00", capacity: 25 },
    { id: "s2000", start: "20:00", end: "22:00", capacity: 15 },
  ],
  extras: {},    // { "storeId|date": [{ id, start, end, capacity }] } — one-off slots for one day
  overrides: {}, // { "storeId|date|slotId": capacity } — capacity for one slot on one day
  closed: {},    // { "storeId|date|slotId": true }
};
const DEFAULT_PEAK_SECTIONS = [
  { id: 1, name: "Overnight", start: 0, end: 6 },
  { id: 2, name: "Early morning", start: 6, end: 9 },
  { id: 3, name: "Morning", start: 9, end: 12 },
  { id: 4, name: "Lunch & afternoon", start: 12, end: 16 },
  { id: 5, name: "Evening rush", start: 16, end: 20 },
  { id: 6, name: "Night", start: 20, end: 24 },
];
const DEFAULT_NOTIFICATION_CONFIG = {
  email: { enabled: true, mode: "default", host: "", port: 587, security: "STARTTLS", username: "", passwordSet: false, fromName: "QuickKart", fromEmail: "", replyTo: "" },
  sms: { enabled: true, mode: "default", provider: "Twilio", accountId: "", tokenSet: false, senderId: "QuickKart" },
  push: { enabled: true, mode: "default", projectId: "", senderId: "", serviceAccountSet: false, serviceAccountFile: "", vapidKey: "" },
};
const NOTIFICATION_PLACEHOLDERS = ["customerName", "orderNo", "amount", "storeName", "otp", "eta", "itemName", "slot", "businessName"];
const DEFAULT_NOTIFICATION_TEMPLATES = [
  { key: "otp", name: "Login code (OTP)", audience: "Customer", channels: { email: false, sms: true, push: false }, locked: ["sms"], subject: "", body: "{{otp}} is your {{businessName}} login code. It expires in 5 minutes. Never share it." },
  { key: "order_placed", name: "Order placed", audience: "Customer", channels: { email: true, sms: false, push: true }, subject: "We've got your order {{orderNo}}", body: "Hi {{customerName}}, thanks for your order {{orderNo}} ({{amount}}). We'll let you know when it's on the way." },
  { key: "order_confirmed", name: "Order confirmed", audience: "Customer", channels: { email: false, sms: false, push: true }, subject: "Order {{orderNo}} confirmed", body: "Your order {{orderNo}} is confirmed and {{storeName}} is getting it ready." },
  { key: "out_for_delivery", name: "Out for delivery", audience: "Customer", channels: { email: false, sms: true, push: true }, subject: "Order {{orderNo}} is on the way", body: "Your order {{orderNo}} is on the way — arriving around {{eta}}." },
  { key: "delivered", name: "Delivered", audience: "Customer", channels: { email: true, sms: false, push: true }, subject: "Order {{orderNo}} delivered", body: "Your order {{orderNo}} has been delivered. Enjoy, {{customerName}}!" },
  { key: "cancelled", name: "Order cancelled", audience: "Customer", channels: { email: true, sms: true, push: true }, subject: "Order {{orderNo}} cancelled", body: "Your order {{orderNo}} was cancelled. Any payment will be refunded within 3–5 business days." },
  { key: "item_unavailable", name: "Item unavailable", audience: "Customer", channels: { email: false, sms: false, push: true }, subject: "An item in {{orderNo}} is unavailable", body: "{{itemName}} is unavailable for order {{orderNo}}. Open the app to pick a replacement or refund." },
  { key: "back_in_stock", name: "Back in stock", audience: "Customer", channels: { email: false, sms: false, push: true }, subject: "{{itemName}} is back", body: "Good news — {{itemName}} is back in stock." },
  { key: "slot_reminder", name: "Delivery slot reminder", audience: "Customer", channels: { email: false, sms: true, push: true }, subject: "Your delivery is today", body: "Reminder: order {{orderNo}} arrives today, {{slot}}." },
  { key: "low_stock", name: "Low stock alert", audience: "Staff", channels: { email: true, sms: false, push: false }, subject: "Low stock at {{storeName}}", body: "{{itemName}} is below its reorder level at {{storeName}}." },
  { key: "admin_password_reset", name: "Admin password reset", audience: "Staff", channels: { email: true, sms: false, push: false }, locked: ["email"], subject: "Reset your {{businessName}} admin password", body: "Use the link in this email to reset your password. It expires in 30 minutes." },
];
/* ---------------- 3. State for the new areas + one-time migration ---------------- */
Object.assign(State, {
  suppliers: loadLS("suppliers", () => deepClone(SEED_SUPPLIERS)),
  stockMoves: loadLS("stockMoves", []),
  slotSettings: { ...deepClone(DEFAULT_SLOT_SETTINGS), ...loadLS("slotSettings", () => deepClone(DEFAULT_SLOT_SETTINGS)) },
  slotBookings: loadLS("slotBookings", {}),
  peakSections: loadLS("peakSections", () => deepClone(DEFAULT_PEAK_SECTIONS)),
  notificationConfig: loadLS("notificationConfig", () => deepClone(DEFAULT_NOTIFICATION_CONFIG)),
  notificationTemplates: loadLS("notificationTemplates", () => deepClone(DEFAULT_NOTIFICATION_TEMPLATES)),

});
PERSIST_KEYS.push("suppliers", "stockMoves", "slotSettings", "slotBookings", "peakSections", "notificationConfig", "notificationTemplates");

// Demo quantity per store: mostly healthy, some low, a few at zero.
function seedStoreQty(itemId, branchId) { const n = (itemId * 37 + branchId * 91) % 61; return n < 4 ? 0 : n; }
function productSku(id) { return `QK-${String(id).padStart(4, "0")}`; }
function withProductDefaults(i) {
  return {
    sku: productSku(i.id),
    barcode: `888${String(100000000 + i.id * 7919).slice(-9)}`,
    costPrice: Math.round(i.price * 0.7 * 100) / 100,
    supplierId: CATEGORY_DEFAULT_SUPPLIER[i.cat] || null,
    reorderLevel: 10,
    ...i,
  };
}
(function migrateToSept2026() {
  State.items = State.items.map(withProductDefaults);
  persist("items");
  // Every role knows every screen: new screens fall back to their defaults.
  State.roles = State.roles.map((r) => r.id === ROLE_STORE_MANAGER
    ? { ...r, permissions: { ...STORE_MANAGER_NEW_SCREEN_DEFAULTS, ...r.permissions } }
    : r);
  if (loadLS("migrated_2026_09", false)) { persist("roles"); return; }
  // Stock is now a real number at every store (the old "blank = unlimited" is gone).
  const next = { ...State.branchStock };
  State.branches.forEach((b) => {
    const map = { ...(next[b.id] || {}) };
    State.items.forEach((i) => {
      const cur = map[i.id];
      if (!cur) map[i.id] = { stock: true, stockCount: seedStoreQty(i.id, b.id) };
      else if (cur.stockCount == null) map[i.id] = { ...cur, stockCount: seedStoreQty(i.id, b.id) };
    });
    next[b.id] = map;
  });
  State.branchStock = next;
  persist("branchStock");
  SEED_EXTRA_ROLES.forEach((r) => { if (!findRole(r.id)) State.roles.push(deepClone(r)); });
  persist("roles");
  saveLS("migrated_2026_09", true);
})();

/* ---------------- 4. Small helpers ---------------- */
function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function fmtClock(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
function fmtSlotRange(s) { return `${fmtClock(s.start)} – ${fmtClock(s.end)}`; }
function fmtHour(h) { return h === 0 || h === 24 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`; }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function pct(n) { return `${Math.round(n)}%`; }
function supplierName(id) { const s = State.suppliers.find((x) => x.id === id); return s ? s.name : "—"; }
function nextId(list) { return list.length ? Math.max(...list.map((x) => Number(x.id) || 0)) + 1 : 1; }

/* ---------------- 5. Stock rules (negative inventory setting) ---------------- */
// Business Settings ▸ Inventory & Stock. OFF (default): a product can't be sold
// beyond what the store has. ON: orders go through and the store's stock can go
// below zero.
function allowNegativeStock() { return !!State.deliverySettings.allowNegativeStock; }
function storeQty(branchId, itemId) { return branchStockFor(branchId, itemId).stockCount; }
function storeSellable(branchId, item) { return !!item.stock && !!branchStockFor(branchId, item.id).stock; }
function storeCanFill(branchId, item, qty) {
  if (!storeSellable(branchId, item)) return false;
  if (allowNegativeStock()) return true;
  const q = storeQty(branchId, item.id);
  return q == null || q >= qty;
}
// Customer catalogue (network rule, D20): Out of stock only if an admin switched
// the product off, or no active store can sell even one.
function customerItemAvailable(item) {
  if (!item || !item.stock) return false;
  return State.branches.some((b) => b.active && storeCanFill(b.id, item, 1));
}
function stockStatus(branchId, item) {
  const q = storeQty(branchId, item.id);
  if (!storeSellable(branchId, item)) return { key: "off", label: "Not selling", tone: "gray" };
  if (q == null) return { key: "untracked", label: "Not tracked", tone: "gray" };
  if (q < 0) return { key: "negative", label: "Negative", tone: "red" };
  if (q === 0) return { key: "out", label: "Out of stock", tone: "red" };
  if (q <= (item.reorderLevel || 0)) return { key: "low", label: "Low stock", tone: "yellow" };
  return { key: "ok", label: "In stock", tone: "green" };
}
function isLowStock(branchId, item) { return ["low", "out", "negative"].includes(stockStatus(branchId, item).key); }
function setStoreQty(branchId, itemId, qty) {
  const cur = branchStockFor(branchId, itemId);
  State.branchStock = { ...State.branchStock, [branchId]: { ...(State.branchStock[branchId] || {}), [itemId]: { stock: cur.stock, stockCount: qty } } };
}
const STOCK_MOVE_TYPES = {
  receive: { label: "Received", tone: "green" },
  sale: { label: "Sold", tone: "blue" },
  stocktake: { label: "Stock take", tone: "gray" },
  damaged: { label: "Damaged", tone: "red" },
  expired: { label: "Expired", tone: "red" },
  correction: { label: "Correction", tone: "gray" },
  transfer_in: { label: "Transfer in", tone: "blue" },
  transfer_out: { label: "Transfer out", tone: "yellow" },
  import: { label: "Bulk import", tone: "gray" },
};
// Every stock change goes through here, so Inventory ▸ Stock history is complete.
function recordStockMove({ branchId, itemId, type, qty, unitCost, ref, note, supplierId }) {
  const before = storeQty(branchId, itemId) || 0;
  const after = before + qty;
  setStoreQty(branchId, itemId, after);
  const user = currentUser();
  State.stockMoves = [{ id: genId("SM"), at: Date.now(), branchId, itemId, type, qty, balance: after, unitCost: unitCost != null ? unitCost : null, supplierId: supplierId || null, ref: ref || "", note: note || "", by: user ? user.name : "Customer order" }, ...State.stockMoves].slice(0, 2000);
  persist("branchStock"); persist("stockMoves");
  return after;
}

/* ---------------- 6. Store assignment at checkout (D21 + stock rule) ---------------- */
function coveringStores(addr) {
  if (!addr || !addr.postal) return [];
  const [lat, lng] = estimateCoordsFromPostal(addr.postal);
  return State.branches.filter((b) => b.active)
    .map((b) => ({ b, d: haversineKm(lat, lng, b.lat, b.lng) }))
    .filter((x) => x.d <= x.b.radiusKm)
    .sort((a, c) => a.d - c.d)
    .map((x) => x.b);
}
function cartShortages(branchId, lines) {
  return lines.filter((l) => !storeCanFill(branchId, l, l.qty)).map((l) => ({
    id: l.id, name: l.name, wanted: l.qty,
    available: storeSellable(branchId, l) ? Math.max(storeQty(branchId, l.id) || 0, 0) : 0,
  }));
}
// Round 5: the order always goes to the NEAREST store whose radius covers the
// address (pickup: the chosen store). Checkout is never blocked or moved to
// another store because of stock — if that store is short, the store decides
// (transfer from a nearby store, or mark the item unavailable). `shortages`
// stays in the return value, always empty, so callers don't change.
function checkoutAssignment() {
  if (UI.fulfillment === "pickup") {
    const store = findPickupBranch(UI.pickupStoreId);
    return store ? { branch: store, shortages: [], fallback: false } : { branch: null, shortages: [], reason: "no-pickup" };
  }
  const stores = coveringStores(getSelectedAddress());
  if (!stores.length) return { branch: null, shortages: [], reason: "not-serviceable" };
  return { branch: stores[0], shortages: [], fallback: false, nearest: stores[0] };
}
function checkoutStockNoticeHTML(a) {
  if (State.session && isCustomerBlocked(State.session.name)) return `<div class="notice notice-danger" style="margin-bottom:12px">${ic("alert")}<span>Your account can't place orders right now. Please contact ${esc(State.companyProfile.phone || "customer support")}.</span></div>`;
  if (a.reason === "not-serviceable") return `<div class="notice notice-danger" style="margin-bottom:12px">${ic("alert")}<span>We don't deliver to this address yet — no store's delivery radius covers it. Choose another address or pickup.</span></div>`;
  return "";
}

/* ---------------- 7. Express delivery ---------------- */
function expressEnabled() { return State.deliverySettings.expressEnabled !== false; }
function expressChargeAmount() { return round2(State.deliverySettings.expressCharge); }
// The customer's pick, falling back to scheduled when Express is switched off.
function effectiveDeliverySpeed() { return expressEnabled() ? UI.deliverySpeed : "scheduled"; }

/* ---------------- 8. Delivery slots with capacity ---------------- */
function slotDays() {
  const n = Math.min(Math.max(Number(State.slotSettings.daysAhead) || 1, 1), 14);
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
    out.push({ date: isoDate(d), label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" }) });
  }
  return out;
}
function slotsFor(storeId, date) {
  const extras = (State.slotSettings.extras[`${storeId}|${date}`] || []).map((e) => ({ ...e, extra: true }));
  return [...State.slotSettings.templates, ...extras].slice().sort((a, b) => a.start.localeCompare(b.start));
}
function slotKey(storeId, date, slotId) { return `${storeId}|${date}|${slotId}`; }
function findSlotByKey(key) {
  const [storeId, date, slotId] = String(key || "").split("|");
  if (!slotId) return null;
  const slot = slotsFor(Number(storeId), date).find((s) => s.id === slotId);
  return slot ? { storeId: Number(storeId), date, slot } : null;
}
function slotDayLabel(date) { const d = slotDays().find((x) => x.date === date); return d ? d.label : new Date(`${date}T00:00:00`).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" }); }
function slotLabelFromKey(key) { const f = findSlotByKey(key); return f ? `${slotDayLabel(f.date)}, ${fmtSlotRange(f.slot)}` : ""; }
// Demo bookings so the prototype shows every fill colour; real orders add on top.
function demoBooked(key, defaultCap) {
  const [storeId, date, slotId] = key.split("|");
  const dayIdx = Math.max(slotDays().findIndex((d) => d.date === date), 0);
  const slotIdx = Math.max(State.slotSettings.templates.findIndex((t) => t.id === slotId), 0);
  const fractions = [0.2, 0.6, 0.92, 1, 0.45, 0.1, 0.8, 0.95, 0.3, 1, 0.55, 0];
  return Math.floor(defaultCap * fractions[(slotIdx + dayIdx * 5 + Number(storeId)) % fractions.length]);
}
function slotInfo(storeId, date, slot) {
  const key = slotKey(storeId, date, slot.id);
  const override = State.slotSettings.overrides[key];
  const cap = override != null ? Number(override) : Number(slot.capacity);
  const booked = demoBooked(key, Number(slot.capacity)) + (State.slotBookings[key] || 0);
  const fill = cap > 0 ? Math.min(100, (booked / cap) * 100) : 100;
  const closed = !!State.slotSettings.closed[key];
  let past = false;
  if (date === isoDate(new Date())) {
    const [h, m] = slot.start.split(":").map(Number);
    const start = new Date(); start.setHours(h, m, 0, 0);
    past = Date.now() > start.getTime() - (Number(State.slotSettings.cutoffMins) || 0) * 60000;
  }
  const level = past ? "past" : closed ? "closed" : booked >= cap ? "full" : fill >= 90 ? "high" : fill >= 50 ? "mid" : "low";
  return { key, cap, booked, fill, overridden: override != null, closed, past, level };
}
const SLOT_LEVEL_LABEL = { low: "Available", mid: "Filling fast", high: "Almost full", full: "Full", closed: "Closed", past: "Cut-off passed" };
function slotBookable(info) { return ["low", "mid", "high"].includes(info.level); }
function selectedSlotValid(branch) {
  if (!branch || !UI.scheduledSlot || !UI.scheduledSlot.startsWith(`${branch.id}|`)) return false;
  const f = findSlotByKey(UI.scheduledSlot);
  return !!f && slotBookable(slotInfo(f.storeId, f.date, f.slot));
}
function slotLegendHTML(withPercent) {
  return `<div class="slot-legend">
    <span><i class="dot fill-low"></i>Available${withPercent ? " (under 50%)" : ""}</span>
    <span><i class="dot fill-mid"></i>Filling fast${withPercent ? " (50–89%)" : ""}</span>
    <span><i class="dot fill-high"></i>Almost full${withPercent ? " (90–99%)" : ""}</span>
    <span><i class="dot fill-full"></i>Full${withPercent ? " (100% — disabled for customers)" : ""}</span>
  </div>`;
}
// Customer checkout: the assigned store's slots, coloured by how full they are.
function checkoutSlotPickerHTML(branch) {
  if (!branch) return `<div class="qk-muted small">Add an address we deliver to, to see delivery times.</div>`;
  return `
  ${slotLegendHTML(false)}
  <div class="slot-groups">
    ${slotDays().map((d) => `
      <div class="slot-group">
        <div class="slot-group-day">${esc(d.label)}</div>
        <div class="slot-pill-row">
          ${slotsFor(branch.id, d.date).map((s) => {
            const inf = slotInfo(branch.id, d.date, s);
            const ok = slotBookable(inf);
            return `<button type="button" class="slot-pill fill-${inf.level} ${UI.scheduledSlot === inf.key ? "active" : ""}" data-action="set-scheduled-slot" data-slot="${inf.key}" ${ok ? "" : "disabled"} title="${SLOT_LEVEL_LABEL[inf.level]}">
              <span class="slot-pill-time">${fmtSlotRange(s)}</span>
              <span class="slot-pill-state">${SLOT_LEVEL_LABEL[inf.level]}</span>
            </button>`;
          }).join("")}
        </div>
      </div>`).join("")}
  </div>`;
}

/* ---------------- 9. Admin ▸ Delivery Slots ---------------- */
function storePickerHTML(title, hint) {
  const user = currentUser();
  const ids = isSuperAdmin(user) ? State.branches.map((b) => b.id) : userStoreIds(user);
  const list = State.branches.filter((b) => ids.includes(b.id));
  return `
  <div class="qk-muted small" style="margin:0 0 12px">${hint}</div>
  <div class="admin-table">
    ${list.map((b) => `<div class="admin-row"><div class="admin-row-info"><div class="admin-row-name">${esc(b.name)}</div><div class="qk-muted small">${esc(b.area || "")}</div></div><button class="btn btn-sm btn-primary-soft" data-action="pick-store-scope" data-id="${b.id}">${title}</button></div>`).join("")}
    ${list.length === 0 ? `<div class="empty-state"><div class="empty-title">No store assigned</div></div>` : ""}
  </div>`;
}
function adminSlots() {
  const branchIds = scopedBranchIds();
  const editable = canEdit(currentUser(), "slots");
  const st = State.slotSettings;
  const templatesCard = `
  <div class="summary-card">
    <div class="summary-card-title">Slot times — used every day, at every store</div>
    <div class="qk-muted small" style="margin-bottom:10px">Each row is a delivery window customers can pick. Capacity is how many orders one store accepts in that window; change a single day's number below with an override.</div>
    <form data-action="save-slot-templates">
      <div class="slot-tpl-grid">
        <div class="slot-tpl-head"><span>From</span><span>To</span><span>Orders per slot</span><span></span></div>
        ${st.templates.map((t, i) => `
          <div class="slot-tpl-row">
            <input class="input" type="time" name="start_${i}" value="${esc(t.start)}" ${editable ? "" : "disabled"} />
            <input class="input" type="time" name="end_${i}" value="${esc(t.end)}" ${editable ? "" : "disabled"} />
            <input class="input" type="number" min="0" name="cap_${i}" value="${t.capacity}" ${editable ? "" : "disabled"} />
            ${editable ? `<button type="button" class="icon-btn icon-btn-danger" data-action="remove-slot-template" data-idx="${i}" aria-label="Remove">${ic("trash")}</button>` : "<span></span>"}
          </div>`).join("")}
      </div>
      <div class="field-grid-2" style="margin-top:12px">
        <label class="field"><span class="field-label">Days customers can book ahead (1–14)</span><input class="input" type="number" min="1" max="14" name="daysAhead" value="${st.daysAhead}" ${editable ? "" : "disabled"} /></label>
        <label class="field"><span class="field-label">Stop taking orders before a slot starts (minutes)</span><input class="input" type="number" min="0" max="240" name="cutoffMins" value="${st.cutoffMins}" ${editable ? "" : "disabled"} /></label>
      </div>
      ${editable ? `<div class="form-actions"><button type="button" class="btn btn-outline" data-action="add-slot-template">${ic("plus")} Add slot time</button><button type="submit" class="btn btn-primary">Save slot times</button></div>` : ""}
    </form>
  </div>`;
  if (!branchIds || branchIds.length !== 1) {
    return `${templatesCard}<div style="margin-top:16px">${storePickerHTML("Manage slots", "Bookings and capacity are per store. Pick a store to see how full each slot is and to override a day's capacity.")}</div>`;
  }
  const branch = findBranch(branchIds[0]);
  return `
  <div class="admin-toolbar">
    <div class="qk-muted small">Bookings at <b>${esc(branch.name)}</b>. Customers see the colours, not the numbers; a full slot can't be picked.</div>
    ${exportButtonsHTML("slots")}
  </div>
  ${slotLegendHTML(true)}
  ${slotDays().map((d) => adminSlotDayCard(branch, d, editable)).join("")}
  <div style="margin-top:16px">${templatesCard}</div>`;
}
function adminSlotDayCard(branch, d, editable) {
  const slots = slotsFor(branch.id, d.date);
  const infos = slots.map((s) => ({ s, inf: slotInfo(branch.id, d.date, s) }));
  const totalBooked = infos.reduce((n, x) => n + x.inf.booked, 0);
  const totalCap = infos.reduce((n, x) => n + x.inf.cap, 0);
  return `
  <div class="summary-card slot-day-card">
    <div class="summary-card-title">${esc(d.label)} <span class="qk-muted small" style="font-weight:600">${d.date} · ${totalBooked}/${totalCap} orders booked</span></div>
    <div class="slot-admin-rows">
      ${infos.map(({ s, inf }) => {
        const orders = State.orders.filter((o) => o.slotKey === inf.key && o.status !== "cancelled");
        const open = UI.openSlotKey === inf.key;
        return `
        <div class="slot-admin-row">
          <div class="slot-admin-time"><b>${fmtSlotRange(s)}</b>${s.extra ? ` <span class="badge badge-blue-soft">One-off</span>` : ""}</div>
          <div class="slot-admin-bar">
            <div class="fill-track"><div class="fill-bar fill-${inf.level}" style="width:${Math.max(inf.fill, 2)}%"></div></div>
            <span class="small"><b>${inf.booked}</b> / ${inf.cap} booked · ${pct(inf.fill)}</span>
          </div>
          <span class="badge slot-badge fill-${inf.level}">${SLOT_LEVEL_LABEL[inf.level]}</span>
          ${editable ? `
          <label class="slot-override" title="Capacity for this slot on this day only">
            <input class="input" type="number" min="0" placeholder="${s.capacity}" value="${inf.overridden ? inf.cap : ""}" data-action="set-slot-override" data-key="${inf.key}" />
            ${inf.overridden ? `<button class="link-btn" data-action="clear-slot-override" data-key="${inf.key}">Reset</button>` : `<span class="qk-muted small">Override</span>`}
          </label>
          <button class="btn btn-sm ${inf.closed ? "btn-primary-soft" : "btn-outline"}" data-action="toggle-slot-closed" data-key="${inf.key}">${inf.closed ? "Reopen" : "Close"}</button>
          ${s.extra ? `<button class="icon-btn icon-btn-danger" data-action="remove-extra-slot" data-store="${branch.id}" data-date="${d.date}" data-id="${s.id}" aria-label="Remove">${ic("trash")}</button>` : ""}` : ""}
          <button class="link-btn" data-action="toggle-slot-orders" data-key="${inf.key}">${open ? "Hide" : "Orders"} (${orders.length})</button>
        </div>
        ${open ? `<div class="slot-orders">
          ${orders.length ? orders.map((o) => `<div class="row"><span>#${o.id} · ${esc(o.customerName)} <span class="badge badge-${STATUS_META[o.status].tone}-soft">${STATUS_META[o.status].label}</span></span>
            ${editable ? `<select class="input input-sm" data-action="move-slot-order" data-id="${o.id}"><option value="">Move to…</option>${infos.filter((x) => x.inf.key !== inf.key && slotBookable(x.inf)).map((x) => `<option value="${x.inf.key}">${fmtSlotRange(x.s)}</option>`).join("")}</select>` : ""}</div>`).join("")
          : `<div class="qk-muted small">No prototype orders in this slot yet (the booked number includes demo bookings).</div>`}
        </div>` : ""}`;
      }).join("")}
    </div>
    ${editable ? `
    <form class="slot-extra-form" data-action="add-extra-slot" data-store="${branch.id}" data-date="${d.date}">
      <span class="small qk-muted">Add a one-off slot for ${esc(d.label.toLowerCase())}:</span>
      <input class="input" type="time" name="start" required /><input class="input" type="time" name="end" required />
      <input class="input" type="number" min="1" name="capacity" placeholder="Orders" required />
      <button type="submit" class="btn btn-sm btn-primary-soft">${ic("plus")} Add</button>
    </form>` : ""}
  </div>`;
}

/* ---------------- 10. Admin ▸ Dashboard insights ---------------- */
function dashboardInsightsHTML(scopedOrders) {
  // Round 3: period comes from the shared filter bar (presets or custom dates).
  const dr = dashRange();
  const orders = scopedOrders.filter((o) => o.status !== "cancelled" && inRange(o.createdAt, dr.range));
  // Top categories → top items inside each.
  const cats = {};
  orders.forEach((o) => o.items.forEach((it) => {
    const item = findItem(it.id);
    const cat = item ? item.cat : "Other";
    const c = cats[cat] || (cats[cat] = { name: cat, qty: 0, revenue: 0, items: {} });
    c.qty += it.qty; c.revenue += it.price * it.qty;
    const i = c.items[it.name] || (c.items[it.name] = { name: it.name, qty: 0, revenue: 0 });
    i.qty += it.qty; i.revenue += it.price * it.qty;
  }));
  const catList = Object.values(cats).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const maxRev = catList.length ? catList[0].revenue : 1;
  // Peak hours.
  const hours = Array(24).fill(0);
  orders.forEach((o) => { hours[new Date(o.createdAt).getHours()]++; });
  const maxHour = Math.max(...hours, 1);
  const peakHour = hours.indexOf(Math.max(...hours));
  const sections = State.peakSections.slice().sort((a, b) => a.start - b.start);
  const sectionOf = (h) => sections.findIndex((s) => h >= s.start && h < s.end);
  const secStats = sections.map((s, idx) => {
    const list = orders.filter((o) => sectionOf(new Date(o.createdAt).getHours()) === idx);
    return { ...s, idx, count: list.length, sales: list.reduce((n, o) => n + o.total, 0) };
  });
  const busiest = secStats.reduce((b, s) => (!b || s.count > b.count ? s : b), null);
  const itemTotals = {};
  orders.forEach((o) => o.items.forEach((it) => { const t = itemTotals[it.name] || (itemTotals[it.name] = { name: it.name, qty: 0, revenue: 0 }); t.qty += it.qty; t.revenue += it.price * it.qty; }));
  const topItems = Object.values(itemTotals).sort((a, b) => b.qty - a.qty).slice(0, 8);
  const maxItemQty = topItems.length ? topItems[0].qty : 1;
  return `
  <div class="insights-head">
    <div class="summary-card-title" style="margin:0">Sales insights · ${esc(dr.label)} <span class="qk-muted small" style="font-weight:600">${orders.length} orders · ${money(orders.reduce((s, o) => s + o.total, 0))}</span></div>
    <div class="filter-pill-row">${filterBarHTML("dash", { date: { key: "date", label: "Period" } })}${exportButtonsHTML("dashboard")}</div>
  </div>
  <div class="dash-grid-2">
    <div class="summary-card">
      <div class="summary-card-title">Top selling categories</div>
      <div class="qk-muted small" style="margin-bottom:8px">By sales value. Tap a category to see its top selling items.</div>
      ${catList.length ? catList.map((c, idx) => {
        const open = UI.dashOpenCat === c.name;
        const top = Object.values(c.items).sort((a, b) => b.qty - a.qty).slice(0, 5);
        return `
        <button type="button" class="topcat-row" data-action="dash-open-cat" data-cat="${esc(c.name)}" aria-expanded="${open}">
          <div class="row"><span>${idx + 1}. <b>${esc(c.name)}</b> <span class="qk-muted small">${c.qty} sold</span></span><span class="qk-num">${money(c.revenue)} <span class="collapsible-chev ${open ? "open" : ""}">${ic("chevronDown")}</span></span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${(c.revenue / maxRev) * 100}%"></div></div>
        </button>
        ${open ? `<div class="topcat-items">
          ${top.map((i, n) => `<div class="row small"><span>${n + 1}. ${esc(i.name)}</span><span>${i.qty} sold · ${money(i.revenue)}</span></div>`).join("")}
        </div>` : ""}`;
      }).join("") : `<div class="qk-muted small">No sales in this period.</div>`}
    </div>
    <div class="summary-card">
      <div class="summary-card-title">Peak hours ${orders.length ? `<span class="badge badge-blue-soft">Busiest hour ${fmtHour(peakHour)}–${fmtHour(peakHour + 1)}</span>` : ""}</div>
      <div class="peak-chart" role="img" aria-label="Orders per hour of the day">
        ${hours.map((n, h) => `<div class="peak-col" title="${fmtHour(h)}–${fmtHour(h + 1)}: ${n} order${n === 1 ? "" : "s"}"><div class="peak-bar sec-${Math.max(sectionOf(h), 0) % 6} ${h === peakHour && n ? "is-peak" : ""}" style="height:${(n / maxHour) * 100}%"></div><span class="peak-label">${h % 3 === 0 ? fmtHour(h).replace(" ", "") : ""}</span></div>`).join("")}
      </div>
      <div class="peak-sections">
        ${secStats.map((s) => `
          <div class="row small"><span><i class="dot sec-${s.idx % 6}"></i><b>${esc(s.name)}</b> <span class="qk-muted">${fmtHour(s.start)}–${fmtHour(s.end)}</span> ${busiest && busiest.id === s.id && s.count ? `<span class="badge badge-green-soft">Busiest</span>` : ""}</span>
          <span>${s.count} orders · ${orders.length ? pct((s.count / orders.length) * 100) : "0%"} · ${money(s.sales)}</span></div>`).join("")}
      </div>
      ${canEdit(currentUser(), "tax") || isSuperAdmin(currentUser()) ? `<button class="link-btn" data-action="edit-peak-sections" style="margin-top:8px">${ic("edit")} Edit time sections</button>` : ""}
    </div>
  </div>
  <div class="summary-card" style="margin-bottom:16px">
    <div class="summary-card-title">Top selling items · ${esc(dr.label)}</div>
    ${topItems.length ? `<div class="topitems-grid">${topItems.map((t, idx) => `
      <div class="topseller-row"><div class="row"><span>${idx + 1}. ${esc(t.name)}</span><span>${t.qty} sold · ${money(t.revenue)}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${(t.qty / maxItemQty) * 100}%"></div></div></div>`).join("")}</div>` : `<div class="qk-muted small">No sales in this period.</div>`}
  </div>`;
}
function peakSectionsModal() {
  const rows = UI.modal.rows;
  const hourOpts = (sel) => Array.from({ length: 25 }, (_, h) => `<option value="${h}" ${Number(sel) === h ? "selected" : ""}>${fmtHour(h)}${h === 24 ? " (midnight)" : ""}</option>`).join("");
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static dialog-user" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>Peak-hour time sections</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <form class="dialog-body" data-action="save-peak-sections">
        <div class="qk-muted small" style="margin-bottom:10px">Split the day into named sections. The dashboard counts orders in each so you can see which part of the day is busiest. Sections must not overlap.</div>
        ${rows.map((r, i) => `
          <div class="slot-tpl-row">
            <input class="input" name="name_${i}" value="${esc(r.name)}" placeholder="Name" />
            <select class="input" name="start_${i}">${hourOpts(r.start)}</select>
            <select class="input" name="end_${i}">${hourOpts(r.end)}</select>
            <button type="button" class="icon-btn icon-btn-danger" data-action="remove-peak-row" data-idx="${i}">${ic("trash")}</button>
          </div>`).join("")}
        ${UI.modal.error ? `<div class="field-error">${esc(UI.modal.error)}</div>` : ""}
        <div class="form-actions">
          <button type="button" class="btn btn-outline" data-action="add-peak-row">${ic("plus")} Add section</button>
          <button type="submit" class="btn btn-primary">Save sections</button>
        </div>
      </form>
    </div>
  </div>`;
}

/* ---------------- 11. Admin ▸ Users & Roles ---------------- */
function adminUsersListV2(editable) {
  const me = currentUser();
  const roleFilter = UI.userRoleFilter || "all";
  const uf = F("users");
  const users = State.users.filter((u) => (roleFilter === "all" || u.roleId === roleFilter)
    && qmatch(uf.q, u.name, u.email, u.mobile)
    && (!uf.store || isSuperAdmin(u) || (u.storeIds || []).includes(Number(uf.store)))
    && (!uf.status || (uf.status === "active") === (u.active !== false)));
  return `
  <div class="admin-toolbar">
    ${editable ? `<button class="btn btn-primary" data-action="new-user">${ic("plus")} Add user</button>` : "<span></span>"}
    ${exportButtonsHTML("users")}
  </div>
  ${filterBarHTML("users", { fields: [
    { key: "store", label: "Store", options: State.branches.map((b) => [String(b.id), b.name]) },
    { key: "status", label: "Status", options: [["active", "Active"], ["inactive", "Inactive"]] },
  ] })}
  <div class="pill-row">
    <button class="pill ${roleFilter === "all" ? "active" : ""}" data-action="user-role-filter" data-role="all">All (${State.users.length})</button>
    ${State.roles.map((r) => `<button class="pill ${roleFilter === r.id ? "active" : ""}" data-action="user-role-filter" data-role="${r.id}">${esc(r.name)} (${State.users.filter((u) => u.roleId === r.id).length})</button>`).join("")}
  </div>
  <div class="admin-table">
    ${users.map((u) => {
      const stores = userStoreIds(u).map(findBranch).filter(Boolean);
      const storeLabel = isSuperAdmin(u) ? "All stores" : stores.length ? stores.map((b) => b.name).join(", ") : "Unassigned";
      const roleOptions = State.roles.filter((r) => r.id !== ROLE_SUPER_ADMIN || isSuperAdmin(me));
      return `
      <div class="admin-row">
        <div class="admin-row-info">
          <div class="admin-row-name">${esc(u.name)}</div>
          <div class="qk-muted small">${esc(u.email || "—")}${u.mobile ? " · " + fmtMobile(u.mobile) : ""} · ${esc(storeLabel)}</div>
        </div>
        ${editable && !(isSuperAdmin(u) && !isSuperAdmin(me)) ? `
        <label class="role-select"><span class="qk-muted small">Role</span>
          <select class="input input-sm" data-action="change-user-role" data-id="${u.id}" aria-label="Role for ${esc(u.name)}">
            ${roleOptions.map((r) => `<option value="${r.id}" ${u.roleId === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}
          </select>
        </label>` : `<span class="badge badge-blue-soft">${esc((findRole(u.roleId) || {}).name || "—")}</span>`}
        <span class="badge badge-${u.active === false ? "red" : "green"}">${u.active === false ? "Inactive" : "Active"}</span>
        ${editable ? `
        <button class="icon-btn" data-action="edit-user" data-id="${u.id}" aria-label="Edit">${ic("edit")}</button>
        <button class="icon-btn icon-btn-danger" data-action="delete-user" data-id="${u.id}" aria-label="Delete">${ic("trash")}</button>` : ""}
      </div>`;
    }).join("")}
    ${users.length === 0 ? `<div class="empty-state"><div class="empty-title">No users with this role</div></div>` : ""}
  </div>`;
}
function adminRolesV2(editable) {
  return `
  ${editable ? `<button class="btn btn-primary" data-action="new-role">${ic("plus")} New role</button>` : ""}
  <div class="qk-muted small" style="margin:10px 0">A role is a set of screen permissions. Give a user a role from the Users list; you can still fine-tune one user from their own record.</div>
  <div class="summary-card" style="max-width:720px">
    <div class="summary-card-title">Super Admin <span class="badge badge-gray-soft">Locked</span></div>
    <div class="qk-muted small">Always has full access to every screen, across every store. ${State.users.filter((u) => isSuperAdmin(u)).length} user(s).</div>
  </div>
  ${State.roles.filter((r) => !r.locked).map((r) => {
    const count = State.users.filter((u) => u.roleId === r.id).length;
    return `
    <div class="summary-card" style="max-width:720px;margin-top:16px">
      <form data-action="save-role" data-role="${r.id}">
        <div class="role-card-head">
          ${editable && !r.isSystem ? `<input class="input" name="roleName" value="${esc(r.name)}" aria-label="Role name" />` : `<div class="summary-card-title" style="margin:0">${esc(r.name)}</div>`}
          <span class="badge badge-${r.isSystem ? "gray" : "blue"}-soft">${r.isSystem ? "Built-in" : "Custom"} · ${count} user${count === 1 ? "" : "s"}</span>
        </div>
        <div class="perm-grid">
          ${PERMISSION_SCREENS.map((s) => `<div class="perm-row"><span>${s.label}</span>${permissionSelect(s.key, r.permissions[s.key] || "none", s.editable, !editable, `role_${r.id}`)}</div>`).join("")}
        </div>
        ${editable ? `<div class="form-actions">
          ${!r.isSystem ? `<button type="button" class="btn btn-outline-danger" data-action="delete-role" data-role="${r.id}" ${count ? `disabled title="Move its ${count} user(s) to another role first"` : ""}>Delete role</button>` : ""}
          <button type="submit" class="btn btn-primary">Save ${esc(r.name)}</button>
        </div>` : ""}
      </form>
    </div>`;
  }).join("")}`;
}
function roleFormModal() {
  const err = UI.modal.error;
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>New role</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <form class="dialog-body" data-action="create-role">
        <label class="field"><span class="field-label">Role name *</span><input class="input ${err ? "invalid" : ""}" name="name" placeholder="e.g. Cashier, Accountant" /></label>
        ${err ? `<div class="field-error">${esc(err)}</div>` : ""}
        <label class="field"><span class="field-label">Start from the permissions of</span>
          <select class="input" name="copyFrom"><option value="">Nothing (no access)</option>${State.roles.filter((r) => !r.locked).map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("")}</select>
        </label>
        <div class="form-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Create role</button></div>
      </form>
    </div>
  </div>`;
}

/* ---------------- 12. Admin ▸ Inventory (per-store stock + stock history) ----------------
   How the three layers fit together:
   Category  → groups products (customer menu, reports).
   Product   → the catalogue master: SKU, price, cost price, supplier, reorder level.
               Shared by every store. No quantity lives here.
   Inventory → quantity on hand per store. Changes only through a stock movement
               (receive, sale, stock take, damaged/expired, transfer, import),
               each written to the stock history. */
function adminInventoryV2() {
  const branchIds = scopedBranchIds();
  const editable = canEdit(currentUser(), "inventory");
  if (!branchIds || branchIds.length !== 1) {
    const list = branchIds ? State.branches.filter((b) => branchIds.includes(b.id)) : State.branches;
    // Round 6: transfers across all the stores in scope.
    const tc = transferCounts(branchIds);
    const tabs = `<div class="pill-row"><button class="pill ${UI.invTab !== "transfers" ? "active" : ""}" data-action="inv-tab" data-tab="stock">Stores</button><button class="pill ${UI.invTab === "transfers" ? "active" : ""}" data-action="inv-tab" data-tab="transfers">Transfers${tc.toSend + tc.toReceive ? ` <span class="pill-count">${tc.toSend + tc.toReceive}</span>` : ""}</button></div>`;
    if (UI.invTab === "transfers") return `${tabs}${transfersHTML(null)}`;
    return `${tabs}
    <div class="admin-toolbar">
      <div class="qk-muted small">Products are shared; <b>quantities are per store</b>. Pick a store to receive, adjust or transfer stock.</div>
      <div class="filter-pill-row">${editable ? `<button class="btn btn-outline btn-sm" data-action="open-import" data-entity="inventory">${ic("upload")} Import stock</button>` : ""}${exportButtonsHTML("inventory")}</div>
    </div>
    <div class="admin-table">
      ${list.map((b) => {
        const low = State.items.filter((i) => stockStatus(b.id, i).key === "low").length;
        const out = State.items.filter((i) => stockStatus(b.id, i).key === "out").length;
        const neg = State.items.filter((i) => stockStatus(b.id, i).key === "negative").length;
        const value = State.items.reduce((s, i) => s + Math.max(storeQty(b.id, i.id) || 0, 0) * (i.costPrice || 0), 0);
        return `<div class="admin-row"><div class="admin-row-info"><div class="admin-row-name">${esc(b.name)}</div><div class="qk-muted small">Stock value at cost ${money(value)}</div></div>
          <span class="badge badge-yellow-soft">${low} low</span><span class="badge badge-red-soft">${out} out</span>${neg ? `<span class="badge badge-red">${neg} negative</span>` : ""}
          <button class="btn btn-sm btn-primary-soft" data-action="pick-store-scope" data-id="${b.id}">Manage stock</button></div>`;
      }).join("")}
    </div>`;
  }
  const branchId = branchIds[0];
  const branch = findBranch(branchId);
  const tab = UI.invTab || "stock";
  const items = State.items;
  const stats = { low: 0, out: 0, negative: 0, value: 0 };
  items.forEach((i) => { const k = stockStatus(branchId, i).key; if (stats[k] != null) stats[k]++; stats.value += Math.max(storeQty(branchId, i.id) || 0, 0) * (i.costPrice || 0); });
  return `
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-label">Products</div><div class="stat-value">${items.length}</div><div class="stat-sub"><span>at ${esc(branch.name)}</span></div></div>
    <div class="stat-card"><div class="stat-label">Stock value (cost)</div><div class="stat-value">${money(stats.value)}</div><div class="stat-sub"><span>Quantity × cost price</span></div></div>
    <div class="stat-card"><div class="stat-label">Low stock</div><div class="stat-value">${stats.low}</div><div class="stat-sub"><span>At or below reorder level</span></div></div>
    <div class="stat-card"><div class="stat-label">Out / negative</div><div class="stat-value">${stats.out} / ${stats.negative}</div><div class="stat-sub"><span>${allowNegativeStock() ? "Negative stock allowed" : "Negative stock not allowed"}</span></div></div>
  </div>
  <div class="pill-row">
    <button class="pill ${tab === "stock" ? "active" : ""}" data-action="inv-tab" data-tab="stock">Stock on hand</button>
    <button class="pill ${tab === "history" ? "active" : ""}" data-action="inv-tab" data-tab="history">Stock history</button>
    <button class="pill ${tab === "transfers" ? "active" : ""}" data-action="inv-tab" data-tab="transfers">Transfers${(() => { const tc = transferCounts([branchId]); return tc.toSend + tc.toReceive ? ` <span class="pill-count">${tc.toSend + tc.toReceive}</span>` : ""; })()}</button>
  </div>
  ${tab === "transfers" ? transfersHTML(branchId) : tab === "history" ? inventoryHistoryHTML(branchId) : inventoryStockHTML(branchId, editable)}`;
}
function inventoryStockHTML(branchId, editable) {
  FILTER_RESULTS.stock = () => inventoryRowsHTML(branchId, editable);
  return `
  <div class="admin-toolbar">
    <div class="qk-muted small">Stock on hand at <b>${esc(findBranch(branchId).name)}</b>.</div>
    <div class="filter-pill-row">
      ${editable ? `<button class="btn btn-primary btn-sm" data-action="open-stock-move" data-mode="receive" data-branch="${branchId}">${ic("plus")} Receive stock</button>
      <button class="btn btn-outline btn-sm" data-action="open-import" data-entity="inventory">${ic("upload")} Import</button>` : ""}
      ${exportButtonsHTML("inventory")}
    </div>
  </div>
  ${stockFilterBarHTML()}
  <div id="fres-stock">${inventoryRowsHTML(branchId, editable)}</div>`;
}
function inventoryRowsHTML(branchId, editable) {
  const items = stockItemsFiltered(branchId);
  return `
  ${resultCountHTML(items.length, State.items.length, "products")}
  <div id="adminInventoryList" class="inv-table">
    <div class="inv-row inv-head"><span>Product</span><span>Supplier</span><span class="r">On hand</span><span class="r">Reorder at</span><span>Status</span><span class="r">Actions</span></div>
    ${items.map((item) => {
      const s = stockStatus(branchId, item);
      const qty = storeQty(branchId, item.id);
      const sellHere = branchStockFor(branchId, item.id).stock;
      return `
      <div class="inv-row">
        <span class="inv-prod"><img src="${item.image}" alt="" /><span><b>${esc(item.name)}</b><span class="qk-muted small">${esc(item.sku || "")} · ${esc(item.cat)} · cost ${money(item.costPrice || 0)}</span></span></span>
        <span class="small">${esc(supplierName(item.supplierId))}</span>
        <span class="r inv-qty tone-${s.tone}">${qty == null ? "—" : qty}</span>
        <span class="r small">${item.reorderLevel || 0}</span>
        <span><span class="badge badge-${s.tone}-soft">${s.label}</span></span>
        <span class="r inv-actions">
          ${editable ? `
          <button class="btn btn-sm btn-outline" data-action="open-stock-move" data-mode="receive" data-branch="${branchId}" data-id="${item.id}">Receive</button>
          <button class="btn btn-sm btn-outline" data-action="open-stock-move" data-mode="adjust" data-branch="${branchId}" data-id="${item.id}">Adjust</button>
          <button class="btn btn-sm btn-outline" data-action="open-stock-move" data-mode="transfer" data-branch="${branchId}" data-id="${item.id}">Transfer</button>
          <label class="stock-toggle" title="Sell this product from this store"><input type="checkbox" ${sellHere ? "checked" : ""} data-action="toggle-branch-stock" data-branch="${branchId}" data-id="${item.id}" /><span>${sellHere ? "Selling" : "Off"}</span></label>` : ""}
        </span>
      </div>`;
    }).join("")}
    ${items.length === 0 ? `<div class="empty-state"><div class="empty-title">No products match</div></div>` : ""}
  </div>`;
}
function inventoryHistoryHTML(branchId) {
  FILTER_RESULTS.stockHistory = () => inventoryHistoryRowsHTML(branchId);
  return `
  <div class="admin-toolbar"><div class="qk-muted small">Every change to this store's stock, newest first. Nothing edits a quantity without leaving a line here.</div>${exportButtonsHTML("stockHistory")}</div>
  ${stockHistoryFilterBarHTML(branchId)}
  <div id="fres-stockHistory">${inventoryHistoryRowsHTML(branchId)}</div>`;
}
function inventoryHistoryRowsHTML(branchId) {
  const all = State.stockMoves.filter((m) => m.branchId === branchId).length;
  const moves = stockMovesFiltered(branchId);
  return `
  ${resultCountHTML(Math.min(moves.length, 300), all, "movements")}
  <div class="inv-table">
    <div class="inv-row inv-hist inv-head"><span>When</span><span>Product</span><span>Movement</span><span class="r">Qty</span><span class="r">Balance</span><span>Reference / note</span><span>By</span></div>
    ${moves.slice(0, 300).map((m) => {
      const item = findItem(m.itemId);
      const t = STOCK_MOVE_TYPES[m.type] || { label: m.type, tone: "gray" };
      return `<div class="inv-row inv-hist">
        <span class="small">${fmtDateTime(m.at)}</span>
        <span class="small"><b>${esc(item ? item.name : `#${m.itemId}`)}</b></span>
        <span><span class="badge badge-${t.tone}-soft">${t.label}</span></span>
        <span class="r ${m.qty < 0 ? "tone-red" : "tone-green"}"><b>${m.qty > 0 ? "+" : ""}${m.qty}</b></span>
        <span class="r">${m.balance}</span>
        <span class="small">${esc([m.ref, m.note].filter(Boolean).join(" · ") || "—")}${m.unitCost != null ? ` <span class="qk-muted">@ ${money(m.unitCost)}</span>` : ""}</span>
        <span class="small qk-muted">${esc(m.by)}</span>
      </div>`;
    }).join("")}
    ${moves.length === 0 ? `<div class="empty-state"><div class="empty-title">No stock movements yet</div><div class="empty-hint">Receive, adjust or transfer stock, or place a customer order, and it shows up here.</div></div>` : ""}
  </div>`;
}
function stockMoveModal() {
  const m = UI.modal;
  const branch = findBranch(m.branchId);
  const item = m.itemId ? findItem(m.itemId) : null;
  const qty = item ? storeQty(m.branchId, item.id) : null;
  const title = { receive: "Receive stock", adjust: "Adjust stock", transfer: "Send stock to another store" }[m.mode];
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>${title} · ${esc(branch.name)}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <form class="dialog-body" data-action="save-stock-move">
        ${item ? `<div class="notice notice-ok" style="margin-bottom:12px">${ic("boxes")}<span><b>${esc(item.name)}</b> (${esc(item.sku)}) — on hand now: <b>${qty == null ? "—" : qty}</b></span></div><input type="hidden" name="itemId" value="${item.id}" />` : `
        <label class="field"><span class="field-label">Product *</span><select class="input" name="itemId">${State.items.map((i) => `<option value="${i.id}">${esc(i.name)} (${esc(i.sku)})</option>`).join("")}</select></label>`}
        ${m.mode === "receive" ? `
          <div class="field-grid-2">
            <label class="field"><span class="field-label">Quantity received *</span><input class="input" type="number" min="1" name="qty" required /></label>
            <label class="field"><span class="field-label">Unit cost (S$)</span><input class="input" type="number" min="0" step="0.01" name="unitCost" value="${item ? item.costPrice || "" : ""}" /></label>
          </div>
          <label class="field"><span class="field-label">Supplier</span><select class="input" name="supplierId"><option value="">—</option>${State.suppliers.filter((s) => s.active !== false).map((s) => `<option value="${s.id}" ${item && item.supplierId === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
          <label class="field"><span class="field-label">Supplier invoice / delivery order no.</span><input class="input" name="ref" placeholder="e.g. DO-58213" /></label>
          <div class="qk-muted small">The unit cost you enter becomes the product's cost price.</div>
        ` : m.mode === "adjust" ? `
          <label class="field"><span class="field-label">Reason *</span>
            <select class="input" name="reason">
              <option value="stocktake">Stock take — set the counted quantity</option>
              <option value="damaged">Damaged — remove units</option>
              <option value="expired">Expired — remove units</option>
              <option value="correction">Correction — add or remove units</option>
            </select></label>
          <label class="field"><span class="field-label">Quantity *</span><input class="input" type="number" name="qty" required placeholder="Stock take: counted qty · Damaged/expired: units to remove · Correction: +5 or -3" /></label>
          <label class="field"><span class="field-label">Note</span><input class="input" name="note" placeholder="Optional" /></label>
        ` : `
          <div class="field-grid-2">
            <label class="field"><span class="field-label">To store *</span><select class="input" name="toBranch">${State.branches.filter((b) => b.id !== m.branchId).map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}</select></label>
            <label class="field"><span class="field-label">Quantity *</span><input class="input" type="number" min="1" name="qty" required /></label>
          </div>
          <label class="field"><span class="field-label">Note</span><input class="input" name="note" placeholder="Optional" /></label>
        `}
        ${m.error ? `<div class="field-error">${esc(m.error)}</div>` : ""}
        <div class="form-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Save</button></div>
      </form>
    </div>
  </div>`;
}

/* ---------------- 13. Admin ▸ Suppliers ---------------- */
function adminSuppliers() {
  const editable = canEdit(currentUser(), "suppliers");
  return `
  <div class="admin-toolbar">
    <div class="search-box"><span>${ic("search")}</span><input class="input" value="${esc(UI.supplierQuery || "")}" oninput="onSupplierSearch(this.value)" placeholder="Search suppliers..." /></div>
    <div class="filter-pill-row">
      ${editable ? `<button class="btn btn-primary btn-sm" data-action="new-supplier">${ic("plus")} Add supplier</button><button class="btn btn-outline btn-sm" data-action="open-import" data-entity="suppliers">${ic("upload")} Import</button>` : ""}
      ${exportButtonsHTML("suppliers")}
    </div>
  </div>
  <div id="supplierList" class="admin-table">${supplierRowsHTML(editable)}</div>`;
}
function supplierRowsHTML(editable) {
  const q = (UI.supplierQuery || "").toLowerCase();
  const list = State.suppliers.filter((s) => !q || s.name.toLowerCase().includes(q) || (s.code || "").toLowerCase().includes(q));
  return `
    ${list.map((s) => {
      const products = State.items.filter((i) => i.supplierId === s.id).length;
      const receipts = State.stockMoves.filter((m) => m.type === "receive" && m.supplierId === s.id);
      const last = receipts[0];
      return `
      <div class="admin-row">
        <div class="admin-row-info">
          <div class="admin-row-name">${esc(s.name)} <span class="qk-muted small">${esc(s.code)}</span></div>
          <div class="qk-muted small">${esc(s.contactPerson || "—")}${s.phone ? " · " + esc(s.phone) : ""}${s.email ? " · " + esc(s.email) : ""}</div>
          <div class="qk-muted small">Terms ${esc(s.paymentTerms || "—")} · lead time ${s.leadTimeDays || 0} day(s) · ${products} product(s)${last ? ` · last delivery ${fmtDate(last.at)}` : ""}</div>
        </div>
        <span class="badge badge-${s.active === false ? "red" : "green"}">${s.active === false ? "Inactive" : "Active"}</span>
        ${editable ? `
        <button class="icon-btn" data-action="edit-supplier" data-id="${s.id}" aria-label="Edit">${ic("edit")}</button>
        <button class="icon-btn icon-btn-danger" data-action="delete-supplier" data-id="${s.id}" aria-label="Delete">${ic("trash")}</button>` : ""}
      </div>`;
    }).join("")}
    ${list.length === 0 ? `<div class="empty-state"><div class="empty-title">No suppliers ${q ? "match" : "yet"}</div></div>` : ""}`;
}
function onSupplierSearch(v) { UI.supplierQuery = v; const el = document.getElementById("supplierList"); if (el) el.innerHTML = supplierRowsHTML(canEdit(currentUser(), "suppliers")); }
function supplierFormModal() {
  const f = UI.modal.form;
  const err = UI.modal.errors || {};
  const inp = (name, label, extra) => `<label class="field"><span class="field-label">${label}</span><input class="input ${err[name] ? "invalid" : ""}" name="${name}" value="${esc(f[name] == null ? "" : f[name])}" ${extra || ""} />${err[name] ? `<span class="field-error">${esc(err[name])}</span>` : ""}</label>`;
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static dialog-user" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>${f.id ? "Edit supplier" : "Add supplier"}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <form class="dialog-body" data-action="save-supplier">
        <div class="field-grid-2">${inp("code", "Supplier code *")}${inp("name", "Company name *")}</div>
        <div class="field-grid-2">${inp("contactPerson", "Contact person")}${inp("phone", "Phone")}</div>
        <div class="field-grid-2">${inp("email", "Email", 'type="email"')}${inp("uen", "UEN")}</div>
        ${inp("address", "Address")}
        <div class="field-grid-2">
          <label class="field"><span class="field-label">Payment terms</span><select class="input" name="paymentTerms">${["COD", "7 days", "14 days", "30 days", "45 days", "60 days"].map((t) => `<option ${f.paymentTerms === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          ${inp("leadTimeDays", "Lead time (days)", 'type="number" min="0"')}
        </div>
        ${inp("notes", "Notes")}
        <label class="stock-toggle-lg"><input type="checkbox" name="active" ${f.active !== false ? "checked" : ""} /><span>Active — can be picked when receiving stock</span></label>
        <div class="form-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Save supplier</button></div>
      </form>
    </div>
  </div>`;
}


/* ---------------- 14. Admin ▸ Notifications (business-wide, all stores) ----------------
   One configuration per business, edited by that business's Super Admin.
   Secrets (SMTP password, SMS token, Firebase service account) are write-only:
   once saved they are never shown again — only "saved" is shown. */
const SMS_PROVIDERS = ["Twilio", "Vonage", "AWS SNS", "MessageBird", "8x8"];
function adminNotifications() {
  const editable = canEdit(currentUser(), "notifications");
  const tab = UI.notifTab || "channels";
  return `
  <div class="pill-row">
    <button class="pill ${tab === "channels" ? "active" : ""}" data-action="notif-tab" data-tab="channels">Channels &amp; providers</button>
    <button class="pill ${tab === "templates" ? "active" : ""}" data-action="notif-tab" data-tab="templates">Message templates</button>
  </div>
  <div class="notice notice-ok" style="margin-bottom:14px">${ic("bell")}<span>One setting for the whole business — used by all ${State.branches.length} stores. Passwords and keys are stored encrypted and are <b>never shown again</b> after saving.</span></div>
  ${tab === "templates" ? notifTemplatesHTML(editable) : notifChannelsHTML(editable)}`;
}
function secretField(name, label, isSet) {
  return `<label class="field"><span class="field-label">${label}</span><input class="input" type="password" name="${name}" autocomplete="new-password" placeholder="${isSet ? "•••••••• saved — type to replace" : "Not set"}" /></label>`;
}
function notifChannelCard(ch, title, icon, editable, ownFields, defaultText) {
  const c = State.notificationConfig[ch];
  const dis = editable ? "" : "disabled";
  return `
  <div class="summary-card notif-card ${c.enabled ? "" : "is-off"}">
    <div class="notif-card-head">
      <div class="summary-card-title" style="margin:0">${ic(icon)} ${title}</div>
      <label class="stock-toggle"><input type="checkbox" ${c.enabled ? "checked" : ""} data-action="toggle-notif-channel" data-ch="${ch}" ${dis} /><span>${c.enabled ? "On" : "Off"}</span></label>
    </div>
    ${c.enabled ? `
    <form data-action="save-notif-channel" data-ch="${ch}">
      <div class="notif-mode">
        <label><input type="radio" name="mode" value="default" ${c.mode === "default" ? "checked" : ""} data-action="set-notif-mode" data-ch="${ch}" ${dis} /> Use QuickKart's shared provider</label>
        <label><input type="radio" name="mode" value="own" ${c.mode === "own" ? "checked" : ""} data-action="set-notif-mode" data-ch="${ch}" ${dis} /> Use our own account</label>
      </div>
      ${c.mode === "own" ? ownFields(c, dis) : `<div class="qk-muted small" style="margin:8px 0">${defaultText(c, dis)}</div>`}
      ${editable ? `<div class="form-actions"><button type="button" class="btn btn-outline" data-action="test-notif-channel" data-ch="${ch}">Send test</button><button type="submit" class="btn btn-primary">Save ${title.toLowerCase()}</button></div>` : ""}
    </form>` : `<div class="qk-muted small">Off — nothing is sent by ${title.toLowerCase()}, whatever the templates say.</div>`}
  </div>`;
}
function notifChannelsHTML(editable) {
  const val = (v) => esc(v == null ? "" : v);
  return `
  <div class="notif-grid">
    ${notifChannelCard("email", "Email", "receipt", editable, (c, dis) => `
      <div class="field-grid-2">
        <label class="field"><span class="field-label">SMTP host *</span><input class="input" name="host" value="${val(c.host)}" placeholder="smtp.yourdomain.sg" ${dis} /></label>
        <label class="field"><span class="field-label">Port *</span><input class="input" type="number" name="port" value="${val(c.port)}" ${dis} /></label>
      </div>
      <div class="field-grid-2">
        <label class="field"><span class="field-label">Security</span><select class="input" name="security" ${dis}>${["STARTTLS", "SSL/TLS", "None"].map((s) => `<option ${c.security === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label class="field"><span class="field-label">Username *</span><input class="input" name="username" value="${val(c.username)}" autocomplete="off" ${dis} /></label>
      </div>
      ${secretField("password", "Password *", c.passwordSet)}
      <div class="field-grid-2">
        <label class="field"><span class="field-label">From name *</span><input class="input" name="fromName" value="${val(c.fromName)}" ${dis} /></label>
        <label class="field"><span class="field-label">From email *</span><input class="input" type="email" name="fromEmail" value="${val(c.fromEmail)}" placeholder="orders@yourdomain.sg" ${dis} /></label>
      </div>
      <label class="field"><span class="field-label">Reply-to email</span><input class="input" type="email" name="replyTo" value="${val(c.replyTo)}" ${dis} /></label>`,
    (c, dis) => `Sent from <b>no-reply@quickkart.sg</b> with your business name as the sender name.
      <label class="field" style="margin-top:8px"><span class="field-label">Sender name</span><input class="input" name="fromName" value="${val(c.fromName)}" ${dis} /></label>`)}
    ${notifChannelCard("sms", "SMS", "phone", editable, (c, dis) => `
      <label class="field"><span class="field-label">Provider *</span><select class="input" name="provider" ${dis}>${SMS_PROVIDERS.map((p) => `<option ${c.provider === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
      <label class="field"><span class="field-label">Account SID / API key *</span><input class="input" name="accountId" value="${val(c.accountId)}" autocomplete="off" ${dis} /></label>
      ${secretField("token", "Auth token / API secret *", c.tokenSet)}
      <label class="field"><span class="field-label">Sender ID or number * <span class="qk-muted small">(up to 11 letters, or a number)</span></span><input class="input" name="senderId" maxlength="15" value="${val(c.senderId)}" ${dis} /></label>`,
    (c, dis) => `Sent through QuickKart's SMS account. Login codes (OTP) always go by SMS.
      <label class="field" style="margin-top:8px"><span class="field-label">Sender ID</span><input class="input" name="senderId" maxlength="11" value="${val(c.senderId)}" ${dis} /></label>`)}
    ${notifChannelCard("push", "Push notifications", "bell", editable, (c, dis) => `
      <div class="notice notice-warn" style="margin-bottom:10px">${ic("alert")}<span>Your own Firebase (FCM) project only works if your customers use <b>your own branded app build</b> registered to that project. With the shared QuickKart app, keep the shared provider.</span></div>
      <div class="field-grid-2">
        <label class="field"><span class="field-label">Firebase project ID *</span><input class="input" name="projectId" value="${val(c.projectId)}" ${dis} /></label>
        <label class="field"><span class="field-label">Sender ID</span><input class="input" name="senderId" value="${val(c.senderId)}" ${dis} /></label>
      </div>
      <label class="field"><span class="field-label">Service account key (JSON) *</span>
        <input class="input" type="file" accept=".json,application/json" data-action="notif-sa-file" ${dis} />
        <span class="qk-muted small">${c.serviceAccountSet ? `Saved (${esc(c.serviceAccountFile || "service-account.json")}) — upload a new file to replace it.` : "Not uploaded yet."}${UI.pendingSaFile ? ` Ready to save: <b>${esc(UI.pendingSaFile)}</b>` : ""}</span>
      </label>
      <label class="field"><span class="field-label">Web push key (VAPID public key)</span><input class="input" name="vapidKey" value="${val(c.vapidKey)}" ${dis} /></label>`,
    () => `Sent through the QuickKart app's Firebase project. Nothing to set up.`)}
  </div>`;
}
function notifTemplatesHTML(editable) {
  const cfg = State.notificationConfig;
  return `
  <div class="qk-muted small" style="margin-bottom:10px">Choose which channels each message uses and edit the wording. <code>{{placeholders}}</code> are filled in when the message is sent.</div>
  <div class="admin-table">
    ${State.notificationTemplates.map((t) => `
      <div class="admin-row">
        <div class="admin-row-info"><div class="admin-row-name">${esc(t.name)} <span class="badge badge-gray-soft">${esc(t.audience)}</span></div><div class="qk-muted small">${esc(t.body.slice(0, 110))}${t.body.length > 110 ? "…" : ""}</div></div>
        ${["email", "sms", "push"].map((ch) => `<span class="badge badge-${t.channels[ch] && cfg[ch].enabled ? "green" : "gray"}-soft" title="${cfg[ch].enabled ? "" : "Channel is off"}">${ch === "sms" ? "SMS" : ch[0].toUpperCase() + ch.slice(1)}${t.channels[ch] ? "" : " ✕"}</span>`).join("")}
        ${editable ? `<button class="icon-btn" data-action="edit-template" data-key="${t.key}" aria-label="Edit">${ic("edit")}</button>` : ""}
      </div>`).join("")}
  </div>`;
}
function fillPlaceholders(text) {
  const sample = { customerName: "Priya", orderNo: "QK00123", amount: "S$42.50", storeName: "QuickKart Tampines", otp: "482913", eta: "6:40 PM", itemName: "Fresh Milk 1L", slot: "6:00 PM – 8:00 PM", businessName: State.companyProfile.tradingAs || "QuickKart" };
  return String(text || "").replace(/\{\{(\w+)\}\}/g, (m, k) => (k in sample ? sample[k] : m));
}
function templateFormModal() {
  const t = UI.modal.form;
  const cfg = State.notificationConfig;
  const locked = t.locked || [];
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static dialog-user" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>${esc(t.name)}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <form class="dialog-body" data-action="save-template">
        <span class="field-label">Send by</span>
        <div class="filter-pill-row" style="margin:6px 0 12px">
          ${["email", "sms", "push"].map((ch) => `<label class="checklist-item"><input type="checkbox" name="ch_${ch}" ${t.channels[ch] ? "checked" : ""} ${locked.includes(ch) ? "disabled" : ""} /><span>${ch === "sms" ? "SMS" : ch[0].toUpperCase() + ch.slice(1)}${cfg[ch].enabled ? "" : " (channel off)"}${locked.includes(ch) ? " — required" : ""}</span></label>`).join("")}
        </div>
        <label class="field"><span class="field-label">Email subject / push title</span><input class="input" name="subject" value="${esc(t.subject)}" /></label>
        <label class="field"><span class="field-label">Message</span><textarea class="input" name="body" rows="4" oninput="onTemplateBodyInput(this.value)">${esc(t.body)}</textarea></label>
        <div class="qk-muted small">Placeholders: ${NOTIFICATION_PLACEHOLDERS.map((p) => `<code>{{${p}}}</code>`).join(" ")}</div>
        <div class="template-preview"><div class="qk-muted small" style="font-weight:700">Preview</div><div id="templatePreview">${esc(fillPlaceholders(t.body))}</div></div>
        ${UI.modal.error ? `<div class="field-error">${esc(UI.modal.error)}</div>` : ""}
        <div class="form-actions">
          <button type="button" class="btn btn-outline" data-action="reset-template" data-key="${t.key}">Reset to default</button>
          <button type="submit" class="btn btn-primary">Save message</button>
        </div>
      </form>
    </div>
  </div>`;
}
function onTemplateBodyInput(v) { const el = document.getElementById("templatePreview"); if (el) el.textContent = fillPlaceholders(v); }

/* ---------------- 15. Business Settings additions ---------------- */
function adminExpressCard(editable) {
  const d = State.deliverySettings;
  return `
  <div class="summary-card" style="max-width:420px; margin-top:16px">
    <div class="summary-card-title">Express Delivery</div>
    <div class="qk-muted small">Express = "as soon as possible" delivery (it used to be called "Deliver at your convenience"). The charge is added <b>on top of</b> the delivery fee and is not waived by free delivery or a free-delivery coupon. When it's off, customers can only schedule a slot.</div>
    <label class="stock-toggle-lg" style="margin-top:10px"><input type="checkbox" id="expressEnabledInput" ${d.expressEnabled !== false ? "checked" : ""} ${editable ? "" : "disabled"} /><span>Offer Express Delivery</span></label>
    <label class="field"><span class="field-label">Express charge (S$)</span><input class="input" id="expressChargeInput" type="number" min="0" step="0.1" value="${d.expressCharge}" ${editable ? "" : "disabled"} /></label>
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-express">Save</button>` : ""}
  </div>
  <div class="summary-card" style="max-width:420px; margin-top:16px">
    <div class="summary-card-title">Delivery Slots</div>
    <div class="qk-muted small">Slot times, how many orders each slot takes, and per-day overrides now have their own screen.</div>
    <button class="btn btn-outline btn-block" style="margin-top:10px" data-action="admin-tab" data-tab="slots">${ic("clock")} Open Delivery Slots</button>
  </div>`;
}
function adminStockRulesPanel(editable) {
  const allow = allowNegativeStock();
  const negLines = State.branches.reduce((n, b) => n + State.items.filter((i) => (storeQty(b.id, i.id) || 0) < 0).length, 0);
  return `
  <div class="summary-card" style="max-width:560px">
    <div class="summary-card-title">When stock runs out</div>
    <label class="radio-card ${!allow ? "active" : ""}"><input type="radio" name="negStock" value="off" ${!allow ? "checked" : ""} ${editable ? "" : "disabled"} />
      <span><b>Don't allow negative stock</b> <span class="badge badge-green-soft">Recommended</span><br><span class="qk-muted small">A product shows <b>Out of stock</b> once no store has any left. An order always goes to the nearest store; if that store is short, its stock stops at zero and the order is flagged <b>Short</b> so the store can transfer the item from a nearby store or mark it unavailable.</span></span></label>
    <label class="radio-card ${allow ? "active" : ""}"><input type="radio" name="negStock" value="on" ${allow ? "checked" : ""} ${editable ? "" : "disabled"} />
      <span><b>Allow negative stock</b><br><span class="qk-muted small">Customers can keep ordering after stock reaches zero. The nearest store's quantity goes below zero (shown in red in Stock) and the order is flagged <b>Short</b>. Only a product you switch off shows Out of stock.</span></span></label>
    ${negLines ? `<div class="notice notice-warn" style="margin-top:10px">${ic("alert")}<span>${negLines} product/store line(s) are below zero right now.</span></div>` : ""}
    ${editable ? `<button class="btn btn-primary btn-block" style="margin-top:12px" data-action="save-stock-rules">Save</button>` : ""}
  </div>`;
}

/* ---------------- 16. Admin ▸ Routes (pending team discussion) ---------------- */
function adminRoutesTBD() {
  // Routes are pending a team discussion — nothing is designed yet.
  return `
  <div class="empty-state">
    <div class="empty-title">Need to be discussed</div>
  </div>`;
}
/* ---------------- 18. What's changed (for the frontend team) ---------------- */
const WHATS_NEW = [
  { area: "Admin panel — sidebar (round 2)", items: [
    ["Grouped sidebar", "Dashboard, Orders and Reports stay on top. Everything else sits in groups that open and close: Masters (Catalogue, Categories, Brands, Stock, Suppliers, Customers), Delivery Masters (Delivery Slots, Delivery Partners, Routes), Marketing (Promotions, Coupons, Home Screen) and Setup (Business Settings, Stores, Users & Roles, Notifications). The group of the open screen opens by itself; the page title shows the path, e.g. Masters › Stock. A group only appears if the user can see a screen in it."],
    ["Renamed", "Inventory → Stock · Catalog → Catalogue · Partners → Delivery Partners · Business Settings tab 'Inventory & Stock' → 'Stock Rules'."],
  ] },
  { area: "Admin panel", items: [
    ["Users & Roles", "Change a user's role straight from the Users list (role dropdown on each row) and filter users by role. Create custom roles (e.g. Picker / Packer, Inventory Manager) under Roles & Permissions, rename or delete them."],
    ["Dashboard", "Sales insights block: Top selling categories (tap one to see its top items) and Peak hours — orders per hour plus admin-defined time sections (Edit time sections). Range: today / 7 / 30 days. Exportable."],
    ["Orders", "Every status tab shows its count, e.g. All (120), New (15). Counts follow the store scope. Export to Excel/CSV follows the current filters."],
    ["Delivery Masters ▸ Delivery Slots", "Slot times with a capacity (orders per slot per store), days bookable ahead and an order cut-off. Per store and day: booked/capacity with a fill bar, override one day's capacity, close/reopen a slot, add a one-off slot, see and move the orders in a slot."],
    ["Delivery Masters ▸ Routes", "Placeholder only — needs to be discussed with the team. Nothing is designed yet."],
    ["Store serviceability", "No geofencing: a store delivers inside its radius (unchanged). Checkout is blocked when no store's radius covers the address."],
    ["Express Delivery", "Setup ▸ Business Settings ▸ Delivery & Payments: switch Express on/off and set its charge."],
    ["Stock Rules", "Setup ▸ Business Settings ▸ Stock Rules: allow or block negative stock (default: blocked)."],
    ["Masters ▸ Stock (reworked)", "Category → Product → per-store stock. Stock changes only through Receive (with supplier, unit cost, delivery order no.), Adjust (stock take / damaged / expired / correction) and Transfer between stores; every change is in Stock history. Low stock uses each product's reorder level. Stock value at cost."],
    ["Masters ▸ Catalogue", "Products now carry SKU, barcode, cost price (with margin), supplier and reorder level. Quantities are no longer typed on the product — new products start at 0 in every store."],
    ["Masters ▸ Suppliers (new)", "Supplier list with code, contact, UEN, payment terms, lead time; used when receiving stock."],
    ["Bulk import", "Import Categories, Products, Stock (counts per store) and Suppliers from Excel or CSV: download the template, upload, preview every row (new / update / error), then confirm. Products match by SKU."],
    ["Export", "Excel and CSV export on Orders, Customers, Catalogue, Categories, Brands, Stock, Stock history, Suppliers, Users, Delivery Partners, Coupons, Delivery Slots and the Dashboard insights."],
    ["Setup ▸ Notifications (new)", "Business-wide (all stores) channel settings: Email (SMTP), SMS (provider, keys, sender ID), Push (FCM). Each channel on/off, shared QuickKart provider or own account, send test. Secrets are write-only. Message templates per event with channel choice, wording, placeholders and preview."],
  ] },
  { area: "Customer app", items: [
    ["Checkout — Express", "'Deliver at your convenience' is now 'Express delivery' with its charge shown on the button and as its own bill line. Hidden when the business switches it off."],
    ["Checkout — slots", "Dated slots for the store that will deliver, coloured by how full they are: Available (green), Filling fast (amber), Almost full (red); Full / closed / past cut-off slots are greyed out and can't be picked."],
    ["Checkout — stock", "The order always goes to the nearest store that delivers to the address; checkout is never blocked for stock. If that store is short, the order is flagged Short for the store to handle (see round 5). 'Only N left' is no longer shown on product cards."],
    ["Cart", "The 'Send order on WhatsApp' button is removed."],
    ["Bill & invoice", "New 'Express delivery charge' line on the cart, checkout and tax invoice."],
  ] },
];
function whatsNewModal() {
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static dialog-invoice" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>What's changed — September 2026</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <div class="dialog-body whats-new">
        <div class="qk-muted small" style="margin-bottom:12px">Changes asked for by the directors. Log in as Admin or Customer to try each one.</div>
        ${WHATS_NEW.map((g) => `
          <h3>${esc(g.area)}</h3>
          ${g.items.map(([t, d]) => `<div class="wn-item"><b>${esc(t)}</b><div class="qk-muted small">${esc(d)}</div></div>`).join("")}`).join("")}
      </div>
    </div>
  </div>`;
}

/* ---------------- 19. Export (Excel via SheetJS, CSV built in) ---------------- */
const XLSX_CDN = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
let xlsxLoading = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxLoading) {
    xlsxLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = XLSX_CDN;
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => { xlsxLoading = null; reject(new Error("Excel library failed to load")); };
      document.head.appendChild(s);
    });
  }
  return xlsxLoading;
}
function exportButtonsHTML(key) {
  return `<span class="export-group"><button type="button" class="btn btn-outline btn-sm" data-action="export-data" data-key="${key}" data-format="xlsx" title="Download as Excel">${ic("receipt")} Excel</button><button type="button" class="btn btn-outline btn-sm" data-action="export-data" data-key="${key}" data-format="csv" title="Download as CSV">CSV</button></span>`;
}
// Text that starts with = + - @ is prefixed so a spreadsheet never runs it as a formula.
function safeCell(v) { return typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v; }
function toCsv(aoa) {
  const cell = (v) => { if (v == null) return ""; const s = String(safeCell(v)); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "﻿" + aoa.map((r) => r.map(cell).join(",")).join("\r\n");
}
function downloadText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadSheet(base, sheetName, aoa, format) {
  if (format !== "xlsx") { downloadText(`${base}.csv`, toCsv(aoa), "text/csv;charset=utf-8"); showToast(`Downloaded ${base}.csv`); return; }
  loadXlsx().then((X) => {
    const ws = X.utils.aoa_to_sheet(aoa.map((r) => r.map(safeCell)));
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    X.writeFile(wb, `${base}.xlsx`);
    showToast(`Downloaded ${base}.xlsx`);
  }).catch(() => { downloadText(`${base}.csv`, toCsv(aoa), "text/csv;charset=utf-8"); showToast("Excel library couldn't load — downloaded CSV instead", "danger"); });
}
function visibleAdminOrders() {
  const branchIds = scopedBranchIds();
  return State.orders
    .filter((o) => !branchIds || branchIds.includes(o.branchId))
    .filter((o) => UI.adminOrderFilter === "all" || o.status === UI.adminOrderFilter)
    .filter((o) => !UI.adminOrderQuery || o.id.toLowerCase().includes(UI.adminOrderQuery.toLowerCase()) || o.customerName.toLowerCase().includes(UI.adminOrderQuery.toLowerCase()))
    .slice().sort((a, b) => b.createdAt - a.createdAt);
}
const EXPORTS = {
  orders: () => ({ name: "orders", columns: ["Order no", "Date", "Customer", "Mobile", "Store", "Fulfilment", "Status", "Items", "Item total", "Delivery fee", "Express charge", "Coupon discount", "Wallet used", "Total", "Payment", "Slot"],
    rows: visibleAdminOrders().map((o) => [o.id, fmtDateTime(o.createdAt), o.customerName, o.contactMobile || "", (findBranch(o.branchId) || {}).name || "", o.fulfillment === "pickup" ? "Pickup" : "Delivery", STATUS_META[o.status].label, o.items.reduce((n, i) => n + i.qty, 0), round2(o.itemTotal != null ? o.itemTotal : o.items.reduce((s, i) => s + i.price * i.qty, 0)), round2(o.deliveryFee), round2(o.expressCharge), round2(o.couponDiscount), round2(o.walletApplied), round2(o.total), o.paymentMethod, o.scheduledSlot || (o.deliverySpeed === "express" ? "Express" : "")]) }),
  customers: () => ({ name: "customers", columns: ["Name", "Mobile", "Orders", "Total spent", "First order", "Last order"],
    rows: customersFromOrders().map((c) => [c.name, c.mobile, c.orderCount, round2(c.totalSpent), fmtDate(c.firstOrderAt), fmtDate(c.lastOrderAt)]) }),
  catalog: () => ({ name: "products", columns: ["SKU", "Name", "Category", "Brand", "Unit", "MRP", "Price", "Cost price", "Margin %", "Supplier code", "Reorder level", "Barcode", "Active"],
    rows: State.items.map((i) => [i.sku, i.name, i.cat, i.brand || "", i.unit, round2(i.mrp), round2(i.price), round2(i.costPrice), i.price ? Math.round(((i.price - (i.costPrice || 0)) / i.price) * 1000) / 10 : 0, (State.suppliers.find((s) => s.id === i.supplierId) || {}).code || "", i.reorderLevel || 0, i.barcode || "", i.stock ? "yes" : "no"]) }),
  categories: () => ({ name: "categories", columns: ["Name", "Products", "Image URL"], rows: State.categories.map((c) => [c.name, State.items.filter((i) => i.cat === c.name).length, c.image]) }),
  brands: () => ({ name: "brands", columns: ["Name", "Products"], rows: State.brands.map((b) => [b.name, State.items.filter((i) => i.brand === b.name).length]) }),
  inventory: () => {
    const ids = scopedBranchIds();
    const stores = ids ? State.branches.filter((b) => ids.includes(b.id)) : State.branches;
    const rows = [];
    stores.forEach((b) => State.items.forEach((i) => { const q = storeQty(b.id, i.id); rows.push([b.name, i.sku, i.name, i.cat, q == null ? "" : q, i.reorderLevel || 0, stockStatus(b.id, i).label, round2(i.costPrice), round2(Math.max(q || 0, 0) * (i.costPrice || 0))]); }));
    return { name: "inventory", columns: ["Store", "SKU", "Product", "Category", "On hand", "Reorder level", "Status", "Cost price", "Stock value"], rows };
  },
  stockHistory: () => {
    const ids = scopedBranchIds();
    return { name: "stock-history", columns: ["Date", "Store", "SKU", "Product", "Movement", "Qty", "Balance", "Unit cost", "Reference", "Note", "By"],
      rows: State.stockMoves.filter((m) => !ids || ids.includes(m.branchId)).map((m) => { const i = findItem(m.itemId) || {}; return [fmtDateTime(m.at), (findBranch(m.branchId) || {}).name || "", i.sku || "", i.name || "", (STOCK_MOVE_TYPES[m.type] || {}).label || m.type, m.qty, m.balance, m.unitCost == null ? "" : round2(m.unitCost), m.ref, m.note, m.by]; }) };
  },
  suppliers: () => ({ name: "suppliers", columns: ["Code", "Name", "Contact person", "Phone", "Email", "Address", "UEN", "Payment terms", "Lead time days", "Active", "Products"],
    rows: State.suppliers.map((s) => [s.code, s.name, s.contactPerson, s.phone, s.email, s.address, s.uen, s.paymentTerms, s.leadTimeDays, s.active === false ? "no" : "yes", State.items.filter((i) => i.supplierId === s.id).length]) }),
  users: () => ({ name: "users", columns: ["Name", "Email", "Mobile", "Role", "Stores", "Status"],
    rows: State.users.map((u) => [u.name, u.email || "", u.mobile || "", (findRole(u.roleId) || {}).name || "", isSuperAdmin(u) ? "All stores" : userStoreIds(u).map((id) => (findBranch(id) || {}).name).filter(Boolean).join(", "), u.active === false ? "Inactive" : "Active"]) }),
  partners: () => ({ name: "delivery-partners", columns: ["Code", "Name", "Mobile", "Email", "Vehicle", "Store", "Status", "Deliveries"],
    rows: State.partners.map((p) => [p.code, p.name, p.mobile, p.email || "", p.vehicle || "", (findBranch(p.branchId) || {}).name || "", p.active === false ? "Inactive" : "Active", State.orders.filter((o) => o.deliveryPartnerId === p.id && o.status === "delivered").length]) }),
  coupons: () => ({ name: "coupons", columns: ["Code", "Type", "Value", "Min order", "Max discount", "Status", "Expires"],
    rows: State.coupons.map((c) => [c.code, c.type, c.value, c.minOrder || 0, c.maxDiscount || "", c.enabled ? "Live" : "Paused", c.expiresAt ? fmtDate(c.expiresAt) : "No expiry"]) }),
  slots: () => {
    const ids = scopedBranchIds();
    const stores = ids ? State.branches.filter((b) => ids.includes(b.id)) : State.branches;
    const rows = [];
    stores.forEach((b) => slotDays().forEach((d) => slotsFor(b.id, d.date).forEach((s) => { const inf = slotInfo(b.id, d.date, s); rows.push([b.name, d.date, d.label, fmtSlotRange(s), inf.cap, inf.overridden ? "yes" : "no", inf.booked, Math.round(inf.fill), SLOT_LEVEL_LABEL[inf.level]]); })));
    return { name: "delivery-slots", columns: ["Store", "Date", "Day", "Slot", "Capacity", "Overridden", "Booked", "Fill %", "Status"], rows };
  },
  dashboard: () => {
    const ids = scopedBranchIds();
    const dr = dashRange();
    const orders = State.orders.filter((o) => (!ids || ids.includes(o.branchId)) && o.status !== "cancelled" && inRange(o.createdAt, dr.range));
    const rows = [];
    const byCat = {}; const byItem = {};
    orders.forEach((o) => o.items.forEach((it) => { const cat = (findItem(it.id) || {}).cat || "Other"; byCat[cat] = byCat[cat] || [0, 0]; byCat[cat][0] += it.qty; byCat[cat][1] += it.qty * it.price; const k = `${cat}|${it.name}`; byItem[k] = byItem[k] || [0, 0]; byItem[k][0] += it.qty; byItem[k][1] += it.qty * it.price; }));
    Object.entries(byCat).sort((a, b) => b[1][1] - a[1][1]).forEach(([c, v]) => rows.push(["Category", c, "", v[0], round2(v[1])]));
    Object.entries(byItem).sort((a, b) => b[1][0] - a[1][0]).forEach(([k, v]) => { const [c, n] = k.split("|"); rows.push(["Item", n, c, v[0], round2(v[1])]); });
    for (let h = 0; h < 24; h++) { const list = orders.filter((o) => new Date(o.createdAt).getHours() === h); rows.push(["Hour", `${fmtHour(h)}–${fmtHour(h + 1)}`, "", list.length, round2(list.reduce((s, o) => s + o.total, 0))]); }
    return { name: "sales-insights", columns: ["Type", "Name", "Category", "Qty / orders", "Sales"], rows };
  },
};
function exportData(key, format) {
  const def = EXPORTS[key] && EXPORTS[key]();
  if (!def) return;
  downloadSheet(`quickkart-${def.name}-${isoDate(new Date())}`, def.name, [def.columns, ...def.rows], format);
}

/* ---------------- 20. Bulk import (Excel or CSV → preview → confirm) ---------------- */
const str = (v) => (v == null ? "" : String(v)).trim();
const num = (v) => { const s = str(v); if (s === "") return null; const n = Number(s.replace(/[$,S]/g, "")); return Number.isFinite(n) ? n : NaN; };
const IMPORT_DEFS = {
  categories: {
    label: "Categories", columns: ["name*", "image_url"], sample: [["Frozen Desserts", "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300"]],
    notes: "Matches an existing category by name (updates its image) or adds a new one.",
    plan(rows) {
      const seen = new Set();
      return rows.map((r) => {
        const name = str(r.name);
        if (!name) return { label: "(blank)", status: "error", message: "name is required" };
        if (seen.has(name.toLowerCase())) return { label: name, status: "error", message: "duplicate name in the file" };
        seen.add(name.toLowerCase());
        const existing = State.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
        const image = str(r.image_url);
        return { label: name, status: existing ? "update" : "new", apply: () => {
          if (existing) State.categories = State.categories.map((c) => c.id === existing.id ? { ...c, image: image || c.image } : c);
          else State.categories.push({ id: nextId(State.categories), name, image: image || img("photo-1542838132-92c53300491e", 300) });
        } };
      });
    },
    after() { persist("categories"); },
  },
  products: {
    label: "Products", columns: ["sku*", "name*", "category*", "price*", "mrp", "cost_price", "brand", "unit", "supplier_code", "reorder_level", "barcode", "active"],
    sample: [["QK-9001", "Oat Milk 1L", "Dairy & Eggs", "4.20", "4.80", "2.90", "Oatly", "1 L", "SUP-002", "12", "8881234567890", "yes"]],
    notes: "Matches by SKU: an existing SKU is updated, a new SKU is added with 0 stock in every store. The category (and supplier code, if given) must already exist.",
    plan(rows) {
      const seen = new Set();
      return rows.map((r) => {
        const sku = str(r.sku), name = str(r.name), cat = str(r.category);
        const price = num(r.price), mrp = num(r.mrp), cost = num(r.cost_price), reorder = num(r.reorder_level);
        const label = `${sku || "(no SKU)"} · ${name}`;
        const errs = [];
        if (!sku) errs.push("sku is required");
        if (!name) errs.push("name is required");
        const category = State.categories.find((c) => c.name.toLowerCase() === cat.toLowerCase());
        if (!cat) errs.push("category is required"); else if (!category) errs.push(`category "${cat}" doesn't exist — import categories first`);
        if (price == null) errs.push("price is required"); else if (Number.isNaN(price) || price < 0) errs.push("price must be a number");
        [["mrp", mrp], ["cost_price", cost], ["reorder_level", reorder]].forEach(([k, v]) => { if (Number.isNaN(v) || (v != null && v < 0)) errs.push(`${k} must be a number`); });
        const supCode = str(r.supplier_code);
        const supplier = supCode ? State.suppliers.find((s) => (s.code || "").toLowerCase() === supCode.toLowerCase()) : null;
        if (supCode && !supplier) errs.push(`supplier code "${supCode}" not found`);
        if (sku && seen.has(sku.toLowerCase())) errs.push("duplicate SKU in the file");
        seen.add(sku.toLowerCase());
        if (errs.length) return { label, status: "error", message: errs.join("; ") };
        const existing = State.items.find((i) => (i.sku || "").toLowerCase() === sku.toLowerCase());
        const active = str(r.active).toLowerCase();
        const data = { sku, name, cat: category.name, price, ...(mrp != null ? { mrp } : {}), ...(cost != null ? { costPrice: cost } : {}), ...(reorder != null ? { reorderLevel: reorder } : {}),
          ...(str(r.brand) ? { brand: str(r.brand) } : {}), ...(str(r.unit) ? { unit: str(r.unit) } : {}), ...(supplier ? { supplierId: supplier.id } : {}), ...(str(r.barcode) ? { barcode: str(r.barcode) } : {}),
          ...(active ? { stock: !["no", "false", "0", "inactive"].includes(active) } : {}) };
        return { label, status: existing ? "update" : "new", message: existing ? "" : "starts at 0 in every store", apply: () => {
          if (data.brand && !State.brands.some((b) => b.name.toLowerCase() === data.brand.toLowerCase())) { State.brands.push({ id: nextId(State.brands), name: data.brand }); persist("brands"); }
          if (existing) { State.items = State.items.map((i) => i.id === existing.id ? { ...i, ...data } : i); return; }
          const id = nextId(State.items);
          State.items.push({ id, brand: "", unit: "1 pc", mrp: price, eta: 15, stock: true, image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80&auto=format&fit=crop", stockCount: 0, bogo: false, tags: [], costPrice: 0, reorderLevel: 10, supplierId: null, barcode: "", ...data });
          State.branches.forEach((b) => setStoreQty(b.id, id, 0));
        } };
      });
    },
    after() { persist("items"); persist("branchStock"); },
  },
  inventory: {
    label: "Inventory (stock counts)", columns: ["store*", "sku*", "quantity*", "unit_cost", "note"],
    sample: [["QuickKart Tampines", "QK-0001", "48", "2.05", "Monthly stock take"]],
    notes: "Sets each store's quantity on hand to the number in the file (like a stock take). Every change is written to Stock history as 'Bulk import'.",
    plan(rows) {
      const seen = new Set();
      return rows.map((r) => {
        const storeName = str(r.store), sku = str(r.sku), qty = num(r.quantity), cost = num(r.unit_cost);
        const label = `${storeName} · ${sku}`;
        const errs = [];
        const store = State.branches.find((b) => b.name.toLowerCase() === storeName.toLowerCase() || String(b.id) === storeName);
        const item = State.items.find((i) => (i.sku || "").toLowerCase() === sku.toLowerCase());
        if (!store) errs.push(storeName ? `store "${storeName}" not found` : "store is required");
        if (!item) errs.push(sku ? `SKU "${sku}" not found — import products first` : "sku is required");
        if (qty == null || Number.isNaN(qty) || !Number.isInteger(qty)) errs.push("quantity must be a whole number");
        else if (qty < 0 && !allowNegativeStock()) errs.push("negative quantity isn't allowed (Setup ▸ Business Settings ▸ Stock Rules)");
        if (Number.isNaN(cost)) errs.push("unit_cost must be a number");
        const k = `${storeName}|${sku}`.toLowerCase();
        if (seen.has(k)) errs.push("same store and SKU twice in the file");
        seen.add(k);
        if (errs.length) return { label, status: "error", message: errs.join("; ") };
        const before = storeQty(store.id, item.id) || 0;
        return { label: `${label} (${item.name})`, status: "update", message: `${before} → ${qty}`, apply: () => {
          if (qty !== before) recordStockMove({ branchId: store.id, itemId: item.id, type: "import", qty: qty - before, unitCost: cost, note: str(r.note) });
          if (cost != null) State.items = State.items.map((i) => i.id === item.id ? { ...i, costPrice: cost } : i);
        } };
      });
    },
    after() { persist("items"); },
  },
  suppliers: {
    label: "Suppliers", columns: ["code*", "name*", "contact_person", "phone", "email", "address", "uen", "payment_terms", "lead_time_days"],
    sample: [["SUP-010", "Island Seafood Supply", "Lim Wei", "62223333", "sales@islandseafood.sg", "30 Jurong Port Rd, Singapore 619104", "201844556H", "14 days", "1"]],
    notes: "Matches by supplier code: an existing code is updated, a new code is added.",
    plan(rows) {
      const seen = new Set();
      return rows.map((r) => {
        const code = str(r.code), name = str(r.name), lead = num(r.lead_time_days);
        const label = `${code} · ${name}`;
        const errs = [];
        if (!code) errs.push("code is required");
        if (!name) errs.push("name is required");
        if (Number.isNaN(lead)) errs.push("lead_time_days must be a number");
        if (code && seen.has(code.toLowerCase())) errs.push("duplicate code in the file");
        seen.add(code.toLowerCase());
        if (errs.length) return { label, status: "error", message: errs.join("; ") };
        const existing = State.suppliers.find((s) => (s.code || "").toLowerCase() === code.toLowerCase());
        const data = { code, name, contactPerson: str(r.contact_person), phone: str(r.phone), email: str(r.email), address: str(r.address), uen: str(r.uen), paymentTerms: str(r.payment_terms) || "30 days", leadTimeDays: lead || 0 };
        return { label, status: existing ? "update" : "new", apply: () => {
          if (existing) State.suppliers = State.suppliers.map((s) => s.id === existing.id ? { ...s, ...data } : s);
          else State.suppliers.push({ id: nextId(State.suppliers), active: true, notes: "", ...data });
        } };
      });
    },
    after() { persist("suppliers"); },
  },
};
function parseCsvText(text) {
  const rows = []; let row = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}
function rowsFromAoa(aoa) {
  const [head, ...body] = aoa;
  const keys = (head || []).map((h) => String(h).replace(/^﻿/, "").replace(/\*/g, "").trim().toLowerCase().replace(/\s+/g, "_"));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] == null ? "" : r[i]])));
}
function readImportFile(file) {
  const isCsv = /\.csv$/i.test(file.name);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read the file"));
    reader.onload = () => {
      if (isCsv) { resolve(rowsFromAoa(parseCsvText(new TextDecoder().decode(reader.result)))); return; }
      loadXlsx().then((X) => {
        const wb = X.read(reader.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(rowsFromAoa(X.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false })));
      }).catch(reject);
    };
    reader.readAsArrayBuffer(file);
  });
}
function bulkImportModal() {
  const m = UI.modal;
  const def = IMPORT_DEFS[m.entity];
  const plan = m.plan;
  const counts = plan ? { new: plan.filter((p) => p.status === "new").length, update: plan.filter((p) => p.status === "update").length, error: plan.filter((p) => p.status === "error").length } : null;
  const valid = counts ? counts.new + counts.update : 0;
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static dialog-invoice" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>Bulk import</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <div class="dialog-body">
        <label class="field"><span class="field-label">What are you importing?</span>
          <select class="input" data-action="import-entity">${Object.entries(IMPORT_DEFS).map(([k, d]) => `<option value="${k}" ${m.entity === k ? "selected" : ""}>${d.label}</option>`).join("")}</select></label>
        <div class="import-step"><span class="import-step-n">1</span><div>
          <b>Download the template</b>
          <div class="qk-muted small">Columns: ${def.columns.map((c) => c.endsWith("*") ? `<b>${esc(c.slice(0, -1))}</b>*` : esc(c)).join(", ")} (* required). ${esc(def.notes)}</div>
          <div class="filter-pill-row" style="margin-top:6px"><button type="button" class="btn btn-outline btn-sm" data-action="import-template" data-format="xlsx">Excel template</button><button type="button" class="btn btn-outline btn-sm" data-action="import-template" data-format="csv">CSV template</button></div>
        </div></div>
        <div class="import-step"><span class="import-step-n">2</span><div>
          <b>Upload your file</b> <span class="qk-muted small">(.xlsx or .csv — first sheet, first row = column names)</span>
          <input class="input" type="file" accept=".csv,.xlsx,.xls" data-action="import-file" style="margin-top:6px" />
          ${m.loading ? `<div class="qk-muted small">Reading ${esc(m.fileName)}…</div>` : m.fileError ? `<div class="field-error">${esc(m.fileError)}</div>` : m.fileName ? `<div class="qk-muted small">${esc(m.fileName)} · ${plan.length} row(s)</div>` : ""}
        </div></div>
        ${plan ? `
        <div class="import-step"><span class="import-step-n">3</span><div style="flex:1;min-width:0">
          <b>Check the preview</b>
          <div class="filter-pill-row" style="margin:6px 0"><span class="badge badge-green-soft">${counts.new} new</span><span class="badge badge-blue-soft">${counts.update} update</span><span class="badge badge-red-soft">${counts.error} with errors (skipped)</span></div>
          <div class="import-preview">
            ${plan.slice(0, 300).map((p, i) => `<div class="import-row"><span class="qk-muted">Row ${i + 2}</span><span>${esc(p.label)}</span><span class="badge badge-${p.status === "error" ? "red" : p.status === "new" ? "green" : "blue"}-soft">${p.status === "error" ? "Error" : p.status === "new" ? "New" : "Update"}</span><span class="small ${p.status === "error" ? "tone-red" : "qk-muted"}">${esc(p.message || "")}</span></div>`).join("")}
          </div>
        </div></div>` : ""}
        <div class="form-actions">
          <button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button>
          <button type="button" class="btn btn-primary" data-action="confirm-import" ${valid ? "" : "disabled"}>Import ${valid} row${valid === 1 ? "" : "s"}</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------------- 21. Modal routing for the new modals ---------------- */
function extraModal(type) {
  switch (type) {
    case "roleForm": return roleFormModal();
    case "stockMove": return stockMoveModal();
    case "supplierForm": return supplierFormModal();
    case "peakSections": return peakSectionsModal();
    case "templateForm": return templateFormModal();
    case "bulkImport": return bulkImportModal();
    case "whatsNew": return whatsNewModal();
    case "customerModal": return customerModal(); // Round 3
    default: return "";
  }
}

/* ---------------- 22. Click / change handlers ---------------- */
function readSlotTemplateForm() {
  const form = document.querySelector('form[data-action="save-slot-templates"]');
  if (!form) return State.slotSettings.templates;
  const fd = new FormData(form);
  return State.slotSettings.templates.map((t, i) => ({ ...t, start: fd.get(`start_${i}`) || t.start, end: fd.get(`end_${i}`) || t.end, capacity: Math.max(0, Number(fd.get(`cap_${i}`)) || 0) }));
}
function readPeakRows() {
  const form = document.querySelector('form[data-action="save-peak-sections"]');
  if (!form) return UI.modal.rows;
  const fd = new FormData(form);
  return UI.modal.rows.map((r, i) => ({ ...r, name: fd.get(`name_${i}`), start: Number(fd.get(`start_${i}`)), end: Number(fd.get(`end_${i}`)) }));
}
function saveSlotSettings(patch) { State.slotSettings = { ...State.slotSettings, ...patch }; persist("slotSettings"); }
Object.assign(Actions, {
  "open-whats-new"() { UI.modal = { type: "whatsNew" }; render(); },
  "pick-store-scope"(el) { UI.adminBranchScope = el.dataset.id; render(); },
  "export-data"(el) { exportData(el.dataset.key, el.dataset.format); },
  // Delivery slots
  "add-slot-template"() { saveSlotSettings({ templates: [...readSlotTemplateForm(), { id: `s${Date.now()}`, start: "12:00", end: "14:00", capacity: 15 }] }); render(); },
  "remove-slot-template"(el) {
    const list = readSlotTemplateForm();
    if (list.length <= 1) { showToast("Keep at least one slot time", "danger"); return; }
    list.splice(Number(el.dataset.idx), 1); saveSlotSettings({ templates: list }); render();
  },
  "set-slot-override"(el) {
    const overrides = { ...State.slotSettings.overrides };
    if (el.value === "") delete overrides[el.dataset.key]; else overrides[el.dataset.key] = Math.max(0, Math.floor(Number(el.value) || 0));
    saveSlotSettings({ overrides }); showToast("Capacity for this slot on this day updated"); render();
  },
  "clear-slot-override"(el) { const overrides = { ...State.slotSettings.overrides }; delete overrides[el.dataset.key]; saveSlotSettings({ overrides }); render(); },
  "toggle-slot-closed"(el) { const closed = { ...State.slotSettings.closed }; if (closed[el.dataset.key]) delete closed[el.dataset.key]; else closed[el.dataset.key] = true; saveSlotSettings({ closed }); render(); },
  "remove-extra-slot"(el) {
    const k = `${el.dataset.store}|${el.dataset.date}`;
    saveSlotSettings({ extras: { ...State.slotSettings.extras, [k]: (State.slotSettings.extras[k] || []).filter((s) => s.id !== el.dataset.id) } }); render();
  },
  "toggle-slot-orders"(el) { UI.openSlotKey = UI.openSlotKey === el.dataset.key ? null : el.dataset.key; render(); },
  "move-slot-order"(el) {
    const to = el.value; if (!to) return;
    const o = State.orders.find((x) => x.id === el.dataset.id); if (!o) return;
    const from = o.slotKey;
    State.slotBookings = { ...State.slotBookings, [from]: Math.max((State.slotBookings[from] || 0) - 1, 0), [to]: (State.slotBookings[to] || 0) + 1 };
    State.orders = State.orders.map((x) => x.id === o.id ? { ...x, slotKey: to, scheduledSlot: slotLabelFromKey(to) } : x);
    persist("slotBookings"); persist("orders"); showToast(`#${o.id} moved to ${slotLabelFromKey(to)}`); render();
  },
  // Dashboard
  "dash-range"(el) { UI.dashRange = el.dataset.range; render(); },
  "dash-open-cat"(el) { UI.dashOpenCat = UI.dashOpenCat === el.dataset.cat ? null : el.dataset.cat; render(); },
  "edit-peak-sections"() { UI.modal = { type: "peakSections", rows: deepClone(State.peakSections) }; render(); },
  "add-peak-row"() { UI.modal.rows = [...readPeakRows(), { id: Date.now(), name: "New section", start: 0, end: 1 }]; render(); },
  "remove-peak-row"(el) { const rows = readPeakRows(); rows.splice(Number(el.dataset.idx), 1); UI.modal.rows = rows; render(); },
  // Users & roles
  "user-role-filter"(el) { UI.userRoleFilter = el.dataset.role; render(); },
  "change-user-role"(el) {
    const u = findUser(Number(el.dataset.id)); const roleId = el.value;
    if (!u || u.roleId === roleId) return;
    if (isSuperAdmin(u) && State.users.filter((x) => isSuperAdmin(x) && x.active !== false).length <= 1) { showToast("Can't change the last active Super Admin", "danger"); render(); return; }
    State.users = State.users.map((x) => x.id === u.id ? { ...x, roleId, permissionOverrides: {}, storeIds: roleId === ROLE_SUPER_ADMIN ? [] : x.storeIds } : x);
    persist("users"); showToast(`${u.name} is now ${findRole(roleId).name}${Object.keys(u.permissionOverrides || {}).length ? " — personal overrides cleared" : ""}`); render();
  },
  "new-role"() { UI.modal = { type: "roleForm" }; render(); },
  "delete-role"(el) {
    const r = findRole(el.dataset.role);
    if (!r || r.isSystem || State.users.some((u) => u.roleId === r.id)) return;
    if (!window.confirm(`Delete the role "${r.name}"?`)) return;
    State.roles = State.roles.filter((x) => x.id !== r.id); persist("roles"); showToast(`${r.name} deleted`); render();
  },
  // Inventory
  "inv-tab"(el) { UI.invTab = el.dataset.tab; render(); },
  "inv-filter"(el) { UI.invFilter = el.dataset.filter; render(); },
  "open-stock-move"(el) { UI.modal = { type: "stockMove", mode: el.dataset.mode, branchId: Number(el.dataset.branch), itemId: el.dataset.id ? Number(el.dataset.id) : null }; render(); },
  // Suppliers
  "new-supplier"() { UI.modal = { type: "supplierForm", form: { code: `SUP-${String(nextId(State.suppliers)).padStart(3, "0")}`, name: "", paymentTerms: "30 days", leadTimeDays: 2, active: true } }; render(); },
  "edit-supplier"(el) { UI.modal = { type: "supplierForm", form: { ...State.suppliers.find((s) => s.id === Number(el.dataset.id)) } }; render(); },
  "delete-supplier"(el) {
    const s = State.suppliers.find((x) => x.id === Number(el.dataset.id));
    const used = State.items.filter((i) => i.supplierId === s.id).length;
    if (used) { showToast(`${s.name} supplies ${used} product(s) — change their supplier or mark it inactive instead`, "danger"); return; }
    if (!window.confirm(`Delete ${s.name}?`)) return;
    State.suppliers = State.suppliers.filter((x) => x.id !== s.id); persist("suppliers"); render();
  },
  // Notifications
  "notif-tab"(el) { UI.notifTab = el.dataset.tab; render(); },
  "toggle-notif-channel"(el) {
    const ch = el.dataset.ch;
    State.notificationConfig = { ...State.notificationConfig, [ch]: { ...State.notificationConfig[ch], enabled: el.checked } };
    persist("notificationConfig"); showToast(`${ch === "sms" ? "SMS" : ch[0].toUpperCase() + ch.slice(1)} ${el.checked ? "on" : "off"}`); render();
  },
  "set-notif-mode"(el) {
    const ch = el.dataset.ch;
    State.notificationConfig = { ...State.notificationConfig, [ch]: { ...State.notificationConfig[ch], mode: el.value } };
    persist("notificationConfig"); render();
  },
  "notif-sa-file"(el) { const f = el.files && el.files[0]; UI.pendingSaFile = f ? f.name : null; render(); },
  "test-notif-channel"(el) {
    const ch = el.dataset.ch; const c = State.notificationConfig[ch];
    const missing = c.mode !== "own" ? [] : ch === "email" ? ["host", "username", "fromEmail"].filter((k) => !c[k]).concat(c.passwordSet ? [] : ["password"])
      : ch === "sms" ? ["accountId", "senderId"].filter((k) => !c[k]).concat(c.tokenSet ? [] : ["token"])
      : ["projectId"].filter((k) => !c[k]).concat(c.serviceAccountSet ? [] : ["service account"]);
    if (missing.length) { showToast(`Save these first: ${missing.join(", ")}`, "danger"); return; }
    const to = ch === "email" ? State.companyProfile.email : ch === "sms" ? State.companyProfile.phone : "your admin device";
    showToast(`Test ${ch === "sms" ? "SMS" : ch} sent to ${to} (prototype — nothing is really sent)`);
  },
  "edit-template"(el) { UI.modal = { type: "templateForm", form: deepClone(State.notificationTemplates.find((t) => t.key === el.dataset.key)) }; render(); },
  "reset-template"(el) { const d = DEFAULT_NOTIFICATION_TEMPLATES.find((t) => t.key === el.dataset.key); if (d) { UI.modal.form = deepClone(d); UI.modal.error = null; render(); } },
  // Business settings
  "save-express"() {
    const enabled = document.getElementById("expressEnabledInput").checked;
    const charge = Math.max(0, Number(document.getElementById("expressChargeInput").value) || 0);
    State.deliverySettings = { ...State.deliverySettings, expressEnabled: enabled, expressCharge: charge };
    persist("deliverySettings"); showToast(`Express delivery ${enabled ? `on · ${money(charge)}` : "off"}`); render();
  },
  "save-stock-rules"() {
    const picked = document.querySelector('input[name="negStock"]:checked');
    State.deliverySettings = { ...State.deliverySettings, allowNegativeStock: !!picked && picked.value === "on" };
    persist("deliverySettings"); showToast(allowNegativeStock() ? "Negative stock allowed" : "Negative stock blocked — products sell out at zero"); render();
  },
  // Sidebar groups
  "toggle-nav-group"(el) { const g = el.dataset.group; const holdsActive = (adminNavGroupOf(UI.adminTab) || {}).group === g; const isOpen = (UI.navOpen || {})[g] != null ? UI.navOpen[g] || holdsActive : holdsActive; UI.navOpen = { ...(UI.navOpen || {}), [g]: !isOpen }; render(); },

  // Import
  "open-import"(el) { UI.modal = { type: "bulkImport", entity: el.dataset.entity || "products" }; render(); },
  "import-entity"(el) { UI.modal = { type: "bulkImport", entity: el.value }; render(); },
  "import-template"(el) { const d = IMPORT_DEFS[UI.modal.entity]; downloadSheet(`quickkart-${UI.modal.entity}-template`, UI.modal.entity, [d.columns.map((c) => c.replace("*", "")), ...d.sample], el.dataset.format); },
  "import-file"(el) {
    const file = el.files && el.files[0]; if (!file) return;
    const entity = UI.modal.entity;
    UI.modal = { type: "bulkImport", entity, fileName: file.name, loading: true }; render();
    readImportFile(file).then((rows) => {
      if (!UI.modal || UI.modal.type !== "bulkImport") return;
      UI.modal = { type: "bulkImport", entity, fileName: file.name, plan: IMPORT_DEFS[entity].plan(rows) }; render();
    }).catch((e) => { UI.modal = { type: "bulkImport", entity, fileError: `${file.name}: ${e.message}` }; render(); });
  },
  "confirm-import"() {
    const m = UI.modal; const def = IMPORT_DEFS[m.entity];
    const ok = (m.plan || []).filter((p) => p.status !== "error");
    ok.forEach((p) => p.apply());
    def.after();
    UI.modal = null; showToast(`Imported ${ok.length} ${def.label.toLowerCase()} row(s)`); render();
  },
});

/* ---------------- 23. Form submit handlers ---------------- */
Object.assign(Submits, {
  "save-slot-templates"(form) {
    const fd = new FormData(form);
    const templates = readSlotTemplateForm();
    const bad = templates.find((t) => !t.start || !t.end || t.end <= t.start);
    if (bad) { showToast("Each slot must end after it starts", "danger"); return; }
    saveSlotSettings({ templates, daysAhead: Math.min(Math.max(Number(fd.get("daysAhead")) || 1, 1), 14), cutoffMins: Math.max(0, Number(fd.get("cutoffMins")) || 0) });
    showToast("Slot times saved"); render();
  },
  "add-extra-slot"(form) {
    const fd = new FormData(form);
    const start = fd.get("start"), end = fd.get("end"), capacity = Math.max(1, Number(fd.get("capacity")) || 1);
    if (!start || !end || end <= start) { showToast("The slot must end after it starts", "danger"); return; }
    const k = `${form.dataset.store}|${form.dataset.date}`;
    saveSlotSettings({ extras: { ...State.slotSettings.extras, [k]: [...(State.slotSettings.extras[k] || []), { id: `x${Date.now()}`, start, end, capacity }] } });
    showToast("One-off slot added"); render();
  },
  "save-peak-sections"() {
    const rows = readPeakRows().map((r) => ({ ...r, name: String(r.name || "").trim() })).sort((a, b) => a.start - b.start);
    const err = rows.find((r) => !r.name) ? "Every section needs a name" : rows.find((r) => r.end <= r.start) ? "Each section must end after it starts" : rows.find((r, i) => i && r.start < rows[i - 1].end) ? "Sections overlap — fix the hours" : null;
    if (err) { UI.modal.rows = rows; UI.modal.error = err; render(); return; }
    State.peakSections = rows; persist("peakSections"); UI.modal = null; showToast("Time sections saved"); render();
  },
  "save-role"(form) {
    const fd = new FormData(form);
    const role = findRole(form.dataset.role);
    if (!role || role.locked) return;
    const permissions = {};
    PERMISSION_SCREENS.forEach((s) => { permissions[s.key] = fd.get(`perm_${s.key}`) || "none"; });
    const name = role.isSystem ? role.name : String(fd.get("roleName") || "").trim() || role.name;
    State.roles = State.roles.map((r) => r.id === role.id ? { ...r, name, permissions } : r);
    persist("roles"); showToast(`${name} saved`); render();
  },
  "create-role"(form) {
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    if (!name) { UI.modal.error = "Give the role a name"; render(); return; }
    if (State.roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) { UI.modal.error = "A role with this name already exists"; render(); return; }
    const from = findRole(fd.get("copyFrom"));
    State.roles.push({ id: `role_${Date.now()}`, name, isSystem: false, locked: false, permissions: from ? { ...from.permissions } : {} });
    persist("roles"); UI.modal = null; UI.usersSubTab = "roles"; showToast(`${name} created — set its permissions below`); render();
  },
  "save-stock-move"(form) {
    const fd = new FormData(form);
    const m = UI.modal;
    const itemId = Number(fd.get("itemId"));
    const item = findItem(itemId);
    const qty = Math.floor(Number(fd.get("qty")));
    const onHand = storeQty(m.branchId, itemId) || 0;
    const fail = (msg) => { UI.modal.error = msg; if (!m.itemId) UI.modal.itemId = itemId; render(); };
    if (!item || !Number.isFinite(qty)) return fail("Enter a quantity");
    if (m.mode === "receive") {
      if (qty <= 0) return fail("Quantity must be more than 0");
      const unitCost = fd.get("unitCost") === "" ? null : Math.max(0, Number(fd.get("unitCost")) || 0);
      const supplierId = Number(fd.get("supplierId")) || null;
      recordStockMove({ branchId: m.branchId, itemId, type: "receive", qty, unitCost, supplierId, ref: String(fd.get("ref") || "").trim(), note: supplierId ? supplierName(supplierId) : "" });
      if (unitCost != null || supplierId) { State.items = State.items.map((i) => i.id === itemId ? { ...i, ...(unitCost != null ? { costPrice: unitCost } : {}), ...(supplierId ? { supplierId } : {}) } : i); persist("items"); }
      showToast(`Received ${qty} × ${item.name}`);
    } else if (m.mode === "adjust") {
      const reason = fd.get("reason");
      const note = String(fd.get("note") || "").trim();
      let delta;
      if (reason === "stocktake") { if (qty < 0 && !allowNegativeStock()) return fail("A counted quantity can't be below 0"); delta = qty - onHand; }
      else if (reason === "correction") delta = qty;
      else { if (qty <= 0) return fail("Enter how many units to remove"); delta = -qty; }
      if (!allowNegativeStock() && onHand + delta < 0) return fail(`Only ${onHand} on hand — negative stock isn't allowed`);
      if (delta === 0) { UI.modal = null; showToast("No change — quantity already matches"); render(); return; }
      recordStockMove({ branchId: m.branchId, itemId, type: reason, qty: delta, note });
      showToast(`${item.name}: ${delta > 0 ? "+" : ""}${delta} (${STOCK_MOVE_TYPES[reason].label.toLowerCase()})`);
    } else {
      const to = Number(fd.get("toBranch"));
      if (qty <= 0) return fail("Quantity must be more than 0");
      if (!allowNegativeStock() && qty > onHand) return fail(`Only ${onHand} on hand to transfer`);
      const note = String(fd.get("note") || "").trim();
      // Round 6: sending is one half of a transfer — the other store marks it received (Stock ▸ Transfers).
      createTransfer({ fromId: m.branchId, toId: to, itemId, qty, note, status: "sent" });
      showToast(`Sent ${qty} × ${item.name} to ${findBranch(to).name} — they'll mark it received`);
    }
    UI.modal = null; render();
  },
  "save-supplier"(form) {
    const fd = new FormData(form);
    const f = UI.modal.form;
    const data = { code: String(fd.get("code") || "").trim(), name: String(fd.get("name") || "").trim(), contactPerson: String(fd.get("contactPerson") || "").trim(), phone: String(fd.get("phone") || "").trim(), email: String(fd.get("email") || "").trim(), uen: String(fd.get("uen") || "").trim(), address: String(fd.get("address") || "").trim(), paymentTerms: fd.get("paymentTerms"), leadTimeDays: Math.max(0, Number(fd.get("leadTimeDays")) || 0), notes: String(fd.get("notes") || "").trim(), active: fd.get("active") === "on" };
    const errors = {};
    if (!data.code) errors.code = "Code is required";
    else if (State.suppliers.some((s) => s.id !== f.id && (s.code || "").toLowerCase() === data.code.toLowerCase())) errors.code = "Another supplier already uses this code";
    if (!data.name) errors.name = "Name is required";
    if (Object.keys(errors).length) { UI.modal.form = { ...f, ...data }; UI.modal.errors = errors; render(); return; }
    if (f.id) State.suppliers = State.suppliers.map((s) => s.id === f.id ? { ...s, ...data } : s);
    else State.suppliers.push({ id: nextId(State.suppliers), ...data });
    persist("suppliers"); UI.modal = null; showToast(`${data.name} saved`); render();
  },
  "save-notif-channel"(form) {
    const ch = form.dataset.ch;
    const fd = new FormData(form);
    const cur = State.notificationConfig[ch];
    const next = { ...cur };
    ["host", "security", "username", "fromName", "fromEmail", "replyTo", "provider", "accountId", "senderId", "projectId", "vapidKey"].forEach((k) => { if (fd.has(k)) next[k] = String(fd.get(k) || "").trim(); });
    if (fd.has("port")) next.port = Number(fd.get("port")) || 587;
    // Secrets: only a "saved" flag is kept in the prototype. The real backend
    // stores them encrypted and never returns them.
    if (fd.get("password")) next.passwordSet = true;
    if (fd.get("token")) next.tokenSet = true;
    if (ch === "push" && UI.pendingSaFile) { next.serviceAccountSet = true; next.serviceAccountFile = UI.pendingSaFile; UI.pendingSaFile = null; }
    if (cur.mode === "own") {
      const req = ch === "email" ? [["host", "SMTP host"], ["username", "username"], ["fromName", "from name"], ["fromEmail", "from email"]] : ch === "sms" ? [["accountId", "account SID / API key"], ["senderId", "sender ID"]] : [["projectId", "Firebase project ID"]];
      const miss = req.filter(([k]) => !next[k]).map(([, l]) => l);
      if (ch === "email" && !next.passwordSet) miss.push("password");
      if (ch === "sms" && !next.tokenSet) miss.push("auth token");
      if (ch === "push" && !next.serviceAccountSet) miss.push("service account file");
      if (miss.length) { showToast(`Missing: ${miss.join(", ")}`, "danger"); return; }
    }
    State.notificationConfig = { ...State.notificationConfig, [ch]: next };
    persist("notificationConfig"); showToast(`${ch === "sms" ? "SMS" : ch[0].toUpperCase() + ch.slice(1)} settings saved`); render();
  },
  "save-template"(form) {
    const fd = new FormData(form);
    const t = UI.modal.form;
    const locked = t.locked || [];
    const body = String(fd.get("body") || "").trim();
    const subject = String(fd.get("subject") || "").trim();
    const channels = { email: locked.includes("email") || fd.get("ch_email") === "on", sms: locked.includes("sms") || fd.get("ch_sms") === "on", push: locked.includes("push") || fd.get("ch_push") === "on" };
    const unknown = [...`${subject} ${body}`.matchAll(/\{\{(\w+)\}\}/g)].map((x) => x[1]).filter((k) => !NOTIFICATION_PLACEHOLDERS.includes(k));
    const err = !body ? "The message can't be empty" : unknown.length ? `Unknown placeholder(s): ${unknown.map((k) => `{{${k}}}`).join(", ")}` : null;
    if (err) { UI.modal.form = { ...t, body, subject, channels }; UI.modal.error = err; render(); return; }
    State.notificationTemplates = State.notificationTemplates.map((x) => x.key === t.key ? { ...x, body, subject, channels } : x);
    persist("notificationTemplates"); UI.modal = null; showToast(`${t.name} saved`); render();
  },
});
