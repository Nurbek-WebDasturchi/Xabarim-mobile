require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const app = express();
app.use(express.json({ limit: "16kb" }));
const supabaseUser = async (req) => {
  const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  return response.ok ? response.json() : null;
};
const supabaseRest = (table, options = {}) => fetch(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`, {
  ...options,
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  },
});
app.post("/api/push/register", async (req, res) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: "PUSH_NOT_CONFIGURED" });
  try {
    const user = await supabaseUser(req);
    const token = String(req.body?.token || "").trim();
    if (!user) return res.status(401).json({ error: "AUTH_REQUIRED" });
    if (!/^ExponentPushToken\[.+\]$/.test(token)) return res.status(400).json({ error: "INVALID_PUSH_TOKEN" });
    const response = await supabaseRest("push_devices?on_conflict=user_id,expo_push_token", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: user.id, expo_push_token: token, platform: String(req.body?.platform || "android").slice(0, 20), updated_at: new Date().toISOString() }),
    });
    if (!response.ok) return res.status(502).json({ error: "PUSH_TOKEN_SAVE_FAILED" });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Push token registration failed:", error);
    return res.status(500).json({ error: "PUSH_TOKEN_SAVE_FAILED" });
  }
});
app.post("/api/push/message", async (req, res) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: "PUSH_NOT_CONFIGURED" });
  try {
    const sender = await supabaseUser(req);
    const recipient = String(req.body?.recipient || "").trim();
    if (!sender) return res.status(401).json({ error: "AUTH_REQUIRED" });
    if (!/^[0-9a-f-]{36}$/i.test(recipient)) return res.status(400).json({ error: "INVALID_RECIPIENT" });
    const devicesResponse = await supabaseRest(`push_devices?user_id=eq.${encodeURIComponent(recipient)}&select=expo_push_token`);
    if (!devicesResponse.ok) return res.status(502).json({ error: "PUSH_DEVICE_LOOKUP_FAILED" });
    const devices = await devicesResponse.json();
    const tokens = [...new Set(devices.map((row) => row.expo_push_token).filter((token) => /^ExponentPushToken\[.+\]$/.test(token)))];
    if (!tokens.length) return res.json({ ok: true, sent: 0 });
    const profileResponse = await supabaseRest(`profiles?id=eq.${encodeURIComponent(sender.id)}&select=full_name,username`);
    const profile = profileResponse.ok ? (await profileResponse.json())[0] : null;
    const title = profile?.full_name || profile?.username || "Xabarim";
    const body = String(req.body?.body || "Yangi xabar").trim().slice(0, 180);
    const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tokens.map((to) => ({ to, sound: "default", title, body, channelId: "messages", data: { url: "https://www.xabarim.uz/pages/main.html" } }))) });
    if (!pushResponse.ok) return res.status(502).json({ error: "PUSH_DELIVERY_FAILED" });
    return res.json({ ok: true, sent: tokens.length });
  } catch (error) {
    console.error("Push delivery failed:", error);
    return res.status(500).json({ error: "PUSH_DELIVERY_FAILED" });
  }
});
app.post("/api/telegram/link", async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!botToken || !serviceKey || !url || !anonKey) return res.status(503).json({ error: "TELEGRAM_REWARD_NOT_CONFIGURED" });
  try {
    const user = await supabaseUser(req);
    if (!user) return res.status(401).json({ error: "AUTH_REQUIRED" });
    const auth = req.body || {};
    if (!auth.hash || !/^\d+$/.test(String(auth.id)) || !Number.isFinite(Number(auth.auth_date)) || Date.now() / 1000 - Number(auth.auth_date) > 86400 || Number(auth.auth_date) > Date.now() / 1000 + 60) return res.status(400).json({ error: "TELEGRAM_AUTH_INVALID" });
    const checkString = Object.keys(auth).filter((key) => key !== "hash").sort().map((key) => `${key}=${auth[key]}`).join("\n");
    const secret = crypto.createHash("sha256").update(botToken).digest();
    const expected = crypto.createHmac("sha256", secret).update(checkString).digest();
    const received = Buffer.from(auth.hash, "hex");
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return res.status(400).json({ error: "TELEGRAM_AUTH_INVALID" });
    const linked = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/link_telegram_account`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_user_id: user.id, p_telegram_id: String(auth.id) }),
    });
    if (!linked.ok) {
      const message = await linked.text();
      if (/TELEGRAM_ACCOUNT_ALREADY_LINKED/i.test(message)) return res.status(409).json({ error: "TELEGRAM_ACCOUNT_ALREADY_LINKED" });
      console.error("Telegram account link failed:", message);
      return res.status(500).json({ error: "TELEGRAM_LINK_FAILED" });
    }
    return res.json({ ok: true, telegram_id: String(auth.id) });
  } catch (error) {
    console.error("Telegram account link failed:", error);
    return res.status(502).json({ error: "TELEGRAM_LINK_FAILED" });
  }
});
app.post("/api/rewards/telegram", async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const chatId = process.env.TELEGRAM_CHAT_ID || "@ahmedov_2604";
  if (!botToken || !serviceKey || !url || !anonKey) return res.status(503).json({ error: "TELEGRAM_REWARD_NOT_CONFIGURED" });
  try {
    const user = await supabaseUser(req);
    if (!user) return res.status(401).json({ error: "AUTH_REQUIRED" });
    const profileResponse = await fetch(`${url.replace(/\/$/, "")}/rest/v1/telegram_account_links?user_id=eq.${encodeURIComponent(user.id)}&select=telegram_id`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const profile = profileResponse.ok ? (await profileResponse.json())[0] : null;
    if (!profile?.telegram_id) return res.status(400).json({ error: "TELEGRAM_ACCOUNT_NOT_LINKED" });
    const memberResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${encodeURIComponent(profile.telegram_id)}`);
    const memberResult = await memberResponse.json();
    const member = memberResult.result;
    if (!memberResult.ok) {
      console.error("Telegram membership check failed:", memberResult.description);
      return res.status(503).json({ error: "TELEGRAM_MEMBERSHIP_CHECK_UNAVAILABLE" });
    }
    const isMember = memberResult.ok && member && (["creator", "administrator", "member"].includes(member.status) || (member.status === "restricted" && member.is_member));
    if (!isMember) return res.status(403).json({ error: "TELEGRAM_MEMBERSHIP_REQUIRED" });
    const claimResponse = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/claim_telegram_reward`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_user_id: user.id }),
    });
    if (!claimResponse.ok) {
      const message = await claimResponse.text();
      if (/TELEGRAM_REWARD_ALREADY_CLAIMED/i.test(message)) return res.status(409).json({ error: "TELEGRAM_REWARD_ALREADY_CLAIMED" });
      console.error("Telegram reward RPC failed:", message);
      return res.status(500).json({ error: "REWARD_CLAIM_FAILED" });
    }
    return res.json({ ok: true, xcoin_balance: await claimResponse.json() });
  } catch (error) {
    console.error("Telegram reward verification failed:", error);
    return res.status(502).json({ error: "TELEGRAM_CHECK_FAILED" });
  }
});
// faqat ochiq papkalar beriladi (.env, server.js va h.k. tashqariga chiqmaydi)
["css", "js", "img", "pages", "music"].forEach((d) => app.use("/" + d, express.static(path.join(__dirname, d))));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/sitemap.xml", (_, res) => res.sendFile(path.join(__dirname, "sitemap.xml")));
// anon key ochiq bo'lishi mumkin (xavfsizlik RLS orqali). service_role kalitini HECH QACHON bu yerga qo'ymang.
app.get("/config.js", (_, res) => {
  res.type("js").send(`window.XABARIM_CONFIG=${JSON.stringify({ url: process.env.SUPABASE_URL || "", anonKey: process.env.SUPABASE_ANON_KEY || "", telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || "" })};`);
});
app.listen(process.env.PORT || 3000, () => console.log("Xabarim: http://localhost:" + (process.env.PORT || 3000)));
