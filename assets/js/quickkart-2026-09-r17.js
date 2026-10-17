/* ====================================================================
   QuickKart prototype — Round 17 (17 October 2026): THE CART SHOWS A
   COMBO AS THE COMBO ALONE (backend decision D120, customer contract
   0.21.0-draft).

   Like Round 16 this round is a *removal*, so it has almost no code of
   its own: the combo row lives in r13 and was edited there, and the
   styles that only the dropdown used were deleted from the stylesheet.
   This file carries the round's note and its What's new entry.

   A. The combo row in the CART no longer lists the products inside the
      bundle. The "View items" / "Hide items" dropdown is gone, and with
      it the "3 items" line. The row is now:

        [picture]  Snack Time Combo  (Combo)        − 2 +
                   × 2
                   S$10.40   S$14.00
                   You save S$3.60
                   Limit: 1 per day · limit reached

      — the combo's picture and name, its price, its saving, the limit
      footer and the − / + that add or remove a WHOLE bundle. Nothing
      else. The TL asked for a combo to read as one product.

   B. Nothing else about combos changed. Units beyond the full sets are
      still ordinary lines underneath with their own − / +; adding the
      missing products still forms another bundle (× 2); the limit, the
      cap notice and the home card's − / + are all as Round 13 built
      them.

   C. The backend change is one field: `appliedCombos[].imageUrl` on
      `POST /customer/cart/pricing`, so the cart can draw the row without
      carrying a picture over from `GET /customer/home`. `comboId`,
      `comboUnits` and `memberProductIds` all stay — the app still needs
      them to know which lines sit inside the bundle (and must not draw
      those units a second time), it simply no longer shows them.

   D. NOT in this round: the order, the invoice and the admin picking
      slip are untouched. An order still lists the products, and the
      store still picks and packs them individually — which is what the
      TL asked for. Making a combo ONE LINE in the order (one sellable
      item, with the products only on the picking slip) is a much bigger
      change — stock, returns, substitutions and the reports all key off
      the product lines — and is deliberately not built.
   ==================================================================== */

/* ---------------- What's changed ---------------- */
WHATS_NEW.unshift({ area: "Round 17 — a combo is one product in the cart", items: [
  ["The cart's combo row is the combo alone", "The row shows the combo's picture and name, a Combo badge, the bundle price, \"You save S$x\", the limit footer and a − / + for the WHOLE bundle. The \"View items\" dropdown that listed the products inside the bundle is gone, and so is the \"3 items\" line — a combo now reads as one product."],
  ["Nothing else about combos changed", "Units beyond the full sets are still ordinary lines underneath with their own − / +; adding the missing products still makes another bundle (× 2); the limit, the \"limit reached\" message and the home card's − / + all work as before."],
  ["The order and the picking slip are unchanged", "An order still lists the products, and the store still picks and packs them one by one. (API: appliedCombos[].imageUrl is the only new field; comboId, comboUnits and memberProductIds stay, and are still how the cart knows which lines belong to a bundle.)"],
] });
