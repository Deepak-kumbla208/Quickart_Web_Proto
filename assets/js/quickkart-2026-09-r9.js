/* ====================================================================
   QuickKart prototype — Round 9 (2 October 2026): Audit log, as the
   backend built it (P8-6, MR !70 on quickkart-api-service).

   A. Setup ▸ Audit log — the Super Admin only (no row in the permission
      grid: the backend allows it to the Super Admin alone). Who changed
      what, newest first, 20 a page; filters When (business dates), Changed
      by, What, Action; a row opens to show field — before — after, the IP
      and the request id. Nothing on it can be edited or deleted.
   B. Excel / CSV export of the filtered log (the backend's export is P8-7).
   C. The prototype records real changes: stores (add / change / delete, the
      Store Manager's hours and switch), users (add / change / delete, the
      role dropdown, their own permissions), roles (create / rename /
      permissions / delete) and admin logins — plus a week of demo entries.
   ==================================================================== */

/* ---------------- 1. Data ---------------- */
State.auditEvents = loadLS("auditEvents", () => []);
const AUDIT_CLIENT = { ip: "203.0.113.24", userAgent: "Chrome 129 on Windows" };
function auditRequestId() { return Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10); }
function addAuditEvent(e) {
  State.auditEvents = [{ id: genId("AUD"), createdAt: Date.now(), ip: AUDIT_CLIENT.ip, userAgent: AUDIT_CLIENT.userAgent, requestId: auditRequestId(), before: null, after: null, ...e }, ...State.auditEvents].slice(0, 2000);
  persist("auditEvents");
}

// A week of demo entries, written once (the reset clears them with everything else).
(function seedAuditLog() {
  if (loadLS("migrated_2026_10_r9", false)) return;
  const sa = State.users.find((u) => isSuperAdmin(u));
  const managers = State.users.filter((u) => !isSuperAdmin(u));
  const [m1, m2, m3] = [managers[0] || sa, managers[1] || sa, managers[2] || sa];
  const [s1, s2, s3] = [State.branches[0], State.branches[1] || State.branches[0], State.branches[2] || State.branches[0]];
  const role = State.roles.find((r) => r.id === ROLE_STORE_MANAGER) || State.roles[0];
  const customer = (State.orders.find((o) => o.customerName) || {}).customerName || "Priya Tan";
  const H = 3600000;
  const at = (hoursAgo) => Date.now() - hoursAgo * H;
  const by = (u) => ({ actorType: "user", actorId: u.id });
  const rows = [
    { createdAt: at(1), action: "user.logged_in", entity: "user", entityId: sa.id, ...by(sa) },
    { createdAt: at(2.5), action: "store.updated", entity: "store", entityId: s1.id, ...by(m1), before: { isOpen: false }, after: { isOpen: true } },
    { createdAt: at(4), action: "store.updated", entity: "store", entityId: s1.id, ...by(m1), before: { isOpen: true }, after: { isOpen: false } },
    { createdAt: at(4.2), action: "user.logged_in", entity: "user", entityId: m1.id, ...by(m1) },
    { createdAt: at(26), action: "user.login_failed", entity: "user", entityId: m2.id, ...by(m2) },
    { createdAt: at(28), action: "role.permissions_changed", entity: "role", entityId: role.id, ...by(sa), before: { reports: "none" }, after: { reports: "view" } },
    { createdAt: at(47), action: "user.invite_accepted", entity: "user", entityId: m3.id, ...by(m3) },
    { createdAt: at(48), action: "user.invite_sent", entity: "user", entityId: m3.id, ...by(sa) },
    { createdAt: at(48), action: "user.created", entity: "user", entityId: m3.id, ...by(sa), after: { name: m3.name, email: m3.email || "", roleId: m3.roleId, storeIds: [s3.id], active: true, signIn: "invite" } },
    { createdAt: at(72), action: "store.updated", entity: "store", entityId: s2.id, ...by(sa), before: { hoursClose: "22:00" }, after: { hoursClose: "23:00" } },
    { createdAt: at(96), action: "customer.deleted", entity: "customer", entityId: "C-1042", actorType: "customer", actorId: "C-1042", names: { actor: customer, entity: customer }, ip: null, userAgent: null },
    { createdAt: at(120), action: "user.permissions_changed", entity: "user", entityId: m2.id, ...by(sa), before: { coupons: null }, after: { coupons: "view" } },
    { createdAt: at(122), action: "user.password_reset", entity: "user", entityId: m2.id, ...by(m2) },
    { createdAt: at(122.3), action: "user.password_reset_requested", entity: "user", entityId: m2.id, ...by(m2) },
    { createdAt: at(144), action: "store.updated", entity: "store", entityId: s3.id, ...by(sa), before: { radiusKm: 5 }, after: { radiusKm: 6 } },
    { createdAt: at(150), action: "role.permissions_changed", entity: "role", entityId: role.id, actorType: "system", actorId: null, before: { suppliers: null }, after: { suppliers: "view" }, ip: null, userAgent: null, requestId: null },
  ];
  State.auditEvents = [
    ...State.auditEvents,
    ...rows.map((r) => ({ id: genId("AUD"), ip: AUDIT_CLIENT.ip, userAgent: AUDIT_CLIENT.userAgent, requestId: auditRequestId(), before: null, after: null, ...r })),
  ].sort((x, y) => y.createdAt - x.createdAt);
  persist("auditEvents");
  saveLS("migrated_2026_10_r9", true);
})();

/* ---------------- 2. Wording ---------------- */
// [entity label, how the sentence reads, whether the record is the actor themself]
const AUDIT_ACTION_TEXT = {
  "store.created": ["Stores", "added store"],
  "store.updated": ["Stores", "changed store"],
  "store.deleted": ["Stores", "deleted store"],
  "user.created": ["Users", "added user"],
  "user.updated": ["Users", "changed user"],
  "user.deleted": ["Users", "deleted user"],
  "user.permissions_changed": ["Users", "changed the permissions of"],
  "user.password_set": ["Users", "set a new password for"],
  "user.invite_sent": ["Users", "sent an invite to"],
  "user.invite_accepted": ["Users", "accepted their invite", true],
  "user.logged_in": ["Users", "logged in", true],
  "user.login_failed": ["Users", "failed to log in (wrong password)", true],
  "user.password_changed": ["Users", "changed their password", true],
  "user.password_reset_requested": ["Users", "asked for a password-reset link", true],
  "user.password_reset": ["Users", "reset their password", true],
  "role.created": ["Roles", "created role"],
  "role.renamed": ["Roles", "renamed role"],
  "role.deleted": ["Roles", "deleted role"],
  "role.permissions_changed": ["Roles", "changed the permissions of role"],
  "customer.deleted": ["Customers", "deleted their account", true],
};
const AUDIT_ENTITY_LABEL = { store: "Stores", user: "Users", role: "Roles", customer: "Customers" };
const AUDIT_FIELD_LABEL = {
  name: "Name", area: "Area", lat: "Latitude", lng: "Longitude", radiusKm: "Radius (km)", hoursOpen: "Opens", hoursClose: "Closes",
  isOpen: "Open switch", active: "Active", pickupAvailable: "Pickup", pickupAddress: "Pickup address",
  email: "Email", mobile: "Mobile", roleId: "Role", storeIds: "Stores", signIn: "First sign-in",
};

// Names are read now, as the backend does (a renamed store shows its new name; the old one is in "before").
function auditActorName(e) {
  if (e.actorType === "system") return "System";
  if (e.names && e.names.actor) return e.names.actor;
  const u = e.actorType === "user" ? findUser(e.actorId) : null;
  return u ? u.name : "Someone";
}
function auditEntityName(e) {
  if (e.names && e.names.entity) return e.names.entity;
  if (e.entity === "store") return (findBranch(e.entityId) || {}).name || null;
  if (e.entity === "user") return (findUser(e.entityId) || {}).name || null;
  if (e.entity === "role") return (findRole(e.entityId) || {}).name || null;
  return null;
}
function auditSentenceHTML(e) {
  const [, verb, self] = AUDIT_ACTION_TEXT[e.action] || ["", e.action];
  const who = `<b>${esc(auditActorName(e))}</b>`;
  const name = auditEntityName(e);
  return self || !name ? `${who} ${esc(verb)}` : `${who} ${esc(verb)} <b>${esc(name)}</b>`;
}
function auditValueText(key, v) {
  if (v == null) return "—";
  if (typeof v === "boolean") return key === "isOpen" ? (v ? "Open" : "Closed") : v ? "Yes" : "No";
  if (key === "roleId") return (findRole(v) || {}).name || String(v);
  if (key === "storeIds" && Array.isArray(v)) return v.map((id) => (findBranch(id) || {}).name || id).join(", ") || "none";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function auditDetailsHTML(e) {
  const keys = [...new Set([...Object.keys(e.before || {}), ...Object.keys(e.after || {})])];
  const permScreen = (k) => (PERMISSION_SCREENS.find((s) => s.key === k) || {}).label;
  return `
  <div class="audit-detail">
    ${keys.length ? `
    <div class="audit-diff">
      <div class="audit-diff-row audit-diff-head"><span>Field</span><span>Before</span><span>After</span></div>
      ${keys.map((k) => `<div class="audit-diff-row"><span>${esc(AUDIT_FIELD_LABEL[k] || permScreen(k) || k)}</span><span class="qk-muted">${esc(auditValueText(k, (e.before || {})[k]))}</span><span><b>${esc(auditValueText(k, (e.after || {})[k]))}</b></span></div>`).join("")}
    </div>` : `<div class="qk-muted small">No field values for this entry.</div>`}
    <div class="qk-muted small" style="margin-top:6px">${esc(e.action)}${e.ip ? ` · IP ${esc(e.ip)}` : ""}${e.userAgent ? ` · ${esc(e.userAgent)}` : ""}${e.requestId ? ` · Request ${esc(e.requestId)}` : ""}</div>
  </div>`;
}

/* ---------------- 3. Filters ---------------- */
function auditFilterBarHTML() {
  const staff = State.users.map((u) => [`user:${u.id}`, u.name]);
  return filterBarHTML("audit", {
    date: { key: "date", label: "When" },
    fields: [
      { key: "who", label: "Changed by", groups: [{ label: "Staff", options: staff }, { label: "Others", options: [["type:customer", "Customers"], ["type:system", "System"]] }] },
      { key: "entity", label: "What", options: Object.entries(AUDIT_ENTITY_LABEL) },
      { key: "action", label: "Action", options: Object.entries(AUDIT_ACTION_TEXT).map(([k, [ent, verb]]) => [k, `${ent} · ${verb}`]) },
    ],
    sort: [["newest", "Newest first"], ["oldest", "Oldest first"]],
  });
}
function auditFiltered() {
  const f = F("audit");
  const range = dateRangeOf(f.date, f.dateFrom, f.dateTo);
  const [whoKind, whoId] = String(f.who || "").split(":");
  const list = State.auditEvents.filter((e) =>
    inRange(e.createdAt, range)
    && (!f.who || (whoKind === "user" ? e.actorType === "user" && String(e.actorId) === whoId : e.actorType === whoId))
    && (!f.entity || e.entity === f.entity)
    && (!f.action || e.action === f.action));
  return f.sort === "oldest" ? list.slice().sort((x, y) => x.createdAt - y.createdAt) : list.slice().sort((x, y) => y.createdAt - x.createdAt);
}

/* ---------------- 4. The screen ---------------- */
const AUDIT_PAGE_SIZE = 20;
function adminAuditLog() {
  const list = auditFiltered();
  const pages = Math.max(1, Math.ceil(list.length / AUDIT_PAGE_SIZE));
  const page = Math.min(Math.max(1, UI.auditPage || 1), pages);
  const rows = list.slice((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE);
  const first = list.length ? (page - 1) * AUDIT_PAGE_SIZE + 1 : 0;
  return `
  <div class="admin-toolbar"><div class="qk-muted small">Who changed what, newest first. Nobody can edit or delete these entries. Only the Super Admin sees this page.</div>${exportButtonsHTML("auditLog")}</div>
  ${auditFilterBarHTML()}
  <div class="fcount">${list.length ? `Showing <b>${first}–${first + rows.length - 1}</b> of ${list.length} entries` : "0 entries"}</div>
  <div class="inv-table">
    <div class="inv-row audit-row inv-head"><span>When</span><span>What happened</span><span>Area</span><span></span></div>
    ${rows.map((e) => {
      const open = UI.openAuditId === e.id;
      return `
      <button type="button" class="inv-row audit-row audit-row-btn ${open ? "open" : ""}" data-action="toggle-audit-row" data-id="${e.id}" aria-expanded="${open}">
        <span class="small">${fmtDateTime(e.createdAt)}</span>
        <span>${auditSentenceHTML(e)}</span>
        <span><span class="badge badge-gray-soft">${esc(AUDIT_ENTITY_LABEL[e.entity] || e.entity)}</span></span>
        <span class="audit-chev ${open ? "open" : ""}">${ic("chevronDown")}</span>
      </button>
      ${open ? auditDetailsHTML(e) : ""}`;
    }).join("")}
    ${list.length === 0 ? `<div class="empty-state"><div class="empty-title">No entries match</div><div class="empty-hint">Change a filter, or make a change elsewhere in the admin panel — it shows up here.</div></div>` : ""}
  </div>
  ${pages > 1 ? `
  <div class="audit-pager">
    <button type="button" class="btn btn-outline btn-sm" data-action="audit-page" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>${ic("chevronLeft")} Newer</button>
    <span class="qk-muted small">Page ${page} of ${pages}</span>
    <button type="button" class="btn btn-outline btn-sm" data-action="audit-page" data-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Older ${ic("chevronRight")}</button>
  </div>` : ""}`;
}
Object.assign(Actions, {
  "toggle-audit-row"(el) { UI.openAuditId = UI.openAuditId === el.dataset.id ? null : el.dataset.id; render(); },
  "audit-page"(el) { UI.auditPage = Number(el.dataset.page) || 1; UI.openAuditId = null; render(); },
});
// A filter change starts again at page 1.
(() => {
  const base = setFilter;
  window.setFilter = (screen, key, value) => { if (screen === "audit") UI.auditPage = 1; return base(screen, key, value); };
})();
EXPORTS.auditLog = () => ({
  name: "audit-log",
  columns: ["When", "Who", "Action", "Area", "Record", "Before", "After", "IP", "Request id"],
  rows: auditFiltered().map((e) => [fmtDateTime(e.createdAt), auditActorName(e), e.action, AUDIT_ENTITY_LABEL[e.entity] || e.entity, auditEntityName(e) || "", e.before ? JSON.stringify(e.before) : "", e.after ? JSON.stringify(e.after) : "", e.ip || "", e.requestId || ""]),
});

(() => {
  const css = document.createElement("style");
  css.textContent = `
    .inv-row.audit-row { grid-template-columns: 130px 1fr 110px 28px; }
    .audit-row-btn { width: 100%; text-align: left; background: none; border: 0; border-bottom: 1px solid var(--line); cursor: pointer; font: inherit; color: inherit; }
    .audit-row-btn:hover, .audit-row-btn.open { background: var(--bg); }
    .audit-chev .ic { transition: transform .15s; display: inline-flex; }
    .audit-chev.open .ic { transform: rotate(180deg); }
    .audit-detail { padding: 10px 14px 12px 152px; border-bottom: 1px solid var(--line); background: var(--bg); }
    .audit-diff { display: flex; flex-direction: column; max-width: 560px; border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; background: var(--card); }
    .audit-diff-row { display: grid; grid-template-columns: 140px 1fr 1fr; gap: 10px; padding: 6px 10px; font-size: 12.5px; border-bottom: 1px solid var(--line); }
    .audit-diff-row:last-child { border-bottom: 0; }
    .audit-diff-head { font-size: 11.5px; font-weight: 700; color: var(--muted); background: var(--bg); }
    .audit-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 12px; }
    @media (max-width: 760px) { .inv-row.audit-row { grid-template-columns: 1fr 28px; } .inv-row.audit-row > span:nth-child(1), .inv-row.audit-row > span:nth-child(3) { display: none; } .audit-detail { padding-left: 14px; } }
  `;
  document.head.appendChild(css);
})();

/* ---------------- 5. Sidebar: Setup ▸ Audit log, the Super Admin only ---------------- */
// Not a permission screen (the backend has no `auditLog` key in the grid): shown to the Super Admin alone.
if (!Icon.history) Icon.history = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>';
(() => {
  const baseTabs = visibleAdminTabs;
  window.visibleAdminTabs = (user) => {
    const tabs = baseTabs(user);
    return isSuperAdmin(user) ? [...tabs, { key: "auditLog", label: "Audit log", icon: "history" }] : tabs;
  };
  const baseNav = adminNavHTML;
  window.adminNavHTML = (visibleTabs) => {
    const sa = visibleTabs.some((t) => t.key === "auditLog");
    if (sa && UI.adminTab === "auditLog") UI.navOpen = { ...(UI.navOpen || {}), setup: true };
    const html = baseNav(visibleTabs);
    if (!sa) return html;
    const item = `<button class="dash-nav-item dash-nav-sub ${UI.adminTab === "auditLog" ? "active" : ""}" data-action="admin-tab" data-tab="auditLog">${ic("history")}<span>Audit log</span></button>`;
    // After Notifications, the last Setup screen — only while the Setup group is open.
    return html.replace(/(<button class="dash-nav-item dash-nav-sub[^"]*" data-action="admin-tab" data-tab="notifications">[\s\S]*?<\/button>)/, `$1${item}`);
  };
  const baseTitle = adminPageTitle;
  window.adminPageTitle = (key) => (key === "auditLog" ? `<span class="crumb">Setup ›</span> Audit log` : baseTitle(key));
  const baseContent = adminTabContent;
  window.adminTabContent = (user) => {
    if (UI.adminTab !== "auditLog") return baseContent(user);
    return isSuperAdmin(user) ? adminAuditLog() : `<div class="empty-state"><div class="empty-title">You don't have access to this screen</div></div>`;
  };
})();

/* ---------------- 6. Recording real changes ---------------- */
const AUDIT_TRACKED = {
  store: { collection: "branches", fields: ["name", "area", "lat", "lng", "radiusKm", "hoursOpen", "hoursClose", "isOpen", "active", "pickupAvailable", "pickupAddress"] },
  user: { collection: "users", fields: ["name", "email", "mobile", "roleId", "storeIds", "active"] },
  role: { collection: "roles", fields: ["name"] },
};
const auditSame = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function auditSnapshot(entity) {
  return new Map((State[AUDIT_TRACKED[entity].collection] || []).map((r) => [r.id, JSON.parse(JSON.stringify(r))]));
}
// Compares a collection before and after a handler ran and writes what changed, as the backend would.
function auditRecordDiff(entity, before, actor) {
  if (!actor) return;
  const { collection, fields } = AUDIT_TRACKED[entity];
  const by = { actorType: "user", actorId: actor.id };
  const pick = (r, keys) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null]));
  const after = new Map((State[collection] || []).map((r) => [r.id, r]));
  for (const [id, row] of after) {
    const old = before.get(id);
    if (!old) { addAuditEvent({ action: `${entity}.created`, entity, entityId: id, ...by, after: pick(row, fields) }); continue; }
    const changed = fields.filter((k) => !auditSame(old[k], row[k]));
    if (changed.length) addAuditEvent({ action: entity === "role" && changed.includes("name") ? "role.renamed" : `${entity}.updated`, entity, entityId: id, ...by, before: pick(old, changed), after: pick(row, changed) });
    const perms = entity === "role" ? ["permissions"] : entity === "user" ? ["permissionOverrides"] : [];
    for (const p of perms) {
      const o = old[p] || {}, n = row[p] || {};
      const screens = [...new Set([...Object.keys(o), ...Object.keys(n)])].filter((k) => !auditSame(o[k], n[k]));
      if (screens.length) addAuditEvent({ action: `${entity}.permissions_changed`, entity, entityId: id, ...by, before: pick(o, screens), after: pick(n, screens) });
    }
  }
  for (const [id, old] of before) {
    if (!after.has(id)) addAuditEvent({ action: `${entity}.deleted`, entity, entityId: id, ...by, before: { name: old.name }, names: { entity: old.name } });
  }
}
function auditWrap(table, name, entity) {
  const base = table[name];
  if (!base) return;
  table[name] = function (...args) {
    const actor = currentUser();
    const before = auditSnapshot(entity);
    const result = base.apply(this, args);
    auditRecordDiff(entity, before, actor);
    return result;
  };
}
[["save-branch", "store"], ["save-store-hours", "store"], ["save-user", "user"], ["save-role-permissions", "role"], ["save-role", "role"], ["create-role", "role"]].forEach(([n, e]) => auditWrap(Submits, n, e));
[["delete-branch", "store"], ["delete-user", "user"], ["change-user-role", "user"], ["delete-role", "role"]].forEach(([n, e]) => auditWrap(Actions, n, e));
(() => {
  const login = Submits["submit-login"];
  Submits["submit-login"] = (form) => {
    const result = login(form);
    const u = currentUser();
    if (u) addAuditEvent({ action: "user.logged_in", entity: "user", entityId: u.id, actorType: "user", actorId: u.id });
    return result;
  };
})();

/* ---------------- 7. What's changed ---------------- */
WHATS_NEW.unshift({ area: "Audit log (round 9)", items: [
  ["Audit log", "Setup ▸ Audit log (Super Admin only): who changed what, newest first, 20 a page. Filter by When, Changed by, What and Action; open a row to see each field before and after, the IP and the request id. Nothing on it can be edited or deleted. Excel / CSV export follows the filters."],
  ["What is recorded", "Store changes (including a Store Manager's hours and open switch), users (added, changed, deleted, role, own permissions), roles (created, renamed, permissions, deleted), logins, password resets and invites, and a customer deleting their account. Names show as they are now; the old value is in 'Before'."],
] });
