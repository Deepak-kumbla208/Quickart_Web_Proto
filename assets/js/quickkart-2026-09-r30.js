/* Round 30 (2026-11-17): the cart as a panel, and message channels provided by MyShopza.
   A. The cart opens as a panel from the right on a laptop (from an earlier prototype iteration the team liked): the
      Cart button in the header and the "View cart" bar open it over the page you are on. Inside: the delivery line,
      the items with their − / + steppers, the free-delivery bar, the bill, and the total with
      "Proceed to pay". It is built from the cart page's own pieces, so the two always agree (combos, Buy 1 Get 1,
      tax on or off, scheduled-only items). Phones and tablets keep the full cart page. Esc, the ✕ or a click outside
      closes it.
   B. Setup ▸ Notifications ▸ Channels & providers: a channel MyShopza provides for the business shows "Provided by
      MyShopza" with no provider form, so the business cannot add its own provider for it (TL, 2026-11-17). The
      on / off switch stays. A "Prototype:" link at the bottom switches SMS, email and WhatsApp between MyShopza and the
      business's own accounts. */
(function round30CartPanel() {
  UI.cartPanel = false;
  const wide = () => window.matchMedia("(min-width: 1025px)").matches;

  /* the header Cart button and the "View cart" bar open the panel instead of jumping to the cart page */
  const headerBefore = window.customerHeader;
  window.customerHeader = (...args) => headerBefore(...args).replace('class="cart-btn" data-action="go" data-route="cart"', 'class="cart-btn" data-action="open-cart"');
  const barBefore = window.floatingCartBar;
  window.floatingCartBar = (...args) => barBefore(...args).replace('class="floating-cart" data-action="go" data-route="cart"', 'class="floating-cart" data-action="open-cart"');

  /* a line shows what it costs at its quantity (3 × S$2.90 = S$8.70), with "S$2.90 each" under it from two up, so the
     price beside the picture moves with − / +. Buy 1 Get 1 savings stay in the bill (Round 25); a combo bundle already
     shows its bundle total. The cart page and the panel share these lines. */
  const cents2 = (x) => Math.round(x * 100) / 100;
  const lineBefore = window.cartLineHTML;
  window.cartLineHTML = (i, note = "") => {
    const html = lineBefore(i, note);
    if (!(i.qty > 1)) return html;
    return html
      .replace('<span class="cart-line-price-now">' + money(i.price) + '</span>', '<span class="cart-line-price-now">' + money(cents2(i.price * i.qty)) + '</span>')
      .replace('<span class="cart-line-price-mrp">' + money(i.mrp) + '</span>', '<span class="cart-line-price-mrp">' + money(cents2(i.mrp * i.qty)) + '</span>')
      .replace(/<div class="cart-line-price-row[^>]*>[\s\S]*?<\/div>/, (row) => row + '<div class="r30-each qk-muted small">' + money(i.price) + ' each</div>');
  };

  /* the panel's content: the cart page's own delivery line, lines, free-delivery bar and bill, taken from viewCart() */
  function panelHTML() {
    const t = cartTotals();
    if (!t.cartItems.length) {
      return `
      <div class="r30-panel-empty">
        <div class="empty-title">Your cart is empty</div>
        <div class="empty-hint">Free delivery on orders above ${money(State.deliverySettings.freeDeliveryThreshold)}.</div>
        <button class="btn btn-primary" data-action="close-cart-go" data-route="shop">Start shopping</button>
      </div>`;
    }
    const tpl = document.createElement("template");
    tpl.innerHTML = viewCart();
    const page = tpl.content;
    const eta = page.querySelector(".eta-banner");
    const count = page.querySelector(".cart-items-col .items-strip-title");
    const lines = page.querySelector(".cart-lines");
    const pay = page.querySelector(".cart-inline-pay-btn");
    const nudge = page.querySelector(".free-delivery-nudge");
    const bill = [...page.querySelectorAll(".summary-card")].find((c) => /Bill details/.test((c.querySelector(".summary-card-title") || {}).textContent || ""));
    if (bill) bill.querySelectorAll(".qk-muted.small").forEach((el) => { if (/wallet/i.test(el.textContent)) el.remove(); });
    /* the cart page's own pieces, in its order: the delivery card, "N items in your cart", the lines; then the
       free-delivery bar and the bill; its Proceed to pay button stays in view at the foot */
    if (pay) { pay.dataset.action = "close-cart-go"; pay.dataset.route = "checkout"; }
    return `
    <div class="r30-panel-body">
      ${eta ? eta.outerHTML : ""}
      <section class="r30-panel-items">
        ${count ? count.outerHTML : ""}
        ${lines ? lines.outerHTML : ""}
      </section>
      ${nudge ? nudge.outerHTML : ""}
      ${bill ? bill.outerHTML : ""}
    </div>
    <div class="r30-panel-foot">
      ${pay ? pay.outerHTML : `<button class="btn btn-accent btn-lg btn-block cart-inline-pay-btn" data-action="close-cart-go" data-route="checkout">Proceed to pay <span class="qk-num">· ${money(t.grandTotal)}</span></button>`}
    </div>`;
  }

  /* checkout's back arrow goes back the way you came (see back-from-checkout) */
  const checkoutHeaderBefore = window.checkoutHeader;
  window.checkoutHeader = (title, backRoute) => {
    const html = checkoutHeaderBefore(title, backRoute);
    return UI.route === "checkout" && backRoute === "cart" && UI.checkoutFrom
      ? html.replace('class="checkout-back" data-action="go" data-route="cart"', 'class="checkout-back" data-action="back-from-checkout"')
      : html;
  };
  /* checkout from the panel remembers where you were; any other way in (the cart page's Proceed to pay) goes back to the cart page as before */
  const goBefore = Actions.go;
  Actions.go = (el) => { if (el && el.dataset && el.dataset.route === "checkout") { UI.checkoutFrom = UI.fromPanel || null; UI.fromPanel = null; } goBefore(el); };

  const shellBefore = window.viewCustomerShell;
  window.viewCustomerShell = (...args) => {
    const html = shellBefore(...args);
    if (!UI.cartPanel || UI.route === "cart" || UI.route === "checkout") return html;
    return html + `
    <div class="r30-panel-layer">
      <button class="r30-panel-backdrop" data-action="close-cart" aria-label="Close cart"></button>
      <aside class="r30-panel" role="dialog" aria-modal="true" aria-labelledby="r30-panel-title">
        <div class="r30-panel-head"><h2 id="r30-panel-title">My Cart</h2><button class="dialog-close" data-action="close-cart" aria-label="Close cart">${ic("close")}</button></div>
        ${panelHTML()}
      </aside>
    </div>`;
  };

  Object.assign(Actions, {
    "open-cart"() {
      if (wide() && UI.route !== "cart" && UI.route !== "checkout") {
        UI.cartPanel = true; UI.accountMenuOpen = false; render();
        const close = document.querySelector(".r30-panel .dialog-close"); if (close) close.focus();
      } else Actions.go({ dataset: { route: "cart" } });
    },
    "close-cart"() {
      UI.cartPanel = false; render();
      const btn = document.querySelector(".cart-btn"); if (btn) btn.focus();
    },
    "close-cart-go"(el) {
      /* checkout opened from the panel remembers the page you were on, so its back arrow can return there */
      UI.fromPanel = el.dataset.route === "checkout" ? { route: UI.route, scroll: window.scrollY } : null;
      UI.cartPanel = false; Actions.go(el);
    },
    /* back from checkout: to the page you shopped on, with the cart panel open again (a laptop), or to the cart page */
    "back-from-checkout"() {
      const from = UI.checkoutFrom; UI.checkoutFrom = null;
      if (!from || !wide()) { Actions.go({ dataset: { route: "cart" } }); return; }
      Actions.go({ dataset: { route: from.route } });
      UI.cartPanel = true; render();
      window.scrollTo(0, from.scroll);
      const close = document.querySelector(".r30-panel .dialog-close"); if (close) close.focus({ preventScroll: true });
    },
  });
  document.addEventListener("keydown", (e) => {
    if (!UI.cartPanel) return;
    if (e.key === "Escape") { Actions["close-cart"](); return; }
    if (e.key !== "Tab") return;
    /* keep keyboard focus inside the open panel */
    const panel = document.querySelector(".r30-panel"); if (!panel) return;
    const f = [...panel.querySelectorAll("button:not([disabled]), a[href], input, select, textarea")];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  /* − / + redraw the page; keep keyboard focus on the same button inside the panel */
  let refocus = null;
  document.addEventListener("click", (e) => {
    const el = e.target.closest(".r30-panel [data-action][data-id]");
    refocus = el ? '.r30-panel [data-action="' + el.dataset.action + '"][data-id="' + el.dataset.id + '"]' : null;
  }, true);
  const afterBefore = window.afterRender;
  window.afterRender = (...args) => {
    afterBefore(...args);
    if (UI.cartPanel && refocus) { const el = document.querySelector(refocus); if (el) el.focus({ preventScroll: true }); }
    refocus = null;
  };
  /* a phone or tablet never shows the panel: going narrow while it is open closes it */
  window.addEventListener("resize", () => { if (UI.cartPanel && !wide()) { UI.cartPanel = false; render(); } });

  const css = document.createElement("style");
  css.textContent = `
  .r30-panel-layer { position: fixed; inset: 0; z-index: 60; }
  .r30-panel-backdrop { position: absolute; inset: 0; border: 0; padding: 0; background: rgba(15,34,51,.5); backdrop-filter: blur(2px); cursor: default; }
  body:has(.r30-panel-layer) { overflow: hidden; }
  body:has(.r30-panel-layer) .floating-cart { display: none; }
  .r30-panel { position: absolute; top: 12px; right: 12px; bottom: 12px; width: min(420px, calc(100vw - 24px)); display: flex; flex-direction: column; overflow: hidden; background: var(--bg); border-radius: var(--r-xl); box-shadow: var(--shadow-lg); animation: r30In .22s cubic-bezier(.22,1,.36,1) both; }
  @keyframes r30In { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .r30-panel { animation: none; } }
  .r30-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: var(--card); border-bottom: 1px solid var(--line); }
  .r30-panel-head h2 { margin: 0; font-size: 17px; font-weight: 800; }
  .r30-panel-body { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
  .r30-panel-body > .summary-card, .r30-panel-body > .free-delivery-nudge, .r30-panel-body > .eta-banner { margin: 0; }
  .r30-panel-items { display: grid; gap: 6px; }
  .r30-panel-items .items-strip-title { margin: 0 2px !important; }
  .r30-panel-foot .cart-inline-pay-btn { margin: 0; }
  .r30-panel-foot { padding: 12px 14px 14px; background: var(--card); border-top: 1px solid var(--line); }
  .r30-panel-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; }`;
  document.head.appendChild(css);
})();

(function round30MyShopzaChannels() {
  /* which of the business's channels MyShopza provides (set by MyShopza; here a prototype switch) */
  State.myshopzaChannels = loadLS("myshopzaChannels", {});
  const PROVIDED = ["sms", "email", "whatsapp"];
  const LABEL = { sms: "SMS", email: "Email", whatsapp: "WhatsApp" };
  const provided = (ch) => !!State.myshopzaChannels[ch];
  const anyProvided = () => PROVIDED.some(provided);

  /* a provided channel's card: its title and on / off switch stay; the provider form, Save and Send test go */
  function providedCard(card, ch) {
    const head = card.querySelector(".notif-card-head");
    const badge = head && head.querySelector(".badge");
    if (badge) { badge.className = "badge badge-blue-soft"; badge.textContent = "Provided by MyShopza"; }
    [...card.children].forEach((el) => { if (el !== head) el.remove(); });
    card.classList.add("r30-provided");
    card.insertAdjacentHTML("beforeend", `
      <div class="notice notice-ok r30-provided-note">${ic("check")}<span><b>MyShopza provides ${LABEL[ch]}</b> for your business. There is nothing to set up here. To use your own account instead, contact MyShopza.</span></div>`);
  }
  const channelOf = (card) => {
    if (card.querySelector('[data-action="toggle-wa-channel"]')) return "whatsapp";
    const t = card.querySelector('[data-action="toggle-notif-channel"]');
    return t ? t.dataset.ch : null;
  };

  const channelsBefore = window.notifChannelsHTML;
  window.notifChannelsHTML = (...args) => {
    const html = channelsBefore(...args);
    if (!anyProvided()) return html;
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    tpl.content.querySelectorAll(".notif-card").forEach((card) => { const ch = channelOf(card); if (ch && provided(ch)) providedCard(card, ch); });
    return tpl.innerHTML;
  };

  const pageBefore = window.adminNotifications;
  window.adminNotifications = (...args) => {
    const html = pageBefore(...args);
    if (!/data-action="notif-tab" data-tab="channels"/.test(html) || !/notif-card/.test(html)) return html;
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    const intro = tpl.content.querySelector(".notice.notice-ok");
    if (intro && anyProvided()) {
      const names = PROVIDED.filter(provided).map((c) => (c === 'email' ? 'email' : LABEL[c]));
      const list = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0];
      intro.innerHTML = `${ic("bell")}<span><b>MyShopza provides ${list}</b> for your business. Your own accounts are used for the rest. Only the Super Admin sees this tab, and every change emails every Super Admin.</span>`;
    }
    const note = document.createElement("div");
    note.className = "r30-proto-switch";
    note.innerHTML = `<button type="button" class="link-btn" data-action="r30-toggle-myshopza">${anyProvided() ? "Prototype: use the business's own accounts for SMS, email and WhatsApp" : "Prototype: show SMS, email and WhatsApp as provided by MyShopza"}</button>`;
    tpl.content.appendChild(note);
    return tpl.innerHTML;
  };

  Actions["r30-toggle-myshopza"] = () => {
    const on = !anyProvided();
    State.myshopzaChannels = on ? { sms: true, email: true, whatsapp: true } : {};
    persist("myshopzaChannels");
    showToast(on ? "SMS, email and WhatsApp now show as provided by MyShopza (prototype)" : "Back to the business's own accounts (prototype)");
    render();
  };

  const css = document.createElement("style");
  css.textContent = `
  .notif-card.r30-provided .r30-provided-note { margin: 8px 0 0; }
  .r30-proto-switch { margin-top: 14px; font-size: 13px; }`;
  document.head.appendChild(css);
})();

WHATS_NEW.unshift({ area: "Round 30 — the cart as a panel; message channels provided by MyShopza (2026-11-17)", items: [
  ["The cart opens as a panel", "On a laptop, the Cart button at the top and the \"View cart\" bar open your cart as a panel from the right, over the page you are on: the delivery time, your items with − / +, how much more for free delivery, the bill, and the total with Proceed to pay. Address and coupon are changed at checkout; its back arrow returns to the page you were on, with the panel open. Phones and tablets keep the cart page. Esc, ✕ or a click outside closes the panel."],
  ["Channels provided by MyShopza", "Setup ▸ Notifications ▸ Channels & providers: when MyShopza provides SMS, email or WhatsApp for the business, that card says \"Provided by MyShopza\" with nothing to set up and no way to add your own provider; its on / off switch stays. The link at the bottom of the tab switches this on and off in the prototype."],
  ["Line totals in the cart", "A cart line shows what it costs at its quantity — 3 × S$2.90 shows S$8.70, with \"S$2.90 each\" under it — so the price beside the picture moves with − / +, in the panel and on the cart page. Buy 1 Get 1 savings stay in the bill."],
] });
