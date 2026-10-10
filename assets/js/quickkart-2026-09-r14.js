/* ====================================================================
   QuickKart prototype — Round 14 (10 October 2026): each business's OWN
   payment gateway, as the backend built it (P9-10a / b / c, decision D101,
   MR !103 on quickkart-api-service) — Razorpay is the first real gateway.
   Every change of the day is here.

   A. Setup ▸ Payments — the Super Admin only (no row in the permission
      grid; the backend allows it to the Super Admin alone). The business's
      own Razorpay account: Key ID, Key secret and Webhook secret. The money
      goes straight to the business's own Razorpay account — QuickKart
      never holds it. The two secrets are WRITE-ONLY: once saved they show
      "•••• saved — type to replace" and are never shown again; leaving one
      empty on a later save keeps it.
         API: GET / PUT / PATCH /admin/payments/provider, POST …/test.
   B. Test mode / Live — read from the Key ID (rzp_test_… / rzp_live_…). A
      LIVE server refuses a test key; the prototype only shows the badge.
   C. On / Off — Off stops NEW PayNow and card payments only. The saved keys
      stay, so refunds and late payments still work. Never refused.
   D. The business's own WEBHOOK ADDRESS (private to the business, never
      changes) with a Copy button, and the five set-up steps for the Razorpay
      dashboard (API keys, webhook + its secret + the two events, PayNow
      switched on, payment capture Automatic, Send test).
   E. Send test — a harmless read-only check of the SAVED keys; at most 5 per
      10 minutes; a plain pass / fail.
   F. Replacing or changing the keys is refused while customers are still
      paying or refunds are waiting ("The gateway cannot be replaced yet: …
      Try again when they are done.") — said on the card; switching On / Off
      and the first save are never refused. (The prototype has no payment
      "in flight", so the refusal itself is not simulated.)
   G. WHAT THE CUSTOMER IS OFFERED follows the gateway: PayNow and Card only
      (Razorpay does not offer GrabPay in Singapore); with no gateway on, or
      while it is Off, checkout lists Cash on Delivery only. Cash on Delivery
      and an order the wallet pays in full need no gateway.
   H. Business Settings ▸ Payment Methods says so: an online method also needs
      a gateway that takes it (GrabPay: "Razorpay doesn't offer GrabPay").
   I. The audit log records a change by NAME only (never a key) and a test; every
      Super Admin is emailed about a change.
   ==================================================================== */

(function round14PaymentGateway() {
  /* ---------------- 1. Data ---------------- */
  // The gateways a Super Admin can choose from: real ones only (the backend's availableGateways) — today just Razorpay.
  const GATEWAYS = [{ key: "razorpay", name: "Razorpay", methods: ["paynow", "card"] }];
  const METHOD_OF = { "PayNow": "paynow", "GrabPay": "grabpay", "Credit / Debit Card": "card" };
  const TEST_LIMIT = 5;
  const TEST_WINDOW_MS = 10 * 60 * 1000;
  const API_HOST = "https://api.quickkart.sg"; // the real value is the server's public address (API_PUBLIC_URL)
  const KEY_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const randomKey = () => Array.from({ length: 43 }, () => KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)]).join("");

  // A demo business that already has Razorpay saved with TEST keys, so every other screen keeps working; switch it Off
  // (or use a business with nothing saved) to see checkout fall back to Cash on Delivery.
  State.paymentGateway = loadLS("paymentGateway", () => ({
    provider: "razorpay",
    enabled: true,
    keyId: "rzp_test_Q1v8xK3mPz2N7a",
    keySecretSet: true,
    webhookSecretSet: true,
    webhookKey: randomKey(),
    updatedAt: Date.now(),
  }));

  const gw = () => State.paymentGateway;
  const gatewayOf = () => GATEWAYS.find((g) => g.key === gw().provider) || null;
  const isSaved = () => !!gatewayOf();
  const isOn = () => isSaved() && !!gw().enabled;
  const isTest = () => isSaved() && String(gw().keyId).startsWith("rzp_test_");
  const audit = (action, entityId, before, after) => {
    const u = currentUser();
    if (u) addAuditEvent({ action, entity: "payment_provider", entityId, actorType: "user", actorId: u.id, before, after });
  };

  /* ---------------- 2. What the customer is offered (G) ---------------- */
  // Cash on Delivery needs no gateway; PayNow / GrabPay / Card only when the business's own gateway is on and takes them.
  const offered = (name) => {
    if (name === "Cash on Delivery") return true;
    const g = gatewayOf();
    return !!g && isOn() && g.methods.includes(METHOD_OF[name]);
  };
  const baseEnabled = enabledPaymentMethods;
  window.enabledPaymentMethods = () => baseEnabled().filter(offered);

  /* ---------------- 3. The checks, in the backend's words (A) ---------------- */
  const textCheck = (v, min, max, pattern, hint) => {
    if (v.length < min || v.length > max) return `Must be ${min}–${max} characters`;
    if (pattern && !pattern.test(v)) return hint || "Has characters that are not allowed";
    return null;
  };
  const secretCheck = (v, min, max) => textCheck(v, min, max, /^\S+$/, "Must have no spaces or line breaks");
  function check(values) {
    const g = gw();
    const errors = {};
    if (!values.keyId) errors.keyId = "Required";
    else {
      const p = textCheck(values.keyId, 12, 48, /^rzp_(test|live)_[A-Za-z0-9]+$/, "Must be your Razorpay key id (rzp_live_… or rzp_test_…)");
      if (p) errors.keyId = p;
    }
    // A secret left out keeps the saved one — only an empty first save is "Required".
    if (!values.keySecret) { if (!g.keySecretSet) errors.keySecret = "Required"; }
    else { const p = secretCheck(values.keySecret, 16, 64); if (p) errors.keySecret = p; }
    if (!values.webhookSecret) { if (!g.webhookSecretSet) errors.webhookSecret = "Required"; }
    else { const p = secretCheck(values.webhookSecret, 8, 128); if (p) errors.webhookSecret = p; }
    return errors;
  }

  /* ---------------- 4. The screen (A–F) ---------------- */
  const methodsLabel = () => (gatewayOf() ? gatewayOf().methods.map((m) => (m === "paynow" ? "PayNow" : "Card")).join(" and ") : "—");
  function fieldHTML(name, label, input, hint) {
    const err = (UI.pgErrors || {})[name];
    return `<label class="field"><span class="field-label">${label}</span>${input}
      ${err ? `<div class="field-error">${esc(err)}</div>` : hint ? `<div class="qk-muted small" style="margin-top:4px">${hint}</div>` : ""}</label>`;
  }
  const SETUP_STEPS = [
    "<b>Razorpay dashboard ▸ API keys</b> — generate a key and paste its <b>Key ID</b> and <b>Key secret</b> above. Use live keys for a live shop.",
    "<b>Razorpay dashboard ▸ Webhooks ▸ Add</b> — URL: the <b>webhook address</b> above; choose a <b>secret</b> of your own and paste the same value above as the <b>Webhook secret</b>; tick <b>payment.captured</b> and <b>payment.failed</b> (other events are ignored).",
    "<b>Payment methods</b> — make sure <b>PayNow</b> and cards are switched on in your Razorpay account.",
    "<b>Payment capture</b> — keep it on <b>Automatic</b>. If it is manual, payments stay \"authorized\", Razorpay never reports them as captured and no order is ever confirmed.",
    "Press <b>Send test</b> — \"Razorpay accepted the settings.\" means the keys work.",
  ];

  window.adminPayments = function () {
    const g = gw();
    const saved = isSaved();
    const draft = UI.pgDraft || {};
    const dis = "";
    const keyIdValue = draft.keyId !== undefined ? draft.keyId : g.keyId || "";
    const url = saved ? `${API_HOST}/api/v1/webhooks/payments/razorpay/${g.webhookKey}` : "";
    return `
  <div class="notice notice-ok" style="margin-bottom:14px">${ic("wallet")}<span>Your business's <b>own</b> payment gateway — customers pay straight into <b>your</b> account and QuickKart never holds the money. One setting for all ${State.branches.length} stores.</span></div>
  ${isOn() ? "" : `<div class="notice notice-warn" style="margin-bottom:14px">${ic("alert")}<span>${saved
      ? "Online payments are <b>off</b> — PayNow and Card are hidden at checkout. <b>Cash on Delivery and orders paid in full from the wallet still work.</b> Your saved keys stay, so refunds and late payments still work."
      : "No gateway is set up — PayNow, GrabPay and Card are hidden at checkout. <b>Cash on Delivery and orders paid in full from the wallet still work.</b>"}</span></div>`}
  <div class="summary-card notif-card ${saved && !g.enabled ? "is-off" : ""}" style="max-width:640px">
    <div class="notif-card-head">
      <div class="summary-card-title" style="margin:0">${ic("card")} Payment gateway
        <span class="badge ${saved ? "badge-green-soft" : "badge-yellow-soft"}">${saved ? "Set up" : "Not set up"}</span>
        ${saved ? `<span class="badge ${isTest() ? "badge-yellow-soft" : "badge-green-soft"}">${isTest() ? "Test mode" : "Live"}</span>` : ""}</div>
      <label class="stock-toggle"><input type="checkbox" ${isOn() ? "checked" : ""} data-action="toggle-payment-gateway" ${saved ? "" : "disabled"} /><span>${isOn() ? "On" : "Off"}</span></label>
    </div>
    ${isTest() ? `<div class="notice notice-warn" style="margin:8px 0">${ic("alert")}<span><b>Test mode</b> — no real money moves. A live server refuses a test key: enter your live keys before you open the shop.</span></div>` : ""}
    <form data-action="save-payment-gateway">
      <label class="field"><span class="field-label">Gateway</span>
        <select class="input" name="provider" ${dis}>${GATEWAYS.map((x) => `<option value="${x.key}" selected>${esc(x.name)} — ${x.methods.map((m) => (m === "paynow" ? "PayNow" : "Card")).join(" and ")}</option>`).join("")}</select>
        <div class="qk-muted small" style="margin-top:4px">GrabPay isn't offered by Razorpay in Singapore. More gateways will appear here as they are added.</div>
      </label>
      ${fieldHTML("keyId", "Key ID", `<input class="input" name="keyId" value="${esc(keyIdValue)}" placeholder="rzp_live_…" autocomplete="off" ${dis} />`, "Public — it is also given to the customer's app for Razorpay's checkout.")}
      ${fieldHTML("keySecret", "Key secret", `<input class="input" type="password" name="keySecret" value="${esc(draft.keySecret || "")}" placeholder="${g.keySecretSet ? "•••• saved — type to replace" : "Paste your Key secret"}" autocomplete="new-password" ${dis} />`, g.keySecretSet ? "Never shown again. Leave empty to keep the saved one." : "Never shown again once saved.")}
      ${fieldHTML("webhookSecret", "Webhook secret", `<input class="input" type="password" name="webhookSecret" value="${esc(draft.webhookSecret || "")}" placeholder="${g.webhookSecretSet ? "•••• saved — type to replace" : "The secret you set on the Razorpay webhook"}" autocomplete="new-password" ${dis} />`, g.webhookSecretSet ? "Never shown again. Leave empty to keep the saved one." : "The same secret you type into Razorpay's webhook settings.")}
      <div class="qk-muted small" style="margin:2px 0 10px">Takes ${methodsLabel()}. Changing the keys is refused while customers are still paying or refunds are waiting — try again in a few minutes. Switching On / Off is never refused.</div>
      <div class="form-actions"><button type="button" class="btn btn-outline" data-action="test-payment-gateway" ${saved ? "" : "disabled"}>Send test</button><button type="submit" class="btn btn-primary">Save gateway</button></div>
    </form>
  </div>
  ${saved ? `
  <div class="summary-card" style="max-width:640px; margin-top:16px">
    <div class="summary-card-title">Your webhook address</div>
    <div class="qk-muted small">Private to your business and it never changes. Paste it into Razorpay's webhook settings — Razorpay tells QuickKart here when a payment is paid or declined.</div>
    <div style="display:flex; gap:8px; margin-top:10px"><input class="input" readonly value="${esc(url)}" style="flex:1; font-family:monospace; font-size:12px" onfocus="this.select()" /><button type="button" class="btn btn-outline" data-action="copy-payment-webhook">Copy</button></div>
  </div>` : ""}
  <div class="summary-card" style="max-width:640px; margin-top:16px">
    <div class="summary-card-title">Set-up checklist</div>
    <ol class="qk-muted small" style="margin:8px 0 0 18px; padding:0; line-height:1.6">${SETUP_STEPS.map((s) => `<li>${s}</li>`).join("")}</ol>
  </div>
  <div class="summary-card" style="max-width:640px; margin-top:16px">
    <div class="summary-card-title">Good to know — Razorpay's own rules</div>
    <ul class="qk-muted small" style="margin:8px 0 0 18px; padding:0; line-height:1.6">
      <li>The <b>PayNow QR is valid for 10 minutes</b>; your customer has 15 minutes to pay an order. If the QR lapses they tap <b>Pay</b> again.</li>
      <li>PayNow needs <b>at least S$1</b> and has a <b>S$2,000 daily limit</b>; PayNow refunds are possible <b>within 30 days</b>.</li>
      <li>Refunds go back to the customer's original method; QuickKart makes each refund once, even if it has to retry.</li>
      <li>Every change here is in the <b>Audit log</b> (what changed — never a key) and <b>every Super Admin is emailed</b> about it.</li>
    </ul>
  </div>`;
  };

  /* ---------------- 5. Actions: save, switch, test, copy (A, C, E, I) ---------------- */
  Submits["save-payment-gateway"] = (form) => {
    const g = gw();
    const values = { keyId: form.elements.keyId.value, keySecret: form.elements.keySecret.value, webhookSecret: form.elements.webhookSecret.value };
    UI.pgDraft = values;
    UI.pgErrors = check(values);
    if (Object.keys(UI.pgErrors).length) { render(); return; }
    const first = !isSaved();
    // Names of what changed only — a secret's value never reaches the log. A typed secret counts as changed.
    const changed = [];
    if (values.keyId !== g.keyId) changed.push("keyId");
    if (values.keySecret) changed.push("keySecret");
    if (values.webhookSecret) changed.push("webhookSecret");
    UI.pgDraft = null; UI.pgErrors = null;
    if (!first && changed.length === 0) { showToast("Nothing changed — nothing was saved"); render(); return; }
    const before = first ? null : { provider: g.provider, enabled: g.enabled };
    State.paymentGateway = {
      ...g,
      provider: "razorpay",
      enabled: first ? true : g.enabled,
      keyId: values.keyId,
      keySecretSet: true,
      webhookSecretSet: true,
      webhookKey: g.webhookKey || randomKey(),
      updatedAt: Date.now(),
    };
    persist("paymentGateway");
    audit("payment_provider.updated", "payments", before, { provider: "razorpay", enabled: State.paymentGateway.enabled, changedSettings: changed.sort() });
    showToast(first ? "Razorpay was set up — every Super Admin gets an email about it" : "Payment gateway saved — every Super Admin gets an email about the change");
    render();
  };

  Actions["toggle-payment-gateway"] = () => {
    const g = gw();
    if (!isSaved()) { showToast("Save a payment gateway first, then try again", "danger"); return; }
    const was = !!g.enabled;
    State.paymentGateway = { ...g, enabled: !was, updatedAt: Date.now() };
    persist("paymentGateway");
    audit("payment_provider.updated", "payments", { provider: g.provider, enabled: was }, { provider: g.provider, enabled: !was });
    showToast(`Online payments switched ${was ? "off" : "on"} — every Super Admin gets an email about it`);
    render();
  };

  Actions["test-payment-gateway"] = () => {
    if (!isSaved()) { showToast("Save a payment gateway first, then try again", "danger"); return; }
    const recent = (UI.pgTests || []).filter((t) => Date.now() - t < TEST_WINDOW_MS);
    if (recent.length >= TEST_LIMIT) { showToast("Too many tests — wait a few minutes and try again", "danger"); return; }
    UI.pgTests = [...recent, Date.now()];
    audit("payment_provider.tested", "payments", null, { provider: gw().provider, ok: true });
    showToast("Razorpay accepted the settings. (prototype — no real call is made)");
  };

  Actions["copy-payment-webhook"] = () => {
    const url = `${API_HOST}/api/v1/webhooks/payments/razorpay/${gw().webhookKey}`;
    try { navigator.clipboard.writeText(url).then(() => showToast("Webhook address copied"), () => showToast("Select the address and copy it", "danger")); }
    catch (e) { showToast("Select the address and copy it", "danger"); }
  };

  const baseTab = Actions["admin-tab"];
  Actions["admin-tab"] = (el) => { UI.pgDraft = null; UI.pgErrors = null; return baseTab(el); };

  /* ---------------- 6. Sidebar: Setup ▸ Payments, the Super Admin only ---------------- */
  (() => {
    const baseTabs = visibleAdminTabs;
    window.visibleAdminTabs = (user) => {
      const tabs = baseTabs(user);
      return isSuperAdmin(user) ? [...tabs, { key: "payments", label: "Payments", icon: "card" }] : tabs;
    };
    const baseNav = adminNavHTML;
    window.adminNavHTML = (visibleTabs) => {
      const sa = visibleTabs.some((t) => t.key === "payments");
      if (sa && UI.adminTab === "payments") UI.navOpen = { ...(UI.navOpen || {}), setup: true };
      const html = baseNav(visibleTabs);
      if (!sa) return html;
      const item = `<button class="dash-nav-item dash-nav-sub ${UI.adminTab === "payments" ? "active" : ""}" data-action="admin-tab" data-tab="payments">${ic("card")}<span>Payments</span></button>`;
      // After Notifications, before the Audit log — only while the Setup group is open.
      return html.replace(/(<button class="dash-nav-item dash-nav-sub[^"]*" data-action="admin-tab" data-tab="notifications">[\s\S]*?<\/button>)/, `$1${item}`);
    };
    const baseTitle = adminPageTitle;
    window.adminPageTitle = (key) => (key === "payments" ? `<span class="crumb">Setup ›</span> Payments` : baseTitle(key));
    const baseContent = adminTabContent;
    window.adminTabContent = (user) => {
      if (UI.adminTab !== "payments") return baseContent(user);
      return isSuperAdmin(user) ? adminPayments() : `<div class="empty-state"><div class="empty-title">You don't have access to this screen</div></div>`;
    };
  })();

  /* ---------------- 7. Business Settings ▸ Payment Methods says so (H) ---------------- */
  const deliveryPanel = window.adminDeliveryPanel;
  window.adminDeliveryPanel = (editable) => {
    let html = deliveryPanel(editable);
    html = html.replace(
      "Turn a method off to hide it from checkout — this doesn't change how payments are processed.",
      "Turn a method off to hide it from checkout. PayNow, GrabPay and Card also need a payment gateway that takes them — set one up under Setup ▸ Payments. Cash on Delivery needs none.",
    );
    State.deliverySettings.paymentMethods.forEach((m) => {
      if (m.name === "Cash on Delivery" || offered(m.name)) return;
      const why = !isOn()
        ? (isSaved() ? "Online payments are off" : "Needs a payment gateway")
        : `${gatewayOf().name} doesn't offer ${m.name}`;
      html = html.replace(`<div class="admin-row-name">${esc(m.name)}</div>`, `<div class="admin-row-name">${esc(m.name)}</div><div class="qk-muted small">${why} — customers don't see it</div>`);
    });
    return html;
  };

  /* ---------------- 8. The audit log names them (I) ---------------- */
  Object.assign(AUDIT_ACTION_TEXT, {
    "payment_provider.updated": ["Payments", "changed the payment gateway"],
    "payment_provider.tested": ["Payments", "tested the payment gateway keys"],
  });
  Object.assign(AUDIT_ENTITY_LABEL, { payment_provider: "Payments" });
})();

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Round 14 — your own payment gateway (Razorpay)", items: [
  ["Setup ▸ Payments (Super Admin only)", "Your business's own Razorpay account: Key ID, Key secret and Webhook secret. The money goes straight to your Razorpay account — QuickKart never holds it. The two secrets are write-only: once saved they show \"•••• saved — type to replace\", are never shown again, and a later save leaves them as they are when the box is empty. Test mode / Live is read from the Key ID (a live server refuses a test key)."],
  ["Off, and what the customer sees", "Off stops new PayNow and Card payments only — your saved keys stay, so refunds and late payments still work. With no gateway on, checkout lists Cash on Delivery only; Cash on Delivery and an order the wallet pays in full never need a gateway. Razorpay offers PayNow and Card in Singapore — not GrabPay."],
  ["Webhook address and set-up checklist", "Your private webhook address (Copy button) to paste into Razorpay's webhook settings, with the five steps: API keys, webhook + your own secret + the events payment.captured and payment.failed, PayNow switched on, payment capture on Automatic, Send test."],
  ["Send test, audit log and emails", "Send test checks the saved keys without charging anything (5 per 10 minutes). Every change is in the Audit log — what changed, never a key — and every Super Admin is emailed about it."],
  ["Changing the keys can be refused", "While customers are still paying or refunds are waiting, replacing the keys is refused (\"The gateway cannot be replaced yet … Try again when they are done.\"). Switching On / Off and the first save are never refused. (Said on the card; the prototype has no payment in progress to refuse.)"],
  ["Business Settings ▸ Payment Methods", "Says that PayNow, GrabPay and Card also need a gateway that takes them, and marks a method customers don't see (\"Razorpay doesn't offer GrabPay\")."],
] });
