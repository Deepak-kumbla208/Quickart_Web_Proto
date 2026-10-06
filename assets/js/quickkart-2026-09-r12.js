/* ====================================================================
   QuickKart prototype — Round 12 (7 October 2026): staff status changes as
   the backend built them (P10-2d, MR !89, D90) on quickkart-api-service.
   Every change of the day is here.

   The backend's order screens (the console P10-2a, one order P10-2b, the
   status buttons P10-2d) already match what Rounds 3, 6 and 7 designed; the
   one thing that differed is what happens to the orders still waiting for
   Accept when a shop switches from Manual to Automatic confirmation. The
   prototype confirmed them all silently; the backend lets the OWNER CHOOSE
   when saving (D90 a, the user's answer of 7 October):

   A. Settings ▸ Delivery & Payments ▸ Order confirmation — saving Manual →
      Automatic while orders wait for Accept opens a question:
        "N orders are still waiting for Accept. Accept them now?"
        [Accept N orders and switch] [Switch, leave them waiting] [Back]
      With none waiting it saves straight away, as before. (Backend: the
      settings screen reads orders.waitingToAccept; the save may carry
      orders.acceptWaitingOrders — only on this switch.)
   B. "Leave them waiting" keeps those orders in "New — accept": the Orders
      stage list and board keep that stage while any order waits, even in
      Automatic mode, and orders placed afterwards still confirm themselves —
      they never accept the ones left waiting.
   C. The card's note changes from "switching to automatic confirms them" to
      what now happens: you are asked; and in Automatic mode it says how
      many are still waiting.
   ==================================================================== */

(function round12AcceptWaiting() {
  const waitingCount = () => State.orders.filter((o) => o.status === "new").length;
  const plural = (n) => `${n} order${n === 1 ? "" : "s"}`;

  // B. An order left waiting is never accepted by a later order's automatic confirmation.
  const autoConfirmBefore = autoConfirm;
  window.autoConfirm = (o) => (o.leftWaiting ? o : autoConfirmBefore(o));

  // B. The "New — accept" stage stays while anything waits for Accept, in either mode.
  window.applyConfirmationMode = function applyConfirmationModeR12() {
    const manual = confirmationMode() === "manual";
    const showNew = manual || waitingCount() > 0;
    PIPELINE.length = 0;
    PIPELINE_ALL.forEach(([k, label]) => {
      if (k === "new" && !showNew) return;
      PIPELINE.push([k, k === "new" ? "New — accept" : k === "confirmed" && !showNew ? "New (paid / COD)" : label]);
    });
    BOARD_COLUMNS.length = 0;
    BOARD_COLUMNS_ALL.forEach((k) => { if (k !== "new" || showNew) BOARD_COLUMNS.push(k); });
    ADVANCE_LABEL.new = "Accept order";
  };
  // Accepting the last waiting order (or one arriving) changes the stage list: follow it on every screen.
  const renderBefore = render;
  window.render = function renderR12(...args) {
    applyConfirmationMode();
    return renderBefore(...args);
  };
  applyConfirmationMode();

  // C. The card's wording.
  window.confirmationCardHTML = function confirmationCardHTMLR12(editable) {
    const mode = confirmationMode();
    const dis = editable ? "" : "disabled";
    const pending = waitingCount();
    const note = pending
      ? mode === "manual"
        ? `${plural(pending)} waiting to be accepted right now — when you switch to automatic you choose whether to accept them or leave them waiting.`
        : `${plural(pending)} still waiting to be accepted (left waiting when you switched) — accept or cancel them from the Orders screen.`
      : "";
    return `
  <div class="summary-card" style="max-width:560px; margin-top:16px">
    <div class="summary-card-title">Order confirmation</div>
    <div class="qk-muted small">How a new order enters your queue. Either way the customer sees "Confirmed" once they have paid; an unpaid online order only ever shows under "Awaiting payment". A change applies to orders placed afterwards.</div>
    <label class="stock-toggle-lg" style="margin-top:10px"><input type="radio" name="confirmMode" value="auto" ${mode === "auto" ? "checked" : ""} ${dis} /><span><b>Automatic</b> <span class="qk-muted small">— a paid or cash order is confirmed the moment it is placed; the first step is "Start picking". (Default)</span></span></label>
    <label class="stock-toggle-lg"><input type="radio" name="confirmMode" value="manual" ${mode === "manual" ? "checked" : ""} ${dis} /><span><b>Manual</b> <span class="qk-muted small">— every order waits as "New — accept" until your team taps Accept (or cancels it). The "accept" target and alert below apply.</span></span></label>
    ${note ? `<div class="qk-muted small" style="margin-top:6px">${note}</div>` : ""}
    ${editable ? `<button class="btn btn-primary btn-block" data-action="save-confirmation-mode">Save</button>` : ""}
  </div>`;
  };

  // A. The question, only on Manual → Automatic with orders waiting.
  const saveBefore = Actions["save-confirmation-mode"];
  Actions["save-confirmation-mode"] = () => {
    const el = document.querySelector('input[name="confirmMode"]:checked');
    const next = el && el.value === "manual" ? "manual" : "auto";
    const waiting = waitingCount();
    if (confirmationMode() === "manual" && next === "auto" && waiting > 0) {
      UI.modal = { type: "acceptWaiting", waiting };
      render();
      return;
    }
    return saveBefore();
  };

  function acceptWaitingModal() {
    const n = UI.modal.waiting;
    return `
  <div class="overlay" data-action="close-modal-backdrop">
    <div class="dialog dialog-static" role="dialog" aria-modal="true" data-action="noop">
      <div class="dialog-head"><span>Switch to automatic confirmation</span><button class="dialog-close" data-action="close-modal">${ic("close")}</button></div>
      <div class="dialog-body">
        <div class="notice notice-warn" style="margin-bottom:10px">${ic("alert")}<span><b>${plural(n)} still ${n === 1 ? "waits" : "wait"} for Accept.</b> Orders placed from now on are accepted automatically. What about the ${n === 1 ? "one" : "ones"} already waiting?</span></div>
        <div class="qk-muted small" style="margin-bottom:12px">Accepted orders move to "Confirmed" so picking can start — the customer is not messaged again. Orders left waiting stay in "New — accept" until your team accepts or cancels them.</div>
        <div class="form-actions" style="flex-wrap:wrap; gap:8px">
          <button type="button" class="btn btn-outline" data-action="close-modal">Back</button>
          <button type="button" class="btn btn-outline" data-action="switch-auto-leave">Switch, leave them waiting</button>
          <button type="button" class="btn btn-primary" data-action="switch-auto-accept">Accept ${plural(n)} and switch</button>
        </div>
      </div>
    </div>
  </div>`;
  }
  const extraBefore = extraModal;
  window.extraModal = (type) => (type === "acceptWaiting" ? acceptWaitingModal() : extraBefore(type));

  Actions["switch-auto-accept"] = () => {
    const n = UI.modal ? UI.modal.waiting : waitingCount();
    UI.modal = null;
    // Orders left waiting at an earlier switch are accepted too: the flag only protects them from a later order.
    State.orders = State.orders.map((o) => (o.status === "new" && o.leftWaiting ? { ...o, leftWaiting: false } : o));
    saveBefore(); // the Round 7 save: Automatic, and every waiting order confirmed
    showToast(`Automatic confirmation on — ${plural(n)} accepted`);
  };
  Actions["switch-auto-leave"] = () => {
    const n = waitingCount();
    UI.modal = null;
    State.orders = State.orders.map((o) => (o.status === "new" ? { ...o, leftWaiting: true } : o));
    persist("orders");
    saveBefore(); // Automatic; the orders left waiting stay where they are
    showToast(`Automatic confirmation on — ${plural(n)} left waiting for Accept`);
  };
})();

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Switching to automatic confirmation (round 12)", items: [
  ["Manual → Automatic asks", "Settings ▸ Delivery & Payments ▸ Order confirmation: switching from Manual to Automatic while orders wait for Accept now asks — \"Accept N orders and switch\" or \"Switch, leave them waiting\" (it used to accept them silently). With none waiting it saves straight away."],
  ["Orders left waiting", "They stay in \"New — accept\" (the stage stays on the Orders screen even in Automatic mode); orders placed afterwards still confirm themselves and never accept them."],
  ["The card's note", "It now says what happens, and in Automatic mode how many are still waiting."],
] });
