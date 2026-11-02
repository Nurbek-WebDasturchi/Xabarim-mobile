# Xabarim mobil ilovasi: yangilash va Play Marketga chiqarish

Bu qo‘llanma Windows PowerShell uchun yozilgan. Tayyor Android/iOS loyiha `mobile` papkasida. Buyruqlarni shu papkada ishlating. Uning ichidagi `xabarim` papkasi boshqa, oddiy Expo shabloni; asosiy Xabarim ilovasi u yerda emas.

## Sayt va mobil ilova yangilanishining farqi

Xabarim ilovasi ichida `https://www.xabarim.uz/pages/app.html` sahifasi ochiladi. Shuning uchun yangilashning ikki asosiy turi bor:

1. **Sayt sahifasi yoki web kodi o‘zgarsa** — saytni hosting/serverga qayta joylashtiring (deploy qiling). Foydalanuvchi ilovani ochganda sahifa saytdan yuklanadi. Buning uchun Play Marketdan qayta yuklash shart emas.
2. **`mobile/App.tsx` kabi mobil ilovaning JavaScript kodi o‘zgarsa** — mos ilova buildlariga EAS Update orqali yuborish mumkin. Bu usul faqat native sozlamalar o‘zgarmaganida ishlaydi.
3. **Native sozlama yoki native kutubxona o‘zgarsa** — yangi APK/AAB build kerak bo‘ladi. Ilova Play Marketda bo‘lsa, foydalanuvchi yangi versiyani Play Marketdan oladi.

`app.html` saytdan yuklanadi. Faqat shu sahifani o‘zgartirgan bo‘lsangiz, EAS Update shart emas: saytga o‘zgarishni joylang, keyin telefonda ilovani qayta ochib tekshiring.

## Hozirgi holatda yangilanishni telefonga yetkazish

Play Marketga hozir chiqarishingiz shart emas. Tayyorlash va sinash paytida `preview` buildidan foydalaning. Versiya raqamini hozir ko‘tarish shart emas: OTA yangilanish yuborish uchun `mobile/app.json` dagi `version`ni o‘zgartirish talab qilinmaydi.

Oldingi urinishlarning holati:

- Dastlabki EAS buyrug‘i `expo` topilmagani uchun to‘xtagan.
- Keyin `mobile` papkasidan yuborilgan update muvaffaqiyatli chiqdi. U `xabarim-mobile` loyihasining `preview` kanaliga, runtime `1.0.0` uchun yuborilgan.
- Shu sabab telefonda ko‘rinmasligining ehtimoliy sababi: telefondagi APK shu loyiha va `preview` kanaliga ulanmagan yoki siz o‘zgartirgan narsa saytning `app.html` sahifasida bo‘lgan. Sayt o‘zgarishini EAS update o‘zgartirmaydi.

Avval qaysi faylni o‘zgartirganingizni aniqlang:

- `pages/app.html`, `js/` yoki `css/` ichidagi sayt fayllari bo‘lsa, saytni hostingga joylashtiring (deploy qiling). Keyin ilovani to‘liq yoping va internetga ulangan holda qayta oching. APK yuklash shart emas.
- `mobile/App.tsx` kabi mobil ilovaning fayllari bo‘lsa, quyidagi `preview` APK’ni bir marta o‘rnating. Keyingi mobil kod o‘zgarishlarini EAS Update bilan yuboring.

### Bir marta yangi preview APK o‘rnatish

Agar telefondagi ilova EAS Update sozlamalari bo‘lmagan eski APK bo‘lsa, yangi APK’ni bir marta o‘rnatish kerak. Bu faqat o‘z telefoningizda sinash uchun; Play Marketga chiqarish emas.

PowerShell’ni ochib, quyidagi buyruqlarni bajaring:

```powershell
cd "C:\Users\User\Documents\ChatGPT\Xabarim Mobile\mobile"
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

Build tugagach EAS bergan APK havolasini telefonda oching va APK’ni o‘rnating. Android eski ilovani yangilashni so‘rasa, tasdiqlang. O‘rnatilgach, Xabarim’ni internetga ulangan holda bir marta oching.

### Keyingi mobil kod yangilanishlarini yuborish

`mobile` papkasida turib quyidagi komandani bajaring:

```powershell
npx eas-cli@latest update --channel preview --environment preview --message "O‘zgarish haqida qisqa izoh"
```

Terminalda `Published!` chiqsa, yangilanish EAS’ga joylangan bo‘ladi. Telefon internetga ulangan paytda Xabarim’ni ochib yangilanishni yuklashini kuting. Keyin ilovani to‘liq yoping va qayta oching. Yuklangan EAS yangilanishi odatda keyingi ochilishda ishga tushadi. EAS Dashboard’dagi `xabarim-mobile` loyihasining **Updates** bo‘limida yangilanish joylanganini tekshirishingiz mumkin.

Yangi preview APK o‘rnatilgandan keyin ham `mobile/App.tsx` dagi o‘zgarish kelmasa, telefondagi build boshqa loyiha yoki kanalga ulangan bo‘lishi mumkin. Ilovada hozir qaysi kanalga ulanganini ko‘rsatadigan ekran yo‘q. Shu sababli bu loyihaning EAS build havolasidan olingan preview APK’ni o‘rnatganingizni tekshiring.

## EAS Update nima?

EAS Update — mos o‘rnatilgan ilovaga JavaScript kodi va ayrim fayllarni internet orqali yetkazadigan Expo xizmati. Bu APK/AAB faylni yangidan yaratib, Play Marketga joylash bilan bir xil emas. Yangilanish to‘g‘ri ilovaga borishi uchun quyidagilar mos bo‘lishi kerak:

- bitta EAS loyiha;
- o‘rnatilgan build uchun mos kanal;
- mos runtime versiya;
- EAS Update orqali yuborish mumkin bo‘lgan kod o‘zgarishi.

**Sodda qilib:** “kanal” foydalanuvchi tanlaydigan menyu emas. Ilova build qilinganda unga biriktiriladigan ichki nom. Bu loyihada sinov buildi `preview`, Play Market buildi `production` kanalidan yangilanish oladi. `preview` kanaliga yuborilgan yangilanish Play Marketdagi `production` buildga bormaydi.

## Bu loyihaning EAS manzili

Asosiy loyiha sozlamasi `mobile/app.json` faylida. EAS loyiha ID raqami `58c7c926-0fd6-48a0-8898-f150ecf4f446`, loyiha nomi `xabarim-mobile`. Barcha EAS buyruqlarini `mobile` papkasidan bajaring.

Loyiha ildiz papkasida dastlabki EAS buyrug‘i bajarilganda `1795d405-6c5f-45c7-ac60-2d9eff22e93c` ID bilan boshqa EAS loyiha yaratilgan. Keyin `mobile` papkasidan yuborgan update esa asosiy mobil loyihaning `58c7c926-0fd6-48a0-8898-f150ecf4f446` ID siga to‘g‘ri yuborilgan. Keyingi safar adashmaslik uchun barcha EAS buyruqlarini `mobile` papkasidan bajaring. `1795...` ID li loyihani mobil ilova uchun ishlatmang.

## Birinchi marta EAS yangilanishini oladigan APK o‘rnatish

Agar telefondagi ilova EAS Update sozlamalari bo‘lmagan eski APK bo‘lsa, u EAS yangilanishlarini ololmaydi. Avval `preview` kanaliga mo‘ljallangan yangi APK yarating va telefonga bir marta o‘rnating. Shundan keyin mos JavaScript o‘zgarishlarini EAS Update bilan yuborish mumkin.

PowerShell’da:

```powershell
cd "C:\Users\User\Documents\ChatGPT\Xabarim Mobile\mobile"
npm install
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

Build tugagach EAS APK’ni yuklab olish havolasini beradi. APK’ni Android telefoningizga yuklab o‘rnating. Keyin Xabarim ilovasini ochib tekshiring. Shu yangi APK’ni birinchi marta o‘rnatmasangiz, eski ilova EAS Update olmaydi.

## React Native kodidagi o‘zgarishni sinov ilovasiga yuborish

`mobile` papkasiga kirib, bu buyruqni bajaring:

```powershell
cd "C:\Users\User\Documents\ChatGPT\Xabarim Mobile\mobile"
npx eas-cli@latest update --channel preview --environment preview --message "O‘zgarish haqida qisqa izoh"
```

EAS kodni tayyorlab, `preview` kanaliga joylaydi. Telefonga o‘rnatilgan build loyiha, kanal va runtime bo‘yicha mos bo‘lsa, ilovani internet bilan ochganda yangilanishni yuklab oladi. Odatda yuklangan yangilanish ilovani keyingi safar to‘liq yopib, qayta ochganda ishga tushadi. EAS Dashboard’dagi loyiha **Updates** bo‘limidan yangilanish joylanganini tekshirish mumkin. Hozirgi ilovada “Yangi versiya mavjud” degan alohida xabar yoki tugma yo‘q.

`--environment preview` EAS’dagi preview muhitini tanlaydi. Oldingi ishga tushirishda EAS bu parametrni majburiy so‘ragan, shuning uchun buyruqda qoldiring. `--message` matnini o‘zgarishingizga moslab almashtiring.

## Play Marketda sinash va ommaga chiqarish

Play Marketga Android ilovaning `.aab` fayli yuboriladi. Production build qilishdan avval `mobile/app.json` ichidagi ilova nomi, belgisi (icon), `uz.xabarim.mobile` package ID raqami, versiya va EAS loyiha ID sini tekshiring.

1. [Google Play Console](https://play.google.com/console/) hisobini oching.
2. Console’da Xabarim ilovasi uchun sahifa yarating. Ilova tavsifi, rasmlar, maxfiylik siyosati va Google talab qilgan boshqa ma’lumotlarni to‘ldiring.
3. Avval **Internal testing** (ichki sinov) bo‘limiga AAB yuklang. Sinovchilarning email manzillarini qo‘shing. Ular Play Market orqali ilovani o‘rnatsin va tekshirsin.
4. Sinovga tayyor bo‘lgach, `mobile` papkasida production build yarating:

```powershell
cd "C:\Users\User\Documents\ChatGPT\Xabarim Mobile\mobile"
npx eas-cli@latest build --platform android --profile production
```

5. Build tugagach, hosil bo‘lgan `.aab` faylni Play Console’dagi reliz bo‘limiga yuklang va Google tekshiruviga yuboring.
6. Google tasdiqlab, ilovani chiqargach, foydalanuvchilar Xabarim’ni Play Marketdan o‘rnata oladi.

EAS Android imzolash kalitini (ilova sizning hisobingizdan chiqqanini tasdiqlovchi kalit) sozlashni so‘rasa, EAS’da yaratib saqlash variantini tanlang. Kalitni yo‘qotmang: keyingi AAB versiyalari ham shu kalit bilan imzolanishi kerak.

### Play Marketda chiqqandan keyingi yangilanishlar

- `app.html` yoki sayt kodi o‘zgarsa, saytni deploy qiling. Ilova sahifani saytdan oladi.
- Faqat native bo‘lmagan, JavaScript o‘zgarishlari bo‘lsa, mos `production` buildga EAS Update yuborish mumkin:

```powershell
npx eas-cli@latest update --channel production --environment production --message "O‘zgarish haqida qisqa izoh"
```

- Native kod, ruxsatlar, icon, Expo SDK yoki native kutubxona o‘zgarsa, yangi production AAB tayyorlab Play Console’ga yangi reliz qilib yuklang. Play Market foydalanuvchiga yangilashni taklif qiladi.

Yangi AAB versiya raqami avvalgi relizdan yuqori bo‘lishi kerak. Versiya sozlamasi `mobile/app.json` faylida. AAB’ni Play Console’ga yuborishdan oldin build ma’lumotlarida versiya to‘g‘ri ekanini tekshiring.

## “Yangi versiya mavjud” degan tugma qanday ishlaydi?

Hozirgi `mobile/App.tsx` kodida yangi versiyani tekshiradigan yoki shu xabarni ko‘rsatadigan funksiya yo‘q. EAS Update mos yangilanishni avtomatik olib, keyingi ochishda qo‘llaydi; u o‘zidan-o‘zi Play Marketga o‘xshash “Yangilash” tugmasini chiqarmaydi.

Play Marketda ilova chiqqandan keyin foydalanuvchiga yangi versiyani bildirishning ikki yo‘li bor:

1. **Play Market sahifasini ochadigan tugma.** Ilova serverdan eng so‘nggi versiya raqamini tekshiradi. Yangi versiya bo‘lsa, “Yangi versiya mavjud” degan xabar va tugma chiqadi. Tugma Play Marketdagi Xabarim sahifasini ochadi; foydalanuvchi u yerdan “Yangilash”ni bosadi. Buning uchun ilovaga tekshiruv kodi, versiya raqamini saqlaydigan server/API va Play Marketdagi ilova havolasi kerak.
2. **Ilova ichida yangilashni taklif qilish.** Google Play’ning ilova ichidagi yangilash xizmatini native qismga ulash mumkin. Bu Play Marketdagi ilovalar uchun mo‘ljallangan, native sozlama va yangi build talab qiladi.

Foydalanuvchi bu imkoniyatdan foydalanishi uchun uni kodga qo‘shib, yangi build chiqarish kerak. Faqat EAS Update yuborish bilan bu tugma paydo bo‘lmaydi. Hozircha tugma ilovada yo‘q.

## Tez-tez uchraydigan muammolar

- **`EAS project not configured` xatosi:** `mobile` papkasida ekaningizni tekshiring. EAS loyiha ID si asosiy loyiha `mobile/app.json` ichida yozilgan.
- **`expo` topilmadi xatosi:** Buyruq noto‘g‘ri papkadan bajarilgan bo‘lishi mumkin. `cd "...\Xabarim Mobile\mobile"` qiling va `npm install` ni bajaring.
- **Update joylandi, ammo telefonda ko‘rinmadi:** Ilovadagi build `preview`mi yoki `production`mi, update ham o‘sha kanalga yuborilganmi, EAS loyiha ID va runtime mosmi — tekshiring. `app.html` o‘zgargan bo‘lsa, EAS update emas, saytni deploy qilish kerak.
- **Native o‘zgarish OTA bilan kelmaydi:** yangi APK/AAB build qiling.
- **Buildlar ro‘yxatini ko‘rish:**

```powershell
npx eas-cli@latest build:list
```

Oxirgi build tafsilotlarini ko‘rish:

```powershell
npx eas-cli@latest build:view
```
