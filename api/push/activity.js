const { serviceKey, supabaseUser, rest } = require('./common');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!serviceKey()) return res.status(503).json({ error: 'PUSH_NOT_CONFIGURED' });
  try {
    const actor = await supabaseUser(req);
    if (!actor) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    const recipient = String(req.body?.recipient || '');
    const kind = req.body?.kind;
    if (!/^[0-9a-f-]{36}$/i.test(recipient) || recipient === actor.id || !['like', 'follow'].includes(kind)) return res.status(400).json({ error: 'INVALID_ACTIVITY' });
    const [devicesResponse, profileResponse] = await Promise.all([
      rest(`push_devices?user_id=eq.${encodeURIComponent(recipient)}&select=expo_push_token`),
      rest(`profiles?id=eq.${encodeURIComponent(actor.id)}&select=full_name,username`),
    ]);
    if (!devicesResponse.ok) return res.status(502).json({ error: 'PUSH_DEVICE_LOOKUP_FAILED' });
    const devices = await devicesResponse.json();
    const tokens = [...new Set(devices.map((row) => row.expo_push_token).filter((token) => /^ExponentPushToken\[.+\]$/.test(token)))];
    if (!tokens.length) return res.json({ ok: true, sent: 0 });
    const profile = profileResponse.ok ? (await profileResponse.json())[0] : null;
    const name = profile?.full_name || profile?.username || 'Kimdir';
    const notification = kind === 'like' ? { title: 'Yangi yoqtirish ❤️', body: `${name} postingizga like bosdi`, url: 'xabarim://feed' } : { title: 'Yangi kuzatuvchi ✨', body: `${name} sizni kuzatishni boshladi`, url: 'xabarim://friends' };
    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tokens.map((to) => ({ to, ...notification, sound: 'default', channelId: 'xabarim-alerts-v1', priority: 'high', data: { url: notification.url } }))) });
    if (!pushResponse.ok) return res.status(502).json({ error: 'PUSH_DELIVERY_FAILED' });
    return res.json({ ok: true, sent: tokens.length });
  } catch (error) {
    console.error('Activity push delivery failed', error);
    return res.status(500).json({ error: 'PUSH_DELIVERY_FAILED' });
  }
};
