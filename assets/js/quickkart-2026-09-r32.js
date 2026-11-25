/* Round 32 (2026-11-25): a shop that MyShopza has suspended (D160).
   A. Admin app: while MyShopza has suspended the shop, every admin page shows one line at the top — new orders are
      paused, orders already placed still go out, the reason is in the email the Super Admins got. The admin app reads
      this from business.status / business.acceptingOrders on GET /admin/locale and /admin/auth/me.
   B. Customer site: a line at the top of every page says the shop is not taking orders right now; browsing still works,
      and Proceed to pay / Pay are switched off (checkout itself still answers 403 TENANT_SUSPENDED). The customer app reads
      StorefrontConfig.acceptingOrders (contract 0.33.0).
   A "Prototype:" link at the bottom of the admin Dashboard switches the suspended state on and off. */
(function round32Suspended() {
  State.shopSuspended = loadLS("shopSuspended", false);
  if (!PERSIST_KEYS.includes("shopSuspended")) PERSIST_KEYS.push("shopSuspended");
  const PAUSED = "This shop isn’t taking orders right now.";

  /* A. the admin app */
  const adminBefore = window.viewAdminShell;
  window.viewAdminShell = (...args) => {
    let html = adminBefore(...args);
    if (State.shopSuspended) {
      html = html.replace('<div class="dash-body">', `<div class="dash-body"><div class="notice notice-warn r32-paused" role="status">${ic("alert")}<span><b>MyShopza has paused new orders.</b> Customers can’t order until MyShopza reactivates your shop. Orders already placed still go out. The reason is in the email your Super Admins got.</span></div>`);
    }
    if (UI.adminTab === "dashboard") {
      html = html.replace('<div id="toastHolder"', `<div class="r32-proto-switch"><button type="button" class="link-btn" data-action="r32-toggle-suspended">${State.shopSuspended ? "Prototype: MyShopza reactivates the shop" : "Prototype: MyShopza suspends the shop"}</button></div><div id="toastHolder"`);
    }
    return html;
  };

  /* B. the customer site */
  const customerBefore = window.viewCustomerShell;
  window.viewCustomerShell = (...args) => {
    let html = customerBefore(...args);
    if (!State.shopSuspended) return html;
    html = html.replace('<main class="site-main">', `<main class="site-main"><div class="container notice-strip"><div class="notice notice-danger r32-paused" role="status">${ic("alert")}<span><b>${PAUSED}</b> You can still look around.</span></div></div>`);
    /* the buttons that lead to paying are switched off */
    html = html.replace(/<button([^>]*?)data-action="go" data-route="checkout"/g, '<button$1data-action="r32-paused" aria-disabled="true" title="' + PAUSED + '"');
    html = html.replace(/data-action="scroll-to-pay"/g, 'data-action="r32-paused" aria-disabled="true"');
    return html;
  };
  Actions["r32-paused"] = () => showToast(PAUSED, "danger");
  const payBefore = Actions["handle-pay"];
  Actions["handle-pay"] = (el) => { if (State.shopSuspended) { showToast(PAUSED, "danger"); return; } payBefore(el); };
  const goBefore = Actions.go;
  Actions.go = (el) => { if (State.shopSuspended && el.dataset.route === "checkout") { showToast(PAUSED, "danger"); return; } goBefore(el); };

  Actions["r32-toggle-suspended"] = () => {
    State.shopSuspended = !State.shopSuspended;
    persist("shopSuspended");
    showToast(State.shopSuspended ? "The shop now shows as suspended by MyShopza (prototype)" : "The shop takes orders again (prototype)");
    render();
  };

  const css = document.createElement("style");
  css.textContent = `
  .r32-paused { margin: 0 0 14px; }
  .customer-site .r32-paused { margin: 10px 0 0; }
  [aria-disabled="true"].btn { opacity: .55; cursor: not-allowed; }
  .r32-proto-switch { padding: 0 24px 18px; font-size: 13px; }`;
  document.head.appendChild(css);
})();

WHATS_NEW.unshift({ area: "Round 32 — a shop MyShopza has suspended (2026-11-25)", items: [
  ["Admin app: \"MyShopza has paused new orders\"", "While MyShopza has suspended the shop, every admin page shows one line at the top: customers can't order, orders already placed still go out, and the reason is in the email the Super Admins got. The link at the bottom of the Dashboard switches this on and off in the prototype."],
  ["Customer site: not taking orders", "While the shop is suspended, a line at the top of every page says it isn't taking orders right now. Customers can still look around; Proceed to pay and Pay are switched off."],
  ["Already in place", "The full-access role is called Super Admin, and a channel MyShopza provides shows no account details (Round 30); when the message usage comes back, it shows no Twilio cost for those channels."],
] });
