/* ====================================================================
   QuickKart prototype — Round 16 (14 October 2026): PICKING AND PACKING
   ARE ONE STEP, "PREPARING" (backend P10-2f, MR !118, decision D108).

   This round is a *removal*, so unlike the other rounds it has almost no
   code of its own: the `packing` status runs through every earlier file,
   and each definition was edited where it lives rather than patched from
   here. This file carries the round's note and its What's new entry.

   A. The order lifecycle is now
        New → Confirmed → Preparing → Ready for Rider → Picked Up → Delivered
      The `packing` status is gone — from the status list, the timeline,
      the board columns, the pipeline, the dashboard rows and the seeds.
      The step keeps the name `picking` underneath and reads "Preparing"
      everywhere, so only one value disappears for the apps.

   B. Why: picking and packing did the same thing. The same actions were
      allowed in both, the same unavailable-item offers, the same cancels,
      the same stock behaviour — and **neither ever told the customer
      anything**. "Start packing" was a button that changed a label and
      nothing else. The only real check is the one on Mark ready, and that
      has not moved: a short line or an open unavailable-item offer still
      holds the order back, with the reason per line.

   C. Admin — Orders: one **Preparing** column on the board and one
      **Mark ready for rider** button instead of "Start packing" then
      "Mark ready for rider". One less click on every order.

   D. Admin — Business Settings ▸ Order timing targets: **one** Preparing
      target instead of Picking and Packing. Each shop's two numbers were
      added together (8 + 5 = 13 by default), so nobody's orders suddenly
      go amber. Business Settings ▸ "Customers can cancel until" has three
      choices now — New, Confirmed, Preparing.

   E. Customer — one step fewer on the order timeline: Order Placed →
      Order Confirmed → Preparing Your Order → Packed, waiting for a rider
      → Out for Delivery → Delivered. Nothing is said to the customer that
      was not said before (neither stage ever sent a message).

   F. A **pickup** order now waits at **Ready for Rider**, shown to the
      customer as "Ready for Pickup", and is collected from there — this
      is what the backend has always meant by that status for a pickup
      order, and the prototype used `packing` for it only because the
      extra stage existed.

   G. Rider: nothing changes. A stop whose order is still with the store
      reads "Being packed" as before.
   ==================================================================== */

WHATS_NEW.unshift({ area: "Round 16 — picking and packing are one step", items: [
  ["One Preparing step", "Picking and Packing were the same work with two names: the same actions, the same unavailable-item offers, the same cancels, and neither told the customer anything. They are now one step, Preparing. The order goes New → Confirmed → Preparing → Ready for Rider → Picked Up → Delivered."],
  ["One button on the order", "The order drawer and the board show Mark ready for rider straight from Preparing — \"Start packing\" is gone. One less click on every order. The check on Mark ready has not changed: a short line or an open unavailable-item offer still holds the order back and says which line."],
  ["One timing target", "Business Settings ▸ Order timing targets has one Preparing number instead of Picking and Packing. Your two numbers were added together (8 + 5 = 13 by default), so no order suddenly turns amber."],
  ["Cancel until", "Business Settings ▸ \"Customers can cancel until\" now offers New, Confirmed and Preparing. A shop set to Packing is now set to Preparing — the same moment, under the step's new name."],
  ["A pickup order waits at Ready", "A collect-in-store order now sits at Ready for Rider, shown to the customer as \"Ready for Pickup\", and is marked picked up from there. That is what the backend has always meant by it."],
  ["The customer sees one step fewer", "The order timeline drops \"Packed\" as a separate step. Nothing new is sent to customers — neither stage ever sent a message."],
] });
