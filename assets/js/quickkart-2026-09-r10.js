/* ====================================================================
   QuickKart prototype — Round 10 (2 October 2026): picture uploads, as
   the backend built them (P9-1, MR !72 on quickkart-api-service, D77).

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

/* ---------------- 4. What's changed ---------------- */
WHATS_NEW.unshift({ area: "Picture uploads (round 10)", items: [
  ["Upload from device", "Every image field — products, categories, the home screen's sections, tiles, combos and promo sections, promotions — has an Upload button next to the Image URL box. Pick a photo: it is shrunk to 1200 px, shows in the preview at once and is saved with the form."],
  ["Picture rules", "JPEG, PNG or WebP only (never SVG), at most 2 MB after shrinking — anything else gets a message and nothing changes. The logo's device upload follows the same rules now (it was any image type up to 500 KB)."],
  ["Or paste a link", "The Image URL box still takes a link to a picture on the web, but it must start with https://. Pictures already saved are not affected."],
  ["New promotion fixed", "Marketing ▸ Promotions ▸ New promotion opened a blank page; it opens the form now, and a promotion saved without a picture gets one of the default banners."],
] });
