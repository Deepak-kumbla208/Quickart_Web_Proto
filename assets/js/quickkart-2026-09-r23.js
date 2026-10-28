/* ============================================================
   QuickKart prototype — Round 23 (2026-10-28)
   Notifications as the backend built them in P25 (D133, D134, MR !148):

   A. Setup ▸ Notifications ▸ Channels & providers: **every channel sets up
      its own provider in its own card, as before** (D134). Twilio SMS, Twilio
      WhatsApp and Twilio Email each take the Account SID and Auth token — a
      shop using one Twilio account types it into each card. (A shared Twilio
      card, shown earlier the same day, was dropped.)
   B. A fourth channel, **WhatsApp** — "Twilio WhatsApp": Account SID, Auth
      token, the WhatsApp number (+ optional Messaging Service SID), On / Off,
      Send test (checks the account and counts the approved templates).
   C. **Needs attention**: when a provider refuses the setup (wrong token, a
      Twilio trial account, a country not enabled, a Firebase project that does
      not match the app), that channel's card turns red with the reason;
      nothing goes through it until the settings are saved again or Send test
      passes — the other channels keep sending. (A link on the WhatsApp card
      shows it.)
   D. (No monthly limit — dropped the same day: "not required".)
   E. Message templates: a **WhatsApp** tab on the customer order updates
      with Meta's approval status, **Send by** (the order the channels are
      tried in; stop at the first that reaches the customer, or every
      channel), **Who receives** on staff alerts sent to a group (not the
      password reset or the invite — they go to one person), and **History** with
      Restore. "Submit QuickKart's templates" and "Refresh". The SMS tab
      starts off on most updates. "Not sent yet" is gone.
   F. The **Message log** (with this month's usage) is built in the backend
      but **hidden from shops for now** (D134 d) — its tab is not shown; the
      code below is kept for when QuickKart turns it on.
   ============================================================ */
(function round23Notifications() {
  const DEFS = {"messages":[{"key":"auth.otp","name":"Login code","audience":"customer","about":"A customer logs in, changes their mobile or deletes their account.","alwaysOn":true,"placeholders":["code","minutes","shopName"],"startsWith":"{{code}}","channels":{"sms":{"body":"{{code}} is your verification code. It expires in {{minutes}} minutes. Never share this code."}}},{"key":"order.placed","name":"Order placed","audience":"customer","about":"The shop takes an order — at checkout for cash and wallet orders, when the payment succeeds for online ones.","placeholders":["orderNo","total","items","fulfilmentNote","paymentNote","shopName","customerName"],"channels":{"email":{"subject":"We've got your order {{orderNo}}","body":"Hi {{customerName}},\n\nThank you for your order {{orderNo}} from {{shopName}} — {{items}}, {{total}}.\n\n{{fulfilmentNote}}\n{{paymentNote}}\n\nYou can follow your order in the {{shopName}} app."}}},{"key":"order.confirmed","name":"Order confirmed","audience":"customer","about":"The shop confirms an order (at once when confirmation is automatic).","placeholders":["orderNo","total","shopName","customerName"],"channels":{"push":{"subject":"Order confirmed","body":"{{shopName}} has confirmed your order {{orderNo}} ({{total}})."},"whatsapp":{"body":"Hi {{customerName}}, your order {{orderNo}} for {{total}} is confirmed by {{shopName}}. We will let you know when it is on its way."},"sms":{"body":"{{shopName}}: your order {{orderNo}} ({{total}}) is confirmed."}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"}},{"key":"order.slot_reminder","name":"Delivery slot reminder","audience":"customer","about":"Before a delivery slot starts — as many minutes before as Business Settings ▸ Slot reminder says.","placeholders":["orderNo","slot","shopName","customerName"],"channels":{"push":{"subject":"Your delivery is coming up","body":"Your order {{orderNo}} from {{shopName}} arrives today between {{slot}}."},"whatsapp":{"body":"Hi {{customerName}}, your order {{orderNo}} from {{shopName}} arrives today between {{slot}}. Please keep your phone close."},"sms":{"body":"{{shopName}}: order {{orderNo}} arrives today between {{slot}}."}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"},"offByDefault":["sms"]},{"key":"order.slot_moved","name":"Delivery slot changed","audience":"customer","about":"The store moves a scheduled order to another delivery window.","placeholders":["orderNo","day","slot","shopName","customerName"],"channels":{"push":{"subject":"Your delivery time has changed","body":"Your order {{orderNo}} from {{shopName}} will now be delivered on {{day}}, {{slot}}."},"whatsapp":{"body":"Hi {{customerName}}, your order {{orderNo}} from {{shopName}} will now be delivered on {{day}} in the {{slot}} slot."},"sms":{"body":"{{shopName}}: order {{orderNo}} will now be delivered on {{day}}, {{slot}}."}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"},"offByDefault":["sms"]},{"key":"order.delayed","name":"Delivery running late","audience":"customer","about":"A delivery order is past the time it was promised for and is not delivered yet — once, by the deadline watcher.","placeholders":["orderNo","shopName","customerName"],"channels":{"push":{"subject":"Running a little late","body":"Sorry — your order {{orderNo}} from {{shopName}} is taking longer than promised. We are on it and will deliver it as soon as we can."},"whatsapp":{"body":"Hi {{customerName}}, sorry, your order {{orderNo}} from {{shopName}} is taking longer than promised. We will deliver it as soon as we can."},"sms":{"body":"{{shopName}}: sorry, order {{orderNo}} is running late. We will deliver it as soon as we can."}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"},"offByDefault":["sms"]},{"key":"order.out_for_delivery","name":"Out for delivery","audience":"customer","about":"The rider leaves the store with a delivery order.","placeholders":["orderNo","shopName","customerName"],"channels":{"push":{"subject":"On its way","body":"Your order {{orderNo}} is on its way to you."},"whatsapp":{"body":"Hi {{customerName}}, your order {{orderNo}} from {{shopName}} is on its way to you now."},"sms":{"body":"{{shopName}}: your order {{orderNo}} is on its way."}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"}},{"key":"order.cash_reminder","name":"Cash reminder","audience":"customer","about":"A cash-on-delivery order leaves the store with the rider — sent instead of \"Out for delivery\".","placeholders":["orderNo","cashToCollect","shopName","customerName"],"channels":{"push":{"subject":"Please keep {{cashToCollect}} ready","body":"Your order {{orderNo}} is on its way. Please keep {{cashToCollect}} in cash ready for the rider."},"whatsapp":{"body":"Hi {{customerName}}, your order {{orderNo}} from {{shopName}} is on its way. Please keep {{cashToCollect}} in cash ready for the rider."},"sms":{"body":"{{shopName}}: order {{orderNo}} is on its way. Please keep {{cashToCollect}} in cash ready."}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"}},{"key":"order.ready_for_pickup","name":"Ready to collect","audience":"customer","about":"A pickup order is packed and waiting at the counter.","placeholders":["orderNo","storeName","shopName","customerName"],"channels":{"push":{"subject":"Ready to collect","body":"Your order {{orderNo}} is ready to collect at {{storeName}}."},"whatsapp":{"body":"Hi {{customerName}}, your order {{orderNo}} from {{shopName}} is ready to collect at {{storeName}}. Please bring your order number."},"sms":{"body":"{{shopName}}: order {{orderNo}} is ready to collect at {{storeName}}."}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"}},{"key":"order.delivered","name":"Delivered","audience":"customer","about":"A delivery order is handed over.","placeholders":["orderNo","shopName","customerName"],"channels":{"push":{"subject":"Delivered","body":"Your order {{orderNo}} has been delivered. Thank you for shopping with {{shopName}}!"}}},{"key":"order.collected","name":"Collected","audience":"customer","about":"A pickup order is collected.","placeholders":["orderNo","shopName","customerName"],"channels":{"push":{"subject":"Collected","body":"You have collected order {{orderNo}}. Thank you for shopping with {{shopName}}!"}}},{"key":"order.cancelled","name":"Order cancelled","audience":"customer","about":"An order is cancelled — by the customer, the shop, or because it was not paid in time.","placeholders":["orderNo","reason","refundNote","shopName","customerName"],"channels":{"push":{"subject":"Order cancelled","body":"Your order {{orderNo}} was cancelled: {{reason}}.{{refundNote}}"},"whatsapp":{"body":"Hi {{customerName}}, your order {{orderNo}} from {{shopName}} was cancelled. Open the app to see why and where your money goes."},"sms":{"body":"{{shopName}}: order {{orderNo}} was cancelled: {{reason}}.{{refundNote}}"}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"},"offByDefault":["sms"]},{"key":"return.approved","name":"Return approved","audience":"customer","about":"The shop approves a return request.","placeholders":["orderNo","shopName","customerName"],"channels":{"push":{"subject":"Return approved","body":"Your return for order {{orderNo}} is approved. We will let you know when it is done."},"whatsapp":{"body":"Hi {{customerName}}, your return for order {{orderNo}} is approved by {{shopName}}. We will let you know when it is done."},"sms":{"body":"{{shopName}}: your return for order {{orderNo}} is approved."}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"},"offByDefault":["sms"]},{"key":"return.rejected","name":"Return not accepted","audience":"customer","about":"The shop rejects a return request — with the reason it wrote.","placeholders":["orderNo","reason","shopName","customerName"],"channels":{"push":{"subject":"Return not accepted","body":"We could not accept your return for order {{orderNo}}: {{reason}}."},"whatsapp":{"body":"Hi {{customerName}}, your return for order {{orderNo}} could not be accepted by {{shopName}}. Open the app to see why."},"sms":{"body":"{{shopName}}: we could not accept your return for order {{orderNo}}: {{reason}}."}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"},"offByDefault":["sms"]},{"key":"return.completed","name":"Return completed","audience":"customer","about":"A return is completed — a refund is on its way to the wallet or the original payment, or the replacement is arranged.","placeholders":["orderNo","refundNote","shopName","customerName"],"channels":{"push":{"subject":"Return completed","body":"Your return for order {{orderNo}} is complete.{{refundNote}}"},"whatsapp":{"body":"Hi {{customerName}}, your return for order {{orderNo}} from {{shopName}} is complete. Open the app to see your refund."},"sms":{"body":"{{shopName}}: your return for order {{orderNo}} is complete.{{refundNote}}"}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"},"offByDefault":["sms"]},{"key":"order.item_unavailable","name":"Item unavailable","audience":"customer","about":"The store does not have an item and offers a substitute, wallet credit or a refund.","placeholders":["orderNo","itemName","shopName","customerName"],"channels":{"push":{"subject":"An item is unavailable","body":"{{itemName}} on your order {{orderNo}} is unavailable. Tap to choose a substitute or a refund."},"whatsapp":{"body":"Hi {{customerName}}, an item on your order {{orderNo}} from {{shopName}} is unavailable: {{itemName}}. Open the app to choose a substitute or a refund."},"sms":{"body":"{{shopName}}: {{itemName}} on order {{orderNo}} is unavailable. Open the app to choose."}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"},"offByDefault":["sms"]},{"key":"order.substitution_auto","name":"We chose for you","audience":"customer","about":"The customer did not answer an unavailable-item offer in time, so the shop's rule was applied.","placeholders":["orderNo","itemName","decision","shopName","customerName"],"channels":{"push":{"subject":"We chose for you","body":"No answer in time for {{itemName}} on your order {{orderNo}}, so we chose for you: {{decision}}."},"whatsapp":{"body":"Hi {{customerName}}, there was no answer in time for {{itemName}} on your order {{orderNo}}, so {{shopName}} chose for you: {{decision}}. Open the app for the details."},"sms":{"body":"{{shopName}}: no answer in time for {{itemName}} on order {{orderNo}}, so we chose: {{decision}}."}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"},"offByDefault":["sms"]},{"key":"product.back_in_stock","name":"Back in stock","audience":"customer","about":"A product a customer asked about can be bought again.","placeholders":["productName","shopName","customerName"],"channels":{"push":{"subject":"Back in stock","body":"{{productName}} is back in stock at {{shopName}}. Order it before it runs out!"}}},{"key":"customer.message","name":"Message from the store","audience":"customer","about":"A staff member writes to one customer from the Customers screen.","placeholders":["message","shopName","customerName"],"channels":{"email":{"subject":"A message from {{shopName}}","body":"Hi {{customerName}},\n\n{{message}}"},"sms":{"body":"{{shopName}}: {{message}}"},"push":{"subject":"A message from {{shopName}}","body":"{{message}}"}}},{"key":"refund.redirected_to_wallet","name":"Refund added to wallet","audience":"customer","about":"A refund that could not go back to the original payment was added to the customer’s wallet instead.","placeholders":["orderNo","amount","shopName","customerName"],"channels":{"push":{"subject":"Refund added to your wallet","body":"Your refund of {{amount}} for order {{orderNo}} was added to your wallet."},"whatsapp":{"body":"Hi {{customerName}}, your refund of {{amount}} for order {{orderNo}} from {{shopName}} was added to your wallet."},"sms":{"body":"{{shopName}}: your refund of {{amount}} for order {{orderNo}} was added to your wallet."}},"plan":{"order":["push","whatsapp","sms"],"mode":"first"},"offByDefault":["sms"]},{"key":"auth.password_reset","name":"Admin password reset","audience":"staff","about":"A staff member asks to reset their admin password (\"Forgot password\").","alwaysOn":true,"placeholders":["resetLink","minutes","shopName"],"mustContain":"{{resetLink}}","channels":{"email":{"subject":"Reset your {{shopName}} admin password","body":"Someone asked to reset the password of your {{shopName}} admin account.\n\nTo choose a new password, open this link within {{minutes}} minutes. It works once:\n{{resetLink}}\n\nIf it wasn't you, ignore this email — your password stays as it is."}}},{"key":"auth.user_invite","name":"Admin invite","audience":"staff","about":"The Super Admin adds a staff member without typing a password for them.","alwaysOn":true,"placeholders":["inviteLink","hours","shopName"],"mustContain":"{{inviteLink}}","channels":{"email":{"subject":"Your {{shopName}} admin account","body":"You have been given an admin account for {{shopName}}.\n\nTo choose your password, open this link within {{hours}} hours. It works once:\n{{inviteLink}}\n\nThen log in with this email address and your new password. If you did not expect this email, you can ignore it."}}},{"key":"stock.low","name":"Low stock","audience":"staff","about":"A store's count of a product falls to its reorder level — to the staff who manage that store's stock.","placeholders":["productName","sku","storeName","quantity","reorderLevel","shopName","customerName"],"channels":{"email":{"subject":"Low stock at {{storeName}}: {{productName}}","body":"{{productName}} ({{sku}}) is down to {{quantity}} at {{storeName}} — at or below its reorder level of {{reorderLevel}}.\n\nReceive stock on the Stock screen of the admin app. You will hear about this product at {{storeName}} again only after it is back above {{reorderLevel}}."}}},{"key":"order.at_risk_for_staff","name":"Order at risk (staff)","audience":"staff","about":"An order in the queue may miss the time it was promised for — to the staff who handle that store’s orders, once per order.","placeholders":["orderNo","storeName","stage","dueAt","minutesLeft","shopName"],"channels":{"push":{"subject":"Order {{orderNo}} may miss its time","body":"{{stage}} · due {{dueAt}} · {{minutesLeft}} min left · {{storeName}}. Open the Orders screen."}}},{"key":"order.late_for_staff","name":"Order late (staff)","audience":"staff","about":"An order in the queue is past the time it was promised for — to the staff who handle that store’s orders, once per order.","placeholders":["orderNo","storeName","stage","dueAt","minutesLate","shopName"],"channels":{"push":{"subject":"Order {{orderNo}} is late","body":"{{stage}} · was due {{dueAt}} · {{minutesLate}} min ago · {{storeName}}. Open the Orders screen."}}},{"key":"rider.assigned","name":"Order assigned to you","audience":"rider","about":"A rider is given an order.","placeholders":["orderNo","slot","stops","shopName","customerName"],"channels":{"push":{"subject":"New delivery","body":"Order {{orderNo}} · {{slot}} · {{stops}} stop(s) on your trip. Open the app to see the details."}}}],"info":{"shopName":["Your shop’s name (the trading name)","Kent Mart"],"customerName":["The person’s name (\"there\" when unknown)","Priya"],"code":["The 6-digit login code — must start the SMS","482913"],"minutes":["How many minutes it works","10"],"hours":["How many hours the link works","72"],"resetLink":["The reset link — must stay in","https://admin.kentmart.sg/reset-password?token=…"],"inviteLink":["The link to choose a password — must stay in","https://admin.kentmart.sg/set-password?token=…"],"orderNo":["The order number","QK-0512"],"total":["The amount of the order","S$42.50"],"amount":["The amount of money","S$12.50"],"items":["How many items (\"3 items\")","3 items"],"fulfilmentNote":["Delivery or pickup, as one sentence","Delivery on Mon 6 Oct, 6:00 PM – 7:00 PM."],"paymentNote":["How it is paid, as one sentence","Pay S$42.50 in cash when it arrives."],"slot":["The delivery slot","6:00 PM – 7:00 PM"],"cashToCollect":["The cash to keep ready","S$42.50"],"storeName":["The store","Clementi"],"reason":["Why — the reason the shop gave","the store closed early today"],"refundNote":["Where the money goes — empty when nothing was paid"," Your payment will be refunded to the way you paid."],"itemName":["The item","Fresh Milk 1L"],"decision":["What the shop chose","a wallet credit of S$6.38"],"productName":["The product","Fresh Milk 1L"],"message":["What the staff member wrote","Your order will be about 15 minutes late — sorry!"],"sku":["The product’s SKU","QK-0101"],"quantity":["How many are left","4"],"reorderLevel":["The reorder level","10"],"stops":["Stops on the rider’s trip","3"],"day":["The delivery day","Wed 22 Oct"],"stage":["Where the order is (\"Preparing\")","Preparing"],"dueAt":["The time it was promised for","7:00 PM, Wed 22 Oct"],"minutesLeft":["Minutes left before the promised time","12"],"minutesLate":["Minutes past the promised time","8"]}};
  const MESSAGES = DEFS.messages;
  const INFO = DEFS.info;
  const CHANNELS = ["email", "sms", "push", "whatsapp"];
  const LIMITS = { email: { subject: 150, body: 5000 }, sms: { subject: null, body: 480 }, push: { subject: 65, body: 240 }, whatsapp: { subject: null, body: 1024 } };
  const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
  const label = (ch) => ({ email: "Email", sms: "SMS", push: "Push", whatsapp: "WhatsApp" })[ch] || ch;
  const AUDIENCE = { customer: "Customer", staff: "Staff", rider: "Rider" };
  const TE = "Twilio Email";
  const has = (v) => v !== undefined && v !== null && String(v).trim() !== "";
  const val = (v) => esc(v == null ? "" : v);
  const byKey = (key) => MESSAGES.find((m) => m.key === key);
  const shopName = () => (State.companyProfile && State.companyProfile.tradingAs) || "QuickKart";
  const me = () => currentUser() || {};
  const audit = (action, entityId, before, after) => {
    const u = currentUser();
    if (u) addAuditEvent({ action, entity: action.split(".")[0], entityId, actorType: "user", actorId: u.id, before, after });
  };
  const keep = (key, fallback) => {
    State[key] = loadLS(key, fallback);
    if (!PERSIST_KEYS.includes(key)) PERSIST_KEYS.push(key);
  };

  /* ---------------- state ---------------- */
  keep("notifPlans", {});          // { key: { order, mode, staff } }
  keep("waTemplates", {});         // { key: [{ version, status, reason }] }
  keep("templateVersions", {});    // { "key/channel": [{ version, subject, body, isDefault, by, at }] }
  if (!State.messageTemplates) keep("messageTemplates", {});
  if (!State.notificationConfig.whatsapp) {
    State.notificationConfig = { ...State.notificationConfig, whatsapp: { enabled: true, provider: "Twilio WhatsApp", whatsappNumber: "", messagingServiceSid: "" } };
    persist("notificationConfig");
  }

  // Each Twilio channel keeps its own Account SID and Auth token (D134 a) — no shared card.
  const twilioReady = (c) => has(c.accountId) && !!c.tokenSet;
  const waReady = () => { const c = State.notificationConfig.whatsapp || {}; return twilioReady(c) && has(c.whatsappNumber); };
  const attentionOf = (ch) => (State.notificationConfig[ch] || {}).needsAttention || null;
  // "Who receives" only where a staff alert goes to a group (D133 i) — never the password reset or the invite.
  const GROUP_ALERTS = new Set(["stock.low", "order.new_for_staff", "order.at_risk_for_staff", "order.late_for_staff"]);
  const choosesStaff = (def) => GROUP_ALERTS.has(def.key);
  const REASONS = {
    TWILIO_ACCOUNT_REFUSED: "Twilio refused the account — check the account SID and Auth token, and that the account is active",
    TWILIO_TRIAL: "This Twilio account is a trial — it sends only Twilio’s own sample messages. Upgrade the account in the Twilio Console, then send a test",
    TWILIO_21408: "Twilio is not allowed to send to this country — check the geo permissions in the Twilio Console",
    FCM_PROJECT_MISMATCH: "The app was built for another Firebase project than the one saved here",
    NO_DEVICES: "No phone with the app is logged in",
    WHATSAPP_NOT_APPROVED: "No WhatsApp template for this message is approved yet",
    PROVIDER_NEEDS_ATTENTION: "The channel’s setup needs attention — nothing is sent through it until it is fixed",
    TEMPLATE_DISABLED: "This message is switched off on this channel",
    SMS_REJECTED: "The provider refused this SMS — usually the number is invalid, not a mobile, or the person replied STOP",
    PROVIDER_ERROR: "The provider did not take it (tried for about an hour)",
  };
  const reason = (code) => (code ? REASONS[code] || code : "");

  const attentionNotice = (code) => `<div class="notice notice-danger" style="margin:8px 0">${ic("alert")}<span><b>Needs attention:</b> ${esc(reason(code))}. Nothing is sent through it until the settings are saved again or Send test passes. Every Super Admin got one email about it.</span></div>`;

  Actions["demo-twilio-refused"] = () => {
    State.notificationConfig = { ...State.notificationConfig, whatsapp: { ...State.notificationConfig.whatsapp, needsAttention: "TWILIO_ACCOUNT_REFUSED" } };
    persist("notificationConfig");
    showToast("Prototype: Twilio refused the WhatsApp card’s account — WhatsApp is skipped (customers get the next channel) until it is fixed; SMS and email keep going", "danger");
    render();
  };

  /** A Twilio channel's own account (D134 a). */
  const twilioAccountFields = (c, dis) => `
      <div class="field-grid-2">
        <label class="field"><span class="field-label">Account SID *</span><input class="input" name="accountId" value="${val(c.accountId)}" placeholder="AC…" autocomplete="off" ${dis} /></label>
        ${secretField("token", "Auth token *", c.tokenSet && c.accountId)}
      </div>`;

  /* ---------------- B. the channel cards: Twilio fields, WhatsApp, attention, limit ---------------- */
  const prevSmsFields = smsProviderFieldsHTML;
  smsProviderFieldsHTML = function (c, dis) {
    if (c.provider !== "Twilio") return prevSmsFields(c, dis);
    return `
      <label class="field"><span class="field-label">Provider *</span><select class="input" name="provider" data-action="notif-provider-select" data-ch="sms" ${dis}>${SMS_PROVIDERS_R7.map((p) => `<option ${c.provider === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
      ${twilioAccountFields(c, dis)}
      <div class="field-grid-2">
        <label class="field"><span class="field-label">Sender ID or number * <span class="qk-muted small">(up to 11 letters, or a number)</span></span><input class="input" name="senderId" maxlength="15" value="${val(c.senderId)}" ${dis} /></label>
        <label class="field"><span class="field-label">Messaging Service SID <span class="qk-muted small">(optional)</span></span><input class="input" name="messagingServiceSid" value="${val(c.messagingServiceSid)}" placeholder="MG…" ${dis} /></label>
      </div>
      ${SSIR_NOTE}`;
  };
  // Twilio SMS and WhatsApp save their own account and sender here (D134 a); Twilio Email and the rest as before (Round 20).
  const prevSave = Actions["save-notif-channel"];
  Actions["save-notif-channel"] = (form) => {
    const ch = form.dataset.ch;
    const fd = new FormData(form);
    const provider = String(fd.get("provider") || "");
    const twilioSms = ch === "sms" && provider === "Twilio";
    if (!twilioSms && ch !== "whatsapp") return prevSave(form);
    const cur = State.notificationConfig[ch] || {};
    const next = { ...cur, provider: ch === "whatsapp" ? "Twilio WhatsApp" : provider, needsAttention: null };
    ["accountId", "senderId", "messagingServiceSid", "whatsappNumber"].forEach((k) => { if (fd.has(k)) next[k] = String(fd.get(k) || "").trim(); });
    const token = String(fd.get("token") || "");
    const tokenKept = !!cur.tokenSet && cur.provider === next.provider;
    const miss = [];
    if (!has(next.accountId)) miss.push("account SID");
    if (!token && !tokenKept) miss.push("auth token");
    if (twilioSms && !has(next.senderId)) miss.push("sender ID");
    if (ch === "whatsapp" && !has(next.whatsappNumber)) miss.push("WhatsApp number");
    if (miss.length) { showToast(`Missing: ${miss.join(", ")}`, "danger"); return; }
    if (!/^AC[0-9a-fA-F]{32}$/.test(next.accountId)) { showToast("The account SID is AC and 32 characters — copy it from the Twilio Console", "danger"); return; }
    if (token && token.length !== 32) { showToast("A Twilio Auth token is 32 characters — copy it again", "danger"); return; }
    next.tokenSet = true;
    if (ch === "whatsapp" && !/^\+[1-9][0-9]{7,14}$/.test(next.whatsappNumber)) { showToast("The WhatsApp number in international form, such as +6591234567", "danger"); return; }
    if (has(next.messagingServiceSid) && !/^MG[0-9a-fA-F]{32}$/.test(next.messagingServiceSid)) { showToast("A Messaging Service SID is MG and 32 characters", "danger"); return; }
    State.notificationConfig = { ...State.notificationConfig, [ch]: next };
    persist("notificationConfig");
    audit("notification_provider.updated", ch, null, { channel: ch, provider: next.provider });
    showToast(`${label(ch)} settings saved — every Super Admin gets an email about the change`);
    render();
  };
  Submits["save-notif-channel"] = Actions["save-notif-channel"];

  // The card: "Set up" for Twilio SMS needs its own account; a red banner when it needs attention.
  const prevCard = window.notifChannelCard;
  window.notifChannelCard = function (ch, title, icon, editable, ownFields) {
    const html = prevCard(ch, title, icon, editable, ownFields);
    const c = State.notificationConfig[ch] || {};
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    const el = t.content.querySelector(".notif-card");
    if (!el) return html;
    if (ch === "sms" && c.provider === "Twilio" && c.enabled) {
      const ready = twilioReady(c) && has(c.senderId);
      const badge = el.querySelector(".summary-card-title .badge");
      if (badge) { badge.className = `badge ${ready ? "badge-green-soft" : "badge-yellow-soft"}`; badge.textContent = ready ? "Set up" : "Not set up"; }
      const notice = el.querySelector(":scope > .notice.notice-warn");
      if (ready && notice) notice.remove();
    }
    const code = attentionOf(ch);
    if (code && c.enabled) {
      el.classList.add("notif-attention");
      const head = el.querySelector(".notif-card-head");
      if (head) head.insertAdjacentHTML("afterend", attentionNotice(code));
    }
    return t.innerHTML;
  };

  // The WhatsApp card (a fourth channel).
  function whatsappCardHTML(editable) {
    const c = State.notificationConfig.whatsapp;
    const dis = editable ? "" : "disabled";
    const ready = waReady();
    const code = attentionOf("whatsapp");
    const approved = MESSAGES.filter((m) => m.channels.whatsapp && liveVersion(m.key)).length;
    const total = MESSAGES.filter((m) => m.channels.whatsapp).length;
    return `
  <div class="summary-card notif-card ${c.enabled ? "" : "is-off"} ${code && c.enabled ? "notif-attention" : ""}">
    <div class="notif-card-head">
      <div class="summary-card-title" style="margin:0">${ic("megaphone")} WhatsApp <span class="badge ${ready ? "badge-green-soft" : "badge-yellow-soft"}">${ready ? "Set up" : "Not set up"}</span></div>
      <label class="stock-toggle"><input type="checkbox" ${c.enabled ? "checked" : ""} data-action="toggle-wa-channel" ${dis} /><span>${c.enabled ? "On" : "Off"}</span></label>
    </div>
    ${code && c.enabled ? attentionNotice(code) : ""}
    ${c.enabled ? `
    ${ready ? "" : `<div class="notice notice-warn" style="margin:8px 0">${ic("alert")}<span>Not set up yet — customers without the app get the next channel (SMS) instead. WhatsApp needs your own WhatsApp sender in your Twilio account (Meta checks your business first — it can take days).</span></div>`}
    <form data-action="save-notif-channel" data-ch="whatsapp">
      <label class="field"><span class="field-label">Provider</span><input class="input" value="Twilio WhatsApp" disabled /></label>
      ${twilioAccountFields(c, dis)}
      <div class="qk-muted small" style="margin-bottom:8px">Your own Twilio account — the same one as your Twilio SMS if you use one, typed here too.</div>
      <div class="field-grid-2">
        <label class="field"><span class="field-label">WhatsApp number *</span><input class="input" name="whatsappNumber" value="${val(c.whatsappNumber)}" placeholder="+6591234567" ${dis} /></label>
        <label class="field"><span class="field-label">Messaging Service SID <span class="qk-muted small">(optional)</span></span><input class="input" name="messagingServiceSid" value="${val(c.messagingServiceSid)}" placeholder="MG…" ${dis} /></label>
      </div>
      <div class="qk-muted small" style="margin-bottom:8px">WhatsApp only sends texts Meta approved for your business: <b>${approved} of ${total}</b> approved. See Message templates ▸ Submit QuickKart’s templates. Customers agree to these messages in your terms and conditions.</div>
      ${editable ? `<div class="form-actions"><button type="button" class="btn btn-outline" data-action="test-wa-channel">Send test</button><button type="submit" class="btn btn-primary">Save whatsapp</button></div>` : ""}
    </form>
    ${editable && ready && !code ? `<div class="qk-muted small" style="margin-top:6px"><a href="#" data-action="demo-twilio-refused">Prototype: show what happens when Twilio refuses this account</a></div>` : ""}
    ` : `<div class="qk-muted small">Off — no WhatsApp messages are sent; order updates go to the next channel.</div>`}
  </div>`;
  }
  Actions["toggle-wa-channel"] = (el) => {
    const was = !!State.notificationConfig.whatsapp.enabled;
    State.notificationConfig = { ...State.notificationConfig, whatsapp: { ...State.notificationConfig.whatsapp, enabled: !was } };
    persist("notificationConfig");
    audit("notification_provider.updated", "whatsapp", { channel: "whatsapp", enabled: was }, { channel: "whatsapp", enabled: !was });
    showToast(`WhatsApp switched ${was ? "off" : "on"} — every Super Admin gets an email about it`);
    render();
  };
  Actions["test-wa-channel"] = () => {
    if (!waReady()) { showToast("Save the WhatsApp card first — Account SID, Auth token and WhatsApp number", "danger"); return; }
    const approved = MESSAGES.filter((m) => m.channels.whatsapp && liveVersion(m.key)).length;
    State.notificationConfig = { ...State.notificationConfig, whatsapp: { ...State.notificationConfig.whatsapp, needsAttention: null } };
    persist("notificationConfig");
    audit("notification_provider.tested", "whatsapp", null, { channel: "whatsapp", provider: "Twilio WhatsApp", ok: true });
    showToast(`Twilio accepted the account. ${approved} WhatsApp template${approved === 1 ? " is" : "s are"} approved — a WhatsApp message can only use an approved one. (prototype)`);
    render();
  };

  const prevChannels = window.notifChannelsHTML;
  window.notifChannelsHTML = (editable) => {
    const grid = prevChannels(editable).trim();
    return grid.replace(/<\/div>\s*$/, `${whatsappCardHTML(editable)}</div>`);
  };

  /* ---------------- E. templates: WhatsApp, Send by, Who receives, History ---------------- */
  const saved = (key, ch) => ((State.messageTemplates[key] || {})[ch]) || null;
  const chans = (def) => CHANNELS.filter((ch) => def.channels[ch]);
  const planOf = (def) => {
    const base = def.plan ? [...def.plan.order.filter((c) => def.channels[c]), ...chans(def).filter((c) => !def.plan.order.includes(c))] : chans(def);
    const own = State.notifPlans[def.key];
    const order = own ? [...own.order.filter((c) => base.includes(c)), ...base.filter((c) => !own.order.includes(c))] : base;
    return { order, mode: (own && own.mode) || (def.plan ? def.plan.mode : "all"), staff: (own && own.staff) || [], editable: def.audience === "customer" && !!def.plan && chans(def).length > 1 };
  };
  const effective = (def, ch) => {
    const own = saved(def.key, ch);
    const fallback = def.channels[ch];
    const offByDefault = (def.offByDefault || []).includes(ch);
    return {
      subject: LIMITS[ch].subject === null ? "" : ((own && own.subject) || fallback.subject || ""),
      body: (own && own.body) || fallback.body,
      enabled: def.alwaysOn ? true : own ? own.enabled !== false : !offByDefault,
      customised: !!own && !!(own.subject || own.body),
    };
  };
  const versionsOf = (key, ch) => State.templateVersions[`${key}/${ch}`] || [];
  const waVersions = (key) => State.waTemplates[key] || [];
  function liveVersion(key) {
    const ok = waVersions(key).filter((v) => v.status === "approved");
    return ok.length ? Math.max(...ok.map((v) => v.version)) : null;
  }
  const APPROVAL_TEXT = { pending: ["Waiting for WhatsApp", "yellow"], approved: ["Approved", "green"], rejected: ["Rejected", "red"], submit_failed: ["Submit failed", "red"] };
  function approvalBadge(key) {
    const list = waVersions(key);
    if (!waReady() || !list.length) return `<span class="badge badge-gray-soft">Not submitted</span>`;
    const newest = list[list.length - 1];
    const [text, tone] = APPROVAL_TEXT[newest.status] || [newest.status, "gray"];
    return `<span class="badge badge-${tone}-soft">${text}</span>`;
  }

  // Meta's rules for a WhatsApp text (the backend checks the same before submitting).
  function waProblems(body) {
    const errs = [];
    const text = body.trim();
    const names = [...text.matchAll(PLACEHOLDER)];
    if (/^\{\{/.test(text)) errs.push("WhatsApp does not allow a placeholder at the very start");
    if (/\}\}[\s.,!?:;)"'’]*$/.test(text)) errs.push("WhatsApp does not allow a placeholder at the very end — add a few words after it");
    if (/\}\}[\s,.:;-]*\{\{/.test(text)) errs.push("WhatsApp does not allow two placeholders next to each other — put words between them");
    const words = text.replace(PLACEHOLDER, " ").split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
    if (names.length && words < 2 * names.length + 1) errs.push(`WhatsApp needs at least ${2 * names.length + 1} words for ${names.length} placeholders`);
    return errs;
  }
  function problems(def, ch, d) {
    const errs = [];
    const lim = LIMITS[ch];
    const check = (field, v) => {
      const stripped = v.replace(PLACEHOLDER, "");
      if (stripped.includes("{{") || stripped.includes("}}")) errs.push(`${field}: write placeholders as {{name}}`);
      const unknown = [...new Set([...v.matchAll(PLACEHOLDER)].map((m) => m[1]))].filter((p) => !def.placeholders.includes(p));
      if (unknown.length) errs.push(`${field}: this message has no ${unknown.map((p) => `{{${p}}}`).join(", ")}`);
    };
    if (lim.subject !== null) {
      const s = d.subject.trim();
      if (!s) errs.push(`${ch === "email" ? "Subject" : "Title"}: required`);
      else if (s.length > lim.subject) errs.push(`${ch === "email" ? "Subject" : "Title"}: at most ${lim.subject} characters`);
      check(ch === "email" ? "Subject" : "Title", s);
    }
    const b = d.body.trim();
    if (!b) errs.push("Message: required");
    else if (b.length > lim.body) errs.push(`Message: at most ${lim.body} characters`);
    check("Message", b);
    if (def.startsWith && !b.startsWith(def.startsWith)) errs.push(`Message: must start with ${def.startsWith}`);
    if (def.mustContain && !b.includes(def.mustContain)) errs.push(`Message: must contain ${def.mustContain}`);
    if (ch === "whatsapp" && b) waProblems(b).forEach((e) => errs.push(`Message: ${e}`));
    return errs;
  }
  const fill = (text) => String(text || "").replace(PLACEHOLDER, (m, k) => (k === "shopName" ? shopName() : INFO[k] ? INFO[k][1] : m));
  const previewHTML = (ch, d) => `${LIMITS[ch].subject === null ? "" : `<div style="font-weight:700">${esc(fill(d.subject))}</div>`}<div style="white-space:pre-wrap">${esc(fill(d.body))}</div>`;
  const errorsHTML = (errs) => (errs.length ? `<div class="field-error">${errs.map(esc).join("<br>")}</div>` : "");
  const planText = (p) => `${p.order.map(label).join(" → ")} <span class="qk-muted">(${p.mode === "first" ? "first that reaches the customer" : "every channel"})</span>`;

  window.notifTemplatesHTML = function (editable) {
    const cfg = State.notificationConfig;
    const waKeys = MESSAGES.filter((m) => m.channels.whatsapp);
    const approved = waKeys.filter((m) => liveVersion(m.key)).length;
    const waiting = waKeys.filter((m) => { const l = waVersions(m.key); return l.length && l[l.length - 1].status === "pending"; }).length;
    return `
  <div class="qk-muted small" style="margin-bottom:10px">Each message has its own channels, each with its own words. <code>{{placeholders}}</code> are filled in when the message is sent. Order updates try <b>push first</b>; a customer without the app gets WhatsApp, then SMS — one message, never two.</div>
  <div class="notice notice-ok" style="margin-bottom:12px;align-items:center">${ic("megaphone")}<span style="flex:1">WhatsApp texts must be <b>approved by Meta for your business</b> before they are sent: <b>${approved}</b> of ${waKeys.length} approved${waiting ? `, ${waiting} waiting` : ""}. ${waReady() ? "" : "Set up the WhatsApp card (Channels & providers) first."}</span>
    ${editable ? `<button class="btn btn-outline btn-sm" data-action="wa-submit" ${waReady() ? "" : "disabled"}>Submit QuickKart’s templates</button> <button class="btn btn-outline btn-sm" data-action="wa-refresh" ${waReady() ? "" : "disabled"}>Refresh</button>` : ""}
  </div>
  <div class="admin-table">
    ${MESSAGES.map((def) => {
      const p = planOf(def);
      return `
      <div class="admin-row">
        <div class="admin-row-info">
          <div class="admin-row-name">${esc(def.name)} <span class="badge badge-gray-soft">${AUDIENCE[def.audience]}</span></div>
          <div class="qk-muted small">${esc(def.about)}</div>
          ${p.editable ? `<div class="small" style="margin-top:2px">Send by: ${planText(p)}</div>` : ""}
          ${choosesStaff(def) && p.staff.length ? `<div class="small" style="margin-top:2px">To: ${p.staff.length} chosen staff</div>` : ""}
        </div>
        ${p.order.map((ch) => {
          const e = effective(def, ch);
          const on = e.enabled && (!cfg[ch] || cfg[ch].enabled);
          return `<span class="badge badge-${on ? "green" : "gray"}-soft">${label(ch)}${e.enabled ? "" : " — off"}${e.customised ? " ✎" : ""}</span>`;
        }).join("")}
        ${editable ? `<button class="icon-btn" data-action="edit-template" data-key="${def.key}" aria-label="Edit">${ic("edit")}</button>` : ""}
      </div>`;
    }).join("")}
  </div>`;
  };

  window.templateFormModal = function () {
    const m = UI.modal;
    const def = byKey(m.key);
    if (!def) return "";
    const ch = m.channel;
    const d = m.drafts[ch];
    const lim = LIMITS[ch];
    const p = planOf(def);
    const staff = (State.users || []).filter((u) => !u.deleted);
    const history = versionsOf(def.key, ch).slice().reverse();
    const waList = waVersions(def.key);
    const live = liveVersion(def.key);
    const newest = waList[waList.length - 1];
    return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static dialog-user" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>${esc(def.name)}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <div class="dialog-body">
        <div class="qk-muted small" style="margin-bottom:8px">${esc(def.about)}</div>
        ${p.editable ? `
        <div class="summary-card" style="margin-bottom:10px;padding:10px">
          <div class="field-label">Send by</div>
          <div class="pill-row" style="margin:6px 0">${m.plan.order.map((c, i) => `<span class="badge badge-gray-soft">${i + 1}. ${label(c)} <button type="button" class="icon-btn" data-action="plan-move" data-i="${i}" data-dir="-1" aria-label="Earlier" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="icon-btn" data-action="plan-move" data-i="${i}" data-dir="1" aria-label="Later" ${i === m.plan.order.length - 1 ? "disabled" : ""}>↓</button></span>`).join(" ")}</div>
          <label class="small"><input type="radio" name="planMode" data-action="plan-mode" value="first" ${m.plan.mode === "first" ? "checked" : ""}/> Stop at the first that reaches the customer (one message)</label><br>
          <label class="small"><input type="radio" name="planMode" data-action="plan-mode" value="all" ${m.plan.mode === "all" ? "checked" : ""}/> Send on every channel</label>
          <div class="form-actions" style="margin-top:6px"><button type="button" class="btn btn-outline btn-sm" data-action="save-plan">Save order</button></div>
          <div class="qk-muted small">The next channel is used only when the customer certainly did not get the message (no phone with the app, not approved on WhatsApp, the channel off, or "not delivered" from Twilio). Each channel still needs its own switch on.</div>
        </div>` : ""}
        ${choosesStaff(def) ? `
        <div class="summary-card" style="margin-bottom:10px;padding:10px">
          <div class="field-label">Who receives</div>
          <div class="qk-muted small" style="margin-bottom:4px">None ticked = everyone allowed to act on that store (as before).</div>
          ${staff.map((u) => `<label class="small" style="display:block"><input type="checkbox" data-action="tpl-staff" data-id="${u.id}" ${m.staff.includes(u.id) ? "checked" : ""}/> ${esc(u.name)}</label>`).join("")}
          <div class="form-actions" style="margin-top:6px"><button type="button" class="btn btn-outline btn-sm" data-action="save-plan">Save recipients</button></div>
        </div>` : ""}
        <div class="pill-row" style="margin-bottom:10px">${p.order.map((c) => `<button type="button" class="pill ${c === ch ? "active" : ""}" data-action="tpl-channel" data-ch="${c}">${label(c)}${m.drafts[c].enabled ? "" : " (off)"}</button>`).join("")}</div>
        <form data-action="save-template">
          ${ch === "whatsapp" ? `<div class="notice ${newest && newest.status === "rejected" ? "notice-danger" : "notice-ok"}" style="margin-bottom:8px">${ic("megaphone")}<span>${approvalBadge(def.key)} ${live ? `Version ${live} is sending.` : "Nothing approved yet — customers get the next channel."}${newest && newest.version !== live ? ` Version ${newest.version} ${newest.status === "rejected" ? `was rejected: ${esc(newest.reason || "")}` : "is waiting for WhatsApp"}.` : ""} A save sends the new words to WhatsApp for approval (minutes to two days); the approved words keep going out meanwhile. English only.</span></div>` : ""}
          ${def.alwaysOn
            ? `<div class="qk-muted small" style="margin-bottom:8px">Always on.</div>`
            : `<label class="stock-toggle" style="margin-bottom:8px"><input type="checkbox" ${d.enabled ? "checked" : ""} data-action="tpl-enabled" /><span>${d.enabled ? "On" : "Off"} — sent by ${label(ch)}</span></label>`}
          ${lim.subject === null ? "" : `<label class="field"><span class="field-label">${ch === "email" ? "Email subject" : "Push title"}</span><input class="input" name="subject" value="${esc(d.subject)}" oninput="onTemplateDraft23(this)" /></label>`}
          <label class="field"><span class="field-label">Message <span class="qk-muted small" id="tplBodyCount">${d.body.length}/${lim.body}</span></span><textarea class="input" name="body" rows="${ch === "email" ? 7 : 4}" oninput="onTemplateDraft23(this)">${esc(d.body)}</textarea></label>
          <div class="qk-muted small">Placeholders: ${def.placeholders.map((x) => `<code title="${esc(INFO[x] ? INFO[x][0] : x)}">{{${x}}}</code>`).join(" ")}</div>
          <div class="template-preview"><div class="qk-muted small" style="font-weight:700">Preview</div><div id="templatePreview">${previewHTML(ch, d)}</div></div>
          <div id="templateErrors">${errorsHTML(problems(def, ch, d))}</div>
          <div class="form-actions">
            <button type="button" class="btn btn-outline" data-action="reset-template">Reset ${label(ch).toLowerCase()} to default</button>
            <button type="submit" class="btn btn-primary">Save ${label(ch).toLowerCase()}</button>
          </div>
        </form>
        <div class="field-label" style="margin-top:12px">History — ${label(ch)}</div>
        ${history.length ? `<div class="admin-table">${history.map((v) => `
          <div class="admin-row">
            <div class="admin-row-info"><div class="small"><b>Version ${v.version}</b> · ${esc(v.by || "QuickKart")} · ${new Date(v.at).toLocaleString()}${v.isDefault ? " · QuickKart’s wording" : ""}${ch === "whatsapp" ? ` · ${(APPROVAL_TEXT[(waList.find((w) => w.version === v.version) || {}).status] || ["Not submitted"])[0]}` : ""}</div><div class="qk-muted small" style="white-space:pre-wrap">${esc(v.body.length > 140 ? `${v.body.slice(0, 140)}…` : v.body)}</div></div>
            <button type="button" class="btn btn-outline btn-sm" data-action="restore-version" data-v="${v.version}">Restore</button>
          </div>`).join("")}</div>` : `<div class="qk-muted small">No saved versions yet — this is QuickKart’s wording.</div>`}
      </div>
    </div>
  </div>`;
  };
  window.onTemplateDraft23 = function (el) {
    const m = UI.modal;
    if (!m || m.type !== "templateForm") return;
    const def = byKey(m.key);
    const d = m.drafts[m.channel];
    d[el.name] = el.value;
    const set = (id, html) => { const n = document.getElementById(id); if (n) n.innerHTML = html; };
    set("templatePreview", previewHTML(m.channel, d));
    set("templateErrors", errorsHTML(problems(def, m.channel, d)));
    set("tplBodyCount", `${d.body.length}/${LIMITS[m.channel].body}`);
  };

  Actions["edit-template"] = (el) => {
    const def = byKey(el.dataset.key);
    if (!def) return;
    const drafts = {};
    chans(def).forEach((ch) => { const e = effective(def, ch); drafts[ch] = { subject: e.subject, body: e.body, enabled: e.enabled }; });
    const p = planOf(def);
    UI.modal = { type: "templateForm", key: def.key, channel: p.order[0], drafts, plan: { order: [...p.order], mode: p.mode }, staff: [...p.staff] };
    render();
  };
  Actions["tpl-channel"] = (el) => { if (UI.modal) { UI.modal.channel = el.dataset.ch; render(); } };
  Actions["tpl-enabled"] = (el) => { if (UI.modal) { UI.modal.drafts[UI.modal.channel].enabled = el.checked; render(); } };
  Actions["plan-move"] = (el) => {
    const m = UI.modal;
    const i = Number(el.dataset.i);
    const j = i + Number(el.dataset.dir);
    if (!m || j < 0 || j >= m.plan.order.length) return;
    const order = [...m.plan.order];
    [order[i], order[j]] = [order[j], order[i]];
    m.plan.order = order;
    render();
  };
  Actions["plan-mode"] = (el) => { if (UI.modal) { UI.modal.plan.mode = el.value; render(); } };
  Actions["tpl-staff"] = (el) => {
    const m = UI.modal;
    if (!m) return;
    m.staff = el.checked ? [...new Set([...m.staff, el.dataset.id])] : m.staff.filter((x) => x !== el.dataset.id);
  };
  Actions["save-plan"] = () => {
    const m = UI.modal;
    const def = byKey(m.key);
    const before = planOf(def);
    State.notifPlans = { ...State.notifPlans, [def.key]: { order: m.plan.order, mode: m.plan.mode, staff: m.staff } };
    persist("notifPlans");
    audit("notification_plan.updated", def.key, { order: before.order, mode: before.mode, staff: before.staff.length }, { order: m.plan.order, mode: m.plan.mode, staff: m.staff.length });
    showToast(choosesStaff(def) ? `${def.name}: ${m.staff.length ? `${m.staff.length} chosen staff` : "everyone allowed"}` : `${def.name}: ${m.plan.order.map(label).join(" → ")}`);
    render();
  };

  // A version of the wording on every change of text (history); WhatsApp words go to Meta.
  function addVersion(def, ch, text, isDefault) {
    const key = `${def.key}/${ch}`;
    const list = versionsOf(def.key, ch);
    const version = (list.length ? list[list.length - 1].version : 0) + 1;
    State.templateVersions = { ...State.templateVersions, [key]: [...list, { version, subject: text.subject || null, body: text.body, isDefault, by: isDefault ? null : me().name, at: Date.now() }] };
    persist("templateVersions");
    if (ch === "whatsapp" && waReady()) submitVersion(def.key, version);
    return version;
  }
  function submitVersion(key, version) {
    const list = waVersions(key).filter((v) => v.version !== version);
    State.waTemplates = { ...State.waTemplates, [key]: [...list, { version, status: "pending", reason: null }].sort((a, b) => a.version - b.version) };
    persist("waTemplates");
  }

  Submits["save-template"] = () => {
    const m = UI.modal;
    const def = byKey(m.key);
    const ch = m.channel;
    const d = m.drafts[ch];
    const errs = problems(def, ch, d);
    if (errs.length) { showToast(errs[0], "danger"); render(); return; }
    const fallback = def.channels[ch];
    const subject = LIMITS[ch].subject === null || d.subject.trim() === fallback.subject ? null : d.subject.trim();
    const body = d.body.trim() === fallback.body ? null : d.body.trim();
    const before = effective(def, ch);
    const all = { ...State.messageTemplates, [def.key]: { ...(State.messageTemplates[def.key] || {}) } };
    if (!subject && !body && d.enabled && !(def.offByDefault || []).includes(ch)) delete all[def.key][ch];
    else all[def.key][ch] = { subject, body, enabled: d.enabled };
    State.messageTemplates = all;
    persist("messageTemplates");
    const after = effective(def, ch);
    const reworded = before.subject !== after.subject || before.body !== after.body;
    if (reworded) addVersion(def, ch, after, !subject && !body);
    if (reworded || before.enabled !== after.enabled) {
      audit("notification_template.updated", `${def.key}/${ch}`, { channel: ch, subject: before.subject, enabled: before.enabled }, { channel: ch, subject: after.subject, enabled: after.enabled });
    }
    showToast(`${def.name} — ${label(ch)} saved${reworded && ch === "whatsapp" ? (waReady() ? " and sent to WhatsApp for approval" : " (submitted once the WhatsApp card is set up)") : ""}`);
    render();
  };
  Actions["reset-template"] = () => {
    const m = UI.modal;
    const def = byKey(m.key);
    const ch = m.channel;
    const before = effective(def, ch);
    if (saved(def.key, ch)) {
      const all = { ...State.messageTemplates, [def.key]: { ...(State.messageTemplates[def.key] || {}) } };
      delete all[def.key][ch];
      State.messageTemplates = all;
      persist("messageTemplates");
      const after = effective(def, ch);
      if (before.body !== after.body || before.subject !== after.subject) addVersion(def, ch, after, true);
      audit("notification_template.reset", `${def.key}/${ch}`, null, { channel: ch });
    }
    const e = effective(def, ch);
    m.drafts[ch] = { subject: e.subject, body: e.body, enabled: e.enabled };
    showToast(`${def.name} — ${label(ch)} back to the default`);
    render();
  };
  Actions["restore-version"] = (el) => {
    const m = UI.modal;
    const v = versionsOf(m.key, m.channel).find((x) => x.version === Number(el.dataset.v));
    if (!v) return;
    m.drafts[m.channel] = { ...m.drafts[m.channel], subject: v.subject || "", body: v.body };
    Submits["save-template"]();
  };

  Actions["wa-submit"] = () => {
    if (!waReady()) { showToast("Set up the WhatsApp card first — WhatsApp templates are registered in the Twilio account saved there", "danger"); return; }
    let submitted = 0;
    MESSAGES.filter((m) => m.channels.whatsapp).forEach((def) => {
      const versions = versionsOf(def.key, "whatsapp");
      let newest = versions.length ? versions[versions.length - 1].version : 0;
      if (!newest) newest = addVersion(def, "whatsapp", { body: def.channels.whatsapp.body }, true);
      if (!waVersions(def.key).find((w) => w.version === newest)) { submitVersion(def.key, newest); submitted += 1; }
    });
    audit("notification_whatsapp.submitted", "whatsapp", null, { submitted });
    showToast(submitted ? `${submitted} sent to WhatsApp for approval — approval takes minutes to two days` : "Every WhatsApp message is already with WhatsApp — nothing new to submit");
    render();
  };
  Actions["wa-refresh"] = () => {
    let changed = 0;
    const next = { ...State.waTemplates };
    Object.keys(next).forEach((key) => {
      next[key] = next[key].map((v) => (v.status === "pending" ? (changed += 1, { ...v, status: "approved" }) : v));
    });
    State.waTemplates = next;
    persist("waTemplates");
    showToast(changed ? `${changed} approved by WhatsApp (prototype: every waiting template is approved on Refresh)` : "No change from WhatsApp yet");
    render();
  };

  /* ---------------- F. the message log and usage — hidden from shops for now (D134 d); kept for later ---------------- */
  const minutesAgo = (n) => Date.now() - n * 60000;
  if (!Array.isArray(State.messageLog)) {
    State.messageLog = loadLS("messageLog", [
      { id: "m1", at: minutesAgo(3), key: "order.confirmed", channel: "push", who: "Priya", to: "0 devices", status: "skipped", error: "NO_DEVICES", event: "e1" },
      { id: "m2", at: minutesAgo(3), key: "order.confirmed", channel: "whatsapp", who: "Priya", to: "****4567", status: "sent", delivery: "read", event: "e1", fallbackOf: "m1" },
      { id: "m3", at: minutesAgo(18), key: "order.out_for_delivery", channel: "push", who: "Ravi", to: "2 devices", status: "sent", event: "e2" },
      { id: "m4", at: minutesAgo(41), key: "order.cash_reminder", channel: "push", who: "Mei Ling", to: "0 devices", status: "skipped", error: "NO_DEVICES", event: "e3" },
      { id: "m5", at: minutesAgo(41), key: "order.cash_reminder", channel: "whatsapp", who: "Mei Ling", to: "****8812", status: "sent", delivery: "undelivered", providerError: "63024", event: "e3", fallbackOf: "m4" },
      { id: "m6", at: minutesAgo(40), key: "order.cash_reminder", channel: "sms", who: "Mei Ling", to: "****8812", status: "sent", delivery: "delivered", segments: 1, event: "e3", fallbackOf: "m5" },
      { id: "m7", at: minutesAgo(95), key: "order.confirmed", channel: "whatsapp", who: "Arjun", to: "****1903", status: "failed", error: "TWILIO_ACCOUNT_REFUSED", event: "e4" },
      { id: "m8", at: minutesAgo(95), key: "order.confirmed", channel: "sms", who: "Arjun", to: null, status: "skipped", error: "PROVIDER_NEEDS_ATTENTION", event: "e4", fallbackOf: "m7" },
      { id: "m9", at: minutesAgo(130), key: "stock.low", channel: "email", who: "Clark Kent (staff)", to: "c***@kentmart.sg", status: "sent", delivery: "delivered", event: "e5" },
      { id: "m10", at: minutesAgo(200), key: "order.placed", channel: "email", who: "Priya", to: "p***@example.sg", status: "sent", delivery: "read", event: "e6" },
    ]);
    if (!PERSIST_KEYS.includes("messageLog")) PERSIST_KEYS.push("messageLog");
  }
  const STATUS_TONE = { sent: "green", failed: "red", skipped: "gray", queued: "yellow" };
  const DELIVERY_TEXT = { delivered: "Delivered", read: "Read", undelivered: "Not delivered", failed: "Failed" };

  function messageLogHTML(editable) {
    const f = UI.logFilter || { status: "", channel: "" };
    const rows = State.messageLog.filter((r) => (!f.status || r.status === f.status) && (!f.channel || r.channel === f.channel)).sort((a, b) => b.at - a.at);
    const month = State.messageLog;
    const usage = ["push", "whatsapp", "sms", "email"].map((ch) => {
      const list = month.filter((r) => r.channel === ch);
      return { ch, sent: list.filter((r) => r.status === "sent").length, delivered: list.filter((r) => r.delivery === "delivered" || r.delivery === "read").length, failed: list.filter((r) => r.status === "failed").length, segments: list.reduce((s, r) => s + (r.segments || 0), 0) };
    });
    const cost = { whatsapp: "US$0.60", sms: "US$0.15" };
    return `
  <div class="qk-muted small" style="margin-bottom:8px">This month (your time zone). Twilio’s cost is read from your Twilio account once a day; the bill itself is between you and Twilio.</div>
  <div class="notif-grid" style="margin-bottom:14px">
    ${usage.map((u) => `<div class="summary-card" style="padding:10px"><div class="summary-card-title" style="margin:0">${label(u.ch)}</div>
      <div class="small">Sent <b>${u.sent}</b> · Delivered <b>${u.ch === "push" ? "—" : u.delivered}</b> · Failed <b>${u.failed}</b>${u.ch === "sms" ? ` · Parts <b>${u.segments}</b>` : ""}</div>
      <div class="qk-muted small">${u.ch === "push" ? "Free" : `Twilio: ${cost[u.ch] || "—"}`}</div></div>`).join("")}
  </div>
  <div class="pill-row" style="margin-bottom:8px">
    ${["", "sent", "failed", "skipped"].map((s) => `<button class="pill ${f.status === s ? "active" : ""}" data-action="log-filter" data-k="status" data-v="${s}">${s ? s[0].toUpperCase() + s.slice(1) : "All"}</button>`).join("")}
    <span style="width:12px"></span>
    ${["", "push", "whatsapp", "sms", "email"].map((c) => `<button class="pill ${f.channel === c ? "active" : ""}" data-action="log-filter" data-k="channel" data-v="${c}">${c ? label(c) : "Every channel"}</button>`).join("")}
  </div>
  <div class="admin-table">
    ${rows.length ? rows.map((r) => {
      const def = byKey(r.key);
      const prev = r.fallbackOf ? State.messageLog.find((x) => x.id === r.fallbackOf) : null;
      const retried = State.messageLog.some((x) => x.retryOf === r.id);
      const canRetry = (r.status === "failed" || r.status === "skipped") && !retried;
      return `
      <div class="admin-row">
        <div class="admin-row-info">
          <div class="admin-row-name">${esc(def ? def.name : r.key)} <span class="badge badge-gray-soft">${label(r.channel)}</span> <span class="badge badge-${STATUS_TONE[r.status] || "gray"}-soft">${r.status}</span>${r.delivery ? ` <span class="badge badge-${r.delivery === "undelivered" || r.delivery === "failed" ? "red" : "green"}-soft">${DELIVERY_TEXT[r.delivery]}</span>` : ""}</div>
          <div class="qk-muted small">${esc(r.who)}${r.to ? ` · ${esc(r.to)}` : ""} · ${new Date(r.at).toLocaleString()}${r.segments ? ` · ${r.segments} SMS part${r.segments === 1 ? "" : "s"}` : ""}</div>
          ${r.error ? `<div class="small" style="color:var(--danger, #b42318)">${esc(reason(r.error))}</div>` : ""}
          ${r.providerError ? `<div class="qk-muted small">Twilio said: error ${esc(r.providerError)}</div>` : ""}
          ${prev ? `<div class="qk-muted small">↳ after ${label(prev.channel)} ${prev.status === "skipped" ? "was skipped" : prev.delivery === "undelivered" ? "was not delivered" : prev.status}</div>` : ""}
          ${r.retryOf ? `<div class="qk-muted small">↳ sent again by ${esc(r.by || "an admin")}</div>` : ""}
        </div>
        ${editable && canRetry ? `<button class="btn btn-outline btn-sm" data-action="log-retry" data-id="${r.id}">Retry</button>` : ""}
      </div>`;
    }).join("") : `<div class="qk-muted small" style="padding:10px">Nothing here.</div>`}
  </div>`;
  }
  Actions["log-filter"] = (el) => { UI.logFilter = { ...(UI.logFilter || { status: "", channel: "" }), [el.dataset.k]: el.dataset.v }; render(); };
  Actions["log-retry"] = (el) => {
    const row = State.messageLog.find((r) => r.id === el.dataset.id);
    if (!row) return;
    const copy = { ...row, id: `m${Date.now()}`, at: Date.now(), status: "sent", error: null, delivery: null, providerError: null, fallbackOf: null, retryOf: row.id, by: me().name };
    State.messageLog = [...State.messageLog, copy];
    persist("messageLog");
    audit("notification.retried", copy.id, { id: row.id, status: row.status }, { id: copy.id });
    showToast("Sent again — with today’s wording and the customer’s current number (prototype)");
    render();
  };

  /* ---------------- the tabs ---------------- */
  window.adminNotifications = function () {
    const u = currentUser();
    const owner = isSuperAdmin(u);
    const tab = UI.notifTab || (owner ? "channels" : "templates");
    // The Message log tab is not shown yet (D134 d) — the backend keeps recording.
    const shown = (tab === "channels" && !owner) || tab === "log" ? "templates" : tab;
    const editable = canEdit(u, "notifications");
    return `
  <div class="pill-row">
    ${owner ? `<button class="pill ${shown === "channels" ? "active" : ""}" data-action="notif-tab" data-tab="channels">Channels &amp; providers</button>` : ""}
    <button class="pill ${shown === "templates" ? "active" : ""}" data-action="notif-tab" data-tab="templates">Message templates</button>
  </div>
  ${shown === "channels" ? `<div class="notice notice-ok" style="margin-bottom:14px">${ic("bell")}<span>Your business's <b>own</b> accounts — there is no QuickKart shared provider. One setting for all ${State.branches.length} stores. Passwords and keys are stored encrypted and are <b>never shown again</b> after saving. Only the Super Admin sees this tab, and every change emails every Super Admin.</span></div>` : ""}
  ${shown === "templates" ? notifTemplatesHTML(editable) : notifChannelsHTML(owner)}`;
  };
  Actions["notif-tab"] = (el) => { UI.notifTab = el.dataset.tab; render(); };
  window.messageLogHTML23 = messageLogHTML; // for when the tab comes back

  /* ---------------- the audit log names the new actions ---------------- */
  Object.assign(AUDIT_ACTION_TEXT, {
    "notification_plan.updated": ["Notifications", "changed how a message is sent"],
    "notification_whatsapp.submitted": ["Notifications", "sent WhatsApp templates for approval"],
    "notification.retried": ["Notifications", "sent a failed message again"],
  });
  Object.assign(AUDIT_ENTITY_LABEL, { notification_plan: "Message templates", notification_whatsapp: "Message templates", notification: "Message log" });
})();

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Round 23 — Notifications: each channel's own provider, WhatsApp, Send by, history (backend D133–D134, P25, MR !148)", items: [
  ["Each channel sets up its own provider (as before)", "Setup ▸ Notifications ▸ Channels & providers: every channel card keeps its own Provider list and its own settings. Twilio SMS, Twilio WhatsApp and Twilio Email each ask for the Account SID and Auth token (32 characters, never shown again) — a shop using one Twilio account types it into each card. The Twilio SMS card also has an optional Messaging Service SID. (The shared Twilio card shown earlier on 28 Oct is gone.)"],
  ["WhatsApp — a fourth channel", "Provider Twilio WhatsApp: Account SID, Auth token, the WhatsApp number in international form (+ optional Messaging Service SID), On / Off, Send test. WhatsApp only sends texts Meta approved for your business; the card shows how many are approved. Customers agree to these messages in your terms and conditions — nothing to tick in the app."],
  ["Needs attention", "When a provider refuses your setup — a wrong token, a country Twilio is not allowed to send to, a Firebase project that does not match the app — the card turns red with the reason. Nothing is sent through it (no pointless retries) until you save the settings again or Send test passes; every Super Admin gets one email. Only that channel stops — the others keep sending. A Twilio trial account is named as such (it sends only Twilio's sample messages until it is upgraded). A link on the WhatsApp card shows it in the prototype."],
  ["No monthly limit", "The optional monthly limit per channel shown earlier on 28 Oct is gone — not required. Every channel sends without a cap."],
  ["Send by", "Message templates: order updates try Push first; a customer without the app gets WhatsApp, then SMS — one message, never two. Open a message to change the order, or choose \"Send on every channel\". The next channel is used only when the customer certainly did not get the message. The SMS tab starts off on most updates (on for confirmed, on its way, cash reminder, ready to collect)."],
  ["WhatsApp tab", "Each order update has a WhatsApp text; its approval status shows on the WhatsApp tab of the message (not in the list) — Not submitted, Waiting for WhatsApp, Approved, Rejected (with the reason). A save sends the new words to WhatsApp; the approved words keep going out until the new ones are approved. \"Submit QuickKart's templates\" sends the whole set at once; \"Refresh\" reads WhatsApp's decisions (in the prototype every waiting text is approved on Refresh). English only; WhatsApp's rules are checked as you type."],
  ["Who receives", "Staff alerts sent to a group (new order, at risk, late, low stock) can go to chosen staff only — none ticked = everyone allowed to act on that store, as before. The admin password reset and the admin invite have no Who receives: they go to the one person concerned."],
  ["History", "Every saved wording is a version: who saved it and when, QuickKart's wording marked, Restore puts an old one back (as a new version)."],
  ["Message log — not shown for now", "The backend records what was sent, delivered, read, failed or skipped (and this month's usage with Twilio's cost), but the Message log tab is hidden from shops for now — do not build it in the admin app yet. QuickKart turns it on later."],
  ["Smaller", "\"Not sent yet\" badges are gone (every message is sent). A cash order now gets one push as it leaves — the cash reminder, which already says \"on its way\"."],
] });
