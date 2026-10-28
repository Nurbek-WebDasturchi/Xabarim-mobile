// login.html va registration.html uchun umumiy: username + parol
const dark = localStorage.getItem("mode") === "dark";
document.body.classList.toggle("dark-mode", dark);
document
  .querySelectorAll(".register-input")
  .forEach((i) => i.classList.add(dark ? "dark-input" : "light-input"));
document
  .querySelectorAll(".register-label")
  .forEach((l) => l.classList.add(dark ? "dark-label" : "light-label"));
Lang.init();
document.querySelectorAll("[data-password-toggle]").forEach((toggle) => {
  const input = toggle.parentElement.querySelector("input");
  toggle.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    toggle.setAttribute("aria-pressed", String(show));
    toggle.setAttribute("aria-label", Lang.t(show ? "hide_password" : "show_password"));
    toggle.querySelector("i").className = `bi ${show ? "bi-eye-slash" : "bi-eye"}`;
  });
});
const reg = !!document.querySelector("#fullname"),
  err = document.querySelector("#auth-err"),
  submitButton = document.querySelector("#auth-form .auth-submit");
const referralCode = new URLSearchParams(location.search).get("ref") || "";
DB.me().then((m) => m && (location.href = "/pages/main.html"));
if (!DB.sb) {
  err.textContent = Lang.t("need_env");
  submitButton.disabled = true;
}
document.querySelector("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  err.textContent = "";
  if (!DB.sb) {
    err.textContent = Lang.t("need_env");
    return;
  }
  const u = username.value.trim().toLowerCase(),
    p = password.value,
    btn = e.submitter || document.querySelector("#auth-form .sign-up");
  if (btn.classList.contains("is-loading")) return;
  if (!/^[a-z0-9_]{3,30}$/.test(u))
    return (err.textContent = Lang.t("bad_user"));
  if (p.length < 8) return (err.textContent = Lang.t("bad_pass"));
  Spin.on(btn);
  try {
    reg ? await DB.signup(u, p, fullname.value.trim(), referralCode) : await DB.login(u, p);
    if (!(await DB.me()))
      throw new Error(
        "Session yaratilmadi: Supabase'da Confirm email ni o'chiring",
      );
    if (reg) localStorage.setItem("xabarim-show-google-offer", "1");
    location.href = "/pages/main.html";
  } catch (x) {
    console.error(x);
    const friendly = reg
      ? /already/i.test(x.message)
        ? Lang.t("taken")
        : Lang.t("error")
      : Lang.t("bad_login");
    err.textContent = friendly + " (" + (x.message || x) + ")";
    Spin.off(btn);
  }
});
