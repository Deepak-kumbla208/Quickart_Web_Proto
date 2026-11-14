/* Round 29 (2026-11-14): the Shop sidebar as an Amazon-style list.
   The team asked for Amazon / Flipkart-style filters in the sidebar, without the Categories list (the category bar
   above the page already shows them). Chosen from mockups: Amazon's plain list, on one white panel.
   - No Categories in the sidebar.
   - One white panel (it was a box per filter), plain bold headings (they were small grey capitals).
   - Deals: All products / On offer / the shop's own quick filters, one at a time (radio buttons). Later the same day:
     each tag is counted for the category or search on screen; a tag with nothing there is greyed out.
   - Brands: the first 5 with "See more"; a ticked brand always shows.
   - Price: the chosen range in large type, Round 25's slider and Min / Max boxes with a Go button, "‹ Any price".
   - Discount: a radio list, 10% and above … 50% and above, "‹ Any discount"; a step with no products is greyed out.
     (The server counts 10 / 20 / 30 % today — 40 % and 50 % need a small backend change; the prototype counts them.)
   - Availability: "Include out of stock" (ticked = everything; unticked = in stock only).
   - Above the products, a results bar: "1–7 of 7 results for Snacks" with Sort by. The row of removable chips goes.
   - Phones and tablets keep the Filter button and its bottom sheet, with the same list inside. */
(function round29ShopSidebar() {
  UI.r29AllBrands = false;
  const DISCOUNT_STEPS = [10, 20, 30, 40, 50];
  const BRANDS_SHOWN = 5;

  const optHTML = (action, attrs, label, on, disabled) =>
    `<button type="button" class="r29-opt ${on ? "on" : ""}" data-action="${action}" ${attrs} aria-pressed="${on}" ${disabled ? "disabled" : ""}><span class="r29-radio"></span><span>${label}</span></button>`;

  /** How many products each discount step would show: every filter except the discount, as the server counts. */
  function discountCounts() {
    const keep = UI.discountFilter;
    UI.discountFilter = null;
    let items;
    try { items = filteredItems(); } finally { UI.discountFilter = keep; }
    return DISCOUNT_STEPS.map((min) => ({ min, count: items.filter((i) => discountPct(i) >= min).length }));
  }

  /** How many products each tag would show: every filter except the tag, as the server counts (GET /customer/products/filters). */
  function tagCounts(tags) {
    const keep = UI.tagFilter;
    const out = {};
    try { tags.forEach((tag) => { UI.tagFilter = tag; out[tag] = filteredItems().length; }); } finally { UI.tagFilter = keep; }
    return out;
  }

  const view = viewShop;
  window.viewShop = () => {
    const t = document.createElement("template");
    t.innerHTML = view();
    const root = t.content;
    const aside = root.querySelector(".shop-sidebar");
    if (!aside) return t.innerHTML;
    aside.classList.add("r29-amz");
    root.querySelector(".shop-layout")?.classList.add("r29-shop");
    const blocks = [...aside.querySelectorAll(".sidebar-block")];
    const find = (name) => blocks.find((b) => (b.querySelector(".sidebar-title")?.textContent || "").trim() === name);

    // No Categories: the category bar above already lists them.
    find("Categories")?.remove();

    // Deals: All products, On offer and the shop's own quick filters (Round 21), one at a time.
    // Later the same day: each tag is counted for what is on screen; a tag with nothing here is greyed out.
    const quick = find("Quick filters");
    if (quick) {
      const tags = [...quick.querySelectorAll("[data-tag]")].map((b) => [b.dataset.tag, b.textContent.trim()]);
      const counts = tagCounts(tags.map(([tag]) => tag));
      quick.innerHTML = `<div class="sidebar-title">Deals</div>${[["", "All products"], ...tags]
        .map(([tag, label]) => optHTML("r29-tag", `data-tag="${esc(tag)}"`, esc(label), (UI.tagFilter || "") === tag, !!tag && counts[tag] === 0 && UI.tagFilter !== tag)).join("")}`;
    }

    // Brands (Round 25's ticks): the first five, then "See more". A ticked brand always shows.
    const brand = find("Brand");
    if (brand) {
      brand.querySelector(".sidebar-title").textContent = "Brands";
      const rows = [...brand.querySelectorAll(".checklist-item")];
      rows.forEach((row, i) => { if (!UI.r29AllBrands && i >= BRANDS_SHOWN && !row.querySelector("input")?.checked) row.hidden = true; });
      if (rows.length > BRANDS_SHOWN) {
        brand.insertAdjacentHTML("beforeend", `<button type="button" class="r29-more ${UI.r29AllBrands ? "open" : ""}" data-action="r29-brands">${UI.r29AllBrands ? "See less" : "See more"}${ic("chevronDown")}</button>`);
      }
      // Amazon's order: Deals, Brands, Price, Discount, Availability.
      if (quick) quick.after(brand);
    }

    // Price (Round 25's slider and boxes): the range in large type, a Go button, "‹ Any price".
    const price = find("Price");
    const knobs = price ? price.querySelectorAll('.r25-range input[type="range"]') : [];
    if (price && knobs.length === 2) {
      const any = UI.priceMin != null || UI.priceMax != null
        ? `<button type="button" class="r29-back" data-action="r29-any-price">${ic("chevronLeft")}Any price</button>` : "";
      const line = `<div class="r29-price-line qk-num" data-r29-price-line>${money(Number(knobs[0].getAttribute("value")))} – ${money(Number(knobs[1].getAttribute("value")))}</div>`;
      price.querySelector(".sidebar-title").insertAdjacentHTML("afterend", any + line);
      price.querySelector(".r25-span")?.remove();
      price.querySelector(".r25-price-boxes")?.insertAdjacentHTML("beforeend", `<button type="button" class="r29-go" data-action="r29-go">Go</button>`);
    }

    // Discount: a radio list, 10% and above … 50% and above.
    const disc = find("Discount");
    if (disc) {
      const any = UI.discountFilter
        ? `<button type="button" class="r29-back" data-action="r29-disc" data-min="">${ic("chevronLeft")}Any discount</button>` : "";
      disc.innerHTML = `<div class="sidebar-title">Discount</div>${any}${discountCounts()
        .map((d) => optHTML("r29-disc", `data-min="${d.min}"`, `${d.min}% and above`, UI.discountFilter === String(d.min), d.count === 0 && UI.discountFilter !== String(d.min))).join("")}`;
    }

    // Availability: "Include out of stock" — ticked shows everything, unticked is In stock only.
    const stock = aside.querySelector('input[data-action="toggle-instock"]')?.closest(".sidebar-block");
    if (stock) {
      stock.innerHTML = `<div class="sidebar-title">Availability</div>
        <label class="checklist-item"><input type="checkbox" data-action="r29-oos" ${UI.inStockOnly ? "" : "checked"} /><span>Include out of stock</span></label>`;
    }

    // Above the products: the results bar with Sort by (the chips row goes; the sidebar shows what is picked).
    root.querySelector(".active-filters")?.remove();
    const head = root.querySelector(".shop-main-head");
    if (head) {
      const n = filteredItems().length;
      const what = UI.query ? `"${esc(UI.query)}"` : head.querySelector("h1")?.innerHTML || "";
      const sort = head.querySelector('.sort-inline select[data-action="set-sort"]');
      head.insertAdjacentHTML("afterend", `<div class="r29-resbar">
        <span>${n ? `1–${n} of ${n}` : "No"} result${n === 1 ? "" : "s"} for <b>${what}</b></span>
        ${sort ? `<label class="r29-sortby"><span class="qk-muted">Sort by</span>${sort.outerHTML}</label>` : ""}
      </div>`);
    }
    return t.innerHTML;
  };

  Actions["r29-tag"] = (el) => { UI.tagFilter = el.dataset.tag || null; UI.r21ListTitle = null; render(); };
  Actions["r29-disc"] = (el) => { UI.discountFilter = el.dataset.min || null; render(); };
  Actions["r29-oos"] = (el) => { UI.inStockOnly = !el.checked; render(); };
  Actions["r29-brands"] = () => { UI.r29AllBrands = !UI.r29AllBrands; render(); };
  Actions["r29-any-price"] = () => { UI.priceMin = null; UI.priceMax = null; render(); };
  // Go: leaving a box already applies it (Round 25), so Go only redraws.
  Actions["r29-go"] = () => render();
  // Another category or a new search starts with the brand list folded.
  ["browse-category", "see-all-tag", "quick-search", "clear-shop-filters"].forEach((name) => {
    const base = Actions[name];
    if (!base) return;
    Actions[name] = (el, ev) => { UI.r29AllBrands = false; return base(el, ev); };
  });

  // While a price knob is dragged, the large range line follows it (Round 25 moves the boxes).
  document.body.addEventListener("input", (ev) => {
    const knob = ev.target.closest('.r29-amz .r25-range input[type="range"]');
    if (!knob) return;
    const [lo, hi] = knob.closest(".r25-range").querySelectorAll('input[type="range"]');
    const line = knob.closest(".sidebar-block").querySelector("[data-r29-price-line]");
    if (line) line.textContent = `${money(Math.min(+lo.value, +hi.value))} – ${money(Math.max(+lo.value, +hi.value))}`;
  });

  const style = document.createElement("style");
  style.textContent = `
    .r29-amz .sidebar-block { background: none; border: 0; border-radius: 0; padding: 0; margin: 0 0 18px; }
    .r29-amz .sidebar-title { display: block; font-size: 14.5px; font-weight: 700; text-transform: none; letter-spacing: 0; color: var(--ink); margin-bottom: 6px; }
    .r29-amz .sidebar-title .ic { display: none; }
    .r29-amz .sidebar-checklist { max-height: none; overflow: visible; gap: 0; }
    .r29-amz .checklist-item { padding: 4px 0; font-size: 13.5px; font-weight: 500; }
    .r29-amz .checklist-item:hover { color: var(--primary); }
    .r29-amz .checklist-item[hidden] { display: none; }
    .r29-amz .checklist-item input { width: 16px; height: 16px; margin: 0; }
    .r29-amz .r25-count { display: none; }
    .r29-opt { display: flex; align-items: center; gap: 10px; width: 100%; padding: 4px 0; background: none; border: 0; font-size: 13.5px; font-weight: 500; color: var(--ink); text-align: left; cursor: pointer; }
    .r29-opt:hover:not(:disabled) { color: var(--primary); }
    .r29-opt:disabled { color: #9AA5B1; cursor: not-allowed; }
    .r29-radio { width: 16px; height: 16px; flex: none; border-radius: 50%; border: 1.5px solid #AEBBC8; background: #fff; }
    .r29-opt.on .r29-radio { border: 5px solid var(--primary); }
    .r29-opt:disabled .r29-radio { border-color: #D3DBE3; }
    .r29-more, .r29-back { display: inline-flex; align-items: center; gap: 2px; padding: 4px 0; background: none; border: 0; color: var(--primary-soft); font-size: 13px; font-weight: 600; cursor: pointer; }
    .r29-more:hover, .r29-back:hover { text-decoration: underline; text-underline-offset: 3px; }
    .r29-more .ic, .r29-back .ic { width: 14px; height: 14px; }
    .r29-more.open .ic { transform: rotate(180deg); }
    .r29-price-line { font-size: 15px; font-weight: 700; margin: 2px 0 4px; }
    .r29-amz .r25-price-boxes { align-items: flex-end; gap: 6px; }
    .r29-go { flex: none; height: 34px; padding: 0 12px; border-radius: var(--r-pill); border: 1px solid var(--line); background: var(--card); font-size: 12.5px; font-weight: 700; color: var(--ink); cursor: pointer; }
    .r29-go:hover { border-color: var(--primary-soft); }
    .r29-resbar { display: flex; align-items: center; gap: 12px; margin: -4px 0 16px; padding: 8px 8px 8px 14px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; font-size: 13.5px; }
    .r29-resbar b { color: var(--primary-deep); }
    .r29-sortby { margin-left: auto; display: flex; align-items: center; gap: 8px; white-space: nowrap; }
    @media (min-width: 1025px) {
      .shop-sidebar.r29-amz { gap: 0; padding: 16px 16px 2px; background: var(--card); border: 1px solid var(--line); border-radius: var(--r-lg); max-height: calc(100vh - 148px); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
      .r29-shop .sort-inline { display: none; }
    }
    @media (max-width: 1024px) {
      .r29-resbar { display: none; }
      .shop-sidebar.r29-amz.open { gap: 0; }
      .r29-amz .sidebar-block { margin-bottom: 16px; }
    }
  `;
  document.head.appendChild(style);
})();

/* ====================================================================
   Round 29, later the same day: the tester's issue list (admin items 2, 3, 4, 7, 8, 10 and 12) and the customer
   quick filters. The backend is not built yet — this shows how each one will work.
   A. SKU and supplier code may be left empty: the next code is made from the shop's prefix and a running number
      (Business Settings ▸ Stock Rules ▸ Codes) — on the forms and in imports.
   B. Barcode: Scan and Look up on the product form — the shop's own products first, then Open Food Facts (only the
      barcode is sent; nothing found = nothing filled).
   C. A product's delivery time (ETA) in minutes, hours or days, up to 30 days. Over a day: a cart holding it can only
      be scheduled, and its delivery times start after that product's time.
   D. Every stock receipt and adjustment is in Setup ▸ Audit log (who, product, store, before → after, reason).
   E. Stock adjustment approval — a shop switch, off to start. While on, an adjustment and each store's part of a stock
      import wait until that store's manager or the Super Admin approves; never the person who entered it.
   F. Tax on / off. Off: no tax line on the bill, the order or the invoice.
   (G. The Deals list counts each tag for what is on screen — in the sidebar code above.)
   ==================================================================== */
(function round29IssueList() {
  const DAY = 1440;
  const tpl = (html) => { const t = document.createElement("template"); t.innerHTML = html; return t; };
  const storeName = (id) => (findBranch(id) || {}).name || `Store ${id}`;
  const itemName = (id) => (findItem(id) || {}).name || `#${id}`;
  const userName = (id) => (findUser(id) || {}).name || "Someone";
  const signed = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;
  const listText = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ""));
  const cardTitle = (card) => ((card.querySelector(".summary-card-title") || {}).textContent || "").trim();

  Icon.camera = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

  /* One "business_settings.updated" entry per save, as the API writes it: join the entry this save already wrote
     (Round 11 writes one for some cards), or write one. */
  const auditTop = () => (State.auditEvents[0] || {}).id;
  function auditSettings(topId, before, after) {
    const keys = Object.keys(after).filter((k) => before[k] !== after[k]);
    if (!keys.length || !currentUser()) return;
    const b = Object.fromEntries(keys.map((k) => [k, before[k]]));
    const a = Object.fromEntries(keys.map((k) => [k, after[k]]));
    const top = State.auditEvents[0];
    if (top && top.id !== topId && top.action === "business_settings.updated") {
      top.before = { ...(top.before || {}), ...b };
      top.after = { ...(top.after || {}), ...a };
      persist("auditEvents");
    } else {
      addAuditEvent({ action: "business_settings.updated", entity: "business_settings", entityId: null, actorType: "user", actorId: currentUser().id, before: b, after: a });
    }
  }
  Object.assign(AUDIT_FIELD_LABEL, {
    "codes.skuPrefix": "SKU prefix", "codes.supplierPrefix": "Supplier code prefix",
    "stock.adjustmentApproval": "Adjustments need approval", "tax.enabled": "Charge tax",
  });

  /* ---------------- A. Product and supplier codes ---------------- */
  State.codeSettings = loadLS("codeSettings", () => ({ skuPrefix: "SKU-", supplierPrefix: "SUP-", skuNext: 1, supplierNext: 1 }));
  const CODE_DIGITS = 5;
  const PREFIX_RE = /^[A-Z0-9][A-Z0-9_-]{0,9}$/;
  const counterKey = (kind) => (kind === "sku" ? "skuNext" : "supplierNext");
  const codeTaken = (kind, code) => (kind === "sku"
    ? State.items.some((i) => (i.sku || "").toLowerCase() === code.toLowerCase())
    : State.suppliers.some((s) => (s.code || "").toLowerCase() === code.toLowerCase()));
  /** The next free codes, without using them up: the shop's counter, skipping a code someone typed by hand. */
  function peekCodes(kind, count, skip) {
    const cs = State.codeSettings;
    const prefix = kind === "sku" ? cs.skuPrefix : cs.supplierPrefix;
    let n = Number(cs[counterKey(kind)]) || 1;
    const out = [];
    while (out.length < count) {
      const code = `${prefix}${String(n).padStart(CODE_DIGITS, "0")}`;
      if (!codeTaken(kind, code) && !(skip && skip.has(code.toLowerCase()))) out.push({ code, n });
      n++;
    }
    return out;
  }
  const nextCode = (kind) => peekCodes(kind, 1)[0].code;
  /** A code was saved: the counter moves past it (the API's tenant_sequences row). */
  function useCode(kind, made) {
    const key = counterKey(kind);
    if (made.n + 1 > (Number(State.codeSettings[key]) || 1)) {
      State.codeSettings = { ...State.codeSettings, [key]: made.n + 1 };
      persist("codeSettings");
    }
  }

  // The supplier form: the code is optional on a new supplier.
  const supplierFormBefore = window.supplierFormModal;
  window.supplierFormModal = () => {
    const html = supplierFormBefore();
    const f = (UI.modal && UI.modal.form) || {};
    if (f.id) return html;
    const t = tpl(html);
    const box = t.content.querySelector('input[name="code"]');
    if (box) {
      box.closest(".field").querySelector(".field-label").textContent = "Supplier code";
      box.setAttribute("placeholder", `Leave empty: ${nextCode("supplier")}`);
    }
    return t.innerHTML;
  };
  const newSupplierBefore = Actions["new-supplier"];
  Actions["new-supplier"] = (...args) => {
    newSupplierBefore(...args);
    if (UI.modal && UI.modal.form) { UI.modal.form.code = ""; render(); }
  };
  const saveSupplierBefore = Submits["save-supplier"];
  Submits["save-supplier"] = (form, ev) => {
    const f = UI.modal.form || {};
    const box = form.querySelector('input[name="code"]');
    const made = box && !f.id && !box.value.trim() ? peekCodes("supplier", 1)[0] : null;
    if (made) box.value = made.code;
    const out = saveSupplierBefore(form, ev);
    if (made) {
      if (State.suppliers.some((s) => s.code === made.code)) {
        useCode("supplier", made);
        showToast(`Supplier saved — the code is ${made.code}`);
      } else if (UI.modal && UI.modal.form) {
        UI.modal.form.code = ""; // the form stayed open with an error: the box is empty again
        render();
      }
    }
    return out;
  };

  // Imports: a row with no SKU / no supplier code is a new one, with the next code.
  function withMadeCodes(def, field, kind, message) {
    def.columns = def.columns.map((c) => (c === `${field}*` ? field : c));
    const planBefore = def.plan;
    def.plan = (rows) => {
      const typed = new Set(rows.map((r) => str(r[field]).toLowerCase()).filter(Boolean));
      const blank = rows.filter((r) => !str(r[field]));
      const codes = peekCodes(kind, blank.length, typed);
      blank.forEach((r, i) => { r[field] = codes[i].code; r.__r29Code = codes[i]; });
      return planBefore(rows).map((p, i) => {
        const made = rows[i] && rows[i].__r29Code;
        if (!made || p.status === "error") return p;
        const apply = p.apply;
        return { ...p, message: message(made.code), apply: () => { apply(); useCode(kind, made); } };
      });
    };
  }
  withMadeCodes(IMPORT_DEFS.products, "sku", "sku", (code) => `new — gets the SKU ${code}; starts at 0 in every store`);
  IMPORT_DEFS.products.notes = "Matches by SKU: an existing SKU is updated, a new SKU is added with 0 stock in every store. A row with no SKU is always a new product and gets the next code (Business Settings ▸ Stock Rules ▸ Codes) — to update products, export them first so every row has its SKU. The category (and supplier code, if given) must already exist.";
  withMadeCodes(IMPORT_DEFS.suppliers, "code", "supplier", (code) => `new — gets the code ${code}`);
  IMPORT_DEFS.suppliers.notes = "Matches by supplier code: an existing code is updated, a new code is added. A row with no code is always a new supplier and gets the next code (Business Settings ▸ Stock Rules ▸ Codes).";

  // Business Settings ▸ Stock Rules: the two prefixes.
  function codesCardHTML(editable) {
    const cs = State.codeSettings;
    const dis = editable ? "" : "disabled";
    return `
  <div class="summary-card">
    <div class="summary-card-title">Product and supplier codes</div>
    <div class="qk-muted small">When a new product's SKU or a new supplier's code is left empty — on the form or in an import — the next code is made from this prefix and a running number.</div>
    <div class="field-grid-2">
      <label class="field"><span class="field-label">SKU prefix</span><input class="input" id="r29SkuPrefix" value="${esc(cs.skuPrefix)}" maxlength="10" autocomplete="off" style="text-transform:uppercase" ${dis} /><span class="qk-muted small">Next: <b>${esc(nextCode("sku"))}</b></span></label>
      <label class="field"><span class="field-label">Supplier code prefix</span><input class="input" id="r29SupplierPrefix" value="${esc(cs.supplierPrefix)}" maxlength="10" autocomplete="off" style="text-transform:uppercase" ${dis} /><span class="qk-muted small">Next: <b>${esc(nextCode("supplier"))}</b></span></label>
    </div>
    <div class="qk-muted small">1–10 letters, digits, - or _. The number keeps counting when a prefix changes, and skips a code someone typed by hand. Codes you type yourself still work.</div>
    ${editable ? `<button class="btn btn-primary btn-block" style="margin-top:10px" data-action="r29-save-codes">Save</button>` : ""}
  </div>`;
  }
  Actions["r29-save-codes"] = () => {
    const read = (id) => String((document.getElementById(id) || {}).value || "").trim().toUpperCase();
    const sku = read("r29SkuPrefix"), supplier = read("r29SupplierPrefix");
    const bad = [[sku, "SKU prefix"], [supplier, "Supplier code prefix"]].find(([v]) => !PREFIX_RE.test(v));
    if (bad) { showToast(`${bad[1]}: 1–10 letters, digits, - or _, starting with a letter or digit`, "danger"); return; }
    const top = auditTop();
    const cs = State.codeSettings;
    const before = { "codes.skuPrefix": cs.skuPrefix, "codes.supplierPrefix": cs.supplierPrefix };
    State.codeSettings = { ...cs, skuPrefix: sku, supplierPrefix: supplier };
    persist("codeSettings");
    auditSettings(top, before, { "codes.skuPrefix": sku, "codes.supplierPrefix": supplier });
    showToast(`Codes saved — next ${nextCode("sku")} and ${nextCode("supplier")}`);
    render();
  };

  /* ---------------- B. Barcode: Scan and Look up ---------------- */
  // The prototype's stand-in for Open Food Facts (the server asks it; only the barcode is sent).
  const DEMO_BARCODES = {
    "8901058851298": { name: "2-Minute Masala Noodles", brand: "Maggi", quantity: "4 x 70 g" },
    "8901262150118": { name: "Pure Ghee", brand: "Amul", quantity: "1 L" },
    "8901725133887": { name: "Magic Masala Potato Chips", brand: "Lay's", quantity: "52 g" },
    "8888021200087": { name: "Low Fat Fresh Milk", brand: "Marigold", quantity: "1 L" },
    "5000159407236": { name: "Milk Chocolate Bar", brand: "Mars", quantity: "1 bar" },
  };
  const PACK_RE = /^(?:([0-9]{1,2}) ?x ?)?([0-9]+(?:\.[0-9]+)?) ?(g|kg|ml|l|pc|pcs)$/i;
  function sayBarcode(form, tone, html) {
    const msg = form.querySelector("[data-r29-barcode-msg]");
    if (!msg) return;
    msg.className = `small r29-barcode-msg ${tone}`;
    msg.innerHTML = html;
  }
  function lookUpBarcode(form) {
    const box = form.querySelector('input[name="barcode"]');
    if (!box) return;
    const code = box.value.replace(/[ -]/g, "");
    box.value = code;
    if (!code) return sayBarcode(form, "r29-bad", "Scan or type a barcode first.");
    if (!/^[0-9]{8,14}$/.test(code)) return sayBarcode(form, "r29-bad", "Look up works for 8–14 digit barcodes (EAN / UPC). Your own code can still be saved.");
    const f = UI.modal.form || {};
    const own = State.items.find((i) => i.id !== f.id && (i.barcode || "") === code);
    if (own) {
      return sayBarcode(form, "r29-warn", `Already in your catalogue: <b>${esc(own.name)}</b>${own.sku ? ` (${esc(own.sku)})` : ""}. <button type="button" class="link-btn" data-action="edit-item" data-id="${own.id}">Open it</button>`);
    }
    sayBarcode(form, "qk-muted", "Looking up…");
    setTimeout(() => {
      if (!form.isConnected) return;
      const hit = DEMO_BARCODES[code];
      lastFound = hit ? { code, hit } : null;
      if (!hit) return sayBarcode(form, "qk-muted", "No details found for this barcode — fill them in yourself.");
      const { filled, kept, notes } = fillFromPack(form, hit, false);
      const found = `Found: <b>${esc(hit.name)}</b> · ${esc(hit.brand)} · ${esc(hit.quantity)}.`;
      const head = filled.length ? `Filled the ${listText(filled)} from Open Food Facts — check before saving.`
        : kept.length ? found : `${found} The boxes already match.`;
      const keptText = kept.length
        ? ` Your ${listText(kept)} already had something, so ${kept.length === 1 ? "it was" : "they were"} left as typed. <button type="button" class="link-btn" data-action="r29-use-found">Use these</button>`
        : "";
      sayBarcode(form, filled.length ? "r29-ok" : "qk-muted", `${head}${keptText}${notes.length ? ` ${notes.join(" ")}` : ""}`);
    }, 450);
  }
  /* Puts what the pack says into the form: only empty boxes, or every box when the user asked ("Use these").
     A brand is chosen only if the shop has it; a pack size only if it reads as one of the listed units. */
  let lastFound = null;
  function fillFromPack(form, hit, overwrite) {
    const filled = [], kept = [], notes = [];
    const name = form.querySelector('[name="name"]');
    if (name) {
      if (overwrite || !name.value.trim()) { name.value = hit.name; filled.push("name"); }
      else if (name.value.trim() !== hit.name) kept.push("name");
    }
    const brand = form.querySelector('select[name="brand"]');
    const known = State.brands.find((b) => b.name.toLowerCase() === hit.brand.toLowerCase());
    if (brand) {
      if (!known) notes.push(`The pack says <b>${esc(hit.brand)}</b> — not in your brands yet (Masters ▸ Brands).`);
      else if (overwrite || !brand.value) { brand.value = known.name; filled.push("brand"); }
      else if (brand.value !== known.name) kept.push("brand");
    }
    const kind = form.querySelector('[name="unitKind"]');
    const amount = form.querySelector('[name="unitAmount"]');
    const pack = form.querySelector('[name="unitPack"]');
    if (kind && amount) {
      const m = PACK_RE.exec(hit.quantity.trim());
      const empty = !kind.value && !amount.value.trim();
      const u = m ? m[3].toLowerCase() : "";
      const unit = u === "l" ? "L" : u.startsWith("pc") ? "pc" : u;
      const same = m && kind.value === unit && Number(amount.value) === Number(m[2]) && (pack ? (pack.value || "") === (m[1] || "") : true);
      if (!m) notes.push(`Pack size on the pack: “${esc(hit.quantity)}” — choose it yourself.`);
      else if (same && !overwrite) { /* already what the pack says */ }
      else if (overwrite || empty) {
        kind.value = unit;
        amount.value = m[2];
        if (pack) pack.value = m[1] || "";
        amount.dispatchEvent(new Event("input", { bubbles: true })); // Round 22's range line follows
        filled.push("pack size");
      } else kept.push("pack size");
    }
    return { filled, kept, notes };
  }
  Actions["r29-use-found"] = (el) => {
    const form = el.closest("form");
    const box = form && form.querySelector('input[name="barcode"]');
    if (!form || !lastFound || !box || box.value !== lastFound.code) return;
    const { filled, notes } = fillFromPack(form, lastFound.hit, true);
    sayBarcode(form, "r29-ok", `Replaced the ${listText(filled)} with Open Food Facts' — check before saving.${notes.length ? ` ${notes.join(" ")}` : ""}`);
  };
  Actions["r29-lookup"] = (el) => lookUpBarcode(el.closest("form"));
  Actions["r29-scan"] = (el) => {
    const form = el.closest("form");
    const box = form && form.querySelector('input[name="barcode"]');
    if (!box) return;
    const sold = new Set(State.items.map((i) => i.barcode).filter(Boolean));
    const codes = Object.keys(DEMO_BARCODES);
    box.value = codes.find((c) => !sold.has(c)) || codes[0];
    showToast("Prototype: a pretend scan — the app opens the camera here");
    lookUpBarcode(form);
  };
  // A USB scanner types the digits and presses Enter: in the barcode box, Enter looks up instead of saving.
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || !ev.target.matches || !ev.target.matches("[data-r29-barcode]")) return;
    ev.preventDefault();
    lookUpBarcode(ev.target.form);
  });

  /* ---------------- C. Delivery time in minutes, hours or days ---------------- */
  const ETA_MAX = 30 * DAY;
  const UNIT_MINUTES = { m: 1, h: 60, d: DAY };
  function etaWords(mins) {
    const m = Math.round(Number(mins) || 0);
    if (m < 60) return `${m} min`;
    if (m < DAY) { const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} hour${h === 1 ? "" : "s"}`; }
    const d = Math.floor(m / DAY), h = Math.round((m % DAY) / 60);
    return `${d} day${d === 1 ? "" : "s"}${h ? ` ${h} h` : ""}`;
  }
  const dayText = (ms) => new Date(ms).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });

  // The product form: SKU (A), Barcode (B) and ETA (C) in one pass.
  const itemFormBefore = window.itemFormModal;
  window.itemFormModal = (...args) => {
    const f = (UI.modal && UI.modal.form) || {};
    const t = tpl(itemFormBefore(...args));
    const root = t.content;

    const sku = root.querySelector('input[name="sku"]');
    if (sku && !f.id) {
      const field = sku.closest(".field");
      field.querySelector(".field-label").textContent = "SKU";
      sku.setAttribute("placeholder", `Leave empty: ${nextCode("sku")}`);
    }

    const bc = root.querySelector('input[name="barcode"]');
    if (bc) {
      bc.setAttribute("data-r29-barcode", "");
      bc.setAttribute("placeholder", "EAN / UPC — scan or type");
      bc.setAttribute("autocomplete", "off");
      const wrap = document.createElement("div");
      wrap.className = "field r29-barcode";
      wrap.innerHTML = `<span class="field-label">Barcode</span>
        <div class="r29-barcode-row">${bc.outerHTML}<button type="button" class="btn btn-outline btn-sm r29-scan" data-action="r29-scan" title="Scan with the camera" aria-label="Scan with the camera">${ic("camera")}</button><button type="button" class="btn btn-outline btn-sm" data-action="r29-lookup">Look up</button></div>
        <span class="small r29-barcode-msg qk-muted" data-r29-barcode-msg>Scan first — it fills the name, brand and pack size.</span>`;
      // Its own row under the SKU: the dialog is too narrow for the box and two buttons in half a row.
      const grid = bc.closest(".field-grid-2");
      bc.closest(".field").remove();
      if (grid) {
        if (grid.children.length === 1) grid.classList.remove("field-grid-2");
        grid.insertAdjacentElement("afterend", wrap);
      }
    }

    const eta = root.querySelector('input[name="eta"]');
    if (eta) {
      const mins = Math.min(Math.max(1, Math.round(Number(f.eta) || 15)), ETA_MAX);
      const unit = mins % DAY === 0 ? "d" : mins % 60 === 0 ? "h" : "m";
      const amount = mins / UNIT_MINUTES[unit];
      const field = document.createElement("div");
      field.className = "field";
      field.innerHTML = `<span class="field-label">Delivery time (ETA)</span>
        <div class="r29-eta"><input class="input" name="etaAmount" type="number" min="1" step="1" value="${amount}" /><select class="input" name="etaUnit">${[["m", "minutes"], ["h", "hours"], ["d", "days"]].map(([k, label]) => `<option value="${k}" ${k === unit ? "selected" : ""}>${label}</option>`).join("")}</select><span class="qk-muted small">Up to 30 days. Over 1 day: the cart can only be scheduled.</span></div>
        <input type="hidden" name="eta" value="${mins}" />`;
      // Its own row under Supplier and Reorder level: a third of the dialog is too narrow for a number and a unit.
      const grid = eta.closest(".field-grid-3");
      eta.closest(".field").remove();
      if (grid) {
        grid.classList.replace("field-grid-3", "field-grid-2");
        grid.insertAdjacentElement("afterend", field);
      }
    }

    /* The order staff work in (the user chose this, 2026-11-14): scan first; then what every product needs; then one
       "More details" section, closed, for what most products never need. On Edit its line says what is filled. */
    const form = root.querySelector('form[data-action="save-item"]');
    const actions = form && form.querySelector(".form-actions");
    if (form && actions) {
      const part = (name) => {
        let n = form.querySelector(`[name="${name}"]`);
        while (n && n.parentElement !== form) n = n.parentElement;
        return n || null;
      };
      const fieldOf = (name) => { const el = form.querySelector(`[name="${name}"]`); return el ? el.closest(".field") : null; };
      const media = form.querySelector(".form-media-row");
      const hint = media && [...media.querySelectorAll("*")].find((e) => !e.children.length && /^JPEG/.test(e.textContent.trim()));
      if (hint) hint.textContent = "JPEG, PNG, WebP or SVG, up to 2 MB — or paste an https:// link.";
      const pack = part("unitKind");
      if (pack) pack.querySelectorAll(".r21-hint").forEach((s) => { if (/^Saved as e\.g\./.test(s.textContent.trim())) s.remove(); });
      const prices = part("mrp");
      const cost = fieldOf("costPrice");
      if (prices && cost) { cost.remove(); prices.classList.replace("field-grid-3", "field-grid-2"); }
      const supplyGrid = part("supplierId");
      const supplier = fieldOf("supplierId");
      const reorder = fieldOf("reorderLevel");
      const stockGrid = document.createElement("div");
      stockGrid.className = "field-grid-2";
      [cost, reorder].filter(Boolean).forEach((n) => stockGrid.append(n));
      const tags = part("tags");
      const tagsHead = tags && tags.previousElementSibling && !tags.previousElementSibling.querySelector("[name]") ? tags.previousElementSibling : null;
      const qtyNote = [...form.children].find((c) => c.classList.contains("qk-muted") && /Quantities are kept per store/.test(c.textContent));

      const filled = [];
      if (f.id) {
        if (f.costPrice != null) filled.push(`cost ${money(f.costPrice)}`);
        if (f.supplierId) filled.push("supplier");
        if (Number(f.eta) > DAY) filled.push(`delivery ${etaWords(f.eta)}`);
        if (f.hsnCode) filled.push("HSN code");
        if (f.defaultSubstituteId) filled.push("substitute");
        if (f.description) filled.push("description");
        if ((f.tags || []).length) filled.push(`${f.tags.length} tag${f.tags.length === 1 ? "" : "s"}`);
        if (f.bogo) filled.push("Buy 1 Get 1");
      }
      const more = document.createElement("details");
      more.className = "r29-details";
      if (UI.r29MoreOpen) more.setAttribute("open", "");
      more.innerHTML = `<summary><span class="r29-details-title">${ic("chevronRight")}More details</span><span class="qk-muted small">${filled.length ? `Filled: ${esc(filled.join(", "))}` : "Cost, supplier, reorder level, delivery time, HSN code, substitute, description, tags, Buy 1 Get 1"}</span></summary>`;
      const body = document.createElement("div");
      body.className = "r29-details-body";
      const sub = (text) => { const d = document.createElement("div"); d.className = "r29-details-sub"; d.textContent = text; return d; };
      [sub("Stock and supplier"), stockGrid, supplier, part("etaAmount"), qtyNote, sub("Invoice and substitute"), part("hsnCode"), sub("On the shop"), part("description"), part("bogo"), tagsHead, tags]
        .filter(Boolean).forEach((n) => body.append(n));
      more.append(body);
      if (supplyGrid && !supplyGrid.children.length) supplyGrid.remove();

      [form.querySelector(".r29-barcode"), media, part("name"), part("brand"), pack, prices, part("stock"), part("sku"), more]
        .filter(Boolean).forEach((n) => form.insertBefore(n, actions));
    }
    return t.innerHTML;
  };
  // "More details" stays open or closed while the form is redrawn (an error, a new unit); a new form starts closed.
  document.addEventListener("toggle", (ev) => {
    if (ev.target.classList && ev.target.classList.contains("r29-details")) UI.r29MoreOpen = ev.target.open;
  }, true);
  const editItemBefore = Actions["edit-item"];
  Actions["edit-item"] = (...args) => { UI.r29MoreOpen = false; return editItemBefore(...args); };

  // Add product used to suggest the next QK code; the SKU now starts empty (the server makes the next code).
  const newItemBefore = Actions["new-item"];
  Actions["new-item"] = (...args) => {
    UI.r29MoreOpen = false;
    newItemBefore(...args);
    if (UI.modal && UI.modal.form && !UI.modal.form.id) { UI.modal.form.sku = ""; render(); }
  };

  const saveItemBefore = Submits["save-item"];
  Submits["save-item"] = (form, ev) => {
    const f = UI.modal.form || {};
    // C. The delivery time, kept in minutes (1 minute to 30 days).
    const amt = form.querySelector('[name="etaAmount"]');
    const unit = form.querySelector('[name="etaUnit"]');
    const hidden = form.querySelector('input[name="eta"]');
    if (amt && unit && hidden) {
      const n = Number(amt.value);
      const mins = n * (UNIT_MINUTES[unit.value] || 1);
      const problem = !Number.isInteger(n) || n < 1 ? "Delivery time: a whole number, 1 or more" : mins > ETA_MAX ? "Delivery time: up to 30 days" : null;
      amt.classList.toggle("invalid", !!problem);
      if (problem) { const more = amt.closest("details"); if (more) more.open = true; showToast(problem, "danger"); amt.focus(); return; }
      hidden.value = String(mins);
    }
    // An HSN code Round 10 will refuse sits in "More details": open it so the box can be seen.
    const hsn = form.querySelector('[name="hsnCode"]');
    if (hsn && hsn.value.trim() && !/^[0-9]{4,10}$/.test(hsn.value.replace(/[\s.]/g, ""))) { const more = hsn.closest("details"); if (more) more.open = true; }
    // A. A new product with an empty SKU gets the next code.
    const box = form.querySelector('input[name="sku"]');
    const made = box && !f.id && !box.value.trim() ? peekCodes("sku", 1)[0] : null;
    if (made) box.value = made.code;
    const out = saveItemBefore(form, ev);
    if (made) {
      if (State.items.some((i) => i.sku === made.code)) {
        useCode("sku", made);
        showToast(`Product saved — the SKU is ${made.code}`);
      } else if (box.isConnected) {
        box.value = ""; // the form stayed open with an error
      }
    }
    return out;
  };

  // Demo: one product takes 3 days, so the scheduled-only cart can be tried.
  if (!loadLS("migrated_2026_11_r29_eta", false)) {
    const slow = State.items.find((i) => /basmati rice 5 ?kg/i.test(i.name));
    if (slow) { State.items = State.items.map((i) => (i.id === slow.id ? { ...i, eta: 3 * DAY } : i)); persist("items"); }
    saveLS("migrated_2026_11_r29_eta", true);
  }

  /** The cart's slowest product when it takes more than a day (staff screens keep the slot calendar as it is). */
  function slowest() {
    if (currentUser()) return null;
    let worst = null;
    Object.entries(State.cart || {}).forEach(([id, qty]) => {
      if (!(qty > 0)) return;
      const it = findItem(Number(id));
      if (it && Number(it.eta) > DAY && (!worst || Number(it.eta) > Number(worst.eta))) worst = it;
    });
    return worst;
  }
  const readyAt = (it) => Date.now() + Number(it.eta) * 60000;

  // Such a cart is scheduled-only…
  const speedBefore = effectiveDeliverySpeed;
  window.effectiveDeliverySpeed = () => (slowest() ? "scheduled" : speedBefore());
  // …its calendar starts on the day the product is ready (the days customers can book ahead count from there)…
  const slotDaysBefore = slotDays;
  window.slotDays = () => {
    const base = slotDaysBefore();
    const worst = slowest();
    if (!worst) return base;
    const from = new Date(readyAt(worst)); from.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const offset = Math.round((from - today) / 86400000);
    return base.map((_d, i) => {
      const d = new Date(from); d.setDate(from.getDate() + i);
      const k = offset + i;
      return { date: isoDate(d), label: k === 0 ? "Today" : k === 1 ? "Tomorrow" : dayText(d.getTime()) };
    });
  };
  // …and a slot that starts before the product is ready can't be booked.
  SLOT_LEVEL_LABEL.eta = "Too soon";
  const slotInfoBefore = slotInfo;
  window.slotInfo = (storeId, date, slot) => {
    const inf = slotInfoBefore(storeId, date, slot);
    const worst = slowest();
    if (!worst || !slotBookable(inf)) return inf;
    const [h, m] = slot.start.split(":").map(Number);
    const start = new Date(`${date}T00:00:00`); start.setHours(h, m, 0, 0);
    return start.getTime() < readyAt(worst) ? { ...inf, level: "eta" } : inf;
  };

  // The cart banner says so.
  const bannerBefore = deliveryEtaBannerHTML;
  window.deliveryEtaBannerHTML = (cartItems, isPickup) => {
    const html = bannerBefore(cartItems, isPickup);
    const worst = slowest();
    if (!worst || !cartItems.length) return html;
    const when = dayText(readyAt(worst));
    const title = isPickup ? `Ready for pickup from ${when}` : "Scheduled delivery only";
    const sub = isPickup ? `${esc(worst.name)} takes ${etaWords(worst.eta)}` : `From ${when} — ${esc(worst.name)} takes ${etaWords(worst.eta)}`;
    return html
      .replace(/<div class="eta-banner-title">[^<]*<\/div>/, () => `<div class="eta-banner-title">${title}</div>`)
      .replace(/<div class="eta-banner-sub">[^<]*<\/div>/, () => `<div class="eta-banner-sub">${sub}</div>`);
  };

  // The product card and page: "Delivery in 3 days" when it is over a day.
  const cardBefore = window.productCardHTML;
  window.productCardHTML = (item, ...rest) => {
    const html = cardBefore(item, ...rest);
    if (!item || !(Number(item.eta) > DAY)) return html;
    return html.replace(/<div class="p-card-eta">[\s\S]*?<\/div>/, () => `<div class="p-card-eta r29-eta-long">${ic("clock")}Delivery in ${etaWords(item.eta)}</div>`);
  };
  const productModalBefore = window.productModal;
  window.productModal = (id, ...rest) => {
    const html = productModalBefore(id, ...rest);
    const item = findItem(Number(id));
    if (!item || !(Number(item.eta) > DAY)) return html;
    return html.replace(/<div class="p-card-eta">[\s\S]*?<\/div>/, () => `<div class="p-card-eta r29-eta-long">${ic("clock")}Delivery in ${etaWords(item.eta)} — scheduled delivery only</div>`);
  };

  /* ---------------- F (first part). Tax on / off: the switch ---------------- */
  State.tax = { enabled: true, ...State.tax };
  const taxOn = () => State.tax.enabled !== false;
  function stripTaxRows(root) {
    if (taxOn()) return;
    const name = State.tax.name;
    root.querySelectorAll(".summary-row").forEach((row) => {
      const text = ((row.querySelector("span") || {}).textContent || "").trim();
      if (text.startsWith(`Incl. ${name} (`) || text.startsWith(`${name} (`)) row.remove();
    });
  }

  // The checkout: the scheduled-only note (C) and no tax line (F).
  const checkoutBefore = window.viewCheckout;
  window.viewCheckout = (...args) => {
    const html = checkoutBefore(...args);
    const worst = slowest();
    if (!worst && taxOn()) return html;
    const t = tpl(html);
    const root = t.content;
    if (worst) {
      const express = root.querySelector('[data-action="set-delivery-speed"][data-speed="express"]');
      if (express) {
        express.removeAttribute("data-action");
        express.setAttribute("disabled", "");
        express.setAttribute("title", "Not for this cart");
        express.classList.remove("active");
        express.classList.add("r29-off");
      }
      const scheduled = root.querySelector('[data-speed="scheduled"]');
      const row = (express || scheduled) && (express || scheduled).closest(".filter-pill-row");
      if (row) {
        row.insertAdjacentHTML("afterend", `<div class="notice notice-warn r29-eta-note">${ic("clock")}<span><b>${esc(worst.name)}</b> takes ${etaWords(worst.eta)}, so this order can only be scheduled — the first times start ${dayText(readyAt(worst))}.${express ? " Express isn't available for it." : ""}</span></div>`);
      }
      // A time before the product is ready says "Too soon" (the picker's word for an unknown reason is "Not available").
      root.querySelectorAll(".slot-pill[data-slot]").forEach((pill) => {
        const found = findSlotByKey(pill.dataset.slot);
        if (!found || slotInfo(found.storeId, found.date, found.slot).level !== "eta") return;
        const state = pill.querySelector(".slot-pill-state");
        if (state) state.textContent = "Too soon";
        pill.setAttribute("title", "Before the products are ready");
      });
      [...root.querySelectorAll(".qk-muted.small")].filter((el) => el.textContent.includes("waiting at the counter")).forEach((el) => {
        el.innerHTML = `${ic("clock")} Ready from ${dayText(readyAt(worst))} — ${esc(worst.name)} takes ${etaWords(worst.eta)}. We'll notify you when it's packed.`;
      });
    }
    stripTaxRows(root);
    return t.innerHTML;
  };
  const cartBefore = window.viewCart;
  window.viewCart = (...args) => {
    const html = cartBefore(...args);
    if (taxOn()) return html;
    const t = tpl(html);
    stripTaxRows(t.content);
    return t.innerHTML;
  };

  /* ---------------- D. Stock receipts and adjustments in the Audit log ---------------- */
  Object.assign(AUDIT_ACTION_TEXT, {
    "stock.received": ["Stock", "received stock of"],
    "stock.adjusted": ["Stock", "adjusted the stock of"],
    "stock.imported": ["Stock", "imported stock counts at"],
    "stock.adjustment_requested": ["Stock", "sent for approval a stock adjustment of"],
    "stock.adjustment_approved": ["Stock", "approved the stock adjustment of"],
    "stock.adjustment_rejected": ["Stock", "rejected the stock adjustment of"],
    "stock.adjustment_cancelled": ["Stock", "cancelled their stock adjustment of"],
    "stock.import_requested": ["Stock", "sent for approval a stock import at"],
    "stock.import_approved": ["Stock", "approved the stock import at"],
    "stock.import_rejected": ["Stock", "rejected the stock import at"],
    "stock.import_cancelled": ["Stock", "cancelled their stock import at"],
  });
  Object.assign(AUDIT_ENTITY_LABEL, { stock: "Stock" });
  Object.assign(AUDIT_FIELD_LABEL, {
    onHand: "On hand", change: "Change", reason: "Reason", note: "Note", unitCost: "Unit cost", supplier: "Supplier",
    ref: "Invoice / DO no.", enteredBy: "Entered by", products: "Products", file: "File", why: "Why rejected",
  });
  const ADJUST_TYPES = ["stocktake", "damaged", "expired", "correction"];
  const reasonText = (type) => (STOCK_MOVE_TYPES[type] || { label: type }).label;

  /** A receipt or an adjustment that changed the stock straight away (approval off). */
  function auditMove(mv) {
    const u = currentUser();
    if (!u) return;
    const receipt = mv.type === "receive";
    addAuditEvent({
      action: receipt ? "stock.received" : "stock.adjusted", entity: "stock", entityId: `${mv.branchId}:${mv.itemId}`,
      actorType: "user", actorId: u.id, names: { entity: `${itemName(mv.itemId)} at ${storeName(mv.branchId)}` },
      before: { onHand: mv.balance - mv.qty },
      after: clean(receipt
        ? { onHand: mv.balance, unitCost: mv.unitCost != null ? money(mv.unitCost) : null, supplier: mv.supplierId ? supplierName(mv.supplierId) : null, ref: mv.ref }
        : { onHand: mv.balance, reason: reasonText(mv.type), note: mv.note }),
    });
  }

  /* ---------------- E. Stock adjustment approval ---------------- */
  State.stockRequests = loadLS("stockRequests", () => []);
  const approvalOn = () => !!businessRules().stockApproval;
  const requestsAt = (branchId, status) => State.stockRequests.filter((r) => r.branchId === branchId && (!status || r.status === status));
  const waitingFor = (branchId, itemId) => requestsAt(branchId, "waiting").find((r) => r.kind === "adjust" && r.lines[0].itemId === itemId);
  /** The store's manager or a Super Admin, with stock rights — never the person who entered it. */
  const canApprove = (u, req) => !!u && u.active !== false && u.id !== req.by && canEdit(u, "inventory")
    && (isSuperAdmin(u) || (u.roleId === ROLE_STORE_MANAGER && userStoreIds(u).includes(req.branchId)));
  const approversFor = (req) => State.users.filter((u) => canApprove(u, req));
  function approverText(req) {
    const managers = approversFor(req).filter((u) => !isSuperAdmin(u)).map((u) => u.name);
    const admin = approversFor(req).some((u) => isSuperAdmin(u));
    const parts = [...(managers.length ? [`${managers.join(" or ")} (store manager)`] : []), ...(admin ? ["the Super Admin"] : [])];
    return parts.length ? parts.join(" or ") : "nobody";
  }
  const nobodyText = (branchId) => `Nobody else can approve stock at ${storeName(branchId)}: give it a store manager (Setup ▸ Users), or turn approval off (Business Settings ▸ Stock Rules).`;

  function auditRequest(action, req, changes) {
    const u = currentUser();
    if (!u) return;
    const decided = !action.endsWith("_requested") && !action.endsWith("_cancelled");
    if (req.kind === "import") {
      addAuditEvent({
        action, entity: "stock", entityId: String(req.branchId), actorType: "user", actorId: u.id, names: { entity: storeName(req.branchId) },
        after: clean({ products: req.lines.length, file: req.file, enteredBy: decided ? userName(req.by) : null, why: req.why }),
      });
      return;
    }
    const l = req.lines[0];
    const applied = changes && changes[0];
    addAuditEvent({
      action, entity: "stock", entityId: `${req.branchId}:${l.itemId}`, actorType: "user", actorId: u.id,
      names: { entity: `${itemName(l.itemId)} at ${storeName(req.branchId)}` },
      before: applied ? { onHand: applied.before } : null,
      after: clean({ onHand: applied ? applied.after : null, change: applied ? null : signed(l.qty), reason: reasonText(l.type), note: req.note, enteredBy: decided ? userName(req.by) : null, why: req.why }),
    });
  }

  // Stock ▸ Adjust: while approval is on, the change waits instead of applying.
  function requestAdjustment(form) {
    const m = UI.modal;
    const fd = new FormData(form);
    const itemId = Number(fd.get("itemId"));
    const item = findItem(itemId);
    const raw = String(fd.get("qty") || "").trim();
    const typed = Math.floor(Number(raw));
    const fail = (msg) => { UI.modal.error = msg; if (!m.itemId) UI.modal.itemId = itemId; render(); };
    if (!item || raw === "" || !Number.isFinite(typed)) return fail("Enter a quantity");
    const reason = String(fd.get("reason") || "");
    const note = String(fd.get("note") || "").trim();
    const onHand = storeQty(m.branchId, itemId) || 0;
    let delta;
    if (reason === "stocktake") { if (typed < 0) return fail("A counted quantity can't be below 0"); delta = typed - onHand; }
    else if (reason === "correction") delta = typed;
    else { if (typed <= 0) return fail("Enter how many units to remove"); delta = -typed; }
    if (!allowNegativeStock() && onHand + delta < 0) return fail(`Only ${onHand} on hand — negative stock isn't allowed`);
    if (delta === 0) { UI.modal = null; showToast("No change — quantity already matches"); render(); return; }
    if (waitingFor(m.branchId, itemId)) return fail("This product already has an adjustment waiting at this store — approve, reject or cancel that one first (Stock ▸ Approvals).");
    const req = { id: genId("ADJ"), kind: "adjust", branchId: m.branchId, by: currentUser().id, at: Date.now(), status: "waiting", note, lines: [{ itemId, type: reason, qty: delta, typed, before: onHand }] };
    if (!approversFor(req).length) return fail(nobodyText(m.branchId));
    State.stockRequests = [req, ...State.stockRequests];
    persist("stockRequests");
    auditRequest("stock.adjustment_requested", req);
    UI.modal = null;
    showToast(`Sent for approval — ${item.name} ${signed(delta)} once ${approverText(req)} approves`);
    render();
  }

  const saveMoveBefore = Submits["save-stock-move"];
  Submits["save-stock-move"] = (form, ev) => {
    const m = UI.modal;
    if (m && m.mode === "adjust" && approvalOn()) return requestAdjustment(form);
    const topMove = (State.stockMoves[0] || {}).id;
    const out = saveMoveBefore(form, ev);
    const mv = State.stockMoves[0];
    if (mv && mv.id !== topMove && (mv.type === "receive" || ADJUST_TYPES.includes(mv.type))) auditMove(mv);
    return out;
  };

  // The Adjust dialog says the change will wait.
  const moveModalBefore = window.stockMoveModal;
  window.stockMoveModal = (...args) => {
    const html = moveModalBefore(...args);
    const m = UI.modal;
    if (!m || m.mode !== "adjust" || !approvalOn() || !currentUser()) return html;
    const t = tpl(html);
    const root = t.content;
    const pending = m.itemId ? waitingFor(m.branchId, m.itemId) : null;
    const note = pending
      ? `<div class="notice notice-warn r29-approval-note">${ic("clock")}<span>An adjustment of this product is already waiting (${signed(pending.lines[0].qty)}, entered by ${esc(userName(pending.by))}). Approve, reject or cancel it in Stock ▸ Approvals first.</span></div>`
      : `<div class="notice notice-warn r29-approval-note">${ic("clock")}<span><b>Approval is on.</b> This change waits for ${esc(approverText({ branchId: m.branchId, by: currentUser().id }))} to approve it — the stock doesn't change until then.</span></div>`;
    const reason = root.querySelector('select[name="reason"]');
    const anchor = reason ? reason.closest(".field") : root.querySelector("form .form-actions");
    if (anchor) anchor.insertAdjacentHTML("beforebegin", note);
    const submit = root.querySelector('form button[type="submit"]');
    if (submit) submit.textContent = "Send for approval";
    return t.innerHTML;
  };

  // Approve, reject, cancel.
  Actions["r29-approve"] = (el) => {
    const req = State.stockRequests.find((r) => r.id === el.dataset.id);
    const u = currentUser();
    if (!req || req.status !== "waiting" || !canApprove(u, req)) return;
    if (!allowNegativeStock()) {
      const bad = req.lines.find((l) => (storeQty(req.branchId, l.itemId) || 0) + l.qty < 0);
      if (bad) { showToast(`${itemName(bad.itemId)}: only ${storeQty(req.branchId, bad.itemId) || 0} on hand now — it can't go below 0. Reject it, or receive stock first.`, "danger"); return; }
    }
    const by = `${userName(req.by)} · approved by ${u.name}`;
    const changes = req.lines.map((l) => {
      const before = storeQty(req.branchId, l.itemId) || 0;
      if (l.qty !== 0) {
        recordStockMove({ branchId: req.branchId, itemId: l.itemId, type: l.type, qty: l.qty, unitCost: l.unitCost, note: l.note || req.note || "" });
        State.stockMoves[0].by = by;
      }
      if (l.unitCost != null) State.items = State.items.map((i) => (i.id === l.itemId ? { ...i, costPrice: l.unitCost } : i));
      return { before, after: before + l.qty };
    });
    persist("stockMoves"); persist("items");
    Object.assign(req, { status: "approved", decidedBy: u.id, decidedAt: Date.now() });
    persist("stockRequests");
    auditRequest(req.kind === "import" ? "stock.import_approved" : "stock.adjustment_approved", req, changes);
    showToast(req.kind === "import"
      ? `Approved — ${req.lines.length} product${req.lines.length === 1 ? "" : "s"} updated at ${storeName(req.branchId)}`
      : `Approved — ${itemName(req.lines[0].itemId)} is now ${changes[0].after}`);
    render();
  };
  Actions["r29-reject"] = (el) => { UI.modal = { type: "r29Reject", id: el.dataset.id }; render(); };
  Actions["r29-cancel-req"] = (el) => {
    const req = State.stockRequests.find((r) => r.id === el.dataset.id);
    const u = currentUser();
    if (!req || req.status !== "waiting" || !u || u.id !== req.by) return;
    Object.assign(req, { status: "cancelled", decidedBy: u.id, decidedAt: Date.now() });
    persist("stockRequests");
    auditRequest(req.kind === "import" ? "stock.import_cancelled" : "stock.adjustment_cancelled", req);
    showToast("Cancelled — the stock stays as it is");
    render();
  };
  function rejectModalHTML() {
    const req = State.stockRequests.find((r) => r.id === UI.modal.id);
    if (!req) return "";
    const what = req.kind === "import" ? `${req.lines.length} product${req.lines.length === 1 ? "" : "s"} from ${esc(req.file || "a file")}` : `<b>${esc(itemName(req.lines[0].itemId))}</b> ${signed(req.lines[0].qty)}`;
    return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>Reject the ${req.kind === "import" ? "stock import" : "adjustment"}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <form class="dialog-body" data-action="r29-reject-save">
        <div class="qk-muted small" style="margin-bottom:10px">${what} at ${esc(storeName(req.branchId))}, entered by ${esc(userName(req.by))}. The stock stays as it is.</div>
        <label class="field"><span class="field-label">Why? *</span><textarea class="input" name="why" rows="2" maxlength="200" placeholder="e.g. Counted again — 42, not 40"></textarea><span class="qk-muted small">Shown to ${esc(userName(req.by))} in Stock ▸ Approvals and in the Audit log.</span></label>
        ${UI.modal.error ? `<div class="field-error">${esc(UI.modal.error)}</div>` : ""}
        <div class="form-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Reject</button></div>
      </form>
    </div>
  </div>`;
  }
  const extraBefore = window.extraModal;
  window.extraModal = (type) => (type === "r29Reject" ? rejectModalHTML() : extraBefore(type));
  Submits["r29-reject-save"] = (form) => {
    const req = State.stockRequests.find((r) => r.id === UI.modal.id);
    const u = currentUser();
    if (!req || req.status !== "waiting" || !canApprove(u, req)) { UI.modal = null; render(); return; }
    const why = String(new FormData(form).get("why") || "").trim();
    if (!why) { UI.modal.error = "Say why, so the person who entered it knows"; render(); return; }
    Object.assign(req, { status: "rejected", decidedBy: u.id, decidedAt: Date.now(), why });
    persist("stockRequests");
    auditRequest(req.kind === "import" ? "stock.import_rejected" : "stock.adjustment_rejected", req);
    UI.modal = null;
    showToast("Rejected — the stock stays as it is");
    render();
  };

  // Stock ▸ Approvals: what waits at this store, and what was decided lately.
  function lineHTML(req, l) {
    const now = storeQty(req.branchId, l.itemId) || 0;
    if (l.qty === 0) return `On hand ${now} · unit cost ${l.unitCost != null ? money(l.unitCost) : "—"} only`;
    const drift = now !== l.before ? ` <span class="qk-muted">(${l.before} when entered)</span>` : "";
    const counted = l.type === "stocktake" || l.type === "import" ? ` · counted ${l.typed}` : "";
    return `On hand ${now} → <b>${now + l.qty}</b> <span class="${l.qty < 0 ? "tone-red" : "tone-green"}">(${signed(l.qty)})</span>${drift}${counted}`;
  }
  function requestCardHTML(req, u) {
    const l = req.lines[0];
    const title = req.kind === "import"
      ? `<b>Stock import</b> · ${esc(req.file || "file")} · ${req.lines.length} product${req.lines.length === 1 ? "" : "s"}`
      : `<b>${esc(itemName(l.itemId))}</b> <span class="badge badge-gray-soft">${esc(reasonText(l.type))}</span>`;
    const body = req.kind === "import"
      ? `${req.lines.slice(0, 4).map((x) => `<div class="small"><b>${esc(itemName(x.itemId))}</b> — ${lineHTML(req, x)}</div>`).join("")}${req.lines.length > 4 ? `<div class="qk-muted small">and ${req.lines.length - 4} more</div>` : ""}`
      : `<div class="small">${lineHTML(req, l)}</div>`;
    const mine = u && u.id === req.by;
    const actions = canApprove(u, req)
      ? `<button class="btn btn-sm btn-outline" data-action="r29-reject" data-id="${req.id}">Reject</button><button class="btn btn-sm btn-primary" data-action="r29-approve" data-id="${req.id}">Approve</button>`
      : `<span class="qk-muted small">Waiting for ${esc(approverText(req))}</span>${mine ? `<button class="btn btn-sm btn-outline" data-action="r29-cancel-req" data-id="${req.id}">Cancel</button>` : ""}`;
    return `
    <div class="r29-req">
      <div class="r29-req-main">
        <div>${title}</div>
        ${body}
        <div class="qk-muted small">Entered by <b>${esc(userName(req.by))}</b>${mine ? " (you)" : ""} · ${fmtDateTime(req.at)}${req.note ? ` · “${esc(req.note)}”` : ""}</div>
      </div>
      <div class="r29-req-actions">${actions}</div>
    </div>`;
  }
  function doneRowHTML(r) {
    const l = r.lines[0];
    const what = r.kind === "import"
      ? `Stock import · ${esc(r.file || "file")} · ${r.lines.length} product${r.lines.length === 1 ? "" : "s"}`
      : `<b>${esc(itemName(l.itemId))}</b> ${signed(l.qty)} <span class="qk-muted">(${esc(reasonText(l.type))})</span>`;
    const how = r.status === "approved" ? `<span class="badge badge-green-soft">Approved</span> by ${esc(userName(r.decidedBy))}`
      : r.status === "rejected" ? `<span class="badge badge-red-soft">Rejected</span> by ${esc(userName(r.decidedBy))} — “${esc(r.why || "")}”`
        : `<span class="badge badge-gray-soft">Cancelled</span>`;
    return `<div class="r29-done"><span class="small">${what}</span><span class="small">${how} · ${fmtDateTime(r.decidedAt)}</span><span class="qk-muted small">entered by ${esc(userName(r.by))}</span></div>`;
  }
  function approvalsHTML(branchId) {
    const u = currentUser();
    const waiting = requestsAt(branchId, "waiting").sort((a, b) => b.at - a.at);
    const done = requestsAt(branchId).filter((r) => r.status !== "waiting").sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0)).slice(0, 10);
    const lead = approvalOn()
      ? `A stock adjustment or a stock import waits here until <b>${esc(storeName(branchId))}</b>'s manager or the Super Admin approves it — never the person who entered it.`
      : `Approval is off now (Business Settings ▸ Stock Rules) — these were entered while it was on and still wait.`;
    return `
  <div class="admin-toolbar"><div class="qk-muted small">${lead} Approving applies the difference worked out when it was entered, so sales in between are kept.</div></div>
  ${waiting.length ? `<div class="r29-req-list">${waiting.map((r) => requestCardHTML(r, u)).join("")}</div>` : `<div class="empty-state"><div class="empty-title">Nothing waiting</div><div class="empty-hint">Adjustments and stock imports sent for approval show up here.</div></div>`}
  ${done.length ? `<div class="r29-done-title">Recently decided</div><div class="r29-done-list">${done.map(doneRowHTML).join("")}</div>` : ""}`;
  }

  const inventoryBefore = window.adminInventoryV2;
  window.adminInventoryV2 = () => {
    const ids = scopedBranchIds();
    const single = ids && ids.length === 1 ? ids[0] : null;
    const onApprovals = !!single && UI.invTab === "approvals";
    if (onApprovals) UI.invTab = "stock";
    let html;
    try { html = inventoryBefore(); } finally { if (onApprovals) UI.invTab = "approvals"; }
    const t = tpl(html);
    const root = t.content;
    if (!single) {
      // The store list: what waits at each store.
      root.querySelectorAll('[data-action="pick-store-scope"][data-id]').forEach((btn) => {
        const n = requestsAt(Number(btn.dataset.id), "waiting").length;
        if (n) btn.insertAdjacentHTML("beforebegin", `<span class="badge badge-yellow">${n} waiting approval</span>`);
      });
      return t.innerHTML;
    }
    const pills = root.querySelector(".pill-row");
    if (!pills || (!approvalOn() && !requestsAt(single).length)) return t.innerHTML;
    const n = requestsAt(single, "waiting").length;
    pills.insertAdjacentHTML("beforeend", `<button class="pill ${onApprovals ? "active" : ""}" data-action="inv-tab" data-tab="approvals">Approvals${n ? ` <span class="pill-count">${n}</span>` : ""}</button>`);
    if (onApprovals) {
      pills.querySelectorAll(".pill").forEach((p) => p.classList.toggle("active", p.dataset.tab === "approvals"));
      while (pills.nextSibling) pills.nextSibling.remove();
      pills.insertAdjacentHTML("afterend", approvalsHTML(single));
    }
    return t.innerHTML;
  };
  // Stock on hand: a product with an adjustment waiting says so.
  const rowsBefore = window.inventoryRowsHTML;
  window.inventoryRowsHTML = (branchId, editable) => {
    const html = rowsBefore(branchId, editable);
    const waiting = requestsAt(branchId, "waiting").filter((r) => r.kind === "adjust");
    if (!waiting.length) return html;
    const t = tpl(html);
    const names = new Map(waiting.map((r) => [itemName(r.lines[0].itemId), r]));
    t.content.querySelectorAll(".inv-row:not(.inv-head) .inv-prod b").forEach((b) => {
      const r = names.get(b.textContent.trim());
      if (r) b.insertAdjacentHTML("afterend", ` <span class="badge badge-yellow-soft r29-wait">Adjustment waiting ${signed(r.lines[0].qty)}</span>`);
    });
    return t.innerHTML;
  };

  // Stock import: each row keeps what it would change, so the file can wait store by store.
  const inventoryPlan = IMPORT_DEFS.inventory.plan;
  IMPORT_DEFS.inventory.plan = (rows) => inventoryPlan(rows).map((p, i) => {
    if (p.status === "error") return p;
    const r = rows[i];
    const storeText = str(r.store), sku = str(r.sku);
    const store = State.branches.find((b) => b.name.toLowerCase() === storeText.toLowerCase() || String(b.id) === storeText);
    const item = State.items.find((x) => (x.sku || "").toLowerCase() === sku.toLowerCase());
    return store && item ? { ...p, r29: { branchId: store.id, itemId: item.id, target: num(r.quantity), unitCost: num(r.unit_cost), note: str(r.note) } } : p;
  });
  const importModalBefore = window.bulkImportModal;
  window.bulkImportModal = () => {
    const html = importModalBefore();
    const m = UI.modal;
    if (!m || m.entity !== "inventory" || !approvalOn()) return html;
    const t = tpl(html.replace(/(data-action="confirm-import"[^>]*>)Import ([0-9]+) (rows?)</, (_x, open, n, rowsWord) => `${open}Send ${n} ${rowsWord} for approval<`));
    const body = t.content.querySelector(".dialog-body");
    if (body) body.insertAdjacentHTML("afterbegin", `<div class="notice notice-warn" style="margin-bottom:12px">${ic("clock")}<span><b>Approval is on.</b> Each store's part of the file waits until that store's manager or the Super Admin approves it — never you. The stock doesn't change until then.</span></div>`);
    return t.innerHTML;
  };
  const confirmImportBefore = Actions["confirm-import"];
  Actions["confirm-import"] = (el, ev) => {
    const m = UI.modal;
    if (!m || m.entity !== "inventory" || !currentUser()) return confirmImportBefore(el, ev);
    const ok = (m.plan || []).filter((p) => p.status !== "error" && p.r29);
    if (!approvalOn()) {
      // Straight in: one Audit log entry per store.
      const topMove = (State.stockMoves[0] || {}).id;
      const out = confirmImportBefore(el, ev);
      const moves = [];
      for (const mv of State.stockMoves) { if (mv.id === topMove) break; if (mv.type === "import") moves.push(mv); }
      const perStore = new Map();
      moves.forEach((mv) => perStore.set(mv.branchId, (perStore.get(mv.branchId) || 0) + 1));
      perStore.forEach((count, branchId) => addAuditEvent({
        action: "stock.imported", entity: "stock", entityId: String(branchId), actorType: "user", actorId: currentUser().id,
        names: { entity: storeName(branchId) }, after: clean({ products: count, file: m.fileName }),
      }));
      return out;
    }
    // Approval on: one request per store, the difference worked out now.
    const byStore = new Map();
    ok.forEach((p) => {
      const d = p.r29;
      const before = storeQty(d.branchId, d.itemId) || 0;
      const qty = d.target - before;
      if (qty === 0 && d.unitCost == null) return;
      if (!byStore.has(d.branchId)) byStore.set(d.branchId, []);
      byStore.get(d.branchId).push({ itemId: d.itemId, type: "import", qty, typed: d.target, before, unitCost: d.unitCost, note: d.note });
    });
    if (!byStore.size) { UI.modal = null; showToast("Nothing to change — every quantity already matches"); render(); return; }
    const me = currentUser();
    const blocked = [...byStore.keys()].find((branchId) => !approversFor({ branchId, by: me.id }).length);
    if (blocked != null) { showToast(nobodyText(blocked), "danger"); return; }
    const made = [...byStore.entries()].map(([branchId, lines]) => ({ id: genId("ADJ"), kind: "import", branchId, by: me.id, at: Date.now(), status: "waiting", file: m.fileName || "", lines }));
    State.stockRequests = [...made, ...State.stockRequests];
    persist("stockRequests");
    made.forEach((req) => auditRequest("stock.import_requested", req));
    const rows = made.reduce((s, r) => s + r.lines.length, 0);
    UI.modal = null;
    showToast(`Sent for approval — ${rows} product${rows === 1 ? "" : "s"} at ${made.length} store${made.length === 1 ? "" : "s"}; each store's manager or the Super Admin approves`);
    render();
  };

  // Business Settings ▸ Stock Rules: the switch, and the codes (A).
  function approvalCardHTML(editable) {
    const on = approvalOn();
    const waiting = State.stockRequests.filter((r) => r.status === "waiting").length;
    return `
  <div class="summary-card">
    <div class="summary-card-title">Stock adjustment approval</div>
    <label class="stock-toggle-lg"><input type="checkbox" id="r29Approval" ${on ? "checked" : ""} ${editable ? "" : "disabled"} /><span>Adjustments need a second person's approval</span></label>
    <div class="qk-muted small">On: a stock take, damaged, expired or correction — and a stock import — waits until the store's manager or the Super Admin approves it, never the person who entered it. The stock doesn't change until then. Receiving stock and transfers don't wait. Off: changes apply at once. Either way every change is in Stock history and the Audit log.</div>
    ${waiting ? `<div class="notice notice-warn" style="margin-top:8px">${ic("clock")}<span>${waiting} waiting now. Turning approval off leaves them waiting — approve or reject them in Stock ▸ Approvals.</span></div>` : ""}
    ${editable ? `<button class="btn btn-primary btn-block" style="margin-top:10px" data-action="r29-save-approval">Save</button>` : ""}
  </div>`;
  }
  Actions["r29-save-approval"] = () => {
    const box = document.getElementById("r29Approval");
    if (!box) return;
    const top = auditTop();
    const before = approvalOn();
    State.businessRules = { ...businessRules(), stockApproval: box.checked };
    persist("businessRules");
    auditSettings(top, { "stock.adjustmentApproval": before }, { "stock.adjustmentApproval": box.checked });
    showToast(box.checked ? "Approval on — adjustments and stock imports now wait for the store's manager or the Super Admin" : "Approval off — adjustments apply at once");
    render();
  };
  const stockRulesBefore = window.adminStockRulesPanel;
  window.adminStockRulesPanel = (editable) => `${stockRulesBefore(editable)}${approvalCardHTML(editable)}${codesCardHTML(editable)}`;
  // Round 20 puts every Stock Rules card in one section; the codes get a section of their own.
  const businessBefore = window.adminBusinessSettings;
  window.adminBusinessSettings = () => {
    const html = businessBefore();
    if (UI.businessSettingsTab !== "stock") return html;
    const t = tpl(html);
    const card = [...t.content.querySelectorAll(".summary-card")].find((c) => cardTitle(c) === "Product and supplier codes");
    const section = card && card.closest(".bs-section");
    if (!section) return html;
    const blurb = section.querySelector(".bs-section-blurb");
    if (blurb) blurb.textContent = "What happens when stock runs out or an item is unavailable, how a receipt sets the cost price, whether a stock change needs a second person's approval, and the goodwill your team may give.";
    section.insertAdjacentHTML("afterend", `<section class="bs-section"><div class="bs-section-head"><div class="bs-section-title">Codes</div><div class="bs-section-blurb">How a new product's SKU and a new supplier's code are made when they are left empty.</div></div><div class="bs-cards one">${card.outerHTML}</div></section>`);
    card.remove();
    return t.innerHTML;
  };

  /* ---------------- F. Tax on / off ---------------- */
  const taxPanelBefore = window.adminTaxPanel;
  window.adminTaxPanel = (editable) => {
    const on = UI.r29TaxDraft != null ? UI.r29TaxDraft : taxOn();
    const t = tpl(taxPanelBefore(editable));
    const card = t.content.querySelector(".summary-card");
    const title = card && card.querySelector(".summary-card-title");
    if (!title) return t.innerHTML;
    title.insertAdjacentHTML("afterend", `<label class="stock-toggle-lg r29-tax-switch"><input type="checkbox" data-action="r29-tax-switch" ${on ? "checked" : ""} ${editable ? "" : "disabled"} /><span><b>Charge tax on sales</b> — switch it off if the business doesn't charge tax</span></label>`);
    if (!on) {
      title.textContent = "Tax";
      [...card.children].forEach((el) => { if (el !== title && !el.classList.contains("r29-tax-switch") && el.tagName !== "BUTTON") el.remove(); });
      card.querySelector(".r29-tax-switch").insertAdjacentHTML("afterend", `<div class="notice notice-warn" style="margin:4px 0 10px">${ic("alert")}<span><b>Tax is off.</b> Nothing is added at checkout, and the bill, the order and the invoice show no tax line — the invoice is titled “Invoice”, not “Tax invoice”. The GST on delivery charges switches do nothing while it is off. Switch it on to set the tax name, rate and type.</span></div>`);
    }
    return t.innerHTML;
  };
  Actions["r29-tax-switch"] = (el) => { UI.r29TaxDraft = el.checked; render(); };
  const saveTaxBefore = Actions["save-tax"];
  Actions["save-tax"] = (el, ev) => {
    const next = UI.r29TaxDraft != null ? UI.r29TaxDraft : taxOn();
    const before = taxOn();
    const top = auditTop();
    UI.r29TaxDraft = null;
    State.tax = { ...State.tax, enabled: next };
    persist("tax");
    if (!next) {
      auditSettings(top, { "tax.enabled": before }, { "tax.enabled": false });
      showToast("Tax is off — no tax on the bill or the invoice");
      render();
      return;
    }
    const out = saveTaxBefore(el, ev);
    auditSettings(top, { "tax.enabled": before }, { "tax.enabled": true });
    return out;
  };
  const businessTabBefore = Actions["set-business-tab"];
  Actions["set-business-tab"] = (el, ev) => { UI.r29TaxDraft = null; return businessTabBefore(el, ev); };
  const feeTaxBefore = window.feeTaxCardHTML;
  if (feeTaxBefore) {
    window.feeTaxCardHTML = (editable) => {
      const html = feeTaxBefore(editable);
      if (taxOn()) return html;
      const t = tpl(html);
      const title = t.content.querySelector(".summary-card-title");
      if (title) title.insertAdjacentHTML("afterend", `<div class="notice notice-warn" style="margin:4px 0 8px">${ic("alert")}<span>Tax is off (Business Settings ▸ Tax) — these switches do nothing until it is on.</span></div>`);
      return t.innerHTML;
    };
  }
  // The bill: no tax at all while it is off.
  const totalsBefore = window.cartTotals;
  window.cartTotals = (...args) => {
    if (taxOn()) return totalsBefore(...args);
    const real = State.tax;
    State.tax = { ...real, rate: 0, inclusive: true, taxOnDeliveryFee: false, taxOnExpressCharge: false };
    try { return totalsBefore(...args); } finally { State.tax = real; }
  };
  // An order placed while it is off keeps "no tax": no tax line on its screen, an invoice without tax.
  const payBefore = window.handlePay;
  window.handlePay = (...args) => {
    const known = new Set(State.orders.map((o) => o.id));
    const out = payBefore(...args);
    if (!taxOn()) {
      let changed = false;
      State.orders.forEach((o) => {
        if (known.has(o.id)) return;
        o.taxSnapshot = { ...(o.taxSnapshot || State.tax), rate: 0, enabled: false };
        o.gst = null;
        changed = true;
      });
      if (changed) persist("orders");
    }
    return out;
  };
  const invoiceBefore = window.invoiceHTML;
  window.invoiceHTML = (order) => {
    const html = invoiceBefore(order);
    if (!order || !order.taxSnapshot || order.taxSnapshot.enabled !== false) return html;
    const t = tpl(html);
    const root = t.content;
    const main = root.querySelector(".inv-title-main");
    if (main) main.textContent = "INVOICE";
    root.querySelectorAll(".inv-seller div").forEach((d) => { if (/GST Reg\. No/.test(d.textContent)) d.textContent = `UEN: ${State.companyProfile.uen}`; });
    // The table without its Taxable and GST columns (the footer's first cell spans six columns).
    const table = root.querySelector(".inv-table");
    if (table) {
      const heads = [...table.querySelectorAll("thead th")];
      const drop = heads.map((th, i) => (/^(Taxable|GST\b)/.test(th.textContent.trim()) ? i : -1)).filter((i) => i >= 0);
      const dropCells = (row) => {
        let col = 0;
        [...row.children].forEach((cell) => {
          const span = Number(cell.getAttribute("colspan")) || 1;
          if (span === 1 && drop.includes(col)) cell.remove();
          col += span;
        });
      };
      table.querySelectorAll("tr").forEach(dropCells);
    }
    root.querySelectorAll(".inv-totals .row").forEach((row) => {
      const text = row.textContent.trim();
      if (/^Of which GST/.test(text) || text.startsWith(`${order.taxSnapshot.name} (`)) row.remove();
      const label = row.querySelector("span");
      if (label && /^Item total \((incl|excl)\. GST\)$/.test(label.textContent.trim())) label.textContent = "Item total";
    });
    const legal = root.querySelector(".inv-legal div");
    if (legal) legal.textContent = "All prices are quoted in Singapore Dollars. No tax is charged on this invoice.";
    return t.innerHTML;
  };

  /* ---------------- Styles ---------------- */
  const style = document.createElement("style");
  style.textContent = `
    .r29-barcode-row { display: flex; gap: 6px; align-items: stretch; }
    .r29-barcode-row .input { flex: 1; min-width: 0; }
    .r29-barcode-row .btn { flex: none; white-space: nowrap; }
    .r29-scan { padding-left: 9px; padding-right: 9px; }
    .r29-scan .ic { width: 16px; height: 16px; }
    .r29-barcode-msg { display: block; margin-top: 4px; line-height: 1.4; }
    .r29-barcode-msg .link-btn { font-size: inherit; padding: 0; }
    .r29-ok { color: #067647; }
    .r29-warn { color: #B54708; }
    .r29-bad { color: #B42318; }
    .r29-eta { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
    .r29-eta .input[name="etaAmount"] { width: 80px; flex: none; }
    .r29-eta select { width: 120px; flex: none; }
    .r29-eta .small { flex: 1 1 170px; min-width: 0; line-height: 1.35; }
    .p-card-eta.r29-eta-long { color: #B54708; }
    .r29-details { display: block; margin: 2px 0 14px; border: 1px solid var(--line); border-radius: 12px; }
    .r29-details > summary { list-style: none; cursor: pointer; display: grid; gap: 2px; padding: 10px 12px; }
    .r29-details > summary::-webkit-details-marker { display: none; }
    .r29-details > summary:hover .r29-details-title { color: var(--primary); }
    .r29-details-title { display: flex; align-items: center; gap: 4px; font-weight: 700; font-size: 14px; }
    .r29-details-title .ic { width: 16px; height: 16px; transition: transform .15s; }
    .r29-details[open] .r29-details-title .ic { transform: rotate(90deg); }
    .r29-details-body { padding: 0 12px 4px; border-top: 1px solid var(--line); }
    .r29-details-sub { margin: 12px 0 6px; font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #6B7785; }
    .filter-pill.r29-off { opacity: .45; cursor: not-allowed; }
    .r29-eta-note { margin: 0 0 10px; }
    .r29-approval-note { margin-bottom: 12px; }
    .r29-req-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
    .r29-req { display: flex; gap: 14px; align-items: center; padding: 12px 14px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; }
    .r29-req-main { flex: 1; min-width: 0; display: grid; gap: 3px; }
    .r29-req-actions { display: flex; gap: 8px; align-items: center; justify-content: flex-end; flex-wrap: wrap; max-width: 46%; text-align: right; }
    .r29-done-title { font-weight: 700; margin: 4px 0 8px; }
    .r29-done-list { background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    .r29-done { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.4fr) auto; gap: 12px; align-items: center; padding: 9px 14px; border-top: 1px solid var(--line); }
    .r29-done:first-child { border-top: 0; }
    .r29-wait { margin-left: 4px; }
    @media (max-width: 760px) {
      .r29-req { flex-direction: column; align-items: stretch; }
      .r29-req-actions { max-width: none; justify-content: flex-start; text-align: left; }
      .r29-done { grid-template-columns: 1fr; gap: 2px; }
    }
  `;
  document.head.appendChild(style);
})();

WHATS_NEW.unshift({ area: "Round 29 — the Shop filters as an Amazon-style list; & the issue-list fixes: codes, barcode look-up, delivery time in days, stock approval and audit, tax on/off (2026-11-14; backend not built yet)", items: [
  ["SKU can be left empty", "Catalogue ▸ Add product: SKU is optional. Left empty, the next code is made from the shop's prefix and a running number — SKU-00001, SKU-00002 … (Business Settings ▸ Stock Rules ▸ Codes); a code someone typed by hand is skipped. Editing a product still needs its SKU (imports match on it). In a product import, a row with no SKU is a new product with the next code — export first to update products."],
  ["Supplier code can be left empty", "Masters ▸ Suppliers ▸ Add supplier: the same, with its own prefix (SUP-00001 …). In a supplier import, a row with no code is a new supplier with the next code."],
  ["Codes in Business Settings", "Stock Rules ▸ Codes: the SKU prefix and the supplier code prefix (1–10 letters, digits, - or _), with the next code shown under each. The number keeps counting when a prefix changes."],
  ["Barcode: Scan and Look up", "The product form's Barcode has a camera button (the app scans with the camera; a USB scanner already types into the box) and Look up. Enter in the box looks up too, so a scanner's Enter never saves the form. Your own products first: a barcode you already sell says \"Already in your catalogue\" with Open it. Otherwise Open Food Facts (a free, volunteer-built database of packaged products) fills the empty name, brand and pack size — only the barcode is sent; check them before saving. A box that already has something is left as typed: the message shows what was found and \"Use these\" replaces them. A brand you don't have yet is named, not added. Nothing found: nothing is filled. (The prototype knows a few demo barcodes, e.g. 8901262150118; the camera button picks one.)"],
  ["Add product: the everyday boxes first", "The product form had about 22 boxes in one narrow window. Now: Barcode first (scan, and it fills the rest), then picture, name, brand and category, pack size, MRP and selling price, the Selling switch and the SKU. Everything most products never need is in one \"More details\" section, closed: Stock and supplier (cost price, reorder level, supplier, delivery time), Invoice and substitute (HSN code, default substitute), On the shop (description, Buy 1 Get 1, tags). On Edit its line says what is filled (\"Filled: cost S$10.20, delivery 2 days, 1 tag\"). An error in a box inside opens it. Shorter hints (the picture's one line; the pack size's \"Saved as e.g.\" line gone — the range line under it says the same). Same boxes and rules — only the order and the folding changed."],
  ["Delivery time in minutes, hours or days", "The product form's ETA is a number with min / hours / days, up to 30 days (the API keeps minutes, up to 43,200). Customers see \"Delivery in 3 days\" on the product card and page when it is over a day."],
  ["A slow product makes the cart scheduled-only", "When the cart holds a product that takes more than a day, Express is greyed out with the reason and the delivery times start after that product's time: the first slot that starts once it is ready, and the days customers can book ahead count from there. The cart banner says \"Scheduled delivery only — from Mon 17 Nov\"; pickup says when it is ready. Demo: Basmati Rice 5kg takes 3 days."],
  ["Receipts and adjustments in the Audit log", "Setup ▸ Audit log ▸ What: Stock. Every stock receipt (unit cost, supplier, invoice no.) and every adjustment (stock take, damaged, expired, correction) is an entry: who, product and store, on hand before → after, reason and note. A stock import is one entry per store (how many products, the file). Stock history still lists every movement."],
  ["Stock adjustment approval (off to start)", "Business Settings ▸ Stock Rules: \"Adjustments need a second person's approval\". On: Stock ▸ Adjust says \"Send for approval\" and the change waits; the product shows \"Adjustment waiting\". Stock ▸ Approvals (with a count; the store list shows \"N waiting approval\") lists what waits. The store's manager or the Super Admin approves, or rejects with a reason — never the person who entered it, who may cancel it instead. One waiting adjustment per product and store. Receiving and transfers don't wait."],
  ["What approving does", "The change is worked out when it is entered (counted 40 with 45 on hand = −5); approving applies that difference, so sales in between are kept. The no-negative-stock rule is checked again on approval. Stock history shows who entered it and who approved it. If nobody else could approve (no manager for that store and no other Super Admin), the change is refused with the reason."],
  ["A stock import waits too", "While approval is on, Stock ▸ Import sends each store's part of the file for approval (the button says \"Send 12 rows for approval\"); that store's manager or the Super Admin approves or rejects the part whole, never the uploader."],
  ["Tax on / off", "Business Settings ▸ Tax: \"Charge tax on sales\". Off: the tax name, rate and type are hidden; nothing is added at checkout; the cart, the order and the invoice show no tax line, and the invoice is titled \"Invoice\". The GST on delivery charges switches do nothing while it is off (their card says so). The customer API gets tax.enabled."],
  ["Deals: empty tags greyed out", "The sidebar's Deals list counts each tag for the category or search on screen (every other filter applied), like Brands and Discount; a tag with nothing there is greyed out, so it never opens an empty page. The backend adds tag counts to GET /customer/products/filters."],
  ["No categories in the sidebar", "The category bar above the page already lists them, so the sidebar starts with the filters."],
  ["One white panel, plain headings", "The filters sit on one white panel (it was a box per filter), with plain bold headings: Deals, Brands, Price, Discount, Availability."],
  ["Deals", "All products, On offer and the shop's own quick filters as radio buttons — one at a time, as before."],
  ["Brands", "The first five, then \"See more\"; a ticked brand always shows. The counts beside each brand are not shown (they still decide which brands are greyed)."],
  ["Price", "The chosen range in large type above the slider, the Min / Max boxes with a Go button, and \"‹ Any price\" to undo."],
  ["Discount", "A radio list: 10% and above, 20%, 30%, 40%, 50% and above, with \"‹ Any discount\". A step with no products is greyed out. The server counts 10 / 20 / 30 % today; 40 % and 50 % need a small backend change (the app draws whatever steps the server sends)."],
  ["Availability", "\"Include out of stock\": ticked shows everything; unticked is In stock only (the same available=true filter)."],
  ["Results bar", "Above the products: \"1–7 of 7 results for Snacks\" with Sort by. The row of removable chips is gone — the sidebar shows what is picked."],
  ["Phones and tablets", "The Filter button and its bottom sheet stay, with the same list inside."],
] });
