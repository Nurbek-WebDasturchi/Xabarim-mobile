const supabaseUrl = () => String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = () => process.env.SUPABASE_ANON_KEY || "";
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function supabaseUser(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !supabaseUrl() || !anonKey()) return null;
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: anonKey(), Authorization: `Bearer ${token}` },
  });
  return response.ok ? response.json() : null;
}

async function rest(path, options = {}) {
  return fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey(),
      Authorization: `Bearer ${serviceKey()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

module.exports = { supabaseUrl, serviceKey, supabaseUser, rest };
