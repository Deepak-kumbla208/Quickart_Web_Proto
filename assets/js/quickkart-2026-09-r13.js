/* ====================================================================
   QuickKart prototype — Round 13 (9 October 2026): combo bundles in the
   cart and a limit on each combo, as the backend built them (P9-5b,
   BE-ADM-025, D100) on quickkart-api-service. Every change of the day is here.

   A. The CART shows a combo as ONE COMPACT ROW — name, "Combo" badge, bundle price, "You save S$x", a "View items" dropdown
      (the products and how many, view only) and a − / + for the WHOLE bundle (× N). Units beyond the full sets are
      ordinary lines underneath, with their own − / +; add the missing products and they join a bundle (× 2). Remove the
      last bundle and the row goes. (API: lines[].comboId, comboUnits.)
   B. EACH FULL SET earns the saving (one of every product), up to the
      combo's limit — it used to be one combo per cart however many the
      customer held. A product counts for one combo only; the combo with the
      bigger saving takes it first. (API: appliedCombos[].sets.)
   C. A LIMIT on each combo — Settings is the admin's choice, per combo
      (Marketing ▸ Home Screen ▸ Deals & Combos ▸ Add / Edit combo):
        · No limit (default)
        · Per order            — bundles in one order
        · Per customer per day — across all the customer's orders that day
                                 (the shop's business day)
        · One time per customer — ever
        · Total across all customers — then the combo stops
      with a quantity (a whole number, 1 – 1 000 000) that is needed exactly
      when there is a limit. The combo's row shows the limit and how many
      bundles have been earned. A change is in the audit log.
   D. THE CART SAYS WHEN A LIMIT CUT OR STOPPED A COMBO ("Snack Time Combo:
      limit 1 per day") and the combo row shows "Limit … · N more allowed".
      A limit never blocks the order: if nothing is left the order is still
      placed, without the combo discount. (API: appliedCombos[].cap, capped,
      comboNotices[] — NOT an issue.)
   E. A CANCELLED ORDER GIVES ITS BUNDLES BACK (a delivered order's return
      does not). The order shows "Snack Time Combo × 2" when it earned two.
   ==================================================================== */

(function round13ComboBundles() {
  const CAP_TYPES = [
    ["none", "No limit"],
    ["per_cart", "Per order"],
    ["per_day", "Per customer, per day"],
    ["one_time", "One time per customer"],
    ["campaign_total", "Total across all customers"],
  ];
  const CAP_MAX = 1000000;
  const capTypeOf = (c) => c.capType || "none";
  const bizDate = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
  const cents = (n) => Math.round(n * 100) / 100;

  // Combos written before this round have no limit fields: read them as "No limit", and keep the audit log from
  // seeing a change when one is saved untouched.
  State.homeSections = State.homeSections.map((s) =>
    s.combos ? { ...s, combos: s.combos.map((c) => ({ capType: "none", capQty: null, ...c })) } : s,
  );

  // ---------------------------------------------------------------- what the orders already hold
  // The backend keeps a row per order and combo (combo_redemptions); here each order carries `comboSets`
  // ({ comboId: sets }). A cancelled order no longer counts — that is the give-back.
  const standing = () => State.orders.filter((o) => o.comboSets && o.status !== "cancelled");
  const usageOf = (combo) => {
    let day = 0;
    let ever = 0;
    let total = 0;
    const today = bizDate(Date.now());
    standing().forEach((o) => {
      const n = o.comboSets[combo.id] || 0;
      if (!n) return;
      total += n;
      if (!State.session || o.customerName !== State.session.name) return;
      ever += n;
      if (bizDate(o.createdAt) === today) day += n;
    });
    return { day, ever, total };
  };
  // Bundles still allowed for the customer: null = no limit.
  const allowanceOf = (combo) => {
    const type = capTypeOf(combo);
    const qty = combo.capQty;
    if (type === "none" || !qty) return null;
    const used = usageOf(combo);
    if (type === "per_cart") return qty;
    if (type === "per_day") return Math.max(0, qty - used.day);
    if (type === "one_time") return Math.max(0, qty - used.ever);
    return Math.max(0, qty - used.total);
  };
  const limitText = (combo) => {
    const q = combo.capQty;
    return {
      per_cart: `${q} per order`,
      per_day: `${q} per day`,
      one_time: `${q} per customer`,
      campaign_total: `${q} in total`,
    }[capTypeOf(combo)];
  };
  const noticeText = (combo, earned, limit) => {
    const none = earned === 0;
    const q = combo.capQty;
    switch (capTypeOf(combo)) {
      case "per_cart": return `${combo.title}: limit ${q} per order`;
      case "per_day": return none ? `${combo.title}: today's limit of ${q} is used` : `${combo.title}: limit ${q} per day`;
      case "one_time": return none ? `${combo.title}: you have already had this offer` : `${combo.title}: limit ${q} per customer`;
      default: return none ? `${combo.title}: this offer has ended` : `${combo.title}: only ${limit} left`;
    }
  };

  // ---------------------------------------------------------------- which combos the cart earns (B, D)
  // The same rules as the backend's allocateCombos(): a bundle is one of every product; each full set earns the saving
  // up to the limit; a unit counts for one combo only — the bigger saving per bundle goes first, ties by id.
  window.comboAllocation = function comboAllocation() {
    const left = {};
    Object.keys(State.cart).forEach((k) => {
      if (State.cart[k] > 0 && findItem(Number(k))) left[k] = State.cart[k];
    });
    const candidates = allCombos()
      .filter((c) => c.itemIds.length && comboSavings(c) > 0 && c.itemIds.every((id) => (left[id] || 0) >= 1))
      .map((combo) => ({ combo, perSet: comboSavings(combo) }))
      .sort((a, b) => b.perSet - a.perSet || String(a.combo.id).localeCompare(String(b.combo.id)));
    const applied = [];
    const notices = [];
    const units = {};
    const consumed = {};
    candidates.forEach(({ combo, perSet }) => {
      const full = Math.min(...combo.itemIds.map((id) => left[id] || 0));
      if (full < 1) return;
      const limit = allowanceOf(combo);
      const earned = limit === null ? full : Math.min(full, Math.max(0, limit));
      if (limit !== null && earned < full) notices.push({ combo, earned, message: noticeText(combo, earned, limit) });
      if (earned < 1) return;
      combo.itemIds.forEach((id) => {
        left[id] -= earned;
        consumed[id] = (consumed[id] || 0) + earned;
        if (!units[id]) units[id] = { comboId: combo.id, units: earned };
      });
      applied.push({
        combo,
        sets: earned,
        perSet,
        discount: cents(perSet * earned),
        capped: limit !== null && earned < full,
        cap: limit === null ? null : { remaining: Math.max(0, limit - earned) },
      });
    });
    return { applied, notices, units, consumed };
  };
  // The bill, the order and the toast read these two — now per full set.
  window.activeCombos = () => comboAllocation().applied.map((a) => ({ ...a.combo, sets: a.sets }));
  window.activeComboSavings = () => comboAllocation().applied.reduce((s, a) => s + a.discount, 0);

  // ---------------------------------------------------------------- A. the cart
  // A combo is ONE compact row: its name, the bundle price, "You save", a dropdown for its items and a − / + for the
  // WHOLE bundle (× N). Units beyond the full sets are ordinary lines underneath; they join a bundle when the missing
  // products are added too.
  UI.comboOpen = UI.comboOpen || {};
  window.cartLinesHTML = function cartLinesHTMLR13(t) {
    const { applied, consumed } = comboAllocation();
    const cards = applied
      .map((a) => {
        const members = a.combo.itemIds.map((id) => t.cartItems.find((i) => i.id === id)).filter(Boolean);
        if (!members.length) return "";
        const id = esc(a.combo.id);
        const open = !!UI.comboOpen[a.combo.id];
        const bundle = cents(a.combo.bundlePrice * a.sets);
        const apart = cents(comboIndividualTotal(a.combo) * a.sets);
        const full = a.cap && a.cap.remaining < 1;
        const foot = a.cap
          ? `Limit: ${esc(limitText(a.combo))} · ${a.cap.remaining > 0 ? `${a.cap.remaining} more allowed` : "limit reached"}`
          : "";
        return `
        <div class="combo-bundle" data-combo-bundle="${id}">
          <div class="cart-line combo-bundle-row">
            <img src="${esc(a.combo.image || members[0].image)}" alt="" class="cart-line-img" />
            <div class="cart-line-info">
              <div class="cart-line-name">${esc(a.combo.title)}<span class="badge badge-green" style="margin-left:6px">Combo</span></div>
              <div class="cart-line-unit qk-muted">${members.length} items${a.sets > 1 ? ` · × ${a.sets}` : ""}</div>
              <div class="cart-line-price-row qk-num">
                <span class="cart-line-price-now">${money(bundle)}</span>
                <span class="cart-line-price-mrp">${money(apart)}</span>
              </div>
              <div class="combo-bundle-save">You save ${money(a.discount)}</div>
              <button type="button" class="link-btn combo-bundle-toggle" data-action="toggle-combo-items" data-id="${id}" aria-expanded="${open}">${open ? "Hide items" : "View items"} <span class="combo-chevron ${open ? "is-open" : ""}">${ic("chevronDown")}</span></button>
            </div>
            <div class="qty-stepper">
              <button data-action="dec-combo" data-id="${id}" aria-label="Remove one bundle">${ic("minus")}</button>
              <span>${a.sets}</span>
              <button data-action="inc-combo" data-id="${id}" aria-label="Add one bundle" ${full ? 'disabled title="Limit reached"' : ""}>${ic("plus")}</button>
            </div>
          </div>
          ${open ? `<ul class="combo-bundle-items">${members.map((i) => `<li><span>${a.sets} × ${esc(cartLineName(i))}</span><span class="qk-muted">${esc(i.unit)}</span></li>`).join("")}</ul>` : ""}
          ${foot ? `<div class="combo-bundle-foot qk-muted small">${foot}</div>` : ""}
        </div>`;
      })
      .join("");
    // What is left over after the full sets: ordinary lines, with their own − / +.
    const loose = t.cartItems
      .map((i) => ({ ...i, qty: i.qty - (consumed[i.id] || 0) }))
      .filter((i) => i.qty > 0)
      .map((i) => cartLineHTML(i))
      .join("");
    return cards + loose;
  };

  Actions["toggle-combo-items"] = (el) => {
    UI.comboOpen[el.dataset.id] = !UI.comboOpen[el.dataset.id];
    render();
  };
  // − / + on the row change the WHOLE bundle: one of every product.
  const comboOf = (el) => allCombos().find((c) => c.id === el.dataset.id);
  Actions["inc-combo"] = (el) => {
    const combo = comboOf(el);
    if (!combo) return;
    combo.itemIds.forEach((id) => { State.cart[id] = (State.cart[id] || 0) + 1; });
    persist("cart");
    render();
  };
  Actions["dec-combo"] = (el) => {
    const combo = comboOf(el);
    if (!combo) return;
    combo.itemIds.forEach((id) => {
      const q = (State.cart[id] || 0) - 1;
      if (q <= 0) delete State.cart[id]; else State.cart[id] = q;
    });
    persist("cart");
    render();
  };

  // Under the lines: a limit that cut or stopped a combo (never a reason the order cannot be placed), then the
  // hint for a combo that is one product short.
  window.comboNudgeHTML = function comboNudgeHTMLR13() {
    const { notices } = comboAllocation();
    const limits = notices
      .map((n) => `<div class="notice notice-warn combo-nudge" data-combo-notice="${esc(n.combo.id)}">${ic("alert")}<span>${esc(n.message)} — ${n.earned > 0 ? "the extra bundles are charged at full price" : "no combo discount this time"}. You can still place the order.</span></div>`)
      .join("");
    const hints = allCombos()
      .map((c) => {
        const have = c.itemIds.filter((id) => (State.cart[id] || 0) >= 1);
        if (have.length === 0 || have.length === c.itemIds.length) return "";
        const missing = c.itemIds.filter((id) => !have.includes(id)).map((id) => findItem(id)).filter(Boolean);
        return `
    <div class="notice notice-warn combo-nudge">
      ${ic("sparkle")}
      <span>Add ${missing.map((i) => esc(i.name)).join(" + ")} to complete the <b>${esc(c.title)}</b> and save ${money(comboSavings(c))}.
        ${missing.map((i) => `<button class="link-btn" data-action="inc-cart" data-id="${i.id}">Add ${esc(i.name)}</button>`).join(" ")}
      </span>
    </div>`;
      })
      .join("");
    return limits + hints;
  };

  // "Add combo" never refuses (a limit never blocks): with nothing left it still adds, and says there is no discount.
  const addComboBefore = Actions["add-combo"];
  Actions["add-combo"] = (el) => {
    const combo = allCombos().find((c) => c.id === el.dataset.id);
    const left = combo ? allowanceOf(combo) : null;
    addComboBefore(el);
    if (combo && left !== null && left < 1) showToast(`${combo.title} added — its limit is used, so no combo discount`);
  };

  // ---------------------------------------------------------------- E. the order records what it earned
  const handlePayBefore = handlePay;
  window.handlePay = function handlePayR13(method) {
    const first = State.orders.length ? State.orders[0].id : null;
    const earned = comboAllocation().applied;
    const result = handlePayBefore(method);
    const placed = State.orders[0];
    if (placed && placed.id !== first) {
      placed.comboSets = Object.fromEntries(earned.map((a) => [a.combo.id, a.sets]));
      placed.activeCombos = earned.map((a) => (a.sets > 1 ? `${a.combo.title} × ${a.sets}` : a.combo.title));
      persist("orders");
    }
    return result;
  };

  // ---------------------------------------------------------------- C. the admin's combo form and list
  const capBox = (c, err) => {
    const type = capTypeOf(c);
    return `
        <div class="field-grid-2">
          <label class="field"><span class="field-label">Limit</span>
            <select class="input" name="capType" onchange="var q=this.form.elements.capQty;q.disabled=this.value==='none';if(q.disabled)q.value=''">${CAP_TYPES.map(([k, label]) => `<option value="${k}" ${type === k ? "selected" : ""}>${label}</option>`).join("")}</select>
          </label>
          <label class="field"><span class="field-label">Limit quantity</span><input class="input ${err ? "invalid" : ""}" type="number" min="1" max="${CAP_MAX}" step="1" name="capQty" value="${c.capQty || ""}" ${type === "none" ? "disabled" : ""} placeholder="Bundles" /></label>
        </div>
        <div class="qk-muted small" style="margin:-4px 0 12px">How many bundles of this combo a customer can get. <b>Per order</b>: in one order · <b>Per customer, per day</b>: across their orders that day · <b>One time</b>: ever · <b>Total</b>: across all customers, then the combo stops. A limit never stops an order — it only takes the combo discount off the extra bundles.</div>`;
  };
  const comboFormBefore = comboFormModal;
  window.comboFormModal = function comboFormModalR13(section, editingComboId) {
    const html = comboFormBefore(section, editingComboId);
    const saved = editingComboId === "new" ? {} : sortedCombos(section).find((x) => x.id === editingComboId) || {};
    // After a refused save the limit boxes keep what was typed, so the message and the boxes agree.
    const c = UI.modal && UI.modal.capDraft ? { ...saved, ...UI.modal.capDraft } : saved;
    const err = UI.modal && UI.modal.error && /limit/i.test(UI.modal.error);
    return html.replace(/(<label class="field"><span class="field-label">Bundle price[\s\S]*?<\/label>)/, `$1${capBox(c, err)}`);
  };
  const comboRowBefore = comboRowHTML;
  window.comboRowHTML = function comboRowHTMLR13(section, c) {
    const html = comboRowBefore(section, c);
    const used = usageOf(c).total;
    const extra = [capTypeOf(c) === "none" ? "No limit" : `Limit: ${limitText(c)}`, used ? `${used} bundle${used === 1 ? "" : "s"} earned` : null].filter(Boolean);
    return html.replace(/(\d+ items?)<\/div>/, `$1 · ${extra.join(" · ")}</div>`);
  };

  // What the form sends (the base save takes it), and the form's own checks, as the backend words them.
  window.comboCapFields = function comboCapFieldsR13(fd) {
    const capType = String(fd.get("capType") || "none");
    return { capType, capQty: capType === "none" ? null : Number(fd.get("capQty")) };
  };
  const saveComboBefore = Submits["save-combo"];
  Submits["save-combo"] = function saveComboR13(form, ...rest) {
    const fd = new FormData(form);
    const type = String(fd.get("capType") || "none");
    const raw = String(fd.get("capQty") || "").trim();
    let problem = null;
    if (type !== "none") {
      const q = Number(raw);
      if (!raw) problem = "Enter how many bundles the limit allows";
      else if (!Number.isInteger(q)) problem = "Limit quantity must be a whole number";
      else if (q < 1) problem = "Limit quantity must be at least 1";
      else if (q > CAP_MAX) problem = "Limit quantity must be at most 1000000";
    }
    if (problem) {
      UI.modal.capDraft = { capType: type, capQty: raw };
      UI.modal.error = problem;
      render();
      return undefined;
    }
    return saveComboBefore.call(this, form, ...rest);
  };

  // The audit log words the new fields.
  Object.assign(AUDIT_FIELD_LABEL, { capType: "Limit", capQty: "Limit quantity" });
  const auditValueBefore = auditValueText;
  window.auditValueText = function auditValueTextR13(key, value) {
    if (key === "capType") return (CAP_TYPES.find(([k]) => k === value) || [, value || "No limit"])[1];
    if (key === "capQty") return value ? String(value) : "—";
    return auditValueBefore(key, value);
  };
})();

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Round 13 — combo bundles and combo limits", items: [
  ["A combo is one row in the cart", "The combo's name, a Combo badge, the bundle price and \"You save S$x\", with a View items dropdown (the products, view only) and a − / + that add or remove the WHOLE bundle (× N). Units beyond the full sets are ordinary lines underneath with their own − / +; add the missing products and they join the combo (× 2). (API: lines[].comboId and comboUnits.)"],
  ["Each full set earns the saving", "One of every product is a bundle. Two bundles save twice; before, one combo per cart however many you held. A product counts for one combo only — the combo that saves more takes it first."],
  ["A limit on each combo (admin)", "Marketing ▸ Home Screen ▸ Deals & Combos ▸ Add / Edit combo: Limit (No limit · Per order · Per customer, per day · One time per customer · Total across all customers) and a Limit quantity — required exactly when there is a limit, a whole number from 1 to 1 000 000. The combo's row shows the limit and how many bundles have been earned. A change is in the audit log."],
  ["What the customer sees", "The combo row says \"Limit: 1 per day · limit reached\" and a message under the lines says what was cut (\"Snack Time Combo: today's limit of 1 is used\"). A limit never blocks the order: it is placed without the combo discount on the extra bundles. (API: appliedCombos[].cap and capped, comboNotices[] — not an issue.)"],
  ["Cancelling gives it back", "A cancelled order's bundles count again for the day, for the customer and for a total limit; a delivered order's return does not. An order shows \"Snack Time Combo × 2\" when it earned two."],
] });
