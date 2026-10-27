/* ====================================================================
   Round 22 (2026-10-27) — the Unit list from the API, and Home Screen under Setup.

   Backend: D127 (f), FX-2 (MR !145, in review) — GET /admin/products/units answers the seven units a product's
   `unit` accepts, in list order, each with label, plural, whole / decimals and min / max, plus the Pack of range.

   Admin:  Catalogue ▸ product form — the chosen unit's amounts show under Pack size as soon as it is picked, with
           "Shown as …" while typing; a pack size the API would refuse shows its reason in red under the field (the
           API's errors.unit words), not a toast. Builds on round 21's Pack of + Amount + Unit control.
           The menu — Home Screen moves from Marketing to Setup (after Business Settings); Marketing keeps Coupons.
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
  WHATS_NEW.unshift({ area: "Round 22 — the Unit list from the API (D127 f, FX-2) and Home Screen under Setup", items: [
    ["Home Screen is under Setup", "The Home Screen (sections, slides, combos, theme & branding) moved from Marketing to Setup ▸ Home Screen, right after Business Settings. Marketing now holds Coupons. Nothing else changes — the same page, and the same Home Screen permission."],
    ["Each unit's amounts on screen", "Catalogue ▸ product form: as soon as a Unit is picked, the line under Pack size says what it takes — “kg: from 0.01 to 100, up to 3 decimals”, “pc: a whole number from 1 to 1,000” — plus “Shown as “6 x 325 ml”” while typing. The list and every limit come from GET /admin/products/units (D127 f): load it when the form opens instead of keeping a copy in the app."],
    ["A refused pack size is explained under the field", "A pack size the API would refuse no longer ends in a toast: the reason shows in red under Pack size and the box is outlined — the API's own words from errors.unit. The admin app should do the same instead of showing “Request validation failed”."],
  ] });
})();
