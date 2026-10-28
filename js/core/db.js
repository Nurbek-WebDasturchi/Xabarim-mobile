// Ma'lumotlar qatlami (Supabase). Rasmlar yuklashdan oldin brauzerda siqiladi.
const Cfg = window.XABARIM_CONFIG || {};
const sb = Cfg.url ? supabase.createClient(Cfg.url, Cfg.anonKey) : null;
const MAX = 100 * 1024 * 1024, MAX_IMG = 30 * 1024 * 1024; // fayl/video 100 MB, rasm asli 30 MB gacha (siqiladi)
const ok = ({ data, error }) => { if (error) throw error; return data; };
const group = (ms, me, peers) => {
  const g = {};
  ms.forEach((x) => { const id = x.sender === me ? x.receiver : x.sender; (g[id] ??= { last: x, unread: 0 }).unread += x.receiver === me && !x.read ? 1 : 0; });
  return Object.entries(g).filter(([id]) => peers[id]).map(([id, v]) => ({ peer: peers[id], ...v }));
};
// Rasmni max px gacha kichraytirib, JPEG ~900 KB dan oshmaguncha siqadi (odatda 3-10 MB -> 200-600 KB)
async function squeeze(file, max, maxBytes = 900 * 1024, quality = 0.82) {
  const bmp = await createImageBitmap(file);
  let k = Math.min(1, max / Math.max(bmp.width, bmp.height)), q = quality, out;
  for (let i = 0; i < 7; i++) {
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    out = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
    if (out.size <= maxBytes) break;
    k *= 0.8; q *= 0.9;
  }
  return new File([out], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}
// iPhone .mov (video/quicktime) ba'zi brauzerlarda file.type'ni bo'sh qaytaradi: kengaytmadan aniqlaymiz
const EXT_TYPES = { mov: "video/quicktime", mp4: "video/mp4", m4v: "video/x-m4v", "3gp": "video/3gpp", webm: "video/webm", mkv: "video/x-matroska" };
const fixType = (file) => {
  if (file.type && file.type !== "application/octet-stream") return file;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return EXT_TYPES[ext] ? new File([file], file.name, { type: EXT_TYPES[ext], lastModified: file.lastModified }) : file;
};
const DB = {
  sb,
  fixType,
  async prepare(file, max = 1600, maxBytes = 900 * 1024, quality = 0.82) {
    file = fixType(file);
    if (/^image\/(jpeg|png|webp|bmp)$/.test(file.type) && file.size <= MAX_IMG) { try { return await squeeze(file, max, maxBytes, quality); } catch {} }
    if (file.size > MAX) throw new Error("big"); // boshqa fayllar (pdf, zip, video) siqilmaydi, faqat 100 MB limit
    return file;
  },
  async me() {
    if (!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    return (await sb.from("profiles").select("*").eq("id", session.user.id).single()).data;
  },
  async signup(u, p, name, referralCode = "") { const { error } = await sb.auth.signUp({ email: `${u}@xabarim.uz`, password: p, options: { data: { username: u, full_name: name, referral_code: referralCode } } }); if (error) throw error; },
  async login(u, p) { const { error } = await sb.auth.signInWithPassword({ email: `${u}@xabarim.uz`, password: p }); if (error) throw error; },
  async google() { const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + "/pages/main.html" } }); if (error) throw error; },
  async linkGoogle() { const { error } = await sb.auth.linkIdentity({ provider: "google", options: { redirectTo: location.origin + "/pages/main.html", queryParams: { prompt: "select_account" } } }); if (error) throw error; },
  async googleIdentities() { return ok(await sb.auth.getUserIdentities()); },
  async unlinkGoogle(identity) { return ok(await sb.auth.unlinkIdentity(identity)); },
  async verifyGoogle() { return ok(await sb.rpc("verify_google_account")); },
  async resetGoogleVerification() { return ok(await sb.rpc("reset_google_verification")); },
  async buyPremium() { return ok(await sb.rpc("buy_xabarim_premium")); },
  async sendXcoin(username, amount) { return ok(await sb.rpc("send_xcoin", { p_receiver_username: username, p_amount: amount })); },
  async claimTelegramReward() {
    const { data: { session } } = await sb.auth.getSession();
    const response = await fetch("/api/rewards/telegram", { method: "POST", headers: { Authorization: `Bearer ${session?.access_token || ""}` } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(result.error || "TELEGRAM_CHECK_FAILED"); error.code = result.error; throw error; }
    return result.xcoin_balance;
  },
  async linkTelegramAccount(telegramAuth) {
    const { data: { session } } = await sb.auth.getSession();
    const response = await fetch("/api/telegram/link", { method: "POST", headers: { Authorization: `Bearer ${session?.access_token || ""}`, "Content-Type": "application/json" }, body: JSON.stringify(telegramAuth) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(result.error || "TELEGRAM_LINK_FAILED"); error.code = result.error; throw error; }
    return result.telegram_id;
  },
  async out() { try { await sb?.auth.signOut(); } finally { location.href = "/pages/auth/login.html"; } },
  async save(id, p) { return ok(await sb.from("profiles").update(p).eq("id", id).select().single()); },
  async touchPresence() { return ok(await sb.rpc("touch_presence")); },
  chatLive(me, peer, onProfile, onTyping) {
    const topic = `chat-live:${[me, peer].sort().join(":")}`;
    return sb.channel(topic)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${peer}` }, (p) => onProfile(p.new))
      .on("broadcast", { event: "typing" }, ({ payload }) => { if (payload?.user_id === peer) onTyping(!!payload.typing); })
      .subscribe();
  },
  sendTyping(channel, userId, typing) { return channel?.send({ type: "broadcast", event: "typing", payload: { user_id: userId, typing } }); },
  closeChannel(channel) { if (channel) sb.removeChannel(channel); },
  // opts.onProgress(loaded, total) berilsa XHR orqali yuklanadi (foiz ko'rsatish uchun); opts.signal bilan bekor qilinadi.
  async upload(bucket, uid, file, opts = {}) {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `${uid}/${token}-${file.name.replace(/[^\w.-]/g, "_")}`;
    if (!opts.onProgress) {
      const { error } = await sb.storage.from(bucket).upload(path, file);
      if (error) throw error;
      return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }
    const { data: { session } } = await sb.auth.getSession();
    await new Promise((resolve, reject) => {
      if (opts.signal?.aborted) return reject(new Error("aborted"));
      const x = new XMLHttpRequest();
      x.open("POST", `${Cfg.url.replace(/\/$/, "")}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`);
      x.setRequestHeader("apikey", Cfg.anonKey);
      x.setRequestHeader("Authorization", `Bearer ${session?.access_token || Cfg.anonKey}`);
      x.setRequestHeader("x-upsert", "false");
      x.setRequestHeader("cache-control", "max-age=3600");
      x.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      x.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress(e.loaded, e.total); };
      x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(Object.assign(new Error(x.status === 413 ? "big" : "upload_failed"), { status: x.status, body: x.responseText })));
      x.onerror = () => reject(new Error("network"));
      x.onabort = () => reject(new Error("aborted"));
      opts.signal?.addEventListener("abort", () => x.abort(), { once: true });
      x.send(file);
    });
    return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  },
  // Storage ichida server tomonda nusxa: katta videoni brauzerga yuklab, qayta yuklash shart bo'lmaydi.
  async copyFile(url, uid, fileName) {
    const root = new URL(Cfg.url), source = new URL(url);
    const marker = `${root.pathname.replace(/\/$/, "")}/storage/v1/object/public/files/`;
    if (source.origin !== root.origin || !source.pathname.includes(marker)) throw new Error("COPY_SOURCE_UNSUPPORTED");
    const from = decodeURIComponent(source.pathname.slice(source.pathname.indexOf(marker) + marker.length));
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `${uid}/${token}-${String(fileName || "file").replace(/[^\w.-]/g, "_")}`;
    const { error } = await sb.storage.from("files").copy(from, path);
    if (error) throw error;
    return sb.storage.from("files").getPublicUrl(path).data.publicUrl;
  },
  async find(q, me) { q = q.replace(/[,()%*]/g, "").trim(); return ok(await sb.from("profiles").select("*").or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).neq("id", me).limit(20)) || []; },
  async profile(id) { return (await sb.from("profiles").select("*").eq("id", id).single()).data; },
  // "Do'stlarni kashf qilish": bazadagi barcha foydalanuvchilar (o'zim va allaqachon do'stlarim tashqari), sahifalab
  async explore(me, skip, offset = 0, limit = 10) {
    const out = []; let pos = offset;
    for (;;) {
      const rows = ok(await sb.from("profiles").select("id,username,full_name,avatar_url,bio,last_seen,google_verified,premium,premium_until,official").neq("id", me).order("last_seen", { ascending: false, nullsFirst: false }).order("id").range(pos, pos + 49)) || [];
      for (const r of rows) {
        pos++;
        if (skip.has(r.id)) continue;
        out.push(r);
        if (out.length >= limit) return { rows: out, next: pos, done: false };
      }
      if (rows.length < 50) return { rows: out, next: pos, done: true };
    }
  },
  async profiles(ids, fields = "*") { return ok(await sb.from("profiles").select(fields).in("id", ids)) || []; },
  async chats(me) {
    // "Tarixni tozalash" qilingan suhbatlar xabarsiz ham ro'yxatda qoladi (schema_v14.sql; yo'q bo'lsa jim o'tadi)
    const [messagesResult, clearsResult] = await Promise.all([
      sb.from("messages").select("id,sender,receiver,body,file_url,file_type,file_name,created_at,read,delivered_at,room_id").is("room_id", null).or(`sender.eq.${me},receiver.eq.${me}`).order("created_at", { ascending: false }).limit(300),
      sb.from("chat_clears").select("peer,cleared_at").eq("user_id", me).eq("keep", true).then((r) => r.error ? [] : r.data || []).catch(() => []),
    ]);
    const ms = ok(messagesResult) || [], kept = clearsResult;
    const have = new Set(ms.map((x) => (x.sender === me ? x.receiver : x.sender)));
    const extra = kept.filter((k) => !have.has(k.peer));
    const ids = [...new Set([...have, ...extra.map((k) => k.peer)])];
    const ps = ids.length ? await DB.profiles(ids) : [];
    const pm = Object.fromEntries(ps.map((p) => [p.id, p]));
    const list = group(ms, me, pm);
    extra.forEach((k) => { if (pm[k.peer]) list.push({ peer: pm[k.peer], unread: 0, last: { id: "cleared-" + k.peer, cleared: true, created_at: k.cleared_at, sender: null, receiver: null, body: null } }); });
    return list.sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
  },
  // O'qilmagan chatlar soni = nechta odamdan xabar kelgan (schema_v10.sql: unread_chat_count)
  async unreadMessages(me) {
    const r = await sb.rpc("unread_chat_count");
    if (!r.error && typeof r.data === "number") return r.data;
    const rows = ok(await sb.from("messages").select("sender").eq("receiver", me).eq("read", false).is("room_id", null).limit(1000)) || [];
    return new Set(rows.map((x) => x.sender)).size;
  },
  async msgs(me, t) {
    let q = sb.from("messages").select("*");
    q = t.type === "room" ? q.eq("room_id", t.id) : q.or(`and(sender.eq.${me},receiver.eq.${t.id}),and(sender.eq.${t.id},receiver.eq.${me})`);
    return ok(await q.order("created_at").limit(300)) || [];
  },
  async replyMessages(ids) {
    if (!ids.length) return [];
    return ok(await sb.from("messages").select("*").in("id", ids)) || [];
  },
  // O'zimga yuborilgan xabar (Saqlangan xabarlar) darhol o'qilgan hisoblanadi, o'qilmagan sonida chiqmaydi.
  // fwd_* ustunlari schema_v15.sql bilan keladi; migratsiyasiz muallif ma'lumotini yo'qotib yubormaymiz.
  async send(me, t, m) {
    const row = { ...(t.type === "room" ? { room_id: t.id } : { receiver: t.id, ...(t.id === me ? { read: true } : {}) }), ...m };
    const r = await sb.from("messages").insert(row).select().single();
    if (r.error?.code === "PGRST204" && ("fwd_name" in row || "fwd_from" in row)) {
      const error = new Error("FWD_SCHEMA_REQUIRED"); error.code = "FWD_SCHEMA_REQUIRED"; throw error;
    }
    return ok(r);
  },
  // "o'qildi" (read_at / delivered_at ni schema_v4.sql dagi trigger o'zi qo'yadi)
  async read(me, peer) { await sb.from("messages").update({ read: true }).eq("sender", peer).eq("receiver", me).eq("read", false); },
  // "yetkazildi": xabar qabul qiluvchining qurilmasiga yetib bordi (schema_v4.sql kerak; yo'q bo'lsa jim o'tadi)
  async delivered(me) { try { await sb.from("messages").update({ delivered_at: new Date().toISOString() }).eq("receiver", me).is("delivered_at", null); } catch {} },
  listen(onIns, onUpd, onDel) {
    sb.channel("inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => onIns(p.new))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p) => onUpd && onUpd(p.new))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => onDel && onDel(p.old))
      .subscribe();
  },
  // xabarga reaksiya (schema_v19.sql): bir odam bir xabarga bitta stiker. Jadval yo'q bo'lsa jim o'tadi.
  async msgReactions(ids) {
    if (!ids?.length) return [];
    try { const r = await sb.from("message_reactions").select("message_id,user_id,emoji").in("message_id", ids); return r.error ? [] : r.data || []; } catch { return []; }
  },
  async reactMsg(me, id, emoji) { ok(await sb.from("message_reactions").upsert({ message_id: id, user_id: me, emoji }, { onConflict: "message_id,user_id" })); },
  async unreactMsg(me, id) { ok(await sb.from("message_reactions").delete().eq("message_id", id).eq("user_id", me)); },
  listenReactions(cb) {
    sb.channel("message-reactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (p) => cb(p.eventType, p.eventType === "DELETE" ? p.old : p.new))
      .subscribe();
  },
  // xabarni o'chirish (schema_v12.sql): o'zimniki, guruhda esa egasi istalganini. Faylni xotiradan ham olib tashlaymiz.
  async delMessage(me, m) {
    const rows = ok(await sb.from("messages").delete().eq("id", m.id).select("id")) || [];
    if (!rows.length) throw new Error("denied");
    const path = m.sender === me && /\/object\/public\/files\/(.+)$/.exec(m.file_url || "")?.[1];
    if (path) { try { await sb.storage.from("files").remove([decodeURIComponent(path)]); } catch {} }
  },
  // suhbat tarixini faqat o'zim uchun tozalash (suhbatni o'chirish ham shu; suhbatdoshda xabarlar qoladi)
  // both=true: suhbatdoshda ham o'chadi (schema_v13.sql). Faylni faqat o'zimning papkamdan olib tashlay olaman.
  async clearChat(me, peer, both, keep) {
    let paths = [];
    if (both) {
      try {
        const rows = ok(await sb.from("messages").select("file_url").eq("sender", me).eq("receiver", peer).not("file_url", "is", null).limit(1000)) || [];
        paths = rows.map((r) => /\/object\/public\/files\/(.+)$/.exec(r.file_url || "")?.[1]).filter(Boolean).map(decodeURIComponent);
      } catch {}
    }
    let r = await sb.rpc("clear_chat", { p_peer: peer, p_both: !!both, p_keep: !!keep });
    // schema_v14.sql hali ishga tushirilmagan bo'lsa: eski funksiya (suhbat ro'yxatdan ketadi)
    if (r.error && (r.error.code === "PGRST202" || r.error.code === "42883")) r = await sb.rpc("clear_chat", { p_peer: peer, p_both: !!both });
    ok(r);
    if (paths.length) { try { await sb.storage.from("files").remove(paths); } catch {} }
  },
  // xabarni faqat o'zim uchun o'chirish (schema_v13.sql)
  async hideMessage(id) { const { error } = await sb.from("message_hides").insert({ message_id: id }); if (error && error.code !== "23505") throw error; },
  // bloklash
  async blockedIds(me) { return (ok(await sb.from("blocks").select("blocked").eq("blocker", me).limit(1000)) || []).map((x) => x.blocked); },
  async block(id) { const { error } = await sb.from("blocks").insert({ blocked: id }); if (error && error.code !== "23505") throw error; },
  async unblock(me, id) { ok(await sb.from("blocks").delete().eq("blocker", me).eq("blocked", id)); },
  // do'stlar (contacts)
  async friends() { return ok(await sb.rpc("friend_list")) || []; },
  async addFriend(id) { const { error } = await sb.from("friends").insert({ friend_id: id }); if (error && error.code !== "23505") throw error; },
  async removeFriend(me, id) { ok(await sb.from("friends").delete().eq("user_id", me).eq("friend_id", id)); },
  // guruh va jamiyatlar
  async myRooms(me) { return (ok(await sb.from("room_members").select("rooms(*)").eq("user_id", me)) || []).map((x) => x.rooms).filter(Boolean); },
  async roomLastMessages(ids) {
    if (!ids.length) return {};
    const rows = ok(await sb.from("messages").select("id,room_id,sender,body,file_url,created_at,sender_profile:profiles!messages_sender_fkey(id,username,full_name,avatar_url)").in("room_id", ids).order("created_at", { ascending: false }).limit(1000)) || [];
    const latest = {};
    rows.forEach((m) => { if (!latest[m.room_id]) latest[m.room_id] = m; });
    return latest;
  },
  async unreadRoomMessages(roomId, me, after) {
    let q = sb.from("messages").select("id", { count: "exact", head: true }).eq("room_id", roomId).neq("sender", me);
    if (after) q = q.gt("created_at", after);
    const { count, error } = await q;
    return error ? 0 : count || 0;
  },
  async searchGroups(q) { q = q.replace(/[,%()*]/g, " ").trim().replace(/^@/, ""); if (!q) return []; return ok(await sb.from("rooms").select("*").eq("kind", "group").or(`name.ilike.%${q}%,username.ilike.%${q}%`).order("name").limit(50)) || []; },
  async groupByUsername(username) { return (await sb.from("rooms").select("*").eq("kind", "group").eq("username", username).maybeSingle()).data; },
  async communities() {
    // a'zolar soni: RLS tufayli room_members'dan to'g'ridan-to'g'ri sanab bo'lmaydi, shuning uchun rpc (schema_v3.sql)
    const [listResult, countsResult] = await Promise.all([
      sb.from("rooms").select("*").eq("kind", "community").order("name"),
      sb.rpc("community_counts"),
    ]);
    const list = ok(listResult) || [], { data } = countsResult;
    if (data) { const m = Object.fromEntries(data.map((x) => [x.room_id, x.members])); list.forEach((r) => (r.members = m[r.id] ?? 0)); }
    return list;
  },
  async join(rid, me) { ok(await sb.from("room_members").insert({ room_id: rid, user_id: me })); },
  async leave(rid, me) { ok(await sb.from("room_members").delete().eq("room_id", rid).eq("user_id", me)); },
  async roomMemberCount(rid) { const { count, error } = await sb.from("room_members").select("user_id", { count: "exact", head: true }).eq("room_id", rid); if (error) throw error; return count || 0; },
  async createGroup(name, username, users) { return ok(await sb.rpc("create_group", { p_name: name, p_username: username, p_usernames: users })); },
  async reportGroup(roomId, reason, details) { ok(await sb.from("group_reports").insert({ room_id: roomId, reason, details: details || null })); },
  async banUser(userId, reason, details, language) {
    return ok(await sb.rpc("ban_user", { p_target: userId, p_reason: reason, p_details: details || null, p_language: language || "uz" }));
  },
  // note (24 soat) va postlar
  // note'lar: o'zim + obuna bo'lganlarim + suhbatdoshlarim (schema_v4.sql: feed_notes). Yo'q bo'lsa eski usul.
  async feedNotes(me, extraIds) {
    const { data, error } = await sb.rpc("feed_notes");
    if (!error && data) return data;
    return DB.notes([me, ...extraIds]);
  },
  async notes(ids) { return ok(await sb.from("notes").select("*").in("user_id", ids).gt("created_at", new Date(Date.now() - 864e5).toISOString())) || []; },
  // schema_v10.sql: set_note() eski (24 soatdan oshgan) note ustiga yozishdagi RLS xatosini tuzatadi; funksiya yo'q bo'lsa eski usul
  async setNote(me, text) {
    const { error } = await sb.rpc("set_note", { p_text: text });
    if (!error) return;
    if (error.code !== "PGRST202" && error.code !== "42883") throw error;
    ok(await sb.from("notes").upsert({ user_id: me, text, created_at: new Date().toISOString() }, { onConflict: "user_id" }));
  },
  async delNote(me) { ok(await sb.from("notes").delete().eq("user_id", me)); },
  async noteReactions(ids) {
    if (!ids?.length) return [];
    return ok(await sb.from("note_reactions").select("note_user,user_id,emoji").in("note_user", ids)) || [];
  },
  async reactNote(noteUser, userId, emoji) {
    ok(await sb.from("note_reactions").upsert({ note_user: noteUser, user_id: userId, emoji }, { onConflict: "note_user,user_id" }));
  },
  async unreactNote(noteUser, userId) {
    ok(await sb.from("note_reactions").delete().eq("note_user", noteUser).eq("user_id", userId));
  },
  async posts(onlyFollowing, followingIds) {
    if (onlyFollowing) {
      const { data, error } = await sb.rpc("feed_posts", { p_limit: 50 });
      if (!error && data) {
        const ps = await DB.profiles([...new Set(data.map((x) => x.author))]);
        data.forEach((x) => (x.profiles = ps.find((p) => p.id === x.author)));
        return data;
      }
      const all = await DB.posts(false); // schema_v4.sql yo'q: oxirgi postlardan filtrlaymiz
      return all.filter((x) => followingIds?.has(x.author));
    }
    // Global lenta: hamma foydalanuvchilarning postlari (obuna shart emas).
    // 1) schema_v18.sql dagi global_posts() (RLS/grant muammosini chetlab o'tadi), 2) jadvaldan to'g'ridan-to'g'ri
    const viaRpc = await sb.rpc("global_posts", { p_limit: 50 });
    if (!viaRpc.error && viaRpc.data) {
      const ps = viaRpc.data.length ? await DB.profiles([...new Set(viaRpc.data.map((x) => x.author))]) : [];
      viaRpc.data.forEach((x) => (x.profiles = ps.find((p) => p.id === x.author)));
      return viaRpc.data;
    }
    const embedded = await sb.from("posts").select("*, profiles(username,full_name,avatar_url,google_verified,premium,premium_until,official)").order("created_at", { ascending: false }).limit(50);
    if (!embedded.error) return embedded.data || [];
    const rows = ok(await sb.from("posts").select("*").order("created_at", { ascending: false }).limit(50)) || [];
    const ps = rows.length ? await DB.profiles([...new Set(rows.map((x) => x.author))]) : [];
    rows.forEach((x) => (x.profiles = ps.find((p) => p.id === x.author)));
    return rows;
  },
  // akkauntdagi postlar soni (postlarni o'zini yuklamasdan)
  async userPostCount(userId) {
    const { count, error } = await sb.from("posts").select("id", { count: "exact", head: true }).eq("author", userId);
    if (error) throw error;
    return count || 0;
  },
  async userPosts(userId) {
    const rows = ok(await sb.from("posts").select("*").eq("author", userId).order("created_at", { ascending: false }).limit(50)) || [];
    const profile = await DB.profile(userId);
    return rows.map((post) => ({ ...post, profiles: profile }));
  },
  async postById(postId) {
    const post = ok(await sb.from("posts").select("*").eq("id", postId).maybeSingle());
    if (!post) return null;
    post.profiles = await DB.profile(post.author);
    return post;
  },
  async postEngagement(postIds, me) {
    if (!postIds.length) return { comments: [], reactions: [] };
    const [c, r] = await Promise.all([
      sb.from("post_comments").select("id,post_id,user_id,body,created_at,profiles!post_comments_user_id_fkey(id,username,full_name,avatar_url)").in("post_id", postIds).order("created_at"),
      sb.from("post_reactions").select("post_id,user_id,emoji,created_at").in("post_id", postIds),
    ]);
    if (c.error) throw c.error; if (r.error) throw r.error;
    return { comments: c.data || [], reactions: r.data || [] };
  },
  async react(postId, emoji) { const { error } = await sb.from("post_reactions").upsert({ post_id: postId, user_id: (await sb.auth.getUser()).data.user.id, emoji }, { onConflict: "post_id,user_id" }); if (error) throw error; },
  async unreact(postId) { const { data: { user } } = await sb.auth.getUser(); ok(await sb.from("post_reactions").delete().eq("post_id", postId).eq("user_id", user.id)); },
  async comment(postId, body) { ok(await sb.from("post_comments").insert({ post_id: postId, body })); },
  async notifications() {
    const rows = ok(await sb.from("notifications").select("id,actor,kind,post_id,body,created_at,read_at,actor_profile:profiles!notifications_actor_fkey(id,username,full_name,avatar_url)").order("created_at", { ascending: false }).limit(100)) || [];
    return rows.map((r) => ({ ...r, actor: r.actor_profile }));
  },
  async readNotifications(ids) { if (ids.length) ok(await sb.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null)); },
  async submitSupportQuestion(userId, question) {
    const text = String(question || "").trim();
    if (text.length < 5 || text.length > 3000) throw new Error("question_length");
    return ok(await sb.from("support_questions").insert({ user_id: userId, question: text }));
  },
  listenNotifications(me, onChange) { sb.channel("xabarim-notifications").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient=eq.${me}` }, onChange).subscribe(); },
  async addPost(p) {
    const { data: { user }, error } = await sb.auth.getUser();
    if (error) throw error;
    if (!user) throw new Error("auth required");
    ok(await sb.from("posts").insert({ ...p, author: user.id }));
  },
  // obunachilar / obunalar (Instagram kabi)
  async stats(id) { const d = ok(await sb.rpc("follow_stats", { p_user: id })); return Array.isArray(d) ? d[0] : d; },
  async followingIds(me) { return (ok(await sb.from("follows").select("following").eq("follower", me).limit(1000)) || []).map((x) => x.following); },
  async follow(id) { const { error } = await sb.from("follows").insert({ following: id }); if (error && error.code !== "23505") throw error; },
  async unfollow(me, id) { ok(await sb.from("follows").delete().eq("follower", me).eq("following", id)); },
  async followList(id, kind) { return ok(await sb.rpc("follow_list", { p_user: id, p_kind: kind })) || []; },
  async delPost(id) { ok(await sb.from("posts").delete().eq("id", id)); },
  async deleteGroup(id) { return ok(await sb.rpc("delete_group", { p_room: id })); },
  async isGroupOwner(id, userId) {
    const { data, error } = await sb.from("room_members").select("role").eq("room_id", id).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data?.role === "owner";
  },
};
