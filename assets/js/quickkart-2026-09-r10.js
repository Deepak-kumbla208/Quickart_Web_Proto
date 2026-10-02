/* ====================================================================
   QuickKart prototype — Round 10 (2 October 2026): picture uploads (P9-1,
   MR !72, D77) and Categories / Brands (P9-2, MR !73), as the backend
   built them on quickkart-api-service. Every change of the day is here.

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

/* ---------------- 5. What's changed ---------------- */
WHATS_NEW.unshift({ area: "Picture uploads, categories & brands (round 10)", items: [
  ["Upload from device", "Every image field — products, categories, the home screen's sections, tiles, combos and promo sections, promotions — has an Upload button next to the Image URL box. Pick a photo: it is shrunk to 1200 px, shows in the preview at once and is saved with the form."],
  ["Picture rules", "JPEG, PNG or WebP only (never SVG), at most 2 MB after shrinking — anything else gets a message and nothing changes. The logo's device upload follows the same rules now (it was any image type up to 500 KB)."],
  ["Or paste a link", "The Image URL box still takes a link to a picture on the web, but it must start with https://. Pictures already saved are not affected."],
  ["New promotion fixed", "Marketing ▸ Promotions ▸ New promotion opened a blank page; it opens the form now, and a promotion saved without a picture gets one of the default banners."],
  ["Categories in use", "Masters ▸ Categories: a category that a home-screen tile opens can't be deleted either (the tile would lead nowhere) — the row shows \"· 1 home-screen tile\", and Delete says what to change first. Brands and categories with products say how many, as the real app will."],
] });
