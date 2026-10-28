// Ekran yaqinlashmasligi uchun (pinch / double-tap zoom o'chirilgan).
// Matn maydonlari 16px dan kichik bo'lmasligi kerak (iOS fokusda avtomatik zoom qilmasligi uchun).
(() => {
  const st = document.createElement("style");
  st.textContent =
    "*{touch-action:pan-x pan-y}html{-webkit-text-size-adjust:100%;text-size-adjust:100%}input,textarea,select{font-size:max(16px,1em)}";
  document.head.appendChild(st);
  const stop = (e) => e.preventDefault();
  ["gesturestart", "gesturechange", "gestureend"].forEach((n) =>
    document.addEventListener(n, stop, { passive: false }),
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault();
    },
    { passive: false },
  );
})();
