/* ====================================================================
   QuickKart prototype — Round 20 (23 October 2026): SETUP ▸ BUSINESS
   SETTINGS AND SETUP ▸ PAYMENTS LAID OUT IN SECTIONS. Layout only — no
   setting, rule, save, audit entry or backend call changes.

   What was wrong (the user: "unoriented and unorganized, some divs are
   small some big, lots of gaps"): Round 14 put the cards three across
   in a row grid, and the Delivery & Payments tab has thirteen cards
   from 144 px (Delivery Slots) to 569 px (Order timing targets) tall.
   A row grid makes every row as tall as its tallest card, so a short
   card left a hole under it — up to 340 px. The cards also sat in the
   order the rounds happened to add them (fee, methods, Express, slots,
   vehicles, GST, confirmation, timing, rules, combos, rider pay, cash
   and breaks, reasons), with nothing saying what belongs together, and
   the gap between a card's description and its first box was 0 px on
   some cards and 22 px on others.

   A. Every Business Settings tab is now SECTIONS: a title and one line
      on the left, the section's cards on the right, packed in two
      balanced columns (CSS multi-column; a card never splits), so a
      short card sits under another card instead of beside a gap.
      Delivery & Payments: Delivery (fee, Express, GST on charges, the
      slots link) · Payment (methods) · Orders (confirmation, timing
      targets, order rules, combos) · Riders & fleet (vehicle types,
      rider pay, cash and breaks, not-delivered reasons). Company
      Profile, Tax and Stock Rules are one section each. A card a later
      round adds without a section lands under "More settings" — never
      lost.
   B. The cards themselves are untouched (the earlier rounds' HTML is
      taken as it is and only re-ordered), except a steady 12 px between
      a card's description and its first control.
   C. Setup ▸ Payments: the gateway form on the left with the webhook
      address under it; the set-up checklist and Razorpay's rules on the
      right. The two notices stay on top.
   D. Narrow screens: below ~1180 px the section title moves above its
      cards; below ~860 px the cards go one under the other.
   ==================================================================== */

(() => {
  const parse = (html) => { const t = document.createElement("template"); t.innerHTML = html; return t.content; };
  const isCard = (n) => n.classList && n.classList.contains("summary-card");
  const titleOf = (card) => { const t = card.querySelector(".summary-card-title"); return t ? t.textContent.trim().toLowerCase() : ""; };
  // Take, in key order, the cards whose title starts with a key; "*" takes everything left.
  const take = (pool, keys) => keys.includes("*") ? pool.splice(0) : keys.flatMap((k) => {
    const i = pool.findIndex((c) => titleOf(c).startsWith(k.toLowerCase()));
    return i < 0 ? [] : pool.splice(i, 1);
  });
  // The earlier rounds' page as a list: the tab pills, the cards (inside Round 14's grid or not) and anything else (notices).
  const parts = (html) => {
    const top = [...parse(html).children];
    const pills = top.find((n) => n.classList.contains("filter-pill-row"));
    const grid = top.find((n) => n.classList.contains("settings-grid"));
    const all = [...top.filter((n) => n !== pills && n !== grid), ...(grid ? [...grid.children] : [])];
    return { pills, pool: all.filter(isCard), lead: all.filter((n) => !isCard(n)).map((n) => n.outerHTML).join("") };
  };

  /* ---------------- A. Business Settings: the sections of each tab ---------------- */
  const SECTIONS = {
    company: [["Company profile", "Who the business is — on the customer site's footer, the tax invoice and the login page.", ["*"]]],
    tax: [["Tax", "The tax on every sale, and whether the prices customers see already include it.", ["*"]]],
    delivery: [
      ["Delivery", "What a delivery order pays on top of the items — the fee, free delivery, Express and GST on those charges — and where the delivery slots live.", ["Delivery Fee", "Express Delivery", "GST on delivery charges", "Delivery Slots"]],
      ["Payment", "How customers may pay. PayNow, GrabPay and Card also need the gateway under Setup ▸ Payments; Cash on Delivery needs nothing.", ["Payment Methods"]],
      ["Orders", "How an order enters the queue, how long each step should take, what customers may do with an order, and when a combo counts.", ["Order confirmation", "Order timing targets", "Order rules", "Combos"]],
      ["Riders & fleet", "Your vehicles and your riders — orders per trip, pay per delivery, the cash limit and breaks, and the reasons a rider may give when a delivery fails.", ["Vehicle types", "Rider pay", "Rider cash and breaks", "Not-delivered reasons"]],
    ],
    stock: [["Stock rules", "What happens when stock runs out or an item is unavailable, how a receipt sets the cost price, and the goodwill your team may give.", ["*"]]],
  };
  const MORE = ["More settings", "Settings added since this layout, not yet in a section.", ["*"]];
  const sectionHTML = (title, blurb, cards, first) => `
    <section class="bs-section ${first ? "first" : ""}">
      <div class="bs-section-head"><div class="bs-section-title">${title}</div><div class="bs-section-blurb">${blurb}</div></div>
      <div class="bs-cards ${cards.length === 1 ? "one" : ""}">${cards.map((c) => c.outerHTML).join("")}</div>
    </section>`;

  const prevBusiness = window.adminBusinessSettings;
  window.adminBusinessSettings = () => {
    const { pills, pool, lead } = parts(prevBusiness());
    const sections = SECTIONS[UI.businessSettingsTab] || SECTIONS.company;
    let out = "", first = true;
    for (const [title, blurb, keys] of [...sections, MORE]) {
      const cards = take(pool, keys);
      if (!cards.length) continue;
      out += sectionHTML(title, blurb, cards, first);
      first = false;
    }
    return `<div class="bs-page">${pills ? pills.outerHTML : ""}${lead ? `<div class="bs-lead">${lead}</div>` : ""}${out}</div>`;
  };

  /* ---------------- C. Payments: the form on the left, the help on the right ---------------- */
  const prevPayments = window.adminPayments;
  if (prevPayments) {
    window.adminPayments = () => {
      const { pool, lead } = parts(prevPayments());
      const main = take(pool, ["Payment gateway", "Your webhook address"]);
      const aside = pool.splice(0);
      return `<div class="pg-page">${lead}<div class="pg-cols"><div class="pg-main">${main.map((c) => c.outerHTML).join("")}</div><div class="pg-aside">${aside.map((c) => c.outerHTML).join("")}</div></div></div>`;
    };
  }
})();

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Round 20 — Business Settings and Payments in sections (layout only)", items: [
  ["Business Settings in sections", "Every tab is sections: a title and one line on the left, the cards on the right, packed in two balanced columns so a short card sits under another instead of beside a gap. Delivery & Payments: Delivery (fee, free delivery, Express, GST on charges, the slots link) · Payment (methods) · Orders (confirmation, timing targets, order rules, combos) · Riders & fleet (vehicle types, rider pay, cash and breaks, not-delivered reasons)."],
  ["Same cards, same saves", "No setting moved to another tab, was renamed or saves differently — only where it sits on the screen changed. Every card keeps its own Save and its audit entry; the space between a card's description and its first box is the same on every card."],
  ["Setup ▸ Payments", "The gateway form on the left with the webhook address under it; the set-up checklist and Razorpay's rules on the right."],
  ["Narrow screens", "Below about 1180 px the section title moves above its cards; below about 860 px the cards go one under the other."],
] });
