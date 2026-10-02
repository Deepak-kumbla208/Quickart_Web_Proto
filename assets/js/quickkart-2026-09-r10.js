/* ====================================================================
   QuickKart prototype — Round 10 (2 October 2026): picture uploads (P9-1,
   MR !72, D77), Categories / Brands (P9-2, MR !73), and Products / Stock
   (P9-3 MR !75, P9-4 MR !76, D79, D80), as the backend built them on
   quickkart-api-service. Every change of the day is here.

   A. "Upload" next to every Image URL box — product, category, the home
      screen's section / tile / combo / promo-section forms, promotion —
      and the logo's device upload brought in line with the same rules.
   B. The backend's rules: JPEG, PNG or WebP only (never SVG); the photo is
      shrunk in the browser first (at most 1200 px on the long side, WebP
      at quality 0.8); at most 2 MB after that.
   C. Or paste a link: a changed Image URL must start with https:// (D77 c).
      Pictures already saved are left alone.
   D. Fix: "New promotion" no longer breaks the page (its default picture
      list, BANNERS, was never defined).
   E. Categories (P9-2): a category that a home-screen tile opens cannot be
      deleted either (a tile would open a missing category); the list shows
      the tiles next to the item count; the refusals use the backend's
      words — for brands too.
   F. Stock Rules: "Cost price when stock is received" — Average (default),
      Last delivery's cost, or Don't change it (D80).
   G. Receive stock: the hint follows that setting, the cost price is
      updated by it, and the product's own supplier is no longer replaced.
   H. A product cannot be deleted while a store holds stock (above or below
      0) or a combo contains it (D79) — the backend's words; products that
      had it as default substitute get none.
   I. Stock take: a counted quantity cannot be below 0.
   J. Product form: the brand is picked from the Brands list (the API takes
      a brand id — new brands are added in Masters ▸ Brands); Description,
      HSN code and Default substitute added; the cost price may be blank.
   K. Saving a product: price not above MRP, barcode unique, HSN 4–10 digits.
   L. Catalogue: no cost price shows "—" for cost and margin and sorts as the
      lowest margin, as the backend does.

   In the real admin app the button calls POST /admin/uploads/presign
   { purpose, contentType, sizeBytes } with the SHRUNK picture's type and
   size, PUTs it to `uploadUrl` with the `headers` it returns, and puts
   `publicUrl` in the box (quickkart-api-service docs/08 §31). The
   prototype has no storage, so it keeps the shrunk picture in the browser
   (a data: address) instead — same look, same rules.
   ==================================================================== */

/* ---------------- 1. The rules ---------------- */
const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
const UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const UPLOAD_MAX_SIDE = 1200;
const UPLOAD_HINT = "JPEG, PNG or WebP, up to 2 MB — photos are shrunk to 1200 px before upload. Or paste an https:// link.";
const PASTED_LINK_ERROR = "Paste a picture link that starts with https://, or upload a picture";

/** Shrinks a picture to at most 1200 px on the long side (WebP, or JPEG where the browser can't write WebP). */
async function shrinkPicture(file) {
  if (!UPLOAD_TYPES.includes(file.type)) throw new Error("Only JPEG, PNG or WebP pictures");
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch (e) { throw new Error("This file is not a picture we can read"); }
  const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, 0.8));
  let picture = await encode("image/webp");
  if (!picture || picture.type !== "image/webp") picture = await encode("image/jpeg");
  if (!picture) throw new Error("Upload failed — try again");
  if (picture.size > UPLOAD_MAX_BYTES) throw new Error("The picture is larger than 2 MB — shrink it before uploading");
  return { picture, width: canvas.width, height: canvas.height };
}

/** Stand-in for presign + PUT: the prototype keeps the picture as a data: address. */
function pictureAddress(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Upload failed — try again"));
    reader.readAsDataURL(blob);
  });
}

/** An uploaded picture, an https:// link, nothing, or what was already saved — anything else is refused. */
function pictureLinkOk(value, saved) {
  const v = (value || "").trim();
  return !v || v === (saved || "").trim() || v.startsWith("https://") || v.startsWith("data:image/");
}

/* ---------------- 2. The Upload button on every image field ---------------- */
const IMAGE_FIELD = /<label class="field"><span class="field-label">(Image URL|Banner image URL)<\/span>(<input class="input" name="image"[^>]*\/>)<\/label>/;

function withUploadButton(html, purpose) {
  return html.replace(IMAGE_FIELD, (_, label, input) => {
    const box = input
      .replace('class="input"', 'class="input" style="flex:1;min-width:0"')
      .replace(/ placeholder="[^"]*"/, "")
      .replace("/>", 'placeholder="https://… or upload a picture" />');
    // data-action="pick-picture" has no handler on purpose: the dialog's "noop" would otherwise
    // preventDefault the click and the file picker would never open.
    return `
      <div class="field">
        <span class="field-label">${label}</span>
        <div style="display:flex;gap:8px;align-items:center">
          ${box}
          <label class="btn btn-outline btn-sm" data-action="pick-picture" style="flex-shrink:0;cursor:pointer">${ic("upload")}<span class="upload-label">Upload</span><input type="file" accept="${UPLOAD_TYPES.join(",")}" data-action="upload-picture" data-purpose="${purpose}" hidden /></label>
        </div>
        <span class="qk-muted small">${UPLOAD_HINT}</span>
      </div>`;
  });
}

// The form → the backend's `purpose` (which screen's edit permission it needs).
[
  ["itemFormModal", "product"],
  ["categoryFormModal", "category"],
  ["sectionEditFormModal", "home_screen"],
  ["tileFormModal", "home_screen"],
  ["comboFormModal", "home_screen"],
  ["promoSectionFormModal", "home_screen"],
  ["promoFormModal", "promotion"],
].forEach(([name, purpose]) => {
  const base = window[name];
  window[name] = (...args) => withUploadButton(base(...args), purpose);
});

Actions["upload-picture"] = async (el) => {
  const file = el.files && el.files[0];
  if (!file) return;
  const field = el.closest(".field");
  const box = field.querySelector('input[name="image"]');
  const button = el.closest("label");
  const text = button.querySelector(".upload-label");
  button.style.pointerEvents = "none";
  text.textContent = "Uploading…";
  try {
    const { picture, width, height } = await shrinkPicture(file);
    // Real app: POST /admin/uploads/presign { purpose: el.dataset.purpose, contentType: picture.type,
    // sizeBytes: picture.size } → PUT the picture to uploadUrl → box.value = publicUrl.
    const address = await pictureAddress(picture);
    box.value = address;
    const preview = field.closest(".form-media-row") && field.closest(".form-media-row").querySelector(".form-media-preview");
    if (preview) preview.src = address;
    // Kept on the open form too, so a re-render (e.g. a "SKU already used" message) does not lose it.
    if (UI.modal && UI.modal.form) UI.modal.form.image = address;
    showToast(`Picture uploaded — ${width} × ${height}, ${Math.max(1, Math.round(picture.size / 1024))} KB. It is saved with the form.`);
  } catch (e) {
    showToast(e.message || "Upload failed — try again", "danger");
  } finally {
    el.value = ""; // the same file can be picked again
    button.style.pointerEvents = "";
    text.textContent = "Upload";
  }
};

// A changed Image URL must be an https:// link (or an uploaded picture) — checked before each form's own save.
["save-item", "save-category", "save-section-edit", "save-tile", "save-combo", "save-promo-section", "save-promo"].forEach((key) => {
  const base = Submits[key];
  if (!base) return;
  Submits[key] = (form, ev) => {
    const box = form.querySelector('input[name="image"]');
    if (box && !pictureLinkOk(box.value, box.defaultValue)) {
      showToast(PASTED_LINK_ERROR, "danger");
      box.focus();
      return;
    }
    return base(form, ev);
  };
});

// Fix: the promotion form and its save fall back to BANNERS[n].image when no picture is given, but BANNERS was never
// defined, so "New promotion" broke the page. The seeded promotions' pictures serve as those defaults.
const BANNERS = SEED_PROMOTIONS.map((p) => ({ image: p.image })).filter((b) => b.image);
while (BANNERS.length < 4) BANNERS.push(BANNERS[0] || { image: img("photo-1566478989037-eec170784d0b", 1400) });

/* ---------------- 3. The logo (Theme & Branding) ---------------- */
(() => {
  const baseBranding = adminThemeBranding;
  window.adminThemeBranding = (editable) =>
    baseBranding(editable)
      .replace('accept="image/*" data-action="logo-file-upload"', `accept="${UPLOAD_TYPES.join(",")}" data-action="logo-file-upload"`)
      .replace(
        /(<label class="field"><span class="field-label">Or upload from device<\/span>[^]*?<\/label>)/,
        `$1<div class="qk-muted small" style="margin:-4px 0 12px">${UPLOAD_HINT}</div>`,
      );

  const currentLogo = () => ((UI.themeDraft || State.siteCustomization || {}).branding || {}).logoUrl || "";

  Actions["logo-file-upload"] = async (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      const { picture, width, height } = await shrinkPicture(file);
      const address = await pictureAddress(picture); // real app: presign (purpose "logo") + PUT → publicUrl
      ensureThemeDraft();
      UI.themeDraft.branding.logoUrl = address;
      render();
      showToast(`Logo uploaded — ${width} × ${height}, ${Math.max(1, Math.round(picture.size / 1024))} KB. Save to apply it.`);
    } catch (e) {
      el.value = "";
      showToast(e.message || "Upload failed — try again", "danger");
    }
  };

  const baseLogoUrl = Actions["logo-url-set"];
  Actions["logo-url-set"] = (el) => {
    if (!pictureLinkOk(el.value, currentLogo())) {
      el.value = currentLogo();
      showToast(PASTED_LINK_ERROR, "danger");
      return;
    }
    baseLogoUrl(el);
  };
})();

/* ---------------- 4. Categories and brands (P9-2) ---------------- */
(() => {
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const itemsIn = (category) => State.items.filter((i) => i.cat === category.name).length;
  const tilesFor = (category) =>
    State.homeSections.reduce((n, s) => n + (s.tiles || []).filter((t) => t.catId === category.id).length, 0);

  // The list: "3 items · 1 home-screen tile", so the admin sees why Delete may be refused.
  const baseCategories = adminCategories;
  window.adminCategories = () => {
    let html = baseCategories();
    for (const c of State.categories) {
      const tiles = tilesFor(c);
      if (tiles === 0) continue;
      const count = `<div class="admin-row-name">${esc(c.name)}</div><div class="qk-muted small">${itemsIn(c)} items`;
      html = html.replace(count, `${count} · ${plural(tiles, "home-screen tile", "home-screen tiles")}`);
    }
    return html;
  };

  // Delete: refused while products OR home-screen tiles use the category — the backend's 409 CATEGORY_IN_USE words.
  const baseDeleteCategory = Actions["delete-category"];
  Actions["delete-category"] = (el) => {
    const c = State.categories.find((x) => x.id === Number(el.dataset.id));
    const items = itemsIn(c);
    const tiles = tilesFor(c);
    if (items > 0 || tiles > 0) {
      const uses = [items > 0 ? plural(items, "product", "products") : null, tiles > 0 ? plural(tiles, "home-screen tile", "home-screen tiles") : null].filter(Boolean);
      const fix = [items > 0 ? "move the products to another category" : null, tiles > 0 ? "change the tiles on the Home Screen" : null].filter(Boolean);
      showToast(`This category is used by ${uses.join(" and ")} — ${fix.join(" and ")} first`, "danger");
      return;
    }
    baseDeleteCategory(el);
  };

  // Brands: the backend's 409 BRAND_IN_USE words.
  const baseDeleteBrand = Actions["delete-brand"];
  Actions["delete-brand"] = (el) => {
    const b = State.brands.find((x) => x.id === Number(el.dataset.id));
    const used = State.items.filter((i) => i.brand === b.name).length;
    if (used > 0) {
      showToast(`${plural(used, "product uses", "products use")} this brand — give ${used === 1 ? "it" : "them"} another brand first`, "danger");
      return;
    }
    baseDeleteBrand(el);
  };
})();

/* ---------------- 5. Products and stock (P9-3, P9-4, D79, D80) ---------------- */
(() => {
  /* F. The cost price when stock is received (D80): each business's own setting, average by default. */
  const COST_METHODS = [
    ["average", "Average", "The cost price becomes the average of the stock you hold (all stores) and the delivery — e.g. 10 at S$2.00 + 10 at S$2.40 → S$2.20.", true],
    ["last", "Last delivery's cost", "The cost price becomes the unit cost on the latest delivery.", false],
    ["manual", "Don't change it", "Receiving stock never changes the cost price; you type it on the product.", false],
  ];
  const costMethod = () => (State.deliverySettings && State.deliverySettings.costPriceMethod) || "average";

  function costMethodCardHTML(editable) {
    const current = costMethod();
    return `
  <div class="summary-card" style="max-width:560px;margin-top:14px">
    <div class="summary-card-title">Cost price when stock is received</div>
    ${COST_METHODS.map(([value, label, hint, recommended]) => `
    <label class="radio-card ${current === value ? "active" : ""}"><input type="radio" name="costMethod" value="${value}" ${current === value ? "checked" : ""} ${editable ? "" : "disabled"} />
      <span><b>${label}</b>${recommended ? ' <span class="badge badge-green-soft">Default</span>' : ""}<br><span class="qk-muted small">${hint}</span></span></label>`).join("")}
    <div class="qk-muted small" style="margin-top:6px">Only a delivery with a unit cost changes it, and every change is in the audit log.</div>
    ${editable ? `<button class="btn btn-primary btn-block" style="margin-top:12px" data-action="save-cost-method">Save</button>` : ""}
  </div>`;
  }

  // Right after "When stock runs out" (rounds 6 and 7 append their cards after it).
  const baseRules = window.adminStockRulesPanel;
  window.adminStockRulesPanel = (editable) => {
    const html = baseRules(editable);
    const anchor = /(data-action="save-stock-rules">Save<\/button>\s*<\/div>)/;
    return anchor.test(html) ? html.replace(anchor, (m) => m + costMethodCardHTML(editable)) : html + costMethodCardHTML(editable);
  };

  Actions["save-cost-method"] = () => {
    const picked = document.querySelector('input[name="costMethod"]:checked');
    const value = picked ? picked.value : "average";
    State.deliverySettings = { ...State.deliverySettings, costPriceMethod: value };
    persist("deliverySettings");
    showToast(`Cost price on receiving: ${COST_METHODS.find((m) => m[0] === value)[1].toLowerCase()}`);
    render();
  };

  /* G. Receive stock: the hint follows the setting; the cost follows the method; the product's supplier stays. */
  const RECEIVE_HINT = "The unit cost you enter becomes the product's cost price.";
  const receiveHint = () =>
    ({
      average: "The product's cost price becomes the average of the stock you hold and this delivery.",
      last: RECEIVE_HINT,
      manual: "The product's cost price is not changed — edit it on the product.",
    })[costMethod()] + " The product's own supplier stays as it is.";

  const baseMoveModal = window.stockMoveModal;
  window.stockMoveModal = (...args) => baseMoveModal(...args).replace(RECEIVE_HINT, receiveHint());

  /** What the business holds of an item across its stores (quantities above 0) — the average's weight. */
  const heldEverywhere = (itemId) =>
    State.branches.reduce((n, b) => n + Math.max(storeQty(b.id, itemId) || 0, 0), 0);

  /** D80, as the backend's cost-price.ts: nothing held or no cost yet → the unit cost. */
  function costAfter(item, qty, unitCost) {
    if (unitCost == null || costMethod() === "manual") return undefined;
    const held = heldEverywhere(item.id);
    const next = costMethod() === "last" || item.costPrice == null || held <= 0
      ? unitCost
      : round2((held * item.costPrice + qty * unitCost) / (held + qty));
    return next === item.costPrice ? undefined : next;
  }

  const baseSaveMove = Submits["save-stock-move"];
  Submits["save-stock-move"] = (form, ev) => {
    const m = UI.modal;
    const fd = new FormData(form);
    const itemId = Number(fd.get("itemId"));
    const item = findItem(itemId);
    const qty = Math.floor(Number(fd.get("qty")));
    const fail = (msg) => { UI.modal.error = msg; if (!m.itemId) UI.modal.itemId = itemId; render(); };

    if (m.mode === "adjust" && fd.get("reason") === "stocktake" && Number.isFinite(qty) && qty < 0) {
      return fail("A counted quantity can't be below 0"); // I. whatever the negative-stock rule
    }
    if (m.mode !== "receive") return baseSaveMove(form, ev);

    if (!item || !Number.isFinite(qty)) return fail("Enter a quantity");
    if (qty <= 0) return fail("Quantity must be more than 0");
    const unitCost = fd.get("unitCost") === "" ? null : Math.max(0, Number(fd.get("unitCost")) || 0);
    const supplierId = Number(fd.get("supplierId")) || null;
    const nextCost = costAfter(item, qty, unitCost); // before the receipt changes what is held
    recordStockMove({ branchId: m.branchId, itemId, type: "receive", qty, unitCost, supplierId, ref: String(fd.get("ref") || "").trim(), note: supplierId ? supplierName(supplierId) : "" });
    if (nextCost !== undefined) {
      State.items = State.items.map((i) => (i.id === itemId ? { ...i, costPrice: nextCost } : i));
      persist("items");
    }
    showToast(`Received ${qty} × ${item.name}${nextCost !== undefined ? ` — cost price now ${money(nextCost)}` : ""}`);
    UI.modal = null;
    render();
  };

  /* H. Deleting a product (D79): not while a store holds stock (above or below 0) or a combo contains it. */
  const baseDeleteItem = Actions["delete-item"];
  Actions["delete-item"] = (el) => {
    const item = findItem(Number(el.dataset.id));
    const holding = State.branches
      .map((b) => ({ name: b.name, qty: storeQty(b.id, item.id) || 0 }))
      .filter((s) => s.qty !== 0)
      .sort((x, y) => x.name.localeCompare(y.name));
    if (holding.length) {
      showToast(`${holding.map((s) => `${s.name} holds ${s.qty}`).join(" and ")} — sell or adjust the stock to 0 first, or switch the product off`, "danger");
      return;
    }
    const combos = State.homeSections
      .flatMap((s) => s.combos || [])
      .filter((c) => (c.itemIds || []).includes(item.id))
      .map((c) => c.title)
      .sort();
    if (combos.length) {
      const one = combos.length === 1;
      showToast(`${one ? "The combo" : `${combos.length} combos`} ${combos.map((c) => `"${c}"`).join(", ")} ${one ? "contains" : "contain"} this product — change ${one ? "it" : "them"} on the Home Screen first`, "danger");
      return;
    }
    baseDeleteItem(el);
    // Products that had it as their default substitute get none.
    if (!findItem(item.id) && State.items.some((i) => i.defaultSubstituteId === item.id)) {
      State.items = State.items.map((i) => (i.defaultSubstituteId === item.id ? { ...i, defaultSubstituteId: null } : i));
      persist("items");
    }
  };

  /* J. The product form: the brand from the list; description, HSN code and default substitute; cost may be blank. */
  const BRAND_FIELD = /<label class="field"><span class="field-label">Brand<\/span><input class="input" name="brand"[^>]*\/><\/label>/;
  const baseItemForm = window.itemFormModal;
  window.itemFormModal = (...args) => {
    const f = UI.modal.form;
    const brands = State.brands.slice().sort((a, b) => a.name.localeCompare(b.name));
    const others = State.items.filter((i) => i.id !== f.id).sort((a, b) => a.name.localeCompare(b.name));
    return baseItemForm(...args)
      .replace(BRAND_FIELD, `<label class="field"><span class="field-label">Brand</span><select class="input" name="brand"><option value="">— No brand —</option>${brands.map((b) => `<option ${f.brand === b.name ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select><span class="qk-muted small">Add a new brand in Masters ▸ Brands</span></label>`)
      .replace(/<datalist id="brandOptions">[^]*?<\/datalist>/, "")
      .replace('name="costPrice"', 'name="costPrice" placeholder="Not known yet"')
      .replace(
        '<div class="qk-muted small" style="margin:-4px 0 10px">Quantities are kept per store',
        `<div class="field-grid-2">
          <label class="field"><span class="field-label">HSN code</span><input class="input" name="hsnCode" value="${esc(f.hsnCode || "")}" placeholder="e.g. 0803.10 00 — printed on the invoice" /></label>
          <label class="field"><span class="field-label">Default substitute</span><select class="input" name="defaultSubstituteId"><option value="">— None —</option>${others.map((i) => `<option value="${i.id}" ${f.defaultSubstituteId === i.id ? "selected" : ""}>${esc(i.name)} (${esc(i.sku || "")})</option>`).join("")}</select></label>
        </div>
        <label class="field"><span class="field-label">Description</span><textarea class="input" name="description" rows="2" placeholder="Shown on the product page">${esc(f.description || "")}</textarea></label>
        <div class="qk-muted small" style="margin:-4px 0 10px">Quantities are kept per store`,
      );
  };

  const baseNewItem = Actions["new-item"];
  Actions["new-item"] = (...args) => {
    baseNewItem(...args);
    UI.modal.form = { ...UI.modal.form, costPrice: null, description: "", hsnCode: "", defaultSubstituteId: null };
    render();
  };

  /* K. Saving a product: the backend's checks first, then the new fields. */
  const baseSaveItem = Submits["save-item"];
  Submits["save-item"] = (form, ev) => {
    const fd = new FormData(form);
    const f = UI.modal.form;
    const mrp = Number(fd.get("mrp")) || 0;
    const price = Number(fd.get("price")) || 0;
    if (price > mrp) {
      showToast(`The selling price can't be above the MRP (${money(mrp)})`, "danger");
      return;
    }
    const barcode = String(fd.get("barcode") || "").trim();
    if (barcode && State.items.some((i) => i.id !== f.id && (i.barcode || "").toLowerCase() === barcode.toLowerCase())) {
      showToast("Another product already uses this barcode", "danger");
      return;
    }
    const hsnCode = String(fd.get("hsnCode") || "").replace(/[\s.]/g, "");
    if (hsnCode && !/^[0-9]{4,10}$/.test(hsnCode)) {
      showToast("HSN code: 4 to 10 digits", "danger");
      return;
    }
    const costBlank = String(fd.get("costPrice") || "").trim() === "";
    const sku = String(fd.get("sku") || "").trim().toLowerCase();
    const extra = {
      description: String(fd.get("description") || "").trim() || null,
      hsnCode: hsnCode || null,
      defaultSubstituteId: Number(fd.get("defaultSubstituteId")) || null,
    };
    baseSaveItem(form, ev);
    if (UI.modal && UI.modal.type === "itemForm") return; // refused (e.g. the SKU) — the form stays open
    State.items = State.items.map((i) =>
      (i.sku || "").toLowerCase() === sku ? { ...i, ...extra, ...(costBlank ? { costPrice: null } : {}) } : i,
    );
    persist("items");
    render();
  };

  /* L. The Catalogue: no cost price → "—" for cost and margin; it sorts as the lowest margin, as the backend does. */
  const baseFiltered = window.catalogueFiltered;
  window.catalogueFiltered = () => {
    const list = baseFiltered();
    const sort = F("catalog").sort;
    if (sort !== "marginAsc" && sort !== "marginDesc") return list;
    const margin = (i) => (i.costPrice == null || !i.price ? -Infinity : (i.price - i.costPrice) / i.price);
    return list.slice().sort((a, b) => (sort === "marginAsc" ? margin(a) - margin(b) : margin(b) - margin(a)));
  };

  const baseResults = window.catalogueResultsHTML;
  window.catalogueResultsHTML = () => {
    const html = baseResults();
    const unknown = State.items.filter((i) => i.costPrice == null);
    if (!unknown.length) return html;
    const blank = `Cost ${money(0)} · <span class="">Margin 100%</span>`;
    return html
      .split('<div class="admin-row">')
      .map((row) => {
        const item = unknown.find((i) => row.includes(`<div class="admin-row-name">${esc(i.name)}</div>`) && row.includes(`${esc(i.sku || "")} · `));
        return item ? row.replace(blank, 'Cost — · <span class="qk-muted">Margin —</span>') : row;
      })
      .join('<div class="admin-row">');
  };
})();

/* ---------------- 6. What's changed ---------------- */
WHATS_NEW.unshift({ area: "Picture uploads, categories & brands, products & stock (round 10)", items: [
  ["Upload from device", "Every image field — products, categories, the home screen's sections, tiles, combos and promo sections, promotions — has an Upload button next to the Image URL box. Pick a photo: it is shrunk to 1200 px, shows in the preview at once and is saved with the form."],
  ["Picture rules", "JPEG, PNG or WebP only (never SVG), at most 2 MB after shrinking — anything else gets a message and nothing changes. The logo's device upload follows the same rules now (it was any image type up to 500 KB)."],
  ["Or paste a link", "The Image URL box still takes a link to a picture on the web, but it must start with https://. Pictures already saved are not affected."],
  ["New promotion fixed", "Marketing ▸ Promotions ▸ New promotion opened a blank page; it opens the form now, and a promotion saved without a picture gets one of the default banners."],
  ["Categories in use", "Masters ▸ Categories: a category that a home-screen tile opens can't be deleted either (the tile would lead nowhere) — the row shows \"· 1 home-screen tile\", and Delete says what to change first. Brands and categories with products say how many, as the real app will."],
  ["Cost price on receiving", "Setup ▸ Business Settings ▸ Stock Rules: how receiving stock updates a product's cost price — Average (the default: what you hold and what arrived, weighted), Last delivery's cost, or Don't change it."],
  ["Receive stock", "The hint under the unit cost follows that setting and the toast shows the new cost price. Receiving from a supplier no longer changes the product's own supplier."],
  ["Deleting a product", "Masters ▸ Catalogue: a product can't be deleted while any store still holds stock (above or below zero — adjust it to 0 first, or switch the product off) or while a combo contains it; the message names the stores or combos."],
  ["Product form", "The brand is picked from the Brands list (add new brands in Masters ▸ Brands). New boxes: Description, HSN code, Default substitute. The cost price can be left blank — cost and margin then show “—”. A price above the MRP, a barcode another product has, or an HSN code that isn't 4–10 digits is refused."],
  ["Stock take", "Masters ▸ Stock ▸ Adjust ▸ Stock take: the counted quantity can't be below 0, whatever the negative-stock rule."],
] });
