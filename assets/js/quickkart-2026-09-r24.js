/* ============================================================
   QuickKart prototype — Round 24 (2026-10-30)
   Buy 1 Get 1 — one free unit per product, per customer, per day
   (backend D140, FX-15; customer contract 0.28.0-draft):

   A. The bill: every second unit of a Buy 1 Get 1 product is free, but a
      customer gets **one free unit of each such product a day** — 2 → 1 free,
      3 → 1, 4 → 1. Each Buy 1 Get 1 product has its own free unit. Counted
      across the day's orders; a cancelled order gives its free units back.
   B. The cart shows the **real number of units** the customer gets, with
      "1 free" (the API's `freeQty`) — not "pay for half". When the day's free
      unit is used: "already used today — full price".
   C. Add on a Buy 1 Get 1 product puts **2** in the cart (1 paid + 1 free)
      while today's free unit is unused, otherwise 1; + / − then move by 1.
   D. The order screens, the invoice and the admin order drawer say "1 free"
      (the order line's `freeQty`); the invoice charges qty − free.
   E. The product page and the admin product form state the daily rule.
   ============================================================ */
(function round24BogoDailyLimit() {
  const FREE_PER_PRODUCT_PER_DAY = 1; // hardcoded in the backend for now (D140)
  const r2 = (n) => Math.round(n * 100) / 100;
  const sameDay = (ts) => new Date(ts).toDateString() === new Date().toDateString();

  /** The free units an order line was given: frozen on new orders; half the units on orders from before. */
  const lineFree = (it) => (it.freeQty != null ? it.freeQty : it.bogo ? Math.floor(it.qty / 2) : 0);

  /** Free units of this product the signed-in customer already had today (cancelled orders do not count). */
  function freeUsedToday(id) {
    if (!State.session) return 0; // a guest has no history: the whole allowance
    return myOrders()
      .filter((o) => o.status !== "cancelled" && sameDay(o.createdAt))
      .reduce((n, o) => n + o.items.filter((it) => it.id === id).reduce((m, it) => m + lineFree(it), 0), 0);
  }
  const freeLeftToday = (id) => Math.max(0, FREE_PER_PRODUCT_PER_DAY - freeUsedToday(id));
  /** A cart line's free units — what the API sends as `freeQty`. */
  const freeQtyOf = (line) => (isBogo(line.id) ? Math.min(Math.floor(line.qty / 2), freeLeftToday(line.id)) : 0);
  window.bogoFreeQtyOf = freeQtyOf;
  window.bogoFreeLeftToday = freeLeftToday;

  /* A. The bill. The earlier rounds' totals give every second unit free; the units above today's allowance are
        handed back through the combo saving for one run (so the coupon, the delivery fee, express, tax and the
        wallet all see the right subtotal), then reported as what they are. */
  const totals = cartTotals;
  window.cartTotals = () => {
    const lines = cartLines();
    const half = lines.reduce((s, i) => s + (isBogo(i.id) ? i.price * Math.floor(i.qty / 2) : 0), 0);
    const allowed = lines.reduce((s, i) => s + i.price * freeQtyOf(i), 0);
    const excess = r2(half - allowed);
    if (!(excess > 0)) return totals();
    const combos = window.activeComboSavings;
    let t;
    try {
      window.activeComboSavings = (...args) => combos(...args) - excess;
      t = totals();
    } finally {
      window.activeComboSavings = combos;
    }
    t.bogoSavings = r2(t.bogoSavings - excess);
    t.comboDiscount = r2(t.comboDiscount + excess);
    return t;
  };

  /* B. The cart line: the real units and "1 free". */
  const cartLine = cartLineHTML;
  window.cartLineHTML = (i, note = "") => {
    const html = cartLine(i, note);
    if (!isBogo(i.id)) return html;
    const old = `<div class="qk-muted small">Buy 1 Get 1 Free — pay for ${Math.ceil(i.qty / 2)}</div>`;
    const free = freeQtyOf(i);
    const left = freeLeftToday(i.id);
    const text = free > 0
      ? `Buy 1 Get 1 · <b>${free} free</b> — you pay for ${i.qty - free}${i.qty > 2 ? " (one free a day)" : ""}`
      : left > 0
        ? "Buy 1 Get 1 — add 1 more, it's free"
        : "Buy 1 Get 1 already used today — full price";
    return html.replace(old, () => `<div class="qk-muted small${free > 0 ? " tone-green" : ""}">${text}</div>`);
  };

  /* C. Add: a pair while today's free unit is unused; then one at a time. */
  const inc = incCart;
  window.incCart = (id) => {
    if (isBogo(id) && !(State.cart[id] > 0) && freeLeftToday(id) > 0) {
      State.cart[id] = 2;
      persist("cart");
      render();
      return;
    }
    inc(id);
  };

  /* D. The order keeps what each line was given (`freeQty`). */
  const pay = handlePay;
  window.handlePay = (method) => {
    const free = new Map(cartLines().map((l) => [l.id, freeQtyOf(l)]));
    const before = State.orders[0] && State.orders[0].id;
    const result = pay(method);
    const order = State.orders[0];
    if (order && order.id !== before) {
      order.items = order.items.map((it) => ({ ...it, freeQty: free.get(it.id) || 0 }));
      persist("orders");
    }
    return result;
  };

  // The invoice: qty − free units are charged; the note says how many were free.
  window.invoiceLines = function (order) {
    const tax = order.taxSnapshot || State.tax;
    const inclusive = !tax || tax.inclusive !== false;
    return order.items.map((it, idx) => {
      const free = lineFree(it);
      const gross = it.price * (it.qty - free);
      const gst = gstAmount(gross, tax);
      return {
        sn: idx + 1, name: it.name, unit: it.unit || "—",
        hs: `2106${String(1000 + (it.id || 0) * 7).slice(0, 4)}`,
        qty: it.qty, rate: it.price, taxable: inclusive ? gross - gst : gross,
        gst, total: gross,
        note: it.resolution === "swap" ? "Replaced" : it.resolution === "removed" ? "Removed" : it.resolution ? "Refunded"
          : free > 0 ? `Buy 1 Get 1 · ${free} free` : null,
      };
    });
  };

  // The customer's order screen: "Buy 1 Get 1 · 1 free" and the amount actually charged.
  const itemRow = orderItemRowHTML;
  window.orderItemRowHTML = (order, it, idx) => {
    const html = itemRow(order, it, idx);
    if (!it.bogo) return html;
    const free = lineFree(it);
    const badge = ' <span class="badge badge-green">BOGO</span>';
    let out = html.replace(badge, () => (free > 0 ? ` <span class="badge badge-green">Buy 1 Get 1 · ${free} free</span>` : ""));
    const was = money(it.price * Math.ceil(it.qty / 2));
    const now = money(it.price * (it.qty - free));
    const at = out.lastIndexOf(was);
    if (was !== now && at >= 0) out = out.slice(0, at) + now + out.slice(at + was.length);
    return out;
  };

  // The admin order drawer: "1 free" beside the line, so the packer knows (pack every unit).
  const drawer = orderDrawerHTML;
  window.orderDrawerHTML = () => {
    let html = drawer();
    const o = State.orders.find((x) => x.id === UI.orderDrawerId);
    if (!o) return html;
    o.items.forEach((it) => {
      const free = lineFree(it);
      if (!(free > 0)) return;
      const name = `<span class="pick-name">${esc(it.name)}`;
      html = html.replace(name, () => `${name} <span class="badge badge-green">${free} free</span>`);
    });
    return html;
  };

  /* E. The rule in words. */
  const product = productModal;
  window.productModal = (id) => {
    const html = product(id);
    if (!isBogo(id)) return html;
    const used = freeLeftToday(id) === 0;
    return html.replace(
      "Add 2 to cart and pay for 1 — the discount applies automatically at checkout.",
      () => used
        ? "You've had today's free one — full price until tomorrow."
        : "Add 2, pay for 1 — one free per customer a day; more are full price.",
    );
  };
  const itemForm = itemFormModal;
  window.itemFormModal = (...args) =>
    itemForm(...args).replace(
      "Buy 1 Get 1 Free — shown in the Deals &amp; Combos home section",
      () => "Buy 1 Get 1 Free — one free per customer a day; shown in the Deals &amp; Combos home section",
    );

  WHATS_NEW.unshift({ area: "Round 24 — Buy 1 Get 1: one free per product, per customer, per day (backend D140, FX-15; customer contract 0.28.0)", items: [
    ["One free a day", "Every second unit of a Buy 1 Get 1 product is still free, but a customer gets one free unit of each such product a day — 2 → 1 free, 3 → 1, 4 → 1; the rest at full price. Each Buy 1 Get 1 product has its own free unit (four products, four free units). The day is the shop's own day; a cancelled order gives its free units back. Fixed for every shop for now (not a setting)."],
    ["The cart shows the real units", "The cart line and the stepper show every unit the customer will get, with \"1 free — you pay for N\" (the API's freeQty). One unit: \"add 1 more, it's free\". Free unit already used today (an earlier order): \"already used today — full price\" (bogoUsedToday)."],
    ["Add puts in a pair", "Add on a Buy 1 Get 1 product puts 2 in the cart (1 paid + 1 free) while today's free unit is unused, otherwise 1. + / − then move by one, like any product."],
    ["Orders, invoice, admin", "The order screen says \"Buy 1 Get 1 · 1 free\" with the amount actually charged; the invoice charges qty − free and notes it; the admin order drawer marks \"1 free\" beside the line — pack every unit. Orders from before keep half their units free, as they were charged."],
  ] });
})();
