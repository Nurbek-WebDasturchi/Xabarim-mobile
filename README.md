# Ishga tushirish va deploy qilish

GitHub, Vercel va Expo APK orqali o‘zgarishlarni qanday joriy etish bo‘yicha to‘liq ketma-ketlik:

[instructions/README.md](instructions/README.md)

Eng muhim qoida: `pages`, `css`, `js` va `img` ichidagi web UI o‘zgarishlari GitHub → Vercel deploy’dan keyin APK’ni qayta o‘rnatmasdan telefonda ko‘rinadi. Faqat `mobile/App.tsx`, `mobile/app.json` yoki native ikonka o‘zgarsa yangi APK build qilinadi.

# Xabarim v0.9.20 (frontend)

## v0.9.20 — 2026-10-23 (Note reaksiyalari va bir oylik Premium)

1. `supabase/schema_v28.sql` ni `schema_v27.sql` dan keyin, so‘ng `supabase/schema_v29.sql` ni ishga tushiring. Migratsiyadan oldin `@xabarim` rasmiy xizmat profili mavjud bo‘lsin.
2. Mavjud Premiumlar migratsiya kunidan boshlab bir oy ishlaydi; keyingi Premium xaridlari ham bir oyga beriladi. Profil oynasida boshlanish va tugash sanalari ko‘rinadi, xizmat chatidan tabrik xabari keladi.
3. Boshqa foydalanuvchining Note’ini bosganda to‘liq matn modalda ochiladi va emoji reaksiyalarini qabul qiladi.

## v0.9.18 — 2026-10-21 (taklif va Telegram mukofotlari)

1. `supabase/schema_v27.sql` ni `schema_v26.sql` dan keyin Supabase SQL Editor’da ishga tushiring. Kelajakdagi har bir taklif ro‘yxatdan o‘tganda taklif qiluvchi va yangi foydalanuvchi 1 XCoin oladi.
2. Telegram vazifasi obunani Bot API’da tekshirib, bir marta 5 XCoin beradi. Botni `@ahmedov_2604` kanaliga administrator qilib qo‘shing, bot domenini BotFather’da sozlang va `.env` ga `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_CHAT_ID` hamda serverda saqlanadigan `SUPABASE_SERVICE_ROLE_KEY` kiriting. Service role kalitini brauzerga chiqarmang.
3. Telegram vazifasida avval hisobni Telegram Login Widget orqali ulang, so‘ng kanalga a’zo bo‘lib “Tekshirish” tugmasini bosing. Vazifa va tugmalar o‘zbek, ingliz va rus tillarida.
4. `package.json` versiyasi `0.9.18`.

## v0.9.17 — 2026-10-21 (realtime presence va typing)

1. `supabase/schema_v26.sql` ni `schema_v25.sql` dan keyin Supabase SQL Editor’da ishga tushiring. Bu `last_seen` uchun xavfsiz RPC yaratadi va `profiles` jadvalini Realtime’ga qo‘shadi.
2. Chatdagi oxirgi faollik endi 30 soniyada yangilanadi; ochiq suhbatda do‘stning onlayn holati Realtime orqali keladi.
3. Xabar yozayotganda uch nuqtali animatsiyali “yozyapti…” holati o‘zbek, ingliz va rus tillarida ko‘rinadi.
4. `package.json` versiyasi `0.9.17`.

## v0.9.16 — 2026-10-21 (XCoin kirim bildirishnomalari)

1. `supabase/schema_v25.sql` ni `schema_v24.sql` dan keyin Supabase SQL Editor’da ishga tushiring. Bu @ceo hisobiga bir martalik 1000 XCoin beradi va XCoin transferlarida kirim bildirishnomasi yaratadi.
2. XCoin kelganda bildirishnomada miqdor ko‘rinadi, balans yangilanadi va maxsus tanga ovozi chalinadi.
3. `package.json` versiyasi `0.9.16`.

## v0.9.15 — 2026-10-21 (XCoin yuborish)

1. `supabase/schema_v24.sql` ni `schema_v23.sql` dan keyin Supabase SQL Editor’da ishga tushiring. Bu @uzb hisobiga bir martalik 100 XCoin beradi va xavfsiz transfer RPC’sini yoqadi.
2. Profil → XCoin balansidan istalgan mavjud foydalanuvchiga butun XCoin yuborish mumkin. Qabul qiluvchi username’i bilan topiladi; jo‘natuvchi balansi serverda tekshiriladi.
3. `package.json` versiyasi `0.9.15`.

## v0.9.14 — 2026-10-21 (Google hisobini almashtirish)

1. `supabase/schema_v23.sql` ni `schema_v22.sql` dan keyin Supabase SQL Editor’da ishga tushiring.
2. Gmail almashtirish akkauntdagi eski Google identity’ni uzadi va yangi hisobni bog‘laydi. Faqat `gmail.com` qabul qilinadi; Google tasdiqlash bonusi bir marta beriladi.

## v0.9.13 — 2026-10-21 (profil va XCoin vazifalari)

1. `supabase/schema_v22.sql` ni `schema_v21.sql` dan keyin Supabase SQL Editor'da ishga tushiring. Bu @ceo va @vip hisoblariga bir martalik 50 XCoin beradi.
2. Profil ichida balans bosilganda taklif (+10) va Telegram kanal (+20) vazifalari ochiladi. Premium belgisi ko‘k, interfeys Xabarim binafsha rangida.
3. Google OAuth ulanish xatosi uchun foydalanuvchiga aniqroq sabab ko‘rsatiladi. Provayder va ruxsat etilgan Redirect URL’larni Supabase Dashboard’da tekshiring.

## v0.9.12 — 2026-10-20 (XCoin, taklif va Premium)

1. `supabase/schema_v21.sql` ni **schema_v20.sql dan keyin** Supabase SQL Editor'da ishga tushiring. U XCoin balansini, bonuslar tarixini, taklif havolalarini, Gmail tasdiqlashini va Premium xaridini qo‘shadi.
2. Taklif havolasi orqali ro‘yxatdan o‘tgan foydalanuvchi hamda taklif qilgan akkaunt 10 XCoin oladi. 5 ta taklif = 50 XCoin.
3. Google hisob faqat Supabase OAuth orqali ulanadi va `gmail.com` identity bo‘lsa “Haqiqiy inson” maqomini hamda bir martalik 10 XCoin beradi.
4. Xabarim Premium 50 XCoin turadi; Premium foydalanuvchilarida maxsus belgi ko‘rinadi.

## v0.9.10 — 2026-10-12 (video limiti va yuklanish kartasi)

1. Fayl/video limiti 10 MB dan **100 MB** ga oshirildi (`js/core/db.js`, `i18n.js`). `supabase/schema_v17.sql` ni **schema_v16.sql dan keyin** ishga tushiring. Supabase Free rejasida global limit 50 MB — Dashboard → Storage → Settings dan 100 MB qiling.
2. Video yuborilganda chatda darhol qora yuklanish kartasi chiqadi (video balandligiday): aylanuvchi halqa, foiz, MB va bekor qilish (X) tugmasi.
3. Tor (vertikal) videolarda "to‘liq ekran" tugmasi chetga chiqib ketishi tuzatildi (min. kenglik 220px va container-query'lar).
4. `package.json` versiyasi `0.9.10`.

## v0.9.9 — 2026-10-11 (katta fayllarni tez uzatish)

1. Videoni uzatishda avval brauzerga to‘liq yuklab, so‘ng qayta yuklash o‘rniga Supabase Storage ichida server tomonda nusxa olinadi. Nusxa olish huquqi bo‘lmasa, eski yuklab-yuklash usuli zaxira sifatida ishlaydi.
2. Tez nusxalash uchun `supabase/schema_v16.sql` ni **schema_v15.sql dan keyin** Supabase SQL Editor'da ishga tushiring. Siyosat foydalanuvchiga faqat o‘zi o‘qiy oladigan xabarlarda ko‘rsatilgan fayllarni nusxalash imkonini beradi.
3. `package.json` versiyasi `0.9.9`.

## v0.9.8 — 2026-10-11 (uzatish tezligi va Saqlangan xabarlar)

1. Bir nechta odam yoki guruhga xabar uzatish parallel bajariladi; fayl uzatishda har bir oluvchiga alohida nusxa yaratiladi.
2. "Muallif bilan" uzatishda muallif profili yuklanadi. `schema_v15.sql` qo‘llanmagan bo‘lsa, muallif ma’lumotini yo‘qotib yubormasdan aniq xatolik ko‘rsatiladi.
3. Saqlangan xabarlar chatining menyusidan barcha xabarlarni tasdiqlash bilan tozalash va uning profilida qisqa ma’lumot ko‘rish mumkin.
4. Yuborish tugmasi hover holatida ko‘k qoladi; yengil rang/soya o‘zgarishi va klaviatura fokus indikatori qo‘shildi.
5. `package.json` versiyasi `0.9.8`.

1. `npm install`
2. `.env.example` ni `.env` ga nusxalang va Supabase URL / anon key ni yozing
3. Supabase → SQL Editor'da `supabase/schema.sql` ni ishga tushiring
4. Supabase → Authentication → Providers → Google ni yoqing; Redirect URL: `http://localhost:3000/pages/main.html`
5. `npm start` → http://localhost:3000/pages/app.html

`.env` bo'lmasa sayt demo rejimda (localStorage) ishlaydi.

## v0.5 (qo'shimcha)

1. `supabase/schema_v2.sql` ni **schema.sql dan keyin** SQL Editor'da ishga tushiring (guruh, jamiyat, note, post, username+parol).
2. Supabase → Authentication → Sign In / Providers → Email: **Confirm email ni o'chiring** (username `username@xabarim.uz` ko'rinishida saqlanadi, haqiqiy pochta yuborilmaydi).
3. Yangi jamiyat qo'shish: `insert into rooms (kind,name,description,created_by) values ('community','Nomi','Tavsif',null);`
4. Demo rejim olib tashlandi: `.env` to'ldirilishi shart.

## v0.5.2 (qo'shimcha)

1. `supabase/schema_v4.sql` ni **schema_v3.sql dan keyin** SQL Editor'da ishga tushiring (obunachilar, xabar holati, note/post lentalari).
2. Yangilar: ekran zoom qilinmaydi; dark mode'da bio/note matnlari oq; note'lar bir-biriga tegmaydi;
   xabar holati (yuborildi → yetkazildi → ko'rildi); Instagram kabi obunachilar/obunalar, "Obunalarim" lentasi.
3. `schema_v4.sql` ishga tushirilmaguncha eski funksiyalar ishlaydi, faqat yetkazildi/obuna qismlari bo'lmaydi.

## v0.5.4 (qo'shimcha)

1. `supabase/schema_v5.sql` ni **schema_v4.sql dan keyin** Supabase SQL Editor'da ishga tushiring.
2. Xabar reply, post izohlari va emoji reaction'lar, shuningdek follow/like/comment bildirishnomalari v5 jadvallaridan foydalanadi.

## v0.5.6 (qo'shimcha)

1. `supabase/schema_v6.sql` ni **schema_v5.sql dan keyin** Supabase SQL Editor'da ishga tushiring.
2. Guruhlarga public username va ulashish havolasi beriladi; guruhlarni nomi yoki `@username` orqali qidirish mumkin.

## v0.6 (qo'shimcha)

1. `supabase/schema_v7.sql` ni **schema_v6.sql dan keyin** Supabase SQL Editor'da ishga tushiring.
2. Guruh egasi username'ni o'zi belgilaydi; guruhlar haqida shikoyat yuborish jadvali qo'shiladi.

## v0.7 (note/post API ruxsatlarini tiklash)

1. `supabase/schema_v8.sql` ni **schema_v7.sql dan keyin** Supabase SQL Editor'da ishga tushiring.
2. Bu migration `notes` va `posts` uchun `authenticated` API ruxsatlari hamda RLS qoidalarini tiklaydi, `community_counts()` RPC'sini yaratadi va PostgREST schema cache'ni yangilaydi.
3. Agar eski migratsiyalar hali qo'llanmagan bo'lsa, ularni tartib bilan bajaring: `schema_v2.sql`, `schema_v3.sql`, `schema_v4.sql`, `schema_v5.sql`, `schema_v6.sql`, `schema_v7.sql`, keyin `schema_v8.sql`. v8 avvalgi jadvallarni yaratmaydi.

## v0.7.3 (post reaksiyalari va guruhni o'chirish)

1. `supabase/schema_v9.sql` ni **schema_v8.sql dan keyin** Supabase SQL Editor'da ishga tushiring.
2. Guruhni faqat egasi o'chira oladi; o'chirish guruh xonalari va xabarlarini ham cascade orqali o'chiradi.

## v0.8.6 (note xatosi, chat badge, bildirishnomalar, akkaunt postlari)

1. `supabase/schema_v10.sql` ni **schema_v9.sql dan keyin** Supabase SQL Editor'da ishga tushiring (qayta ishga tushirsa xato bermaydi).
2. Note xatosi: 24 soatdan oshgan eski note jadvalda qolib, yangisini saqlashga RLS to'sqinlik qilardi. Endi `set_note()` funksiyasi ishlatiladi.
3. Chats sarlavhasidagi badge nechta odamdan o'qilmagan xabar kelganini ko'rsatadi (3 kishidan 10 ta xabar = 3). Chat ochilgach badge kamayadi.
4. Bildirishnomalar: follow / like / comment; qo'ng'iroq ustida o'qilmaganlar soni; bosilsa profil yoki postlar ochiladi.
5. Har bir akkauntda postlar (like va izoh soni bilan); lentadagi muallif nomi/rasmi bosilsa akkaunti ochiladi.

## v0.8.7 (spinner, lenta yuklanishi, profildan postni ochish)

1. Yangi SQL migratsiya shart emas (faqat frontend o'zgardi).
2. Kirish / ro'yxatdan o'tish va barcha asinxron tugmalarda (post joylash, profil saqlash, obuna, guruh, note, chiqish va h.k.) tugma ichida spinner aylanadi (`js/core/spin.js`, `css/spinner.css`).
3. Postlar serverdan kelguncha lentada "Postlar yuklanmoqda…" ko'rinadi; xatolikda "Qayta urinish" tugmasi chiqadi.
4. Profildagi (o'zingizniki yoki boshqaniki) postni bosganda Postlar bo'limi ochiladi: shu akkaunt postlari katta lentada, bosilgan post belgilanib, like/dislike, reaksiya va izoh bilan ko'rinadi. Tepadagi ← tugmasi umumiy lentaga qaytaradi.

## v0.8.8 — 2026-10-09 (profil, bildirishnoma va post statistikasi)

1. O'z profilidagi maydonlar ko'rish rejimida tahrirlanmaydi va fokus olmaydi. Qalam tugmasi tahrirlash rejimini ochadi; avatar o'zgarishi ham Saqlash bosilganda yuboriladi.
2. Profil oynasidagi tahrirlash qalamchasi modalning yuqori o'ng chetiga joylashtirildi.
3. Follow bildirishnomasi bosilganda yuboruvchining profili ochiladi. Like/comment bildirishnomasi tegishli postga olib boradi; comment ichida tegishli izoh ajratib ko'rsatiladi.
4. Post statistikasi tugmasida reaksiyalar va izohlar jami hamda ularni qoldirgan foydalanuvchilar ko'rsatiladi.
5. Post profil/modal UX-i tartiblandi; joriy versiya 0.8.8 bo'lib qoladi. 1.0 versiyasiga o'tish keyingi alohida qaror.

## v0.8.8.1 — 2026-10-09 (sozlamalar va savol yuborish)

1. `supabase/schema_v11.sql` ni **schema_v10.sql dan keyin** Supabase SQL Editor'da ishga tushiring.
2. Sozlamalarga FAQ, Xabarim imkoniyatlari va Savol berish bandlari qo'shildi.
3. Yuborilgan savollar `support_questions` jadvalida admin inbox uchun saqlanadi. Foydalanuvchi faqat savol yubora oladi; kelajakdagi admin panel savollarni ishonchli server orqali o'qishi kerak.
4. `0.8.8.1` README va loyiha uchun ishlatilayotgan to'rt qismli ichki reliz yorlig'i. SemVer standarti esa `MAJOR.MINOR.PATCH` ko'rinishida uchta raqam ishlatadi; shu sabab `package.json` npm uchun `0.8.8` holida qoldi. Standart SemVer'da keyingi patch `0.8.9` bo'ladi.

## v0.9.0 — 2026-10-10 (xabarni o'chirish, chat menyusi, do'stlar, bloklash)

1. `supabase/schema_v12.sql` ni **schema_v11.sql dan keyin** Supabase SQL Editor'da ishga tushiring (qayta ishga tushirsa xato bermaydi). Busiz yangi tugmalar "ruxsat rad etildi" xatosini beradi.
2. Xabarni o'chirish (xabar tagidagi 🗑 tugmasi): chatda o'zingiz yuborgan xabar hamma uchun o'chadi; guruhda o'zingiznikini, guruh egasi esa istalgan xabarni; jamiyatda faqat o'zingiznikini. Xabar bilan yuborilgan fayl ham xotiradan o'chiriladi.
3. Chat tepasida ⋮ menyu (faqat shaxsiy chatda): Do'stlarga qo'shish / o'chirish, Obuna / Obunani bekor qilish, Tarixni tozalash, Suhbatni o'chirish, Bloklash / Blokdan chiqarish.
4. Tarixni tozalash va suhbatni o'chirish faqat sizda ishlaydi, suhbatdoshda xabarlar qoladi. Suhbatdosh yangi xabar yozsa, suhbat yana ro'yxatda paydo bo'ladi.
5. Bloklashda ikki tomon ham bir-biriga yangi xabar yubora olmaydi (guruh va jamiyatga ta'sir qilmaydi). Bloklangan foydalanuvchiga bloklangani ko'rsatilmaydi.
6. Yangi "Do'stlar" bo'limi contacts kabi ishlaydi: "Do'stlarga qo'shish" bosilsa shu ro'yxatda chiqadi, bosilsa chat ochiladi, qidiruv ishlaydi. Bu bir tomonlama ro'yxat (so'rov/tasdiq yo'q).
7. `package.json` versiyasi SemVer bo'yicha `0.9.0` ga o'zgartirildi.

## v0.9.1 — 2026-10-10 (Telegramdagidek xabar menyusi va "suhbatdosh uchun ham o'chirish")

1. `supabase/schema_v13.sql` ni **schema_v12.sql dan keyin** Supabase SQL Editor'da ishga tushiring (qayta ishga tushirsa xato bermaydi).
2. Xabar ustiga bosing (kompyuterda o'ng tugma, telefonda bosish yoki uzoq bosish): **Javob berish / Nusxalash / O'chirish** menyusi chiqadi. Xabar tagidagi 🗑 tugmasi olib tashlandi, javob tugmasi joyida qoldi.
3. O'chirish oynasi: o'zingizning xabaringiz uchun "Hamma uchun o'chirish" (chatda "{ism} uchun ham o'chirish") checkbox'i bor; belgilanmasa xabar faqat sizda yo'qoladi. Boshqa odamning xabari (yoki guruh egasi bo'lmasangiz guruhdagi xabar) faqat sizda o'chadi. Guruh egasi istalgan xabarni hamma uchun o'chira oladi.
4. **Tarixni tozalash** va **Suhbatni o'chirish** endi modal oyna ochadi, ichida "{ism} uchun ham o'chirish" checkbox'i bor. Belgilansa ikkala tomondagi barcha xabarlar o'chadi; belgilanmasa faqat sizda.
5. Faqat sizning fayllaringiz storage'dan o'chiriladi; suhbatdosh yuborgan fayllar uning papkasida qoladi (storage qoidasi shuni talab qiladi).
6. `package.json` versiyasi `0.9.1`.

## v0.9.3 — 2026-10-11 (tarixni tozalash animatsiyasi va kun ajratgichlari)

1. Yangi SQL migratsiya shart emas (faqat frontend o'zgardi). Oxirgi migratsiya hamon `supabase/schema_v13.sql`.
2. **Tarixni tozalash animatsiyasi** (Telegramdagidek): tasdiqlangach chat ichida supurgi axlatni savatga supurayotgan animatsiya va "Tozalanmoqda…" yozuvi chiqadi. Tugagach chatda "Tarix tozalandi" belgisi qoladi; yangi xabar kelsa yoki yozilsa, u yo'qoladi. Xatolik bo'lsa xabarlar joyiga qaytariladi. Animatsiya kamida 2 soniya ko'rinadi; `prefers-reduced-motion` yoqilgan qurilmalarda animatsiya o'chiq (statik rasm).
3. **Sana ajratgichlari**: har bir kunning birinchi xabari tepasida sana chiqadi — "Bugun", "Kecha", undan oldingilari "12 oktyabr" ko'rinishida (boshqa yil bo'lsa yili bilan). Bugun birinchi xabar yozilganda "Bugun" belgisi avtomatik qo'shiladi, ertasi kuni yozilgan xabarlar o'z sanasi ostida turadi. Xabar o'chirilib, kun ichida xabar qolmasa, ajratgich ham olib tashlanadi. Shaxsiy chat, guruh va jamiyatda ishlaydi; uch tilda (uz / en / ru).
4. Zipdagi hal qilinmagan git merge-konfliktlari (`<<<<<<< HEAD`) tozalandi: `package.json`, `css/app/main.css`, `js/i18n.js`, `js/app/main.js`, `js/core/db.js` — barchasida v0.9.1 (HEAD) kodi saqlandi.
5. `package.json` versiyasi `0.9.3`.

## v0.9.4 — 2026-10-11 (tozalangan suhbat ro'yxatda qoladi, qo'ng'iroqcha, navbar)

1. `supabase/schema_v14.sql` ni **schema_v13.sql dan keyin** Supabase SQL Editor'da ishga tushiring (qayta ishga tushirsa xato bermaydi). Busiz ilova ishlaydi, lekin tarix tozalangach suhbat ro'yxatdan yo'qoladi (eski xatti-harakat).
2. **Tarixni tozalash**: suhbat endi ro'yxatdan yo'qolmaydi — o'zingizda ham, "{ism} uchun ham o'chirish" belgilansa suhbatdoshda ham ro'yxatda "Tarix tozalandi" yozuvi bilan qoladi. Chatni ochganda ham "Tarix tozalandi" belgisi ko'rinadi; yangi xabar yozilishi bilan yo'qoladi. "Suhbatni o'chirish" avvalgidek suhbatni ro'yxatdan olib tashlaydi.
3. **Bildirishnoma**: yangi bildirishnoma kelganda qo'ng'iroqcha jiringlaydi va ovoz chiqadi (ovoz Web Audio orqali yaratiladi, mp3 kerak emas). Brauzer qoidasiga ko'ra ovoz sahifada kamida bitta bosish/tegishdan keyin eshitiladi. Bildirishnoma matni endi qo'ng'iroqcha ostida chiqadi.
4. Yuqoridagi navbardan yorug'/qorong'i rejim tugmasi olib tashlandi (rejim Sozlamalarda qoladi).
5. Navbar tartibi: qo'ng'iroqcha eng chapda, Profil eng o'ngda (Sozlamalar profil yonida).
6. `package.json` versiyasi `0.9.4`.

## v0.9.5 — 2026-10-11 (bildirishnoma badge va ovoz xatti-harakati)

1. Chatdagi o'qilmagan xabarlar soni **Chats ikonkasining ustidagi badge'da** ko'rinadi (telefon va kompyuter navigatsiyasida). Bo'lim sarlavhasi va brauzer sahifa sarlavhasida bu son chiqarilmaydi; Do'stlar, Guruhlar, Jamiyatlar va Postlar ikonkasiga chat badge'i qo'yilmaydi.
2. Qo'ng'iroqcha badge'i faqat o'qilmagan bildirishnomalarning umumiy sonini ko'rsatadi. Akkaunt ochilganda o'qilmagan bildirishnoma bo'lsa qo'ng'iroqcha jiringlaydi va ovoz chalinadi; brauzer autoplay'ni cheklasa, ovoz birinchi foydalanuvchi tegishi/bosishida chalinadi.
3. Yangi kelgan bildirishnoma ham qo'ng'iroqcha va ovoz bilan xabar beradi.
4. Yangi SQL migratsiya kerak emas; `package.json` versiyasi `0.9.5`.

## v0.9.6 — 2026-10-11 (boshlang'ich yuklanish va Supabase so'rovlari optimizatsiyasi)

1. Guruh/jamiyat va do'stlar ma'lumotlari sahifa ochilganda majburan olinmaydi; tegishli bo'limga kirilganda yuklanadi. Guruh xonasi va oxirgi xabar so'rovlari ketma-ketligi qisqartirildi; hamjamiyatlar, a'zolar soni va xonalar parallel yuklanadi.
2. Bildirishnomalar yangi yozuv kelganda Realtime orqali darhol yangilanadi; zaxira tekshiruvi har 12 soniya o'rniga har 60 soniyada ishlaydi. Ketma-ket Realtime hodisalari 180 ms ichida bitta yangilanishga jamlanadi.
3. Chat va guruh ro'yxatlari uchun Supabase'dan faqat kerakli xabar/profile maydonlari olinadi; guruh xabari muallifi, bildirishnoma muallifi va post izohi muallifi profili shu so'rovdayoq birga keladi.
4. Asosiy chatlar ko'rsatilgach, do'stlar/guruhlar/jamiyatlar ro'yxatlari fonda oldindan olinadi. Bo'limga qayta kirilganda ro'yxatlar 30 soniyalik keshdan darhol ko'rsatiladi; postlar yangilanayotganda avvalgi lenta ekranda qoladi.
5. Yangi SQL migratsiya shart emas; `package.json` versiyasi `0.9.6`.

## v0.9.7 — 2026-10-11 (xabarni uzatish, Saqlangan xabarlar, profilda postlar tugmasi)

1. `supabase/schema_v15.sql` ni **schema_v14.sql dan keyin** Supabase SQL Editor'da ishga tushiring (xabarlar jadvaliga `fwd_from`, `fwd_name`, `fwd_src` ustunlari qo'shiladi; qayta ishga tushirsa xato bermaydi). Busiz uzatish ishlaydi, lekin "Muallif bilan" tanlansa ham xabar muallif belgisisiz ketadi. **Saqlangan xabarlar uchun migratsiya kerak emas.**
2. **Izohda Enter**: postga izoh yozib Enter bosilsa izoh yuboriladi (Shift+Enter yuborilmaydi).
3. **Suhbatdosh profilida postlar**: postlar endi birdaniga yuklanmaydi. Profilda "{n} ta post" yozuvi va **"Postlarni yuklash"** tugmasi chiqadi; tugma bosilganda postlar yuklanadi. Post bo'lmasa tugma o'rniga "Hali post qo'ymagan" yoziladi. O'z profilingiz avvalgidek.
4. **Xabarni uzatish**: xabar ustiga bosilganda menyuda **Uzatish** paydo bo'ldi (shaxsiy chat ham, guruh ham). Oynada bir yoki bir nechta suhbat/guruhni tanlab, ikki rejimdan birini tanlaysiz: **Muallif bilan** ("Uzatilgan: Ism · Guruh nomi" belgisi chiqadi) yoki **Muallifsiz** (oddiy yangi xabar kabi). Matn va fayl uzatiladi; fayl har bir joyga o'zining nusxasi bilan boradi, shuning uchun asl xabar o'chirilsa ham uzatilgani buzilmaydi. Uzatilgan xabarni qayta uzatsangiz asl muallif saqlanadi.
5. **Saqlangan xabarlar**: chatlar ro'yxatining eng tepasida qadalgan "Saqlangan xabarlar" (o'zingiz bilan suhbat). Unga o'zingiz yozishingiz, fayl yuborishingiz mumkin, xabar menyusidagi **Saqlash** esa istalgan xabarni (muallif belgisi bilan) shu yerga qo'shadi. O'qilmaganlar soniga qo'shilmaydi, "yuborildi/ko'rildi" belgilari chiqmaydi.
6. `package.json` versiyasi `0.9.7`.

## v0.9.11

1. **Do'stlar → "Do'stlarni kashf qiling"**: har bir kartochkada endi ikkita chiroyli tugma bor: **Do'stlashish** (chegarali, bosilganda "Do'stlarga qo'shildi" holatiga o'tib, kartochka silliq yo'qoladi va do'stlar ro'yxatiga tushadi) va **Kuzatish** (asosiy, gradient; bosilsa "Kuzatilmoqda" bo'ladi, qayta bosilsa obuna bekor qilinadi).
2. **Chat foni**: chat tepasidagi 🎨 tugmasi orqali fon tanlanadi: tayyor ranglar, naqshlar (yorug'/qorong'i rejimga moslashadi) yoki o'z rasmingiz (avtomatik siqiladi, qoraytirish slayderi bilan). "Faqat shu chat uchun" belgisi yoqilsa fon faqat shu suhbatga, o'chirilsa barcha chatlarga qo'llanadi. Fon shu qurilmada (localStorage) saqlanadi, SQL migratsiya kerak emas.
3. `package.json` versiyasi `0.9.11`.
4. **Kirish sahifasi (pages/app.html) responsive**: past balandlikdagi ekranlarda (masalan, kichik noutbuk oynasi 1280×600) "Boshlash" tugmasi va footer kesilib qolardi. Endi sahifa ekran balandligiga moslashadi (logo, matn va tugma o'lchamlari `clamp()` bilan o'zgaradi), footer pastda oddiy joylashadi, sig'masa sahifa scroll bo'ladi. Telefon, noutbuk va yotiq (landscape) holatlarda tekshirildi.
5. **Yangi standart profil rasmi**: `img/user-profile.png` o'rniga zamonaviy gradientli `img/user-profile.svg` (har qanday o'lchamda va doira/yumaloq kvadrat shaklda aniq ko'rinadi). Eski PNG o'chirildi.
