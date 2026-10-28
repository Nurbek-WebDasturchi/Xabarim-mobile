const { serviceKey, supabaseUser, rest } = require("./common");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  if (!serviceKey()) return res.status(503).json({ error: "PUSH_NOT_CONFIGURED" });
  try {
    const sender = await supabaseUser(req);
    if (!sender) return res.status(401).json({ error: "AUTH_REQUIRED" });
    const recipient = String(req.body?.recipient || "").trim();
    const body = String(req.body?.body || "Yangi xabar").trim().slice(0, 180);
    const messageId = String(req.body?.message_id || "").slice(0, 80);
    if (!/^[0-9a-f-]{36}$/i.test(recipient)) return res.status(400).json({ error: "INVALID_RECIPIENT" });
    const devicesResponse = await rest(`push_devices?user_id=eq.${encodeURIComponent(recipient)}&select=expo_push_token`);
    if (!devicesResponse.ok) return res.status(502).json({ error: "PUSH_DEVICE_LOOKUP_FAILED" });
    const devices = await devicesResponse.json();
    const tokens = [...new Set(devices.map((row) => row.expo_push_token).filter((token) => /^ExponentPushToken\[.+\]$/.test(token)))];
    if (!tokens.length) return res.json({ ok: true, sent: 0 });
    const profileResponse = await rest(`profiles?id=eq.${encodeURIComponent(sender.id)}&select=full_name,username`);
    const profile = profileResponse.ok ? (await profileResponse.json())[0] : null;
    const title = profile?.full_name || profile?.username || "Xabarim";
    const payload = tokens.map((to) => ({ to, sound: "default", title, body, channelId: "messages", data: { url: `${process.env.PUBLIC_APP_URL || "https://www.xabarim.uz"}/pages/main.html${messageId ? `?message=${encodeURIComponent(messageId)}` : ""}` } }));
    const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!pushResponse.ok) return res.status(502).json({ error: "PUSH_DELIVERY_FAILED" });
    return res.json({ ok: true, sent: tokens.length });
  } catch (error) {
    console.error("Push delivery failed", error);
    return res.status(500).json({ error: "PUSH_DELIVERY_FAILED" });
  }
};
