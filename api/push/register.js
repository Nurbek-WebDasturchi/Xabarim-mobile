const { serviceKey, supabaseUser, rest } = require("./common");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  if (!serviceKey()) return res.status(503).json({ error: "PUSH_NOT_CONFIGURED" });
  try {
    const user = await supabaseUser(req);
    if (!user) return res.status(401).json({ error: "AUTH_REQUIRED" });
    const token = String(req.body?.token || "").trim();
    const platform = String(req.body?.platform || "android").slice(0, 20);
    if (!/^ExponentPushToken\[.+\]$/.test(token)) return res.status(400).json({ error: "INVALID_PUSH_TOKEN" });
    const response = await rest("push_devices?on_conflict=user_id,expo_push_token", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: user.id, expo_push_token: token, platform, updated_at: new Date().toISOString() }),
    });
    if (!response.ok) return res.status(502).json({ error: "PUSH_TOKEN_SAVE_FAILED", detail: await response.text() });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Push token registration failed", error);
    return res.status(500).json({ error: "PUSH_TOKEN_SAVE_FAILED" });
  }
};
