/* ====================================================================
   QuickKart prototype — Round 19 (22 October 2026): COMBOS ONLY WHEN
   CHOSEN (backend decision D122, phase P21-1, MR !137; customer
   contract 0.24.0-draft).

   The TL's rule: a combo should count only when the customer adds the
   combo itself; the same products added one by one stay plain lines at
   full price. The backend built it as a PER-SHOP MODE, so the automatic
   rule of Round 13 stays and a shop can switch back with one setting:
   `business_settings.combo_pricing` = chosen (the default for every
   business) | automatic.

   A. Setup ▸ Business Settings ▸ Delivery & Payments ▸ a "Combos" card
      right after Order rules: "Only when the customer adds the combo"
      (default) / "Whenever all its products are in the cart". Saved like
      the other cards (PATCH /admin/settings { combos: { pricing } }),
      audited as combos.pricing.

   B. The customer cart follows the setting. In "chosen" the cart
      remembers which combos were added AS combos — the real app's
      `cart_combos`, filled by POST /customer/cart/combos with the combo
      id: "Add combo" and the bundle − / + change that choice; products
      added one by one never form a bundle; a chosen combo never claims
      more bundles than its products' lines hold (lowered when a line is
      lowered, forgotten when a product leaves or the shop deletes the
      combo). The home card's stepper, the bill, the limit notices and
      the order's record all read the one allocation (r13
      `comboAllocation`, which now takes the chosen numbers from
      `comboChosenSets()` — edited where it lives, as Rounds 16–18 edited
      earlier files).

   C. Under the cart lines, in "chosen": a combo whose every product is
      in the cart but which was not added as a combo gets a note with an
      "Add it as a combo" button — one more of each product goes in as
      the bundle; a loose unit stays loose, as the backend does. The
      "Add X to complete the combo" hints of Round 13 show only in
      "automatic", where adding the product does complete it.

   D. NOT modelled: a guest's combos[] on the merge and on the pricing
      call (the prototype has one cart); nothing for the rider.
   ==================================================================== */

/* ---------------- A. The setting: Business Settings ▸ Delivery & Payments ▸ Combos ---------------- */
(() => {
  const MODES = [
    ["chosen", "Only when the customer adds the combo", "the home screen's \"Add combo\" (and the combo row's +) earns the bundle price. The same products added one by one stay separate lines at full price.", true],
    ["automatic", "Whenever all its products are in the cart", "every complete bundle earns the bundle price by itself, however the products got there — the rule before this setting existed.", false],
  ];
  if (!State.businessRules.comboPricing) State.businessRules.comboPricing = "chosen";
  window.comboPricingMode = () => (businessRules().comboPricing === "automatic" ? "automatic" : "chosen");
  const modeLabel = (value) => MODES.find((m) => m[0] === value)[1];

  function combosCardHTML(editable) {
    const mode = comboPricingMode();
    return `
  <div class="summary-card" style="max-width:560px; margin-top:16px">
    <div class="summary-card-title">Combos</div>
    <div class="qk-muted small">When a combo's bundle price applies in the customer's cart. A change reaches every cart at its next price check.</div>
    ${MODES.map(([value, label, hint, isDefault]) => `
    <label class="stock-toggle-lg" style="margin-top:10px"><input type="radio" name="comboPricing" value="${value}" ${mode === value ? "checked" : ""} ${editable ? "" : "disabled"} /><span><b>${label}</b>${isDefault ? ' <span class="badge badge-green-soft">Default</span>' : ""} <span class="qk-muted small">— ${hint}</span></span></label>`).join("")}
    <div class="qk-muted small" style="margin-top:6px">Either way the order, the invoice and the picking slip list the products, and a combo's own limit still applies. Switching back loses nothing — bundles already chosen are simply ignored.</div>
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-combo-pricing">Save</button>` : ""}
  </div>`;
  }

  // Right after Order rules (r11), where the other cart rules live; at the end when that card has no Save (view only).
  const panel = window.adminDeliveryPanel;
  window.adminDeliveryPanel = (editable) => {
    const html = panel(editable);
    const anchor = /(data-action="save-order-rules">Save<\/button>\s*<\/div>)/;
    return anchor.test(html) ? html.replace(anchor, (m) => m + combosCardHTML(editable)) : html + combosCardHTML(editable);
  };

  Object.assign(AUDIT_FIELD_LABEL, { "combos.pricing": "Combo pricing" });
  Actions["save-combo-pricing"] = () => {
    const picked = document.querySelector('input[name="comboPricing"]:checked');
    const value = picked ? picked.value : "chosen";
    const before = comboPricingMode();
    State.businessRules = { ...businessRules(), comboPricing: value };
    persist("businessRules");
    const actor = currentUser();
    if (actor && before !== value) {
      addAuditEvent({
        action: "business_settings.updated", entity: "business_settings", entityId: null, actorType: "user", actorId: actor.id,
        before: { "combos.pricing": before }, after: { "combos.pricing": value },
      });
    }
    showToast(`Combos: ${modeLabel(value).toLowerCase()}`);
    render();
  };
})();

/* ---------------- B. The customer cart: which combos were added as combos ---------------- */
(() => {
  // The real app's cart remembers the choice (cart_combos: combo → bundles); a guest's device cart keeps the same.
  State.comboChoices = loadLS("comboChoices", {});
  const choices = () => State.comboChoices || (State.comboChoices = {});
  const choose = (comboId, delta) => {
    const next = (choices()[comboId] || 0) + delta;
    if (next <= 0) delete choices()[comboId]; else choices()[comboId] = next;
    persist("comboChoices");
  };

  // The ceiling the allocation (r13) takes per combo in "chosen" mode; null = automatic. A choice the cart can no longer
  // hold is lowered or forgotten here — the backend trims cart_combos the same way on every read: a member line lowered
  // → fewer bundles; a member removed, or the combo gone from the shop → no bundle, and the other units stay.
  window.comboChosenSets = function comboChosenSets() {
    if (comboPricingMode() !== "chosen") return null;
    const live = Object.fromEntries(allCombos().map((c) => [c.id, c]));
    let changed = false;
    Object.keys(choices()).forEach((id) => {
      const combo = live[id];
      const complete = combo && combo.itemIds.length
        ? Math.min(...combo.itemIds.map((pid) => (State.cart[pid] > 0 && findItem(Number(pid)) ? State.cart[pid] : 0)))
        : 0;
      if (complete < choices()[id]) {
        if (complete < 1) delete choices()[id]; else choices()[id] = complete;
        changed = true;
      }
    });
    if (changed) persist("comboChoices");
    return { ...choices() };
  };

  // "Add combo" and the bundle − / + change the choice first, then do what Round 13 did (add or remove one of every
  // product, and render) — so the row drawn is the row the backend would answer with.
  const comboExists = (el) => allCombos().some((c) => c.id === el.dataset.id);
  const addComboBefore = Actions["add-combo"];
  Actions["add-combo"] = (el) => { if (comboExists(el)) choose(el.dataset.id, +1); addComboBefore(el); };
  const incBefore = Actions["inc-combo"];
  Actions["inc-combo"] = (el) => { if (comboExists(el)) choose(el.dataset.id, +1); incBefore(el); };
  const decBefore = Actions["dec-combo"];
  Actions["dec-combo"] = (el) => { if (comboExists(el)) choose(el.dataset.id, -1); decBefore(el); };

  /* C. Under the lines: the limit notices as Round 13 wrote them, then — in "chosen" — the combos the customer could
     have had: every product is in the cart, but not as a combo. The "Add X to complete the combo" hint stays automatic-only. */
  const nudgeBefore = window.comboNudgeHTML;
  window.comboNudgeHTML = function comboNudgeHTMLR19() {
    if (comboPricingMode() !== "chosen") return nudgeBefore();
    const { notices } = comboAllocation();
    const limits = notices
      .map((n) => `<div class="notice notice-warn combo-nudge" data-combo-notice="${esc(n.combo.id)}">${ic("alert")}<span>${esc(n.message)} — ${n.earned > 0 ? "the extra bundles are charged at full price" : "no combo discount this time"}. You can still place the order.</span></div>`)
      .join("");
    const picked = choices();
    const offers = allCombos()
      .filter((c) => !picked[c.id] && c.itemIds.length && comboSavings(c) > 0 && c.itemIds.every((id) => (State.cart[id] || 0) >= 1))
      .map((c) => `
    <div class="notice notice-warn combo-nudge" data-combo-offer="${esc(c.id)}">
      ${ic("sparkle")}
      <span>You added every product of the <b>${esc(c.title)}</b> one by one, so they are charged separately.
        <button class="link-btn" data-action="add-combo" data-id="${esc(c.id)}">Add it as a combo</button> to save ${money(comboSavings(c))} — one more of each product goes in as the bundle.</span>
    </div>`)
      .join("");
    return limits + offers;
  };
})();

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Round 19 — combos only when chosen (D122)", items: [
  ["A combo counts only when it is added as a combo", "New rule, on for every business: the bundle price applies only to combos the customer added with \"Add combo\" (or the combo row's +). The same products added one by one stay separate lines at full price. The cart says so under the lines, with an \"Add it as a combo\" button."],
  ["Setup ▸ Business Settings ▸ Delivery & Payments ▸ Combos", "A new card after Order rules: \"Only when the customer adds the combo\" (default) or \"Whenever all its products are in the cart\" (how it worked until today). One Save, audited like the other settings; switching back loses nothing."],
  ["What the app sends", "\"Add combo\" sends the combo's id — POST /customer/cart/combos — not three product adds; the combo row's − / + is PATCH /customer/cart/combos/{comboId} with the bundles, and remove is DELETE. Every cart answer lists the chosen combos (`combos[]`). The same calls work in both modes."],
  ["Bundles never outgrow the lines", "A chosen combo claims at most the bundles its products' lines hold: lower a product's line and the bundles go down; remove it and the combo goes, the other products stay. A loose unit already in the cart stays loose when the combo is added — the bundle brings its own."],
  ["Unchanged", "The order, the invoice and the picking slip still list the products; a combo's own limit (per order, per day, one time, campaign total) still applies to chosen bundles and still never blocks checkout."],
] });
