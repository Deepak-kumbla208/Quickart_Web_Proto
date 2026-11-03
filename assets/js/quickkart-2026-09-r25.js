/* ============================================================
   QuickKart prototype — Round 25 (2026-11-03)
   Buy 1 Get 1 — every unit at half price, no cap
   (backend D143, FX-18; customer contract 0.29.0-draft; replaces Round 24):

   A. The bill: every unit of a Buy 1 Get 1 product costs half its selling
      price — 1 → half, 2 → the price of one, 3 → one and a half — any number,
      no daily limit. The line pays half of price × qty rounded down to the
      cent; the saving is the rest (the API's `bogoSaving`).
   B. The cart line keeps the selling price and says "Buy 1 Get 1 · half price —
      3 for x" with the full price struck through.
   C. Add on a Buy 1 Get 1 product always puts 2 in the cart; + / − then move by
      1, and − at 2 leaves 1.
   D. The order keeps each line's `bogoSaving`. The order row shows what was
      paid; the invoice shows Amount = Qty × Rate, the saving in a Discount
      column, and a "Buy 1 Get 1 saving" row after the item total; the admin
      drawer marks "Buy 1 Get 1 −x" (pack every unit). An unavailable line's
      refund is what was paid for it. Orders from before keep what they were
      charged (their free units × the price).
   E. The product page and the admin product form state the rule.
   ============================================================ */
(function round25BogoHalfPrice() {
  const r2 = (n) => Math.round(n * 100) / 100;
  const cents = (n) => Math.round(n * 100);

  /** What Buy 1 Get 1 takes off price × qty: the line pays half, rounded DOWN to the cent (D143). */
  const halfSaving = (price, qty) => {
    const full = cents(price * qty);
    return (full - Math.floor(full / 2)) / 100;
  };
  /** A cart line's saving — the API's `bogoSaving`. */
  const bogoSavingOf = (line) => (isBogo(line.id) ? halfSaving(line.price, line.qty) : 0);
  window.bogoSavingOf = bogoSavingOf;

  /** An order line's saving: frozen on new orders; older lines keep their free units × the price. */
  const lineSaving = (it) => {
    if (it.bogoSaving != null) return it.bogoSaving;
    if (!it.bogo) return 0;
    const free = it.freeQty != null ? it.freeQty : Math.floor(it.qty / 2);
    return r2(it.price * free);
  };
  const linePaid = (it) => r2(it.price * it.qty - lineSaving(it));

  /* A. The bill. Round 24's totals give every second unit free, capped at one a day; the rest of the half price is
        handed in through the combo saving for one run (so the coupon, the delivery fee, express, tax and the wallet
        all see the right subtotal), then reported as what it is. */
  const totals = cartTotals;
  window.cartTotals = () => {
    const lines = cartLines();
    const capped = lines.reduce((s, l) => s + (isBogo(l.id) ? l.price * window.bogoFreeQtyOf(l) : 0), 0);
    const wanted = lines.reduce((s, l) => s + bogoSavingOf(l), 0);
    const extra = r2(wanted - capped);
    if (!(extra > 0)) return totals();
    const combos = window.activeComboSavings;
    let t;
    try {
      window.activeComboSavings = (...args) => combos(...args) + extra;
      t = totals();
    } finally {
      window.activeComboSavings = combos;
    }
    t.bogoSavings = r2(t.bogoSavings + extra);
    t.comboDiscount = r2(t.comboDiscount - extra);
    return t;
  };

  /* B. The cart line: the selling price stays; the offer line says what the units cost. */
  const cartLine = cartLineHTML;
  window.cartLineHTML = (i, note = "") => {
    const html = cartLine(i, note);
    if (!isBogo(i.id)) return html;
    const full = r2(i.price * i.qty);
    const pays = r2(full - bogoSavingOf(i));
    const text = `Buy 1 Get 1 · <b>half price</b> — ${i.qty} for ${money(pays)} <s class="qk-muted">${money(full)}</s>`;
    return html.replace(
      /<div class="qk-muted small(?: tone-green)?">Buy 1 Get 1[\s\S]*?<\/div>/,
      () => `<div class="qk-muted small tone-green">${text}</div>`,
    );
  };

  /* C. Add: a pair the first time, every time; then one at a time (− at 2 leaves 1). */
  const inc = incCart;
  window.incCart = (id) => {
    if (isBogo(id) && !(State.cart[id] > 0)) {
      State.cart[id] = 2;
      persist("cart");
      render();
      return;
    }
    inc(id);
  };

  /* D. The order keeps what each line saved (`bogoSaving`); no free units any more. */
  const pay = handlePay;
  window.handlePay = (method) => {
    const saving = new Map(cartLines().map((l) => [l.id, bogoSavingOf(l)]));
    const before = State.orders[0] && State.orders[0].id;
    const result = pay(method);
    const order = State.orders[0];
    if (order && order.id !== before) {
      order.items = order.items.map((it) => ({ ...it, freeQty: 0, bogoSaving: saving.get(it.id) || 0 }));
      persist("orders");
    }
    return result;
  };

  // The invoice lines: what was paid per line, with the full amount and the saving beside it.
  window.invoiceLines = function (order) {
    const tax = order.taxSnapshot || State.tax;
    const inclusive = !tax || tax.inclusive !== false;
    return order.items.map((it, idx) => {
      const amount = r2(it.price * it.qty);
      const discount = lineSaving(it);
      const paid = r2(amount - discount);
      const gst = gstAmount(paid, tax);
      return {
        sn: idx + 1, name: it.name, unit: it.unit || "—",
        hs: `2106${String(1000 + (it.id || 0) * 7).slice(0, 4)}`,
        qty: it.qty, rate: it.price, amount, discount, taxable: inclusive ? paid - gst : paid,
        gst, total: paid,
        note: it.resolution === "swap" ? "Replaced" : it.resolution === "removed" ? "Removed" : it.resolution ? "Refunded"
          : discount > 0 ? (cents(paid) === Math.floor(cents(amount) / 2) ? "Buy 1 Get 1 — half price" : "Buy 1 Get 1") : null,
      };
    });
  };

  // The invoice: Amount = Qty × Rate, the saving in Discount, and its own summary row — the app's bill, row for row.
  const invoice = invoiceHTML;
  window.invoiceHTML = (order) => {
    let html = invoice(order);
    const lines = window.invoiceLines(order);
    const saving = r2(lines.reduce((s, l) => s + l.discount, 0));
    if (!(saving > 0)) return html;
    const tax = order.taxSnapshot || State.tax;
    const sum = (key) => lines.reduce((s, l) => s + l[key], 0);
    const table = `<div class="inv-table-wrap">
      <table class="inv-table">
        <thead><tr><th>SN</th><th>Item &amp; Description</th><th>Unit</th><th>HS Code</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th><th class="r">Discount</th><th class="r">Taxable</th><th class="r">GST ${tax.rate}%</th><th class="r">Total</th></tr></thead>
        <tbody>
          ${lines.map((l) => `<tr><td>${l.sn}</td><td>${esc(l.name)}${l.note ? ` <span class="qk-muted">(${l.note})</span>` : ""}</td><td>${esc(l.unit)}</td><td>${esc(l.hs)}</td><td class="r">${l.qty}</td><td class="r">${money(l.rate)}</td><td class="r">${money(l.amount)}</td><td class="r">${l.discount > 0 ? money(l.discount) : "—"}</td><td class="r">${money(l.taxable)}</td><td class="r">${money(l.gst)}</td><td class="r"><b>${money(l.total)}</b></td></tr>`).join("")}
        </tbody>
        <tfoot><tr><td colspan="6"><b>Total</b></td><td class="r"><b>${money(sum("amount"))}</b></td><td class="r"><b>${money(saving)}</b></td><td class="r"><b>${money(sum("taxable"))}</b></td><td class="r"><b>${money(sum("gst"))}</b></td><td class="r"><b>${money(sum("total"))}</b></td></tr></tfoot>
      </table>
    </div>`;
    html = html.replace(/<div class="inv-table-wrap">[\s\S]*?<\/table>\s*<\/div>/, () => table);
    // The item total is every unit at its price; the saving follows it (the invoice value is unchanged).
    return html.replace(
      /(<div class="row"><span>Item total \((?:incl\.|excl\.) GST\)<\/span><span>)[^<]*(<\/span><\/div>)/,
      (_m, open, close) =>
        `${open}${money(sum("amount"))}${close}\n        <div class="row"><span>Buy 1 Get 1 saving</span><span>− ${money(saving)}</span></div>`,
    );
  };

  // The customer's order screen: what each Buy 1 Get 1 line was charged; an unavailable one refunds what was paid.
  const itemRow = orderItemRowHTML;
  window.orderItemRowHTML = (order, it, idx) => {
    const html = itemRow(order, it, idx);
    if (!it.bogo) return html;
    const paid = linePaid(it);
    if (it.unavailable && !it.resolution) {
      return html
        .replace(money(it.price * it.qty * 1.1), () => money(paid * 1.1))
        .replace(money(it.price * it.qty), () => money(paid));
    }
    const badge = it.bogoSaving != null ? "Buy 1 Get 1 · half price" : "Buy 1 Get 1";
    return `<div class="summary-row"><span>${it.qty} × ${esc(it.name)} <span class="badge badge-green">${badge}</span>${it.resolution === "swap" ? " (swapped)" : it.resolution ? " (refunded)" : ""}</span><span class="qk-num">${money(paid)}</span></div>`;
  };

  // The admin order drawer: the line's saving beside it, so the packer knows (pack every unit).
  const drawer = orderDrawerHTML;
  window.orderDrawerHTML = () => {
    let html = drawer();
    const o = State.orders.find((x) => x.id === UI.orderDrawerId);
    if (!o) return html;
    o.items.forEach((it) => {
      if (it.bogoSaving == null || !(it.bogoSaving > 0)) return;
      const name = `<span class="pick-name">${esc(it.name)}`;
      html = html.replace(name, () => `${name} <span class="badge badge-green">Buy 1 Get 1 −${money(it.bogoSaving)}</span>`);
    });
    return html;
  };

  /* E. The rule in words. */
  const product = productModal;
  window.productModal = (id) => {
    const html = product(id);
    if (!isBogo(id)) return html;
    return html.replace(
      /You've had today's free one — full price until tomorrow\.|Add 2, pay for 1 — one free per customer a day; more are full price\./,
      () => "Every unit at half price — Add puts 2 in your cart for the price of 1. Any number, no limit.",
    );
  };
  const itemForm = itemFormModal;
  window.itemFormModal = (...args) =>
    itemForm(...args).replace(
      "Buy 1 Get 1 Free — one free per customer a day; shown in the Deals &amp; Combos home section",
      () => "Buy 1 Get 1 — every unit at half price, no limit; shown in the Deals &amp; Combos home section",
    );

  WHATS_NEW.unshift({ area: "Round 25 — Buy 1 Get 1: every unit at half price, no cap (backend D143, FX-18; customer contract 0.29.0) — replaces round 24's daily limit", items: [
    ["Half price on every unit", "Every unit of a Buy 1 Get 1 product costs half its selling price — a box of 2.00 is 1.00, 2 are 2.00, 3 are 3.00 — any number, no daily limit. The line pays half of price × qty rounded down to the cent (the API's bogoSaving is the rest). The same for every shop (not a setting)."],
    ["The cart", "The cart line keeps the selling price and says \"Buy 1 Get 1 · half price — 3 for 3.00\" with the full price struck through; the bill's BOGO savings row is the sum of the lines' savings. The \"N free\" and \"already used today\" texts are gone."],
    ["Add puts in a pair", "Add on a Buy 1 Get 1 product always puts 2 in the cart; + / − then move by one, and − at 2 leaves 1 (one unit at half price)."],
    ["Orders, invoice, admin", "The order keeps each line's bogoSaving; the order row shows what was paid; the invoice shows Amount = Qty × Rate, the saving in a Discount column and a \"Buy 1 Get 1 saving\" row after the item total; an unavailable line refunds what was paid for it; the admin drawer marks \"Buy 1 Get 1 −x\" beside the line (pack every unit). Orders from before keep what they were charged."],
  ] });
})();
