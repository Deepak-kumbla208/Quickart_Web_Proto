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
