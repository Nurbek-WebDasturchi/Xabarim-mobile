(async () => {
  const $ = (s) => document.querySelector(s),
    t = (k, p) => Lang.t(k, p);
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const url = (u) => (/^(https?:|blob:)/.test(u) ? esc(u) : "#");
  const AV = "/img/user-profile.svg";
  const av = (p) => (p && p.avatar_url ? url(p.avatar_url) : AV);
  const hasPremium = (p) =>
    !!p?.premium && (!p.premium_until || new Date(p.premium_until).getTime() > Date.now());
  const accountBadges = (p) =>
    `${p?.official ? `<span class="official-badge" title="${esc(t("official_service"))}"><i class="bi bi-patch-check-fill"></i></span>` : ""}${hasPremium(p) ? `<span class="premium-badge" title="${esc(t("premium_title"))}"><i class="bi bi-patch-check-fill"></i></span>` : ""}`;
  const ic = (n) =>
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='#654dff'/><text x='32' y='43' font-size='30' text-anchor='middle' fill='#fff' font-family='sans-serif'>${esc((n || "?")[0].toUpperCase())}</text></svg>`,
    );
  const hm = (d) =>
    new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dt = (d) =>
    new Date(d).toLocaleString([], {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  const size = (n) =>
    n > 1048576
      ? (n / 1048576).toFixed(1) + " MB"
      : Math.max(1, Math.round(n / 1024)) + " KB";
  // iPhone .mov: eski xabarlarda file_type bo'sh/octet-stream bo'lishi mumkin, kengaytmadan aniqlaymiz
  const EXT_T = {
    mov: "video/quicktime",
    mp4: "video/mp4",
    m4v: "video/x-m4v",
    "3gp": "video/3gpp",
    webm: "video/webm",
  };
  const ftype = (m) => {
    const ty = m.file_type;
    if (ty && ty !== "application/octet-stream") return ty;
    return (
      EXT_T[
        String(m.file_name || "")
          .split(".")
          .pop()
          .toLowerCase()
      ] || ty
    );
  };
  const videoClock = (n) => {
    if (!Number.isFinite(n) || n < 0) return "0:00";
    const s = Math.floor(n),
      h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      r = s % 60;
    return h
      ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
      : `${m}:${String(r).padStart(2, "0")}`;
  };
  const toast = (m) => {
    const e = $("#toast");
    e.textContent = m;
    e.classList.add("show");
    clearTimeout(toast.h);
    toast.h = setTimeout(() => e.classList.remove("show"), 2600);
  };
  const fail = (e) =>
    toast(e && e.message === "big" ? t("too_big") : t("error"));
  const failData = (action, e) => {
    console.error(`${action} failed:`, e);
    if (e?.code === "42501" || e?.status === 403 || e?.statusCode === "403")
      toast(
        "Supabase ruxsati rad etildi. Oxirgi migratsiyani (schema_v12.sql) bajaring.",
      );
    else fail(e);
  };

  if (!DB.sb) {
    document.body.innerHTML = `<p class="p-4">${t("need_env")}</p>`;
    return;
  }
  const requestedGroup = new URLSearchParams(location.search).get("group");
  let me = await DB.me();
  if (!me) {
    if (requestedGroup)
      sessionStorage.setItem("xabarim-pending-group", requestedGroup);
    return (location.href = "/pages/auth/login.html");
  }

  // Expo WebView push bridge: the native shell sends its Expo token after the
  // authenticated web page is ready. The token is stored server-side so a
  // direct message can be delivered even while the APK is in the background.
  const registerNativePushToken = async (token) => {
    if (!token || !DB.sb) return;
    try {
      const { data } = await DB.sb.auth.getSession();
      const accessToken = data?.session?.access_token;
      if (!accessToken) return;
      const response = await fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token, platform: "android" }),
      });
      if (!response.ok) console.warn("Native push token registration failed", await response.text());
    } catch (error) {
      console.warn("Native push token registration failed", error);
    }
  };
  const nativePushTokenReady = () => registerNativePushToken(window.XABARIM_NATIVE_PUSH_TOKEN);
  window.addEventListener("xabarim-native-push-token", nativePushTokenReady);
  window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "xabarim-web-ready" }));
  nativePushTokenReady();
  const sendNativePush = async (recipient, body, messageId) => {
    if (!recipient || !DB.sb) return;
    try {
      const { data } = await DB.sb.auth.getSession();
      const accessToken = data?.session?.access_token;
      if (!accessToken) return;
      await fetch("/api/push/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ recipient, body: body || "Yangi xabar", message_id: messageId }),
      });
    } catch (error) {
      console.warn("Native push send failed", error);
    }
  };
  let googleEmail = "";
  try {
    const { identities = [] } = await DB.googleIdentities();
    const googleIdentity = identities.find((identity) => identity.provider === "google");
    googleEmail = String(googleIdentity?.identity_data?.email || "").trim();
    const synced = await DB.verifyGoogle();
    if (synced) me = synced;
  } catch (error) {
    if (/GOOGLE_GMAIL_REQUIRED/i.test(error?.message || "")) {
      me = { ...me, google_verified: false };
      try {
        const { identities = [] } = await DB.googleIdentities();
        const invalidGoogle = identities.find((identity) => identity.provider === "google");
        if (invalidGoogle) await DB.unlinkGoogle(invalidGoogle);
        const reset = await DB.resetGoogleVerification();
        if (reset) me = reset;
        googleEmail = "";
        if (invalidGoogle) toast("Faqat haqiqiy gmail.com qabul qilinadi. Boshqa Google hisob uzildi.");
      } catch (cleanupError) {
        console.warn("Gmail tasdiqlash holati tozalanmadi. schema_v23.sql migratsiyasini qo‘llang.", cleanupError);
      }
    } else console.warn("Google holati tekshirilmadi", error);
  }
  let tab = "posts",
    target = null,
    openTargetSeq = 0,
    liveChannel = null,
    peerTyping = false,
    typingActive = false,
    typingStopTimer = 0,
    typingHeartbeatTimer = 0,
    peerTypingStopTimer = 0,
    chats = [],
    rooms = [],
    comms = [],
    notes = {},
    noteOrder = [],
    following = new Set(),
    feedMode = "all",
    activeReply = null,
    noticeRows = [],
    knownNotificationIds = null,
    feedPosts = [],
    feedUser = null, // {id, name, focus}: akkaunt postlari lentasi (profildan ochilganda)
    feedSeq = 0,
    openNoteView = () => {},
    engagement = { comments: [], reactions: [] },
    loaded = new Map(),
    unreadTotal = 0,
    friends = [],
    exploreRows = [],
    exploreNext = 0,
    exploreDone = false,
    exploreBusy = false,
    friendIds = new Set(),
    blocked = new Set(),
    roomOwner = false,
    tmpN = 0,
    results = null;
  let groupResults = null;
  const known = { [me.id]: me };
  const roomSeenKey = `xabarim-room-seen:${me.id}`;
  let roomSeenAt = {};
  try { roomSeenAt = JSON.parse(localStorage.getItem(roomSeenKey) || "{}"); } catch {}
  const saveRoomSeen = () => {
    try { localStorage.setItem(roomSeenKey, JSON.stringify(roomSeenAt)); } catch {}
  };
  const markRoomSeen = (id, at = new Date().toISOString()) => {
    roomSeenAt[String(id)] = at;
    saveRoomSeen();
    const room = rooms.find((item) => String(item.id) === String(id));
    if (room) room.unreadCount = 0;
  };

  // ---- tema
  const setMode = (dark) => {
    document.body.classList.toggle("dark-mode", dark);
    document.documentElement.setAttribute(
      "data-bs-theme",
      dark ? "dark" : "light",
    );
    localStorage.setItem("mode", dark ? "dark" : "light");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#111111" : "#4f46e5");
    const c = $("#s-dark");
    if (c) c.checked = dark;
  };
  setMode(localStorage.getItem("mode") === "dark");
  const themeToggle = $("#theme-toggle");
  const updateThemeToggle = () => {
    const dark = document.body.classList.contains("dark-mode");
    [themeToggle, $("#desktop-theme-toggle")].filter(Boolean).forEach((button) => {
      const icon = button.querySelector("i");
      icon?.classList.toggle("bi-sun-fill", dark);
      icon?.classList.toggle("bi-moon-stars-fill", !dark);
      button.setAttribute("aria-label", dark ? "Light mode" : "Dark mode");
      button.title = dark ? "Light mode" : "Dark mode";
    });
  };
  updateThemeToggle();
  [themeToggle, $("#desktop-theme-toggle")].filter(Boolean).forEach((button) => {
    button.onclick = () => {
      setMode(!document.body.classList.contains("dark-mode"));
      updateThemeToggle();
    };
  });
  $("#notifications-btn").onclick = () =>
    setTab(tab === "notifications" ? "posts" : "notifications");

  // ---- panel almashtirish (empty / room / feed)
  const pane = (n) => {
    if (n !== "room") recCancel();
    ["empty", "room", "feed"].forEach((i) =>
      $("#" + i).classList.toggle("hide", i !== n),
    );
    const showNotificationIntro = n === "empty" && tab === "notifications";
    $("#notification-empty")?.classList.toggle("hide", !showNotificationIntro);
    $("#empty img").classList.toggle("hide", showNotificationIntro);
    $("#empty > h4").classList.toggle("hide", showNotificationIntro);
    $("#main").classList.toggle("chat-open", n === "room");
    $("#main").classList.toggle("feed-open", n === "feed");
  };

  // ---- ro'yxatlar
  const preview = (m) =>
    m.file_url
      ? ftype(m)?.startsWith("image/")
        ? "📷 " + t("photo")
        : ftype(m)?.startsWith("audio/")
          ? "🎤 " + t("voice_msg")
          : "📎 " + m.file_name
      : m.cleared
        ? t("history_cleared")
        : m.body;
  // xabar holati: yuborilmoqda -> yuborildi (qog'oz samolyot) -> yetkazildi (samolyot + belgi) -> ko'rildi (ko'z)
  const ST = {
    sending: "clock",
    sent: "send",
    delivered: "send-check-fill",
    read: "eye-fill",
  };
  const stKey = (m) =>
    m._tmp
      ? "sending"
      : m.room_id
        ? "sent"
        : m.read || m.read_at
          ? "read"
          : m.delivered_at
            ? "delivered"
            : "sent";
  const stIcon = (m, pop) =>
    `<i class="st st-${stKey(m)}${pop ? " pop" : ""} bi bi-${ST[stKey(m)]}"></i>`;
  const userCard = (p, sub, time, unread, st = "") =>
    `<li class="person-card${target?.type === "user" && target.id === p.id ? " active" : ""}" data-id="${esc(p.id)}"><button class="chat-avatar" type="button" data-profile="${esc(p.id)}" aria-label="${esc(p.full_name || p.username)} profilini ochish"><img class="username-img" src="${av(p)}" alt=""><span class="avatar-loading" aria-hidden="true"></span></button><div><div class="username"><span class="username-label">${esc(p.full_name || p.username)}</span>${accountBadges(p)}</div><p class="message-text">${st}${esc(sub)}</p></div><div class="d-flex flex-column align-items-center gap-1"><span class="recieve-time">${time}</span>${unread ? `<div class="new-badge">${unread}</div>` : ""}</div></li>`;
  const roomCard = (r, extra) => {
    const m = r.kind === "group" ? r.lastMessage : null;
    const previewText = m
      ? `${m.sender_profile?.full_name || m.sender_profile?.username || "User"}: ${m.body || (m.file_url ? "📎 Media" : "Xabar")}`
      : r.kind === "group"
        ? "Hali xabar yo‘q"
        : `${r.username ? `@${r.username}${r.description ? " · " : ""}` : ""}${r.members != null ? `👥 ${r.members} ${t("members_n")}${r.description ? " · " : ""}` : ""}${r.description || ""}`;
    return `<li class="person-card" data-rid="${r.id}"><img class="username-img" src="${ic(r.name)}" alt=""><div><div class="username">${esc(r.name)}</div><p class="message-text">${esc(previewText)}</p></div>${extra ? `<div class="room-actions">${extra}</div>` : "<span></span>"}</li>`;
  };
  // Bulutli note: matn oq bulutda, foydalanuvchi nomi kichik kulrang
  const renderNotes = () => {
    const el = $("#notes"),
      mine = notes[me.id];
    el.classList.toggle("hide", tab !== "chats");
    el.innerHTML =
      `<div class="note me" id="my-note" title="${esc(mine?.text || t("add_note"))}"><div class="note-cloud${mine?.text ? "" : " empty"}"><span>${esc(mine?.text || t("add_note"))}</span></div><div class="note-avatar"><img src="${av(me)}" alt=""><span class="note-add" aria-hidden="true"><i class="bi bi-plus"></i></span></div><small class="note-name">${t("you")}</small></div>` +
      noteOrder
        .filter((id) => notes[id] && known[id])
        .map(
          (id) =>
            `<div class="note" data-id="${esc(id)}" title="${esc(notes[id].text)}"><div class="note-cloud"><span>${esc(notes[id].text)}</span></div><div class="note-avatar"><img src="${av(known[id])}" alt=""></div><small class="note-name">${esc(known[id].full_name || known[id].username)}</small></div>`,
        )
        .join("");
  };
  const renderList = () => {
    $(".search-box").classList.toggle(
      "hide",
      !["chats", "friends", "groups", "communities", "posts"].includes(tab),
    );
    $("#search-toggle").classList.toggle(
      "hide",
      !["chats", "friends", "groups", "communities", "posts"].includes(tab),
    );
    $("#chat-categories").classList.toggle(
      "hide",
      !["chats", "groups", "communities"].includes(tab),
    );
    $("#chat-categories")
      .querySelectorAll("[data-chat-tab]")
      .forEach((b) => b.classList.toggle("on", b.dataset.chatTab === tab));
    renderNotes();
    let h = "";
    if (tab === "chats") {
      if (results)
        h = results.length
          ? results
              .map(
                (p) => (
                  (known[p.id] = p),
                  userCard(p, "@" + p.username, "", 0)
                ),
              )
              .join("")
          : `<li class="list-empty">${t("no_results")}</li>`;
      else
        h =
          (chats.some((c) => c.peer.id !== me.id)
            ? chats
                .filter((c) => c.peer.id !== me.id)
                .map(
                  (c) => (
                    (known[c.peer.id] = c.peer),
                    userCard(
                      c.peer,
                      preview(c.last),
                      hm(c.last.created_at),
                      c.unread,
                      c.last.sender === me.id
                        ? `<span class="chat-msg-status">${esc(t("st_" + stKey(c.last)))}</span> `
                        : "",
                    )
                  ),
                )
                .join("")
            : `<li class="list-empty">${t("no_chats")}</li>`);
    } else if (tab === "friends") {
      const q = $("#search").value.trim().toLocaleLowerCase();
      const list = q
        ? friends.filter(
            (p) =>
              (p.full_name || "").toLocaleLowerCase().includes(q) ||
              (p.username || "").toLocaleLowerCase().includes(q),
          )
        : friends;
      h = list.length
        ? list
            .map((p) => {
              known[p.id] = p;
              const on =
                p.last_seen && Date.now() - new Date(p.last_seen) < 120000;
              return userCard(
                p,
                on ? t("online") : "@" + p.username,
                "",
                chats.find((c) => c.peer.id === p.id)?.unread || 0,
              );
            })
            .join("")
        : `<li class="list-empty">${t(q ? "no_results" : "no_friends")}</li>`;
      if (!q) h += exploreHTML();
    } else if (tab === "groups") {
      const q = $("#search").value.trim().toLocaleLowerCase();
      const memberIds = new Set(rooms.map((r) => r.id));
      const g = q
        ? groupResults || []
        : rooms.filter((r) => r.kind === "group");
      h =
        `<li class="person-card" id="new-group"><span class="username-img add-ic"><i class="bi bi-plus-lg"></i></span><div class="username">${t("new_group")}</div><span></span></li>` +
        (g.length
          ? g
              .map((r) =>
                roomCard(
                  r,
                  `${memberIds.has(r.id) ? "" : `<button class="join-btn" data-join="${r.id}">${t("join")}</button>`}<button class="group-link-btn" data-copy-group="${esc(r.username || "")}" title="${t("copy_link")}"><i class="bi bi-link-45deg"></i></button>`,
                ),
              )
              .join("")
          : `<li class="list-empty">${q ? t("no_results") : t("no_groups")}</li>`);
    } else if (tab === "communities") {
      const mine = new Set(rooms.map((r) => r.id));
      const q = $("#search").value.trim().toLocaleLowerCase();
      h = comms
        .filter(
          (r) =>
            !q ||
            r.name.toLocaleLowerCase().includes(q) ||
            (r.description || "").toLocaleLowerCase().includes(q),
        )
        .map((r) =>
          roomCard(
            r,
            mine.has(r.id)
              ? '<i class="bi bi-check-circle-fill text-success"></i>'
              : `<button class="join-btn" data-open-community="${r.id}">${t("community_view")}</button>`,
          ),
        )
        .join("");
    }
    $("#list").innerHTML = tab === "notifications" ? "" : h;
    $("#notification-list").classList.toggle("hide", tab !== "notifications");
    $("#list").classList.toggle("hide", tab === "notifications");
    const unreadMessageCount = chats.reduce((sum, chat) => sum + Number(chat.unread || 0), 0);
    [$("#tab-chat-unread"), $("#nav-chat-unread")].forEach((badge) => {
      badge.textContent = String(unreadMessageCount);
      badge.classList.toggle("hide", unreadMessageCount < 1);
    });
    const desktopChatBadge = $("#desktop-chat-unread");
    desktopChatBadge.textContent = String(unreadMessageCount);
    desktopChatBadge.title = `${unreadMessageCount} ta o‘qilmagan xabar`;
    desktopChatBadge.classList.toggle("hide", unreadMessageCount < 1);
    const unreadGroupMessages = rooms.reduce((sum, room) => sum + Number(room.unreadCount || 0), 0);
    const groupBadge = $("#tab-group-unread");
    groupBadge.textContent = String(unreadGroupMessages);
    groupBadge.title = `${unreadGroupMessages} ta o‘qilmagan guruh xabari`;
    groupBadge.classList.toggle("hide", unreadGroupMessages < 1);
  };
  // "Do'stlarni kashf qilish": bazadagi hamma foydalanuvchilar, 10 tadan + "Yana ko'rsatish"
  const followInner = (on) =>
    `<i class="bi ${on ? "bi-check2" : "bi-plus-lg"}" aria-hidden="true"></i><span>${t(on ? "following_btn" : "follow")}</span>`;
  const exploreCard = (p) => {
    known[p.id] = p;
    const on = p.last_seen && Date.now() - new Date(p.last_seen) < 120000;
    const fo = following.has(p.id);
    return `<article class="person-card explore-card" data-id="${esc(p.id)}"><button class="chat-avatar" type="button" data-profile="${esc(p.id)}" aria-label="${esc(p.full_name || p.username)}"><img class="username-img" src="${av(p)}" alt=""><span class="avatar-loading" aria-hidden="true"></span></button><div><div class="username"><span class="username-label">${esc(p.full_name || p.username)}</span>${accountBadges(p)}</div><p class="message-text">${esc(on ? t("online") : "@" + p.username)}</p></div><div class="explore-actions"><button type="button" class="xbtn xbtn-friend" data-explore-add="${esc(p.id)}"><i class="bi bi-people-fill" aria-hidden="true"></i><span>${t("make_friends")}</span></button><button type="button" class="xbtn xbtn-follow${fo ? " on" : ""}" data-explore-follow="${esc(p.id)}">${followInner(fo)}</button></div></article>`;
  };
  const exploreHTML = () => {
    const rows = exploreRows.filter(
      (p) => !friendIds.has(p.id) && p.id !== me.id,
    );
    if (!rows.length && !exploreBusy) return "";
    return (
      `<li class="explore-head"><b>${t("explore_friends")}</b><small>${t("explore_hint")}</small></li>` +
      `<li class="explore-shelf"><div class="explore-grid">${rows.map(exploreCard).join("")}</div>${exploreBusy
        ? `<div class="explore-more"><span class="xs-spin"></span></div>`
        : exploreDone
          ? ""
          : `<div class="explore-more"><button type="button" id="explore-more">${t("show_more")}</button></div>`}</li>`
    );
  };
  const loadExplore = async (reset = false) => {
    if (exploreBusy) return;
    if (reset) {
      exploreRows = [];
      exploreNext = 0;
      exploreDone = false;
    }
    if (exploreDone) return;
    exploreBusy = true;
    if (tab === "friends") renderList();
    try {
      await loadFriends(); // do'stlar ro'yxati kerak: ularni kashf qilishda ko'rsatmaymiz
      const r = await DB.explore(
        me.id,
        new Set([...friendIds, me.id]),
        exploreNext,
        10,
      );
      const seen = new Set(exploreRows.map((x) => x.id));
      exploreRows = exploreRows.concat(r.rows.filter((x) => !seen.has(x.id)));
      exploreNext = r.next;
      exploreDone = r.done;
    } catch (x) {
      console.error("Explore load failed:", x);
    }
    exploreBusy = false;
    if (tab === "friends") renderList();
  };
  const loadChats = async () => {
    [chats, unreadTotal] = await Promise.all([
      DB.chats(me.id),
      DB.unreadMessages(me.id),
    ]);
    renderList();
    loadNotes();
  };
  // do'stlar (contacts): schema_v12.sql
  let friendsLoaded = false,
    friendsRequest = null;
  const loadFriends = async (force = false) => {
    if (friendsLoaded && !force) return;
    if (friendsRequest) return friendsRequest;
    friendsRequest = (async () => {
      try {
        friends = await DB.friends();
        friendIds = new Set(friends.map((p) => p.id));
        friendsLoaded = true;
        renderList();
        if (target?.type === "user") paintChatState();
      } catch (x) {
        console.error("Friends load failed:", x);
      }
    })();
    try {
      await friendsRequest;
    } finally {
      friendsRequest = null;
    }
  };
  // note'lar: o'zim + obuna bo'lganlarim + suhbatdoshlarim, eng yangisi birinchi
  const loadNotes = async () => {
    try {
      const list = await DB.feedNotes(
        me.id,
        chats.map((c) => c.peer.id),
      );
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      notes = Object.fromEntries(list.map((n) => [n.user_id, n]));
      noteOrder = list.map((n) => n.user_id).filter((id) => id !== me.id);
      await need(noteOrder);
      renderNotes();
    } catch {}
  };
  let roomsRequest = null,
    commsLoadedAt = 0,
    roomsLoadedAt = 0;
  const loadRooms = async (force = true) => {
    const now = Date.now();
    const communitiesAreFresh =
      tab !== "communities" || (commsLoadedAt && now - commsLoadedAt < 60000);
    if (
      !force &&
      roomsLoadedAt &&
      now - roomsLoadedAt < 30000 &&
      communitiesAreFresh
    )
      return;
    if (roomsRequest) return roomsRequest;
    roomsRequest = (async () => {
      const shouldLoadCommunities =
        tab === "communities" && Date.now() - commsLoadedAt > 60000;
      const [myRooms, communityRows] = await Promise.all([
        DB.myRooms(me.id),
        shouldLoadCommunities ? DB.communities() : Promise.resolve(null),
      ]);
      rooms = myRooms;
      if (communityRows) {
        comms = communityRows;
        commsLoadedAt = Date.now();
      }
      const latest = await DB.roomLastMessages(
        rooms.filter((r) => r.kind === "group").map((r) => r.id),
      );
      rooms.forEach((r) => {
        r.lastMessage = latest[r.id] || null;
      });
      rooms.forEach((r) => {
        const c = comms.find((x) => x.id === r.id);
        if (c) r.members = c.members;
      });
      const groupRooms = rooms.filter((r) => r.kind === "group");
      let hasNewSeenMarkers = false;
      groupRooms.forEach((r) => {
        if (!roomSeenAt[String(r.id)]) {
          roomSeenAt[String(r.id)] = new Date().toISOString();
          hasNewSeenMarkers = true;
        }
      });
      if (hasNewSeenMarkers) saveRoomSeen();
      await Promise.all(groupRooms.map(async (r) => {
        r.unreadCount = await DB.unreadRoomMessages(r.id, me.id, roomSeenAt[String(r.id)]);
      }));
      roomsLoadedAt = Date.now();
      renderList();
    })();
    try {
      await roomsRequest;
    } finally {
      roomsRequest = null;
    }
  };

  let setSearchOpen = () => {};
  const setTab = (n, keepFeedUser = false) => {
    if (document.body.classList.contains("search-open")) setSearchOpen(false);
    if (n === "posts" && !keepFeedUser) {
      if (feedMode !== "all") feedPosts = [];
      feedUser = null;
      feedMode = "all";
    }
    tab = n;
    $("#main").classList.toggle(
      "chat-section-open",
      n !== "posts",
    );
    $("#main").classList.toggle("notifications-open", n === "notifications");
    $("#notifications-btn").classList.toggle("active", n === "notifications");
    $("#notifications-btn").setAttribute(
      "aria-pressed",
      String(n === "notifications"),
    );
    $("#tabs")
      .querySelectorAll("[data-tab]")
      .forEach((b) => b.classList.toggle("on", b.dataset.tab === n));
    $(".desktop-feed-links")
      ?.querySelectorAll("[data-tab]")
      .forEach((b) => b.classList.toggle("on", b.dataset.tab === n));
    $("#desktop-chats-link")?.classList.toggle("on", n === "chats");
    const mobileTab = n === "groups" ? "chats" : n;
    $("#nav-mobile")
      .querySelectorAll("[data-tab]")
      .forEach((b) => b.classList.toggle("on", b.dataset.tab === mobileTab));
    $("#feed-tabs")
      .querySelectorAll("[data-mode]")
      .forEach((b) => b.classList.toggle("on", b.dataset.mode === feedMode));
    let tabLoad = Promise.resolve();
    if (n === "posts") {
      pane("feed");
      tabLoad = loadFeed();
    } else if (n === "notifications") {
      pane("empty");
      loadNotifications(true);
    } else if (!$("#feed").classList.contains("hide")) pane("empty");
    if (n === "friends") {
      loadFriends();
      if (!exploreRows.length) loadExplore();
    }
    if (n === "groups" || n === "communities") loadRooms(false);
    renderList();
    return tabLoad;
  };
  $("#main").addEventListener("click", (e) => {
    if (e.target === $("#main") && $("#main").classList.contains("notifications-open")) setTab("posts");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#main").classList.contains("notifications-open")) setTab("posts");
  });
  $("#tabs").onclick = (e) => {
    const b = e.target.closest("button");
    if (b) setTab(b.dataset.tab);
  };
  $(".desktop-feed-links").onclick = (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) setTab(b.dataset.tab);
  };
  $("#desktop-feed-profile").onclick = () => $("#btn-profile").click();
  $("#desktop-feed-account").onclick = () => $("#btn-profile").click();
  $("#notification-feed-cta").onclick = () => setTab("posts");
  $("#desktop-new-post").onclick = () => $("#new-post").click();
  $("#desktop-feed-saved").onclick = () => {
    setTab("chats");
    requestAnimationFrame(() => openTarget({ type: "user", id: me.id }));
  };
  $("#desktop-chats-link").onclick = () => setTab("chats");
  $("#chat-categories").onclick = (e) => {
    const b = e.target.closest("[data-chat-tab]");
    if (b) setTab(b.dataset.chatTab);
  };

  $("#list").onclick = async (e) => {
    const profileButton = e.target.closest("[data-profile]");
    if (profileButton) {
      e.stopPropagation();
      const id = profileButton.dataset.profile;
      const previousTarget = target;
      profileButton.classList.add("loading");
      try {
        const p = known[id] || (await DB.profile(id));
        if (!p) return;
        known[id] = p;
        target = { type: "user", id, p };
        $("#peer-modal").addEventListener(
          "hidden.bs.modal",
          () => {
            target = previousTarget;
          },
          { once: true },
        );
        $("#peer-open").onclick();
      } catch (x) {
        fail(x);
      } finally {
        profileButton.classList.remove("loading");
      }
      return;
    }
    const copyLink = e.target.closest("[data-copy-group]");
    if (copyLink) {
      e.stopPropagation();
      const link = `${location.origin}/pages/main.html?group=${encodeURIComponent(copyLink.dataset.copyGroup)}`;
      try {
        await navigator.clipboard.writeText(link);
        toast(t("link_copied"));
      } catch {
        toast(link);
      }
      return;
    }
    const j = e.target.closest("[data-join]");
    if (j) {
      Spin.on(j);
      try {
        await DB.join(+j.dataset.join, me.id);
        await loadRooms();
        openTarget({ type: "room", id: +j.dataset.join });
      } catch (x) {
        fail(x);
      }
      Spin.off(j);
      return;
    }
    const openCommunity = e.target.closest("[data-open-community]");
    if (openCommunity) {
      e.stopPropagation();
      openTarget({ type: "room", id: +openCommunity.dataset.openCommunity });
      return;
    }
    const exAdd = e.target.closest("[data-explore-add]");
    if (exAdd) {
      e.stopPropagation();
      Spin.on(exAdd);
      try {
        await DB.addFriend(exAdd.dataset.exploreAdd);
        Spin.off(exAdd);
        exAdd.disabled = true;
        exAdd.classList.add("done");
        exAdd.innerHTML = `<i class="bi bi-check2-circle" aria-hidden="true"></i><span>${t("friend_added")}</span>`;
        toast(t("friend_added"));
        await new Promise((r) => setTimeout(r, 700));
        exAdd.closest(".explore-card")?.classList.add("leaving");
        await new Promise((r) => setTimeout(r, 300));
        await loadFriends(true);
        renderList();
      } catch (x) {
        Spin.off(exAdd);
        failData("Do'st qo'shish", x);
      }
      return;
    }
    const exFol = e.target.closest("[data-explore-follow]");
    if (exFol) {
      e.stopPropagation();
      const id = exFol.dataset.exploreFollow,
        was = following.has(id);
      Spin.on(exFol);
      try {
        if (was) {
          await DB.unfollow(me.id, id);
          following.delete(id);
        } else {
          await DB.follow(id);
          following.add(id);
          void sendNativePush(id, "sizga obuna bo‘ldi");
        }
        Spin.off(exFol);
        exFol.classList.toggle("on", !was);
        exFol.innerHTML = followInner(!was);
        exFol.classList.remove("pop");
        void exFol.offsetWidth;
        exFol.classList.add("pop");
        toast(t(was ? "unfollowed" : "followed"));
        loadNotes();
      } catch (x) {
        Spin.off(exFol);
        failData("Kuzatish", x);
      }
      return;
    }
    if (e.target.closest("#explore-more")) {
      loadExplore();
      return;
    }
    if (e.target.closest("#new-group")) return gm.show();
    const li = e.target.closest(".person-card");
    if (!li) return;
    if (li.dataset.rid) {
      if (
        rooms.some((r) => r.id === +li.dataset.rid) ||
        comms.some((r) => r.id === +li.dataset.rid)
      )
        openTarget({ type: "room", id: +li.dataset.rid });
    } else openTarget({ type: "user", id: li.dataset.id });
  };
  $("#notes").onclick = (e) => {
    if (e.target.closest("#my-note")) {
      $("#n-text").value = notes[me.id]?.text || "";
      return nm.show();
    }
    const n = e.target.closest(".note");
    if (n) openNoteView(n.dataset.id);
  };
  // ---- qidiruv tarixi + mobil qidiruv tugmasi
  const SH_KEY = "xabarim-search-history";
  const readHistory = () => {
    try {
      const a = JSON.parse(localStorage.getItem(SH_KEY) || "[]");
      return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
  const writeHistory = (a) => {
    try {
      localStorage.setItem(SH_KEY, JSON.stringify(a.slice(0, 8)));
    } catch {}
  };
  const saveSearch = (q) => {
    q = (q || "").trim();
    if (q.length < 2) return;
    writeHistory([
      q,
      ...readHistory().filter(
        (x) => x.toLocaleLowerCase() !== q.toLocaleLowerCase(),
      ),
    ]);
  };
  const renderHistory = () => {
    const box = $("#search-history"),
      input = $("#search");
    if (!box || !input) return;
    const isMobile = window.innerWidth <= 767;
    const isSearchOpen = document
      .querySelector(".chat-sidebar")
      ?.classList.contains("search-open");
    const show =
      (isMobile
        ? isSearchOpen
        : document.activeElement === input ||
          box.contains(document.activeElement)) && !input.value.trim();
    box.classList.toggle("hide", !show);
    if (!show) return;
    const items = readHistory();
    if (!items.length) {
      box.innerHTML = `<div class="search-history__empty"><i class="bi bi-clock-history"></i><span>${esc(t("no_recent_searches"))}</span></div>`;
      return;
    }
    box.innerHTML =
      `<div class="search-history__head"><span>${esc(t("recent_searches"))}</span><button type="button" data-sh-clear>${esc(t("clear_all_searches"))}</button></div>` +
      items
        .map(
          (q, i) =>
            `<div class="search-history__item" data-sh="${i}"><i class="bi bi-clock-history"></i><span class="search-history__q">${esc(q)}</span><button type="button" class="search-history__del" data-sh-del="${i}" aria-label="Delete"><i class="bi bi-x-lg"></i></button></div>`,
        )
        .join("");
  };
  setSearchOpen = (open) => {
    const side = document.querySelector(".chat-sidebar"),
      toggle = $("#search-toggle"),
      input = $("#search"),
      clearBtn = $("#search-clear");
    document.body.classList.toggle("search-open", open);
    side?.classList.toggle("search-open", open);
    toggle?.classList.toggle("on", open);
    toggle?.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("search-has-query", !!input?.value.trim());
    if (open) {
      setTimeout(() => input?.focus(), 60);
      renderHistory();
    } else {
      if (input) {
        input.value = "";
        clearBtn?.classList.add("hide");
        input.blur();
      }
      document.body.classList.remove("search-has-query");
      results = null;
      groupResults = null;
      renderList();
      renderHistory();
      if (tab === "posts") loadFeed();
    }
  };
  $("#search-toggle").onclick = () => setSearchOpen(true);
  if ($("#search-back")) $("#search-back").onclick = () => setSearchOpen(false);
  if ($("#search-clear")) {
    $("#search-clear").onclick = () => {
      const input = $("#search");
      if (input) {
        input.value = "";
        input.dispatchEvent(new Event("input"));
        input.focus();
      }
      $("#search-clear").classList.add("hide");
      document.body.classList.remove("search-has-query");
      results = null;
      groupResults = null;
      renderList();
      renderHistory();
      if (tab === "posts") loadFeed();
    };
  }
  $("#search").addEventListener("focus", renderHistory);
  $("#search").addEventListener("blur", () => {
    if (window.innerWidth > 767) setTimeout(renderHistory, 150);
  });
  $("#search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = e.target.value.trim();
      if (q) {
        saveSearch(q);
        e.target.blur();
      }
    }
  });
  // tarix paneli bosilganda input fokusini yo'qotmaslik uchun
  $("#search-history").addEventListener("pointerdown", (e) =>
    e.preventDefault(),
  );
  $("#search-history").addEventListener("click", (e) => {
    if (e.target.closest("[data-sh-clear]")) {
      writeHistory([]);
      renderHistory();
      return;
    }
    const del = e.target.closest("[data-sh-del]");
    if (del) {
      const a = readHistory();
      a.splice(+del.dataset.shDel, 1);
      writeHistory(a);
      renderHistory();
      return;
    }
    const it = e.target.closest("[data-sh]");
    if (!it) return;
    const q = readHistory()[+it.dataset.sh];
    if (!q) return;
    const input = $("#search");
    input.value = q;
    $("#search-clear")?.classList.remove("hide");
    document.body.classList.add("search-has-query");
    input.dispatchEvent(new Event("input"));
    saveSearch(q);
  });
  document.addEventListener("click", (e) => {
    if (window.innerWidth > 767 && !e.target.closest("#search-box")) {
      $("#search-history")?.classList.add("hide");
    }
  });
  // natijadan biriga o'tilganda qidiruv so'zini tarixga yozamiz
  $("#list").addEventListener(
    "click",
    (e) => {
      if ($("#search").value.trim() && e.target.closest(".person-card"))
        saveSearch($("#search").value);
    },
    true,
  );
  let timer;
  $("#search").oninput = (e) => {
    clearTimeout(timer);
    const q = e.target.value.trim();
    $("#search-clear")?.classList.toggle("hide", !q);
    document.body.classList.toggle("search-has-query", !!q);
    renderHistory();
    if (!q) {
      results = null;
      groupResults = null;
      renderList();
      if (tab === "posts") loadFeed();
      return;
    }
    if (tab === "groups") {
      results = null;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          groupResults = await DB.searchGroups(q);
          renderList();
        } catch (x) {
          console.error("Group search failed:", x);
          groupResults = [];
          renderList();
        }
      }, 220);
      return;
    }
    if (tab !== "chats") {
      results = null;
      renderList();
      if (tab === "posts") loadFeed();
      return;
    }
    timer = setTimeout(async () => {
      results = await DB.find(q, me.id);
      renderList();
    }, 250);
  };

  // ---- suhbat
  const need = async (ids) => {
    const miss = [...new Set(ids)].filter((i) => i && !known[i]);
    if (miss.length)
      (await DB.profiles(miss)).forEach((p) => (known[p.id] = p));
  };
  // Saqlangan xabarlar = o'zim bilan suhbat (sender = receiver = men)
  const SAVED_AV =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='#654dff'/><path d='M22 15h20a2 2 0 0 1 2 2v32l-12-8.5L20 49V17a2 2 0 0 1 2-2z' fill='#fff'/></svg>",
    );
  const isSavedMsg = (m) =>
    !m.room_id && m.sender === me.id && m.receiver === me.id;
  const mentionTextHTML = (text) =>
    esc(text)
      .replace(/https?:\/\/[^\s<]+/gi, (match) => {
        let link = match;
        let trailing = "";
        while (/[.,!?;:)\]]$/.test(link)) {
          trailing = link.slice(-1) + trailing;
          link = link.slice(0, -1);
        }
        let sameOrigin = false;
        try {
          sameOrigin = new URL(link.replace(/&amp;/g, "&"), location.href).origin === location.origin;
        } catch {}
        const external = sameOrigin ? "" : ' target="_blank" rel="noopener noreferrer"';
        return `<a class="message-link" href="${link}"${external}>${link}</a>${trailing}`;
      })
      .replace(/(^|\s)@([a-z0-9_]{3,30})\b/gi, (all, gap, username) => `${gap}<span class="message-mention" data-mention-user="${esc(username.toLowerCase())}">@${esc(username)}</span>`);
  const msgHTML = (m) => {
    let f = "";
    if (m.file_url) {
      const u = url(m.file_url);
      const vd = ftype(m)?.startsWith("video/") ? videoBox(m.file_url) : null; // oldin ko'rilgan video o'lchami (qora sakrashsiz)
      f = ftype(m)?.startsWith("image/")
        ? `<img class="msg-img" src="${u}" alt="${esc(m.file_name || "Rasm")}" loading="lazy" role="button" tabindex="0" aria-label="Rasmni kattalashtirib ko‘rish">`
        : ftype(m)?.startsWith("video/")
          ? `<div class="msg-video-player controls-visible${vd ? "" : " is-loading"}" data-vkey="${esc(vdKey(m.file_url))}"${vd ? ` style="width:${vd.w}px"` : ""}><div class="msg-video-stage"${vd ? ` style="aspect-ratio:${vd.vw} / ${vd.vh}"` : ""}><div class="video-skeleton" aria-hidden="true"><i class="video-spinner"></i></div><video class="msg-video" playsinline webkit-playsinline preload="metadata" aria-label="${esc(m.file_name || "Video")}"><source src="${u}#t=0.001"${/quicktime|x-m4v|3gpp/.test(ftype(m)) ? "" : ` type="${esc(ftype(m))}"`}>Brauzeringiz video ijroni qo‘llab-quvvatlamaydi.</video><div class="video-feedback" aria-hidden="true"><i class="bi bi-play-fill"></i></div><div class="video-overlay controls-visible"><div class="video-heading"><span>${esc(m.file_name || "Video")}</span><small>${size(m.file_size || 0)}</small></div><div class="video-bottom"><input class="video-seek" data-video-seek type="range" min="0" max="0" value="0" step="0.1" aria-label="Video vaqti"><div class="video-control-row"><button type="button" class="video-control video-play" data-video-play aria-label="Videoni ijro etish"><i class="bi bi-play-fill"></i></button><span class="video-time"><span class="video-current">0:00</span><span class="video-time-divider">/</span><span class="video-duration">0:00</span></span><span class="video-control-spacer"></span><button type="button" class="video-control video-mute" data-video-mute aria-label="Ovozni o‘chirish"><i class="bi bi-volume-up-fill"></i></button><button type="button" class="video-control video-fullscreen" data-video-fullscreen aria-label="To‘liq ekranda ko‘rish"><i class="bi bi-fullscreen"></i></button></div></div></div></div></div>`
          : ftype(m)?.startsWith("audio/")
            ? voiceHTML(m, u)
            : `<a class="msg-file" href="${u}" target="_blank" rel="noopener" download="${esc(m.file_name)}"><i class="bi bi-file-earmark-arrow-down-fill"></i><span>${esc(m.file_name)}<small>${size(m.file_size || 0)}</small></span></a>`;
    }
    const who =
      m.room_id && m.sender !== me.id
        ? `<b class="who">${esc(known[m.sender]?.full_name || known[m.sender]?.username || "")}</b>`
        : "";
    const media =
      m.file_url &&
      (ftype(m)?.startsWith("image/") || ftype(m)?.startsWith("video/")) &&
      !m.body;
    const fwdName =
      m.fwd_name ||
      (m.fwd_from
        ? known[m.fwd_from]?.full_name || known[m.fwd_from]?.username
        : "");
    const fwdHead = fwdName
      ? `<div class="msg-fwd"><i class="bi bi-reply-fill" aria-hidden="true"></i><span>${esc(t("fwd_from"))}: <b>${esc(fwdName)}</b>${m.fwd_src ? ` · ${esc(m.fwd_src)}` : ""}</span></div>`
      : "";
    const quoted = m.reply_to ? loaded.get(String(m.reply_to)) : null;
    const quote = m.reply_to
      ? `<div class="msg-quote"><b>${esc(known[quoted?.sender]?.full_name || known[quoted?.sender]?.username || "Javob")}</b><span>${esc(quoted?.body || (quoted?.file_url ? "Media" : "Xabar"))}</span></div>`
      : "";
    const canDel = !m._tmp && (m.sender === me.id || (m.room_id && roomOwner));
    return `<div class="msg${m.sender === me.id ? " me" : ""}${media ? " media" : ""}" data-mid="${esc(m.id)}">${who}${fwdHead}${quote}${f}${m.body ? mentionTextHTML(m.body) : ""}${rxHTML(m.id)}<div class="msg-footer"><time>${hm(m.created_at)}${m.sender === me.id && !isSavedMsg(m) ? stIcon(m) : ""}</time><div class="msg-tools"><button data-reply="${esc(m.id)}" aria-label="Reply"><i class="bi bi-reply-fill"></i></button>${canDel ? `<button class="del-msg" data-del-msg="${esc(m.id)}" aria-label="${esc(t("delete_msg"))}" title="${esc(t("delete_msg"))}"><i class="bi bi-trash3"></i></button>` : ""}</div></div></div>`;
  };
  const body = $("#chat-body");
  const MIN_VIDEO_W = 220; // tor (vertikal) videoda ham boshqaruv tugmalari sig'ishi uchun
  const videoVolumes = new WeakMap();
  const IS_IOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const videoFrameSize = (width, height) => {
    const availableW = body.clientWidth || window.innerWidth;
    const availableH = body.clientHeight || window.innerHeight;
    const maxWidth = Math.max(MIN_VIDEO_W, Math.min(460, availableW - 40));
    const maxHeight = Math.max(
      160,
      Math.min(
        availableH * 0.68,
        window.innerHeight * (window.innerWidth < 768 ? 0.5 : 0.72),
      ),
    );
    const scale = Math.min(maxWidth / width, maxHeight / height);
    const w = Math.max(MIN_VIDEO_W, Math.round(width * scale));
    return { w, h: Math.round((w * height) / width) };
  };

  // ---- Video o'lchamlari keshi: video bir marta ko'rilgach (yoki yuborilgach) keyingi safar
  // darhol to'g'ri o'lchamda chiqadi, "kichkina qora quti -> kattalashish" sakrashi bo'lmaydi.
  const VD_KEY = "xabarim-video-dims";
  let vdims = {};
  try {
    vdims = JSON.parse(localStorage.getItem(VD_KEY)) || {};
  } catch {
    vdims = {};
  }
  const vdKey = (u) =>
    String(u || "")
      .split("#")[0]
      .split("?")[0];
  const vdGet = (u) => {
    const d = vdims[vdKey(u)];
    return Array.isArray(d) && d[0] > 0 && d[1] > 0 ? d : null;
  };
  const vdSet = (u, w, h) => {
    const k = vdKey(u);
    if (!k || !w || !h || (vdims[k] && vdims[k][0] === w && vdims[k][1] === h))
      return;
    delete vdims[k];
    vdims[k] = [w, h];
    const ks = Object.keys(vdims);
    if (ks.length > 400)
      ks.slice(0, ks.length - 400).forEach((x) => delete vdims[x]);
    try {
      localStorage.setItem(VD_KEY, JSON.stringify(vdims));
    } catch {}
  };
  const videoBox = (u) => {
    const d = vdGet(u);
    return d ? { w: videoFrameSize(d[0], d[1]).w, vw: d[0], vh: d[1] } : null;
  };

  const inFs = (p) =>
    p.classList.contains("is-fullscreen") ||
    document.fullscreenElement === p ||
    document.webkitFullscreenElement === p;
  const nearBottom = () =>
    body.scrollHeight - body.scrollTop - body.clientHeight < 120;
  const showControls = (player, hideAfter = 0) => {
    clearTimeout(player.controlsTimer);
    player.classList.add("controls-visible");
    if (!hideAfter) return;
    player.controlsTimer = setTimeout(() => {
      const v = player.querySelector("video");
      if (v && !v.paused && !v.ended && !player.dataset.scrub)
        player.classList.remove("controls-visible");
    }, hideAfter);
  };

  // Video haqiqiy o'lchamiga moslanadi (sakrashsiz: avval kesh, keyin metadata)
  const fitVideo = (video) => {
    const player = video.closest(".msg-video-player");
    if (!player || !video.videoWidth || !video.videoHeight) return;
    vdSet(player.dataset.vkey, video.videoWidth, video.videoHeight);
    player.classList.remove("is-loading");
    if (inFs(player)) return;
    const stage = player.querySelector(".msg-video-stage");
    const ratio = `${video.videoWidth} / ${video.videoHeight}`,
      w = `${videoFrameSize(video.videoWidth, video.videoHeight).w}px`;
    if (stage.dataset.ratio === ratio && player.style.width === w) return;
    const stick = nearBottom();
    stage.dataset.ratio = ratio;
    stage.style.aspectRatio = ratio;
    player.style.width = w;
    if (stick) body.scrollTop = body.scrollHeight;
  };

  const paintVideo = (video) => {
    const player = video.closest(".msg-video-player");
    if (!player) return;
    const play = player.querySelector("[data-video-play]"),
      seek = player.querySelector("[data-video-seek]");
    const current = player.querySelector(".video-current"),
      duration = player.querySelector(".video-duration");
    const paused = video.paused || video.ended;
    const state = paused ? "play-fill" : "pause-fill";
    if (play.dataset.state !== state) {
      play.dataset.state = state;
      play.innerHTML = `<i class="bi bi-${state}"></i>`;
      play.setAttribute(
        "aria-label",
        paused ? "Videoni ijro etish" : "Videoni pauza qilish",
      );
    }
    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    duration.textContent = videoClock(dur);
    if (!player.dataset.scrub) {
      // foydalanuvchi sudrab turganda "sakramasin"
      seek.max = dur;
      seek.value = video.currentTime || 0;
      seek.style.setProperty(
        "--video-progress",
        `${dur ? (video.currentTime / dur) * 100 : 0}%`,
      );
      current.textContent = videoClock(video.currentTime);
    }
    const mute = player.querySelector("[data-video-mute]");
    if (!video.muted && video.volume > 0) videoVolumes.set(video, video.volume);
    const isMuted = video.muted || video.volume === 0;
    const mIcon = isMuted
      ? "volume-mute-fill"
      : video.volume < 0.5
        ? "volume-down-fill"
        : "volume-up-fill";
    if (mute.dataset.state !== mIcon) {
      mute.dataset.state = mIcon;
      mute.innerHTML = `<i class="bi bi-${mIcon}"></i>`;
      mute.setAttribute(
        "aria-label",
        isMuted ? "Ovozni yoqish" : "Ovozni o‘chirish",
      );
    }
    // pauzada/tugaganda boshqaruv doim ko'rinadi; ijro paytida yashirish taymeri (showControls) hal qiladi
    if (paused) {
      clearTimeout(player.controlsTimer);
      player.classList.add("controls-visible");
    }
  };

  // Video ijro bo'lmasa (masalan Chrome'da HEVC .mov yoki Safari'da .webm): yuklab olish havolasi chiqadi
  const videoFailed = (video) => {
    const player = video?.closest?.(".msg-video-player");
    if (!player || player.dataset.failed) return;
    player.dataset.failed = "1";
    player.classList.remove("is-loading", "is-buffering");
    const src = (
      video.currentSrc ||
      video.querySelector("source")?.src ||
      ""
    ).replace(/#t=0\.001$/, "");
    player.insertAdjacentHTML(
      "afterend",
      `<a class="video-fallback" href="${url(src)}" target="_blank" rel="noopener" download><i class="bi bi-download"></i><span>${esc(t("video_download"))}</span></a>`,
    );
  };
  document.addEventListener(
    "error",
    (e) => {
      const v = e.target?.matches?.("source")
        ? e.target.parentElement
        : e.target;
      if (v?.matches?.(".msg-video")) videoFailed(v);
    },
    true,
  );
  const isVid = (e) => e.target?.matches?.(".msg-video");
  document.addEventListener(
    "loadedmetadata",
    (e) => {
      if (isVid(e)) {
        fitVideo(e.target);
        paintVideo(e.target);
      }
    },
    true,
  );
  document.addEventListener(
    "loadeddata",
    (e) => {
      if (isVid(e)) {
        fitVideo(e.target);
        e.target
          .closest(".msg-video-player")
          ?.classList.remove("is-loading", "is-buffering");
        paintVideo(e.target);
      }
    },
    true,
  );
  [
    "durationchange",
    "timeupdate",
    "pause",
    "ended",
    "volumechange",
    "webkitbeginfullscreen",
    "webkitendfullscreen",
  ].forEach((ev) =>
    document.addEventListener(
      ev,
      (e) => {
        if (isVid(e)) paintVideo(e.target);
      },
      true,
    ),
  );
  document.addEventListener(
    "seeked",
    (e) => {
      if (isVid(e)) {
        e.target.closest(".msg-video-player")?.classList.remove("is-buffering");
        paintVideo(e.target);
      }
    },
    true,
  );
  document.addEventListener(
    "play",
    (e) => {
      if (!isVid(e)) return;
      paintVideo(e.target);
      showControls(e.target.closest(".msg-video-player"), 2200);
    },
    true,
  );
  document.addEventListener(
    "playing",
    (e) => {
      if (isVid(e))
        e.target
          .closest(".msg-video-player")
          ?.classList.remove("is-loading", "is-buffering");
    },
    true,
  );
  document.addEventListener(
    "canplay",
    (e) => {
      if (isVid(e))
        e.target.closest(".msg-video-player")?.classList.remove("is-buffering");
    },
    true,
  );
  document.addEventListener(
    "waiting",
    (e) => {
      if (isVid(e) && !e.target.paused)
        e.target.closest(".msg-video-player")?.classList.add("is-buffering");
    },
    true,
  );

  const togglePlay = (player, video) => {
    const wasPaused = video.paused || video.ended;
    if (wasPaused) {
      // iOS: play() foydalanuvchi bosishi bilan bir zumda (sinxron) chaqirilishi shart
      const pr = video.play();
      if (pr && pr.catch)
        pr.catch((err) => {
          if (err?.name === "NotSupportedError") videoFailed(video);
          paintVideo(video);
        });
    } else video.pause();
    const feedback = player.querySelector(".video-feedback");
    if (feedback) {
      feedback.innerHTML = `<i class="bi bi-${wasPaused ? "pause-fill" : "play-fill"}"></i>`;
      player.classList.add("show-playback-feedback");
      clearTimeout(player.feedbackTimer);
      player.feedbackTimer = setTimeout(
        () => player.classList.remove("show-playback-feedback"),
        850,
      );
    }
    if (wasPaused) showControls(player, 2200);
    else {
      clearTimeout(player.controlsTimer);
      player.classList.add("controls-visible");
    }
  };

  // ---- To'liq ekran. iPhone'da element.requestFullscreen yo'q: avval iOS'ning o'z (native) pleyeri,
  // u bo'lmasa body'ga ko'chirilgan "fallback" qatlam (yopish tugmasi + orqaga qaytish bilan).
  const openFsFallback = (player) => {
    if (player.classList.contains("is-fullscreen") || !player.parentNode)
      return;
    const video = player.querySelector("video"),
      was = !video.paused;
    const ph = document.createComment("vfs");
    player.parentNode.insertBefore(ph, player);
    player._ph = ph;
    document.body.appendChild(player);
    player.classList.add("is-fullscreen", "vfs");
    player.insertAdjacentHTML(
      "beforeend",
      '<button type="button" class="video-close" data-video-close aria-label="Yopish"><i class="bi bi-x-lg"></i></button>',
    );
    document.body.classList.add("video-fs-open");
    try {
      history.pushState({ vfs: 1 }, "");
      player._pushed = true;
    } catch {}
    if (was) video.play().catch(() => {}); // DOM'ga ko'chirilganda video to'xtab qoladi
    showControls(player);
  };
  const leaveFsFallback = (player, fromPop) => {
    if (!player.classList.contains("is-fullscreen")) return;
    const video = player.querySelector("video"),
      was = !video.paused;
    player.classList.remove("is-fullscreen", "vfs");
    player.querySelector("[data-video-close]")?.remove();
    document.body.classList.remove("video-fs-open");
    const ph = player._ph;
    player._ph = null;
    if (ph?.parentNode) {
      ph.replaceWith(player);
      if (was) video.play().catch(() => {});
      fitVideo(video);
      paintVideo(video);
    } else {
      video.pause();
      player.remove();
    } // chat qayta chizilgan bo'lsa
    if (player._pushed) {
      player._pushed = false;
      if (!fromPop) {
        try {
          if (history.state?.vfs) history.back();
        } catch {}
      }
    }
  };
  const closeFs = async (player) => {
    if (
      document.fullscreenElement === player ||
      document.webkitFullscreenElement === player
    ) {
      try {
        await (document.exitFullscreen || document.webkitExitFullscreen).call(
          document,
        );
      } catch {}
      return;
    }
    leaveFsFallback(player);
  };
  const enterFs = async (player, video) => {
    if (IS_IOS && video.webkitEnterFullscreen) {
      try {
        video.webkitEnterFullscreen();
        return;
      } catch {} // metadata hali yo'q bo'lsa -> fallback
    }
    const req = player.requestFullscreen || player.webkitRequestFullscreen;
    if (req && !IS_IOS) {
      try {
        await req.call(player);
        return;
      } catch {}
    }
    openFsFallback(player);
  };
  const syncFs = () => {
    document.querySelectorAll(".msg-video-player").forEach((p) => {
      const native =
        document.fullscreenElement === p ||
        document.webkitFullscreenElement === p;
      if (!p.classList.contains("is-fullscreen"))
        p.classList.toggle("vfs", native);
      if (!native && !p.classList.contains("is-fullscreen")) {
        const v = p.querySelector("video");
        if (v) {
          fitVideo(v);
          paintVideo(v);
        }
      }
    });
  };
  document.addEventListener("fullscreenchange", syncFs);
  document.addEventListener("webkitfullscreenchange", syncFs);
  window.addEventListener("popstate", () =>
    document
      .querySelectorAll(".msg-video-player.is-fullscreen")
      .forEach((p) => leaveFsFallback(p, true)),
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      document
        .querySelectorAll(".msg-video-player.is-fullscreen")
        .forEach((p) => leaveFsFallback(p));
  });

  document.addEventListener("click", async (e) => {
    const player = e.target.closest(".msg-video-player");
    if (!player) return;
    const video = player.querySelector("video");
    const tg = e.target;
    if (tg.closest("[data-video-close]")) {
      await closeFs(player);
    } else if (tg.closest("[data-video-play]") || tg === video) {
      // ijro paytida boshqaruv yashirin bo'lsa: birinchi bosish uni ko'rsatadi (sekin/tez o'tkazish uchun)
      if (
        tg === video &&
        !video.paused &&
        !video.ended &&
        !player.classList.contains("controls-visible")
      )
        showControls(player, 2600);
      else togglePlay(player, video);
    } else if (tg.closest("[data-video-mute]")) {
      if (video.muted || video.volume === 0) {
        const previousVolume = videoVolumes.get(video) || 1;
        if (video.volume === 0) video.volume = previousVolume;
        video.muted = false;
      } else {
        if (video.volume > 0) videoVolumes.set(video, video.volume);
        video.muted = true;
      }
      paintVideo(video);
      if (!video.paused) showControls(player, 2200);
    } else if (tg.closest("[data-video-fullscreen]")) {
      if (inFs(player)) await closeFs(player);
      else await enterFs(player, video);
    } else return;
    e.preventDefault();
    e.stopPropagation();
  });

  // ---- Vaqt chizig'i (seek): sudrash paytida taymer/pozitsiya bilan kurashmaydi, boshqaruv yo'qolmaydi
  const scrubEnd = () => {
    document.querySelectorAll(".msg-video-player[data-scrub]").forEach((p) => {
      delete p.dataset.scrub;
      const v = p.querySelector("video");
      if (!v) return;
      paintVideo(v);
      showControls(p, v.paused ? 0 : 2200);
    });
  };
  document.addEventListener(
    "pointerdown",
    (e) => {
      const s = e.target.closest?.("[data-video-seek]");
      if (!s) return;
      const p = s.closest(".msg-video-player");
      p.dataset.scrub = "1";
      showControls(p);
    },
    true,
  );
  ["pointerup", "pointercancel", "touchend", "touchcancel"].forEach((ev) =>
    document.addEventListener(ev, scrubEnd, true),
  );
  document.addEventListener("change", (e) => {
    if (e.target.matches?.("[data-video-seek]")) scrubEnd();
  });
  document.addEventListener("input", (e) => {
    if (!e.target.matches("[data-video-seek]")) return;
    const player = e.target.closest(".msg-video-player"),
      video = player.querySelector("video");
    const val = Number(e.target.value);
    player.dataset.scrub = "1";
    if (Number.isFinite(val)) {
      try {
        video.currentTime = val;
      } catch {}
    }
    player.querySelector(".video-current").textContent = videoClock(val);
    e.target.style.setProperty(
      "--video-progress",
      `${e.target.max > 0 ? (val / e.target.max) * 100 : 0}%`,
    );
    showControls(player);
    e.stopPropagation();
  });
  window.addEventListener(
    "resize",
    () => body.querySelectorAll(".msg-video").forEach(fitVideo),
    { passive: true },
  );
  // kun ajratgichlari: Bugun / Kecha / 12 oktyabr (boshqa yil bo'lsa yili ham)
  const dayKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
  };
  const dayLabel = (d) => {
    const x = new Date(d),
      n = new Date(),
      y = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1),
      k = dayKey(x);
    if (k === dayKey(n)) return t("today");
    if (k === dayKey(y)) return t("yesterday");
    return `${x.getDate()} ${t("months").split(",")[x.getMonth()]}${x.getFullYear() !== n.getFullYear() ? " " + x.getFullYear() : ""}`;
  };
  const daySep = (d) =>
    `<div class="day-sep" data-day="${dayKey(d)}"><span>${esc(dayLabel(d))}</span></div>`;
  const msgsHTML = (ms) => {
    let last = "";
    return ms
      .map((m) => {
        const k = dayKey(m.created_at),
          s = k !== last ? daySep(m.created_at) : "";
        last = k;
        return s + msgHTML(m);
      })
      .join("");
  };
  const clearedHTML = () =>
    `<div class="chat-cleared"><i class="bi bi-check-circle-fill" aria-hidden="true"></i><span>${t("history_cleared")}</span></div>`;
  // chat bo'sh va tarixi tozalangan bo'lsa (ikkala tomonda ham) "Tarix tozalandi" belgisini ko'rsatadi
  const showClearedMark = () => {
    if (
      target?.type !== "user" ||
      target.id === me.id ||
      body.querySelector(".msg, .chat-cleared, .chat-clear-anim")
    )
      return;
    if (chats.find((c) => c.peer.id === target.id)?.last?.cleared)
      body.innerHTML = clearedHTML();
  };
  // xabarlari qolmagan kun ajratgichini olib tashlash
  const cleanSeps = () =>
    body.querySelectorAll(".day-sep").forEach((sp) => {
      const n = sp.nextElementSibling;
      if (
        !n ||
        n.classList.contains("day-sep") ||
        n.classList.contains("seen-line")
      )
        sp.remove();
    });
  // oxirgi xabarim tagida holat yozuvi: Yuborildi / Yetkazildi / Ko'rildi 14:32
  const seenLine = (pop) => {
    body.querySelector(".seen-line")?.remove();
    if (target?.type !== "user" || target.id === me.id) return;
    const last = body.lastElementChild;
    if (!last || !last.classList.contains("me")) return;
    const m = loaded.get(last.dataset.mid);
    if (!m) return;
    const k = stKey(m);
    last.insertAdjacentHTML(
      "afterend",
      `<div class="seen-line st-${k}">${stIcon(m, pop)}<span>${t("st_" + k)}${k === "read" && m.read_at ? " · " + hm(m.read_at) : ""}</span></div>`,
    );
  };
  const add = (m) => {
    body.querySelector(".seen-line")?.remove();
    body.querySelector(".chat-cleared")?.remove();
    loaded.set(String(m.id), m);
    const lastSep = [...body.querySelectorAll(".day-sep")].pop();
    if (!lastSep || lastSep.dataset.day !== dayKey(m.created_at))
      body.insertAdjacentHTML("beforeend", daySep(m.created_at));
    body.insertAdjacentHTML("beforeend", msgHTML(m));
    seenLine();
    body.scrollTop = body.scrollHeight;
  };
  const header = () => {
    const u = target.type === "user",
      p = target.p,
      r = target.r,
      st = $("#peer-status");
    const saved = u && p.id === me.id;
    $("#peer-name").innerHTML = saved
      ? esc(t("saved_msgs"))
      : u
        ? `${esc(p.full_name || p.username)}${accountBadges(p)}`
        : esc(r.name);
    $("#peer-av").src = saved ? SAVED_AV : u ? av(p) : ic(r.name);
    $("#peer-open").style.pointerEvents = "";
    if (saved) {
      st.classList.remove("typing");
      st.textContent = t("saved_status");
      st.classList.add("off");
    } else if (u) {
      const on = peerTyping || (p.last_seen && Date.now() - new Date(p.last_seen) < 120000);
      if (peerTyping) {
        st.innerHTML = `${esc(t("typing"))}<span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>`;
        st.classList.add("typing");
      } else {
        st.classList.remove("typing");
        st.textContent = on ? t("online") : p.last_seen ? t("seen", { t: dt(p.last_seen) }) : "";
      }
      st.classList.toggle("off", !on);
    } else {
      st.classList.remove("typing");
      st.textContent = target.readOnly
        ? t("community_read_only")
        : t(r.kind === "group" ? "groups" : "communities") +
          (r.members != null ? ` · ${r.members} ${t("members_n")}` : "");
      st.classList.add("off");
    }
    paintChatState();
  };
  const stopLocalTyping = () => {
    clearTimeout(typingStopTimer);
    clearInterval(typingHeartbeatTimer);
    typingStopTimer = 0;
    typingHeartbeatTimer = 0;
    if (typingActive && target?.type === "user" && target.id !== me.id)
      DB.sendTyping(liveChannel, me.id, false)?.catch(() => {});
    typingActive = false;
  };
  const setPeerTyping = (active) => {
    peerTyping = active;
    clearTimeout(peerTypingStopTimer);
    if (active) peerTypingStopTimer = setTimeout(() => setPeerTyping(false), 3000);
    if (target?.type === "user") header();
  };
  const bindChatLive = (tg) => {
    DB.closeChannel(liveChannel);
    liveChannel = null;
    clearTimeout(peerTypingStopTimer);
    peerTyping = false;
    if (tg?.type !== "user" || tg.id === me.id) return;
    liveChannel = DB.chatLive(me.id, tg.id, (profile) => {
      if (target?.type !== "user" || target.id !== profile.id) return;
      target.p = known[profile.id] = { ...target.p, ...profile };
      header();
    }, (active) => {
      if (target?.type === "user" && target.id === tg.id) setPeerTyping(active);
    });
  };
  const sendTyping = () => {
    if (target?.type !== "user" || target.id === me.id) return;
    const active = !!mentionInput.value.trim();
    if (active !== typingActive) {
      typingActive = active;
      DB.sendTyping(liveChannel, me.id, active)?.catch(() => {});
      if (active) {
        clearInterval(typingHeartbeatTimer);
        typingHeartbeatTimer = setInterval(() => {
          if (typingActive) DB.sendTyping(liveChannel, me.id, true)?.catch(() => {});
        }, 1500);
      } else {
        clearInterval(typingHeartbeatTimer);
        typingHeartbeatTimer = 0;
      }
    }
    clearTimeout(typingStopTimer);
    if (active) typingStopTimer = setTimeout(stopLocalTyping, 1800);
  };
  // chat tepasidagi uch nuqta menyusi va bloklash holati (faqat shaxsiy chatda)
  const paintChatState = () => {
    const u = target?.type === "user" && target.id !== me.id;
    const saved = target?.type === "user" && target.id === me.id;
    $("#chat-menu-wrap").classList.toggle("hide", !target);
    // chat foni (wallpaper) har qanday chatda bor; do'st/obuna/tarix/bloklash faqat shaxsiy chatda
    [
      "#cm-friend",
      "#cm-follow",
      "#cm-clear",
      "#cm-delete",
      "#cm-block",
      "#cm-ban-user",
    ].forEach((s) => $(s).closest("li").classList.toggle("hide", !u));
    $("#cm-block-divider").closest("li").classList.toggle("hide", !u);
    $("#cm-wp-divider")
      .closest("li")
      .classList.toggle("hide", !u && !saved);
    paintWallpaperItem();
    $("#cm-saved-clear").closest("li").classList.toggle("hide", !saved);
    $("#cm-saved-divider").classList.toggle("hide", !saved);
    $("#cm-saved-clear").innerHTML =
      `<i class="bi bi-trash3" aria-hidden="true"></i><span>${t("saved_clear_all")}</span>`;
    const isBlocked = !!u && blocked.has(target.id);
    $("#block-banner").classList.toggle("hide", !isBlocked);
    $(".input-box").classList.toggle("hide", isBlocked);
    if (!u) return;
    const id = target.id,
      fr = friendIds.has(id),
      fo = following.has(id);
    const item = (icon, key) =>
      `<i class="bi bi-${icon}" aria-hidden="true"></i><span>${t(key)}</span>`;
    $("#cm-friend").innerHTML = item(
      fr ? "person-dash" : "person-lines-fill",
      fr ? "remove_friend" : "add_friend",
    );
    $("#cm-follow").innerHTML = item(
      fo ? "person-x" : "person-plus",
      fo ? "unfollow" : "follow",
    );
    $("#cm-clear").innerHTML = item("eraser", "clear_history");
    $("#cm-delete").innerHTML = item("trash3", "delete_chat");
    $("#cm-block").innerHTML = item(
      isBlocked ? "unlock" : "slash-circle",
      isBlocked ? "unblock_user" : "block_user",
    );
    $("#cm-ban-user").innerHTML = item("flag", "ban_user");
  };
  // ---- chat foni: tanlangan fon shu qurilmada (localStorage) saqlanadi
  const BG_KEY = `xabarim-chat-bg:${me.id}`;
  const BG_PRESETS = [
    { id: "none", label: "Standart" },
    {
      id: "mint",
      label: "Mint",
      css: "linear-gradient(160deg,#d8f5e6,#bfe6f4)",
    },
    {
      id: "sky",
      label: "Osmon",
      css: "linear-gradient(160deg,#dbeafe,#c7d2fe)",
    },
    {
      id: "peach",
      label: "Shaftoli",
      css: "linear-gradient(160deg,#ffe4d6,#ffd0e4)",
    },
    {
      id: "lavender",
      label: "Lavanda",
      css: "linear-gradient(160deg,#ece6ff,#d4e3ff)",
    },
    {
      id: "sunset",
      label: "Quyosh botishi",
      css: "linear-gradient(160deg,#ffb88c,#de6262)",
    },
    {
      id: "ocean",
      label: "Okean",
      css: "linear-gradient(160deg,#2b5876,#4e4376)",
    },
    {
      id: "forest",
      label: "O'rmon",
      css: "linear-gradient(160deg,#134e5e,#71b280)",
    },
    {
      id: "night",
      label: "Tun",
      css: "linear-gradient(160deg,#0f0c29,#302b63 55%,#24243e)",
    },
    {
      id: "dots",
      label: "Nuqtalar",
      css: "radial-gradient(rgba(79,70,229,.18) 1.5px,transparent 1.8px) 0 0/20px 20px,#f4f3ff",
      dark: "radial-gradient(rgba(255,255,255,.1) 1.5px,transparent 1.8px) 0 0/20px 20px,#1c1c27",
    },
    {
      id: "grid",
      label: "To'r",
      css: "linear-gradient(rgba(79,70,229,.09) 1px,transparent 1px) 0 0/28px 28px,linear-gradient(90deg,rgba(79,70,229,.09) 1px,transparent 1px) 0 0/28px 28px,#f7f8ff",
      dark: "linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px) 0 0/28px 28px,linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px) 0 0/28px 28px,#1b1d27",
    },
    {
      id: "stripes",
      label: "Yo'llar",
      css: "repeating-linear-gradient(45deg,rgba(79,70,229,.08) 0 10px,transparent 10px 20px),#f5f6ff",
      dark: "repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 10px,transparent 10px 20px),#1b1c26",
    },
  ];
  const bgLoad = () => {
    try {
      return JSON.parse(localStorage.getItem(BG_KEY)) || {};
    } catch {
      return {};
    }
  };
  const bgChatKey = () =>
    target ? (target.type === "user" ? "u:" : "r:") + target.id : null;
  const bgSpecFor = () => {
    const s = bgLoad(),
      k = bgChatKey();
    return (k && s.chats?.[k]) || s.all || null;
  };
  const bgCss = (spec) => {
    if (!spec) return null;
    if (spec.t === "img") {
      const d = Math.max(0, Math.min(70, +spec.dim || 0)) / 100;
      return {
        light: `linear-gradient(rgba(0,0,0,${d}),rgba(0,0,0,${d})),url("${spec.url}") center/cover no-repeat`,
      };
    }
    const p = BG_PRESETS.find((x) => x.id === spec.id);
    return p && p.css ? { light: p.css, dark: p.dark } : null;
  };
  const paintBg = (el, spec) => {
    const c = bgCss(spec);
    el.classList.toggle("has-bg", !!c);
    if (c) {
      el.style.setProperty("--chat-bg", c.light);
      el.style.setProperty("--chat-bg-dark", c.dark || c.light);
    } else {
      el.style.removeProperty("--chat-bg");
      el.style.removeProperty("--chat-bg-dark");
    }
  };
  // uch nuqta menyusidagi band: fon bo'lsa "Fonni almashtirish", bo'lmasa "Fon o'rnatish"
  const paintWallpaperItem = () => {
    const sp = target ? bgSpecFor() : null,
      has = !!sp && !(sp.t === "preset" && sp.id === "none");
    $("#cm-wallpaper").innerHTML =
      `<span class="cm-ico"><i class="bi bi-${has ? "images" : "image"}" aria-hidden="true"></i></span><span>${esc(t(has ? "change_wallpaper" : "set_wallpaper"))}</span>`;
  };
  const applyChatBg = () => {
    paintBg(body, bgSpecFor());
    paintWallpaperItem();
  };
  // yuklangan rasmni siqamiz (<= ~450 KB), aks holda localStorage tez to'ladi
  const bgImage = async (file) => {
    const bmp = await createImageBitmap(file);
    let k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height)),
      q = 0.72,
      url = "";
    for (let i = 0; i < 6; i++) {
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(bmp.width * k));
      cv.height = Math.max(1, Math.round(bmp.height * k));
      const g = cv.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(bmp, 0, 0, cv.width, cv.height);
      url = cv.toDataURL("image/jpeg", q);
      if (url.length <= 450 * 1024) break;
      k *= 0.8;
      q *= 0.9;
    }
    return url;
  };
  let bgDraft = null; // { t: "preset", id } | { t: "img", url, dim } | null (standart)
  const bgModal = () => bootstrap.Modal.getOrCreateInstance($("#bg-modal"));
  const drawBgGrid = () => {
    const cur = bgDraft?.t === "preset" ? bgDraft.id : bgDraft ? "" : "none";
    $("#bgp-grid").innerHTML =
      BG_PRESETS.map(
        (p) =>
          `<button type="button" class="bgp-sw${cur === p.id ? " on" : ""}" data-bg="${p.id}" title="${esc(p.label)}" aria-label="${esc(p.label)}" aria-pressed="${cur === p.id}"${p.css ? ` style="--sw:${p.css};--sw-dark:${p.dark || p.css}"` : ""}>${p.id === "none" ? '<i class="bi bi-slash-circle" aria-hidden="true"></i>' : ""}<i class="bi bi-check-lg bgp-tick" aria-hidden="true"></i></button>`,
      ).join("") +
      `<button type="button" class="bgp-sw bgp-upload${bgDraft?.t === "img" ? " on" : ""}" id="bgp-pick" title="${esc(t("bg_upload"))}" aria-label="${esc(t("bg_upload"))}"><i class="bi bi-image" aria-hidden="true"></i><span>${esc(t("bg_upload"))}</span><i class="bi bi-check-lg bgp-tick" aria-hidden="true"></i></button>`;
    const up = $("#bgp-pick");
    if (bgDraft?.t === "img")
      up.style.setProperty(
        "--sw",
        `url("${bgDraft.url}") center/cover no-repeat`,
      );
    $("#bgp-dim-wrap").classList.toggle("hide", bgDraft?.t !== "img");
    paintBg($("#bgp-preview"), bgDraft);
  };
  $("#cm-wallpaper").onclick = () => {
    if (!target) return;
    const st = bgLoad(),
      own = st.chats?.[bgChatKey()];
    bgDraft = own || st.all || null;
    if (bgDraft?.t === "preset" && bgDraft.id === "none") bgDraft = null;
    $("#bgp-this").checked = !!own;
    $("#bgp-dim").value = bgDraft?.dim ?? 25;
    drawBgGrid();
    bgModal().show();
  };
  $("#bgp-grid").onclick = (e) => {
    if (e.target.closest("#bgp-pick")) {
      $("#bgp-file").click();
      return;
    }
    const sw = e.target.closest("[data-bg]");
    if (!sw) return;
    bgDraft =
      sw.dataset.bg === "none" ? null : { t: "preset", id: sw.dataset.bg };
    drawBgGrid();
  };
  $("#bgp-file").onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast(t("bg_bad_file"));
    try {
      bgDraft = { t: "img", url: await bgImage(f), dim: +$("#bgp-dim").value };
      drawBgGrid();
    } catch (x) {
      fail(x);
    }
  };
  $("#bgp-dim").oninput = (e) => {
    if (bgDraft?.t !== "img") return;
    bgDraft.dim = +e.target.value;
    paintBg($("#bgp-preview"), bgDraft);
  };
  $("#bgp-save").onclick = () => {
    const st = bgLoad(),
      k = bgChatKey();
    if (!k) return;
    st.chats ||= {};
    const spec = bgDraft ? { ...bgDraft } : null;
    if ($("#bgp-this").checked)
      st.chats[k] = spec || { t: "preset", id: "none" };
    else {
      delete st.chats[k];
      if (spec) st.all = spec;
      else delete st.all;
    }
    try {
      localStorage.setItem(BG_KEY, JSON.stringify(st));
    } catch {
      toast(t("bg_storage_full"));
      return;
    }
    bgModal().hide();
    applyChatBg();
    toast(t("bg_saved"));
  };
  async function openTarget(tg) {
    const requestSeq = ++openTargetSeq;
    $("#main").classList.add("chat-section-open");
    recCancel();
    stopLocalTyping();
    bindChatLive(null);
    target = null;
    loaded = new Map();
    roomOwner = false;
    pane("room");
    $("#peer-name").textContent = t("chat_loading");
    $("#peer-av").src = AV;
    $("#peer-status").textContent = "";
    $("#peer-status").classList.remove("typing");
    $("#peer-open").style.pointerEvents = "none";
    $("#chat-menu-wrap").classList.add("hide");
    $(".input-box").classList.add("hide");
    $("#room-readonly-banner").classList.add("hide");
    body.innerHTML = `<div class="chat-loading" role="status" aria-live="polite"><span class="chat-loading__spinner" aria-hidden="true"></span><strong>${esc(t("chat_loading"))}</strong></div>`;
    if (tg.type === "user") {
      tg.p = known[tg.id] || (await DB.profile(tg.id));
      if (requestSeq !== openTargetSeq || !tg.p) return;
      known[tg.id] = tg.p;
    } else {
      tg.r =
        rooms.find((r) => r.id === tg.id) || comms.find((r) => r.id === tg.id);
      if (requestSeq !== openTargetSeq || !tg.r) return;
    }
    target = tg;
    target.readOnly =
      tg.type === "room" &&
      tg.r.kind === "community" &&
      !rooms.some((r) => r.id === tg.id);
    $(".input-box").classList.toggle("hide", !!target.readOnly);
    $("#room-readonly-banner").classList.toggle("hide", !target.readOnly);
    pane("room");
    header();
    $(".input-box").classList.add("hide");
    applyChatBg();
    roomOwner = false;
    const [ms, owner] = await Promise.all([
      DB.msgs(me.id, tg),
      tg.type === "room" && tg.r.kind === "group"
        ? DB.isGroupOwner(tg.id, me.id).catch(() => false)
        : false,
    ]);
    if (requestSeq !== openTargetSeq) return;
    roomOwner = !!owner;
    await need(ms.map((m) => m.sender));
    if (requestSeq !== openTargetSeq) return;
    loaded = new Map(ms.map((m) => [String(m.id), m]));
    const replyIds = [
      ...new Set(ms.map((m) => m.reply_to).filter(Boolean)),
    ].filter((id) => !loaded.has(String(id)));
    if (replyIds.length) {
      const replies = await DB.replyMessages(replyIds);
      if (requestSeq !== openTargetSeq) return;
      await need(replies.map((m) => m.sender));
      if (requestSeq !== openTargetSeq) return;
      replies.forEach((m) => loaded.set(String(m.id), m));
    }
    vStop();
    const reactions = await DB.msgReactions(ms.map((x) => x.id));
    if (requestSeq !== openTargetSeq || target !== tg) return;
    setReactions(reactions);
    body.innerHTML = msgsHTML(ms);
    if (tg.type === "user" && tg.id === me.id && !ms.length)
      body.innerHTML = `<div class="saved-empty"><img src="${SAVED_AV}" alt=""><strong>${esc(t("saved_msgs"))}</strong><span>${esc(t("saved_info"))}</span></div>`;
    $(".input-box").classList.toggle("hide", !!target.readOnly || (target.type === "user" && blocked.has(target.id)));
    bindChatLive(tg);
    showClearedMark();
    seenLine();
    body.scrollTop = body.scrollHeight;
    if (tg.type === "user") {
      DB.read(me.id, tg.id).then(loadChats).catch(fail);
      const c = chats.find((x) => x.peer.id === tg.id);
      if (c) {
        if (c.unread > 0) unreadTotal = Math.max(0, unreadTotal - 1);
        c.unread = 0;
      }
    } else if (tg.r?.kind === "group") {
      markRoomSeen(tg.id, ms.at(-1)?.created_at || new Date().toISOString());
    }
    renderList();
  }
  $("#back").onclick = () => {
    stopLocalTyping();
    DB.closeChannel(liveChannel); liveChannel = null; peerTyping = false;
    target = null;
    pane("empty");
    renderList();
  };
  const dropMsg = (id) => {
    loaded.delete(String(id));
    body.querySelector(`[data-mid="${id}"]`)?.remove();
    cleanSeps();
    seenLine();
  };
  const refreshLists = () =>
    target?.type === "room" ? loadRooms() : loadChats();
  const reloadSoon = () => {
    clearTimeout(reloadSoon.h);
    reloadSoon.h = setTimeout(() => {
      Promise.all([loadChats(), loadRooms()])
        .then(showClearedMark)
        .catch(() => {});
    }, 300);
  };
  const startReply = (m) => {
    activeReply = m;
    $("#reply-preview-text").textContent =
      `↪ ${known[m.sender]?.full_name || known[m.sender]?.username || "Xabar"}: ${m.body || "Media"}`;
    $("#reply-preview").classList.remove("hide");
    $("#msg").focus();
  };
  // umumiy tasdiqlash oynasi (ixtiyoriy checkbox bilan). Natija: null (bekor) yoki { both }
  const ask = ({ title, text, check, checked, ok }) =>
    new Promise((resolve) => {
      const el = $("#action-modal"),
        mdl = bootstrap.Modal.getOrCreateInstance(el);
      let result = null;
      $("#am-title").textContent = title;
      $("#am-text").textContent = text || "";
      $("#am-text").classList.toggle("hide", !text);
      $("#am-check-wrap").classList.toggle("hide", !check);
      $("#am-check").checked = !!checked;
      $("#am-check-label").textContent = check || "";
      $("#am-ok").textContent = ok;
      $("#am-ok").onclick = () => {
        result = { both: $("#am-check").checked };
        mdl.hide();
      };
      el.addEventListener("hidden.bs.modal", () => resolve(result), {
        once: true,
      });
      mdl.show();
    });
  const peerName = (id) => known[id]?.full_name || known[id]?.username || "";
  // xabarni o'chirish: o'zimniki (yoki guruh egasi bo'lsam istalgani) hamma uchun; boshqasi faqat o'zim uchun
  const deleteMessage = async (m) => {
    if (isSavedMsg(m)) {
      const r = await ask({
        title: t("delete_msg"),
        text: t("confirm_del_msg"),
        ok: t("delete"),
      });
      if (!r) return;
      try {
        await DB.delMessage(me.id, m);
        dropMsg(m.id);
        refreshLists();
      } catch (x) {
        failData("Xabarni o‘chirish", x);
      }
      return;
    }
    const mine = m.sender === me.id,
      all = mine || (m.room_id && roomOwner);
    const r = await ask(
      all
        ? {
            title: t("delete_msg"),
            text: t("confirm_del_msg"),
            check: m.room_id
              ? t("delete_for_all")
              : t("also_delete_for", { n: peerName(target.id) }),
            checked: mine,
            ok: t("delete"),
          }
        : {
            title: t("delete_msg"),
            text: t("delete_for_me_note"),
            ok: t("delete"),
          },
    );
    if (!r) return;
    try {
      if (all && r.both) await DB.delMessage(me.id, m);
      else await DB.hideMessage(m.id);
      dropMsg(m.id);
      refreshLists();
    } catch (x) {
      failData("Xabarni o‘chirish", x);
    }
  };
  // ---- xabarni uzatish (muallif bilan / muallifsiz) va Saqlangan xabarlar
  const fwd = { msg: null, src: null, sel: new Map(), q: "" };
  const fwdDests = () => {
    const out = [
        {
          key: "u:" + me.id,
          type: "user",
          id: me.id,
          name: t("saved_msgs"),
          sub: t("saved_status"),
          img: SAVED_AV,
        },
      ],
      seen = new Set(["u:" + me.id]);
    const addU = (p) => {
      if (!p || seen.has("u:" + p.id) || blocked.has(p.id)) return;
      seen.add("u:" + p.id);
      out.push({
        key: "u:" + p.id,
        type: "user",
        id: p.id,
        name: p.full_name || p.username || "",
        sub: "@" + (p.username || ""),
        img: av(p),
      });
    };
    chats.forEach((c) => addU(c.peer));
    friends.forEach(addU);
    rooms.forEach((r) =>
      out.push({
        key: "r:" + r.id,
        type: "room",
        id: r.id,
        name: r.name,
        sub: t(r.kind === "group" ? "groups" : "communities"),
        img: ic(r.name),
      }),
    );
    return out;
  };
  const renderFwd = () => {
    const q = fwd.q.trim().toLocaleLowerCase();
    const list = fwdDests().filter(
      (d) =>
        !q ||
        d.name.toLocaleLowerCase().includes(q) ||
        d.sub.toLocaleLowerCase().includes(q),
    );
    $("#fwd-list").innerHTML = list.length
      ? list
          .map(
            (d) =>
              `<label class="fwd-item"><input class="form-check-input" type="checkbox" data-fwd="${esc(d.key)}"${fwd.sel.has(d.key) ? " checked" : ""}><img src="${esc(d.img)}" alt=""><span><b>${esc(d.name)}</b><small>${esc(d.sub)}</small></span></label>`,
          )
          .join("")
      : `<div class="list-empty">${t("no_results")}</div>`;
    const n = fwd.sel.size,
      btn = $("#fwd-send");
    btn.disabled = !n;
    btn.textContent = n ? `${t("fwd_send")} (${n})` : t("fwd_send");
  };
  const openForward = (m) => {
    fwd.msg = m;
    fwd.sel.clear();
    fwd.q = "";
    fwd.src = m.room_id && target?.type === "room" ? target.r.name : null;
    $("#fwd-search").value = "";
    $("#fwd-search").placeholder = t("fwd_search");
    $("#fwd-author").checked = true;
    $("#fwd-preview").textContent =
      m.body || (m.file_url ? "📎 " + (m.file_name || "Media") : "");
    renderFwd();
    bootstrap.Modal.getOrCreateInstance($("#fwd-modal")).show();
    const again = () => {
      if ($("#fwd-modal").classList.contains("show")) renderFwd();
    };
    Promise.all([loadRooms(false), loadFriends()])
      .then(again)
      .catch(() => {});
  };
  $("#fwd-search").oninput = (e) => {
    fwd.q = e.target.value;
    renderFwd();
  };
  $("#fwd-list").onchange = (e) => {
    const k = e.target.dataset?.fwd;
    if (!k) return;
    if (e.target.checked) {
      const d = fwdDests().find((x) => x.key === k);
      if (d) fwd.sel.set(k, d);
    } else fwd.sel.delete(k);
    const n = fwd.sel.size,
      btn = $("#fwd-send");
    btn.disabled = !n;
    btn.textContent = n ? `${t("fwd_send")} (${n})` : t("fwd_send");
  };
  // fayl har bir joyga o'zining nusxasi bilan boradi (asl xabar o'chirilsa, uzatilgani buzilmasin)
  const forwardMsg = async (m, dests, withAuthor, srcName) => {
    let blobPromise = null;
    const downloadSource = () =>
      (blobPromise ||= (async () => {
        const r = await fetch(m.file_url);
        if (!r.ok) throw new Error("FORWARD_DOWNLOAD_FAILED");
        return r.blob();
      })());
    if (withAuthor && !m.fwd_name && m.fwd_from) await need([m.fwd_from]);
    if (withAuthor && !m.fwd_name && !m.fwd_from) await need([m.sender]);
    const meta = !withAuthor
      ? {}
      : m.fwd_name || m.fwd_from
        ? {
            fwd_from: m.fwd_from || null,
            fwd_name: m.fwd_name || peerName(m.fwd_from) || t("unknown_author"),
            fwd_src: m.fwd_src || null,
          }
        : {
            fwd_from: m.sender,
            fwd_name: peerName(m.sender) || t("unknown_author"),
            fwd_src: srcName || null,
          };
    const results = await Promise.all(
      dests.map(async (d) => {
        try {
          const row = { body: m.body || null, ...meta };
          if (m.file_url) {
            let u;
            try {
              u = await DB.copyFile(m.file_url, me.id, m.file_name || "file");
            } catch {
              const blob = await downloadSource();
              u = await DB.upload(
                "files",
                me.id,
                new File([blob], m.file_name || "file", {
                  type: m.file_type || blob.type,
                }),
              );
            }
            Object.assign(row, {
              file_url: u,
              file_name: m.file_name,
              file_type: m.file_type,
              file_size: m.file_size,
            });
          }
          const sent = await DB.send(me.id, { type: d.type, id: d.id }, row);
          return { sent };
        } catch (x) {
          console.error("Forward failed:", x);
          return { error: x };
        }
      }),
    );
    const okN = results.filter((x) => x.sent).length,
      bad = results.length - okN;
    const schemaMissing = results.some(
      (x) => x.error?.code === "FWD_SCHEMA_REQUIRED",
    );
    for (const { sent } of results)
      if (
        sent &&
        target &&
        target.type === (sent.room_id ? "room" : "user") &&
        target.id === (sent.room_id || sent.receiver)
      ) {
        await need([sent.sender]);
        add(sent);
      }
    if (okN) {
      new Audio("/music/send-effect.mp3").play().catch(() => {});
      loadChats();
      if (dests.some((d) => d.type === "room")) loadRooms();
    }
    return { okN, bad, schemaMissing };
  };
  $("#fwd-send").onclick = async () => {
    const dests = [...fwd.sel.values()],
      m = fwd.msg,
      btn = $("#fwd-send");
    if (!dests.length || !m) return;
    btn.disabled = true;
    btn.textContent = "…";
    const withAuthor = $("#fwd-author").checked,
      src = fwd.src;
    bootstrap.Modal.getOrCreateInstance($("#fwd-modal")).hide();
    toast(t("fwd_sending"));
    try {
      const r = await forwardMsg(m, dests, withAuthor, src);
      toast(
        r.schemaMissing
          ? t("fwd_schema_required")
          : r.bad
            ? t("fwd_partial", { ok: r.okN, bad: r.bad })
            : t("fwd_done"),
      );
    } catch (x) {
      console.error("Forward failed:", x);
      toast(
        x?.code === "FWD_SCHEMA_REQUIRED"
          ? t("fwd_schema_required")
          : t("cant_send"),
      );
    } finally {
      btn.disabled = !fwd.sel.size;
      btn.textContent = fwd.sel.size
        ? `${t("fwd_send")} (${fwd.sel.size})`
        : t("fwd_send");
    }
  };
  const saveMessage = async (m) => {
    const r = await forwardMsg(
      m,
      [{ type: "user", id: me.id }],
      true,
      m.room_id && target?.type === "room" ? target.r.name : null,
    );
    toast(r.okN ? t("saved_added") : t("cant_send"));
  };
  // Telegramdagidek: xabar ustiga bosish / o'ng tugma / uzoq bosish -> Javob, Uzatish, Saqlash, Nusxa, O'chirish
  const mm = $("#msg-menu");
  let menuMsg = null;
  const closeMenu = () => {
    mm.classList.add("hide");
    mm.innerHTML = "";
    menuMsg = null;
  };
  const openMsgMenu = (m, x, y) => {
    menuMsg = m;
    mm.innerHTML =
      rxRow(m) +
      `<button type="button" data-act="reply"><i class="bi bi-reply-fill"></i><span>${esc(t("reply_msg"))}</span></button>` +
      `<button type="button" data-act="forward"><i class="bi bi-share-fill"></i><span>${esc(t("forward_msg"))}</span></button>` +
      (isSavedMsg(m)
        ? ""
        : `<button type="button" data-act="save"><i class="bi bi-bookmark-plus-fill"></i><span>${esc(t("save_msg"))}</span></button>`) +
      (m.body
        ? `<button type="button" data-act="copy"><i class="bi bi-clipboard"></i><span>${esc(t("copy_text"))}</span></button>`
        : "") +
      `<button type="button" class="danger" data-act="delete"><i class="bi bi-trash3"></i><span>${esc(t("delete_msg"))}</span></button>`;
    mm.classList.remove("hide");
    const w = mm.offsetWidth,
      h = mm.offsetHeight;
    mm.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + "px";
    mm.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + "px";
  };
  mm.onclick = async (e) => {
    const rb = e.target.closest("[data-react]"),
      b = e.target.closest("[data-act]"),
      m = menuMsg;
    closeMenu();
    if (rb && m) {
      react(m, rb.dataset.react);
      return;
    }
    if (!b || !m) return;
    if (b.dataset.act === "reply") startReply(m);
    else if (b.dataset.act === "forward") openForward(m);
    else if (b.dataset.act === "save") saveMessage(m);
    else if (b.dataset.act === "copy") {
      try {
        await navigator.clipboard.writeText(m.body);
        toast(t("copied"));
      } catch {
        fail();
      }
    } else if (b.dataset.act === "delete") deleteMessage(m);
  };
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#msg-menu") && !e.target.closest("#chat-body .msg"))
      closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
  $("#chat-body").addEventListener("scroll", closeMenu, { passive: true });
  $("#chat-body").addEventListener("contextmenu", (e) => {
    const el = e.target.closest(".msg"),
      m = el && loaded.get(el.dataset.mid);
    if (!m || m._tmp) return;
    e.preventDefault();
    openMsgMenu(m, e.clientX, e.clientY);
  });
  async function openMentionProfile(username) {
    const key = String(username || "").toLowerCase();
    const person = (await DB.find(key, me.id)).find((p) => p.username?.toLowerCase() === key);
    if (!person) return;
    known[person.id] = person;
    const previousTarget = target;
    target = { type: "user", id: person.id, p: person };
    $("#peer-modal").addEventListener("hidden.bs.modal", () => { target = previousTarget; }, { once: true });
    $("#peer-open").onclick();
  }
  $("#chat-body").onclick = async (e) => {
    const mention = e.target.closest("[data-mention-user]");
    if (mention) {
      e.preventDefault(); e.stopPropagation();
      try {
        await openMentionProfile(mention.dataset.mentionUser);
      } catch (error) { fail(error); }
      return;
    }
    const chip = e.target.closest("[data-rx-chip]");
    if (chip) {
      const el = chip.closest(".msg"),
        m = el && loaded.get(el.dataset.mid);
      if (m && !m._tmp) react(m, chip.dataset.rxChip);
      return;
    }
    if (voiceClick(e)) return;
    const image = e.target.closest(".msg-img");
    if (image) {
      e.preventDefault();
      e.stopPropagation();
      zoom(image.currentSrc || image.src);
      return;
    }
    if (e.target.closest(".msg-video-player")) return;
    const b = e.target.closest("[data-reply]");
    if (b) {
      const m = loaded.get(String(b.dataset.reply));
      if (m) startReply(m);
      return;
    }
    if (e.target.closest("a") || String(getSelection()).trim()) return; // havola/rasm ochilsin, matn belgilansin
    const el = e.target.closest(".msg"),
      m = el && loaded.get(el.dataset.mid);
    if (!m || m._tmp) return;
    openMsgMenu(m, e.clientX, e.clientY);
  };
  $("#reply-cancel").onclick = () => {
    activeReply = null;
    $("#reply-preview").classList.add("hide");
  };
  $("#feed-back").onclick = () => setTab("chats");

  // ---- chat menyusi: do'st, obuna, tarix, suhbat, bloklash
  const menuAct = (btn, fn) => {
    btn.onclick = async () => {
      if (target?.type !== "user") return;
      const id = target.id;
      btn.disabled = true;
      try {
        await fn(id);
      } catch (x) {
        failData("Chat menyusi", x);
      }
      btn.disabled = false;
    };
  };
  menuAct($("#cm-friend"), async (id) => {
    const was = friendIds.has(id);
    if (was) await DB.removeFriend(me.id, id);
    else await DB.addFriend(id);
    await loadFriends(true);
    toast(t(was ? "friend_removed" : "friend_added"));
  });
  menuAct($("#cm-follow"), async (id) => {
    const was = following.has(id);
    if (was) {
      await DB.unfollow(me.id, id);
      following.delete(id);
    } else {
      await DB.follow(id);
      following.add(id);
      void sendNativePush(id, "sizga obuna bo‘ldi");
    }
    paintChatState();
    loadNotes();
    if (tab === "posts") loadFeed();
    toast(t(was ? "unfollowed" : "followed"));
  });
  // Telegramdagidek: supurgi axlatni savatga supuradi
  const clearAnimHTML = () => `<div class="chat-clear-anim" role="status">
    <svg viewBox="0 0 160 120" width="170" height="128" aria-hidden="true">
      <line class="ca-floor" x1="6" y1="104" x2="154" y2="104"/>
      <g class="ca-bin">
        <g class="ca-lid"><rect x="104" y="40" width="42" height="7" rx="3.5"/><rect x="120" y="35" width="10" height="6" rx="3"/></g>
        <path class="ca-bin-body" d="M108 50h34l-3 52a4 4 0 0 1-4 3.6h-20a4 4 0 0 1-4-3.6z"/>
        <line class="ca-rib" x1="119" y1="58" x2="120" y2="96"/><line class="ca-rib" x1="125" y1="58" x2="125" y2="96"/><line class="ca-rib" x1="131" y1="58" x2="130" y2="96"/>
      </g>
      <circle class="ca-dust d1" cx="58" cy="100" r="3"/><circle class="ca-dust d2" cx="52" cy="101" r="2.2"/>
      <circle class="ca-dust d3" cx="64" cy="100" r="2.6"/><circle class="ca-dust d4" cx="48" cy="101" r="1.8"/>
      <g class="ca-broom">
        <line class="ca-handle" x1="30" y1="14" x2="40" y2="72"/>
        <path class="ca-bristle" d="M33 70h14l7 31H27z"/>
        <line class="ca-strand" x1="37" y1="76" x2="35" y2="99"/><line class="ca-strand" x1="42" y1="76" x2="42" y2="99"/><line class="ca-strand" x1="47" y1="76" x2="49" y2="99"/>
      </g>
    </svg>
    <p>${t("clearing")}</p>
  </div>`;
  const wipeChat = async (id, both, keep) => {
    await DB.clearChat(me.id, id, both, keep);
    loaded = new Map();
    activeReply = null;
    $("#reply-preview").classList.add("hide");
    await loadChats();
  };
  $("#cm-saved-clear").onclick = async () => {
    const r = await ask({
      title: t("saved_clear_all"),
      text: t("saved_clear_confirm"),
      ok: t("clear_btn"),
    });
    if (!r) return;
    try {
      await wipeChat(me.id, false, false);
      if (target?.type === "user" && target.id === me.id)
        body.innerHTML = `<div class="saved-empty"><img src="${SAVED_AV}" alt=""><strong>${esc(t("saved_msgs"))}</strong><span>${esc(t("saved_info"))}</span></div>`;
      toast(t("saved_cleared"));
    } catch (x) {
      failData("Saqlangan xabarlarni tozalash", x);
    }
  };
  menuAct($("#cm-clear"), async (id) => {
    const r = await ask({
      title: t("clear_history"),
      text: t("confirm_clear"),
      check: t("also_delete_for", { n: peerName(id) }),
      ok: t("clear_btn"),
    });
    if (!r) return;
    const open = target?.id === id,
      prev = open ? body.innerHTML : "";
    if (open) {
      closeMenu();
      body.innerHTML = clearAnimHTML();
    }
    const t0 = Date.now();
    try {
      await wipeChat(id, r.both, true);
    } catch (x) {
      if (target?.id === id) {
        body.querySelector(".chat-clear-anim")?.remove();
        body.insertAdjacentHTML("afterbegin", prev);
        body.scrollTop = body.scrollHeight;
      }
      throw x;
    }
    if (!open) return;
    const wait = 2000 - (Date.now() - t0);
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    if (target?.id !== id) return;
    body.querySelector(".chat-clear-anim")?.remove();
    if (!body.querySelector(".msg")) body.innerHTML = clearedHTML();
  });
  menuAct($("#cm-delete"), async (id) => {
    const r = await ask({
      title: t("delete_chat"),
      text: t("confirm_delete_chat"),
      check: t("also_delete_for", { n: peerName(id) }),
      ok: t("delete"),
    });
    if (!r) return;
    await wipeChat(id, r.both);
    if (target?.id === id) {
      target = null;
      pane("empty");
      renderList();
    }
    toast(t("chat_deleted"));
  });
  const setBlock = async (id, on) => {
    if (on) await DB.block(id);
    else await DB.unblock(me.id, id);
    on ? blocked.add(id) : blocked.delete(id);
    if (on) {
      activeReply = null;
      $("#reply-preview").classList.add("hide");
    }
    paintChatState();
    toast(t(on ? "user_blocked" : "user_unblocked"));
  };
  menuAct($("#cm-block"), async (id) => {
    const on = !blocked.has(id);
    if (on && !confirm(t("confirm_block"))) return;
    await setBlock(id, on);
  });
  $("#banner-unblock").onclick = async (e) => {
    if (target?.type !== "user") return;
    const b = e.currentTarget;
    Spin.on(b);
    try {
      await setBlock(target.id, false);
    } catch (x) {
      failData("Blokdan chiqarish", x);
    }
    Spin.off(b);
  };

  // ---- yuborish (matn / rasm / fayl). Rasmlar siqiladi, boshqa fayllar max 100 MB
  const busy = (b) =>
    ($("#send").disabled = $("#attach").disabled = $("#mic").disabled = b);
  // Video o'lchamini (metadata) o'qiydi: yuklanish kartasi video balandligiday chiqishi uchun
  const videoDims = (file) =>
    new Promise((res) => {
      const v = document.createElement("video"),
        u = URL.createObjectURL(file);
      let done = false;
      const fin = (d) => {
        if (done) return;
        done = true;
        URL.revokeObjectURL(u);
        v.removeAttribute("src");
        v.load();
        res(d);
      };
      v.preload = "metadata";
      v.muted = true;
      v.onloadedmetadata = () =>
        fin(
          v.videoWidth && v.videoHeight
            ? { w: v.videoWidth, h: v.videoHeight }
            : null,
        );
      v.onerror = () => fin(null);
      setTimeout(() => fin(null), 2000);
      v.src = u;
    });
  // Telegramdagiday: qora karta + aylanuvchi halqa + foiz + bekor qilish (X)
  const RING = 2 * Math.PI * 21;
  async function uploadBubble(file, tg) {
    const isVideo = file.type?.startsWith("video/");
    let w,
      h,
      dims = null;
    if (isVideo) {
      dims = await videoDims(file);
      const d = dims || { w: 16, h: 9 };
      ({ w, h } = videoFrameSize(d.w, d.h));
    }
    const ctl = new AbortController();
    const el = document.createElement("div");
    el.className = "msg me media uploading";
    el.dataset.mid = "up" + ++tmpN;
    el.innerHTML = `<div class="up-box${isVideo ? "" : " up-file"}"${isVideo ? ` style="width:${w}px;height:${h}px"` : ""} role="status" aria-live="polite">
      <div class="up-ring"><svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="${el.dataset.mid}-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c4baff"/><stop offset="1" stop-color="#806cff"/></linearGradient></defs><circle class="up-track" cx="24" cy="24" r="21"/><circle class="up-arc" cx="24" cy="24" r="21" stroke="url(#${el.dataset.mid}-g)" stroke-dasharray="${RING}" stroke-dashoffset="${RING * 0.94}"/></svg><button type="button" class="up-cancel" aria-label="${esc(t("upload_cancel"))}"><i class="bi bi-x-lg"></i></button></div>
      <div class="up-info"><b class="up-pct">0%</b><span class="up-label">${esc(t(isVideo ? "uploading_video" : "uploading_file"))}</span><small class="up-size">${size(file.size)}</small></div></div>`;
    el.querySelector(".up-cancel").onclick = () => ctl.abort();
    if (target === tg) {
      body.querySelector(".seen-line")?.remove();
      body.querySelector(".chat-cleared")?.remove();
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
    }
    const arc = el.querySelector(".up-arc"),
      pct = el.querySelector(".up-pct"),
      sz = el.querySelector(".up-size");
    const cancel = el.querySelector(".up-cancel"),
      label = el.querySelector(".up-label");
    return {
      signal: ctl.signal,
      dims,
      set(loaded, total) {
        const p = total ? Math.min(1, loaded / total) : 0;
        arc.style.strokeDashoffset = RING * (1 - Math.max(0.06, p));
        pct.textContent = Math.floor(p * 100) + "%";
        sz.textContent = `${size(loaded)} / ${size(total)}`;
        if (isVideo && p >= 1 && !el.classList.contains("upload-complete")) {
          el.classList.add("upload-complete");
          cancel.disabled = true;
          cancel.setAttribute("aria-label", t("upload_finishing"));
          cancel.innerHTML =
            '<i class="bi bi-check-lg" aria-hidden="true"></i>';
          label.textContent = t("upload_finishing");
        }
      },
      remove() {
        el.remove();
      },
    };
  }
  const mentionInput = $("#msg"), mentionBox = $("#mention-suggestions");
  let mentionMatches = [], mentionActive = -1, mentionRange = null, mentionTimer = 0, mentionRequest = 0;
  const hideMentions = () => { mentionBox.hidden = true; mentionBox.replaceChildren(); mentionMatches = []; mentionActive = -1; mentionRange = null; };
  const chooseMention = (index) => {
    const person = mentionMatches[index], range = mentionRange;
    if (!person || !range) return;
    const insertion = `@${person.username} `;
    const value = mentionInput.value;
    mentionInput.value = value.slice(0, range.start) + insertion + value.slice(range.end);
    const caret = range.start + insertion.length;
    mentionInput.focus(); mentionInput.setSelectionRange(caret, caret);
    hideMentions();
  };
  const paintMentionActive = () => mentionBox.querySelectorAll("[data-mention-index]").forEach((el, i) => {
    const active = i === mentionActive;
    el.classList.toggle("active", active);
    el.setAttribute("aria-selected", String(active));
  });
  const refreshMentions = () => {
    const caret = mentionInput.selectionStart ?? mentionInput.value.length;
    const before = mentionInput.value.slice(0, caret);
    const match = /(^|\s)@([a-z0-9_]{0,30})$/i.exec(before);
    if (!match) { hideMentions(); return; }
    const query = match[2].toLowerCase();
    mentionRange = { start: before.length - match[0].length + match[1].length, end: caret };
    const request = ++mentionRequest;
    clearTimeout(mentionTimer);
    mentionTimer = setTimeout(async () => {
      try {
        const rows = await DB.find(query, me.id);
        if (request !== mentionRequest || !mentionRange) return;
        mentionMatches = rows.filter((p) => p.username?.toLowerCase().startsWith(query)).slice(0, 7);
        mentionMatches.forEach((p) => { known[p.id] = p; });
        mentionActive = mentionMatches.length ? 0 : -1;
        mentionBox.innerHTML = mentionMatches.map((p, i) => `<button type="button" class="mention-option${i === mentionActive ? " active" : ""}" role="option" aria-selected="${i === mentionActive}" data-mention-index="${i}"><img src="${av(p)}" alt=""><span><b>${esc(p.full_name || p.username)}</b><small>@${esc(p.username)}</small></span>${accountBadges(p)}</button>`).join("");
        mentionBox.hidden = !mentionMatches.length;
      } catch { hideMentions(); }
    }, query ? 160 : 40);
  };
  mentionInput.addEventListener("input", refreshMentions);
  mentionInput.addEventListener("input", sendTyping);
  mentionInput.addEventListener("click", refreshMentions);
  mentionInput.addEventListener("keyup", (e) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) refreshMentions(); });
  mentionBox.addEventListener("mousedown", (e) => e.preventDefault());
  mentionBox.addEventListener("click", (e) => {
    const option = e.target.closest("[data-mention-index]");
    if (option) chooseMention(Number(option.dataset.mentionIndex));
  });
  const postTextInput = $("#post-text"), postMentionBox = $("#post-mention-suggestions");
  let postMentionMatches = [], postMentionActive = -1, postMentionRange = null, postMentionTimer = 0, postMentionRequest = 0;
  const hidePostMentions = () => { postMentionBox.hidden = true; postMentionBox.replaceChildren(); postMentionMatches = []; postMentionActive = -1; postMentionRange = null; };
  const choosePostMention = (index) => {
    const person = postMentionMatches[index], range = postMentionRange;
    if (!person || !range) return;
    const insertion = `@${person.username} `;
    postTextInput.value = postTextInput.value.slice(0, range.start) + insertion + postTextInput.value.slice(range.end);
    const caret = range.start + insertion.length;
    postTextInput.focus(); postTextInput.setSelectionRange(caret, caret);
    hidePostMentions();
  };
  const refreshPostMentions = () => {
    const caret = postTextInput.selectionStart ?? postTextInput.value.length;
    const before = postTextInput.value.slice(0, caret);
    const match = /(^|\s)@([a-z0-9_]{0,30})$/i.exec(before);
    if (!match) { hidePostMentions(); return; }
    const query = match[2].toLowerCase();
    postMentionRange = { start: before.length - match[0].length + match[1].length, end: caret };
    const request = ++postMentionRequest;
    clearTimeout(postMentionTimer);
    postMentionTimer = setTimeout(async () => {
      try {
        const rows = await DB.find(query, me.id);
        if (request !== postMentionRequest || !postMentionRange) return;
        postMentionMatches = rows.filter((p) => p.username?.toLowerCase().startsWith(query)).slice(0, 7);
        postMentionMatches.forEach((p) => { known[p.id] = p; });
        postMentionActive = postMentionMatches.length ? 0 : -1;
        postMentionBox.innerHTML = postMentionMatches.map((p, i) => `<button type="button" class="mention-option${i === postMentionActive ? " active" : ""}" role="option" aria-selected="${i === postMentionActive}" data-post-mention-index="${i}"><img src="${av(p)}" alt=""><span><b>${esc(p.full_name || p.username)}</b><small>@${esc(p.username)}</small></span>${accountBadges(p)}</button>`).join("");
        postMentionBox.hidden = !postMentionMatches.length;
      } catch { hidePostMentions(); }
    }, query ? 160 : 40);
  };
  postTextInput.addEventListener("input", refreshPostMentions);
  postTextInput.addEventListener("click", refreshPostMentions);
  postTextInput.addEventListener("keyup", (e) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) refreshPostMentions(); });
  postMentionBox.addEventListener("mousedown", (e) => e.preventDefault());
  postMentionBox.addEventListener("click", (e) => {
    const option = e.target.closest("[data-post-mention-index]");
    if (option) choosePostMention(Number(option.dataset.postMentionIndex));
  });
  postTextInput.addEventListener("keydown", (e) => {
    if (postMentionBox.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = postMentionMatches.length;
      if (n) postMentionActive = (postMentionActive + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
      postMentionBox.querySelectorAll("[data-post-mention-index]").forEach((el, i) => {
        el.classList.toggle("active", i === postMentionActive);
        el.setAttribute("aria-selected", String(i === postMentionActive));
      });
    } else if (e.key === "Enter" && postMentionActive >= 0) {
      e.preventDefault(); choosePostMention(postMentionActive);
    } else if (e.key === "Escape") {
      e.preventDefault(); hidePostMentions();
    }
  });
  async function send(file) {
    const text = $("#msg").value.trim();
    if (!target || (!text && !file)) return;
    busy(true);
    const tg = target;
    let tmp = null,
      up = null;
    try {
      let extra = {};
      if (file) {
        file = await DB.prepare(file);
        up = await uploadBubble(file, tg);
        extra = {
          file_url: await DB.upload("files", me.id, file, {
            onProgress: up.set,
            signal: up.signal,
          }),
          file_name: file.name,
          file_type: file.type || "application/octet-stream",
          file_size: file.size,
        };
        // yuborgan odamda ham, keyin ham video darhol to'g'ri o'lchamda chiqadi
        if (up.dims) vdSet(extra.file_url, up.dims.w, up.dims.h);
      } else {
        // matn: darhol chiqadi (soat belgisi), server tasdiqlagach "yuborildi" bo'ladi
        tmp = {
          id: "tmp" + ++tmpN,
          _tmp: true,
          sender: me.id,
          body: text,
          created_at: new Date().toISOString(),
          room_id: tg.type === "room" ? tg.id : null,
          reply_to: activeReply?.id || null,
        };
        add(tmp);
        $("#msg").value = "";
        hideMentions();
      }
      const m = await DB.send(me.id, tg, {
        body: text || null,
        reply_to: activeReply?.id || null,
        ...extra,
      });
      if (tg.type === "user" && tg.id !== me.id) {
        sendNativePush(tg.id, text || (file ? "Fayl yuborildi" : "Yangi xabar"), m.id);
      }
      up?.remove();
      up = null;
      activeReply = null;
      $("#reply-preview").classList.add("hide");
      if (file) { $("#msg").value = ""; hideMentions(); }
      if (target === tg) {
        if (tmp) {
          loaded.delete(String(tmp.id));
          loaded.set(String(m.id), m);
          const el = body.querySelector(`[data-mid="${tmp.id}"]`);
          if (el) el.outerHTML = msgHTML(m);
          seenLine(true);
          body.scrollTop = body.scrollHeight;
        } else add(m);
      }
      new Audio("/music/send-effect.mp3").play().catch(() => {});
      if (tg.type === "user") loadChats();
      else loadRooms();
    } catch (x) {
      up?.remove();
      if (tmp) {
        loaded.delete(String(tmp.id));
        body.querySelector(`[data-mid="${tmp.id}"]`)?.remove();
        seenLine();
        $("#msg").value = text;
      }
      if (x?.message === "aborted") {
        /* foydalanuvchi bekor qildi */
      } else if (x?.code === "42501" && tg.type === "user")
        toast(t("cant_send"));
      else fail(x);
    }
    busy(false);
  }
  $("#send").onclick = () => send();

  // Firefox Android may keep the layout viewport full-height when its keyboard
  // opens. Resize the app to the visual viewport so the composer stays visible.
  const messageInput = $("#msg");
  const visualViewport = window.visualViewport;
  let keyboardViewportBase = 0;
  let keyboardCloseTimer;
  const syncKeyboardViewport = () => {
    if (!messageInput || window.innerWidth > 767 || !visualViewport) return;
    const focused = document.activeElement === messageInput;
    if (!focused || !keyboardViewportBase) {
      document.body.classList.remove("mobile-keyboard-open");
      document.documentElement.style.removeProperty("--xabarim-visual-height");
      if (!focused) keyboardViewportBase = 0;
      return;
    }
    const keyboardOpen = visualViewport.height < keyboardViewportBase - 100;
    document.body.classList.toggle("mobile-keyboard-open", keyboardOpen);
    if (keyboardOpen) {
      document.documentElement.style.setProperty(
        "--xabarim-visual-height",
        Math.round(visualViewport.height) + "px",
      );
    } else {
      document.documentElement.style.removeProperty("--xabarim-visual-height");
    }
  };
  messageInput?.addEventListener("focus", () => {
    clearTimeout(keyboardCloseTimer);
    if (window.innerWidth <= 767 && visualViewport) {
      keyboardViewportBase = visualViewport.height;
      requestAnimationFrame(syncKeyboardViewport);
    }
  });
  messageInput?.addEventListener("blur", () => {
    keyboardCloseTimer = setTimeout(() => {
      keyboardViewportBase = 0;
      syncKeyboardViewport();
    }, 120);
  });
  visualViewport?.addEventListener("resize", syncKeyboardViewport);
  window.addEventListener("resize", syncKeyboardViewport);

  mentionInput.onkeydown = (e) => {
    if (!mentionBox.hidden) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = mentionMatches.length;
        if (n) mentionActive = (mentionActive + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
        paintMentionActive();
        return;
      }
      if (e.key === "Enter" && mentionActive >= 0) { e.preventDefault(); chooseMention(mentionActive); return; }
      if (e.key === "Escape") { e.preventDefault(); hideMentions(); return; }
    }
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      send();
    }
  };
  $("#attach").onclick = () => $("#file").click();
  $("#file").onchange = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) send(f);
  };

  // ======================================================================
  // Xabarlarga reaksiya (animatsiyali stikerlar) + ovozli xabarlar
  // ======================================================================
  // ---- Reaksiya stikerlari: Google "Noto Animated Emoji" (harakatlanuvchi). Yuklanmasa oddiy emoji ko'rinadi.
  const RX = [
    ["👍", "1f44d"],
    ["❤️", "2764_fe0f"],
    ["😂", "1f602"],
    ["🔥", "1f525"],
    ["😮", "1f62e"],
    ["😢", "1f622"],
    ["🎉", "1f389"],
    ["👏", "1f44f"],
  ];
  const stk = (e) => `<span class="stk-txt">${esc(e)}</span>`;
  document.addEventListener(
    "error",
    (e) => {
      const i = e.target;
      if (i?.classList?.contains("stk")) {
        const s = document.createElement("span");
        s.className = "stk-txt";
        s.textContent = i.alt;
        i.replaceWith(s);
      }
    },
    true,
  );
  const reactions = new Map(); // message id -> [{ message_id, user_id, emoji }]
  const rxHTML = (id) => {
    const rs = reactions.get(String(id));
    if (!rs?.length) return "";
    const g = new Map();
    rs.forEach((r) => {
      const x = g.get(r.emoji) || { n: 0, mine: false };
      x.n++;
      if (r.user_id === me.id) x.mine = true;
      g.set(r.emoji, x);
    });
    return `<div class="msg-reacts">${[...g].map(([e, x]) => `<button type="button" class="rx${x.mine ? " mine" : ""}" data-rx-chip="${esc(e)}" aria-label="${esc(e)} ${x.n}">${stk(e)}${x.n > 1 ? `<b>${x.n}</b>` : ""}</button>`).join("")}</div>`;
  };
  const rxRow = (m) => {
    const cur = reactions
      .get(String(m.id))
      ?.find((r) => r.user_id === me.id)?.emoji;
    return `<div class="rx-row">${RX.map(([e], i) => `<button type="button" data-react="${esc(e)}" class="${cur === e ? "on" : ""}" style="--i:${i}" aria-label="${esc(e)}">${stk(e)}</button>`).join("")}</div>`;
  };
  const paintReacts = (id, pop) => {
    const el = body.querySelector(`.msg[data-mid="${id}"]`);
    if (!el) return;
    el.querySelector(".msg-reacts")?.remove();
    const h = rxHTML(id);
    if (!h) return;
    el.querySelector(".msg-footer")?.insertAdjacentHTML("beforebegin", h);
    if (pop)
      el.querySelector(`[data-rx-chip="${CSS.escape(pop)}"]`)?.classList.add(
        "pop",
      );
  };
  const setReactions = (rows) => {
    reactions.clear();
    (rows || []).forEach((r) => {
      const k = String(r.message_id);
      if (!reactions.has(k)) reactions.set(k, []);
      reactions.get(k).push(r);
    });
  };
  // bir odam bir xabarga bitta reaksiya: bosilsa qo'yiladi, xuddi shu stiker qayta bosilsa olib tashlanadi
  const react = async (m, emoji) => {
    const id = String(m.id),
      list = reactions.get(id) || [];
    const prev = list.find((r) => r.user_id === me.id)?.emoji || null;
    const next = prev === emoji ? null : emoji;
    const apply = (e) => {
      const rest = (reactions.get(id) || []).filter((r) => r.user_id !== me.id);
      if (e) rest.push({ message_id: m.id, user_id: me.id, emoji: e });
      reactions.set(id, rest);
    };
    apply(next);
    paintReacts(id, next);
    try {
      if (next) await DB.reactMsg(me.id, m.id, next);
      else await DB.unreactMsg(me.id, m.id);
    } catch (x) {
      apply(prev);
      paintReacts(id);
      if (
        x?.code === "42P01" ||
        x?.code === "PGRST205" ||
        /message_reactions/.test(x?.message || "")
      )
        toast(t("react_need_sql"));
      else fail(x);
    }
  };
  DB.listenReactions((ev, row) => {
    if (!row?.message_id) return;
    const id = String(row.message_id);
    if (!loaded.has(id)) return;
    const rest = (reactions.get(id) || []).filter(
      (r) => r.user_id !== row.user_id,
    );
    if (ev !== "DELETE" && row.emoji) rest.push(row);
    reactions.set(id, rest);
    paintReacts(id, ev !== "DELETE" ? row.emoji : null);
  });

  // ---- Ovozli xabar pleyeri (bitta umumiy Audio: bir vaqtda faqat bitta xabar eshitiladi)
  const vAudio = new Audio();
  vAudio.preload = "none";
  let vActive = null,
    vSpeed = 0;
  const VSPEEDS = [1, 1.5, 2];
  const voiceDur = (m) => {
    const x = /^voice-(\d+)\./.exec(String(m.file_name || ""));
    return x ? Math.max(0, +x[1] / 1000) : 0;
  };
  const voiceBars = (seed) => {
    let h = 7;
    for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: 34 }, (_, i) => {
      h = (h * 1664525 + 1013904223) >>> 0;
      const v = 22 + ((h >>> 9) % 70),
        env = 0.55 + 0.45 * Math.sin((i / 33) * Math.PI);
      return `<i style="--h:${Math.round(v * env)}%"></i>`;
    }).join("");
  };
  const voiceHTML = (m, u) =>
    `<div class="msg-voice" data-voice="${esc(m.id)}" data-src="${u}" data-dur="${voiceDur(m)}"><button type="button" class="vp-play" data-voice-play aria-label="${esc(t("voice_play"))}"><i class="bi bi-play-fill"></i></button><div class="vp-body"><div class="vp-wave" data-voice-seek>${voiceBars(m.file_url || m.id)}</div><div class="vp-meta"><span class="vp-time">${videoClock(voiceDur(m))}</span><button type="button" class="vp-speed hide" data-voice-speed>${VSPEEDS[vSpeed]}x</button></div></div></div>`;
  const vDur = (el) =>
    +el.dataset.dur ||
    (el === vActive && Number.isFinite(vAudio.duration) ? vAudio.duration : 0);
  const vPaint = (el, playing) => {
    if (!el) return;
    el.classList.toggle("playing", !!playing);
    el.querySelector(".vp-play i").className =
      "bi bi-" + (playing ? "pause-fill" : "play-fill");
    const cur = el === vActive ? vAudio.currentTime : 0,
      dur = vDur(el),
      p = dur ? Math.min(1, cur / dur) : 0;
    const bars = (el._bars ||= [...el.querySelectorAll(".vp-wave i")]),
      k = Math.round(p * bars.length);
    bars.forEach((b, i) => b.classList.toggle("on", i < k));
    el.querySelector(".vp-time").textContent = videoClock(
      el === vActive && cur > 0 ? cur : dur,
    );
  };
  const vStop = () => {
    vAudio.pause();
    if (vActive) {
      const old = vActive;
      vActive = null;
      vPaint(old, false);
      old.querySelector(".vp-speed")?.classList.add("hide");
    }
  };
  const voiceToggle = (el) => {
    if (vActive && !vActive.isConnected) vActive = null;
    if (vActive === el && !vAudio.paused) {
      vAudio.pause();
      return;
    }
    if (vActive !== el) {
      if (vActive) {
        const old = vActive;
        vActive = null;
        vAudio.pause();
        vPaint(old, false);
        old.querySelector(".vp-speed")?.classList.add("hide");
      }
      vActive = el;
      vAudio.src = el.dataset.src;
    }
    vAudio.defaultPlaybackRate = vAudio.playbackRate = VSPEEDS[vSpeed];
    const sp = el.querySelector(".vp-speed");
    sp.textContent = VSPEEDS[vSpeed] + "x";
    sp.classList.remove("hide");
    const pr = vAudio.play(); // iOS: foydalanuvchi bosishi bilan bir zumda chaqiriladi
    if (pr?.catch)
      pr.catch((err) => {
        if (err?.name !== "AbortError") {
          toast(t("voice_play_failed"));
          vPaint(el, false);
        }
      });
  };
  vAudio.addEventListener("play", () => vPaint(vActive, true));
  vAudio.addEventListener("pause", () => vPaint(vActive, false));
  vAudio.addEventListener("timeupdate", () => vPaint(vActive, !vAudio.paused));
  vAudio.addEventListener("loadedmetadata", () => {
    if (vActive && !+vActive.dataset.dur && Number.isFinite(vAudio.duration))
      vActive.dataset.dur = vAudio.duration;
    vPaint(vActive, !vAudio.paused);
  });
  vAudio.addEventListener("ended", () => {
    const el = vActive;
    vAudio.currentTime = 0;
    vPaint(el, false);
  });
  vAudio.addEventListener("error", () => {
    if (vActive) {
      toast(t("voice_play_failed"));
      vPaint(vActive, false);
    }
  });
  const voiceClick = (e) => {
    const el = e.target.closest(".msg-voice");
    if (!el) return false;
    if (e.target.closest("[data-voice-speed]")) {
      vSpeed = (vSpeed + 1) % VSPEEDS.length;
      vAudio.defaultPlaybackRate = vAudio.playbackRate = VSPEEDS[vSpeed];
      document
        .querySelectorAll(".vp-speed")
        .forEach((b) => (b.textContent = VSPEEDS[vSpeed] + "x"));
      return true;
    }
    if (e.target.closest("[data-voice-play]")) {
      voiceToggle(el);
      return true;
    }
    const wave = e.target.closest("[data-voice-seek]");
    if (wave) {
      if (el === vActive) {
        const r = wave.getBoundingClientRect(),
          dur = vDur(el);
        if (dur && r.width) {
          try {
            vAudio.currentTime = Math.max(
              0,
              Math.min(dur, ((e.clientX - r.left) / r.width) * dur),
            );
          } catch {}
          vPaint(el, !vAudio.paused);
        }
      } else voiceToggle(el);
      return true;
    }
    return false;
  };

  // ---- Ovoz yozish: mikrofon tugmasi -> yozish paneli (bekor qilish / yuborish)
  var rec = {
    mr: null,
    stream: null,
    chunks: [],
    t0: 0,
    tick: 0,
    cancel: false,
  };
  const REC_MAX = 5 * 60 * 1000;
  const recMime = () => {
    if (!window.MediaRecorder) return "";
    // audio/mp4 (AAC) hamma joyda, jumladan iPhone'da ham eshitiladi; webm eski iOS'da o'ynamasligi mumkin
    return (
      [
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((x) => {
        try {
          return MediaRecorder.isTypeSupported(x);
        } catch {
          return false;
        }
      }) || ""
    );
  };
  const recEnd = () => {
    clearInterval(rec.tick);
    rec.stream?.getTracks().forEach((tr) => tr.stop());
    rec.stream = null;
    $(".input-box").classList.remove("recording");
  };
  function recCancel() {
    if (rec?.mr && rec.mr.state !== "inactive") {
      rec.cancel = true;
      try {
        rec.mr.stop();
      } catch {
        recEnd();
        rec.mr = null;
      }
    }
  }
  const recStart = async () => {
    if (!target || rec.mr) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast(t("voice_unsupported"));
      return;
    }
    vStop();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (x) {
      toast(
        t(
          x?.name === "NotFoundError" || x?.name === "OverconstrainedError"
            ? "mic_missing"
            : "mic_denied",
        ),
      );
      return;
    }
    const mime = recMime();
    let mr;
    try {
      mr = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((tr) => tr.stop());
      toast(t("voice_unsupported"));
      return;
    }
    rec = { mr, stream, chunks: [], t0: Date.now(), tick: 0, cancel: false };
    mr.ondataavailable = (e) => {
      if (e.data?.size) rec.chunks.push(e.data);
    };
    mr.onstop = () => {
      const dur = Date.now() - rec.t0,
        cancelled = rec.cancel,
        chunks = rec.chunks;
      const type = (mr.mimeType || mime || "audio/webm").split(";")[0];
      rec.mr = null;
      rec.chunks = [];
      recEnd();
      if (cancelled || dur < 700 || !chunks.length) return;
      const ext = type.includes("mp4")
        ? "m4a"
        : type.includes("ogg")
          ? "ogg"
          : "webm";
      send(new File(chunks, `voice-${dur}.${ext}`, { type }));
    };
    try {
      mr.start(250);
    } catch {
      recEnd();
      rec.mr = null;
      toast(t("voice_unsupported"));
      return;
    }
    $(".input-box").classList.add("recording");
    $("#rec-time").textContent = "0:00";
    rec.tick = setInterval(() => {
      const ms = Date.now() - rec.t0;
      $("#rec-time").textContent = videoClock(ms / 1000);
      if (ms >= REC_MAX && mr.state === "recording") mr.stop();
    }, 250);
  };
  $(".rec-wave").innerHTML = Array.from(
    { length: 30 },
    (_, i) => `<i style="animation-delay:${-((i * 97) % 1000)}ms"></i>`,
  ).join("");
  $("#mic").onclick = recStart;
  $("#rec-cancel").onclick = recCancel;
  $("#rec-send").onclick = () => {
    if (rec.mr?.state === "recording") rec.mr.stop();
  };
  // matn yozilsa "yuborish", bo'sh bo'lsa "mikrofon" tugmasi chiqadi (value dasturiy o'zgarganda ham)
  const msgInput = $("#msg");
  const syncComposer = () => {
    const has = msgInput.value.trim().length > 0;
    $("#mic").classList.toggle("hide", has);
    $("#send").classList.toggle("hide", !has);
  };
  const valueDesc = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  Object.defineProperty(msgInput, "value", {
    configurable: true,
    get() {
      return valueDesc.get.call(this);
    },
    set(v) {
      valueDesc.set.call(this, v);
      syncComposer();
    },
  });
  msgInput.addEventListener("input", syncComposer);
  syncComposer();

  // ---- postlar
  // ---- Post kartasi (lenta): hamma postlar bir xil kenglikda, yurakcha (like) Instagramdagidek
  const LIKE_EMOJIS = ["❤️", "👍"]; // eski 👍 yoqtirishlar ham "yoqdi" hisoblanadi
  const isLikeRx = (r) => LIKE_EMOJIS.includes(r.emoji);
  const fitFeedImage = (img) => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const media = img.closest(".post-media");
    if (!media) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    media.classList.toggle("post-media--portrait", ratio < 1);
    media.classList.toggle("post-media--wide", ratio > 1.91);
  };
  const postHTML = (p) => {
    const a = p.profiles || {};
    const rs = engagement.reactions.filter((r) => r.post_id === p.id),
      mine = rs.find((r) => r.user_id === me.id);
    const liked = !!mine && isLikeRx(mine),
      likes = rs.filter(isLikeRx).length;
    const cs = engagement.comments.filter((c) => c.post_id === p.id);
    const totalEngagement = rs.length + cs.length;
    const reactionEmojis = ["❤️", "🔥", "😂", "🥰", "👏", "😮", "😢", "🙏"];
    const name = a.full_name || a.username;
    const media = p.image_url
      ? `<div class="post-media"><img class="post-img" src="${url(p.image_url)}" loading="lazy" alt=""><button type="button" class="post-image-expand" data-post-zoom aria-label="${esc(t("view_full_image"))}" title="${esc(t("view_full_image"))}"><i class="bi bi-arrows-fullscreen" aria-hidden="true"></i></button><i class="bi bi-heart-fill post-burst" aria-hidden="true"></i></div>`
      : "";
    const caption = p.body
      ? p.image_url
        ? `<p class="post-text">${mentionTextHTML(p.body)}</p>`
        : `<p class="post-text only">${mentionTextHTML(p.body)}</p>`
      : "";
    return `<article class="post" data-post="${p.id}"><div class="post-h"><img class="post-author" data-author="${esc(p.author)}" src="${av(a)}" alt=""><div class="post-author" data-author="${esc(p.author)}"><b>${esc(name)}${accountBadges(a)}</b><small>@${esc(a.username)} · ${dt(p.created_at)}</small></div>${p.author === me.id ? `<button class="icon-btn del" data-del="${p.id}" aria-label="O‘chirish"><i class="bi bi-trash"></i></button>` : ""}</div>${p.image_url ? media : caption}<div class="post-actions"><button class="like-btn${liked ? " reacted" : ""}" data-vote="❤️" data-post-id="${p.id}" aria-label="${esc(t("post_like"))}" aria-pressed="${liked}"><i class="bi bi-heart${liked ? "-fill" : ""}"></i><span class="like-count">${likes}</span></button><button data-comments="${p.id}" aria-label="Izohlar"><i class="bi bi-chat"></i> ${cs.length}</button><button class="post-stats-btn" data-post-stats="${p.id}" aria-label="Post statistikasi"><i class="bi bi-bar-chart-line"></i><span>${totalEngagement || ""}</span></button></div>${p.image_url ? caption : ""}<div class="comment-area hide" data-comment-area="${p.id}">${cs.map((c) => `<div class="post-comment${reactionEmojis.includes(c.body) ? " reaction-comment" : ""}" data-comment-id="${esc(c.id)}" data-comment-user="${esc(c.user_id)}"><b>${esc(c.profiles?.full_name || c.profiles?.username || "User")}</b> <span>${esc(c.body)}</span></div>`).join("")}<div class="comment-compose"><button class="comment-emoji-btn" data-toggle-emoji="${p.id}" aria-label="Reaksi"><i class="bi bi-emoji-smile"></i></button><input maxlength="1000" placeholder="Izoh yozing…"><button data-comment-send="${p.id}" aria-label="Send"><i class="bi bi-send-fill"></i></button></div><div class="reaction-picker hide" data-comment-picker="${p.id}">${reactionEmojis.map((x) => `<button data-comment-emoji="${x}">${x}</button>`).join("")}</div></div></article>`;
  };
  // kartani qayta chizmasdan yurakcha va sonlarni yangilaydi (izoh maydoni va yozilgan matn yo'qolmaydi)
  const paintLike = (postId) => {
    const card = $(`#feed-list [data-post="${postId}"]`);
    if (!card) return false;
    const rs = engagement.reactions.filter((r) => r.post_id === postId),
      mine = rs.find((r) => r.user_id === me.id);
    const liked = !!mine && isLikeRx(mine),
      n = rs.filter(isLikeRx).length;
    const btn = card.querySelector(".like-btn");
    btn.classList.toggle("reacted", liked);
    btn.setAttribute("aria-pressed", String(liked));
    btn.querySelector("i").className = "bi bi-heart" + (liked ? "-fill" : "");
    const count = btn.querySelector(".like-count");
    if (count) count.textContent = String(n);
    const st = card.querySelector("[data-post-stats]");
    if (st)
      st.innerHTML = `<i class="bi bi-bar-chart-line"></i><span>${rs.length + engagement.comments.filter((c) => c.post_id === postId).length || ""}</span>`;
    return liked;
  };
  // yurakcha bosilsa qo'yiladi/olinadi; rasmni ikki marta bosish (onlyLike) faqat qo'yadi
  const setLike = async (postId, onlyLike = false) => {
    const current = engagement.reactions.find(
        (r) => r.post_id === postId && r.user_id === me.id,
      ),
      previous = current ? { ...current } : null;
    const liked = !!current && isLikeRx(current);
    if (liked && onlyLike) return;
    if (liked)
      engagement.reactions = engagement.reactions.filter(
        (r) => !(r.post_id === postId && r.user_id === me.id),
      );
    else if (current) current.emoji = "❤️";
    else
      engagement.reactions.push({
        post_id: postId,
        user_id: me.id,
        emoji: "❤️",
      });
    if (paintLike(postId)) {
      const b = $(`#feed-list [data-post="${postId}"] .like-btn`);
      b.classList.remove("pop");
      void b.offsetWidth;
      b.classList.add("pop");
    }
    try {
      if (liked) await DB.unreact(postId);
      else {
        await DB.react(postId, "❤️");
        const post = feedPosts.find((item) => String(item.id) === String(postId));
        if (post?.author && post.author !== me.id)
          void sendNativePush(post.author, "postingizga reaksiya bildirdi");
      }
    } catch (x) {
      if (previous) {
        const row = engagement.reactions.find(
          (r) => r.post_id === postId && r.user_id === me.id,
        );
        if (row) row.emoji = previous.emoji;
        else engagement.reactions.push(previous);
      } else
        engagement.reactions = engagement.reactions.filter(
          (r) => !(r.post_id === postId && r.user_id === me.id),
        );
      paintLike(postId);
      fail(x);
    }
  };
  const feedLoadingHTML = () =>
    `<div class="feed-loading" role="status" aria-live="polite"><span class="xs-spin xs-spin-lg"></span><span>${t("feed_loading")}</span></div>`;
  const paintFeedMode = () => {
    $("#feed-tabs").classList.toggle("hide", !!feedUser);
    $("#feed-user-bar").classList.toggle("hide", !feedUser);
    $("#feed-tabs")
      .querySelectorAll("[data-mode]")
      .forEach((b) => b.classList.toggle("on", b.dataset.mode === feedMode));
    if (feedUser)
      $("#feed-user-title").textContent = t("user_posts", {
        name: feedUser.name || "",
      });
  };
  // showLoader=true: "Postlar yuklanmoqda…" ko'rsatiladi (birinchi ochilish, rejim almashishi). Aks holda jimgina yangilanadi.
  async function loadFeed(showLoader = false) {
    const seq = ++feedSeq,
      list = $("#feed-list");
    paintFeedMode();
    if (showLoader || !feedPosts.length) list.innerHTML = feedLoadingHTML();
    try {
      const ps = feedUser
        ? await DB.userPosts(feedUser.id)
        : await DB.posts(feedMode === "following", following);
      if (
        feedUser?.focus &&
        !ps.some((p) => String(p.id) === String(feedUser.focus))
      ) {
        const focusedPost = await DB.postById(feedUser.focus);
        if (focusedPost?.author === feedUser.id) ps.unshift(focusedPost);
      }
      if (seq !== feedSeq) return; // yangiroq so'rov ketgan, eskisini tashlaymiz
      feedPosts = ps;
      if (feedUser && !feedUser.name && ps[0]?.profiles) {
        feedUser.name = ps[0].profiles.full_name || ps[0].profiles.username;
        paintFeedMode();
      }
      try {
        engagement = await DB.postEngagement(
          ps.map((p) => p.id),
          me.id,
        );
      } catch (x) {
        console.error("Post engagement could not be loaded:", x);
        engagement = { comments: [], reactions: [] };
      }
      if (seq !== feedSeq) return;
      const q = $("#search").value.trim().toLocaleLowerCase();
      const trendCounts = new Map();
      for (const reaction of engagement.reactions) {
        const counts = trendCounts.get(reaction.post_id) || { reactions: 0, comments: 0 };
        counts.reactions++;
        trendCounts.set(reaction.post_id, counts);
      }
      for (const comment of engagement.comments) {
        const counts = trendCounts.get(comment.post_id) || { reactions: 0, comments: 0 };
        counts.comments++;
        trendCounts.set(comment.post_id, counts);
      }
      const trendScore = (post) => {
        const counts = trendCounts.get(post.id) || { reactions: 0, comments: 0 };
        const ageHours = Math.max(
          0,
          (Date.now() - new Date(post.created_at).getTime()) / 3600000,
        );
        return (
          (counts.reactions * 2 + counts.comments * 3 + 1) /
          Math.pow(ageHours + 2, 0.65)
        );
      };
      const orderedPosts = !feedUser && feedMode === "trending"
        ? [...ps].sort((a, b) => trendScore(b) - trendScore(a))
        : ps;
      const filtered = q
        ? orderedPosts.filter(
            (p) =>
              (p.body || "").toLocaleLowerCase().includes(q) ||
              (p.profiles?.username || "").toLocaleLowerCase().includes(q) ||
              (p.profiles?.full_name || "").toLocaleLowerCase().includes(q),
          )
        : orderedPosts;
      list.innerHTML = filtered.length
        ? filtered.map(postHTML).join("")
        : `<div class="list-empty">${t("no_feed")}</div>`;
      list.querySelectorAll(".post-img").forEach(fitFeedImage);
      if (feedUser?.focus) {
        const focusId = String(feedUser.focus),
          commentRequest = feedUser.comment;
        const el = [...list.querySelectorAll("[data-post]")].find(
          (node) => node.dataset.post === focusId,
        );
        feedUser.focus = null;
        feedUser.comment = null;
        if (el) {
          el.scrollIntoView({ block: "start" });
          el.classList.add("post-focus");
          setTimeout(() => el.classList.remove("post-focus"), 2200);
          if (commentRequest) {
            const matches = engagement.comments.filter(
              (c) =>
                String(c.post_id) === focusId &&
                c.user_id === commentRequest.actorId &&
                c.body === commentRequest.body,
            );
            matches.sort(
              (a, b) =>
                Math.abs(
                  new Date(a.created_at) - new Date(commentRequest.createdAt),
                ) -
                Math.abs(
                  new Date(b.created_at) - new Date(commentRequest.createdAt),
                ),
            );
            const commentId = matches[0] && String(matches[0].id);
            if (commentId) {
              const area = el.querySelector(`[data-comment-area="${focusId}"]`);
              area?.classList.remove("hide");
              const comment = [
                ...(area?.querySelectorAll("[data-comment-id]") || []),
              ].find((node) => node.dataset.commentId === commentId);
              if (comment) {
                comment.classList.add("notification-focus");
                setTimeout(
                  () => comment.classList.remove("notification-focus"),
                  2600,
                );
                comment.scrollIntoView({ block: "center" });
              }
            }
          }
        }
      }
    } catch (x) {
      if (seq !== feedSeq) return;
      console.error("Feed load failed:", x);
      const why = [x?.code, x?.message].filter(Boolean).join(": ");
      list.innerHTML = `<div class="list-empty feed-error">${t("feed_error")}${why ? `<br><small class="text-muted">${esc(why)}</small>` : ""}<br><button class="btn-brand mt-2" data-feed-retry type="button">${t("retry")}</button></div>`;
    }
    return true;
  }
  // Profildagi postni bosganda: postlar bo'limiga o'tib, shu akkaunt postlarini lentada katta qilib ko'rsatamiz
  const openPostFromProfile = (e) => {
    const c = e.target.closest("[data-open-post]");
    if (!c) return;
    feedUser = {
      id: c.dataset.postUser,
      name: c.dataset.postName || "",
      focus: +c.dataset.openPost,
    };
    $("#search").value = "";
    pm.hide();
    peerModal.hide();
    setTab("posts", true);
  };
  $("#my-account-posts").onclick = openPostFromProfile;
  $("#peer-account-posts").onclick = (e) => {
    const b = e.target.closest("[data-load-peer-posts]");
    if (b) {
      const id = b.dataset.loadPeerPosts;
      loadAccountPosts(
        id,
        $("#peer-account-posts"),
        () => target?.type === "user" && target.id === id,
      );
      return;
    }
    openPostFromProfile(e);
  };
  $("#my-account-posts").onkeydown = $("#peer-account-posts").onkeydown = (
    e,
  ) => {
    if (
      (e.key === "Enter" || e.key === " ") &&
      e.target.closest("[data-open-post]")
    ) {
      e.preventDefault();
      openPostFromProfile(e);
    }
  };
  $("#feed-user-close").onclick = () => {
    feedUser = null;
    feedPosts = [];
    loadFeed(true);
  };
  const renderAccountPosts = (
    el,
    posts,
    eng = { comments: [], reactions: [] },
  ) => {
    el.innerHTML = posts.length
      ? posts
          .map((p) => {
            const likes = eng.reactions.filter(
                (r) => r.post_id === p.id,
              ).length,
              cmts = eng.comments.filter((c) => c.post_id === p.id).length;
            return `<article class="account-post" role="button" tabindex="0" data-open-post="${p.id}" data-post-user="${esc(p.author)}" data-post-name="${esc(p.profiles?.full_name || p.profiles?.username || "")}">${p.image_url ? `<img src="${url(p.image_url)}" loading="lazy" alt="">` : ""}${p.body ? `<p>${esc(p.body)}</p>` : ""}<small>${dt(p.created_at)}</small><div class="account-post-meta"><span><i class="bi bi-heart"></i> ${likes}</span><span><i class="bi bi-chat"></i> ${cmts}</span></div></article>`;
          })
          .join("")
      : `<div class="account-post-empty">Hozircha post yo‘q</div>`;
  };
  // Suhbatdosh profilida postlar birdaniga yuklanmaydi: postlar soni va "Postlarni yuklash" tugmasi chiqadi
  const showPeerPostsGate = async (id) => {
    const el = $("#peer-account-posts"),
      cur = () => target?.type === "user" && target.id === id;
    el.innerHTML = `<div class="account-post-empty"><span class="xs-spin"></span></div>`;
    let n = null;
    try {
      n = await DB.userPostCount(id);
    } catch (x) {
      console.error("Post count failed:", x);
    }
    if (!cur()) return;
    el.innerHTML =
      n === 0
        ? `<div class="account-post-empty">${t("no_posts_yet")}</div>`
        : `<div class="account-posts-gate">${n == null ? "" : `<span class="gate-count"><i class="bi bi-grid-3x3-gap-fill"></i> ${t("posts_count", { n })}</span>`}<button type="button" class="btn-brand" data-load-peer-posts="${esc(id)}"><i class="bi bi-images"></i> ${t("load_posts")}</button></div>`;
  };
  const loadAccountPosts = async (userId, el, isCurrent) => {
    el.innerHTML = `<div class="account-post-empty"><span class="xs-spin"></span> ${t("feed_loading")}</div>`;
    try {
      const rows = await DB.userPosts(userId);
      let eng;
      try {
        eng = await DB.postEngagement(
          rows.map((p) => p.id),
          me.id,
        );
      } catch {
        eng = undefined;
      }
      if (isCurrent()) renderAccountPosts(el, rows, eng);
    } catch (x) {
      if (isCurrent())
        el.innerHTML = `<div class="account-post-empty">${x?.code === "42501" || x?.status === 403 ? "Postlarni ko‘rish ruxsati yo‘q. Supabase’da schema_v8.sql migrationini ishga tushiring." : "Postlarni yuklab bo‘lmadi"}</div>`;
      console.error("Account posts could not be loaded:", x);
    }
  };
  $("#feed-tabs").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    feedMode = b.dataset.mode;
    document
      .querySelectorAll("#feed-tabs button")
      .forEach((x) => x.classList.toggle("on", x === b));
    feedPosts = [];
    loadFeed(true);
  };
  let statsRequest = 0;
  const showPostStats = async (postId) => {
    const request = ++statsRequest;
    $("#post-stats-summary").innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status"></span> Yuklanmoqda…';
    $("#post-stats-list").innerHTML = "";
    postStatsM.show();
    try {
      const data = await DB.postEngagement([postId], me.id);
      const userIds = [...new Set(data.reactions.map((r) => r.user_id))];
      await need(userIds);
      if (request !== statsRequest) return;
      const reactions = data.reactions || [],
        comments = data.comments || [];
      const totals = Object.entries(
        reactions.reduce((out, r) => {
          out[r.emoji] = (out[r.emoji] || 0) + 1;
          return out;
        }, {}),
      );
      $("#post-stats-summary").innerHTML =
        `<span><i class="bi bi-people"></i> ${reactions.length} reaksiya</span><span><i class="bi bi-chat"></i> ${comments.length} izoh</span>${totals.map(([emoji, count]) => `<span>${esc(emoji)} ${count}</span>`).join("")}`;
      const reactionList = reactions.length
        ? reactions
            .map((r) => {
              const p = known[r.user_id] || {};
              return `<div class="post-stat-row"><img src="${av(p)}" alt=""><div class="post-stat-person"><b>${esc(p.full_name || p.username || "Foydalanuvchi")}</b><small>@${esc(p.username || "")}</small></div><span class="post-stat-emoji">${esc(r.emoji)}</span></div>`;
            })
            .join("")
        : '<div class="post-stat-empty">Hozircha reaksiya yo‘q</div>';
      const commentList = comments.length
        ? comments
            .map((c) => {
              const p = c.profiles || {};
              return `<div class="post-stat-row post-stat-comment"><img src="${av(p)}" alt=""><div class="post-stat-person"><b>${esc(p.full_name || p.username || "Foydalanuvchi")}</b><small>${dt(c.created_at)}</small><p>${esc(c.body)}</p></div></div>`;
            })
            .join("")
        : '<div class="post-stat-empty">Hozircha izoh yo‘q</div>';
      $("#post-stats-list").innerHTML =
        `<section class="post-stat-section"><h6>Reaksiyalar <span>${reactions.length}</span></h6>${reactionList}</section><section class="post-stat-section"><h6>Izohlar <span>${comments.length}</span></h6>${commentList}</section>`;
    } catch (x) {
      if (request === statsRequest)
        $("#post-stats-list").innerHTML =
          '<div class="post-stat-empty">Statistikani yuklab bo‘lmadi</div>';
      console.error("Post statistics could not be loaded:", x);
    }
  };
  // Enter bosilganda izoh yuboriladi
  $("#feed-list").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    const input = e.target.closest?.(".comment-compose input");
    if (!input) return;
    e.preventDefault();
    input
      .closest(".comment-area")
      ?.querySelector("[data-comment-send]")
      ?.click();
  });
  $("#feed-list").onclick = async (e) => {
    const mention = e.target.closest("[data-mention-user]");
    if (mention) {
      e.preventDefault();
      try { await openMentionProfile(mention.dataset.mentionUser); }
      catch (error) { fail(error); }
      return;
    }
    if (e.target.closest("[data-feed-retry]")) {
      loadFeed(true);
      return;
    }
    const au = e.target.closest("[data-author]");
    if (au) {
      const id = au.dataset.author;
      if (id === me.id) return openProfile();
      setTab("chats");
      await openTarget({ type: "user", id });
      if (target?.id === id) $("#peer-open").click();
      return;
    }
    const stats = e.target.closest("[data-post-stats]");
    if (stats) {
      await showPostStats(+stats.dataset.postStats);
      return;
    }
    const vote = e.target.closest("[data-vote]");
    if (vote) {
      await setLike(+vote.dataset.postId);
      return;
    }
    const toggleEmoji = e.target.closest("[data-toggle-emoji]");
    if (toggleEmoji) {
      $(
        `[data-comment-picker="${toggleEmoji.dataset.toggleEmoji}"]`,
      ).classList.toggle("hide");
      return;
    }
    const commentEmoji = e.target.closest("[data-comment-emoji]");
    if (commentEmoji) {
      const area = commentEmoji.closest(".comment-area");
      area.querySelector("input").value = commentEmoji.dataset.commentEmoji;
      area.querySelector("[data-comment-send]").click();
      return;
    }
    const comments = e.target.closest("[data-comments]");
    if (comments) {
      $(`[data-comment-area="${comments.dataset.comments}"]`).classList.toggle(
        "hide",
      );
      return;
    }
    const sendComment = e.target.closest("[data-comment-send]");
    if (sendComment) {
      const area = sendComment.closest(".comment-area"),
        input = area.querySelector("input"),
        value = input.value.trim();
      if (!value) return;
      const postId = +sendComment.dataset.commentSend,
        temp = {
          id: `tmp-${Date.now()}`,
          post_id: postId,
          user_id: me.id,
          body: value,
          created_at: new Date().toISOString(),
          profiles: me,
        };
      engagement.comments.push(temp);
      input.value = "";
      const animated = [
        "❤️",
        "🔥",
        "😂",
        "🥰",
        "👏",
        "😮",
        "😢",
        "🙏",
      ].includes(value);
      area.insertAdjacentHTML(
        "beforeend",
        `<div class="post-comment${animated ? " reaction-comment" : ""}" data-temp-comment="${temp.id}"><b>${esc(me.full_name || me.username)}</b> <span>${esc(value)}</span></div>`,
      );
      const post = area.closest(".post"),
        countButton = post?.querySelector(`[data-comments="${postId}"]`),
        statButton = post?.querySelector("[data-post-stats]");
      if (countButton)
        countButton.innerHTML = `<i class="bi bi-chat"></i> ${engagement.comments.filter((c) => c.post_id === postId).length}`;
      if (statButton)
        statButton.innerHTML = `<i class="bi bi-bar-chart-line"></i><span>${engagement.reactions.filter((r) => r.post_id === postId).length + engagement.comments.filter((c) => c.post_id === postId).length}</span>`;
      try {
        await DB.comment(postId, value);
        const post = feedPosts.find((item) => String(item.id) === String(postId));
        if (post?.author && post.author !== me.id)
          void sendNativePush(post.author, `postingizga izoh yozdi: “${value.slice(0, 120)}”`);
        temp.id = "saved";
      } catch (x) {
        console.error("Comment save failed:", x);
        engagement.comments = engagement.comments.filter((c) => c !== temp);
        area.querySelector(`[data-temp-comment="${temp.id}"]`)?.remove();
        if (countButton)
          countButton.innerHTML = `<i class="bi bi-chat"></i> ${engagement.comments.filter((c) => c.post_id === postId).length}`;
        if (statButton)
          statButton.querySelector("span").textContent =
            engagement.reactions.filter((r) => r.post_id === postId).length +
            engagement.comments.filter((c) => c.post_id === postId).length;
        loadFeed();
        fail(x);
      }
      return;
    }
    const d = e.target.closest("[data-del]");
    if (d) {
      try {
        await DB.delPost(+d.dataset.del);
        loadFeed();
      } catch (x) {
        fail(x);
      }
    }
  };

  // bildirishnoma kelganda qo'ng'iroqcha jiringlaydi va ovoz chiqadi (ovoz fayli kerak emas: Web Audio)
  let audioCtx,
    pendingNotifySound = false,
    pendingCoinSound = false,
    pendingMessageSound = false;
  const playNotifySound = () => {
    if (!audioCtx || audioCtx.state !== "running") return false;
    const t0 = audioCtx.currentTime;
    [
      [987.77, 0],
      [1318.51, 0.16],
    ].forEach(([f, d]) => {
      [
        [f, 0.22],
        [f * 2, 0.05],
      ].forEach(([fr, vol]) => {
        const o = audioCtx.createOscillator(),
          g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.value = fr;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(vol, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.7);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(t0 + d);
        o.stop(t0 + d + 0.75);
      });
    });
    return true;
  };
  const playCoinSound = () => {
    if (!audioCtx || audioCtx.state !== "running") return false;
    const start = audioCtx.currentTime;
    [[1318.5, 0], [1760, 0.1], [2093, 0.2]].forEach(([frequency, delay]) => {
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start + delay);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.45, start + delay + 0.09);
      gain.gain.setValueAtTime(0.0001, start + delay);
      gain.gain.exponentialRampToValueAtTime(0.16, start + delay + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.38);
      oscillator.connect(gain); gain.connect(audioCtx.destination);
      oscillator.start(start + delay); oscillator.stop(start + delay + 0.4);
    });
    return true;
  };
  const playMessageSound = () => {
    if (!audioCtx || audioCtx.state !== "running") return false;
    const start = audioCtx.currentTime;
    [1174.66, 1567.98, 2093].forEach((frequency, index) => {
      const at = start + index * 0.105;
      [frequency, frequency * 2].forEach((pitch, harmonic) => {
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(pitch, at);
        const peak = harmonic ? 0.025 : 0.11;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
        oscillator.connect(gain);
        gain.connect(audioCtx.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.25);
      });
    });
    return true;
  };
  const flushPendingNotificationSound = () => {
    if (pendingCoinSound && playCoinSound()) { pendingCoinSound = false; pendingNotifySound = false; }
    else if (pendingNotifySound && playNotifySound()) pendingNotifySound = false;
    else if (pendingMessageSound && playMessageSound()) pendingMessageSound = false;
  };
  const unlockAudio = () => {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended")
        audioCtx
          .resume()
          .then(() => {
            flushPendingNotificationSound();
          })
          .catch(() => {});
      else flushPendingNotificationSound();
    } catch {}
  };
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    document.addEventListener(ev, unlockAudio, { passive: true }),
  );
  const notifySound = () => {
    unlockAudio();
    if (!playNotifySound()) pendingNotifySound = true;
  };
  const notifyCoinSound = () => {
    unlockAudio();
    if (playCoinSound()) { pendingCoinSound = false; pendingNotifySound = false; }
    else pendingCoinSound = true;
  };
  const notifyMessageSound = () => {
    unlockAudio();
    if (playMessageSound()) pendingMessageSound = false;
    else pendingMessageSound = true;
  };
  const ringBell = () => {
    const bells = [$("#notifications-btn"), $(".desktop-feed-links [data-tab=notifications]")].filter(Boolean);
    bells.forEach((b) => {
      b.classList.remove("ringing");
      void b.offsetWidth;
      b.classList.add("ringing");
    });
    clearTimeout(ringBell.h);
    ringBell.h = setTimeout(() => bells.forEach((b) => b.classList.remove("ringing")), 1900);
  };
  let notificationPreviewTimer;
  const notificationText = (n) => n.kind === "xcoin"
    ? n.actor?.id === me.id
      ? t("xcoin_admin_grant", { amount: n.body || "0" })
      : t("xcoin_received_from", { name: n.actor?.full_name || n.actor?.username || "Foydalanuvchi", amount: n.body || "0" })
    : n.kind === "follow"
      ? `${n.actor?.full_name || n.actor?.username || "Foydalanuvchi"} sizga obuna bo‘ldi`
      : n.kind === "like"
        ? `${n.actor?.full_name || n.actor?.username || "Foydalanuvchi"} postingizga reaksiya bildirdi`
        : `${n.actor?.full_name || n.actor?.username || "Foydalanuvchi"}: ${n.body || "izoh qoldirdi"}`;
  const showNotificationPreview = (n) => {
    const text = notificationText(n);
    const preview = $("#notification-preview"),
      indicator = $("#notification-indicator");
    preview.textContent = text.length > 58 ? text.slice(0, 55) + "…" : text;
    indicator.classList.remove("hide", "dot-only");
    indicator.classList.add("previewing");
    clearTimeout(notificationPreviewTimer);
    notificationPreviewTimer = setTimeout(() => {
      indicator.classList.remove("previewing");
      indicator.classList.add("dot-only");
    }, 4200);
  };
  async function loadNotifications(markRead = false) {
    try {
      noticeRows = await DB.notifications();
      const isFirstCheck = knownNotificationIds === null;
      const unseenRows = isFirstCheck ? [] : noticeRows.filter((n) => !knownNotificationIds.has(String(n.id)));
      const newlyArrived = unseenRows[0] || null;
      knownNotificationIds = new Set(noticeRows.map((n) => String(n.id)));
      const unreadRows = noticeRows.filter((n) => !n.read_at);
      const incomingCoin = unseenRows.find((n) => n.kind === "xcoin") || (isFirstCheck ? unreadRows.find((n) => n.kind === "xcoin") : null);
      if ((isFirstCheck && unreadRows.length) || newlyArrived) {
        ringBell();
        if (incomingCoin) notifyCoinSound();
        else notifySound();
      }
      if (incomingCoin) {
        const fresh = await DB.me();
        if (fresh) { me = known[me.id] = fresh; paintRewards(); }
      }
      if (newlyArrived && tab !== "notifications")
        showNotificationPreview(incomingCoin || newlyArrived);
      const unread = unreadRows.length;
      const desktopNotificationBadge = $("#desktop-notification-unread");
      desktopNotificationBadge.textContent = String(unread);
      desktopNotificationBadge.title = `${unread} ta o‘qilmagan bildirishnoma`;
      desktopNotificationBadge.classList.toggle("hide", unread < 1 || markRead);
      const indicator = $("#notification-indicator"),
        dot = indicator.querySelector(".notification-dot");
      dot.textContent = unread > 99 ? "99+" : String(unread || "");
      dot.classList.toggle("has-count", unread > 0);
      indicator.classList.toggle("hide", !unread);
      indicator.classList.toggle(
        "dot-only",
        !unread || !indicator.classList.contains("previewing"),
      );
      $("#notifications-btn").setAttribute(
        "aria-label",
        unread
          ? `Bildirishnomalar, ${unread} ta o‘qilmagan`
          : "Bildirishnomalar",
      );
      $("#notifications-btn").title = unread
        ? `${unread} ta o‘qilmagan bildirishnoma`
        : "Bildirishnomalar";
      $("#notification-list").innerHTML = noticeRows.length
        ? noticeRows
            .map(
              (n) =>
                `<button type="button" class="notification-item${n.read_at ? "" : " unread"}" data-kind="${esc(n.kind)}" data-actor="${esc(n.actor?.id || "")}" data-post="${esc(n.post_id || "")}" data-body="${esc(n.body || "")}" data-created="${esc(n.created_at)}"><img src="${av(n.actor)}" alt=""><span class="notification-copy">${n.kind === "xcoin" ? `<b>${esc(n.actor?.id === me.id ? "Xabarim" : n.actor?.full_name || n.actor?.username || "Foydalanuvchi")}</b> ${esc(notificationText(n))}` : `<b>${esc(n.actor?.full_name || n.actor?.username || "Foydalanuvchi")}</b> ${n.kind === "follow" ? "sizga obuna bo‘ldi" : n.kind === "like" ? "postingizga reaksiya bildirdi" : `postingizga izoh yozdi: “${esc(n.body || "")}”`}`}<small>${dt(n.created_at)}</small></span><i class="bi ${n.kind === "xcoin" ? "bi-coin" : n.kind === "follow" ? "bi-person" : n.kind === "comment" ? "bi-chat" : "bi-heart"} notification-kind-icon" aria-hidden="true"></i></button>`,
            )
            .join("")
        : `<div class="list-empty">Hozircha bildirishnomalar yo‘q</div>`;
      if (markRead) {
        await DB.readNotifications(
          noticeRows.filter((n) => !n.read_at).map((n) => n.id),
        );
        indicator.classList.add("hide");
        indicator.classList.remove("previewing", "dot-only");
        desktopNotificationBadge.classList.add("hide");
        clearTimeout(notificationPreviewTimer);
      }
    } catch (x) {
      fail(x);
    }
  }

  $("#notification-list").onclick = async (e) => {
    const it = e.target.closest(".notification-item");
    if (!it) return;
    if (it.dataset.kind === "xcoin") {
      openProfile();
    } else if (it.dataset.kind === "follow" && it.dataset.actor) {
      setTab("chats");
      await openTarget({ type: "user", id: it.dataset.actor });
      if (target?.type === "user" && target.id === it.dataset.actor)
        $("#peer-open").click();
    } else if (it.dataset.post) {
      feedUser = {
        id: me.id,
        name: me.full_name || me.username,
        focus: it.dataset.post,
        comment:
          it.dataset.kind === "comment"
            ? {
                actorId: it.dataset.actor,
                body: it.dataset.body,
                createdAt: it.dataset.created,
              }
            : null,
      };
      $("#search").value = "";
      setTab("posts", true);
    } else setTab("posts");
  };

  // ---- modallar
  const M = (s) => new bootstrap.Modal(s),
    pm = M("#profile-modal"),
    googleOfferM = M("#google-offer-modal"),
    peerModal = M("#peer-modal"),
    reportM = M("#report-modal"),
    gm = M("#group-modal"),
    nm = M("#note-modal"),
    noteViewM = M("#note-view-modal"),
    postM = M("#post-modal"),
    postStatsM = M("#post-stats-modal");
  let reportKind = "group";
  const noteEmojiOptions = ["❤️", "🔥", "😂", "🥰", "👏", "👍"];
  let noteViewUser = null;
  const paintNoteReactions = (rows) => {
    const byEmoji = new Map(noteEmojiOptions.map((emoji) => [emoji, 0]));
    let mine = "";
    rows.forEach((row) => {
      if (byEmoji.has(row.emoji)) byEmoji.set(row.emoji, byEmoji.get(row.emoji) + 1);
      if (row.user_id === me.id) mine = row.emoji;
    });
    $("#note-view-reactions").innerHTML = noteEmojiOptions
      .map((emoji) => `<button type="button" class="note-reaction${mine === emoji ? " active" : ""}" data-note-react="${emoji}" aria-pressed="${mine === emoji}"><span>${emoji}</span><b>${byEmoji.get(emoji) || ""}</b></button>`)
      .join("");
  };
  openNoteView = async (userId) => {
    const note = notes[userId];
    if (!note || !known[userId]) return;
    noteViewUser = userId;
    $("#note-view-avatar").src = av(known[userId]);
    $("#note-view-name").textContent = known[userId].full_name || known[userId].username;
    $("#note-view-text").textContent = note.text;
    noteViewM.show();
    try {
      paintNoteReactions(await DB.noteReactions([userId]));
    } catch (error) {
      paintNoteReactions([]);
      console.warn("Note reaksiyalari yuklanmadi", error);
    }
  };
  $("#note-view-reactions").onclick = async (event) => {
    const button = event.target.closest("[data-note-react]");
    if (!button || !noteViewUser) return;
    const emoji = button.dataset.noteReact;
    button.disabled = true;
    try {
      const rows = await DB.noteReactions([noteViewUser]);
      const myReaction = rows.find((row) => row.user_id === me.id);
      if (myReaction?.emoji === emoji) await DB.unreactNote(noteViewUser, me.id);
      else await DB.reactNote(noteViewUser, me.id, emoji);
      paintNoteReactions(await DB.noteReactions([noteViewUser]));
    } catch (error) {
      failData("Note reaksiyasi", error);
    }
  };
  // ---- obunachilar / obunalar (Instagram kabi)
  const nf = (n) =>
    n >= 1e6
      ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
      : n >= 1e3
        ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K"
        : String(n);
  let peerStats = null;
  const loadStats = async (id, pre) => {
    try {
      const st = await DB.stats(id);
      $(`#${pre}-followers`).textContent = nf(st.followers_count ?? 0);
      $(`#${pre}-following`).textContent = nf(st.following_count ?? 0);
      if (id !== me.id) st.i_follow ? following.add(id) : following.delete(id);
      return st;
    } catch {
      return null;
    }
  };
  const paintFollow = () => {
    const b = $("#pm-follow"),
      st = peerStats;
    b.classList.toggle("hide", !st || target?.id === me.id);
    if (!st) return;
    b.classList.toggle("on", st.i_follow);
    b.classList.toggle("is-following", st.i_follow);
    b.classList.toggle("is-not-following", !st.i_follow);
    b.innerHTML = `<i class="bi ${st.i_follow ? "bi-check2" : "bi-person-plus"}" aria-hidden="true"></i><span>${t(st.i_follow ? "following_btn" : st.follows_me ? "follow_back" : "follow")}</span>`;
    $("#pm-followers").textContent = nf(st.followers_count ?? 0);
  };
  $("#pm-follow").onclick = async () => {
    if (!peerStats || target?.type !== "user") return;
    const b = $("#pm-follow"),
      id = target.id;
    Spin.on(b);
    try {
      if (peerStats.i_follow) {
        await DB.unfollow(me.id, id);
        peerStats.i_follow = false;
        peerStats.followers_count = Math.max(0, peerStats.followers_count - 1);
        following.delete(id);
      } else {
        await DB.follow(id);
        peerStats.i_follow = true;
        peerStats.followers_count++;
        following.add(id);
      }
      paintFollow();
      loadNotes();
      if (tab === "posts") loadFeed();
    } catch (x) {
      fail(x);
    }
    Spin.off(b);
  };
  const pplM = M("#people-modal");
  let pplUser = null,
    pplKind = "followers";
  const personRow = (p) =>
    `<div class="person-card" data-id="${esc(p.id)}"><img class="username-img" src="${av(p)}" alt=""><div><div class="username"><span class="username-label">${esc(p.full_name || p.username)}</span>${accountBadges(p)}</div><p class="message-text">@${esc(p.username)}</p></div>${p.id === me.id ? "<span></span>" : `<button class="join-btn${following.has(p.id) ? " on" : ""}" data-follow="${esc(p.id)}">${t(following.has(p.id) ? "following_btn" : "follow")}</button>`}</div>`;
  const showPeople = async (uid, kind) => {
    pplUser = uid;
    pplKind = kind;
    $("#people-title").textContent =
      uid === me.id
        ? me.full_name || me.username
        : known[uid]?.full_name || known[uid]?.username || "";
    document
      .querySelectorAll("#people-tabs button")
      .forEach((b) => b.classList.toggle("on", b.dataset.kind === kind));
    $("#people-list").innerHTML =
      '<div class="list-empty"><span class="spinner-border spinner-border-sm"></span></div>';
    try {
      const ps = await DB.followList(uid, kind);
      if (pplUser !== uid || pplKind !== kind) return;
      ps.forEach((p) => p.id !== me.id && (known[p.id] = p));
      $("#people-list").innerHTML = ps.length
        ? ps.map(personRow).join("")
        : `<div class="list-empty">${t(kind === "followers" ? "no_followers" : "no_following")}</div>`;
    } catch (x) {
      fail(x);
    }
  };
  const openPeople = (fromSel, fromModal, uid) => (e) => {
    const b = e.target.closest("button[data-kind]");
    if (!b) return;
    $(fromSel).addEventListener(
      "hidden.bs.modal",
      () => {
        pplM.show();
        showPeople(uid(), b.dataset.kind);
      },
      { once: true },
    );
    fromModal.hide();
  };
  $("#p-stats").onclick = openPeople("#profile-modal", pm, () => me.id);
  $("#pm-stats").onclick = openPeople(
    "#peer-modal",
    peerModal,
    () => target?.id,
  );
  $("#people-tabs").onclick = (e) => {
    const b = e.target.closest("button");
    if (b && pplUser) showPeople(pplUser, b.dataset.kind);
  };
  $("#people-list").onclick = async (e) => {
    const f = e.target.closest("[data-follow]");
    if (f) {
      e.stopPropagation();
      const id = f.dataset.follow;
      Spin.on(f);
      try {
        if (following.has(id)) {
          await DB.unfollow(me.id, id);
          following.delete(id);
        } else {
          await DB.follow(id);
          following.add(id);
        }
        f.classList.toggle("on", following.has(id));
        f.textContent = t(following.has(id) ? "following_btn" : "follow");
        loadNotes();
      } catch (x) {
        fail(x);
      }
      Spin.off(f);
      return;
    }
    const row = e.target.closest(".person-card");
    if (row && row.dataset.id !== me.id) {
      pplM.hide();
      setTab("chats");
      openTarget({ type: "user", id: row.dataset.id });
    }
  };
  const paint = () => {
    $("#nav-av").src = av(me);
    $("#nav-mobile-av").src = av(me);
    $("#desktop-feed-avatar").src = av(me);
    $("#desktop-feed-name").textContent = me.full_name || me.username || "Xabarim";
    $("#desktop-feed-username").textContent = `@${me.username || ""}`;
    $("#p-av").src = av(me);
    $("#p-display-name").innerHTML = `${esc(me.full_name || me.username)}${accountBadges(me)}`;
    $("#p-display-user").textContent = `@${me.username || ""}`;
    const verified = !!me.google_verified;
    const editingProfile = $("#profile-modal").classList.contains("is-editing");
    $("#p-human-status").innerHTML = verified
      ? `<span class="human-status-icon verified"><i class="bi bi-person-check-fill"></i></span><span class="human-status-copy"><b>Haqiqiy inson tasdiqlangan</b>${googleEmail ? `<small>${esc(googleEmail)}</small>` : ""}</span>`
      : '<span class="human-status-icon"><i class="bi bi-person-fill"></i></span><span>Haqiqiy inson maqomi tasdiqlanmagan</span>';
    $("#p-human-status").classList.toggle("verified", verified);
    $("#p-google-link").hidden = verified && !editingProfile;
    $("#p-google-link").disabled = false;
    $("#p-google-unlink").hidden = !verified || !editingProfile;
    $("#p-google-link").innerHTML = verified
      ? '<i class="bi bi-pencil-square"></i> Google hisobini almashtirish'
      : '<i class="bi bi-google"></i> Google hisobini ulash';
  };
  const referralLink = () => `${location.origin}/pages/auth/registration.html?ref=${encodeURIComponent(me.referral_code || "")}`;
  const paintRewards = () => {
    $("#p-xcoin").textContent = String(me.xcoin_balance || 0);
    $("#p-referral-link").textContent = referralLink();
    $("#p-telegram-link").hidden = !!me.telegram_linked;
    $("#p-telegram-linked").hidden = !me.telegram_linked;
    $("#p-telegram-link").textContent = t(me.telegram_linked ? "telegram_linked" : "telegram_link");
    const premiumButton = $("#p-buy-premium");
    const premiumActive = hasPremium(me);
    premiumButton.disabled = premiumActive;
    premiumButton.textContent = premiumActive ? t("premium_active") : t("premium_buy");
    $("#p-premium-panel").classList.toggle("premium-active", premiumActive);
    const premiumHint = $("#p-premium-panel").querySelector(".premium-hint");
    premiumHint.hidden = premiumActive;
    premiumHint.textContent = t("premium_reward_hint");
    const dates = $("#p-premium-dates");
    dates.hidden = !premiumActive || !me.premium_until;
    if (premiumActive && me.premium_until) {
      const formatDate = (value) =>
        new Intl.DateTimeFormat(Lang.get(), { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
      dates.textContent = t("premium_period", {
        start: formatDate(me.premium_started_at || me.premium_until),
        end: formatDate(me.premium_until),
      });
    }
  };
  setInterval(() => {
    if (!me.premium || hasPremium(me)) return;
    me = known[me.id] = { ...me, premium: false };
    paintRewards();
    document.querySelectorAll(".premium-badge").forEach((badge) => badge.remove());
    renderList();
  }, 60000);
  const xcoinSendModal = M("#xcoin-send-modal");
  const connectGoogle = async (button) => {
    if (me.google_verified) return;
    Spin.on(button);
    try {
      await DB.linkGoogle();
    } catch (error) {
      Spin.off(button);
      const message = String(error?.message || "");
      if (/gmail/i.test(message)) toast("Faqat gmail.com hisobi qabul qilinadi.");
      else if (/identity.*already|already.*linked|provider.*already/i.test(message)) toast("Bu Google hisobi boshqa Xabarim akkauntiga ulangan.");
      else if (/provider.*disabled|unsupported provider/i.test(message)) toast("Google ulash hozircha yoqilmagan. Administrator Supabase Google provider sozlamasini tekshirishi kerak.");
      else if (/manual_linking_disabled|manual linking.*disabled|identity linking.*disabled|linking identities.*disabled/i.test(message)) toast("Supabase Dashboard → Authentication → Settings’da Allow manual linking’ni yoqing.");
      else if (/redirect.*(not allowed|allow list|url)|url.*not allowed/i.test(message)) toast(`Supabase Redirect URLs ro‘yxatiga ${location.origin}/pages/main.html manzilini qo‘shing.`);
      else {
        console.error("Google hisobi ulanmagan:", error);
        const detail = [error?.code || error?.status, message].filter(Boolean).join(": ");
        toast(detail ? `Google OAuth xatosi: ${detail.slice(0, 100)}` : "Google OAuth ulanmadi. Brauzer konsolini tekshiring.");
      }
    }
  };
  const unlinkGoogleIdentity = async () => {
    const { identities = [] } = await DB.googleIdentities();
    const identity = identities.find((item) => item.provider === "google");
    if (identity) await DB.unlinkGoogle(identity);
    googleEmail = "";
    me = known[me.id] = { ...me, google_verified: false };
    paint();
    paintRewards();
    const reset = await DB.resetGoogleVerification();
    if (reset) me = known[me.id] = reset;
  };
  const googleUnlinkError = (error) => {
    const message = String(error?.message || "");
    if (/GOOGLE_IDENTITY_STILL_LINKED/i.test(message)) toast("Avvalgi Google hisobi hali uzilmadi. Qaytadan urinib ko‘ring.");
    else if (/identity.*already|already.*linked|provider.*already/i.test(message)) toast("Bu Google hisobi boshqa Xabarim akkauntiga ulangan.");
    else if (/manual_linking_disabled/i.test(message)) toast("Supabase’da Allow manual linking’ni yoqing.");
    else if (/reset_google_verification|schema cache|PGRST202/i.test(message)) toast("Gmail holatini to‘g‘ri yangilash uchun Supabase’da schema_v23.sql migratsiyasini ishga tushiring.");
    else if (/gmail/i.test(message)) toast("Faqat haqiqiy gmail.com hisobi qabul qilinadi.");
    else {
      console.error("Google identity amalida xato:", error);
      toast(message ? `Google OAuth xatosi: ${message.slice(0, 100)}` : "Google identity amalini bajarmadi.");
    }
  };
  const changeGoogle = async (button) => {
    if (!me.google_verified) return connectGoogle(button);
    if (!confirm("Hozirgi Google hisobi uziladi. Keyin boshqa haqiqiy Gmail hisobini tanlang. Davom etasizmi?")) return;
    Spin.on(button);
    try {
      await unlinkGoogleIdentity();
      await DB.linkGoogle();
    } catch (error) {
      Spin.off(button);
      googleUnlinkError(error);
    }
  };
  const disconnectGoogle = async (button) => {
    if (!me.google_verified || !confirm("Google hisobini uzib, “Haqiqiy inson” tasdig‘ini olib tashlaysizmi?")) return;
    Spin.on(button);
    try {
      await unlinkGoogleIdentity();
      toast("Google hisobi uzildi. Tasdiqlash holati olib tashlandi.");
    } catch (error) {
      googleUnlinkError(error);
    } finally {
      Spin.off(button);
    }
  };
  const openProfile = () => {
    setProfileEditing(false);
    discardProfileAvatar();
    $("#p-name").value = me.full_name || "";
    $("#p-user").value = me.username || "";
    $("#p-bio").value = me.bio || "";
    paint();
    paintRewards();
    pm.show();
    loadStats(me.id, "p");
    loadAccountPosts(me.id, $("#my-account-posts"), () => true);
  };
  $("#p-google-link").onclick = (event) => me.google_verified
    ? changeGoogle(event.currentTarget)
    : connectGoogle(event.currentTarget);
  $("#p-google-unlink").onclick = (event) => disconnectGoogle(event.currentTarget);
  $("#p-xcoin-toggle").onclick = (event) => {
    const button = event.currentTarget;
    const tasks = $("#p-xcoin-tasks");
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    tasks.hidden = expanded;
  };
  $("#p-xcoin-send-open").onclick = () => {
    $("#xcoin-recipient").value = "";
    $("#xcoin-amount").value = "";
    xcoinSendModal.show();
  };
  $("#xcoin-send-form").onsubmit = async (event) => {
    event.preventDefault();
    const button = $("#xcoin-send-submit");
    const username = $("#xcoin-recipient").value.trim().replace(/^@/, "");
    const amount = Number($("#xcoin-amount").value);
    if (!/^[a-z0-9_]{3,30}$/i.test(username)) return toast(t("bad_user"));
    if (!Number.isSafeInteger(amount) || amount <= 0) return toast(t("xcoin_invalid_amount"));
    Spin.on(button);
    try {
      me = known[me.id] = await DB.sendXcoin(username, amount);
      paintRewards();
      xcoinSendModal.hide();
      toast(t("xcoin_sent"));
    } catch (error) {
      const message = String(error?.message || "");
      if (/XCOIN_INSUFFICIENT/i.test(message)) toast(t("xcoin_insufficient"));
      else if (/XCOIN_RECIPIENT_NOT_FOUND/i.test(message)) toast(t("xcoin_recipient_missing"));
      else if (/XCOIN_SELF_TRANSFER/i.test(message)) toast(t("xcoin_self_transfer"));
      else if (/XCOIN_INVALID_AMOUNT/i.test(message)) toast(t("xcoin_invalid_amount"));
      else if (/send_xcoin|schema cache|PGRST202/i.test(message)) toast("XCoin yuborishni yoqish uchun Supabase’da schema_v24.sql migratsiyasini ishga tushiring.");
      else { console.error("XCoin transfer failed:", error); toast(t("error")); }
    } finally { Spin.off(button); }
  };
  $("#google-offer-link").onclick = (event) => connectGoogle(event.currentTarget);
  const copyReferral = async () => {
    const link = referralLink();
    try { await navigator.clipboard.writeText(link); toast("Taklif havolasi nusxalandi."); }
    catch { toast(link); }
  };
  $("#p-copy-referral").onclick = copyReferral;
  const telegramLoginContainer = $("#telegram-login-container");
  $("#p-telegram-link").onclick = () => {
    const bot = window.XABARIM_CONFIG?.telegramBotUsername;
    if (!bot) return toast("Telegram hisobini ulash uchun serverda TELEGRAM_BOT_USERNAME sozlang.");
    if (telegramLoginContainer.querySelector("script")) { telegramLoginContainer.hidden = false; return; }
    telegramLoginContainer.hidden = false;
    const widget = document.createElement("script");
    widget.async = true;
    widget.src = "https://telegram.org/js/telegram-widget.js?22";
    widget.dataset.telegramLogin = bot.replace(/^@/, "");
    widget.dataset.size = "medium";
    widget.dataset.userpic = "false";
    widget.dataset.onauth = "onTelegramAuth(user)";
    widget.dataset.requestAccess = "write";
    telegramLoginContainer.append(widget);
  };
  window.onTelegramAuth = async (telegramAuth) => {
    try {
      await DB.linkTelegramAccount(telegramAuth);
      me = known[me.id] = { ...me, telegram_linked: true };
      telegramLoginContainer.hidden = true;
      telegramLoginContainer.replaceChildren();
      paintRewards();
      toast("Telegram hisobi ulandi. Endi kanal obunasini tekshirishingiz mumkin.");
    } catch (error) {
      if (error.code === "TELEGRAM_ACCOUNT_ALREADY_LINKED") toast("Bu Telegram hisobi boshqa Xabarim akkauntiga ulangan.");
      else if (error.code === "TELEGRAM_REWARD_NOT_CONFIGURED") toast("Telegram bot sozlamalarini serverda to‘ldiring.");
      else toast("Telegram hisobini ulab bo‘lmadi. Qayta urinib ko‘ring.");
    }
  };
  $("#p-telegram-claim").onclick = async (event) => {
    const button = event.currentTarget;
    Spin.on(button);
    try {
      me = known[me.id] = { ...me, xcoin_balance: await DB.claimTelegramReward() };
      paintRewards();
      toast("Kanalga obuna tasdiqlandi. 5 XCoin qo‘shildi!");
    } catch (error) {
      if (error.code === "TELEGRAM_MEMBERSHIP_REQUIRED") toast("Avval Telegram kanaliga obuna bo‘ling, keyin qayta tekshiring.");
      else if (error.code === "TELEGRAM_REWARD_ALREADY_CLAIMED") toast("Kanal uchun 5 XCoin avval berilgan.");
      else if (error.code === "TELEGRAM_REWARD_NOT_CONFIGURED") toast("Mukofotni yoqish uchun serverda Telegram bot sozlamalari kerak.");
      else if (error.code === "TELEGRAM_ACCOUNT_NOT_LINKED") { toast("Avval Telegram hisobingizni ulang."); $("#p-telegram-link").click(); }
      else if (error.code === "TELEGRAM_MEMBERSHIP_CHECK_UNAVAILABLE") toast("Bot kanal a’zoligini tekshira olmadi. Botni kanalga administrator qilib qo‘shing.");
      else { console.error("Telegram obuna tekshiruvi bajarilmadi:", error); toast("Obunani tekshirib bo‘lmadi. Keyinroq urinib ko‘ring."); }
    } finally { Spin.off(button); }
  };
  $("#p-buy-premium").onclick = async (event) => {
    const button = event.currentTarget;
    if (hasPremium(me)) return;
    Spin.on(button);
    try {
      me = known[me.id] = await DB.buyPremium();
      paintRewards();
      toast(t("premium_activated"));
    } catch (error) {
      const message = error?.message || "";
      toast(/PREMIUM_REQUIRES_50_XCOIN/i.test(message)
        ? t("premium_need_coins")
        : /XABARIM_SERVICE_ACCOUNT_REQUIRED/i.test(message)
          ? t("premium_service_missing")
          : t("error"));
    } finally { Spin.off(button); }
  };
  if (localStorage.getItem("xabarim-show-google-offer") === "1" && !me.google_verified) {
    localStorage.removeItem("xabarim-show-google-offer");
    setTimeout(() => googleOfferM.show(), 350);
  }
  let pendingProfileAvatar = null,
    pendingProfileAvatarUrl = null;
  let cropSource = null,
    cropObjectUrl = null,
    cropScale = 1,
    cropLeft = 0,
    cropTop = 0,
    cropPointer = null;
  const cropStage = $("#avatar-crop-stage"),
    cropImage = $("#avatar-crop-image");
  const renderAvatarCrop = () => {
    if (!cropSource) return;
    const size = cropStage.clientWidth,
      base = Math.max(
        size / cropSource.naturalWidth,
        size / cropSource.naturalHeight,
      ),
      scale = base * cropScale;
    const w = cropSource.naturalWidth * scale,
      h = cropSource.naturalHeight * scale;
    cropLeft = Math.min(0, Math.max(size - w, cropLeft));
    cropTop = Math.min(0, Math.max(size - h, cropTop));
    cropImage.style.width = `${w}px`;
    cropImage.style.height = `${h}px`;
    cropImage.style.left = `${cropLeft}px`;
    cropImage.style.top = `${cropTop}px`;
  };
  const closeAvatarCrop = () => {
    $("#avatar-crop").classList.add("hide");
    if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
    cropObjectUrl = null;
    cropSource = null;
    cropPointer = null;
  };
  const discardProfileAvatar = () => {
    if (pendingProfileAvatarUrl) URL.revokeObjectURL(pendingProfileAvatarUrl);
    pendingProfileAvatar = pendingProfileAvatarUrl = null;
    closeAvatarCrop();
    $("#p-file").value = "";
    $("#p-av").src = av(me);
  };
  const setProfileEditing = (editing) => {
    $("#profile-modal").classList.toggle("is-editing", editing);
    $("#p-google-link").hidden = !!me.google_verified && !editing;
    $("#p-google-unlink").hidden = !me.google_verified || !editing;
    ["#p-name", "#p-user", "#p-bio"].forEach((s) => {
      $(s).disabled = !editing;
    });
    $("#p-file").disabled = !editing;
    $("#p-save").disabled = false;
    $("#p-av")
      .closest(".avatar-wrap")
      .querySelector("label")
      .classList.toggle("hide", !editing);
    $("#p-edit").classList.toggle("hide", editing);
    $("#p-cancel").classList.toggle("hide", !editing);
    $("#p-save").classList.toggle("hide", !editing);
  };
  $("#p-edit").onclick = () => setProfileEditing(true);
  $("#p-cancel").onclick = () => {
    discardProfileAvatar();
    $("#p-name").value = me.full_name || "";
    $("#p-user").value = me.username || "";
    $("#p-bio").value = me.bio || "";
    setProfileEditing(false);
  };
  $("#profile-modal").addEventListener("hidden.bs.modal", () => {
    if (pendingProfileAvatarUrl || cropObjectUrl) discardProfileAvatar();
    setProfileEditing(false);
  });
  const sm = M("#settings-modal"),
    helpM = M("#help-modal"),
    questionM = M("#question-modal"),
    lb = $("#lightbox");
  const openSettings = () => {
    $("#s-name").innerHTML = `${esc(me.full_name || me.username)}${accountBadges(me)}`;
    $("#s-user").textContent = "@" + me.username;
    $("#s-human-status").innerHTML = me.google_verified
      ? `<span class="human-status-icon verified"><i class="bi bi-person-check-fill"></i></span><span class="human-status-copy"><b>Haqiqiy inson tasdiqlangan</b>${googleEmail ? `<small>${esc(googleEmail)}</small>` : ""}</span>`
      : '<span class="human-status-icon"><i class="bi bi-person-fill"></i></span><span>Haqiqiy inson tasdiqlanmagan</span>';
    $("#s-human-status").classList.toggle("verified", !!me.google_verified);
    $("#s-av").src = av(me);
    $("#s-dark").checked = document.body.classList.contains("dark-mode");
    sm.show();
  };
  $("#btn-profile").onclick = openProfile;
  $("#btn-settings").onclick = openSettings;
  $("#desktop-btn-settings").onclick = openSettings;
  const showHelp = (key) => {
    $("#help-modal-title").textContent = t(
      key === "faq" ? "help_faq" : "help_features",
    );
    $("#help-modal-body").textContent = t(
      key === "faq" ? "help_faq_body" : "help_features_body",
    );
    $("#settings-modal").addEventListener(
      "hidden.bs.modal",
      () => helpM.show(),
      { once: true },
    );
    sm.hide();
  };
  $("#settings-faq").onclick = () => showHelp("faq");
  $("#settings-features").onclick = () => showHelp("features");
  $("#settings-ask").onclick = () => {
    $("#settings-modal").addEventListener(
      "hidden.bs.modal",
      () => questionM.show(),
      { once: true },
    );
    sm.hide();
  };
  $("#support-question-form").onsubmit = async (e) => {
    e.preventDefault();
    const question = $("#support-question").value.trim(),
      button = $("#question-send");
    if (question.length < 5) return toast(t("question_length"));
    Spin.on(button);
    try {
      await DB.submitSupportQuestion(me.id, question);
      $("#support-question").value = "";
      questionM.hide();
      toast(t("question_sent"));
    } catch (x) {
      if (x?.message === "question_length") toast(t("question_length"));
      else failData("Savol yuborish", x);
    } finally {
      Spin.off(button);
    }
  };
  $("#s-profile").onclick = () => {
    $("#settings-modal").addEventListener("hidden.bs.modal", openProfile, {
      once: true,
    });
    sm.hide();
  };
  $("#s-dark").onchange = (e) => {
    setMode(e.target.checked);
    updateThemeToggle();
  };
  $("#nav-mobile").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tab) setTab(b.dataset.tab);
    else if (b.id === "n-profile") openProfile();
  };
  const lbImg = lb.querySelector("img"),
    lbMenu = lb.querySelector(".lightbox-menu"),
    lbMore = lb.querySelector(".lightbox-more");
  const fsEl = () =>
    document.fullscreenElement || document.webkitFullscreenElement;
  const canFs = !!(lb.requestFullscreen || lb.webkitRequestFullscreen);
  const setMenu = (open) => {
    lbMenu.classList.toggle("hide", !open);
    lbMore.setAttribute("aria-expanded", String(open));
  };
  const zoom = (src, enterFullscreen = false) => {
    lbImg.src = src;
    lb.querySelector('[data-lb="save"] span').textContent = t("save_gallery");
    lb.querySelector('[data-lb="fullscreen"]').classList.toggle("hide", !canFs);
    lb.querySelector('[data-lb="fullscreen"] span').textContent = t(
      fsEl() ? "exit_fullscreen" : "fullscreen",
    );
    setMenu(false);
    lb.classList.remove("hide");
    document.body.classList.add("lightbox-open");
    lb.querySelector(".lightbox-close").focus();
    if (enterFullscreen && canFs) {
      try {
        const request = lb.requestFullscreen || lb.webkitRequestFullscreen;
        const result = request.call(lb);
        result?.catch(() => {});
      } catch {}
    }
  };
  const closeZoom = () => {
    setMenu(false);
    if (fsEl()) {
      try {
        (document.exitFullscreen || document.webkitExitFullscreen).call(
          document,
        );
      } catch {}
    }
    lb.classList.add("hide");
    document.body.classList.remove("lightbox-open");
  };
  // Galereyaga saqlash: telefonda ulashish oynasi (iPhone: "Rasmni saqlash", Android: Galereya), kompyuterda yuklab olish
  const saveImage = async () => {
    const src = lbImg.currentSrc || lbImg.src;
    try {
      const blob = await (await fetch(src)).blob();
      const ext = ((blob.type || "image/jpeg").split("/")[1] || "jpg")
        .split("+")[0]
        .replace("jpeg", "jpg");
      const name = `xabarim-${Date.now()}.${ext}`;
      const file = new File([blob], name, { type: blob.type || "image/jpeg" });
      const touch =
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
      if (touch && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (x) {
          if (x?.name === "AbortError") return;
        }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast(t("saved_gallery"));
    } catch (x) {
      console.error("Rasmni saqlab bo'lmadi:", x);
      toast(t("save_failed"));
      window.open(src, "_blank", "noopener");
    }
  };
  lb.onclick = (e) => {
    if (e.target.closest(".lightbox-more")) {
      setMenu(lbMenu.classList.contains("hide"));
      return;
    }
    const act = e.target.closest("[data-lb]");
    if (act) {
      setMenu(false);
      if (act.dataset.lb === "save") saveImage();
      else if (fsEl())
        (document.exitFullscreen || document.webkitExitFullscreen).call(
          document,
        );
      else (lb.requestFullscreen || lb.webkitRequestFullscreen).call(lb);
      return;
    }
    if (!lbMenu.classList.contains("hide")) {
      setMenu(false);
      return;
    } // menyu ochiq: birinchi bosish uni yopadi
    if (
      e.target === lb ||
      e.target.closest(".lightbox-close") ||
      e.target === lbImg
    )
      closeZoom();
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lb.classList.contains("hide") && !fsEl())
      closeZoom();
  });
  // postdagi rasm ham shu oynada ochiladi
  let imgTap = { t: 0, el: null, timer: 0 };
  $("#feed-list").addEventListener(
    "load",
    (e) => {
      if (e.target.matches?.(".post-img")) fitFeedImage(e.target);
    },
    true,
  );
  $("#feed-list").addEventListener("click", (e) => {
    const expand = e.target.closest("[data-post-zoom]");
    if (expand) {
      e.preventDefault();
      const image = expand.closest(".post-media")?.querySelector(".post-img");
      if (image) zoom(image.currentSrc || image.src, true);
      return;
    }
    const im = e.target.closest(".post-img");
    if (!im) return;
    const now = Date.now();
    if (imgTap.el === im && now - imgTap.t < 320) {
      clearTimeout(imgTap.timer);
      imgTap = { t: 0, el: null, timer: 0 };
      const burst = im.parentElement.querySelector(".post-burst");
      if (burst) {
        burst.classList.remove("go");
        void burst.offsetWidth;
        burst.classList.add("go");
        setTimeout(() => burst.classList.remove("go"), 900);
      }
      const id = +im.closest(".post")?.dataset.post;
      if (id) setLike(id, true);
      return;
    }
    clearTimeout(imgTap.timer);
    imgTap = {
      t: now,
      el: im,
      timer: setTimeout(() => {
        imgTap = { t: 0, el: null, timer: 0 };
        zoom(im.currentSrc || im.src);
      }, 320),
    };
  });
  $("#chat-body").addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".msg-img")) {
      e.preventDefault();
      zoom(e.target.currentSrc || e.target.src);
    }
  });
  ["#p-av", "#pm-av", "#peer-av"].forEach(
    (id) =>
      ($(id).onclick = (e) => {
        e.stopPropagation();
        if (
          id === "#peer-av" &&
          target?.type === "user" &&
          target.id === me.id
        ) {
          $("#peer-open").click();
          return;
        }
        zoom(e.target.src);
      }),
  );
  $("#p-save").onclick = async () => {
    const username = $("#p-user").value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username)) return toast(t("bad_user"));
    const sb_ = $("#p-save");
    Spin.on(sb_);
    try {
      me = known[me.id] = await DB.save(me.id, {
        full_name: $("#p-name").value.trim(),
        username,
        bio: $("#p-bio").value.trim(),
        ...(pendingProfileAvatar
          ? {
              avatar_url: await DB.upload(
                "avatars",
                me.id,
                await DB.prepare(pendingProfileAvatar, 320),
              ),
            }
          : {}),
      });
      discardProfileAvatar();
      paint();
      pm.hide();
      toast(t("saved"));
    } catch (e) {
      toast(e.code === "23505" ? t("taken") : t("error"));
    }
    Spin.off(sb_);
  };
  $("#p-file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      e.target.value = "";
      return toast(t("only_image"));
    }
    closeAvatarCrop();
    cropObjectUrl = URL.createObjectURL(f);
    cropImage.onload = () => {
      cropSource = cropImage;
      const size = cropStage.clientWidth,
        base = Math.max(
          size / cropSource.naturalWidth,
          size / cropSource.naturalHeight,
        );
      cropScale = 1;
      cropLeft = (size - cropSource.naturalWidth * base) / 2;
      cropTop = (size - cropSource.naturalHeight * base) / 2;
      $("#avatar-crop-zoom").value = "1";
      $("#avatar-crop").classList.remove("hide");
      $("#p-save").disabled = true;
      renderAvatarCrop();
    };
    cropImage.src = cropObjectUrl;
  };
  $("#avatar-crop-zoom").oninput = (e) => {
    cropScale = +e.target.value;
    renderAvatarCrop();
  };
  cropStage.onpointerdown = (e) => {
    if (!cropSource) return;
    cropPointer = { x: e.clientX, y: e.clientY, left: cropLeft, top: cropTop };
    cropStage.setPointerCapture(e.pointerId);
  };
  cropStage.onpointermove = (e) => {
    if (!cropPointer) return;
    cropLeft = cropPointer.left + e.clientX - cropPointer.x;
    cropTop = cropPointer.top + e.clientY - cropPointer.y;
    renderAvatarCrop();
  };
  cropStage.onpointerup = cropStage.onpointercancel = () => {
    cropPointer = null;
  };
  $("#avatar-crop-cancel").onclick = () => {
    closeAvatarCrop();
    $("#p-file").value = "";
    $("#p-save").disabled = false;
  };
  $("#avatar-crop-apply").onclick = () => {
    if (!cropSource) return;
    const size = cropStage.clientWidth,
      base = Math.max(
        size / cropSource.naturalWidth,
        size / cropSource.naturalHeight,
      ),
      scale = base * cropScale;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      cropSource,
      -cropLeft / scale,
      -cropTop / scale,
      size / scale,
      size / scale,
      0,
      0,
      512,
      512,
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) return toast(t("error"));
        if (pendingProfileAvatarUrl)
          URL.revokeObjectURL(pendingProfileAvatarUrl);
        pendingProfileAvatar = new File([blob], "profile.jpg", {
          type: "image/jpeg",
        });
        pendingProfileAvatarUrl = URL.createObjectURL(blob);
        $("#p-av").src = pendingProfileAvatarUrl;
        closeAvatarCrop();
        $("#p-save").disabled = false;
      },
      "image/jpeg",
      0.92,
    );
  };
  $("#logout").onclick = () => {
    Spin.on($("#logout"));
    DB.out();
  };
  $("#peer-open").onclick = () => {
    if (!target) return;
    const u = target.type === "user",
      p = target.p,
      r = target.r,
      saved = u && p.id === me.id,
      mine = !u && rooms.some((x) => x.id === r.id),
      isGroup = !u && r.kind === "group";
    $("#pm-av").src = saved ? SAVED_AV : u ? av(p) : ic(r.name);
    $("#pm-name").innerHTML = saved
      ? esc(t("saved_msgs"))
      : u
        ? `${esc(p.full_name || p.username)}${accountBadges(p)}`
        : esc(r.name);
    $("#pm-user").textContent = saved
      ? t("saved_status")
      : u
        ? "@" + p.username
        : t(r.kind === "group" ? "groups" : "communities");
    $("#pm-user").classList.toggle("hide", isGroup);
    const bioText = saved ? t("saved_info") : u ? p.bio : r.description;
    $("#pm-bio").textContent = bioText || "";
    $("#pm-bio-block").classList.toggle("hide", !String(bioText || "").trim());
    $("#pm-note").textContent = u && !saved ? notes[p.id]?.text || "" : "";
    $("#pm-note-block").classList.toggle("hide", !u || saved || !notes[p.id]);
    $("#pm-message").classList.toggle("hide", !u || p.id === me.id);
    $("#group-menu-wrap").classList.toggle("hide", !isGroup);
    $("#report-group").classList.toggle("hide", !isGroup);
    $("#leave").classList.toggle("hide", !mine);
    $("#delete-group").classList.add("hide");
    $("#group-details").classList.toggle("hide", !isGroup);
    $("#peer-posts-title").classList.toggle("hide", !u || saved);
    $("#peer-account-posts").classList.toggle("hide", !u || saved);
    if (isGroup) {
      const invite = `${location.origin}/pages/main.html?group=${encodeURIComponent(r.username || "")}`;
      $("#pm-group-username").textContent = `@${r.username || ""}`;
      $("#pm-group-link").textContent = invite;
      $("#pm-group-members").textContent = "…";
      DB.roomMemberCount(r.id)
        .then((n) => {
          if (target?.type === "room" && target.id === r.id)
            $("#pm-group-members").textContent = nf(n);
        })
        .catch(fail);
    }
    $("#pm-stats").classList.toggle("hide", !u || saved);
    peerStats = null;
    paintFollow();
    peerModal.show();
    if (u && !saved) {
      $("#pm-followers").textContent = $("#pm-following").textContent = "0";
      const id = p.id;
      loadStats(id, "pm").then((st) => {
        if (target?.type === "user" && target.id === id) {
          peerStats = st;
          paintFollow();
        }
      });
      showPeerPostsGate(id);
    } else {
      $("#peer-account-posts").innerHTML = "";
      if (isGroup)
        DB.isGroupOwner(r.id, me.id)
          .then((owner) => {
            if (target?.type === "room" && target.id === r.id)
              $("#delete-group").classList.toggle("hide", !owner);
          })
          .catch(fail);
    }
  };
  $("#pm-message").onclick = () => {
    const id = target?.type === "user" ? target.id : null;
    if (!id) return;
    peerModal.hide();
    setTab("chats");
    openTarget({ type: "user", id });
  };
  $("#pm-copy-link").onclick = async () => {
    if (target?.type !== "room" || !target.r.username) return;
    const link = `${location.origin}/pages/main.html?group=${encodeURIComponent(target.r.username)}`;
    try {
      await navigator.clipboard.writeText(link);
      toast(t("link_copied"));
    } catch {
      toast(link);
    }
  };
  $("#report-group").onclick = () => {
    if (target?.type !== "room" || target.r.kind !== "group") return;
    const rid = target.id;
    reportKind = "group";
    $("#report-modal-title").dataset.i18n = "report_group";
    Lang.apply();
    $("#peer-modal").addEventListener(
      "hidden.bs.modal",
      () => {
        if (target?.type === "room" && target.id === rid) reportM.show();
      },
      { once: true },
    );
    peerModal.hide();
  };
  menuAct($("#cm-ban-user"), async () => {
    if (target?.type !== "user" || target.id === me.id) return;
    reportKind = "user";
    $("#report-modal-title").dataset.i18n = "ban_user";
    Lang.apply();
    reportM.show();
  });
  $("#report-submit").onclick = async () => {
    if (reportKind === "user" && target?.type !== "user") return;
    if (reportKind === "group" && (target?.type !== "room" || target.r.kind !== "group")) return;
    const b = $("#report-submit");
    Spin.on(b);
    try {
      if (reportKind === "user") {
        const result = await DB.banUser(target.id, $("#report-reason").value, $("#report-details").value.trim(), Lang.get());
        const outcome = Array.isArray(result) ? result[0] : result;
        $("#report-details").value = "";
        reportM.hide();
        if (outcome?.account_deleted) {
          Spin.off(b);
          alert(t("ban_account_deleted"));
          await DB.out();
          return;
        }
        Spin.off(b);
        toast(t("ban_sent"));
        return;
      }
      await DB.reportGroup(target.id, $("#report-reason").value, $("#report-details").value.trim());
      $("#report-details").value = "";
      reportM.hide();
      toast(t("report_sent"));
    } catch (x) {
      if (x.code === "23505" || String(x.message || "").includes("ALREADY_REPORTED")) toast(t(reportKind === "user" ? "ban_exists" : "report_exists"));
      else fail(x);
    }
    Spin.off(b);
  };
  $("#leave").onclick = async () => {
    const lb_ = $("#leave");
    Spin.on(lb_);
    try {
      await DB.leave(target.id, me.id);
      target = null;
      peerModal.hide();
      pane("empty");
      await loadRooms();
    } catch (x) {
      fail(x);
    }
    Spin.off(lb_);
  };
  $("#delete-group").onclick = async () => {
    if (
      target?.type !== "room" ||
      target.r.kind !== "group" ||
      !confirm("Guruh va uning barcha xabarlari o‘chirilsinmi?")
    )
      return;
    const dg_ = $("#delete-group");
    Spin.on(dg_);
    try {
      await DB.deleteGroup(target.id);
      target = null;
      peerModal.hide();
      pane("empty");
      await loadRooms();
      toast("Guruh o‘chirildi");
    } catch (x) {
      fail(x);
    }
    Spin.off(dg_);
  };
  $("#g-create").onclick = async () => {
    const name = $("#g-name").value.trim(),
      username = $("#g-username").value.trim().replace(/^@/, "").toLowerCase(),
      users = $("#g-users")
        .value.toLowerCase()
        .split(/[,\s]+/)
        .map((u) => u.replace(/^@/, ""))
        .filter(Boolean);
    if (name.length < 2) return;
    if (!/^[a-z0-9_]{3,30}$/.test(username))
      return toast(t("group_username_invalid"));
    const gc_ = $("#g-create");
    Spin.on(gc_);
    try {
      const id = await DB.createGroup(name, username, users);
      gm.hide();
      $("#g-name").value = $("#g-username").value = $("#g-users").value = "";
      await loadRooms();
      setTab("groups");
      openTarget({ type: "room", id });
    } catch (x) {
      if (x.code === "23505") toast(t("group_username_taken"));
      else fail(x);
    }
    Spin.off(gc_);
  };
  $("#n-share").onclick = async () => {
    const v = $("#n-text").value.trim();
    if (!v) return;
    const ns_ = $("#n-share");
    Spin.on(ns_);
    try {
      await DB.setNote(me.id, v);
      nm.hide();
      await loadChats();
    } catch (x) {
      failData("Note saqlash", x);
    }
    Spin.off(ns_);
  };
  $("#n-del").onclick = async () => {
    const nd_ = $("#n-del");
    Spin.on(nd_);
    try {
      await DB.delNote(me.id);
      nm.hide();
      await loadChats();
    } catch (x) {
      failData("Note o‘chirish", x);
    }
    Spin.off(nd_);
  };
  $("#new-post").onclick = () => postM.show();
  $("#post-send").onclick = async () => {
    const text = $("#post-text").value.trim(),
      f = $("#post-file").files[0];
    if (!text && !f) return;
    const b = $("#post-send");
    Spin.on(b);
    try {
      const image_url = f
        ? await DB.upload(
            "files",
            me.id,
            await DB.prepare(f, 2560, 2 * 1024 * 1024, 0.92),
          )
        : null;
      await DB.addPost({ body: text || null, image_url });
      $("#post-text").value = "";
      hidePostMentions();
      $("#post-file").value = "";
      postM.hide();
      if (feedUser) feedUser.focus = null;
      loadFeed(true);
    } catch (x) {
      failData("Post joylash", x);
    }
    Spin.off(b);
  };

  // ---- real vaqt, online
  const onStatus = (m) => {
    if (m.sender !== me.id) return;
    const prev = loaded.get(String(m.id)),
      merged = { ...(prev || {}), ...m };
    const c = chats.find((x) => x.last.id === m.id);
    if (c) {
      c.last = merged;
      renderList();
    }
    if (!prev) return;
    loaded.set(String(m.id), merged);
    const ic = body.querySelector(`[data-mid="${m.id}"] time .st`);
    if (ic && stKey(prev) !== stKey(merged))
      ic.outerHTML = stIcon(merged, true);
    seenLine(true);
  };
  DB.listen(
    async (m) => {
      if (m.sender === me.id) return;
      notifyMessageSound();
      if (m.room_id && !roomSeenAt[String(m.room_id)]) {
        markRoomSeen(m.room_id, new Date(new Date(m.created_at).getTime() - 1).toISOString());
      }
      const inView =
        target &&
        (m.room_id
          ? target.type === "room" && target.id === m.room_id
          : target.type === "user" && target.id === m.sender);
      if (inView) {
        await need([m.sender]);
        add(m);
        if (m.room_id) markRoomSeen(m.room_id, m.created_at);
        // oyna ochiq bo'lsa "ko'rildi", fonda bo'lsa faqat "yetkazildi"
        if (!m.room_id)
          document.hidden ? DB.delivered(me.id) : DB.read(me.id, m.sender);
      } else if (!m.room_id) DB.delivered(me.id);
      if (!m.room_id) loadChats();
      else loadRooms();
    },
    onStatus,
    (old) => {
      // DELETE hodisasida faqat id keladi: ko'rinib turgan yoki ro'yxatdagi oxirgi xabar bo'lsa yangilaymiz
      const id = String(old?.id ?? "");
      if (!id) return;
      const was = loaded.has(id);
      if (was) dropMsg(id);
      if (
        was ||
        chats.some((c) => String(c.last.id) === id) ||
        rooms.some((r) => r.lastMessage && String(r.lastMessage.id) === id)
      )
        reloadSoon();
    },
  );
  const ping = () => DB.touchPresence().catch((e) => console.warn("Presence update failed", e));
  ping();
  setInterval(() => { if (!document.hidden) ping(); }, 30000);
  setInterval(() => { if (target?.type === "user" && !peerTyping) header(); }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { stopLocalTyping(); return; }
    ping();
    if (target?.type === "user") DB.read(me.id, target.id);
    loadNotifications(false);
  });

  Lang.init(() => {
    renderList();
    if (target) header();
    if (tab === "posts") loadFeed();
  });
  const initialTabReady = setTab(tab);
  paint();
  if (tab !== "notifications") loadNotifications(false);
  let notificationReloadTimer;
  DB.listenNotifications(me.id, () => {
    clearTimeout(notificationReloadTimer);
    notificationReloadTimer = setTimeout(() => loadNotifications(false), 180);
  });
  // Realtime yangi bildirishnomalarni yetkazadi; sekinroq polling faqat ulanish uzilib qolishiga zaxira.
  setInterval(() => {
    if (!document.hidden) loadNotifications(false);
  }, 60000);
  ping();
  // Asosiy chat ro'yxati ko'rsatilgach, boshqa bo'limlarni fonda oldindan yuklaymiz.
  const initialChatsReady = loadChats();
  Promise.allSettled([initialTabReady, initialChatsReady]).then(() => {
    const splash = $("#app-splash");
    if (!splash) return;
    splash.classList.add("is-hidden");
    setTimeout(() => splash.remove(), 300);
  });
  initialChatsReady
    .then(() =>
      setTimeout(() => {
        if (!friendsLoaded && !friendsRequest) loadFriends();
        if (!roomsLoadedAt && !roomsRequest) loadRooms();
        if (tab !== "communities" && !commsLoadedAt) {
          DB.communities()
            .then((rows) => {
              comms = rows;
              commsLoadedAt = Date.now();
              if (tab === "communities") renderList();
            })
            .catch((x) => console.error("Communities preload failed:", x));
        }
      }, 80),
    )
    .catch((x) => console.error("Chats preload failed:", x));
  DB.blockedIds(me.id)
    .then((ids) => {
      blocked = new Set(ids);
      if (target) paintChatState();
    })
    .catch((x) => console.error("Blocks load failed:", x));
  DB.delivered(me.id);
  DB.followingIds(me.id)
    .then((ids) => (following = new Set(ids)))
    .catch(() => {});
  const linkedGroup =
    requestedGroup || sessionStorage.getItem("xabarim-pending-group");
  if (linkedGroup) sessionStorage.removeItem("xabarim-pending-group");
  if (linkedGroup)
    (async () => {
      try {
        await loadRooms();
        const group = await DB.groupByUsername(linkedGroup);
        if (!group) return toast(t("group_not_found"));
        if (!rooms.some((r) => r.id === group.id)) {
          await DB.join(group.id, me.id);
          await loadRooms();
        }
        await openTarget({ type: "room", id: group.id });
      } catch (x) {
        fail(x);
      }
    })();
})();
