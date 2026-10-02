/* ====================================================================
   QuickKart prototype — Round 8 (2 October 2026): Stores, as the backend
   built them (P8-5, MR !69 on quickkart-api-service).

   A. The open switch is its own flag (`isOpen`), apart from Active. A Store
      Manager's card edits the opening / closing time and the open switch
      only — it used to write Active. Active ("in service") stays the Super
      Admin's. The Super Admin's form has both; the grid shows "Closed".
   B. Add / Edit branch: "Find on map" — a postal code fills latitude and
      longitude (the backend asks Google for the building; here the postal
      sector's centre). Nothing is saved until "Save"; "Check on Google
      Maps" opens the pin.
   C. The form refuses what the API refuses: equal opening and closing
      times (00:00–23:59 = never closes), a radius outside 0.5–100 km, a
      name another store has (ignoring case), pickup without an address.
   D. Customers: Express goes to the nearest covering store whose switch is
      on — none on → no Express ("choose Schedule delivery"); a switched-off
      store's delivery slots show "Closed"; a switched-off pickup store says
      "Closed right now". (Opening hours themselves are not simulated.)
   No screen is rearranged.
   ==================================================================== */

/* ---------------- 1. Data: the open switch ---------------- */
(() => {
  let changed = false;
  State.branches = State.branches.map((b) => {
    if (b.isOpen !== undefined) return b;
    changed = true;
    return { ...b, isOpen: true };
  });
  if (changed) persist("branches");
})();
function branchIsOpen(b) { return !!b && b.isOpen !== false; }

// The sector table had no 09–13 (Telok Blangah, Pasir Panjang, Clementi, West Coast): those postal codes fell back
// to central Singapore. Filled in for "Find on map" — customer addresses there are placed better too.
Object.entries({
  "09": [1.2700, 103.8200], "10": [1.2850, 103.8000], "11": [1.2950, 103.7800],
  "12": [1.3150, 103.7650], "13": [1.3110, 103.7780],
}).forEach(([sector, coords]) => { if (!POSTAL_SECTOR_COORDS[sector]) POSTAL_SECTOR_COORDS[sector] = coords; });

/* ---------------- 2. The API's rules for a store (P8-5) ---------------- */
const STORE_RADIUS_MIN_KM = 0.5;
const STORE_RADIUS_MAX_KM = 100;
const SAME_HOURS_MESSAGE = "Must differ from the opening time — 00:00 to 23:59 for a store that never closes; use the open switch to close it";
function branchFormErrors(f) {
  const errors = {};
  if (!f.name) errors.name = "Branch name is required";
  else if (State.branches.some((b) => b.id !== f.id && b.name.trim().toLowerCase() === f.name.toLowerCase())) errors.name = "A store with this name already exists";
  if (!Number.isFinite(f.lat) || f.lat < -90 || f.lat > 90) errors.lat = "Latitude must be between -90 and 90";
  if (!Number.isFinite(f.lng) || f.lng < -180 || f.lng > 180) errors.lng = "Longitude must be between -180 and 180";
  if (!Number.isFinite(f.radiusKm) || f.radiusKm < STORE_RADIUS_MIN_KM || f.radiusKm > STORE_RADIUS_MAX_KM || Math.round(f.radiusKm * 100) !== f.radiusKm * 100) errors.radiusKm = `Between ${STORE_RADIUS_MIN_KM} and ${STORE_RADIUS_MAX_KM} km, up to 2 decimals`;
  if (f.hoursOpen === f.hoursClose) errors.hoursClose = SAME_HOURS_MESSAGE;
  if (f.pickupAvailable && !f.pickupAddress) errors.pickupAddress = "Add a pickup address, or turn pickup off for this store";
  return errors;
}
function readBranchForm(form) {
  const fd = new FormData(form);
  const text = (k) => String(fd.get(k) || "").trim();
  const num = (k) => (text(k) === "" ? NaN : Number(text(k)));
  return {
    name: text("name"), area: text("area"), postal: text("postal"),
    lat: num("lat"), lng: num("lng"), radiusKm: num("radiusKm"),
    hoursOpen: fd.get("hoursOpen"), hoursClose: fd.get("hoursClose"),
    active: fd.get("active") === "on", isOpen: fd.get("isOpen") === "on",
    pickupAvailable: fd.get("pickupAvailable") === "on", pickupAddress: text("pickupAddress"),
  };
}
const numberOrBlank = (n) => (Number.isFinite(n) ? n : "");

/* ---------------- 3. Stores screen (Super Admin grid; Store Manager card) ---------------- */
// Same as before, plus a "Closed" badge when the open switch is off.
function adminBranches() {
  const user = currentUser();
  if (isSuperAdmin(user)) {
    return `
    <button class="btn btn-primary" data-action="new-branch">${ic("plus")} Add branch</button>
    <div class="qk-muted small" style="margin:10px 0">Each branch owns its own orders and rider pool, and draws from the shared network-wide catalog.</div>
    <div class="partner-grid">
      ${State.branches.map((b) => {
        const riders = branchRiders(b.id);
        const orders = State.orders.filter((o) => o.branchId === b.id);
        const activeOrders = orders.filter((o) => !TERMINAL_STATUSES.includes(o.status));
        const managers = usersForBranch(b.id);
        return `
        <div class="partner-card">
          <div class="partner-card-top">
            <div><span class="status-dot ${b.active && branchIsOpen(b) ? "on" : ""}"></span><span class="partner-name">${esc(b.name)}</span>
              <div class="qk-muted small">${esc(b.area)}</div>
              <div class="qk-muted small">Radius ${b.radiusKm} km · ${esc(b.hoursOpen)}–${esc(b.hoursClose)}</div>
              <div class="qk-muted small">${ic("user")} ${managers.length ? `Manager${managers.length > 1 ? "s" : ""}: ${managers.map((m) => esc(m.name)).join(", ")}` : "No manager assigned"}</div>
              ${b.pickupAvailable ? `<div class="qk-muted small">${ic("store")} Pickup: ${esc(b.pickupAddress || "No pickup address set")}</div>` : ""}
            </div>
            <div class="partner-card-actions">
              <span class="badge badge-${b.active ? "green" : "red"}">${b.active ? "Active" : "Inactive"}</span>
              ${branchIsOpen(b) ? "" : `<span class="badge badge-yellow" title="The open switch is off — no new express orders">Closed</span>`}
              ${b.pickupAvailable ? `<span class="badge badge-blue-soft">Pickup</span>` : ""}
              <button class="icon-btn" data-action="edit-branch" data-id="${b.id}">${ic("edit")}</button>
              <button class="icon-btn icon-btn-danger" data-action="delete-branch" data-id="${b.id}">${ic("trash")}</button>
            </div>
          </div>
          <div class="partner-stats">
            <div><div class="stat-value-sm">${riders.length}</div><div class="qk-muted small">Riders</div></div>
            <div><div class="stat-value-sm">${activeOrders.length}</div><div class="qk-muted small">Active orders</div></div>
            <div><div class="stat-value-sm">${orders.length}</div><div class="qk-muted small">Total orders</div></div>
          </div>
        </div>`;
      }).join("")}
      ${State.branches.length === 0 ? `<div class="empty-state"><div class="empty-title">No branches yet</div><div class="empty-hint">Add one to start routing orders and riders by location.</div></div>` : ""}
    </div>`;
  }
  const editable = canEdit(user, "stores");
  const myBranches = userStoreIds(user).map(findBranch).filter(Boolean);
  if (myBranches.length === 0) {
    return `<div class="empty-state"><div class="empty-title">No store assigned</div><div class="empty-hint">Ask a Super Admin to assign a store to your account under Admin ▸ Users.</div></div>`;
  }
  return `
  <div class="qk-muted small" style="margin:0 0 12px">${editable ? "Area, location, delivery radius, pickup and Active are set by the Super Admin (they decide which customers this store serves) — you can change the hours and the open switch." : "Read-only — ask a Super Admin for edit access under Admin ▸ Users."}</div>
  <div style="display:flex;flex-wrap:wrap;gap:16px">
    ${myBranches.map((b) => storeSettingsCard(b, editable)).join("")}
  </div>`;
}

// The Store Manager's card: the hours and the open switch (`isOpen`) — never Active.
function storeSettingsCard(branch, editable) {
  // After a refused save the card keeps what the manager typed (`draft`), with the message under it.
  const draft = (UI.storeHoursErrors || {})[branch.id] || null;
  const err = draft && draft.message;
  const shown = draft || branch;
  const open = draft ? draft.isOpen : branchIsOpen(branch);
  return `
  <div class="summary-card" style="max-width:420px;flex:1 1 360px">
    <div class="summary-card-title">${esc(branch.name)} <span class="badge badge-${branch.active ? "green" : "red"}" style="margin-left:8px">${branch.active ? "Active" : "Inactive"}</span>${branchIsOpen(branch) ? "" : ` <span class="badge badge-yellow">Closed</span>`}</div>
    <div class="row"><span>Area</span><span>${esc(branch.area)}</span></div>
    <div class="row"><span>Service radius</span><span>${branch.radiusKm} km</span></div>
    ${editable ? `
    <form data-action="save-store-hours" data-branch="${branch.id}">
      <div class="field-grid-2">
        <label class="field"><span class="field-label">Opens</span><input class="input" type="time" name="hoursOpen" value="${esc(shown.hoursOpen)}" /></label>
        <label class="field"><span class="field-label">Closes</span><input class="input ${err ? "invalid" : ""}" type="time" name="hoursClose" value="${esc(shown.hoursClose)}" /></label>
      </div>
      ${err ? `<div class="field-error">${esc(err)}</div>` : ""}
      <label class="stock-toggle-lg"><input type="checkbox" name="isOpen" ${open ? "checked" : ""} /><span>Store open — accepting new orders</span></label>
      <div class="qk-muted small">Switch off to close for now (a stock-take, a holiday): new express orders go to the next open store, this store's delivery slots show "Closed", orders already placed carry on.</div>
      <button type="submit" class="btn btn-primary btn-block" style="margin-top:12px">Save store settings</button>
    </form>` : `
    <div class="row"><span>Hours</span><span>${esc(branch.hoursOpen)}–${esc(branch.hoursClose)}</span></div>
    <div class="row"><span>Open switch</span><span>${open ? "Open" : "Closed"}</span></div>`}
  </div>`;
}

Submits["save-store-hours"] = (form) => {
  const fd = new FormData(form);
  const branchId = Number(form.dataset.branch);
  if (!branchId) return;
  const hoursOpen = fd.get("hoursOpen");
  const hoursClose = fd.get("hoursClose");
  const isOpen = fd.get("isOpen") === "on";
  const refused = hoursOpen === hoursClose;
  UI.storeHoursErrors = { ...(UI.storeHoursErrors || {}), [branchId]: refused ? { message: SAME_HOURS_MESSAGE, hoursOpen, hoursClose, isOpen } : null };
  if (refused) { render(); return; }
  State.branches = State.branches.map((b) => (b.id === branchId ? { ...b, hoursOpen, hoursClose, isOpen } : b));
  persist("branches");
  showToast("Store settings saved");
  render();
};

/* ---------------- 4. Add / Edit branch (Super Admin) ---------------- */
function branchFormModal() {
  const f = UI.modal.form;
  const err = UI.modal.errors || {};
  const fieldErr = (k) => (err[k] ? `<div class="field-error">${esc(err[k])}</div>` : "");
  const hasPin = Number.isFinite(f.lat) && Number.isFinite(f.lng);
  return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>${f.id ? "Edit branch" : "Add branch"}</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <form class="dialog-body" data-action="save-branch">
        <label class="field"><span class="field-label">Branch name *</span><input class="input ${err.name ? "invalid" : ""}" name="name" value="${esc(f.name)}" placeholder="e.g. QuickKart Tampines" /></label>
        ${fieldErr("name")}
        <label class="field"><span class="field-label">Area</span><input class="input" name="area" value="${esc(f.area || "")}" placeholder="e.g. Tampines / Bedok" /></label>
        <div class="field-label" style="margin-top:4px">Location</div>
        <div style="display:flex;gap:8px;align-items:flex-end">
          <label class="field" style="flex:1;margin:0"><span class="field-label">Postal code</span><input class="input ${err.postal ? "invalid" : ""}" name="postal" inputmode="numeric" maxlength="6" value="${esc(f.postal || "")}" placeholder="e.g. 529536" /></label>
          <button type="button" class="btn btn-outline" data-action="find-branch-pin">${ic("pin")} Find on map</button>
        </div>
        ${fieldErr("postal")}
        <div class="qk-muted small" style="margin:4px 0 8px">Fills latitude and longitude — check the pin and adjust them if needed. Nothing is saved until you save the branch.</div>
        <div class="field-grid-3">
          <label class="field"><span class="field-label">Latitude</span><input class="input ${err.lat ? "invalid" : ""}" type="number" step="any" name="lat" value="${numberOrBlank(f.lat)}" /></label>
          <label class="field"><span class="field-label">Longitude</span><input class="input ${err.lng ? "invalid" : ""}" type="number" step="any" name="lng" value="${numberOrBlank(f.lng)}" /></label>
          <label class="field"><span class="field-label">Radius (km)</span><input class="input ${err.radiusKm ? "invalid" : ""}" type="number" step="0.5" min="${STORE_RADIUS_MIN_KM}" max="${STORE_RADIUS_MAX_KM}" name="radiusKm" value="${numberOrBlank(f.radiusKm)}" /></label>
        </div>
        ${fieldErr("lat")}${fieldErr("lng")}${fieldErr("radiusKm")}
        ${hasPin ? `<div class="qk-muted small" style="margin:-2px 0 8px">${ic("pin")} Pin ${f.lat}, ${f.lng}${f.pinFrom ? ` — from postal code ${esc(f.pinFrom)}` : ""} · <a href="https://www.google.com/maps?q=${f.lat},${f.lng}" target="_blank" rel="noopener">Check on Google Maps</a></div>` : ""}
        <div class="field-grid-2">
          <label class="field"><span class="field-label">Opens</span><input class="input" type="time" name="hoursOpen" value="${esc(f.hoursOpen)}" /></label>
          <label class="field"><span class="field-label">Closes</span><input class="input ${err.hoursClose ? "invalid" : ""}" type="time" name="hoursClose" value="${esc(f.hoursClose)}" /></label>
        </div>
        ${fieldErr("hoursClose")}
        <div class="qk-muted small" style="margin:-2px 0 8px">Local time. A closing time earlier than the opening time = open past midnight; 00:00–23:59 = never closes.</div>
        <label class="stock-toggle-lg"><input type="checkbox" name="isOpen" ${f.isOpen !== false ? "checked" : ""} /><span>Store open — accepting new orders <span class="qk-muted small">(the switch the store's manager can also flip)</span></span></label>
        <label class="stock-toggle-lg"><input type="checkbox" name="active" ${f.active ? "checked" : ""} /><span>Active — can be assigned orders and shown to customers</span></label>
        <label class="stock-toggle-lg"><input type="checkbox" name="pickupAvailable" ${f.pickupAvailable ? "checked" : ""} /><span>Pickup available — customers can choose this store at checkout for Pickup / Takeaway</span></label>
        <label class="field"><span class="field-label">Pickup address</span><input class="input ${err.pickupAddress ? "invalid" : ""}" name="pickupAddress" value="${esc(f.pickupAddress || "")}" placeholder="Shown to customers picking up from this store" /></label>
        ${fieldErr("pickupAddress")}
        <div class="form-actions">
          <button type="button" class="btn btn-outline btn-block" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary btn-block">${f.id ? "Save changes" : "Add branch"}</button>
        </div>
      </form>
    </div>
  </div>`;
}

Actions["new-branch"] = () => {
  UI.modal = { type: "branchForm", form: { name: "", area: "", postal: "", lat: 1.3521, lng: 103.8198, radiusKm: 6, hoursOpen: "07:00", hoursClose: "23:00", isOpen: true, active: true, pickupAvailable: false, pickupAddress: "" } };
  render();
};
Actions["edit-branch"] = (el) => {
  const b = findBranch(Number(el.dataset.id));
  UI.modal = { type: "branchForm", form: { ...b, isOpen: branchIsOpen(b), postal: "" } };
  render();
};

// "Find on map": the backend calls Google (GET /admin/stores/geocode?postal=); the prototype uses the postal
// sector's centre. Keeps whatever else the admin has typed.
Actions["find-branch-pin"] = (el) => {
  const form = el.closest("form");
  if (!form) return;
  const f = { ...UI.modal.form, ...readBranchForm(form) };
  const errors = { ...(UI.modal.errors || {}) };
  delete errors.postal;
  if (!/^\d{6}$/.test(f.postal)) {
    errors.postal = "Must be a 6-digit Singapore postal code";
  } else if (!POSTAL_SECTOR_COORDS[f.postal.slice(0, 2)]) {
    errors.postal = "We could not find that postal code — check it, or place the pin on the map";
  } else {
    [f.lat, f.lng] = estimateCoordsFromPostal(f.postal);
    f.pinFrom = f.postal;
    delete errors.lat;
    delete errors.lng;
  }
  UI.modal = { ...UI.modal, form: f, errors };
  render();
};

Submits["save-branch"] = (form) => {
  const prev = UI.modal.form;
  const f = { ...prev, ...readBranchForm(form), id: prev.id };
  const errors = branchFormErrors(f);
  if (Object.keys(errors).length) { UI.modal.errors = errors; UI.modal.form = f; render(); return; }
  const data = {
    name: f.name, area: f.area, lat: f.lat, lng: f.lng, radiusKm: f.radiusKm,
    hoursOpen: f.hoursOpen, hoursClose: f.hoursClose, isOpen: f.isOpen, active: f.active,
    pickupAvailable: f.pickupAvailable, pickupAddress: f.pickupAddress,
  };
  if (f.id) {
    State.branches = State.branches.map((b) => (b.id === f.id ? { ...b, ...data } : b));
    showToast(`${f.name} updated`);
  } else {
    const id = State.branches.length ? Math.max(...State.branches.map((b) => b.id)) + 1 : 1;
    State.branches.push({ ...data, id });
    showToast(`${f.name} added`);
  }
  persist("branches");
  UI.modal = null;
  render();
};

/* ---------------- 5. Customers: the open switch ---------------- */
// Express: the nearest covering store whose switch is on (A12). Scheduled: the nearest covering store, as
// before — its slots show "Closed" while its switch is off (the backend checks the switch at each slot).
window.checkoutAssignment = () => {
  if (UI.fulfillment === "pickup") {
    const store = findPickupBranch(UI.pickupStoreId);
    return store ? { branch: store, shortages: [], fallback: false } : { branch: null, shortages: [], reason: "no-pickup" };
  }
  const stores = coveringStores(getSelectedAddress());
  if (!stores.length) return { branch: null, shortages: [], reason: "not-serviceable" };
  if (effectiveDeliverySpeed() === "express") {
    const open = stores.find(branchIsOpen);
    if (!open) return { branch: null, shortages: [], reason: "express-closed", nearest: stores[0] };
    return { branch: open, shortages: [], fallback: open !== stores[0], nearest: stores[0] };
  }
  return { branch: stores[0], shortages: [], fallback: false, nearest: stores[0] };
};

const EXPRESS_CLOSED_TEXT = "The stores near you are closed right now, so Express isn't available — choose Schedule delivery";
(() => {
  const baseNotice = checkoutStockNoticeHTML;
  window.checkoutStockNoticeHTML = (a) => {
    if (a.reason === "express-closed" && !(State.session && isCustomerBlocked(State.session.name))) {
      return `<div class="notice notice-warn" style="margin-bottom:12px">${ic("alert")}<span>${EXPRESS_CLOSED_TEXT}.</span></div>`;
    }
    return baseNotice(a);
  };

  // The checkout page's bottom line and the pickup card know nothing of the switch; adjust their text.
  const baseCheckout = viewCheckout;
  window.viewCheckout = (...args) => {
    let html = baseCheckout(...args);
    const a = checkoutAssignment();
    if (a.reason === "express-closed") html = html.replace("We don't deliver to this address yet", EXPRESS_CLOSED_TEXT);
    if (UI.fulfillment === "pickup" && a.branch && !branchIsOpen(a.branch)) {
      const hours = `Store hours: ${esc(a.branch.hoursOpen)} – ${esc(a.branch.hoursClose)}`;
      html = html.replace(hours, `${hours} · <b>Closed right now</b> — you can still order and collect once it reopens`);
    }
    return html;
  };

  // A switched-off store's slots are closed — for customers only (the admin Delivery Slots screen is unchanged).
  let customerView = false;
  const baseSlotInfo = slotInfo;
  window.slotInfo = (storeId, date, slot) => {
    const info = baseSlotInfo(storeId, date, slot);
    if (customerView && !info.past && !branchIsOpen(findBranch(Number(storeId)))) return { ...info, closed: true, level: "closed" };
    return info;
  };
  const asCustomer = (fn) => (...args) => {
    customerView = true;
    try { return fn(...args); } finally { customerView = false; }
  };
  window.checkoutSlotPickerHTML = asCustomer(checkoutSlotPickerHTML);
  window.selectedSlotValid = asCustomer(selectedSlotValid);
})();

/* ---------------- 6. What's changed ---------------- */
WHATS_NEW.unshift({ area: "Stores (round 8)", items: [
  ["Open switch", "Masters ▸ Stores: \"Store open — accepting new orders\" is its own switch now, apart from Active. A Store Manager changes only the opening / closing time and this switch on their store; Active (in service), location, radius and pickup stay with the Super Admin, whose cards show a \"Closed\" badge when a store is switched off."],
  ["Find on map", "Add / Edit branch: type the store's postal code and press Find on map — latitude and longitude are filled in (check the pin on Google Maps and adjust if needed). Nothing is saved until you save the branch."],
  ["Store rules", "Opening and closing time can't be the same (00:00–23:59 = never closes; use the open switch to close), the radius is 0.5–100 km, two stores can't share a name (ignoring capitals), and pickup needs a pickup address."],
  ["Closed stores and customers", "While a store is switched off, Express goes to the next nearest open store (none open → Express isn't offered), its delivery slots show \"Closed\", and as a pickup store it shows \"Closed right now\". Orders already placed carry on."],
] });
