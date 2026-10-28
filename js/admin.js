// Admin panel: ro'yxatdan o'tganlar soni/sanasi/soati va onlayn foydalanuvchilar.
// Ma'lumot faqat schema_v20.sql dagi RPC funksiyalari orqali olinadi (ular admin ekanini serverda tekshiradi).
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const TZ = "Asia/Tashkent", PAGE = 50;
  const dtf = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const dayf = new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  const fmtDate = (v) => (v ? dtf.format(new Date(v)).replace(",", "") : "—");
  const parts = (v) => { const s = fmtDate(v).split(" "); return { d: s[0] || "—", t: s[1] || "" }; };
  const ago = (v) => {
    if (!v) return "—";
    const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
    if (s < 60) return "hozirgina";
    if (s < 3600) return Math.floor(s / 60) + " daqiqa oldin";
    if (s < 86400) return Math.floor(s / 3600) + " soat oldin";
    return Math.floor(s / 86400) + " kun oldin";
  };
  const num = (n) => Number(n ?? 0).toLocaleString("ru-RU");
  const gate = (title, text, home) => {
    $("#app").classList.add("hide");
    $("#gate").classList.remove("hide");
    $("#gate-title").textContent = title;
    $("#gate-text").innerHTML = text || "";
    $("#gate-home").classList.toggle("hide", !home);
  };
  const errText = (x) => x?.message || String(x || "Xato");
  const isForbidden = (x) => x?.code === "42501" || /forbidden/i.test(x?.message || "");
  const isMissing = (x) => ["PGRST202", "42883", "PGRST205"].includes(x?.code) || /Could not find the function|does not exist/i.test(x?.message || "");

  let shown = 0, total = 0, search = "", onlineOnly = false, loading = false, qTimer, ready = false;
  const rpc = async (name, args) => { const { data, error } = await sb.rpc(name, args); if (error) throw error; return data; };

  async function loadOverview() {
    const o = await rpc("admin_overview");
    $("#s-total").textContent = num(o.total);
    $("#s-online").textContent = num(o.online);
    $("#s-24h").textContent = num(o.active_24h);
    $("#s-today").textContent = num(o.new_today);
    $("#s-7d").textContent = num(o.new_7d);
    $("#s-30d").textContent = num(o.new_30d);
    $("#s-today-sub").textContent = "Toshkent vaqti: " + (fmtDate(o.server_time).split(" ")[1] || "").slice(0, 5);
    $("#live-text").textContent = "Yangilandi " + (fmtDate(o.server_time).split(" ")[1] || "");
  }

  async function loadChart() {
    const rows = await rpc("admin_signups_by_day", { p_days: 14 });
    const max = Math.max(1, ...rows.map((r) => Number(r.cnt)));
    $("#bars").innerHTML = rows.map((r) => {
      const n = Number(r.cnt), h = Math.round((n / max) * 88);
      const d = dayf.format(new Date(r.day + "T00:00:00Z"));
      return `<div class="bar" title="${esc(d)}: ${n} ta"><b>${n || ""}</b><i style="height:${Math.max(3, h)}px;${n ? "" : "opacity:.25"}"></i><small>${esc(d)}</small></div>`;
    }).join("");
  }

  const rowHTML = (u, i) => {
    const r = parts(u.registered_at);
    const av = u.avatar_url ? esc(u.avatar_url) : "/img/user-profile.svg";
    return `<tr>
      <td class="num">${i + 1}</td>
      <td><div class="who"><img src="${av}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/img/user-profile.svg'"><div style="min-width:0"><b>${esc(u.full_name || u.username)}</b><span>@${esc(u.username)}</span></div></div></td>
      <td class="dt">${esc(r.d)}<small>soat ${esc(r.t)}</small></td>
      <td class="dt">${u.online ? "hozir" : esc(ago(u.last_seen))}<small>${esc(fmtDate(u.last_seen))}</small></td>
      <td>${u.online ? '<span class="badge on">Onlayn</span>' : '<span class="badge">Oflayn</span>'}</td>
    </tr>`;
  };

  // reset=true: boshidan; aks holda "yana ko'rsatish"; keep=true: hozir ko'rinib turgan sonni saqlab yangilash (avto-yangilash)
  async function loadUsers({ reset = false, keep = false } = {}) {
    if (loading) return;
    loading = true;
    try {
      const limit = keep ? Math.max(PAGE, shown) : PAGE;
      const offset = reset || keep ? 0 : shown;
      const rows = await rpc("admin_users", { p_limit: Math.min(limit, 200), p_offset: offset, p_search: search || null, p_online_only: onlineOnly });
      total = rows[0] ? Number(rows[0].total_count) : 0;
      if (reset || keep) { $("#rows").innerHTML = ""; shown = 0; }
      const start = shown;
      $("#rows").insertAdjacentHTML("beforeend", rows.map((u, i) => rowHTML(u, start + i)).join(""));
      shown = start + rows.length;
      $("#u-count").textContent = `(${num(total)})`;
      $("#empty").classList.toggle("hide", shown > 0);
      $("#more").classList.toggle("hide", shown >= total);
    } finally { loading = false; }
  }

  async function refreshAll(spinBtn) {
    const btn = $("#refresh");
    if (spinBtn) { btn.disabled = true; btn.querySelector("i").classList.add("spin"); }
    try { await Promise.all([loadOverview(), loadChart(), loadUsers({ reset: true })]); }
    catch (x) { console.error(x); $("#live-text").textContent = "Xato: " + errText(x); }
    if (spinBtn) { btn.disabled = false; btn.querySelector("i").classList.remove("spin"); }
  }

  async function init() {
    if (typeof sb === "undefined" || !sb) return gate("Sozlanmagan", "Supabase sozlamalari (<code>config.js</code>) topilmadi.", true);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { location.href = "/pages/auth/login.html"; return; }
    try { await loadOverview(); }
    catch (x) {
      if (isForbidden(x)) return gate("Ruxsat yo'q", "Bu sahifa faqat adminlar uchun.", true);
      if (isMissing(x)) return gate("SQL ishga tushirilmagan", "Supabase SQL Editor'da <code>supabase/schema_v20.sql</code> ni ishga tushiring va o'zingizni admin qiling.", true);
      return gate("Xato", esc(errText(x)), true);
    }
    $("#gate").classList.add("hide");
    $("#app").classList.remove("hide");
    ready = true;
    await Promise.all([loadChart().catch(console.error), loadUsers({ reset: true }).catch(console.error)]);

    $("#refresh").onclick = () => refreshAll(true);
    $("#more").onclick = () => loadUsers().catch(console.error);
    $("#only-online").onclick = (e) => { onlineOnly = !onlineOnly; e.currentTarget.classList.toggle("on", onlineOnly); loadUsers({ reset: true }).catch(console.error); };
    $("#q").oninput = (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { search = e.target.value.trim(); loadUsers({ reset: true }).catch(console.error); }, 300); };

    // jonli yangilanish: ko'rsatkichlar 15 soniyada, ro'yxat (onlayn holati) 30 soniyada
    setInterval(() => { if (!document.hidden && ready) loadOverview().catch(console.error); }, 15000);
    setInterval(() => { if (!document.hidden && ready) loadUsers({ keep: true }).catch(console.error); }, 30000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && ready) { loadOverview().catch(console.error); loadUsers({ keep: true }).catch(console.error); } });
  }
  init().catch((x) => gate("Xato", esc(errText(x)), true));
})();
