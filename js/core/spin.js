// Tugmalardagi umumiy spinner. Foydalanish: Spin.on(btn) ... Spin.off(btn) yoki await Spin.run(btn, async () => {...})
const Spin = {
  on(b) {
    if (!b || b.classList.contains("is-loading")) return;
    b.classList.add("is-loading");
    b.disabled = true;
    b.setAttribute("aria-busy", "true");
  },
  off(b) {
    if (!b) return;
    b.classList.remove("is-loading");
    b.disabled = false;
    b.removeAttribute("aria-busy");
  },
  async run(b, fn) {
    this.on(b);
    try { return await fn(); } finally { this.off(b); }
  },
};
