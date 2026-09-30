/* ====================================================================
   QuickKart prototype — Round 7 (30 September 2026): backend alignment.

   The backend decisions D56–D70 were recorded from Rounds 1–6; this round
   adds the admin / rider controls those decisions need and the prototype
   did not have yet. No screen is rearranged; only two sidebar moves the
   user asked for (Customers to the top level, a Transfers shortcut).

   A. Business Settings ▸ Delivery & Payments: GST on the delivery fee and
      on the express charge (two switches, off by default); order timing
      targets (minutes per stage, "not confirmed" alert, express buffer).
   B. Business Settings ▸ Stock Rules: goodwill caps — the unavailable-item
      bonus cap and a separate cap for credits given by staff.
   C. Categories: "Chilled / cold chain" checkbox; the Orders "Chilled" tag
      reads it (Dairy & Eggs, Meat & Seafood, Frozen Foods pre-ticked).
   D. Notifications: email provider choice (SMTP, SendGrid, Amazon SES,
      Mailgun, Postmark), SMS list aligned (Twilio, Vonage, Amazon SNS),
      the SSIR sender-ID note, four new templates.
   E. Orders: "Delivery failed" on an out-for-delivery order; cash-on-
      delivery amounts adjusted for removed / swapped items; "cash
      collected?" before an order is marked delivered; cash on hand per
      rider in the Orders rail; on-trip riders can't be assigned.
   F. Rider app: "Collect S$x in cash" banner, cash confirmation before
      completing, "Cash with you" since going online, "Couldn't deliver".
   G. Import dialog: file limits. Sidebar: Customers top-level, Transfers
      shortcut under Stock.
   ==================================================================== */

/* ---------------- 1. Settings and one-time migration ---------------- */
const DEFAULT_TIMING = { new: 3, confirmed: 5, picking: 8, packing: 5, ready_for_rider: 10, picked_up: 30, confirmAlertMins: 10, expressBufferMins: 15 };
const DEFAULT_GOODWILL = { bonusCap: 50, staffCap: 50, days: 30 };
State.deliverySettings = {
  ...State.deliverySettings,
  timing: { ...DEFAULT_TIMING, ...(State.deliverySettings.timing || {}) },
  goodwill: { ...DEFAULT_GOODWILL, ...(State.deliverySettings.goodwill || {}) },
};
State.tax = { taxOnDeliveryFee: false, taxOnExpressCharge: false, ...(State.tax || {}) };
function timingSettings() { return State.deliverySettings.timing; }
function goodwillSettings() { return State.deliverySettings.goodwill; }
// The console's stage targets (r3) read STAGE_SLA_MIN; keep it in step with the settings.
function applyTimingTargets() {
  const t = timingSettings();
  ["new", "confirmed", "picking", "packing", "ready_for_rider", "picked_up"].forEach((k) => { STAGE_SLA_MIN[k] = Number(t[k]) || DEFAULT_TIMING[k]; });
}
applyTimingTargets();

// Categories: cold chain is a flag on the category now (was a fixed list of names).
(() => {
  let changed = false;
  State.categories = State.categories.map((c) => { if (c.chilled === undefined) { changed = true; return { ...c, chilled: COLD_CATS.includes(c.name) }; } return c; });
  if (changed) persist("categories");
})();

// Notification providers: email gains a provider choice; the SMS list follows the backend (D65).
const EMAIL_PROVIDERS_R7 = ["SMTP", "SendGrid", "Amazon SES", "Mailgun", "Postmark"];
const SMS_PROVIDERS_R7 = ["Twilio", "Vonage", "Amazon SNS"];
const SES_REGIONS = ["ap-southeast-1 (Singapore)", "ap-southeast-2 (Sydney)", "us-east-1 (N. Virginia)", "eu-west-1 (Ireland)"];
(() => {
  const cfg = State.notificationConfig || {};
  const email = { provider: "SMTP", ...(cfg.email || {}) };
  if (!EMAIL_PROVIDERS_R7.includes(email.provider)) email.provider = "SMTP";
  const sms = { ...(cfg.sms || {}) };
  if (sms.provider === "AWS SNS") sms.provider = "Amazon SNS";
  if (!SMS_PROVIDERS_R7.includes(sms.provider)) sms.provider = "Twilio";
  State.notificationConfig = { ...cfg, email, sms };
  persist("notificationConfig");
})();

const R7_TEMPLATES = [
  { key: "cod_reminder", name: "Cash reminder (out for delivery)", audience: "Customer", channels: { email: false, sms: false, push: true }, subject: "Please keep {{cashToCollect}} ready", body: "Order {{orderNo}} is on its way. Please keep {{cashToCollect}} in cash ready for the rider." },
  { key: "no_answer_chosen", name: "We chose for you (no answer in time)", audience: "Customer", channels: { email: false, sms: false, push: true }, subject: "About {{itemName}} in order {{orderNo}}", body: "You didn't answer in time, so we {{action}}. Tap to see your order." },
  { key: "store_message", name: "Message from the store", audience: "Customer", channels: { email: true, sms: true, push: true }, subject: "A message from {{shopName}}", body: "{{message}}" },
  { key: "rider_assigned", name: "Order assigned to you", audience: "Rider", channels: { email: false, sms: false, push: true }, subject: "New delivery", body: "Order {{orderNo}} · {{slot}} · {{stops}} stop(s) on your trip. Open the app to see the details." },
];
(() => {
  let changed = false;
  R7_TEMPLATES.forEach((t) => {
    if (!DEFAULT_NOTIFICATION_TEMPLATES.some((x) => x.key === t.key)) DEFAULT_NOTIFICATION_TEMPLATES.push(t);
    if (!State.notificationTemplates.some((x) => x.key === t.key)) { State.notificationTemplates.push({ ...t }); changed = true; }
  });
  if (changed) persist("notificationTemplates");
})();

// Stock history gets a "returned to store" movement (a failed delivery brings the goods back).
STOCK_MOVE_TYPES.returned = { label: "Returned to store", tone: "blue" };

/* ---------------- 2. Sidebar: Customers at the top level, Transfers shortcut ---------------- */
(() => {
  const masters = ADMIN_NAV.find((n) => n.group === "masters");
  if (masters) masters.keys = masters.keys.filter((k) => k !== "customers");
  if (!ADMIN_NAV.some((n) => n.key === "customers")) ADMIN_NAV.splice(2, 0, { key: "customers" });
  reorderAdminScreens();
})();
function pendingTransfersCount() {
  return (State.transfers || []).filter((t) => t.status === "requested" || t.status === "sent").length;
}
(() => {
  const before = adminNavHTML;
  window.adminNavHTML = (visibleTabs) => {
    let html = before(visibleTabs);
    if (!visibleTabs.some((t) => t.key === "inventory")) return html;
    const n = pendingTransfersCount();
    const active = UI.adminTab === "inventory" && UI.invTab === "transfers";
    const shortcut = `<button class="dash-nav-item dash-nav-sub ${active ? "active" : ""}" data-action="open-transfers" style="padding-left:34px">${ic("truck")}<span>Transfers${n ? ` <span class="badge badge-yellow-soft">${n}</span>` : ""}</span></button>`;
    return html.replace(/(<button class="dash-nav-item dash-nav-sub[^"]*" data-action="admin-tab" data-tab="inventory">[\s\S]*?<\/button>)/, `$1${shortcut}`);
  };
})();

/* ---------------- 3. Business Settings cards ---------------- */
function feeTaxCardHTML(editable) {
  const t = State.tax;
  const dis = editable ? "" : "disabled";
  return `
  <div class="summary-card" style="max-width:420px; margin-top:16px">
    <div class="summary-card-title">GST on delivery charges</div>
    <div class="qk-muted small">By default GST applies to the items only. Turn these on if your accountant says delivery charges are taxable too. The choice is frozen on each order, so old invoices never change.</div>
    <label class="stock-toggle-lg" style="margin-top:10px"><input type="checkbox" id="taxDeliveryFeeInput" ${t.taxOnDeliveryFee ? "checked" : ""} ${dis} /><span>GST on the delivery fee</span></label>
    <label class="stock-toggle-lg"><input type="checkbox" id="taxExpressInput" ${t.taxOnExpressCharge ? "checked" : ""} ${dis} /><span>GST on the express charge</span></label>
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-fee-tax">Save</button>` : ""}
  </div>`;
}
function timingCardHTML(editable) {
  const t = timingSettings();
  const dis = editable ? "" : "disabled";
  const field = (key, label) => `<label class="field"><span class="field-label">${label}</span><input class="input" type="number" min="1" max="240" id="timing_${key}" value="${t[key]}" ${dis} /></label>`;
  return `
  <div class="summary-card" style="max-width:560px; margin-top:16px">
    <div class="summary-card-title">Order timing targets</div>
    <div class="qk-muted small">Minutes each stage should take. The Orders screen colours the timer amber at 75% of the target and red when over, and works out "at risk", "late" and the average-vs-target figures from these.</div>
    <div class="field-grid-2" style="margin-top:10px">
      ${field("new", "Accept a new order (min) — manual mode")}${field("confirmed", "Start picking (min)")}
      ${field("picking", "Picking (min)")}${field("packing", "Packing (min)")}
      ${field("ready_for_rider", "Waiting for the rider (min)")}${field("picked_up", "Out for delivery (min)")}
    </div>
    <div class="field-grid-2">
      <label class="field"><span class="field-label">"Not accepted" alert after (min) — manual mode</span><input class="input" type="number" min="1" max="120" id="timing_confirmAlertMins" value="${t.confirmAlertMins}" ${dis} /><span class="qk-muted small">Shown in red on the order and counted in Needs action while it waits for Accept.</span></label>
      <label class="field"><span class="field-label">Express due = longest item ETA + (min)</span><input class="input" type="number" min="0" max="120" id="timing_expressBufferMins" value="${t.expressBufferMins}" ${dis} /><span class="qk-muted small">Past this an express order is "overdue".</span></label>
    </div>
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-timing">Save</button>` : ""}
  </div>`;
}
function goodwillCapsCardHTML(editable) {
  const g = goodwillSettings();
  const dis = editable ? "" : "disabled";
  return `
  <div class="summary-card" style="max-width:560px;margin-top:16px">
    <div class="summary-card-title">Goodwill limits</div>
    <div class="qk-muted small">Two separate limits per customer per rolling period, so one never eats into the other. The refund part of an unavailable item is always paid in full — only the bonus counts.</div>
    <div class="field-grid-2" style="margin-top:10px">
      <label class="field"><span class="field-label">Unavailable-item bonus cap (S$)</span><input class="input" type="number" min="0" max="1000" step="1" id="gwBonusCap" value="${g.bonusCap}" ${dis} /><span class="qk-muted small">The wallet bonus stops once a customer has received this much in the period. 0 = no bonus.</span></label>
      <label class="field"><span class="field-label">Staff goodwill credit cap (S$)</span><input class="input" type="number" min="0" max="1000" step="1" id="gwStaffCap" value="${g.staffCap}" ${dis} /><span class="qk-muted small">The most your team can add to one customer's wallet from Customers ▸ Add wallet credit.</span></label>
    </div>
    <label class="field" style="max-width:220px"><span class="field-label">Period (days)</span><input class="input" type="number" min="1" max="365" id="gwDays" value="${g.days}" ${dis} /></label>
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-goodwill-caps">Save</button>` : ""}
  </div>`;
}
(() => {
  const delivery = adminDeliveryPanel;
  window.adminDeliveryPanel = (editable) => `${delivery(editable)}${feeTaxCardHTML(editable)}${confirmationCardHTML(editable)}${timingCardHTML(editable)}`;
  const rules = adminStockRulesPanel;
  window.adminStockRulesPanel = (editable) => `${rules(editable)}${goodwillCapsCardHTML(editable)}`;
})();

/* ---------------- 4. The bill: GST on delivery charges when switched on ---------------- */
(() => {
  const totals = cartTotals;
  window.cartTotals = () => {
    const t = totals();
    const tax = State.tax;
    const base = (tax.taxOnDeliveryFee ? t.deliveryFee : 0) + (tax.taxOnExpressCharge ? t.expressCharge : 0);
    if (!tax || !(base > 0)) return t;
    const extra = round2(gstAmount(base, tax));
    t.gst = round2(t.gst + extra);
    if (!t.taxInclusive) {
      // Exclusive tax is the one case where GST changes what is paid (D38).
      t.payableBeforeWallet = round2(t.payableBeforeWallet + extra);
      t.walletApplied = UI.useWallet && t.walletUsable ? Math.min(State.wallet, t.payableBeforeWallet) : 0;
      t.grandTotal = Math.max(round2(t.payableBeforeWallet - t.walletApplied), 0);
    }
    return t;
  };
})();

/* ---------------- 5. Categories: chilled flag ---------------- */
(() => {
  const modal = categoryFormModal;
  window.categoryFormModal = () => modal().replace('<div class="form-actions">',
    `<label class="stock-toggle-lg" style="margin:6px 0 10px"><input type="checkbox" name="chilled" ${UI.modal.form.chilled ? "checked" : ""} /><span>Chilled / cold chain <span class="qk-muted small">— orders with these items show "Chilled — pick last, bag separately"</span></span></label><div class="form-actions">`);
  const save = Submits["save-category"];
  Submits["save-category"] = (form) => {
    const fd = new FormData(form);
    const chilled = fd.get("chilled") === "on";
    const name = String(fd.get("name") || "").trim().toLowerCase();
    save(form);
    if (UI.modal && UI.modal.type === "categoryForm") return; // validation failed, the form is still open
    State.categories = State.categories.map((c) => c.name.toLowerCase() === name ? { ...c, chilled } : c);
    persist("categories"); render();
  };
  window.isCold = (o) => o.items.some((i) => {
    const cat = (findItem(i.id) || {}).cat;
    const c = State.categories.find((x) => x.name === cat);
    return c ? !!c.chilled : COLD_CATS.includes(cat);
  });
})();

/* ---------------- 6. Notifications: providers, SSIR note ---------------- */
const SSIR_NOTE = `<div class="notice notice-warn" style="margin:8px 0"><span>${ic("alert")}</span><span>Singapore: register your SMS sender ID with IMDA's <b>SMS Sender ID Registry (SSIR)</b> before going live — unregistered senders show on phones as "Likely-SCAM", which would ruin login codes.</span></div>`;
function emailProviderFieldsHTML(c, dis) {
  const val = (v) => esc(v == null ? "" : v);
  const from = `
      <div class="field-grid-2">
        <label class="field"><span class="field-label">From name *</span><input class="input" name="fromName" value="${val(c.fromName)}" ${dis} /></label>
        <label class="field"><span class="field-label">From email *</span><input class="input" type="email" name="fromEmail" value="${val(c.fromEmail)}" placeholder="orders@yourdomain.sg" ${dis} /></label>
      </div>
      <label class="field"><span class="field-label">Reply-to email</span><input class="input" type="email" name="replyTo" value="${val(c.replyTo)}" ${dis} /></label>`;
  const select = `<label class="field"><span class="field-label">Provider *</span><select class="input" name="provider" data-action="notif-provider-select" data-ch="email" ${dis}>${EMAIL_PROVIDERS_R7.map((p) => `<option ${c.provider === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>`;
  switch (c.provider) {
    case "SendGrid": return `${select}${secretField("apiKey", "API key *", c.apiKeySet)}${from}`;
    case "Amazon SES": return `${select}
      <div class="field-grid-2">
        <label class="field"><span class="field-label">Region *</span><select class="input" name="region" ${dis}>${SES_REGIONS.map((r) => `<option ${c.region === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
        <label class="field"><span class="field-label">Access key ID *</span><input class="input" name="accountId" value="${val(c.accountId)}" autocomplete="off" ${dis} /></label>
      </div>
      ${secretField("secretAccessKey", "Secret access key *", c.secretAccessKeySet)}
      <div class="qk-muted small" style="margin-bottom:8px">The from address must be a verified identity in that SES region.</div>${from}`;
    case "Mailgun": return `${select}
      <div class="field-grid-2">
        <label class="field"><span class="field-label">Sending domain *</span><input class="input" name="domain" value="${val(c.domain)}" placeholder="mg.yourdomain.sg" ${dis} /></label>
        <label class="field"><span class="field-label">Region</span><select class="input" name="region" ${dis}>${["US", "EU"].map((r) => `<option ${c.region === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
      </div>
      ${secretField("apiKey", "API key *", c.apiKeySet)}${from}`;
    case "Postmark": return `${select}${secretField("serverToken", "Server token *", c.serverTokenSet)}${from}`;
    default: return `${select}
      <div class="field-grid-2">
        <label class="field"><span class="field-label">SMTP host *</span><input class="input" name="host" value="${val(c.host)}" placeholder="smtp.yourdomain.sg" ${dis} /></label>
        <label class="field"><span class="field-label">Port *</span><input class="input" type="number" name="port" value="${val(c.port)}" ${dis} /></label>
      </div>
      <div class="field-grid-2">
        <label class="field"><span class="field-label">Security</span><select class="input" name="security" ${dis}>${["STARTTLS", "SSL/TLS"].map((s) => `<option ${c.security === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label class="field"><span class="field-label">Username *</span><input class="input" name="username" value="${val(c.username)}" autocomplete="off" ${dis} /></label>
      </div>
      ${secretField("password", "Password *", c.passwordSet)}
      <div class="qk-muted small" style="margin-bottom:8px">Ports 465, 587 or 2525 with TLS. Works with Gmail / Google Workspace, Microsoft 365 and your own mail server.</div>${from}`;
  }
}
function smsProviderFieldsHTML(c, dis) {
  const val = (v) => esc(v == null ? "" : v);
  const idLabel = { Twilio: "Account SID *", Vonage: "API key *", "Amazon SNS": "Access key ID *" }[c.provider] || "Account ID *";
  const secretLabel = { Twilio: "Auth token *", Vonage: "API secret *", "Amazon SNS": "Secret access key *" }[c.provider] || "API secret *";
  return `
      <label class="field"><span class="field-label">Provider *</span><select class="input" name="provider" data-action="notif-provider-select" data-ch="sms" ${dis}>${SMS_PROVIDERS_R7.map((p) => `<option ${c.provider === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
      ${c.provider === "Amazon SNS" ? `<label class="field"><span class="field-label">Region *</span><select class="input" name="region" ${dis}>${SES_REGIONS.map((r) => `<option ${c.region === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>` : ""}
      <label class="field"><span class="field-label">${idLabel}</span><input class="input" name="accountId" value="${val(c.accountId)}" autocomplete="off" ${dis} /></label>
      ${secretField("token", secretLabel, c.tokenSet)}
      <label class="field"><span class="field-label">Sender ID or number * <span class="qk-muted small">(up to 11 letters, or a number)</span></span><input class="input" name="senderId" maxlength="15" value="${val(c.senderId)}" ${dis} /></label>
      ${SSIR_NOTE}`;
}
(() => {
  window.notifChannelsHTML = (editable) => {
    const val = (v) => esc(v == null ? "" : v);
    return `
  <div class="notif-grid">
    ${notifChannelCard("email", "Email", "receipt", editable, emailProviderFieldsHTML,
    (c, dis) => `Sent from <b>no-reply@quickkart.sg</b> with your business name as the sender name.
      <label class="field" style="margin-top:8px"><span class="field-label">Sender name</span><input class="input" name="fromName" value="${val(c.fromName)}" ${dis} /></label>`)}
    ${notifChannelCard("sms", "SMS", "phone", editable, smsProviderFieldsHTML,
    (c, dis) => `Sent through QuickKart's SMS account. Login codes (OTP) always go by SMS.
      <label class="field" style="margin-top:8px"><span class="field-label">Sender ID</span><input class="input" name="senderId" maxlength="11" value="${val(c.senderId)}" ${dis} /></label>${SSIR_NOTE}`)}
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
  };
  const REQUIRED = {
    email: {
      SMTP: [["host", "SMTP host"], ["username", "username"], ["passwordSet", "password"], ["fromName", "from name"], ["fromEmail", "from email"]],
      SendGrid: [["apiKeySet", "API key"], ["fromName", "from name"], ["fromEmail", "from email"]],
      "Amazon SES": [["accountId", "access key ID"], ["secretAccessKeySet", "secret access key"], ["fromName", "from name"], ["fromEmail", "from email"]],
      Mailgun: [["domain", "sending domain"], ["apiKeySet", "API key"], ["fromName", "from name"], ["fromEmail", "from email"]],
      Postmark: [["serverTokenSet", "server token"], ["fromName", "from name"], ["fromEmail", "from email"]],
    },
    sms: { Twilio: [["accountId", "account SID"], ["tokenSet", "auth token"], ["senderId", "sender ID"]], Vonage: [["accountId", "API key"], ["tokenSet", "API secret"], ["senderId", "sender ID"]], "Amazon SNS": [["accountId", "access key ID"], ["tokenSet", "secret access key"], ["senderId", "sender ID"]] },
    push: { "*": [["projectId", "Firebase project ID"], ["serviceAccountSet", "service account file"]] },
  };
  Actions["notif-provider-select"] = (el) => {
    const ch = el.dataset.ch;
    State.notificationConfig = { ...State.notificationConfig, [ch]: { ...State.notificationConfig[ch], provider: el.value } };
    persist("notificationConfig"); render();
  };
  Actions["save-notif-channel"] = (form) => {
    const ch = form.dataset.ch;
    const fd = new FormData(form);
    const cur = State.notificationConfig[ch];
    const next = { ...cur };
    ["host", "security", "username", "fromName", "fromEmail", "replyTo", "provider", "accountId", "senderId", "projectId", "vapidKey", "region", "domain"].forEach((k) => { if (fd.has(k)) next[k] = String(fd.get(k) || "").trim(); });
    if (fd.has("port")) next.port = Number(fd.get("port")) || 587;
    // Secrets: only a "saved" flag is kept in the prototype. The real backend stores them
    // encrypted, bound to the business, and never returns them (D65).
    ["password", "token", "apiKey", "secretAccessKey", "serverToken"].forEach((k) => { if (fd.get(k)) next[`${k}Set`] = true; });
    if (ch === "push" && UI.pendingSaFile) { next.serviceAccountSet = true; next.serviceAccountFile = UI.pendingSaFile; UI.pendingSaFile = null; }
    if (cur.mode === "own") {
      const req = (REQUIRED[ch] || {})[next.provider] || (REQUIRED[ch] || {})["*"] || [];
      const miss = req.filter(([k]) => !next[k]).map(([, l]) => l);
      if (miss.length) { showToast(`Missing: ${miss.join(", ")}`, "danger"); return; }
    }
    State.notificationConfig = { ...State.notificationConfig, [ch]: next };
    persist("notificationConfig"); showToast(`${ch === "sms" ? "SMS" : ch[0].toUpperCase() + ch.slice(1)} settings saved`); render();
  };
})();

/* ---------------- 7. Cash on delivery ---------------- */
// What the customer pays at the door: the bill, less removed items, plus/minus swap differences (D64).
function cashToCollect(o) {
  if (!isCod(o)) return 0;
  let amt = Number(o.total) || 0;
  (o.items || []).forEach((it) => {
    if (it.resolution === "removed") amt -= it.price * it.qty;
    else if (it.resolution === "swap" && it.changeRequest && it.changeRequest.altPrice != null) amt += (it.changeRequest.altPrice - it.price) * it.qty;
  });
  return Math.max(round2(amt), 0);
}
function riderCashOnHand(partnerId) {
  const since = State.shiftStart[partnerId] || startOfToday();
  const list = State.orders.filter((o) => o.deliveryPartnerId === partnerId && o.cashCollected && o.cashCollected.at >= since && o.cashCollected.by === "rider");
  return { amount: round2(list.reduce((s, o) => s + o.cashCollected.amount, 0)), count: list.length };
}
function codCollectModal() {
  const m = UI.modal;
  const o = State.orders.find((x) => x.id === m.orderId);
  if (!o) return "";
  const due = cashToCollect(o);
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>Cash on delivery · #${esc(o.id)}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <form class="dialog-body" data-action="confirm-cod-collect">
        <div class="drawer-cash" style="margin-bottom:10px">${ic("wallet")} Collect <b>${money(due)}</b> in cash${due !== round2(o.total) ? ` <span class="qk-muted small">(bill ${money(o.total)}, adjusted for removed or swapped items)</span>` : ""}</div>
        <label class="field"><span class="field-label">Amount received (S$) <span class="qk-muted small">— optional, to work out the change</span></span><input class="input" type="number" name="received" min="0" step="0.05" placeholder="${due.toFixed(2)}" /></label>
        <label class="stock-toggle-lg" style="margin-top:6px"><input type="checkbox" name="collected" /><span>I collected ${money(due)} from the customer</span></label>
        ${m.error ? `<div class="field-error">${esc(m.error)}</div>` : ""}
        <div class="form-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Not yet</button><button type="submit" class="btn btn-primary">${m.by === "rider" ? "Cash collected — complete delivery" : "Cash collected — mark delivered"}</button></div>
      </form>
    </div>
  </div>`;
}
(() => {
  const setStatus = Actions["set-order-status"];
  const complete = Actions["complete-delivery"];
  // Store side: a cash order (delivery or pickup) can't be marked delivered / collected without recording the cash.
  Actions["set-order-status"] = (el) => {
    const o = State.orders.find((x) => x.id === el.dataset.id);
    if (o && el.dataset.status === "delivered" && isCod(o) && !o.cashCollected) { UI.modal = { type: "codCollect", orderId: o.id, by: "store" }; render(); return; }
    return setStatus(el);
  };
  // Rider side: the same check before "Complete delivery".
  Actions["complete-delivery"] = (el) => {
    const o = State.orders.find((x) => x.id === el.dataset.id);
    if (o && isCod(o) && !o.cashCollected) { UI.modal = { type: "codCollect", orderId: o.id, by: "rider" }; render(); return; }
    return complete(el);
  };
  Submits["confirm-cod-collect"] = (form) => {
    const fd = new FormData(form);
    const m = UI.modal;
    const o = State.orders.find((x) => x.id === m.orderId);
    if (!o) { UI.modal = null; render(); return; }
    const due = cashToCollect(o);
    const received = fd.get("received") === "" || fd.get("received") == null ? due : round2(fd.get("received"));
    if (fd.get("collected") !== "on") { UI.modal.error = `Tick the box once you have ${money(due)} in hand.`; render(); return; }
    if (received < due - 0.001) { UI.modal.error = `That's ${money(round2(due - received))} short. Collect the full amount, or call the store.`; render(); return; }
    const who = m.by === "rider" ? "rider" : "store";
    const byName = m.by === "rider" ? (State.session && State.session.name) || "Rider" : (currentUser() || {}).name || "Store";
    State.orders = State.orders.map((x) => x.id === o.id ? { ...x, cashCollected: { amount: due, received, at: Date.now(), by: who, byName } } : x);
    persist("orders");
    UI.modal = null;
    const change = round2(received - due);
    showToast(`${money(due)} collected${change > 0 ? ` · change ${money(change)}` : ""}`);
    if (who === "rider") complete({ dataset: { id: o.id } }); else setStatus({ dataset: { id: o.id, status: "delivered" } });
  };
})();

/* ---------------- 8. Delivery failed (D60 e) ---------------- */
const DELIVERY_FAIL_REASONS = ["Customer not available", "Customer couldn't pay", "Wrong or incomplete address", "Customer refused the order", "Other"];
function failDelivery(orderId, reason, by) {
  const o = State.orders.find((x) => x.id === orderId);
  if (!o || o.status !== "picked_up") return false;
  const text = `Delivery failed — ${reason}`;
  // The goods come back to the store: every line that was actually on the van goes back into stock.
  o.items.forEach((it) => { if (!it.unavailable && it.resolution !== "removed") recordStockMove({ branchId: o.branchId, itemId: it.id, type: "returned", qty: it.qty, ref: `Order #${o.id}`, note: text }); });
  State.orders = State.orders.map((x) => x.id === orderId ? { ...x, status: "cancelled", cancelReason: text, deliveryFailed: { reason, at: Date.now(), by }, statusHistory: [...(x.statusHistory || []), { status: "cancelled", at: Date.now(), reason: text }] } : x);
  persist("orders");
  return true;
}
function deliveryFailedModal() {
  const m = UI.modal;
  const o = State.orders.find((x) => x.id === m.orderId);
  if (!o) return "";
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>Delivery failed · #${esc(o.id)}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <form class="dialog-body" data-action="confirm-delivery-failed">
        <div class="notice notice-warn" style="margin-bottom:10px">${ic("alert")}<span>The order is cancelled, the items go back into the store's stock, and any refund follows the normal cancellation rules${isCod(o) ? " (cash order — nothing to refund)" : ""}. The rider is free for new orders once the trip's other stops are done.</span></div>
        <label class="field"><span class="field-label">Reason *</span><select class="input" name="reason">${DELIVERY_FAIL_REASONS.map((r) => `<option>${r}</option>`).join("")}</select></label>
        <label class="field"><span class="field-label">Note</span><input class="input" name="note" placeholder="Optional — e.g. called twice, no answer" /></label>
        <div class="form-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Back</button><button type="submit" class="btn btn-outline-danger">Mark delivery failed</button></div>
      </form>
    </div>
  </div>`;
}
Actions["open-delivery-failed"] = (el) => { UI.modal = { type: "deliveryFailed", orderId: el.dataset.id, by: el.dataset.by || "store" }; render(); };
Submits["confirm-delivery-failed"] = (form) => {
  const fd = new FormData(form);
  const m = UI.modal;
  const reason = [fd.get("reason"), String(fd.get("note") || "").trim()].filter(Boolean).join(" · ");
  const by = m.by === "rider" ? (State.session && State.session.name) || "Rider" : (currentUser() || {}).name || "Store";
  const ok = failDelivery(m.orderId, reason, by);
  UI.modal = null;
  if (m.by === "rider") UI.riderOpenId = null;
  showToast(ok ? `#${m.orderId} cancelled — delivery failed. Items returned to stock.` : "This order is not out for delivery", ok ? "danger" : "danger");
  render();
};
(() => {
  const extra = extraModal;
  window.extraModal = (type) => type === "codCollect" ? codCollectModal() : type === "deliveryFailed" ? deliveryFailedModal() : extra(type);
})();

/* ---------------- 9. Admin orders: drawer buttons, cash amounts, riders rail, on-trip riders ---------------- */
(() => {
  const drawer = orderDrawerHTML;
  window.orderDrawerHTML = () => {
    let html = drawer();
    const o = State.orders.find((x) => x.id === UI.orderDrawerId);
    if (!o) return html;
    if (isCod(o)) {
      const due = cashToCollect(o);
      html = html.replace(`Rider collects <b>${money(o.total)}</b> in cash on delivery`, `Rider collects <b>${money(due)}</b> in cash on delivery${due !== round2(o.total) ? ` <span class="qk-muted small">(bill ${money(o.total)}, adjusted)</span>` : ""}${o.cashCollected ? ` · collected by ${esc(o.cashCollected.byName || o.cashCollected.by)}` : ""}`);
    }
    if (o.status === "picked_up" && canEdit(currentUser(), "orders")) {
      html = html.replace('<button class="btn btn-outline btn-sm" data-action="print-pick-slip"', `<button class="btn btn-outline-danger btn-sm" data-action="open-delivery-failed" data-id="${o.id}" data-by="store">${ic("alert")} Delivery failed…</button><button class="btn btn-outline btn-sm" data-action="print-pick-slip"`);
    }
    if (o.deliveryFailed) {
      html = html.replace('<div class="drawer-actions">', `<div class="notice notice-warn" style="margin:8px 0">${ic("alert")}<span><b>Delivery failed</b> — ${esc(o.deliveryFailed.reason)} · ${esc(o.deliveryFailed.by)} · ${fmtDateTime(o.deliveryFailed.at)}. Items returned to stock.</span></div><div class="drawer-actions">`);
    }
    return html;
  };
  const rail = opsRailHTML;
  window.opsRailHTML = (inScope) => {
    let html = rail(inScope);
    State.partners.forEach((p) => {
      const cash = riderCashOnHand(p.id);
      if (!cash.amount) return;
      html = html.replace(`<b>${esc(p.name)}</b><span class="qk-muted small">`, `<b>${esc(p.name)}</b><span class="qk-muted small">${ic("wallet")} ${money(cash.amount)} cash · `);
    });
    return html;
  };
})();
// RIDER_ON_TRIP: a rider who has left the store takes nothing new until every order on the trip is closed.
function riderOnTrip(partnerId) { return State.orders.some((o) => o.deliveryPartnerId === partnerId && o.status === "picked_up"); }
function riderStopsLeft(partnerId) { return State.orders.filter((o) => o.deliveryPartnerId === partnerId && o.status === "picked_up").length; }
(() => {
  const fit = riderFit;
  window.riderFit = (p, orders) => {
    const f = fit(p, orders);
    if (p.active !== false && riderOnTrip(p.id)) {
      const n = riderStopsLeft(p.id);
      f.canTake = false; f.suggested = false; f.onTrip = true; f.blocker = "On delivery"; f.warning = "";
      f.notes = [`Back after ${n} stop${n === 1 ? "" : "s"}`];
    }
    return f;
  };
  const modal = assignRiderModal;
  window.assignRiderModal = () => {
    let html = modal();
    State.partners.forEach((p) => {
      if (!riderOnTrip(p.id)) return;
      html = html.split(`<button type="button" class="link-btn as-force" data-action="assign-ask-force" data-partner="${p.id}">Assign anyway…</button>`).join(`<span class="qk-muted small">can take new orders when the trip is finished</span>`);
    });
    return html;
  };
  const assign = Actions["assign-rider"];
  if (assign) Actions["assign-rider"] = (el) => {
    const p = findPartner(Number(el.dataset.partner));
    if (p && riderOnTrip(p.id)) { showToast(`${p.name} is out on a delivery and can take new orders when the trip is finished`, "danger"); return; }
    return assign(el);
  };
})();

/* ---------------- 10. Rider app: cash banner, cash with you, couldn't deliver ---------------- */
(() => {
  const card = riderOrderCard;
  window.riderOrderCard = (order) => {
    let html = card(order);
    if (UI.riderOpenId !== order.id) return html;
    if (isCod(order) && order.status !== "delivered") {
      html = html.replace('<div class="admin-order-body">', `<div class="admin-order-body"><div class="drawer-cash">${ic("wallet")} Collect <b>${money(cashToCollect(order))}</b> in cash at the door${order.cashCollected ? " — collected ✓" : ""}</div>`);
    }
    if (order.status === "picked_up") {
      html = html.replace("Complete delivery</button>", `Complete delivery</button><button class="btn btn-outline-danger btn-block" data-action="open-delivery-failed" data-id="${order.id}" data-by="rider">Couldn't deliver…</button>`);
    }
    return html;
  };
  const tab = riderTabContent;
  window.riderTabContent = (session, ready) => {
    const html = tab(session, ready);
    if (UI.riderTab === "history" || UI.riderTab === "earnings") return html;
    const cash = riderCashOnHand(session.partnerId);
    if (!cash.count) return html;
    return `<div class="notice notice-warn" style="margin-bottom:10px">${ic("wallet")}<span><b>Cash with you: ${money(cash.amount)}</b> · ${cash.count} cash order${cash.count === 1 ? "" : "s"} since you went online. Hand it in at the store when your shift ends.</span></div>${html}`;
  };
})();

/* ---------------- 11. Customers: staff goodwill cap from settings ---------------- */
(() => {
  window.customerModal = () => {
    const m = UI.modal;
    const c = customerRecords().find((x) => x.key === m.key);
    if (!c) return "";
    const g = goodwillSettings();
    const usedRecently = customerMeta(c.key).credits.filter((cr) => cr.at >= Date.now() - g.days * 86400000).reduce((s, cr) => s + cr.amount, 0);
    const left = Math.max(0, round2(g.staffCap - usedRecently));
    const title = { credit: "Add wallet credit", message: "Send a message", block: "Block customer", unblock: "Unblock customer" }[m.kind];
    const body = m.kind === "credit" ? `
    <div class="qk-muted small" style="margin-bottom:10px">Goodwill credit goes straight into ${esc(c.name)}'s wallet and shows in their wallet history. Limit: ${money(g.staffCap)} per customer in ${g.days} days — <b>${money(left)}</b> left. This is separate from the bonus on unavailable items.</div>
    <label class="field"><span class="field-label">Amount (S$) *</span><input class="input" type="number" name="amount" min="0.5" max="${left}" step="0.5" required ${left ? "" : "disabled"} /></label>
    <label class="field"><span class="field-label">Reason *</span><select class="input" name="reason"><option>Late delivery</option><option>Damaged item</option><option>Wrong item</option><option>Missing item</option><option>Service recovery</option></select></label>
    <label class="field"><span class="field-label">Note</span><input class="input" name="note" placeholder="Optional — e.g. order number" /></label>`
    : m.kind === "message" ? `
    <label class="field"><span class="field-label">Send by</span><select class="input" name="channel">${["Push", "SMS", "Email"].map((ch) => `<option ${State.notificationConfig[ch.toLowerCase()] && !State.notificationConfig[ch.toLowerCase()].enabled ? "disabled" : ""}>${ch}</option>`).join("")}</select></label>
    <label class="field"><span class="field-label">Message *</span><textarea class="input" name="text" rows="3" maxlength="300" required placeholder="e.g. Sorry, your order is running 15 minutes late."></textarea></label>
    <div class="qk-muted small">For one-off service messages (the "Message from the store" template). Order updates are sent automatically from the templates in Setup ▸ Notifications.</div>`
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
  };
  const save = Submits["save-customer-modal"];
  Submits["save-customer-modal"] = (form) => {
    const m = UI.modal;
    if (!m || m.kind !== "credit") return save(form);
    const fd = new FormData(form);
    const g = goodwillSettings();
    const by = (currentUser() || {}).name || "Admin";
    const meta = customerMeta(m.key);
    const amount = round2(fd.get("amount"));
    const used = meta.credits.filter((cr) => cr.at >= Date.now() - g.days * 86400000).reduce((s, cr) => s + cr.amount, 0);
    if (!(amount > 0)) { UI.modal.error = "Enter an amount"; render(); return; }
    if (amount > g.staffCap - used + 0.001) { UI.modal.error = `Only ${money(Math.max(0, g.staffCap - used))} left in this period for this customer`; render(); return; }
    const reason = [fd.get("reason"), String(fd.get("note") || "").trim()].filter(Boolean).join(" · ");
    saveCustomerMeta(m.key, { credits: [...meta.credits, { at: Date.now(), by, amount, reason }] });
    if (m.key === State.demoCustomerName) { State.wallet = round2(State.wallet + amount); persist("wallet"); }
    showToast(`${money(amount)} added to ${m.key}'s wallet`);
    UI.modal = null; render();
  };
})();

/* ---------------- 12. Import dialog: limits ---------------- */
(() => {
  const modal = bulkImportModal;
  window.bulkImportModal = () => modal().replace("(.xlsx or .csv — first sheet, first row = column names)", "(.xlsx or .csv, up to 5 MB / 10,000 rows — first sheet, first row = column names)");
})();

/* ---------------- 13. Settings handlers ---------------- */
Object.assign(Actions, {
  "save-fee-tax"() {
    State.tax = { ...State.tax, taxOnDeliveryFee: document.getElementById("taxDeliveryFeeInput").checked, taxOnExpressCharge: document.getElementById("taxExpressInput").checked };
    persist("tax"); showToast("Saved — applies to new orders only"); render();
  },
  "save-timing"() {
    const next = { ...timingSettings() };
    Object.keys(DEFAULT_TIMING).forEach((k) => {
      const el = document.getElementById(`timing_${k}`);
      if (!el) return;
      const min = k === "expressBufferMins" ? 0 : 1;
      next[k] = Math.min(240, Math.max(min, Math.floor(Number(el.value) || 0)));
    });
    State.deliverySettings = { ...State.deliverySettings, timing: next };
    persist("deliverySettings"); applyTimingTargets(); showToast("Timing targets saved"); render();
  },
  "save-goodwill-caps"() {
    const num = (id, max) => Math.min(max, Math.max(0, Math.floor(Number(document.getElementById(id).value) || 0)));
    const next = { bonusCap: num("gwBonusCap", 1000), staffCap: num("gwStaffCap", 1000), days: Math.max(1, num("gwDays", 365)) };
    State.deliverySettings = { ...State.deliverySettings, goodwill: next };
    persist("deliverySettings"); showToast(`Saved: bonus up to ${money(next.bonusCap)}, staff credit up to ${money(next.staffCap)} per ${next.days} days`); render();
  },
});

/* ---------------- 14. Customer slot picker: plain pills (user, 2026-09-30) ---------------- */
// The colour states (Available / Filling fast / Almost full) stay on the admin Delivery Slots screen,
// where staff need the load at a glance. Customers get plain pills; slots they can't book are greyed
// out with the reason, and the chosen one is blue.
(() => {
  const NOT_BOOKABLE_TEXT = { full: "Full", closed: "Closed", past: "Cut-off passed" };
  window.checkoutSlotPickerHTML = (branch) => {
    if (!branch) return `<div class="qk-muted small">Add an address we deliver to, to see delivery times.</div>`;
    return `
  <div class="slot-groups">
    ${slotDays().map((d) => `
      <div class="slot-group">
        <div class="slot-group-day">${esc(d.label)}</div>
        <div class="slot-pill-row">
          ${slotsFor(branch.id, d.date).map((s) => {
            const inf = slotInfo(branch.id, d.date, s);
            const ok = slotBookable(inf);
            const why = ok ? "" : NOT_BOOKABLE_TEXT[inf.level] || "Not available";
            return `<button type="button" class="slot-pill plain ${UI.scheduledSlot === inf.key ? "active" : ""}" data-action="set-scheduled-slot" data-slot="${inf.key}" ${ok ? "" : "disabled"}${why ? ` title="${why}"` : ""}>
              <span class="slot-pill-time">${fmtSlotRange(s)}</span>
              ${why ? `<span class="slot-pill-state">${why}</span>` : ""}
            </button>`;
          }).join("")}
        </div>
      </div>`).join("")}
  </div>`;
  };
})();

/* ---------------- 15. Order confirmation mode (D71, user 2026-09-30) ---------------- */
// automatic (the backend's default): a paid or cash order is confirmed the moment it is placed and the
// first staff step is "Start picking". manual: it waits as "New — accept" until staff tap Accept (or
// cancel it). Either way the customer sees "Confirmed" once paid.
State.deliverySettings = { orderConfirmation: "auto", ...State.deliverySettings };
function confirmationMode() { return State.deliverySettings.orderConfirmation === "manual" ? "manual" : "auto"; }
function autoConfirm(o) {
  if (o.status !== "new") return o;
  return { ...o, status: "confirmed", autoConfirmed: true, statusHistory: [...(o.statusHistory || []), { status: "confirmed", at: Date.now() }] };
}
const PIPELINE_ALL = PIPELINE.map((s) => s.slice());
const BOARD_COLUMNS_ALL = BOARD_COLUMNS.slice();
// The console's stage list and board columns follow the mode: no "New" stage when orders confirm themselves.
function applyConfirmationMode() {
  const manual = confirmationMode() === "manual";
  PIPELINE.length = 0;
  PIPELINE_ALL.forEach(([k, label]) => {
    if (k === "new" && !manual) return;
    PIPELINE.push([k, k === "new" ? "New — accept" : k === "confirmed" && !manual ? "New (paid / COD)" : label]);
  });
  BOARD_COLUMNS.length = 0;
  BOARD_COLUMNS_ALL.forEach((k) => { if (k !== "new" || manual) BOARD_COLUMNS.push(k); });
  ADVANCE_LABEL.new = "Accept order";
}
applyConfirmationMode();
function confirmNewOrders() {
  let n = 0;
  State.orders = State.orders.map((o) => { if (o.status === "new") { n++; return autoConfirm(o); } return o; });
  if (n) persist("orders");
  return n;
}
(() => {
  // Placing an order (customer app) and the demo button both create "new" orders; in automatic mode they
  // confirm at once, as the backend does for a paid or cash order.
  const pay = handlePay;
  window.handlePay = (method) => { const r = pay(method); if (confirmationMode() === "auto" && confirmNewOrders()) render(); return r; };
  const demo = addDemoLiveOrders;
  window.addDemoLiveOrders = () => { const r = demo(); if (confirmationMode() === "auto") confirmNewOrders(); return r; };
})();
function confirmationCardHTML(editable) {
  const mode = confirmationMode();
  const dis = editable ? "" : "disabled";
  const pending = State.orders.filter((o) => o.status === "new").length;
  return `
  <div class="summary-card" style="max-width:560px; margin-top:16px">
    <div class="summary-card-title">Order confirmation</div>
    <div class="qk-muted small">How a new order enters your queue. Either way the customer sees "Confirmed" once they have paid; an unpaid online order only ever shows under "Awaiting payment".</div>
    <label class="stock-toggle-lg" style="margin-top:10px"><input type="radio" name="confirmMode" value="auto" ${mode === "auto" ? "checked" : ""} ${dis} /><span><b>Automatic</b> <span class="qk-muted small">— a paid or cash order is confirmed the moment it is placed; the first step is "Start picking". (Default)</span></span></label>
    <label class="stock-toggle-lg"><input type="radio" name="confirmMode" value="manual" ${mode === "manual" ? "checked" : ""} ${dis} /><span><b>Manual</b> <span class="qk-muted small">— every order waits as "New — accept" until your team taps Accept (or cancels it). The "accept" target and alert below apply.</span></span></label>
    ${pending && mode === "manual" ? `<div class="qk-muted small" style="margin-top:6px">${pending} order${pending === 1 ? "" : "s"} waiting to be accepted right now — switching to automatic confirms them.</div>` : ""}
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-confirmation-mode">Save</button>` : ""}
  </div>`;
}
Actions["save-confirmation-mode"] = () => {
  const el = document.querySelector('input[name="confirmMode"]:checked');
  const mode = el && el.value === "manual" ? "manual" : "auto";
  State.deliverySettings = { ...State.deliverySettings, orderConfirmation: mode };
  persist("deliverySettings");
  const confirmed = mode === "auto" ? confirmNewOrders() : 0;
  applyConfirmationMode();
  showToast(mode === "auto" ? `Automatic confirmation on${confirmed ? ` — ${confirmed} waiting order${confirmed === 1 ? "" : "s"} confirmed` : ""}` : "Manual confirmation on — new orders wait for Accept");
  render();
};

/* ---------------- 16. What's changed ---------------- */
WHATS_NEW.unshift({ area: "Backend alignment (round 7)", items: [
  ["GST on delivery charges", "Setup ▸ Business Settings ▸ Delivery & Payments: two switches — GST on the delivery fee, GST on the express charge (both off by default). Frozen on each order."],
  ["Order timing targets", "Same tab: minutes per stage, the 'not confirmed' alert and the express due buffer are settings now; the Orders screen reads them."],
  ["Goodwill limits", "Setup ▸ Business Settings ▸ Stock Rules: the unavailable-item bonus cap and a separate cap for credits your team gives, per customer per period. Customers ▸ Add wallet credit shows what is left."],
  ["Chilled categories", "Categories: a 'Chilled / cold chain' checkbox decides which orders show the Chilled tag (Dairy & Eggs, Meat & Seafood, Frozen Foods are pre-ticked)."],
  ["Notification providers", "Setup ▸ Notifications: email through SMTP, SendGrid, Amazon SES, Mailgun or Postmark; SMS through Twilio, Vonage or Amazon SNS; the SSIR sender-ID note. New templates: cash reminder, 'we chose for you', message from the store, order assigned to a rider."],
  ["Delivery failed", "An out-for-delivery order can be marked 'Delivery failed' (reason) by the store or the rider: cancelled, items back into stock ('Returned to store' in Stock history), rider free again."],
  ["Cash on delivery", "The amount to collect is adjusted for removed or swapped items. The store or rider must confirm 'cash collected' before an order is marked delivered / collected. Riders see 'Collect S$x in cash', 'Cash with you since you went online', and the Orders rail shows cash on hand per rider."],
  ["On-trip riders", "Assign rider: a rider who has left the store shows 'On delivery — back after N stops' under Can't take it, with no 'Assign anyway'."],
  ["Sidebar", "Customers moved next to Orders; a Transfers shortcut (with a count) under Masters ▸ Stock. Nothing else moved."],
  ["Import", "The upload dialog states the limits: .xlsx or .csv, up to 5 MB / 10,000 rows."],
  ["Customer slot picker", "Plain pills — no colour states or legend. Full, closed and past-cut-off slots are greyed out with the reason; the chosen slot is blue. The colours stay on the admin Delivery Slots screen."],
  ["Order confirmation mode", "Setup ▸ Business Settings ▸ Delivery & Payments ▸ Order confirmation: Automatic (default — a paid or cash order is confirmed as soon as it is placed; first step 'Start picking'; no 'New' stage) or Manual (orders wait as 'New — accept' until your team taps Accept). Switching to automatic confirms the orders waiting."],
] });
