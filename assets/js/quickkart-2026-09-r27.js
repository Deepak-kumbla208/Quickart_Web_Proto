/* Round 27: hidden entry to MyShopza Control (MyShopza's own control room for all shops).
   Tap the logo on the sign-in screen 5 times within 3 seconds to open control.html, which is
   password-locked (encrypted) and asks for the password before showing anything. */
(function () {
  var taps = 0, first = 0;
  document.addEventListener('click', function (e) {
    var tile = e.target && e.target.closest ? e.target.closest('.brand-tile') : null;
    if (!tile || !document.querySelector('.login-card')) return;
    var now = Date.now();
    if (now - first > 3000) { taps = 0; first = now; }
    taps += 1;
    if (taps >= 5) { taps = 0; window.location.href = 'control.html'; }
  });
})();

/* The prototype now uses the product's new name, MyShopza, everywhere it said the old name: sign-in, header, footer,
   the sample shop and store names, the wallet, the rider app, help texts and the sample sender address. Order numbers
   keep the QK prefix. Saved sample data from before is shown with the new name too (see loadLS in quickkart.js). */
WHATS_NEW.unshift({ area: "Round 27 — the new name: MyShopza (2026-11-12)", items: [
  ["MyShopza everywhere", "Sign-in, the header and footer, the sample shop and its stores (MyShopza Tampines…), the wallet (MyShopza Wallet), the rider app (MyShopza Rider), help texts and sample addresses (no-reply@myshopza.com) now say MyShopza. Order numbers keep QK (QK00123)."],
  ["The MyShopza logo", "The bag mark is in every logo tile (sign-in, header, footer, admin, rider app) and on the browser tab; the full MyShopza logo sits at the bottom of the sign-in card (it was the Prabhas Trading logo). Theme & Branding ▸ Reset goes back to the MyShopza logo."],
  ["Saved sample data", "Anything this browser saved earlier shows the new name and logo too — no need to reset. A logo the admin uploaded stays."],
] });

/* The full MyShopza logo is wide, so the sign-in card's bottom logo is shown shorter than the old square one. */
(function () {
  var style = document.createElement("style");
  style.textContent = ".login-footer-logo { height: 34px; width: auto; }";
  document.head.appendChild(style);
})();
