/* ====================================================================
   Round 22 (2026-10-27) — the Unit list from the API, and Home Screen under Setup.

   Backend: D127 (f), FX-2 (MR !145, in review) — GET /admin/products/units answers the seven units a product's
   `unit` accepts, in list order, each with label, plural, whole / decimals and min / max, plus the Pack of range.

   Admin:  Catalogue ▸ product form — the chosen unit's amounts show under Pack size as soon as it is picked, with
           "Shown as …" while typing; a pack size the API would refuse shows its reason in red under the field (the
           API's errors.unit words), not a toast. Builds on round 21's Pack of + Amount + Unit control.
           The menu — Home Screen moves from Marketing to Setup (after Business Settings); Marketing keeps Coupons.

   Later the same day — free express above a limit. Backend: D129, FX-3 (MR !146, in review; customer contract
   0.27.0-draft) — business_settings.free_express_threshold, admin delivery.freeExpressThreshold, the bill's
   freeExpressThreshold / amountToFreeExpress.
   Admin:    Business Settings ▸ Express Delivery — "Free express above (S$)" under the charge; empty = always charged.
   Customer: express is free once the items after the coupon reach it (like free delivery, its own amount); cart and
             checkout say "Add S$x more for free express".
   Then (D130, the same MR): an express order pays the express price INSTEAD OF the delivery fee — one delivery
             line; a free-delivery coupon is not applied to express; the demo shop's express = its fee + its old extra.
   ==================================================================== */
(function round22UnitsAndMenu() {
  /* ---------------- 1. The list as GET /admin/products/units answers it (D127 f) ---------------- */
  const UNITS_API = {
    units: [
      { code: "g", label: "g", plural: "g", whole: true, decimals: 0, min: 1, max: 9999 },
      { code: "kg", label: "kg", plural: "kg", whole: false, decimals: 3, min: 0.01, max: 100 },
      { code: "ml", label: "ml", plural: "ml", whole: true, decimals: 0, min: 1, max: 9999 },
      { code: "l", label: "L", plural: "L", whole: false, decimals: 3, min: 0.01, max: 100 },
      { code: "pc", label: "pc", plural: "pc", whole: true, decimals: 0, min: 1, max: 1000 },
      { code: "pack", label: "pack", plural: "packs", whole: true, decimals: 0, min: 1, max: 100 },
      { code: "bunch", label: "bunch", plural: "bunches", whole: true, decimals: 0, min: 1, max: 20 },
    ],
    packCount: { min: 2, max: 99 },
  };
  const PACK = UNITS_API.packCount;
  const num = (n) => n.toLocaleString("en-GB");
  const unitOf = (label) => UNITS_API.units.find((u) => u.label === label) || null;
  // The API's own words (the 422 on errors.unit), so the form and the API say the same thing.
  const rangeText = (u) =>
    u.whole
      ? `${u.label}: a whole number from ${num(u.min)} to ${num(u.max)}`
      : `${u.label}: from ${u.min} to ${num(u.max)}, up to ${u.decimals} decimals`;

  // The standard form, or the reason the API would refuse it and the box to point at.
  function check(packTyped, amount, label) {
    const u = unitOf(label);
    if (!u) return { error: "Unit: choose one from the list", field: "unitKind" };
    const m = /^\d+(?:\.(\d+))?$/.exec(amount);
    if (!m || (m[1] || "").replace(/0+$/, "").length > u.decimals) return { error: rangeText(u), field: "unitAmount" };
    const n = Number(amount);
    if (n < u.min || n > u.max) return { error: rangeText(u), field: "unitAmount" };
    const pack = packTyped === "1" ? "" : packTyped; // 1 is the same as none, as the API reads it
    if (pack && (!/^\d+$/.test(pack) || Number(pack) < PACK.min || Number(pack) > PACK.max)) {
      return { error: `Pack of: ${PACK.min} to ${PACK.max} — leave it empty for one`, field: "unitPack" };
    }
    return { text: `${pack ? `${Number(pack)} x ` : ""}${n} ${n === 1 ? u.label : u.plural}` };
  }

  /* ---------------- 2. The product form: limits on screen, the reason under the field ---------------- */
  const HINT = '<span class="qk-muted small r21-hint">Saved as e.g.';
  const formBefore = window.itemFormModal;
  window.itemFormModal = (...args) => {
    const html = formBefore(...args);
    if (!html.includes('name="unitKind"')) return html;
    setTimeout(() => {
      const kind = document.querySelector('form [name="unitKind"]');
      if (kind) refresh(kind.form, false);
    }, 0);
    return html
      .replace('name="unitKind"', () => 'name="unitKind" data-action="r22-unit-kind"')
      .replace(HINT, () => `<span class="small r21-hint" data-r22-range></span><div class="field-error" style="margin:4px 0 2px" data-r22-unit-error hidden></div>${HINT}`);
  };

  function setError(form, res) {
    const box = form.querySelector("[data-r22-unit-error]");
    ["unitPack", "unitAmount", "unitKind"].forEach((name) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el) el.classList.toggle("invalid", !!res && res.field === name);
    });
    if (!box) return;
    box.hidden = !res;
    box.textContent = res ? res.error : "";
  }

  function refresh(form, edited) {
    if (!form) return;
    const kind = form.querySelector('[name="unitKind"]');
    const amount = form.querySelector('[name="unitAmount"]');
    const pack = form.querySelector('[name="unitPack"]');
    const range = form.querySelector("[data-r22-range]");
    if (!kind || !amount || !pack || !range) return;
    const u = unitOf(kind.value);
    if (u) {
      amount.setAttribute("inputmode", u.whole ? "numeric" : "decimal");
      amount.placeholder = u.whole ? `${num(u.min)}–${num(u.max)}` : "e.g. 1.5";
    }
    const res = check(pack.value.trim(), amount.value.trim(), kind.value);
    const shown = res.text ? ` · Shown as “${res.text}”` : "";
    range.textContent = u
      ? `${rangeText(u)} · Pack of ${PACK.min}–${PACK.max}, empty for one${shown}`
      : "Choose a unit to see the amounts it takes.";
    if (edited) setError(form, null);
  }

  Actions["r22-unit-kind"] = (el) => refresh(el.form, true);
  document.body.addEventListener("input", (ev) => {
    if (["unitAmount", "unitPack"].includes(ev.target.name)) refresh(ev.target.form, true);
  });

  const saveBefore = Submits["save-item"];
  Submits["save-item"] = (form, ev) => {
    if (form.querySelector('[name="unitKind"]')) {
      const res = check(
        String(form.querySelector('[name="unitPack"]').value || "").trim(),
        String(form.querySelector('[name="unitAmount"]').value || "").trim(),
        String(form.querySelector('[name="unitKind"]').value || ""),
      );
      if (res.error) {
        setError(form, res);
        const bad = form.querySelector(`[name="${res.field}"]`);
        if (bad) bad.focus();
        return;
      }
    }
    return saveBefore(form, ev);
  };

  /* ---------------- 3. The menu: Home Screen under Setup ---------------- */
  const marketing = ADMIN_NAV.find((n) => n.group === "marketing");
  const setup = ADMIN_NAV.find((n) => n.group === "setup");
  if (marketing && setup && !setup.keys.includes("homeScreen")) {
    marketing.keys = marketing.keys.filter((k) => k !== "homeScreen");
    setup.keys.splice(setup.keys.indexOf("tax") + 1, 0, "homeScreen");
    reorderAdminScreens();
  }
  // Round 21's "tag in use" message names where to change it.
  const deleteTagBefore = Actions["r21-delete-tag"];
  if (deleteTagBefore) {
    Actions["r21-delete-tag"] = (el, ev) => {
      deleteTagBefore(el, ev);
      if (UI.modal && typeof UI.modal.html === "string" && UI.modal.html.includes("Marketing ▸ Home Screen")) {
        UI.modal.html = UI.modal.html.split("Marketing ▸ Home Screen").join("Setup ▸ Home Screen");
        render();
      }
    };
  }

  /* ---------------- 4. What's changed ---------------- */
  WHATS_NEW.unshift({ area: "Round 22 — the Unit list from the API (D127 f, FX-2), Home Screen under Setup, express instead of the delivery fee and free above a limit (D130, D129, FX-3)", items: [
    ["Express is its own delivery price (D130)", "An express order now pays the express price instead of the delivery fee — not both. The bill has one delivery line, “Express delivery S$x”; scheduled orders pay the delivery fee as before, pickup neither. Business Settings ▸ Express Delivery calls it “Express delivery price”, and every shop's express price became its delivery fee + its old extra, so nothing got cheaper or free overnight (the demo shop: S$4.90 + S$2.50 = S$7.40). A free-delivery coupon is for scheduled delivery: on an express order it shows “not applied” with the reason. API: deliveryFee “0.00” and expressCharge the price on an express bill (customer contract 0.27.0-draft)."],
    ["Free express above a limit (admin)", "Setup ▸ Business Settings ▸ Delivery & Payments ▸ Express Delivery has a new box, “Free express above (S$)”. An express order whose items (after the coupon — the same measure as free delivery) reach it pays no express charge. Empty = express is always charged, which is how every shop starts. It is its own amount, separate from “Free delivery above”. 0–100 000; a wrong value shows its reason in red under the box. API: delivery.freeExpressThreshold on GET / PATCH /admin/settings (null clears it)."],
    ["Free express in the cart and checkout (customer)", "With Express chosen, the cart and checkout say “Add S$x more for free express” with a progress bar, like the free-delivery one; once reached the Express choice reads “Express delivery · Free” and the bill has no express charge (and no GST on it). The free-delivery limit never makes express free. API: the bill's freeExpressThreshold and amountToFreeExpress (customer contract 0.27.0-draft) — show what the API sends, never work it out in the app."],
    ["Home Screen is under Setup", "The Home Screen (sections, slides, combos, theme & branding) moved from Marketing to Setup ▸ Home Screen, right after Business Settings. Marketing now holds Coupons. Nothing else changes — the same page, and the same Home Screen permission."],
    ["Each unit's amounts on screen", "Catalogue ▸ product form: as soon as a Unit is picked, the line under Pack size says what it takes — “kg: from 0.01 to 100, up to 3 decimals”, “pc: a whole number from 1 to 1,000” — plus “Shown as “6 x 325 ml”” while typing. The list and every limit come from GET /admin/products/units (D127 f): load it when the form opens instead of keeping a copy in the app."],
    ["A refused pack size is explained under the field", "A pack size the API would refuse no longer ends in a toast: the reason shows in red under Pack size and the box is outlined — the API's own words from errors.unit. The admin app should do the same instead of showing “Request validation failed”."],
  ] });
})();

/* ---------------- Later the same day: free express above a limit (backend D129, FX-3, MR !146) ---------------- */
(function round22FreeExpress() {
  const LIMIT_MAX = 100000;

  // null = express is never free — the default, so nothing changes until a shop sets one (API: delivery.freeExpressThreshold).
  window.freeExpressLimit = () => {
    const v = State.deliverySettings.freeExpressThreshold;
    return v === null || v === undefined || v === "" ? null : round2(Number(v));
  };
  // The limit as the bill reports it: only when it can be earned — express on, charged and limited.
  const earnableLimit = () => (expressEnabled() && expressChargeAmount() > 0 ? freeExpressLimit() : null);
  // The same test the bill uses for charging express at all.
  const wantsExpress = () => UI.fulfillment !== "pickup" && UI.deliverySpeed === "express" && expressEnabled();
  // The API's own words (D130 c)
  const FREESHIP_NOT_FOR_EXPRESS = "Free-delivery coupons are for scheduled delivery — choose a delivery slot or remove the coupon";

  /* 0. D130 b: the demo shop's express price becomes its delivery fee + its old extra — once per browser, as the
        backend's migration did for every shop. */
  if (!loadLS("migrated_2026_10_r22_d130", false)) {
    const d = State.deliverySettings;
    State.deliverySettings = { ...d, expressCharge: round2((Number(d.deliveryFee) || 0) + (Number(d.expressCharge) || 0)) };
    persist("deliverySettings");
    saveLS("migrated_2026_10_r22_d130", true);
  }

  /* 1. The bill (D130): an express delivery pays the express charge INSTEAD OF the delivery fee — the earlier
        rounds' totals are re-run with the fee at 0. Free from the limit (D129), measured on the items after the
        coupon (like free delivery); the free-delivery limit never frees it, and a free-delivery coupon does not
        apply to it. Round 7's GST on the delivery charges follows whatever is charged. */
  const totals = cartTotals;
  window.cartTotals = () => {
    const limit = earnableLimit();
    const express = wantsExpress();
    const settings = State.deliverySettings;
    const charge = window.expressChargeAmount;
    let t;
    try {
      if (express) State.deliverySettings = { ...settings, deliveryFee: 0 };
      t = totals();
      if (limit !== null && t.expressCharge > 0 && t.priceAfterCoupon >= limit) {
        window.expressChargeAmount = () => 0;
        t = totals();
      }
    } finally {
      State.deliverySettings = settings;
      window.expressChargeAmount = charge;
    }
    if (express && t.couponValid && t.appliedCoupon && t.appliedCoupon.type === "freeship") {
      // No delivery fee to remove: not applied, with the reason (the API answers coupon.applied: false)
      t.couponValid = false;
      t.couponFreeShip = false;
      t.couponCheck = { ok: false, reason: FREESHIP_NOT_FOR_EXPRESS };
    }
    t.freeExpressThreshold = limit;
    t.amountToFreeExpress = limit === null ? 0 : Math.max(0, round2(limit - t.priceAfterCoupon));
    return t;
  };

  const nudge = (t) => `
    <div class="free-delivery-nudge">
      <div>Add ${money(t.amountToFreeExpress)} more for free express</div>
      <div class="progress-track"><div class="progress-fill" style="width:${t.freeExpressThreshold > 0 ? Math.min(100, (t.priceAfterCoupon / t.freeExpressThreshold) * 100) : 100}%"></div></div>
    </div>`;
  // One delivery line on an express order (D130): "Express delivery S$x" (or FREE) in place of "Delivery fee FREE".
  const FEE_FREE_ROW = '<div class="summary-row"><span>Delivery fee</span><span class="qk-num">FREE</span></div>';
  const chargeRow = (t) => `<div class="summary-row"><span>Express delivery charge</span><span class="qk-num">${money(t.expressCharge)}</span></div>`;
  const expressRow = (t) => `<div class="summary-row"><span>Express delivery</span><span class="qk-num">${t.expressCharge > 0 ? money(t.expressCharge) : "FREE"}</span></div>`;
  const oneDeliveryRow = (html, t) =>
    wantsExpress() ? html.replace(chargeRow(t), () => "").replace(FEE_FREE_ROW, () => expressRow(t)) : html;

  /* 2. Cart: one delivery line; the express hint where the free-delivery one would be (that bar is for scheduled
        delivery, and shows only while a delivery fee is charged). */
  const cart = viewCart;
  window.viewCart = (...args) => {
    const t = cartTotals();
    const html = oneDeliveryRow(cart(...args), t);
    if (t.freeExpressThreshold === null || !wantsExpress() || !(t.amountToFreeExpress > 0)) return html;
    const aside = html.indexOf('<aside class="cart-summary-col">');
    const at = aside < 0 ? -1 : html.indexOf('<div class="summary-card">', aside);
    return at < 0 ? html : `${html.slice(0, at)}${nudge(t)}${html.slice(at)}`;
  };

  /* 3. Checkout: the Express choice shows its price (not "+"), "Free" once the limit is reached; the hint under it
        until then; one delivery line in the order summary. */
  const checkout = viewCheckout;
  window.viewCheckout = (...args) => {
    const t = cartTotals();
    let html = oneDeliveryRow(checkout(...args), t);
    const limit = t.freeExpressThreshold;
    const charge = money(expressChargeAmount());
    const note = `Express adds ${charge} to the delivery fee.</div>`;
    const free = limit !== null && t.amountToFreeExpress === 0;
    html = html.replace(`Express delivery · +${charge}`, () => (free ? "Express delivery · Free" : `Express delivery · ${charge}`));
    if (free) {
      return html.replace(note, () => (limit > 0 ? `Express is free on orders from ${money(limit)} — this one qualifies.</div>` : "Express is free on every order.</div>"));
    }
    const instead = `Express costs ${charge} — instead of the delivery fee.</div>`;
    return html.replace(note, () => (limit !== null ? `${instead}<div style="margin-top:8px">${nudge(t)}</div>` : instead));
  };

  /* 4. Admin: "Free express above (S$)" in the Express Delivery card, saved with it. */
  AUDIT_FIELD_LABEL["delivery.freeExpressThreshold"] = "Free express above";
  const card = adminExpressCard;
  window.adminExpressCard = (editable) => {
    const html = card(editable)
      // D130: the express charge is the price of an express delivery, instead of the delivery fee
      .replace(
        "The charge is added <b>on top of</b> the delivery fee and is not waived by free delivery or a free-delivery coupon.",
        () => "Express orders pay this price <b>instead of</b> the delivery fee. It is not waived by free delivery or a free-delivery coupon — only by your own <b>Free express above</b> amount.",
      )
      .replace('<span class="field-label">Express charge (S$)</span>', () => '<span class="field-label">Express delivery price (S$)</span>');
    const input = html.indexOf('id="expressChargeInput"');
    const end = input < 0 ? -1 : html.indexOf("</label>", input);
    if (end < 0) return html;
    const limit = freeExpressLimit();
    const field = `
    <label class="field"><span class="field-label">Free express above (S$)</span><input class="input" id="freeExpressInput" type="number" min="0" max="${LIMIT_MAX}" step="0.01" placeholder="Never free" value="${limit === null ? "" : limit}" ${editable ? "" : "disabled"} /></label>
    <div class="field-error" style="margin:-4px 0 6px" data-r22-free-express-error hidden></div>
    <div class="qk-muted small" style="margin:-2px 0 10px">Orders from this amount — the items after the coupon, measured like free delivery — pay no express charge. Leave empty to always charge express. Separate from “Free delivery above”.</div>`;
    return `${html.slice(0, end + "</label>".length)}${field}${html.slice(end + "</label>".length)}`;
  };

  // The Delivery Fee card says the fee is for scheduled orders (D130)
  const deliveryPanel = adminDeliveryPanel;
  window.adminDeliveryPanel = (editable) =>
    deliveryPanel(editable).replace(
      "Charged on delivery orders below the free-delivery threshold. Pickup orders are never charged a delivery fee.",
      () => "Charged on <b>scheduled</b> delivery orders below the free-delivery threshold. Express orders pay the express price instead (Express Delivery card); pickup orders pay neither.",
    );

  const saveExpress = Actions["save-express"]; // Round 11's audited save: the switch and the charge
  Actions["save-express"] = (...args) => {
    const input = document.getElementById("freeExpressInput");
    const box = document.querySelector("[data-r22-free-express-error]");
    const raw = input ? input.value.trim() : "";
    const value = Number(raw);
    const problem = raw === "" ? null : !(value >= 0) ? 'Must be an amount, such as "60.00"' : value > LIMIT_MAX ? `Must be at most S$${LIMIT_MAX}` : null;
    if (problem) {
      if (input) input.classList.add("invalid");
      if (box) { box.hidden = false; box.textContent = problem; }
      return;
    }
    const before = freeExpressLimit();
    const next = raw === "" ? null : round2(value);
    const topId = (State.auditEvents[0] || {}).id;
    saveExpress(...args);
    if (next === before) return;
    State.deliverySettings = { ...State.deliverySettings, freeExpressThreshold: next };
    persist("deliverySettings");
    // One audit entry per save, as the API writes it: join the one Round 11 just wrote, or write one.
    const top = State.auditEvents[0];
    const change = { before: { "delivery.freeExpressThreshold": before }, after: { "delivery.freeExpressThreshold": next } };
    if (top && top.id !== topId && top.action === "business_settings.updated") {
      top.before = { ...(top.before || {}), ...change.before };
      top.after = { ...(top.after || {}), ...change.after };
      persist("auditEvents");
    } else if (currentUser()) {
      addAuditEvent({ action: "business_settings.updated", entity: "business_settings", entityId: null, actorType: "user", actorId: currentUser().id, ...change });
    }
    showToast(`Express delivery ${expressEnabled() ? `on · ${money(expressChargeAmount())}` : "off"} · ${next === null ? "always charged" : `free from ${money(next)}`}`);
    render();
  };
})();
