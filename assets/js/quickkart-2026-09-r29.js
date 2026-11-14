/* Round 29 (2026-11-14): the Shop sidebar as an Amazon-style list.
   The team asked for Amazon / Flipkart-style filters in the sidebar, without the Categories list (the category bar
   above the page already shows them). Chosen from mockups: Amazon's plain list, on one white panel.
   - No Categories in the sidebar.
   - One white panel (it was a box per filter), plain bold headings (they were small grey capitals).
   - Deals: All products / On offer / the shop's own quick filters, one at a time (radio buttons).
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
    const quick = find("Quick filters");
    if (quick) {
      const tags = [...quick.querySelectorAll("[data-tag]")].map((b) => [b.dataset.tag, b.textContent.trim()]);
      quick.innerHTML = `<div class="sidebar-title">Deals</div>${[["", "All products"], ...tags]
        .map(([tag, label]) => optHTML("r29-tag", `data-tag="${esc(tag)}"`, esc(label), (UI.tagFilter || "") === tag, false)).join("")}`;
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

WHATS_NEW.unshift({ area: "Round 29 — the Shop filters as an Amazon-style list (2026-11-14)", items: [
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
