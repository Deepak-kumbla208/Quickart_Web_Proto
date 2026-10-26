/* ====================================================================
   Round 21 (2026-10-26) — the home page builder.

   Backend: decision D126, design quickkart-api-service docs/18-design-home-page-builder.md, phase P24.
   NOT built in the backend yet — this round shows the target screens first (P24-0 → round 21 → P24-1 …).

   Admin:  Home Screen ▸ Add section asks for a LAYOUT first (gallery with sketches), every layout can be added more
           than once (Combos once), products come from a SOURCE, banners and tiles OPEN what the admin chooses, sections
           and slides have Starts on / Last day, one status chip per row. Masters ▸ Tags (the shop's own tags), a logo
           on each brand, Marketing ▸ Promotions folded into the banner carousel.
   Customer: every section drawn in the admin's order, neutral wording, a link of "nothing" has no button, Buy again,
           product grid, category grid, shop by brand; a list opened from the home page is titled by what was tapped.
   ==================================================================== */
(function round21HomeBuilder() {
  /* ---------------- 0. Rules and small helpers ---------------- */
  const R21 = { sections: 25, cards: 200, slides: 20, tiles: 20, highlights: 8, picks: 20, rowMax: 20, gridMin: 4, gridMax: 12, shopGrid: 24, tags: 50 };
  const BLANK_PREVIEW = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E";
  const SHOP_TZ = "Asia/Singapore";
  const TZ_LABEL = "Singapore time";
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;
  const todayShop = () => new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const fmtDay = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
  const inWindow = (x, today) => (!x.startsOn || x.startsOn <= today) && (!x.lastDay || x.lastDay >= today);
  const isCustomer = () => !!State.session && !["admin", "delivery"].includes(State.session.role);
  const field = (label, control, hint) => `<label class="field"><span class="field-label">${label}</span>${control}${hint ? `<span class="qk-muted small r21-hint">${hint}</span>` : ""}</label>`;
  const note = (html, tone) => `<div class="r21-note ${tone ? `r21-note-${tone}` : ""}">${html}</div>`;
  const options = (list, current) => list.map(([v, l]) => `<option value="${esc(String(v))}" ${String(current) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("");
  const dialog = (title, body, wide) => `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static ${wide ? "dialog-promo r21-dialog-wide" : ""}" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>${esc(title)}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      ${body}
    </div>
  </div>`;
  if (!Icon.tag) Icon.tag = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>';

  /* ---------------- 1. The layouts ---------------- */
  // The API keeps its type names (D126 b); the admin sees layout names.
  const LAYOUTS = [
    { key: "carousel", type: "hero", group: "Banners", name: "Banner carousel", line: "Pictures that slide one after another — sales, news, free delivery", sketch: "carousel" },
    { key: "single", type: "secondaryBanner", group: "Banners", name: "Single banner", line: "One wide picture with words and an optional button", sketch: "single" },
    { key: "tiles", type: "offerTiles", group: "Banners", name: "Banner tiles", line: "A row of picture cards — each can open a category, a list or a product", sketch: "tiles" },
    { key: "row", type: "rail", group: "Products", name: "Product row", line: "Products customers scroll sideways, with See all", sketch: "row" },
    { key: "grid", type: "productGrid", group: "Products", name: "Product grid", line: "Products in two columns (more on a computer)", sketch: "grid" },
    { key: "bannerProducts", type: "promo", group: "Products", name: "Banner + products", line: "A banner with its products under it or beside it", sketch: "bannerProducts" },
    { key: "combos", type: "deals", group: "Products", name: "Combos", line: "Your bundle deals — one Combos section per page", sketch: "combos" },
    { key: "categories", type: "categoryGrid", group: "Shop by", name: "Category grid", line: "Your categories as pictures — tap one to open it", sketch: "categories" },
    { key: "brands", type: "brandGrid", group: "Shop by", name: "Shop by brand", line: "Brand logos — tap one to see that brand's products", sketch: "brands" },
    { key: "buyAgain", type: "buyAgain", group: "For each shopper", name: "Buy again", line: "What this customer orders most — signed-in customers only", sketch: "row" },
    { key: "recent", type: "recentlyViewed", group: "For each shopper", name: "Recently viewed", line: "Products this customer looked at lately", sketch: "row" },
    { key: "highlights", type: "trustStrip", group: "Info", name: "Highlights strip", line: "Icon strip — e.g. Free delivery, Secure payment", sketch: "highlights" },
  ];
  const TYPE_NAME = {
    hero: "Banner carousel", secondaryBanner: "Single banner", verticalTiles: "Banner tiles · tall", offerTiles: "Banner tiles · square",
    rail: "Product row", productGrid: "Product grid", promo: "Banner + products · picture above", freshSpotlight: "Banner + products · picture beside",
    deals: "Combos", categoryGrid: "Category grid", brandGrid: "Shop by brand", buyAgain: "Buy again", recentlyViewed: "Recently viewed", trustStrip: "Highlights strip",
  };
  const DEFAULT_TITLE = { hero: "Top banner", secondaryBanner: "Banner", verticalTiles: "Picture tiles", offerTiles: "Picture tiles", rail: "", productGrid: "", promo: "", freshSpotlight: "", deals: "Deals & Combos", categoryGrid: "Shop by category", brandGrid: "Shop by brand", buyAgain: "Buy again", recentlyViewed: "Recently viewed", trustStrip: "Highlights" };
  const layoutOfType = (type) => ({ verticalTiles: "tiles", offerTiles: "tiles", freshSpotlight: "bannerProducts" }[type]) || (LAYOUTS.find((l) => l.type === type) || {}).key;
  const PRODUCT_TYPES = ["rail", "productGrid", "promo", "freshSpotlight"];
  const TILE_TYPES = ["hero", "verticalTiles", "offerTiles", "trustStrip"];
  const ADMIN_ONLY_NAME = ["hero", "secondaryBanner", "verticalTiles", "offerTiles", "trustStrip", "deals"];
  const PICTURE_TYPES = ["secondaryBanner", "promo", "freshSpotlight"];
  const defaultLimit = (type) => ({ rail: 10, productGrid: 8, promo: 10, freshSpotlight: 6 }[type] || 10);
  const limitRange = (type) => (type === "productGrid" ? [R21.gridMin, R21.gridMax] : [1, R21.rowMax]);

  // Labels the earlier rounds read (tile editor title, audit labels).
  Object.entries(TYPE_NAME).forEach(([type, label]) => { HOME_SECTION_TYPE_META[type] = { ...(HOME_SECTION_TYPE_META[type] || {}), label: label.split(" · ")[0], builtin: false }; });
  window.homeSectionLabel = (s) => (s && s.title) || TYPE_NAME[s.type] || s.type;

  /* ---------------- 2. Sources, links, sales ---------------- */
  const SOURCE_KINDS = [
    ["hand", "Products I pick"],
    ["category", "A category"],
    ["brand", "A brand"],
    ["tag", "A tag"],
    ["top", "Top selling (automatic, last 30 days)"],
    ["onOffer", "On offer (automatic: price below MRP)"],
  ];
  const SORTS = [["top", "Top selling first"], ["discount", "Biggest discount first"], ["priceAsc", "Price: low to high"], ["priceDesc", "Price: high to low"], ["name", "Name A–Z"]];
  const LINK_KINDS = [
    ["none", "Nothing — no button"],
    ["category", "A category"],
    ["product", "One product"],
    ["brand", "A brand's products"],
    ["tag", "Products with a tag"],
    ["search", "Search results for…"],
    ["top", "Top selling products"],
    ["onOffer", "Everything on offer"],
  ];
  const NEEDS_REF = ["category", "brand", "tag", "product"];
  const NEEDS_SORT = ["category", "brand", "tag"];
  // Sales the dashboard way: cancelled and returned orders do not count (D126 c).
  const NOT_SALES = ["cancelled", "returned"];
  function unitsSold(days, keep) {
    const since = Date.now() - days * 86400000;
    const units = new Map();
    State.orders.forEach((o) => {
      if (o.createdAt < since || NOT_SALES.includes(o.status) || (keep && !keep(o))) return;
      o.items.forEach((it) => { if (!it.unavailable) units.set(it.id, (units.get(it.id) || 0) + (it.qty || 1)); });
    });
    return units;
  }
  const saving = (i) => (i.mrp > 0 && i.mrp > i.price ? (i.mrp - i.price) / i.mrp : 0);
  function sortList(list, sort, sold) {
    const byName = (a, b) => a.name.localeCompare(b.name);
    const cmp = {
      top: (a, b) => (sold.get(b.id) || 0) - (sold.get(a.id) || 0) || byName(a, b),
      discount: (a, b) => saving(b) - saving(a) || byName(a, b),
      priceAsc: (a, b) => a.price - b.price || byName(a, b),
      priceDesc: (a, b) => b.price - a.price || byName(a, b),
    }[sort] || byName;
    return list.slice().sort(cmp);
  }
  const liveCatalog = () => State.items.map(withBranchStock).filter((i) => i.stock);
  const brandById = (id) => State.brands.find((b) => b.id === Number(id));
  // Every product a source holds right now, before "how many".
  function sourceAll(src, itemIds) {
    const kind = (src && src.kind) || "hand";
    const sold = unitsSold(30);
    const cat = liveCatalog();
    if (kind === "hand") return (itemIds || []).map((id) => findItem(Number(id))).filter(Boolean).map(withBranchStock).filter((i) => i.stock);
    if (kind === "category") { const c = findCategory(Number(src.ref)); return c ? sortList(cat.filter((i) => i.cat === c.name), src.sort, sold) : []; }
    if (kind === "brand") { const b = brandById(src.ref); return b ? sortList(cat.filter((i) => i.brand === b.name), src.sort, sold) : []; }
    if (kind === "tag") return sortList(cat.filter((i) => (i.tags || []).includes(src.ref)), src.sort, sold);
    if (kind === "top") return sortList(cat.filter((i) => (sold.get(i.id) || 0) > 0), "top", sold);
    if (kind === "onOffer") return sortList(cat.filter((i) => i.mrp > i.price), "discount", sold);
    return [];
  }
  const sectionItems = (s) => sourceAll(s.source, s.itemIds).slice(0, s.limit || defaultLimit(s.type));
  function linkItems(link) {
    if (!link || link.kind === "none") return [];
    if (link.kind === "product") { const i = findItem(Number(link.ref)); return i && withBranchStock(i).stock ? [i] : []; }
    if (link.kind === "search") { const tokens = searchTokens(link.text); return tokens.length ? liveCatalog().filter((i) => itemMatchesQuery(i, tokens)) : []; }
    return sourceAll({ kind: link.kind, ref: link.ref, sort: link.sort || "top" });
  }
  const seeAllOf = (s) => (!s.source || s.source.kind === "hand" ? null : { kind: s.source.kind, ref: s.source.ref, sort: s.source.sort });
  function linkAttrs(link, title) {
    if (!link || !link.kind || link.kind === "none") return "";
    return `data-action="r21-open-link" data-kind="${esc(link.kind)}" data-ref="${esc(link.ref == null ? "" : String(link.ref))}" data-text="${esc(link.text || "")}" data-sort="${esc(link.sort || "")}" data-title="${esc(title || "")}"`;
  }
  function describeRef(kind, ref, text) {
    if (kind === "category") return (findCategory(Number(ref)) || {}).name || "a deleted category";
    if (kind === "brand") return (brandById(ref) || {}).name || "a deleted brand";
    if (kind === "tag") return tagName(ref);
    if (kind === "product") return (findItem(Number(ref)) || {}).name || "a deleted product";
    if (kind === "search") return `search "${text || ""}"`;
    if (kind === "top") return "top selling";
    if (kind === "onOffer") return "on offer";
    return "";
  }
  const describeLink = (link) => (!link || link.kind === "none" ? "Opens nothing" : `Opens: ${describeRef(link.kind, link.ref, link.text)}`);
  function describeSource(s) {
    const src = s.source || { kind: "hand" };
    const n = s.limit || defaultLimit(s.type);
    if (src.kind === "hand") return `${plural((s.itemIds || []).length, "product")} picked`;
    const sort = NEEDS_SORT.includes(src.kind) ? ` · ${(SORTS.find(([k]) => k === src.sort) || SORTS[4])[1].toLowerCase()}` : "";
    const what = { category: "Category", brand: "Brand", tag: "Tag" }[src.kind];
    return `${what ? `${what}: ${describeRef(src.kind, src.ref)}` : describeRef(src.kind)}${sort} · up to ${n}`;
  }

  /* ---------------- 3. Shop tags (Masters ▸ Tags) ---------------- */
  const TAG_NAMES = { bestseller: "Best Sellers", fresh: "Fresh Picks", indian: "Indian Essentials", sg: "Singapore Favourites" };
  const slugify = (name) => String(name || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const sortedTags = () => (State.tags || []).slice().sort((a, b) => a.order - b.order);
  const tagBySlug = (slug) => (State.tags || []).find((t) => t.slug === slug);
  const tagName = (slug) => (tagBySlug(slug) || {}).name || slug;
  function syncTagOptions() {
    TILE_TAG_OPTIONS.splice(0, TILE_TAG_OPTIONS.length, ...sortedTags().map((t) => ({ key: t.slug, label: t.name })));
  }

  /* ---------------- 4. One-time conversion (as the P24 migrations do) ---------------- */
  if (!PERSIST_KEYS.includes("tags")) PERSIST_KEYS.push("tags");
  State.tags = loadLS("tags", null);
  function convertTile(type, t) {
    const out = { ...t, enabled: t.enabled !== false };
    if (!out.link) {
      if (type === "verticalTiles" && t.catId != null) out.link = { kind: "category", ref: t.catId };
      else if (type === "offerTiles" && t.tag) out.link = t.tag === "offer" ? { kind: "onOffer" } : { kind: "tag", ref: t.tag, sort: "name" };
      else out.link = { kind: "none" };
    }
    delete out.catId; delete out.tag;
    return out;
  }
  function convertSection(s) {
    const out = { ...s, v21: true };
    const pool = { trending: { kind: "tag", ref: "bestseller", sort: "top" }, bestSellers: { kind: "tag", ref: "bestseller", sort: "name" }, fresh: { kind: "tag", ref: "fresh", sort: "name" }, indian: { kind: "tag", ref: "indian", sort: "name" }, sg: { kind: "tag", ref: "sg", sort: "name" }, offers: { kind: "onOffer" } };
    if (s.type === "rail") { out.source = pool[s.poolKey] || { kind: "top" }; out.limit = 10; delete out.poolKey; delete out.seeAllTag; }
    if (s.type === "freshSpotlight") {
      Object.assign(out, { title: s.title || FRESH_SPOTLIGHT_DEFAULTS.title, subtitle: s.subtitle || FRESH_SPOTLIGHT_DEFAULTS.subtitle, image: s.image || FRESH_SPOTLIGHT_DEFAULTS.image });
      out.source = { kind: "tag", ref: "fresh", sort: "name" }; out.limit = 6; out.link = { kind: "tag", ref: "fresh", sort: "name" };
    }
    if (s.type === "secondaryBanner") {
      Object.assign(out, { title: s.title || SECONDARY_BANNER_DEFAULTS.title, subtitle: s.subtitle || SECONDARY_BANNER_DEFAULTS.subtitle, image: s.image || SECONDARY_BANNER_DEFAULTS.image });
      out.link = { kind: "onOffer" };
    }
    if (s.type === "promo") { out.source = { kind: "hand" }; out.limit = Math.min(Math.max((s.itemIds || []).length, 1), R21.rowMax); out.link = out.link || { kind: "none" }; }
    if (TILE_TYPES.includes(s.type)) out.tiles = (s.tiles || []).map((t) => convertTile(s.type, t));
    if (!out.title && DEFAULT_TITLE[s.type]) out.title = DEFAULT_TITLE[s.type];
    return out;
  }
  function renumber(list) { return list.map((s, i) => ({ ...s, order: i + 1 })); }
  (function migrate21() {
    if (!Array.isArray(State.tags)) {
      const order = ["bestseller", "fresh", "indian", "sg"];
      const used = [];
      State.items.forEach((i) => (i.tags || []).forEach((t) => { if (t !== "offer" && !used.includes(t)) used.push(t); }));
      used.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
      State.tags = used.map((slug, idx) => ({ id: idx + 1, slug, name: TAG_NAMES[slug] || slug, order: idx + 1 }));
      persist("tags");
    }
    if (State.items.some((i) => (i.tags || []).includes("offer"))) {
      State.items = State.items.map((i) => ({ ...i, tags: (i.tags || []).filter((t) => t !== "offer") }));
      persist("items");
    }
    if (State.homeSections.some((s) => !s.v21)) State.homeSections = State.homeSections.map((s) => (s.v21 ? s : convertSection(s)));
    // Promotions become slides at the end of the first banner carousel (D126 f); past 20 a new carousel right under it.
    if (!loadLS("homeV21Promos", () => false)) {
      const promos = (State.promotions || []).filter((p) => !p.deleted);
      if (promos.length) {
        let list = sortedHomeSections();
        let heroIdx = list.findIndex((s) => s.type === "hero");
        let nextId = Math.max(0, ...State.homeSections.map((s) => s.id)) + 1;
        if (heroIdx < 0) { list = [{ id: nextId++, type: "hero", enabled: true, order: 0, title: "Top banner", tiles: [], v21: true }, ...list]; heroIdx = 0; }
        promos.forEach((p) => {
          let target = list[heroIdx];
          if ((target.tiles || []).length >= R21.slides) {
            const extra = { id: nextId++, type: "hero", enabled: true, order: 0, title: "Promotions (continued)", tiles: [], v21: true };
            list.splice(heroIdx + 1, 0, extra); heroIdx += 1; target = extra;
          }
          const tiles = target.tiles || [];
          const order = tiles.length ? Math.max(...tiles.map((t) => t.order || 0)) + 1 : 1;
          target.tiles = [...tiles, { id: `promo-${p.id}`, title: p.title, subtitle: p.subtitle || "", image: p.image || "", order, enabled: p.enabled !== false, link: { kind: "none" }, fromPromotion: true }];
        });
        State.homeSections = renumber(list);
      }
      saveLS("homeV21Promos", true);
      saveLS("homeV21Notice", promos.length > 0);
    }
    persist("homeSections");
    syncTagOptions();
  })();
  // Tiles keep their own link now; the old category / tag fields are retired.
  Object.keys(TILE_TYPE_CONFIG).forEach((k) => { TILE_TYPE_CONFIG[k].link = null; });

  /* ---------------- 5. Customer home ---------------- */
  const liveTiles = (s, today) => sortedTiles(s).filter((t) => t.enabled !== false && inWindow(t, today));
  const firstLiveHero = (today) => sortedHomeSections().find((s) => s.type === "hero" && s.enabled && inWindow(s, today) && liveTiles(s, today).length);
  // The autoplaying carousel is the first live one (the earlier rounds' timer and dots drive it).
  window.activeBanners = () => {
    const today = todayShop();
    const hero = firstLiveHero(today);
    return hero ? liveTiles(hero, today).map((t) => ({ title: t.title, subtitle: t.subtitle, image: t.image, link: t.link })) : [];
  };
  function carouselHTML(s, today, primary) {
    const slides = liveTiles(s, today);
    if (!slides.length) return "";
    const idx = primary ? (UI.bannerIdx >= slides.length ? (UI.bannerIdx = 0) : UI.bannerIdx) : (((UI.r21Carousel || {})[s.id] || 0) % slides.length);
    const dot = primary ? "hero-dot" : "hero-dot r21-dot";
    const act = primary ? { prev: 'data-action="hero-prev"', next: 'data-action="hero-next"', go: (i) => `data-action="hero-goto" data-idx="${i}"` }
      : { prev: `data-action="r21-car" data-section="${s.id}" data-step="-1"`, next: `data-action="r21-car" data-section="${s.id}" data-step="1"`, go: (i) => `data-action="r21-car" data-section="${s.id}" data-goto="${i}"` };
    return `
  <section class="hero ${primary ? "" : "r21-hero-extra container"}">
    <div class="hero-viewport">
      <div class="hero-track" ${primary ? 'id="heroBanner"' : ""} style="transform:translateX(-${idx * 100}%)">
        ${slides.map((t) => `
          <div class="hero-slide" style="background-image:linear-gradient(90deg, rgba(0,30,55,.72), rgba(0,30,55,.12) 65%), url('${t.image || ""}')">
            <div class="hero-slide-copy">
              <h1>${esc(t.title)}</h1>
              ${t.subtitle ? `<p>${esc(t.subtitle)}</p>` : ""}
              ${t.link && t.link.kind !== "none" ? `<button class="btn btn-accent" ${linkAttrs(t.link, t.title)}>Shop now</button>` : ""}
            </div>
          </div>`).join("")}
      </div>
      ${slides.length > 1 ? `
        <button class="hero-arrow hero-arrow-l" ${act.prev} aria-label="Previous banner">${ic("chevronLeft")}</button>
        <button class="hero-arrow hero-arrow-r" ${act.next} aria-label="Next banner">${ic("chevronRight")}</button>
        <div class="hero-dots">${slides.map((_, i) => `<button class="${dot} ${i === idx ? "active" : ""}" ${act.go(i)} aria-label="Go to slide ${i + 1}"></button>`).join("")}</div>` : ""}
    </div>
  </section>`;
  }
  function rowHTML(title, items, seeAll) {
    if (!items.length) return "";
    return `
  <section class="container section">
    <div class="section-head"><h2>${esc(title)}</h2>${seeAll ? `<button class="link-btn" ${linkAttrs(seeAll, title)}>See all →</button>` : ""}</div>
    <div class="rail">${items.map((item) => productCardHTML(item)).join("")}</div>
  </section>`;
  }
  function gridHTML(s, items) {
    if (!items.length) return "";
    const see = seeAllOf(s);
    return `
  <section class="container section">
    <div class="section-head"><h2>${esc(s.title)}</h2>${see ? `<button class="link-btn" ${linkAttrs(see, s.title)}>See all →</button>` : ""}</div>
    <div class="product-grid r21-home-grid">${items.map((item) => productCardHTML(item)).join("")}</div>
  </section>`;
  }
  const bannerButton = (s) => {
    const link = s.link && s.link.kind !== "none" ? s.link : null;
    return link ? `<button class="btn btn-accent" ${linkAttrs(link, s.title)}>Shop now →</button>` : "";
  };
  function singleBannerHTML(s) {
    if (!s.image && !s.title) return "";
    return `
  <section class="container section">
    <div class="promo-banner" style="background-image:linear-gradient(100deg, rgba(0,61,114,.9), rgba(0,61,114,.35) 68%), url('${s.image || ""}')">
      <div class="promo-banner-copy"><h2>${esc(s.title || "")}</h2>${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ""}${bannerButton(s)}</div>
    </div>
  </section>`;
  }
  function bannerAboveHTML(s, items) {
    if (!items.length) return "";
    return `
  <section class="container section">
    <div class="promo-banner" style="background-image:linear-gradient(100deg, rgba(0,61,114,.9), rgba(0,61,114,.35) 68%), url('${s.image || img("photo-1604118464816-5e2bd7b863c2", 1400)}')">
      <div class="promo-banner-copy"><h2>${esc(s.title)}</h2>${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ""}${bannerButton(s)}</div>
    </div>
    <div class="rail" style="margin-top:16px">${items.map((item) => productCardHTML(item)).join("")}</div>
  </section>`;
  }
  function bannerBesideHTML(s, items) {
    if (!items.length) return "";
    return `
  <section class="container section">
    <div class="spotlight">
      <div class="spotlight-banner" style="background-image:linear-gradient(165deg, rgba(0,131,81,.93), rgba(0,61,114,.75)), url('${s.image || ""}')">
        <div class="spotlight-banner-copy"><h2>${esc(s.title)}</h2>${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ""}${bannerButton(s)}</div>
      </div>
      <div class="spotlight-products">${items.map((item) => productCardHTML(item)).join("")}</div>
    </div>
  </section>`;
  }
  function tilesHTML(s, today) {
    const tiles = liveTiles(s, today);
    if (!tiles.length) return "";
    const tall = s.type === "verticalTiles";
    const html = tiles.map((t) => {
      const has = t.link && t.link.kind !== "none";
      const tag = has ? "button" : "div";
      return `<${tag} class="offer-tile ${has ? "" : "r21-tile-static"}" style="background-image:linear-gradient(0deg, rgba(0,30,55,.75), rgba(0,30,55,.1) 65%), url('${t.image || ""}')" ${has ? linkAttrs(t.link, t.title) : ""}>
        <span class="offer-tile-title">${esc(t.title)}</span>
        ${t.subtitle ? `<span class="offer-tile-sub">${esc(t.subtitle)}</span>` : ""}
        ${has ? `<span class="offer-tile-cta">Shop now${ic("chevronRight")}</span>` : ""}
      </${tag}>`;
    }).join("");
    return `<section class="container section"><div class="${tall ? "vertical-tiles" : "offer-tiles"}">${html}</div></section>`;
  }
  function categoryGridHTML(s) {
    const cats = (s.pick && !s.pick.all ? (s.pick.ids || []).map((id) => findCategory(Number(id))).filter(Boolean) : State.categories).slice(0, R21.shopGrid);
    if (!cats.length) return "";
    return `
  <section class="container section">
    ${s.title ? `<div class="section-head"><h2>${esc(s.title)}</h2></div>` : ""}
    <div class="r21-cat-grid">${cats.map((c) => `
      <button class="r21-cat-card" data-action="r21-open-link" data-kind="category" data-ref="${c.id}" data-title="${esc(c.name)}">
        <span class="r21-cat-img" style="background-image:url('${c.image || ""}')"></span><span class="r21-cat-name">${esc(c.name)}</span>
      </button>`).join("")}</div>
  </section>`;
  }
  const brandsWithLogo = () => State.brands.filter((b) => b.logo);
  function brandGridHTML(s) {
    const brands = (s.pick && !s.pick.all ? (s.pick.ids || []).map(brandById).filter((b) => b && b.logo) : brandsWithLogo()).slice(0, R21.shopGrid);
    if (!brands.length) return "";
    return `
  <section class="container section">
    ${s.title ? `<div class="section-head"><h2>${esc(s.title)}</h2></div>` : ""}
    <div class="r21-brand-grid">${brands.map((b) => `
      <button class="r21-brand-card" ${linkAttrs({ kind: "brand", ref: b.id, sort: "top" }, b.name)}><img src="${b.logo}" alt="" loading="lazy" /><span>${esc(b.name)}</span></button>`).join("")}</div>
  </section>`;
  }
  // Buy again: what this customer ordered most often in 90 days, ties by most recent (D126 j).
  function buyAgainItems() {
    if (!isCustomer()) return [];
    const since = Date.now() - 90 * 86400000;
    const times = new Map();
    const last = new Map();
    myOrders().forEach((o) => {
      if (o.createdAt < since || NOT_SALES.includes(o.status)) return;
      new Set(o.items.map((it) => it.id)).forEach((id) => { times.set(id, (times.get(id) || 0) + 1); last.set(id, Math.max(last.get(id) || 0, o.createdAt)); });
    });
    return [...times.keys()].map((id) => findItem(id)).filter(Boolean).map(withBranchStock).filter((i) => i.stock)
      .sort((a, b) => times.get(b.id) - times.get(a.id) || last.get(b.id) - last.get(a.id)).slice(0, 20);
  }
  function renderSectionR21(s, today) {
    switch (s.type) {
      case "secondaryBanner": return singleBannerHTML(s);
      case "verticalTiles": case "offerTiles": return tilesHTML(s, today);
      case "rail": return rowHTML(s.title, sectionItems(s), seeAllOf(s));
      case "productGrid": return gridHTML(s, sectionItems(s));
      case "promo": return bannerAboveHTML(s, sectionItems(s));
      case "freshSpotlight": return bannerBesideHTML(s, sectionItems(s));
      case "deals": return dealsSectionHTML(s).replace("<h2>Deals & Combos</h2>", `<h2>${esc(s.title || "Deals & Combos")}</h2>`);
      case "categoryGrid": return categoryGridHTML(s);
      case "brandGrid": return brandGridHTML(s);
      case "buyAgain": return rowHTML(s.title || "Buy again", buyAgainItems(), null);
      case "recentlyViewed": return rowHTML(s.title || "Recently viewed", State.recentlyViewed.map((id) => findItem(id)).filter(Boolean).slice(0, 8), null);
      case "trustStrip": return trustStripHTML({ ...s, tiles: liveTiles(s, today) });
      default: return "";
    }
  }
  // Every section in the admin's order — nothing is moved (no "hero first").
  window.viewHome = function viewHomeR21() {
    const today = todayShop();
    const primary = firstLiveHero(today);
    return sortedHomeSections()
      .filter((s) => s.enabled && inWindow(s, today))
      .map((s) => (s.type === "hero" ? carouselHTML(s, today, primary && primary.id === s.id) : renderSectionR21(s, today)))
      .join("");
  };
  Actions["r21-car"] = (el) => {
    const id = Number(el.dataset.section);
    const s = State.homeSections.find((x) => x.id === id);
    const n = s ? liveTiles(s, todayShop()).length : 1;
    const cur = (UI.r21Carousel || {})[id] || 0;
    const next = el.dataset.goto != null ? Number(el.dataset.goto) : (cur + Number(el.dataset.step) + n) % n;
    UI.r21Carousel = { ...(UI.r21Carousel || {}), [id]: next };
    render();
  };

  /* ---------------- 6. Opening a link: the shop list, titled by what was tapped ---------------- */
  const SHOP_SORT = { top: "r21-top", discount: "discount", priceAsc: "price-asc", priceDesc: "price-desc", name: "r21-name" };
  Actions["r21-open-link"] = (el) => {
    const { kind, ref, text, sort, title } = el.dataset;
    if (kind === "product") { UI.modal = { type: "product", id: Number(ref) }; render(); return; }
    resetAdvancedFilters();
    UI.query = ""; UI.tagFilter = null; UI.cat = ALL_CATEGORIES; UI.shopSort = "relevance";
    if (kind === "category") { const c = findCategory(Number(ref)); if (c) UI.cat = c.name; }
    if (kind === "brand") { const b = brandById(ref); if (b) UI.brandFilter = [b.name]; }
    if (kind === "tag") UI.tagFilter = ref;
    if (kind === "search") UI.query = text || "";
    if (kind === "top") { UI.tagFilter = "__top"; UI.shopSort = "r21-top"; }
    if (kind === "onOffer") UI.tagFilter = "offer";
    if (sort && SHOP_SORT[sort] && kind !== "top") UI.shopSort = SHOP_SORT[sort];
    UI.r21ListTitle = title || null;
    UI.route = "shop";
    window.scrollTo(0, 0);
    render();
  };
  // Any other way into the shop list drops the tapped title.
  ["browse-category", "see-all-tag", "filter-tag", "go", "quick-search", "clear-shop-filters", "submit-search-suggest"].forEach((name) => {
    const base = Actions[name];
    if (!base) return;
    Actions[name] = (el, ev) => { UI.r21ListTitle = null; return base(el, ev); };
  });
  const baseFilteredBase = filteredItemsBase;
  window.filteredItemsBase = () => {
    const keep = UI.tagFilter;
    if (keep !== "offer" && keep !== "__top") return baseFilteredBase();
    UI.tagFilter = null;
    let list;
    try { list = baseFilteredBase(); } finally { UI.tagFilter = keep; }
    if (keep === "offer") return list.filter((i) => i.mrp > i.price);
    const sold = unitsSold(30);
    return list.filter((i) => (sold.get(i.id) || 0) > 0);
  };
  const baseFiltered = filteredItems;
  window.filteredItems = () => {
    const list = baseFiltered();
    if (UI.shopSort === "r21-top") { const sold = unitsSold(30); return sortList(list, "top", sold); }
    if (UI.shopSort === "r21-name") return sortList(list, "name");
    return list;
  };
  const baseTagLabel = tagLabel;
  window.tagLabel = (tag) => (tag === "offer" ? "On offer" : tag === "__top" ? "Top selling" : tagBySlug(tag) ? tagName(tag) : baseTagLabel(tag));
  const baseViewShop = viewShop;
  window.viewShop = () => {
    let html = baseViewShop();
    // Quick filters: the shop's own tags, plus the automatic "On offer".
    const quick = `<div class="sidebar-title">Quick filters</div>
        <button class="sidebar-item ${UI.tagFilter === "offer" ? "active" : ""}" data-action="filter-tag" data-tag="offer">On offer</button>
        ${sortedTags().map((t) => `<button class="sidebar-item ${UI.tagFilter === t.slug ? "active" : ""}" data-action="filter-tag" data-tag="${esc(t.slug)}">${esc(t.name)}</button>`).join("")}
      </div>`;
    html = html.replace(/<div class="sidebar-title">Quick filters<\/div>[\s\S]*?<\/div>/, quick);
    if (UI.r21ListTitle) {
      const searchingAll = UI.cat === ALL_CATEGORIES;
      const heading = UI.query ? `Results for "${esc(UI.query)}"` : UI.tagFilter ? tagLabel(UI.tagFilter) : searchingAll ? "All products" : esc(UI.cat);
      html = html.replace(`<h1>${heading}</h1>`, () => `<h1>${esc(UI.r21ListTitle)}</h1>`);
    }
    return html;
  };

  /* ---------------- 7. Admin: the sections list ---------------- */
  const cardsUsed = (exceptId) => State.homeSections.reduce((sum, s) => {
    if (s.id === exceptId) return sum;
    if (PRODUCT_TYPES.includes(s.type)) return sum + (s.source && s.source.kind === "hand" ? (s.itemIds || []).length : s.limit || defaultLimit(s.type));
    if (s.type === "buyAgain") return sum + 20;
    return sum;
  }, 0);
  function emptyReason(s, today) {
    if (TILE_TYPES.includes(s.type)) {
      const total = sortedTiles(s).length;
      const word = s.type === "hero" ? "slide" : s.type === "trustStrip" ? "highlight" : "tile";
      if (!total) return `No ${word}s yet — add one`;
      return liveTiles(s, today).length ? null : `None of its ${plural(total, word)} is showing today (off or outside their dates)`;
    }
    if (PRODUCT_TYPES.includes(s.type)) {
      if (sourceAll(s.source, s.itemIds).length) return null;
      const src = s.source || { kind: "hand" };
      return {
        hand: (s.itemIds || []).length ? "None of the picked products is in stock" : "No products picked yet",
        category: "No product in this category is in stock",
        brand: "No product of this brand is in stock",
        tag: "No product with this tag is in stock",
        top: "No orders in the last 30 days yet",
        onOffer: "No product is priced below its MRP",
      }[src.kind];
    }
    if (s.type === "secondaryBanner") return s.image ? null : "Add a picture";
    if (s.type === "brandGrid") return brandsWithLogo().length ? null : "No brand has a logo yet — add one in Masters ▸ Brands";
    if (s.type === "categoryGrid") return State.categories.length ? null : "No categories yet";
    if (s.type === "deals") return (s.combos || []).length || State.items.some((i) => i.bogo) ? null : "No combos yet";
    return null;
  }
  function onDetail(s, today) {
    if (TILE_TYPES.includes(s.type)) {
      const word = s.type === "hero" ? "slide" : s.type === "trustStrip" ? "highlight" : "tile";
      return `${liveTiles(s, today).length} of ${plural(sortedTiles(s).length, word)} showing now`;
    }
    if (PRODUCT_TYPES.includes(s.type)) {
      const all = sourceAll(s.source, s.itemIds).length;
      const shown = Math.min(all, s.limit || defaultLimit(s.type));
      return all > shown ? `Shows ${shown} of ${all} products` : `Shows ${plural(shown, "product")}`;
    }
    if (s.type === "buyAgain") return "Only signed-in customers who ordered in the last 90 days see it — new customers won't";
    if (s.type === "recentlyViewed") return "Each customer sees what they looked at lately";
    if (s.type === "categoryGrid") return `Shows ${plural(s.pick && !s.pick.all ? (s.pick.ids || []).length : Math.min(State.categories.length, R21.shopGrid), "category", "categories")}`;
    if (s.type === "brandGrid") return `Shows ${plural(s.pick && !s.pick.all ? (s.pick.ids || []).length : brandsWithLogo().length, "brand")}`;
    if (s.type === "deals") return `${plural((s.combos || []).length, "combo")}`;
    return "Showing";
  }
  // One chip, in a fixed order: Off → Ended → Scheduled → Empty → On.
  function sectionStatus(s, today) {
    if (!s.enabled) return { chip: "Off", tone: "grey", why: "Switched off — customers don't see it" };
    if (s.lastDay && s.lastDay < today) return { chip: "Ended", tone: "grey", why: `Last day was ${fmtDay(s.lastDay)}` };
    if (s.startsOn && s.startsOn > today) return { chip: "Scheduled", tone: "blue", why: `Starts on ${fmtDay(s.startsOn)}` };
    const empty = emptyReason(s, today);
    if (empty) return { chip: "Empty", tone: "yellow", why: `Hidden from customers: ${empty}` };
    return { chip: "On", tone: "green", why: `On · ${onDetail(s, today)}` };
  }
  function tileStatus(t, today) {
    if (t.enabled === false) return { chip: "Off", tone: "grey" };
    if (t.lastDay && t.lastDay < today) return { chip: "Ended", tone: "grey" };
    if (t.startsOn && t.startsOn > today) return { chip: "Scheduled", tone: "blue" };
    return { chip: "On", tone: "green" };
  }
  const chip = (st) => `<span class="r21-chip r21-chip-${st.tone}">${esc(st.chip)}</span>`;
  const datesText = (x) => (x.startsOn || x.lastDay ? `${x.startsOn ? `from ${fmtDay(x.startsOn)}` : "from now"}${x.lastDay ? `, last day ${fmtDay(x.lastDay)}` : ""}` : "");
  function rowDetail(s) {
    const bits = [];
    if (PRODUCT_TYPES.includes(s.type)) bits.push(describeSource(s));
    if (PICTURE_TYPES.includes(s.type)) bits.push(describeLink(s.link));
    const d = datesText(s);
    if (d) bits.push(d);
    return bits.join(" · ");
  }
  function sectionRowR21(s, editable, today) {
    const st = sectionStatus(s, today);
    const detail = rowDetail(s);
    return `
    <div class="admin-row home-section-row" data-section-id="${s.id}">
      ${editable ? `<span class="drag-handle" draggable="true" aria-label="Drag to reorder">☰</span>` : ""}
      <span class="r21-row-icon">${sketch((LAYOUTS.find((l) => l.key === layoutOfType(s.type)) || {}).sketch, s.type)}</span>
      <div class="admin-row-info">
        <div class="admin-row-name">${esc(homeSectionLabel(s))} ${chip(st)}</div>
        <div class="qk-muted small">${esc(TYPE_NAME[s.type] || s.type)}${detail ? ` · ${esc(detail)}` : ""}</div>
        <div class="small r21-why r21-why-${st.tone}">${esc(st.why)}</div>
      </div>
      ${editable ? `
      <label class="stock-toggle"><input type="checkbox" ${s.enabled ? "checked" : ""} data-action="toggle-home-section" data-id="${s.id}" /><span>${s.enabled ? "On" : "Off"}</span></label>
      <button class="icon-btn" data-action="r21-edit-section" data-id="${s.id}" aria-label="Edit">${ic("edit")}</button>
      <button class="icon-btn icon-btn-danger" data-action="r21-delete-section" data-id="${s.id}" aria-label="Delete">${ic("trash")}</button>` : ""}
    </div>`;
  }
  window.adminHomeScreenSections = function adminHomeScreenSectionsR21(editable) {
    const list = sortedHomeSections();
    const today = todayShop();
    const hero = list.find((s) => s.type === "hero");
    const notice = loadLS("homeV21Notice", () => false) ? `
    <div class="r21-notice">${ic("sparkle")}<span><b>Your promotions are now slides</b> in “${esc(hero ? homeSectionLabel(hero) : "Banner carousel")}”. Marketing ▸ Promotions is gone — add, switch off or date a slide there.</span><button type="button" class="link-btn" data-action="r21-dismiss-notice">Got it</button></div>` : "";
    return `
  ${notice}
  <div class="r21-home-head">
    <div>
      <div class="qk-muted small">Customers see sections in this order${editable ? " — drag ☰ to move one" : ""}.</div>
      <div class="qk-muted small r21-count">${list.length} of ${R21.sections} sections · ${cardsUsed()} of ${R21.cards} product cards</div>
    </div>
    ${editable ? `<button class="btn btn-primary" data-action="r21-add-section">${ic("plus")} Add section</button>` : ""}
  </div>
  ${list.length ? `<div id="homeSectionList" class="admin-table" style="margin-top:12px">${list.map((s) => sectionRowR21(s, editable, today)).join("")}</div>` : `
  <div class="empty-state"><div class="empty-title">No sections yet</div><div class="empty-hint">Customers see only your category bar — add a section.</div></div>`}`;
  };
  Actions["r21-dismiss-notice"] = () => { saveLS("homeV21Notice", false); render(); };

  /* ---------------- 8. Admin: sketches and the layout gallery ---------------- */
  function sketch(kind, type) {
    const i = (cls) => `<i class="${cls}"></i>`;
    const cards = (n, cls) => Array.from({ length: n }, () => i(`sk-card ${cls || ""}`)).join("");
    const k = type === "verticalTiles" ? "tilesTall" : type === "freshSpotlight" ? "beside" : kind;
    const map = {
      carousel: `${i("sk-banner")}<span class="sk-dots">${i("")}${i("")}${i("")}</span>`,
      single: `${i("sk-banner sk-short")}${i("sk-btn")}`,
      tiles: `<span class="sk-row">${i("sk-tile")}${i("sk-tile")}${i("sk-tile")}</span>`,
      tilesTall: `<span class="sk-row">${i("sk-tile sk-tall")}${i("sk-tile sk-tall")}</span>`,
      row: `${i("sk-line")}<span class="sk-row">${cards(3)}${i("sk-card sk-cut")}</span>`,
      grid: `${i("sk-line")}<span class="sk-grid">${cards(4)}</span>`,
      bannerProducts: `${i("sk-banner sk-short")}<span class="sk-row">${cards(3)}${i("sk-card sk-cut")}</span>`,
      beside: `<span class="sk-beside">${i("sk-banner sk-side")}<span class="sk-grid">${cards(4)}</span></span>`,
      combos: `${i("sk-line")}<span class="sk-row">${cards(2, "sk-combo")}</span>`,
      categories: `<span class="sk-grid4">${Array.from({ length: 8 }, () => i("sk-dot")).join("")}</span>`,
      brands: `<span class="sk-grid4">${Array.from({ length: 4 }, () => i("sk-logo")).join("")}</span>`,
      highlights: `<span class="sk-row">${i("sk-icon")}${i("sk-icon")}${i("sk-icon")}${i("sk-icon")}</span>`,
    };
    return `<span class="r21-sketch">${map[k] || ""}</span>`;
  }
  function galleryModal() {
    const hasCombos = State.homeSections.some((s) => s.type === "deals");
    const groups = [...new Set(LAYOUTS.map((l) => l.group))];
    return dialog("Add section — choose a layout", `
      <div class="dialog-body">
        <div class="qk-muted small" style="margin-bottom:12px">Pick how the section looks. You choose what it shows next.</div>
        ${groups.map((g) => `
        <div class="r21-gal-group">
          <div class="r21-gal-title">${esc(g)}</div>
          <div class="r21-gal-grid">${LAYOUTS.filter((l) => l.group === g).map((l) => {
            const off = l.key === "combos" && hasCombos;
            return `<button type="button" class="r21-gal-card ${off ? "is-off" : ""}" ${off ? "disabled" : `data-action="r21-pick-layout" data-layout="${l.key}"`}>
              ${sketch(l.sketch)}<span class="r21-gal-name">${esc(l.name)}</span><span class="r21-gal-line">${esc(off ? "Already on your page — one Combos section per page" : l.line)}</span></button>`;
          }).join("")}</div>
        </div>`).join("")}
      </div>`, true);
  }

  /* ---------------- 9. Admin: the section form ---------------- */
  function pickerRows(list, selected, name) {
    return list.map(([id, label, search]) => `
      <label class="checklist-item" data-search="${esc((search || label).toLowerCase())}">
        <input type="checkbox" name="${name}" value="${id}" ${selected.map(String).includes(String(id)) ? "checked" : ""} /><span>${esc(label)}</span>
      </label>`).join("");
  }
  function countLine(all, limit, emptyWhy) {
    if (!all) return note(`${ic("alert")} Nothing to show right now — the section will be hidden${emptyWhy ? `: ${esc(emptyWhy)}` : ""}.`, "warn");
    const shown = Math.min(all, limit);
    return note(`${ic("check")} ${all > shown ? `Shows ${shown} of ${all} products right now` : `Shows ${plural(shown, "product")} right now`}${all ? ` — e.g. ${esc(sourceAllNames.join(", "))}` : ""}. Products can also appear in other rows.`, "ok");
  }
  let sourceAllNames = [];
  function sourceFields(f) {
    const src = f.source || { kind: "hand" };
    const kind = src.kind;
    const [lo, hi] = limitRange(f.type);
    const limit = f.limit || defaultLimit(f.type);
    const parts = [field("Products come from", `<select class="input" name="sourceKind" data-action="r21-form-change">${options(SOURCE_KINDS, kind)}</select>`)];
    if (kind === "hand") {
      parts.push(`<div class="field"><span class="field-label">Products I pick <span class="qk-muted small" style="font-weight:400">(up to ${R21.picks}, shown in the order you tick them)</span></span>
        <input class="input" oninput="onPromoProductSearch(this.value)" placeholder="Search products..." style="margin-bottom:8px" />
        <div id="promoProductPicker" class="sidebar-checklist r21-picker">${pickerRows(State.items.map((i) => [i.id, `${i.name} · ${i.unit}`, `${i.name} ${i.brand || ""}`]), f.itemIds || [], "itemIds")}</div></div>`);
    }
    if (kind === "category") parts.push(field("Category", `<select class="input" name="sourceRef" data-action="r21-form-change">${options([["", "Choose…"], ...State.categories.map((c) => [c.id, c.name])], src.ref)}</select>`));
    if (kind === "brand") parts.push(field("Brand", `<select class="input" name="sourceRef" data-action="r21-form-change">${options([["", "Choose…"], ...State.brands.slice().sort((a, b) => a.name.localeCompare(b.name)).map((b) => [b.id, b.name])], src.ref)}</select>`));
    if (kind === "tag") parts.push(sortedTags().length ? field("Tag", `<select class="input" name="sourceRef" data-action="r21-form-change">${options([["", "Choose…"], ...sortedTags().map((t) => [t.slug, t.name])], src.ref)}</select>`) : note("No tags yet — create one in Masters ▸ Tags.", "warn"));
    if (NEEDS_SORT.includes(kind)) parts.push(field("Order", `<select class="input" name="sourceSort" data-action="r21-form-change">${options(SORTS, src.sort || "top")}</select>`));
    if (kind !== "hand") parts.push(field(`How many (${lo}–${hi})`, `<input class="input" type="number" name="limit" min="${lo}" max="${hi}" value="${limit}" data-action="r21-form-change" />`));
    const all = sourceAll(src, f.itemIds);
    sourceAllNames = all.slice(0, 3).map((i) => i.name);
    const pseudo = { ...f, source: src };
    parts.push(countLine(all.length, kind === "hand" ? R21.picks : limit, emptyReason(pseudo, todayShop())));
    return `<div class="r21-block"><div class="r21-block-title">Products</div>${parts.join("")}</div>`;
  }
  function linkFields(link, label) {
    link = link || { kind: "none" };
    const parts = [field(label, `<select class="input" name="linkKind" data-action="r21-form-change">${options(LINK_KINDS, link.kind)}</select>`)];
    if (link.kind === "category") parts.push(field("Category", `<select class="input" name="linkRef" data-action="r21-form-change">${options([["", "Choose…"], ...State.categories.map((c) => [c.id, c.name])], link.ref)}</select>`));
    if (link.kind === "product") parts.push(field("Product", `<select class="input" name="linkRef" data-action="r21-form-change">${options([["", "Choose…"], ...State.items.slice().sort((a, b) => a.name.localeCompare(b.name)).map((i) => [i.id, `${i.name} · ${i.unit}`])], link.ref)}</select>`));
    if (link.kind === "brand") parts.push(field("Brand", `<select class="input" name="linkRef" data-action="r21-form-change">${options([["", "Choose…"], ...State.brands.slice().sort((a, b) => a.name.localeCompare(b.name)).map((b) => [b.id, b.name])], link.ref)}</select>`));
    if (link.kind === "tag") parts.push(sortedTags().length ? field("Tag", `<select class="input" name="linkRef" data-action="r21-form-change">${options([["", "Choose…"], ...sortedTags().map((t) => [t.slug, t.name])], link.ref)}</select>`) : note("No tags yet — create one in Masters ▸ Tags.", "warn"));
    if (link.kind === "search") parts.push(field("Search words", `<input class="input" name="linkText" maxlength="100" value="${esc(link.text || "")}" placeholder="e.g. mango" data-action="r21-form-change" />`, "The shopper sees the shop's search results for these words."));
    if (link.kind !== "none") {
      const n = linkItems(link).length;
      parts.push(n ? note(`${ic("check")} Opens ${plural(n, "product")} right now.`, "ok") : note(`${ic("alert")} Opens an empty list right now — check the choice above.`, "warn"));
    } else {
      parts.push(note("No button — the banner is just a picture with words.", ""));
    }
    return `<div class="r21-block"><div class="r21-block-title">When a shopper taps it</div>${parts.join("")}</div>`;
  }
  function datesFields(f) {
    return `<div class="r21-block"><div class="r21-block-title">When it shows <span class="qk-muted small" style="font-weight:400">· ${TZ_LABEL}</span></div>
      <label class="stock-toggle-lg"><input type="checkbox" name="enabled" ${f.enabled !== false ? "checked" : ""} /><span>Shown — switch off to hide it without deleting</span></label>
      <div class="r21-dates">
        ${field("Starts on", `<input class="input" type="date" name="startsOn" value="${esc(f.startsOn || "")}" />`, "Empty = from now")}
        ${field("Last day", `<input class="input" type="date" name="lastDay" value="${esc(f.lastDay || "")}" />`, "Shown to the end of this day · empty = no end")}
      </div></div>`;
  }
  function pickFields(f) {
    const isCat = f.type === "categoryGrid";
    const pick = f.pick || { all: true, ids: [] };
    const list = isCat ? State.categories.map((c) => [c.id, c.name]) : State.brands.filter((b) => b.logo).map((b) => [b.id, b.name]);
    return `<div class="r21-block"><div class="r21-block-title">${isCat ? "Categories" : "Brands"}</div>
      <label class="r21-radio"><input type="radio" name="pickAll" value="all" ${pick.all ? "checked" : ""} data-action="r21-form-change" /><span>${isCat ? `All categories, in your category order (up to ${R21.shopGrid})` : `All brands that have a logo (up to ${R21.shopGrid})`}</span></label>
      <label class="r21-radio"><input type="radio" name="pickAll" value="choose" ${!pick.all ? "checked" : ""} data-action="r21-form-change" /><span>Choose…</span></label>
      ${!pick.all ? `<div class="sidebar-checklist r21-picker">${list.length ? pickerRows(list, pick.ids || [], "pickIds") : `<div class="qk-muted small">${isCat ? "No categories yet." : "No brand has a logo yet — add one in Masters ▸ Brands."}</div>`}</div>` : ""}
      ${!isCat ? note(`${plural(State.brands.filter((b) => b.logo).length, "brand")} of ${State.brands.length} have a logo. Add logos in Masters ▸ Brands.`, "") : ""}
    </div>`;
  }
  function sectionFormModal() {
    const m = UI.modal;
    const f = m.form;
    const type = f.type;
    const layout = LAYOUTS.find((l) => l.key === m.layout) || {};
    const isNew = !f.id;
    const adminOnly = ADMIN_ONLY_NAME.includes(type);
    const parts = [];
    if (isNew) parts.push(`<button type="button" class="link-btn" data-action="r21-add-section" style="margin-bottom:10px">${ic("chevronLeft")} Other layouts</button>`);
    parts.push(`<div class="r21-form-layout">${sketch(layout.sketch, type)}<div><div class="r21-gal-name">${esc(layout.name || TYPE_NAME[type])}</div><div class="qk-muted small">${esc(layout.line || "")}</div></div></div>`);
    parts.push(field(adminOnly ? "Section name <span class=\"qk-muted small\" style=\"font-weight:400\">(only you see it)</span>" : "Title customers see *",
      `<input class="input" name="title" maxlength="80" value="${esc(f.title || "")}" placeholder="${adminOnly ? "e.g. Diwali banners" : "e.g. Diwali specials"}" />`));
    if (m.layout === "tiles") {
      parts.push(`<div class="field"><span class="field-label">Tile shape</span><div class="r21-choice">
        <label class="r21-radio"><input type="radio" name="type" value="verticalTiles" ${type === "verticalTiles" ? "checked" : ""} data-action="r21-form-change" />${sketch("tiles", "verticalTiles")}<span>Tall cards</span></label>
        <label class="r21-radio"><input type="radio" name="type" value="offerTiles" ${type === "offerTiles" ? "checked" : ""} data-action="r21-form-change" />${sketch("tiles", "offerTiles")}<span>Square cards</span></label></div></div>`);
    }
    if (m.layout === "bannerProducts") {
      parts.push(`<div class="field"><span class="field-label">Picture position</span><div class="r21-choice">
        <label class="r21-radio"><input type="radio" name="type" value="promo" ${type === "promo" ? "checked" : ""} data-action="r21-form-change" />${sketch("bannerProducts", "promo")}<span>Above the products</span></label>
        <label class="r21-radio"><input type="radio" name="type" value="freshSpotlight" ${type === "freshSpotlight" ? "checked" : ""} data-action="r21-form-change" />${sketch("bannerProducts", "freshSpotlight")}<span>Beside the products <span class="qk-muted small">(above them on a phone)</span></span></label></div></div>`);
    }
    if (PICTURE_TYPES.includes(type)) {
      parts.push(`<div class="r21-block-title">Picture *</div><div class="form-media-row"><img src="${esc(f.image || BLANK_PREVIEW)}" class="form-media-preview" alt="" /><label class="field"><span class="field-label">Image URL</span><input class="input" name="image" value="${esc(f.image || "")}" /></label></div>`);
      parts.push(field("Subtitle", `<input class="input" name="subtitle" maxlength="200" value="${esc(f.subtitle || "")}" />`));
    }
    if (PRODUCT_TYPES.includes(type)) parts.push(sourceFields(f));
    if (PICTURE_TYPES.includes(type)) parts.push(linkFields(f.link, "The button opens"));
    if (type === "categoryGrid" || type === "brandGrid") parts.push(pickFields(f));
    if (type === "buyAgain") parts.push(note("Only signed-in customers who ordered in the last 90 days see it — new customers won't. Each sees what they ordered most often (up to 20, in stock only).", ""));
    if (type === "recentlyViewed") parts.push(note("Each customer sees the products they looked at lately (up to 8). Nothing to set up.", ""));
    if (TILE_TYPES.includes(type)) {
      const word = type === "hero" ? "slide" : type === "trustStrip" ? "highlight" : "tile";
      parts.push(isNew ? note(`Add the section, then add its ${word}s — each with its own picture, words, link, on/off and dates.`, "")
        : `<div class="r21-block"><div class="r21-block-title">${esc(word[0].toUpperCase() + word.slice(1))}s</div>${note(`${plural(sortedTiles(State.homeSections.find((s) => s.id === f.id) || {}).length, word)}.`, "")}<button type="button" class="btn btn-outline btn-sm" data-action="r21-edit-content" data-id="${f.id}">${ic("edit")} Edit ${word}s</button></div>`);
    }
    if (type === "deals") {
      parts.push(isNew ? note("Add the section, then add your combos.", "") : `<button type="button" class="btn btn-outline btn-sm" data-action="r21-edit-content" data-id="${f.id}">${ic("edit")} Edit combos</button>`);
      parts.push(note("Hiding this section hides the combo cards only. A combo already in a cart keeps its bundle price until you delete the combo itself.", "warn"));
    }
    parts.push(datesFields(f));
    if (m.error) parts.push(`<div class="field-error">${esc(m.error)}</div>`);
    const body = `<form class="dialog-body" data-action="r21-save-section">${parts.join("")}
      <div class="form-actions">
        <button type="button" class="btn btn-outline btn-block" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary btn-block">${isNew ? "Add section" : "Save changes"}</button>
      </div></form>`;
    return withUploadButton(dialog(isNew ? `Add ${layout.name || "section"}` : `Edit — ${homeSectionLabel(f)}`, body, true), "home_screen");
  }
  function captureSectionForm(form) {
    const fd = new FormData(form);
    const f = UI.modal.form;
    const get = (k) => (fd.has(k) ? String(fd.get(k)) : null);
    if (get("title") != null) f.title = get("title").trim();
    if (get("type")) f.type = get("type");
    if (get("image") != null) f.image = get("image").trim();
    if (get("subtitle") != null) f.subtitle = get("subtitle").trim();
    if (get("sourceKind")) {
      const kind = get("sourceKind");
      const prev = f.source || {};
      f.source = { kind, ref: kind === prev.kind ? get("sourceRef") ?? prev.ref ?? "" : "", sort: get("sourceSort") || prev.sort || "top" };
      if (!NEEDS_REF.includes(kind)) delete f.source.ref;
    }
    if (fd.has("itemIds") || (f.source && f.source.kind === "hand" && form.querySelector('[name="itemIds"]'))) {
      const ticked = fd.getAll("itemIds").map(Number);
      const before = (f.itemIds || []).filter((id) => ticked.includes(id));
      f.itemIds = [...before, ...ticked.filter((id) => !before.includes(id))];
    }
    if (get("limit")) f.limit = Number(get("limit"));
    if (get("linkKind")) {
      const kind = get("linkKind");
      const prev = f.link || {};
      f.link = { kind };
      if (NEEDS_REF.includes(kind)) f.link.ref = kind === prev.kind ? get("linkRef") ?? prev.ref ?? "" : "";
      if (kind === "search") f.link.text = (get("linkText") ?? (prev.kind === "search" ? prev.text : "") ?? "").trim();
      if (["tag", "category", "brand"].includes(kind)) f.link.sort = "top";
    }
    if (get("pickAll")) f.pick = { all: get("pickAll") === "all", ids: fd.getAll("pickIds").map(Number) };
    f.enabled = form.querySelector('[name="enabled"]') ? fd.has("enabled") : f.enabled !== false;
    if (get("startsOn") != null) f.startsOn = get("startsOn") || "";
    if (get("lastDay") != null) f.lastDay = get("lastDay") || "";
    return f;
  }
  function checkSection(f, isNew) {
    const type = f.type;
    if (isNew && State.homeSections.length >= R21.sections) return `Your page holds at most ${R21.sections} sections — delete one first (Ended and Off sections count too)`;
    if (isNew && type === "deals" && State.homeSections.some((s) => s.type === "deals")) return "Your page already has a Combos section — one per page";
    if (!ADMIN_ONLY_NAME.includes(type) && !String(f.title || "").trim()) return "Give the section a title — customers see it";
    if (String(f.title || "").length > 80) return "Keep the title to 80 characters";
    if (PICTURE_TYPES.includes(type) && !f.image) return "Add a picture — upload one or paste an https:// link";
    if (PRODUCT_TYPES.includes(type)) {
      const src = f.source || {};
      if (NEEDS_REF.includes(src.kind) && !src.ref) return `Choose the ${src.kind} the products come from`;
      if (src.kind === "hand" && !(f.itemIds || []).length) return "Pick at least one product";
      if (src.kind === "hand" && f.itemIds.length > R21.picks) return `Pick at most ${R21.picks} products`;
      const [lo, hi] = limitRange(type);
      if (src.kind !== "hand" && (!(f.limit >= lo) || f.limit > hi)) return `How many: ${lo} to ${hi}`;
      const mine = src.kind === "hand" ? (f.itemIds || []).length : f.limit;
      if (cardsUsed(f.id) + mine > R21.cards) return `The page holds at most ${R21.cards} product cards — ${cardsUsed(f.id)} are used by other sections`;
    }
    if (type === "buyAgain" && cardsUsed(f.id) + 20 > R21.cards) return `The page holds at most ${R21.cards} product cards — ${cardsUsed(f.id)} are used by other sections`;
    if (PICTURE_TYPES.includes(type) && f.link) {
      if (NEEDS_REF.includes(f.link.kind) && !f.link.ref) return "Choose what the button opens";
      if (f.link.kind === "search" && !f.link.text) return "Type the search words";
    }
    if ((type === "categoryGrid" || type === "brandGrid") && f.pick && !f.pick.all) {
      if (!(f.pick.ids || []).length) return "Choose at least one, or pick “All”";
      if (f.pick.ids.length > R21.shopGrid) return `Choose at most ${R21.shopGrid}`;
    }
    if (f.startsOn && f.lastDay && f.lastDay < f.startsOn) return "The last day must be on or after the start day";
    return null;
  }
  Actions["r21-add-section"] = () => {
    if (State.homeSections.length >= R21.sections) { showToast(`Your page holds at most ${R21.sections} sections — delete one first (Ended and Off sections count too)`, "danger"); return; }
    UI.modal = { type: "r21Gallery" };
    render();
  };
  Actions["r21-pick-layout"] = (el) => {
    const layout = LAYOUTS.find((l) => l.key === el.dataset.layout);
    const type = layout.type;
    const form = { type, title: DEFAULT_TITLE[type] || "", enabled: true, startsOn: "", lastDay: "" };
    if (PRODUCT_TYPES.includes(type)) { form.source = { kind: "hand" }; form.itemIds = []; form.limit = defaultLimit(type); }
    if (PICTURE_TYPES.includes(type)) { form.link = { kind: "none" }; form.image = ""; form.subtitle = ""; }
    if (type === "categoryGrid" || type === "brandGrid") form.pick = { all: true, ids: [] };
    UI.modal = { type: "r21Section", layout: layout.key, form };
    render();
  };
  Actions["r21-form-change"] = (el) => {
    const form = el.closest("form");
    if (!form) return;
    if (form.dataset.action === "r21-save-section") captureSectionForm(form);
    else if (form.dataset.action === "save-tile") captureTileForm(form);
    UI.modal.error = null;
    render();
  };
  Actions["r21-edit-section"] = (el) => {
    const s = State.homeSections.find((x) => x.id === Number(el.dataset.id));
    UI.modal = { type: "r21Section", layout: layoutOfType(s.type), form: deepClone(s) };
    render();
  };
  Actions["r21-edit-content"] = (el) => {
    const s = State.homeSections.find((x) => x.id === Number(el.dataset.id));
    if (!s) return;
    UI.modal = s.type === "deals" ? { type: "comboListEditor", sectionId: s.id, editingComboId: null } : { type: "tileListEditor", sectionId: s.id, editingTileId: null };
    render();
  };
  Submits["r21-save-section"] = (form) => {
    const f = captureSectionForm(form);
    const isNew = !f.id;
    const box = form.querySelector('input[name="image"]');
    if (box && !pictureLinkOk(box.value, box.defaultValue)) { UI.modal.error = PASTED_LINK_ERROR; render(); return; }
    const problem = checkSection(f, isNew);
    if (problem) { UI.modal.error = problem; render(); return; }
    const clean = { ...f, v21: true };
    if (!PRODUCT_TYPES.includes(clean.type)) { delete clean.source; delete clean.limit; delete clean.itemIds; }
    if (clean.source && clean.source.kind !== "hand") delete clean.itemIds;
    if (!PICTURE_TYPES.includes(clean.type)) { delete clean.link; delete clean.image; delete clean.subtitle; }
    let saved;
    if (isNew) {
      const id = Math.max(0, ...State.homeSections.map((s) => s.id)) + 1;
      const order = Math.max(0, ...State.homeSections.map((s) => s.order)) + 1;
      saved = { ...clean, id, order, tiles: TILE_TYPES.includes(clean.type) ? [] : undefined, combos: clean.type === "deals" ? [] : undefined };
      State.homeSections = [...State.homeSections, saved];
    } else {
      State.homeSections = State.homeSections.map((s) => (s.id === f.id ? { ...s, ...clean } : s));
      saved = State.homeSections.find((s) => s.id === f.id);
    }
    persist("homeSections");
    if (isNew && (TILE_TYPES.includes(saved.type) || saved.type === "deals")) {
      showToast(`${homeSectionLabel(saved)} added — now add its ${saved.type === "deals" ? "combos" : saved.type === "hero" ? "slides" : saved.type === "trustStrip" ? "highlights" : "tiles"}`);
      UI.modal = saved.type === "deals" ? { type: "comboListEditor", sectionId: saved.id, editingComboId: null } : { type: "tileListEditor", sectionId: saved.id, editingTileId: null };
    } else {
      showToast(`${homeSectionLabel(saved)} ${isNew ? "added" : "saved"}`);
      UI.modal = null;
    }
    render();
  };

  /* ---------------- 10. Admin: deleting a section ---------------- */
  function confirmModal() {
    const m = UI.modal;
    return dialog(m.title, `<div class="dialog-body">${m.html}
      <div class="form-actions">
        <button type="button" class="btn btn-outline btn-block" data-action="close-modal">${m.confirm ? "Cancel" : "OK"}</button>
        ${m.confirm ? `<button type="button" class="btn btn-danger btn-block" data-action="${m.confirm}" data-id="${esc(String(m.id))}">${esc(m.confirmText || "Delete")}</button>` : ""}
      </div></div>`);
  }
  Actions["r21-delete-section"] = (el) => {
    const s = State.homeSections.find((x) => x.id === Number(el.dataset.id));
    if (!s) return;
    if (s.type === "deals" && ((s.combos || []).length || s.everHadCombos)) {
      UI.modal = { type: "r21Confirm", title: "This Combos section can't be deleted", html: `<p>It holds ${plural((s.combos || []).length, "combo")}${(s.combos || []).length ? `: ${esc((s.combos || []).map((c) => c.title).join(", "))}` : ""}. Combos stay linked to past orders and carts, so a Combos section that has held a combo is never deleted.</p><p><b>Switch it off</b> to hide it from customers instead.</p>` };
      render();
      return;
    }
    const word = TILE_TYPES.includes(s.type) ? ` and its ${plural(sortedTiles(s).length, s.type === "hero" ? "slide" : "tile")}` : "";
    UI.modal = { type: "r21Confirm", title: "Delete this section?", html: `<p>“${esc(homeSectionLabel(s))}”${word} will be removed from the customer home page. This can't be undone.</p><p class="qk-muted small">To hide it for now, switch it off instead.</p>`, confirm: "r21-confirm-delete", id: s.id };
    render();
  };
  Actions["r21-confirm-delete"] = (el) => {
    const id = Number(el.dataset.id);
    const s = State.homeSections.find((x) => x.id === id);
    State.homeSections = renumber(sortedHomeSections().filter((x) => x.id !== id));
    persist("homeSections");
    UI.modal = null;
    showToast(`${s ? homeSectionLabel(s) : "Section"} deleted`);
    render();
  };

  /* ---------------- 11. Admin: slides and tiles (link, on/off, dates) ---------------- */
  const tileWord = (section) => (section.type === "hero" ? "slide" : section.type === "trustStrip" ? "highlight" : "tile");
  function tileFormR21(section, editingTileId) {
    const isNew = editingTileId === "new";
    const config = TILE_TYPE_CONFIG[section.type];
    const word = tileWord(section);
    const saved = isNew ? { title: "", subtitle: "", image: "", icon: "check", link: { kind: "none" }, enabled: true } : sortedTiles(section).find((x) => x.id === editingTileId) || {};
    const t = UI.modal.tileDraft && UI.modal.tileDraft._for === editingTileId ? UI.modal.tileDraft : { ...deepClone(saved), _for: editingTileId };
    UI.modal.tileDraft = t;
    const linkable = section.type !== "trustStrip";
    const body = `
      <form class="dialog-body" data-action="save-tile" data-section="${section.id}" data-tile="${isNew ? "new" : esc(editingTileId)}">
        <button type="button" class="link-btn" data-action="back-to-tile-list" data-section="${section.id}" style="margin-bottom:10px">${ic("chevronLeft")} Back to ${esc(homeSectionLabel(section))}</button>
        ${config.media === "image" ? `
        <div class="form-media-row">
          <img src="${esc(t.image || BLANK_PREVIEW)}" class="form-media-preview" alt="" />
          <label class="field"><span class="field-label">Image URL</span><input class="input" name="image" value="${esc(t.image || "")}" /></label>
        </div>` : `
        <label class="field"><span class="field-label">Icon</span>
          <select class="input" name="icon">${TRUST_ICON_OPTIONS.map((o) => `<option value="${o.key}" ${(t.icon || "check") === o.key ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>
        </label>`}
        <label class="field"><span class="field-label">Title *</span><input class="input" name="title" value="${esc(t.title || "")}" /></label>
        <label class="field"><span class="field-label">Subtitle</span><input class="input" name="subtitle" value="${esc(t.subtitle || "")}" /></label>
        ${linkable ? linkFields(t.link, `When a shopper taps the ${word}`) : ""}
        ${datesFields(t)}
        ${UI.modal.error ? `<div class="field-error">${esc(UI.modal.error)}</div>` : ""}
        <div class="form-actions">
          <button type="button" class="btn btn-outline btn-block" data-action="back-to-tile-list" data-section="${section.id}">Cancel</button>
          <button type="submit" class="btn btn-primary btn-block">${isNew ? `Add ${word}` : "Save changes"}</button>
        </div>
      </form>`;
    return withUploadButton(dialog(isNew ? `Add ${word}` : `Edit ${word}`, body, true), "home_screen");
  }
  window.tileFormModal = tileFormR21;
  function captureTileForm(form) {
    const fd = new FormData(form);
    const t = UI.modal.tileDraft || {};
    ["title", "subtitle", "image", "icon"].forEach((k) => { if (fd.has(k)) t[k] = String(fd.get(k)).trim(); });
    if (fd.has("linkKind")) {
      const kind = String(fd.get("linkKind"));
      const prev = t.link || {};
      t.link = { kind };
      if (NEEDS_REF.includes(kind)) t.link.ref = kind === prev.kind ? (fd.has("linkRef") ? String(fd.get("linkRef")) : prev.ref || "") : "";
      if (kind === "search") t.link.text = String(fd.get("linkText") ?? (prev.kind === "search" ? prev.text || "" : "")).trim();
      if (["tag", "category", "brand"].includes(kind)) t.link.sort = "top";
    }
    t.enabled = fd.has("enabled");
    t.startsOn = String(fd.get("startsOn") || "");
    t.lastDay = String(fd.get("lastDay") || "");
    UI.modal.tileDraft = t;
    return t;
  }
  const baseSaveTile = Submits["save-tile"];
  Submits["save-tile"] = (form, ev) => {
    const t = captureTileForm(form);
    const section = State.homeSections.find((s) => s.id === Number(form.dataset.section));
    const isNew = form.dataset.tile === "new";
    if (isNew && section.type === "trustStrip" && (section.tiles || []).length >= R21.highlights) { UI.modal.error = `A highlights strip holds at most ${R21.highlights} items`; render(); return; }
    if (t.link && NEEDS_REF.includes(t.link.kind) && !t.link.ref) { UI.modal.error = "Choose what the tap opens"; render(); return; }
    if (t.link && t.link.kind === "search" && !t.link.text) { UI.modal.error = "Type the search words"; render(); return; }
    if (t.startsOn && t.lastDay && t.lastDay < t.startsOn) { UI.modal.error = "The last day must be on or after the start day"; render(); return; }
    const beforeIds = new Set((section.tiles || []).map((x) => x.id));
    baseSaveTile(form, ev);
    if (UI.modal && UI.modal.type === "tileListEditor" && UI.modal.editingTileId == null) {
      const fresh = State.homeSections.find((s) => s.id === section.id);
      const targetId = isNew ? ((fresh.tiles || []).find((x) => !beforeIds.has(x.id)) || {}).id : form.dataset.tile;
      fresh.tiles = (fresh.tiles || []).map((x) => {
        if (x.id !== targetId) return x;
        const out = { ...x, enabled: t.enabled !== false, startsOn: t.startsOn || "", lastDay: t.lastDay || "", link: section.type === "trustStrip" ? { kind: "none" } : t.link || { kind: "none" } };
        delete out.catId; delete out.tag;
        return out;
      });
      persist("homeSections");
      render();
    }
  };
  window.tileRowHTML = (section, t, config) => {
    const st = tileStatus(t, todayShop());
    const media = config.media === "icon"
      ? `<span class="admin-row-img" style="display:flex;align-items:center;justify-content:center;background:var(--tint);color:var(--primary)">${ic(t.icon || "check")}</span>`
      : `<img src="${t.image || ""}" class="admin-row-img" alt="" />`;
    const bits = [section.type !== "trustStrip" ? describeLink(t.link) : "", datesText(t), t.fromPromotion ? "was a promotion" : ""].filter(Boolean).join(" · ");
    return `
  <div class="admin-row tile-row" data-tile-id="${esc(t.id)}">
    <span class="drag-handle" draggable="true" aria-label="Drag to reorder">☰</span>
    ${media}
    <div class="admin-row-info">
      <div class="admin-row-name">${esc(t.title)} ${chip(st)}</div>
      ${bits ? `<div class="qk-muted small">${esc(bits)}</div>` : ""}
    </div>
    <button class="icon-btn" data-action="edit-tile" data-section="${section.id}" data-tile="${esc(t.id)}" aria-label="Edit">${ic("edit")}</button>
    <button class="icon-btn icon-btn-danger" data-action="delete-tile" data-section="${section.id}" data-tile="${esc(t.id)}" aria-label="Delete">${ic("trash")}</button>
  </div>`;
  };
  const baseTileList = tileListEditorModal;
  window.tileListEditorModal = () => {
    const m = UI.modal;
    const section = State.homeSections.find((s) => s.id === m.sectionId);
    if (m.editingTileId == null) m.tileDraft = null;
    let html = baseTileList();
    if (!section || m.editingTileId != null) return html;
    const word = tileWord(section);
    html = html.replace(`${ic("plus")} Add tile`, `${ic("plus")} Add ${word}`).replace("No tiles yet", `No ${word}s yet`);
    return html.replace('<div class="admin-table"', `<div class="qk-muted small" style="margin:10px 0 0">Customers see the ${word}s in this order. Each ${word} has its own on/off and dates.</div><div class="admin-table"`);
  };
  // Combos: a section that has held a combo is never deleted (D126 h).
  const baseSaveCombo = Submits["save-combo"];
  Submits["save-combo"] = (form, ev) => {
    const res = baseSaveCombo(form, ev);
    const s = State.homeSections.find((x) => x.id === Number(form.dataset.section));
    if (s && (s.combos || []).length && !s.everHadCombos) { s.everHadCombos = true; persist("homeSections"); }
    return res;
  };

  /* ---------------- 12. Modals ---------------- */
  const modalBefore = window.extraModal;
  window.extraModal = (type) => {
    if (type === "r21Gallery") return galleryModal();
    if (type === "r21Section") return sectionFormModal();
    if (type === "r21Confirm") return confirmModal();
    if (type === "r21TagForm") return tagFormModal();
    return modalBefore(type);
  };

  /* ---------------- 13. Menu: Promotions folded in; Masters ▸ Tags ---------------- */
  const marketing = ADMIN_NAV.find((n) => n.group === "marketing");
  if (marketing) marketing.keys = marketing.keys.filter((k) => k !== "promotions");
  reorderAdminScreens();
  (() => {
    const baseTabs = visibleAdminTabs;
    window.visibleAdminTabs = (user) => {
      const tabs = baseTabs(user).filter((t) => t.key !== "promotions");
      return canView(user, "catalog") ? [...tabs, { key: "tags", label: "Tags", icon: "tag" }] : tabs;
    };
    const baseNav = adminNavHTML;
    window.adminNavHTML = (visibleTabs) => {
      const has = visibleTabs.some((t) => t.key === "tags");
      if (has && UI.adminTab === "tags") UI.navOpen = { ...(UI.navOpen || {}), masters: true };
      const html = baseNav(visibleTabs);
      if (!has) return html;
      const item = `<button class="dash-nav-item dash-nav-sub ${UI.adminTab === "tags" ? "active" : ""}" data-action="admin-tab" data-tab="tags">${ic("tag")}<span>Tags</span></button>`;
      return html.replace(/(<button class="dash-nav-item dash-nav-sub[^"]*" data-action="admin-tab" data-tab="brands">[\s\S]*?<\/button>)/, `$1${item}`);
    };
    const baseTitle = adminPageTitle;
    window.adminPageTitle = (key) => (key === "tags" ? `<span class="crumb">Masters ›</span> Tags` : baseTitle(key));
    const baseContent = adminTabContent;
    window.adminTabContent = (user) => {
      if (UI.adminTab === "promotions") UI.adminTab = "homeScreen";
      if (UI.adminTab !== "tags") return baseContent(user);
      return canView(user, "catalog") ? adminTags(canEdit(user, "catalog")) : `<div class="empty-state"><div class="empty-title">You don't have access to this screen</div></div>`;
    };
  })();

  /* ---------------- 14. Masters ▸ Tags ---------------- */
  function tagUse(slug) {
    const products = State.items.filter((i) => (i.tags || []).includes(slug));
    const today = todayShop();
    const uses = [];
    sortedHomeSections().forEach((s) => {
      const st = sectionStatus(s, today).chip;
      if (s.source && s.source.kind === "tag" && s.source.ref === slug) uses.push(`“${homeSectionLabel(s)}” (${st}) · its products`);
      if (s.link && s.link.kind === "tag" && s.link.ref === slug) uses.push(`“${homeSectionLabel(s)}” (${st}) · its button`);
      sortedTiles(s).forEach((t) => { if (t.link && t.link.kind === "tag" && t.link.ref === slug) uses.push(`“${homeSectionLabel(s)}” (${st}) · ${tileWord(s)} “${t.title}”`); });
    });
    return { products, uses };
  }
  function adminTags(editable) {
    const tags = sortedTags();
    return `
  <div class="admin-toolbar">
    ${editable ? `<button class="btn btn-primary btn-sm" data-action="r21-new-tag" ${tags.length >= R21.tags ? "disabled" : ""}>${ic("plus")} Add tag</button>` : "<span></span>"}
    <span class="qk-muted small">${tags.length} of ${R21.tags} tags</span>
  </div>
  <div class="qk-muted small" style="margin:10px 0">Tags group products for home-page rows, banners and the shop's quick filters, in this order. <b>On offer</b> is automatic (price below MRP) — it isn't a tag. A tag's short name (shown in grey) is fixed once made.</div>
  <div class="admin-table">
    ${tags.length ? tags.map((t, idx) => { const u = tagUse(t.slug); return `
      <div class="admin-row">
        <span class="admin-row-img r21-tag-icon">${ic("tag")}</span>
        <div class="admin-row-info">
          <div class="admin-row-name">${esc(t.name)} <span class="qk-muted small">· ${esc(t.slug)}</span></div>
          <div class="qk-muted small">${plural(u.products.length, "product")}${u.uses.length ? ` · used by ${plural(u.uses.length, "home-page place")}` : ""}</div>
        </div>
        ${editable ? `
        <button class="icon-btn" data-action="r21-move-tag" data-id="${t.id}" data-dir="-1" ${idx === 0 ? "disabled" : ""} aria-label="Up">▲</button>
        <button class="icon-btn" data-action="r21-move-tag" data-id="${t.id}" data-dir="1" ${idx === tags.length - 1 ? "disabled" : ""} aria-label="Down">▼</button>
        <button class="icon-btn" data-action="r21-edit-tag" data-id="${t.id}" aria-label="Rename">${ic("edit")}</button>
        <button class="icon-btn icon-btn-danger" data-action="r21-delete-tag" data-id="${t.id}" aria-label="Delete">${ic("trash")}</button>` : ""}
      </div>`; }).join("") : `<div class="empty-state"><div class="empty-title">No tags yet</div><div class="empty-hint">Make one — e.g. “Diwali specials”, “Organic” — then tick it on products in the Catalogue.</div></div>`}
  </div>`;
  }
  function tagFormModal() {
    const f = UI.modal.form;
    const slug = f.id ? f.slug : slugify(f.name);
    return dialog(f.id ? "Rename tag" : "Add tag", `
      <form class="dialog-body" data-action="r21-save-tag">
        ${field("Name *", `<input class="input" name="name" maxlength="40" value="${esc(f.name || "")}" placeholder="e.g. Diwali specials" oninput="var s=document.getElementById('r21Slug'); if (s && !${f.id ? "true" : "false"}) s.textContent=this.value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40) || '—'" />`)}
        <div class="qk-muted small" style="margin:-6px 0 12px">Short name: <b id="r21Slug">${esc(slug || "—")}</b> ${f.id ? "(fixed — links keep working when you rename)" : "(fixed once made)"}</div>
        ${UI.modal.error ? `<div class="field-error">${esc(UI.modal.error)}</div>` : ""}
        <div class="form-actions">
          <button type="button" class="btn btn-outline btn-block" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary btn-block">${f.id ? "Save" : "Add tag"}</button>
        </div>
      </form>`);
  }
  Actions["r21-new-tag"] = () => { UI.modal = { type: "r21TagForm", form: { name: "" } }; render(); };
  Actions["r21-edit-tag"] = (el) => { const t = (State.tags || []).find((x) => x.id === Number(el.dataset.id)); UI.modal = { type: "r21TagForm", form: { ...t } }; render(); };
  Actions["r21-move-tag"] = (el) => {
    const list = sortedTags();
    const i = list.findIndex((t) => t.id === Number(el.dataset.id));
    const j = i + Number(el.dataset.dir);
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    State.tags = list.map((t, idx) => ({ ...t, order: idx + 1 }));
    persist("tags"); syncTagOptions(); render();
  };
  Submits["r21-save-tag"] = (form) => {
    const name = String(new FormData(form).get("name") || "").trim();
    const f = UI.modal.form;
    const fail = (msg) => { UI.modal.error = msg; UI.modal.form = { ...f, name }; render(); };
    if (!name) return fail("Give the tag a name");
    if ((State.tags || []).some((t) => t.id !== f.id && t.name.toLowerCase() === name.toLowerCase())) return fail("A tag with that name already exists");
    if (f.id) {
      State.tags = State.tags.map((t) => (t.id === f.id ? { ...t, name } : t));
    } else {
      const slug = slugify(name);
      if (!slug) return fail("Use some letters or numbers in the name");
      if (slug === "offer") return fail("“offer” is reserved — On offer is automatic (price below MRP)");
      if (State.tags.some((t) => t.slug === slug)) return fail("A tag with that short name already exists");
      if (State.tags.length >= R21.tags) return fail(`A shop has at most ${R21.tags} tags`);
      const id = Math.max(0, ...State.tags.map((t) => t.id)) + 1;
      State.tags = [...State.tags, { id, slug, name, order: State.tags.length + 1 }];
    }
    persist("tags"); syncTagOptions();
    UI.modal = null;
    showToast(`Tag “${name}” saved`);
    render();
  };
  Actions["r21-delete-tag"] = (el) => {
    const t = (State.tags || []).find((x) => x.id === Number(el.dataset.id));
    if (!t) return;
    const u = tagUse(t.slug);
    if (u.products.length || u.uses.length) {
      UI.modal = { type: "r21Confirm", title: `“${t.name}” is in use`, html: `<p>Remove it from these first:</p><ul class="r21-list">
        ${u.products.length ? `<li>${plural(u.products.length, "product")} in the Catalogue (${esc(u.products.slice(0, 3).map((p) => p.name).join(", "))}${u.products.length > 3 ? "…" : ""})</li>` : ""}
        ${u.uses.map((x) => `<li>${esc(x)} — change it in Marketing ▸ Home Screen</li>`).join("")}</ul>` };
      render();
      return;
    }
    UI.modal = { type: "r21Confirm", title: "Delete this tag?", html: `<p>“${esc(t.name)}” is not used anywhere. Deleting it can't be undone.</p>`, confirm: "r21-confirm-delete-tag", id: t.id };
    render();
  };
  Actions["r21-confirm-delete-tag"] = (el) => {
    State.tags = sortedTags().filter((t) => t.id !== Number(el.dataset.id)).map((t, idx) => ({ ...t, order: idx + 1 }));
    persist("tags"); syncTagOptions();
    UI.modal = null; showToast("Tag deleted"); render();
  };

  /* ---------------- 15. The product form's tags; brand logos ---------------- */
  const baseItemForm = window.itemFormModal;
  window.itemFormModal = (...args) => {
    syncTagOptions();
    let html = baseItemForm(...args);
    html = html.replace("(controls which home-page rails &amp; shop quick-filters this item appears in)", "(your own tags — Masters ▸ Tags. <b>On offer</b> is automatic: price below MRP.)");
    if (!sortedTags().length) html = html.replace('<div class="sidebar-checklist" style="margin:-4px 0 14px">', '<div class="sidebar-checklist" style="margin:-4px 0 14px"><span class="qk-muted small">No tags yet — make one in Masters ▸ Tags.</span>');
    return html;
  };
  const baseBrandForm = window.brandFormModal;
  window.brandFormModal = () => {
    const f = UI.modal.form;
    const logo = `<div class="r21-block-title">Logo <span class="qk-muted small" style="font-weight:400">(shown in “Shop by brand” on the home page)</span></div><div class="form-media-row"><img src="${esc(f.logo || BLANK_PREVIEW)}" class="form-media-preview" alt="" /><label class="field"><span class="field-label">Image URL</span><input class="input" name="image" value="${esc(f.logo || "")}" /></label></div>`;
    return withUploadButton(baseBrandForm().replace('<form class="dialog-body" data-action="save-brand">', `<form class="dialog-body" data-action="save-brand">${logo}`), "brand");
  };
  const baseSaveBrand = Submits["save-brand"];
  Submits["save-brand"] = (form, ev) => {
    const box = form.querySelector('input[name="image"]');
    if (box && !pictureLinkOk(box.value, box.defaultValue)) { UI.modal.error = PASTED_LINK_ERROR; render(); return; }
    const logo = box ? box.value.trim() : "";
    const name = String(new FormData(form).get("name") || "").trim();
    const id = (UI.modal.form || {}).id;
    baseSaveBrand(form, ev);
    const b = State.brands.find((x) => (id ? x.id === id : x.name === name));
    if (b && !(UI.modal && UI.modal.error)) { State.brands = State.brands.map((x) => (x.id === b.id ? { ...x, logo } : x)); persist("brands"); render(); }
  };
  window.adminBrandRows = (brands, countFor, editable) => `
    ${brands.map((b) => `
      <div class="admin-row">
        ${b.logo ? `<img src="${b.logo}" class="admin-row-img r21-brand-logo" alt="" />` : `<span class="admin-row-img r21-brand-nologo">${esc(b.name.slice(0, 2).toUpperCase())}</span>`}
        <div class="admin-row-info"><div class="admin-row-name">${esc(b.name)}</div><div class="qk-muted small">${countFor(b.name)} item${countFor(b.name) === 1 ? "" : "s"}${b.logo ? "" : " · no logo"}</div></div>
        ${editable ? `
        <button class="icon-btn" data-action="edit-brand" data-id="${b.id}" aria-label="Edit">${ic("edit")}</button>
        <button class="icon-btn icon-btn-danger" data-action="delete-brand" data-id="${b.id}" aria-label="Delete">${ic("trash")}</button>` : ""}
      </div>`).join("")}
    ${brands.length === 0 ? `<div class="empty-state"><div class="empty-title">No brands match</div></div>` : ""}`;

  /* ---------------- 16. What's changed ---------------- */
  WHATS_NEW.unshift({ area: "Round 21 — the home page builder (D126, P24 — backend not built yet)", items: [
    ["Add section asks for a layout", "Marketing ▸ Home Screen ▸ Add section opens a gallery: Banners (Banner carousel, Single banner, Banner tiles), Products (Product row, Product grid, Banner + products, Combos), Shop by (Category grid, Shop by brand), For each shopper (Buy again, Recently viewed), Info (Highlights strip). Each card has a small drawing. Any layout can be added more than once — Combos only once. At most 25 sections and 200 product cards a page."],
    ["Where products come from", "A product row, grid or banner + products takes its products from: products you pick, a category, a brand, a tag (ordered top selling / biggest discount / price / name), Top selling (automatic, last 30 days) or On offer (automatic: price below MRP). A line under the choice says how many it shows right now, or why it would be hidden."],
    ["What a tap opens", "Every slide, tile and banner chooses what a tap opens: nothing (no button), a category, one product, a brand, a tag, search results for some words, top selling, or everything on offer. The list opens with the title of what was tapped."],
    ["Dates and one status chip", "Sections and each slide or tile have Starts on (empty = now) and Last day (shown to the end of that day), in Singapore time — the coupons' convention. Each row shows one chip — Off, Ended, Scheduled, Empty or On — with the reason on the line under it."],
    ["Promotions are now slides", "Marketing ▸ Promotions is gone. Each promotion became a slide at the end of the first banner carousel (switched-off ones stay off); the Home Screen shows a one-time note. The Promotions permission is gone from roles — Home Screen permission covers banners."],
    ["Masters ▸ Tags", "Each shop makes its own tags (up to 50) — the old fixed five became Prabhas's own (Best Sellers, Fresh Picks, Indian Essentials, Singapore Favourites). A tag's short name is fixed once made; “offer” is reserved. Deleting a tag that products or the home page use is refused with the list. The product form's chips are the shop's tags."],
    ["Brand logos", "Masters ▸ Brands: each brand can have a logo (upload or https link). Shop by brand shows the brands that have one."],
    ["The customer home page", "Sections show in exactly the admin's order (no banner forced to the top), with neutral words — no built-in “Farm fresh” or “Weekly savings” — and a banner with nothing to open has no button. New: Product grid, Category grid, Shop by brand and Buy again (what a signed-in customer ordered most often in 90 days). The shop's quick filters are the shop's tags plus On offer."],
  ] });
})();
