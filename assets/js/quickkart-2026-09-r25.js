/* ============================================================
   MyShopza prototype — Round 25 (2026-11-03)
   Buy 1 Get 1 — every unit at half price, no cap
   (backend D143, FX-18; customer contract 0.29.0-draft; replaces Round 24):

   A. The bill: every unit of a Buy 1 Get 1 product costs half its selling
      price — 1 → half, 2 → the price of one, 3 → one and a half — any number,
      no daily limit. The line pays half of price × qty rounded down to the
      cent; the saving is the rest (the API's `bogoSaving`).
   B. The cart line keeps the selling price and the "BOGO" badge — no "half
      price" or "N for x" wording (the user); the bill's BOGO savings row says it.
   C. Add on a Buy 1 Get 1 product always puts 2 in the cart; + / − then move by
      1, and − at 2 leaves 1.
   D. The order keeps each line's `bogoSaving`. The order row shows what was
      paid; the invoice shows Amount = Qty × Rate, the saving in a Discount
      column, and a "Buy 1 Get 1 saving" row after the item total; the admin
      drawer marks "Buy 1 Get 1 −x" (pack every unit). An unavailable line's
      refund is what was paid for it. Orders from before keep what they were
      charged (their free units × the price).
   E. The product page and the admin product form state the rule.

   Same day — the Shop filters come from the server (backend D144, FX-19;
   customer contract 0.30.0-draft):

   F. Price is a two-handle slider with Min / Max boxes, over the cheapest –
      dearest product the other filters leave (`price` of GET
      /customer/products/filters) — the fixed bands (Under 5 …) are gone.
   G. Every option shows what picking it would show: brands, 10 / 20 / 30 %
      and In stock only, each counted without its own filter; a 0 option is
      greyed out, a ticked brand stays listed with 0.
   H. The sort list keeps only what the server sorts (relevance, popular,
      price both ways, discount, name).

   Same day — Buy 1 Get 1 inside a combo: one discount per unit (backend
   D145, FX-20; customer contract 0.31.0-draft):

   I. The units of a Buy 1 Get 1 product inside a combo pay the combo price
      only; half price is for the line's other units. The combo row shows the
      bundle and the plain row the rest — no unit twice.
   J. An unavailable item of a combo is offered back at what it was sold for
      in the bundle (each combo's saving shared over its items by price).
   ============================================================ */
(function round25BogoHalfPrice() {
  const r2 = (n) => Math.round(n * 100) / 100;
  const cents = (n) => Math.round(n * 100);

  /** What Buy 1 Get 1 takes off price × qty: the line pays half, rounded DOWN to the cent (D143). */
  const halfSaving = (price, qty) => {
    const full = cents(price * qty);
    return (full - Math.floor(full / 2)) / 100;
  };
  /** Units of a product sitting in combos — every combo's (round 13's allocation; backend D145). */
  const inCombos = (id) => (window.comboAllocation ? comboAllocation().consumed[id] || 0 : 0);
  /** A cart line's saving — the API's `bogoSaving`: one discount per unit (D145), so only the units outside combos. */
  const bogoSavingOf = (line) =>
    isBogo(line.id) ? halfSaving(line.price, Math.max(0, line.qty - inCombos(line.id))) : 0;
  window.bogoSavingOf = bogoSavingOf;

  /** What each cart line gets of its combos' saving, shared by price in whole cents (backend `comboSharesOf`, D145). */
  function comboSharesNow() {
    const shares = new Map();
    if (!window.comboAllocation) return shares;
    const priceOf = new Map(cartLines().map((l) => [l.id, l.price]));
    comboAllocation().applied.forEach((a) => {
      const ids = a.combo.itemIds.filter((id) => priceOf.has(id));
      const total = cents(a.discount);
      const weight = ids.reduce((s, id) => s + priceOf.get(id), 0);
      if (!ids.length || !(weight > 0)) return;
      const exact = ids.map((id) => (total * priceOf.get(id)) / weight);
      const parts = exact.map(Math.floor);
      exact
        .map((x, i) => ({ i, rest: x - Math.floor(x) }))
        .sort((p, q) => q.rest - p.rest || p.i - q.i)
        .slice(0, total - parts.reduce((s, c) => s + c, 0))
        .forEach(({ i }) => (parts[i] += 1));
      ids.forEach((id, i) => shares.set(id, r2((shares.get(id) || 0) + parts[i] / 100)));
    });
    return shares;
  }

  /** An order line's saving: frozen on new orders; older lines keep their free units × the price. */
  const lineSaving = (it) => {
    if (it.bogoSaving != null) return it.bogoSaving;
    if (!it.bogo) return 0;
    const free = it.freeQty != null ? it.freeQty : Math.floor(it.qty / 2);
    return r2(it.price * free);
  };
  /** The line's amount on the order screen: price × qty less Buy 1 Get 1 (the combo saving is its own summary row). */
  const lineCharged = (it) => r2(it.price * it.qty - lineSaving(it));
  // D145: a line inside a combo was sold for its part of the bundle price — what it is worth back.
  const linePaid = (it) => r2(Math.max(0, lineCharged(it) - (it.comboShare || 0)));

  /* A. The bill. Round 24's totals give every second unit free, capped at one a day; the rest of the half price is
        handed in through the combo saving for one run (so the coupon, the delivery fee, express, tax and the wallet
        all see the right subtotal), then reported as what it is. */
  const totals = cartTotals;
  window.cartTotals = () => {
    const lines = cartLines();
    const capped = lines.reduce((s, l) => s + (isBogo(l.id) ? l.price * window.bogoFreeQtyOf(l) : 0), 0);
    const wanted = lines.reduce((s, l) => s + bogoSavingOf(l), 0);
    // Up for the half price on every unit, or down when units sit in combos (one discount per unit, D145).
    const extra = r2(wanted - capped);
    if (extra === 0) return totals();
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

  /* B. The cart line: the selling price and the badge only — the earlier rounds' offer text goes (no "half price" or
        "N for x" wording, the user); the bill's BOGO savings row carries the saving. */
  const cartLine = cartLineHTML;
  window.cartLineHTML = (i, note = "") => {
    const html = cartLine(i, note);
    if (!isBogo(i.id)) return html;
    return html.replace(/<div class="qk-muted small(?: tone-green)?">Buy 1 Get 1[\s\S]*?<\/div>/, () => "");
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
    const shares = comboSharesNow();
    const before = State.orders[0] && State.orders[0].id;
    const result = pay(method);
    const order = State.orders[0];
    if (order && order.id !== before) {
      order.items = order.items.map((it) => ({
        ...it,
        freeQty: 0,
        bogoSaving: saving.get(it.id) || 0,
        comboShare: shares.get(it.id) || 0,
      }));
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
          : discount > 0 ? "Buy 1 Get 1" : null,
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
    if (!it.bogo && !it.comboShare) return html;
    if (it.unavailable && !it.resolution) {
      // The refund buttons: what the line was sold for — Buy 1 Get 1 and its combo share off (D143, D145)
      const paid = linePaid(it);
      return html
        .replace(money(it.price * it.qty * 1.1), () => money(paid * 1.1))
        .replace(money(it.price * it.qty), () => money(paid));
    }
    if (!it.bogo) return html;
    return `<div class="summary-row"><span>${it.qty} × ${esc(it.name)} <span class="badge badge-green">Buy 1 Get 1</span>${it.resolution === "swap" ? " (swapped)" : it.resolution ? " (refunded)" : ""}</span><span class="qk-num">${money(lineCharged(it))}</span></div>`;
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
      () => "Buy 1 Get 1 — the discount applies automatically in your cart.",
    );
  };
  const itemForm = itemFormModal;
  window.itemFormModal = (...args) =>
    itemForm(...args).replace(
      "Buy 1 Get 1 Free — one free per customer a day; shown in the Deals &amp; Combos home section",
      () => "Buy 1 Get 1 — shown in the Deals &amp; Combos home section",
    );

  WHATS_NEW.unshift({ area: "Round 25 — Buy 1 Get 1: no daily limit, the saving from the server (backend D143, FX-18; customer contract 0.29.0) — replaces round 24's daily limit; & the Shop filters from the server (backend D144, FX-19; customer contract 0.30.0); & Buy 1 Get 1 inside a combo (backend D145, FX-20; contract 0.31.0)", items: [
    ["Buy 1 Get 1 inside a combo", "One discount per unit: the units of a Buy 1 Get 1 product inside a combo pay the combo price only, and half price is for the line's other units (the API's bogoSaving now halves qty − comboUnits). Before, they got both, so a combo of Buy 1 Get 1 products could cost less than nothing. The combo row shows the bundle and the product's own row the rest (qty − comboUnits) — a unit never shows twice."],
    ["A combo item that is unavailable", "Offered back at what it was sold for in the bundle — the combo's saving shared over its items by their prices — not its full price (the refund buttons on the order screen)."],
    ["Shop: price slider", "Price is a two-handle slider with Min / Max boxes under it, instead of the fixed bands (Under 5 …, which did not fit rupee or dirham prices). Its ends are the cheapest and dearest product the other filters leave — the API's price.min / price.max from GET /customer/products/filters, which ignores the price itself, so dragging never moves the ends. A knob pulled to its end means no limit on that side. Send minPrice / maxPrice when a knob is let go or a box is left; keep Min ≤ Max (the API answers 422 otherwise)."],
    ["Shop: counts beside every option", "Each brand, the 10 / 20 / 30 % choices and In stock only show how many products picking them would show (counted without their own filter). A choice with 0 is greyed out; a ticked brand stays listed with 0 so it can be unticked. All from GET /customer/products/filters — call it again when a filter changes, not when the page changes."],
    ["Shop: filtered on the server", "Every filter, sort and page is answered by GET /customer/products over the whole catalogue — the app no longer downloads every product (it stopped at 1,000) to filter on the phone. Brands are sent as ids (brandId repeated for several), In stock only as available=true, the discount as minDiscount; the result count is pagination.totalItems."],
    ["Shop: sorts", "The sort list keeps only what the server sorts: Relevance, Popular (sold most in 30 days), Price low to high / high to low, Discount, Name A–Z. Popularity (by reviews) and Newest are gone."],
    ["No limit", "A Buy 1 Get 1 product has no daily limit any more — any number, every customer, every day. The server works out each line's saving (the API's bogoSaving); the app shows it and never works it out itself. The same for every shop (not a setting)."],
    ["The cart", "The cart line keeps the selling price and the BOGO badge — no extra offer wording; the bill's BOGO savings row is the sum of the lines' savings. The \"N free\" and \"already used today\" texts are gone."],
    ["Add puts in a pair", "Add on a Buy 1 Get 1 product always puts 2 in the cart; + / − then move by one, and − at 2 leaves 1."],
    ["Orders, invoice, admin", "The order keeps each line's bogoSaving; the order row shows \"Buy 1 Get 1\" and what was paid; the invoice shows Amount = Qty × Rate, the saving in a Discount column and a \"Buy 1 Get 1 saving\" row after the item total; an unavailable line refunds what was paid for it; the admin drawer marks \"Buy 1 Get 1 −x\" beside the line (pack every unit). Orders from before keep what they were charged."],
  ] });
})();

/* F–H. The Shop filters as the server answers them (D144). The prototype holds the whole catalogue, so it works out
        here what GET /customer/products/filters answers: each option counted without its own filter. */
(function round25ShopFilters() {
  const DISCOUNT_STEPS = [10, 20, 30];
  // Only the sorts the server answers (`sort` = relevance | popular | price_asc | price_desc | discount | name).
  const SORTS = [
    ["relevance", "Relevance"],
    ["r21-top", "Popular"],
    ["price-asc", "Price: low to high"],
    ["price-desc", "Price: high to low"],
    ["discount", "Discount: high to low"],
    ["r21-name", "Name: A–Z"],
  ];
  UI.priceMin = null; // null = no lower limit
  UI.priceMax = null; // null = no upper limit

  const priceSet = () => UI.priceMin != null || UI.priceMax != null;
  const inPrice = (i) => (UI.priceMin == null || i.price >= UI.priceMin) && (UI.priceMax == null || i.price <= UI.priceMax);

  /** What every filter except `omit` leaves — so an option's count is what picking it would show. */
  function pool(omit) {
    return filteredItemsBase()
      .filter((i) => omit === "stock" || !UI.inStockOnly || i.stock)
      .filter((i) => omit === "brand" || !UI.brandFilter.length || UI.brandFilter.includes(i.brand))
      .filter((i) => omit === "price" || inPrice(i))
      .filter((i) => omit === "discount" || !UI.discountFilter || discountPct(i) >= Number(UI.discountFilter));
  }

  /** GET /customer/products/filters: { price, brands[], discounts[], availableCount }. */
  function shopFilters() {
    const prices = pool("price").map((i) => i.price);
    const brandCounts = new Map();
    pool("brand").forEach((i) => { if (i.brand) brandCounts.set(i.brand, (brandCounts.get(i.brand) || 0) + 1); });
    UI.brandFilter.forEach((b) => { if (!brandCounts.has(b)) brandCounts.set(b, 0); }); // a ticked brand stays, with 0
    const discountPool = pool("discount");
    return {
      price: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
      brands: [...brandCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
      discounts: DISCOUNT_STEPS.map((min) => ({ min, count: discountPool.filter((i) => discountPct(i) >= min).length })),
      availableCount: pool("stock").filter((i) => i.stock).length,
    };
  }

  /** The slider runs over whole amounts around the server's exact cheapest and dearest prices. */
  function sliderEnds(span) {
    const lo = Math.floor(span.min);
    const hi = Math.max(Math.ceil(span.max), lo + 1);
    return { lo, hi, step: hi - lo > 50 ? 1 : 0.1 };
  }

  /** A knob let go or a box left: a knob at its end means no limit; Min never passes Max (the API answers 422). */
  function setPrice(end, raw) {
    const span = shopFilters().price;
    let value = raw === "" || raw == null ? null : Math.round(Number(raw) * 100) / 100;
    if (value != null && !(value >= 0)) return;
    const ends = span ? sliderEnds(span) : null;
    if (end === "min") {
      if (value != null && UI.priceMax != null && value > UI.priceMax) value = UI.priceMax;
      UI.priceMin = value != null && ends && value <= ends.lo ? null : value;
    } else {
      if (value != null && UI.priceMin != null && value < UI.priceMin) value = UI.priceMin;
      UI.priceMax = value != null && ends && value >= ends.hi ? null : value;
    }
  }

  const priceLabel = () =>
    UI.priceMin != null && UI.priceMax != null ? `${money(UI.priceMin)} – ${money(UI.priceMax)}`
      : UI.priceMin != null ? `${money(UI.priceMin)} and above` : `Up to ${money(UI.priceMax)}`;

  function priceBlockHTML(span) {
    if (!span) {
      return `<div class="sidebar-block"><div class="sidebar-title">Price</div><div class="qk-muted small">No products to filter by price.</div></div>`;
    }
    const { lo, hi, step } = sliderEnds(span);
    const a = UI.priceMin == null ? lo : Math.min(Math.max(UI.priceMin, lo), hi);
    const b = UI.priceMax == null ? hi : Math.min(Math.max(UI.priceMax, lo), hi);
    const pct = (v) => ((v - lo) / (hi - lo)) * 100;
    return `<div class="sidebar-block">
        <div class="sidebar-title">Price</div>
        <div class="r25-range" style="--lo:${pct(a)}%;--hi:${pct(b)}%">
          <input type="range" min="${lo}" max="${hi}" step="${step}" value="${a}" data-r25-price="min" aria-label="Lowest price" />
          <input type="range" min="${lo}" max="${hi}" step="${step}" value="${b}" data-r25-price="max" aria-label="Highest price" />
        </div>
        <div class="r25-price-boxes">
          <label><span class="qk-muted small">Min</span><input class="input input-sm" type="number" inputmode="decimal" min="0" step="0.01" value="${UI.priceMin ?? ""}" placeholder="${lo}" data-r25-price="min" /></label>
          <span class="qk-muted">–</span>
          <label><span class="qk-muted small">Max</span><input class="input input-sm" type="number" inputmode="decimal" min="0" step="0.01" value="${UI.priceMax ?? ""}" placeholder="${hi}" data-r25-price="max" /></label>
        </div>
        <div class="qk-muted small r25-span">${money(span.min)} – ${money(span.max)} in these results</div>
      </div>`;
  }

  const discountBlockHTML = (options) => `<div class="sidebar-block">
        <div class="sidebar-title">Discount</div>
        <div class="filter-pill-row">
          ${options.map((d) => {
            const active = UI.discountFilter === String(d.min);
            return `<button class="filter-pill ${active ? "active" : ""}" data-action="set-discount-filter" data-min="${d.min}" ${d.count === 0 && !active ? "disabled" : ""}>${d.min}% or more (${d.count})</button>`;
          }).join("")}
        </div>
      </div>`;

  const brandBlockHTML = (brands) => (!brands.length ? "" : `<div class="sidebar-block">
        <div class="sidebar-title">Brand</div>
        <div class="sidebar-checklist">
          ${brands.map((b) => `
            <label class="checklist-item">
              <input type="checkbox" data-action="toggle-brand-filter" data-brand="${esc(b.name)}" ${UI.brandFilter.includes(b.name) ? "checked" : ""} />
              <span>${esc(b.name)}</span><span class="qk-muted small r25-count">${b.count}</span>
            </label>`).join("")}
        </div>
      </div>`);

  const stockBlockHTML = (count) => `<div class="sidebar-block">
        <label class="checklist-item">
          <input type="checkbox" data-action="toggle-instock" ${UI.inStockOnly ? "checked" : ""} />
          <span>In stock only</span><span class="qk-muted small r25-count">${count}</span>
        </label>
      </div>`;

  const sortSelectHTML = () =>
    `<select class="input input-sm" data-action="set-sort">${SORTS.map(([value, label]) => `<option value="${value}" ${UI.shopSort === value ? "selected" : ""}>${label}</option>`).join("")}</select>`;

  // The list: the price limits on top of every other filter (one page at a time from the server in the app).
  const listed = filteredItems;
  window.filteredItems = () => listed().filter(inPrice);
  const hasAdvanced = hasAdvancedFilters;
  window.hasAdvancedFilters = () => hasAdvanced() || priceSet();
  const advancedCount = advancedFilterCount;
  window.advancedFilterCount = () => advancedCount() + (priceSet() ? 1 : 0);
  const reset = resetAdvancedFilters;
  window.resetAdvancedFilters = () => { UI.priceMin = null; UI.priceMax = null; return reset(); };

  // The price chip above the results.
  const chips = activeFilterChipsHTML;
  window.activeFilterChipsHTML = () => {
    const html = chips();
    if (!priceSet()) return html;
    const chip = `<button class="filter-chip" data-action="remove-active-filter" data-kind="price" data-value="">${esc(priceLabel())}${ic("close")}</button>`;
    const clear = `<button class="link-btn" data-action="clear-shop-filters">`;
    if (html) return html.replace(clear, () => `${chip}\n    ${clear}`);
    return `<div class="active-filters" id="activeFilters">${chip}${clear}Clear all</button></div>`;
  };
  const removeChip = Actions["remove-active-filter"];
  Actions["remove-active-filter"] = (el, ev) => {
    if (el.dataset.kind === "price") { UI.priceMin = null; UI.priceMax = null; }
    return removeChip(el, ev);
  };

  // The panel: the slider, the counts, the brands with their counts, the server's sorts.
  const view = viewShop;
  window.viewShop = () => {
    if (!SORTS.some(([value]) => value === UI.shopSort)) UI.shopSort = "relevance";
    let html = view();
    const f = shopFilters();
    html = html.replace(/<div class="sidebar-block">\s*<div class="sidebar-title">Price<\/div>\s*<div class="filter-pill-row">[\s\S]*?<\/div>\s*<\/div>/, () => priceBlockHTML(f.price));
    html = html.replace(/<div class="sidebar-block">\s*<div class="sidebar-title">Discount<\/div>\s*<div class="filter-pill-row">[\s\S]*?<\/div>\s*<\/div>/, () => discountBlockHTML(f.discounts));
    html = html.replace(/<div class="sidebar-block">\s*<div class="sidebar-title">Brand<\/div>\s*<div class="sidebar-checklist">[\s\S]*?<\/div>\s*<\/div>/, () => "");
    html = html.replace(/<div class="sidebar-block">\s*<label class="checklist-item">\s*<input type="checkbox" data-action="toggle-instock"[\s\S]*?<\/label>\s*<\/div>/, () => brandBlockHTML(f.brands) + stockBlockHTML(f.availableCount));
    html = html.replace(/<select class="input input-sm" data-action="set-sort">[\s\S]*?<\/select>/, () => sortSelectHTML());
    return html;
  };

  // A knob let go or a box left → filter (the app sends minPrice / maxPrice then, not on every pixel of a drag).
  document.body.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-r25-price]");
    if (!el) return;
    setPrice(el.dataset.r25Price, el.value);
    render();
  });
  // While dragging: the knobs keep their order, the bar and the boxes follow — nothing is asked yet.
  document.body.addEventListener("input", (ev) => {
    const el = ev.target.closest('.r25-range input[type="range"]');
    if (!el) return;
    const wrap = el.closest(".r25-range");
    const [lo, hi] = wrap.querySelectorAll('input[type="range"]');
    if (Number(lo.value) > Number(hi.value)) {
      if (el === lo) lo.value = hi.value; else hi.value = lo.value;
    }
    const min = Number(lo.min), max = Number(lo.max);
    const pct = (v) => (max > min ? ((v - min) / (max - min)) * 100 : 0);
    wrap.style.setProperty("--lo", `${pct(Number(lo.value))}%`);
    wrap.style.setProperty("--hi", `${pct(Number(hi.value))}%`);
    const boxes = wrap.parentElement.querySelectorAll(".r25-price-boxes input");
    if (boxes.length === 2) { boxes[0].value = lo.value; boxes[1].value = hi.value; }
  });

  // The slider's look: one track, the chosen part in the primary colour, two round knobs.
  const style = document.createElement("style");
  style.textContent = `
    .r25-range { position: relative; height: 30px; margin: 2px 2px 8px; }
    .r25-range::before, .r25-range::after { content: ""; position: absolute; top: 13px; height: 4px; border-radius: 2px; }
    .r25-range::before { left: 0; right: 0; background: var(--line); }
    .r25-range::after { left: var(--lo); right: calc(100% - var(--hi)); background: var(--primary); }
    .r25-range input[type="range"] { position: absolute; left: 0; top: 6px; width: 100%; height: 18px; margin: 0; background: none; pointer-events: none; -webkit-appearance: none; appearance: none; }
    .r25-range input[type="range"]::-webkit-slider-runnable-track { background: none; }
    .r25-range input[type="range"]::-moz-range-track { background: none; }
    .r25-range input[type="range"]::-webkit-slider-thumb { pointer-events: auto; -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 3px solid var(--primary); cursor: pointer; position: relative; z-index: 2; }
    .r25-range input[type="range"]::-moz-range-thumb { pointer-events: auto; width: 12px; height: 12px; border-radius: 50%; background: #fff; border: 3px solid var(--primary); cursor: pointer; }
    .r25-price-boxes { display: flex; align-items: flex-end; gap: 8px; }
    .r25-price-boxes label { display: grid; gap: 2px; flex: 1; min-width: 0; }
    .r25-price-boxes input { width: 100%; }
    .r25-span { margin-top: 6px; }
    .r25-count { margin-left: auto; }
    .filter-pill[disabled] { opacity: .45; cursor: not-allowed; }
  `;
  document.head.appendChild(style);
})();
