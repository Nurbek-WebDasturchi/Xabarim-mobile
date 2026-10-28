# Xabarim mobil ilovasini EAS orqali yaratish

Ushbu yo‘riqnoma Windows PowerShell uchun yozilgan. Tayyor Xabarim mobil loyihasi `mobile` papkasida joylashgan.

## 1. Kerakli dasturlar

- Node.js LTS: https://nodejs.org/
- Expo hisob: https://expo.dev/
- Android telefon va USB kabel yoki Wi-Fi

Node.js o‘rnatilganini tekshirish:

```powershell
node --version
npm --version
```

## 2. To‘g‘ri loyiha papkasiga kirish

PowerShell’da quyidagini bajaring:

```powershell
cd "C:\Users\User\Documents\ChatGPT\Xabarim Mobile\mobile"
```

`npx create-expo-app@latest xabarim` buyrug‘i bilan yaratilgan yangi `xabarim` papkasi oddiy Expo shablonidir. Xabarim ilovasini build qilish uchun aynan shu tayyor `mobile` papkasidan foydalaning.

## 3. Paketlarni o‘rnatish

```powershell
npm install
```

Jarayon tugaguncha kuting. Terminal yana buyruq qabul qiladigan holatga qaytganda o‘rnatish tugagan bo‘ladi.

## 4. Expo/EAS hisobiga kirish

```powershell
npx eas-cli@latest login
```

Expo hisobingiz bo‘lmasa, https://expo.dev/ saytidan bepul hisob yarating.

## 5. EAS loyihasini ulash

```powershell
npx eas-cli@latest project:init
```

Savollarga javob berilganda mavjud Expo hisobingizni tanlang. Agar EAS konfiguratsiyasi haqida so‘ralsa, loyiha yaratishga rozilik bering.

Agar `project:init` ishlamasa, quyidagini bajaring:

```powershell
npx eas-cli@latest build:configure
```

## 6. Telefonga o‘rnatiladigan APK yaratish

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Build serverda bajariladi. Tugagach terminal APK yuklab olish havolasini chiqaradi. Havolani brauzerda ochib `.apk` faylni yuklab oling va Android telefonga o‘rnating.

## 7. Play Store uchun AAB yaratish

Play Store’ga yuklash uchun:

```powershell
npx eas-cli@latest build --platform android --profile production
```

Bu buyruq `.aab` fayl yaratadi. Play Console’da yangi ilova ochib, hosil bo‘lgan AAB faylni yuklaysiz.

## 8. Build holatini ko‘rish

```powershell
npx eas-cli@latest build:list
```

Oxirgi build tafsilotlarini ko‘rish:

```powershell
npx eas-cli@latest build:view
```

## 9. Telefonda build qilmasdan sinash

```powershell
cd "C:\Users\User\Documents\ChatGPT\Xabarim Mobile\mobile"
npx expo start
```

Terminaldagi QR kodni telefondagi Expo Go ilovasi bilan skaner qiling. Telefon va kompyuter bir xil Wi-Fi tarmog‘ida bo‘lishi kerak.

## 10. Muhim sozlamalar

- Ilova nomi: `Xabarim`
- Android package ID: `uz.xabarim.mobile`
- Mobil ilova yuklaydigan sayt: `https://www.xabarim.uz/pages/app.html`
- APK profili: `preview`
- Play Store profili: `production`

## Muammolar bo‘lsa

`npm install` paytida jarayon uzoq vaqt o‘zgarmasa, internetni tekshiring va qaytadan bajaring:

```powershell
npm install
```

EAS login muammosida:

```powershell
npx eas-cli@latest logout
npx eas-cli@latest login
```

Build xatosida terminaldagi xato matnini saqlab oling va quyidagi buyruq bilan qayta urinib ko‘ring:

```powershell
npx eas-cli@latest build --platform android --profile preview
```
