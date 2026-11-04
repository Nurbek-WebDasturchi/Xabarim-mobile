# Xabarim Native

Expo and React Native application. The mobile interface uses native React Native components and does not render the web app in a WebView.

## Backend setup

By default, the app reads the existing public Supabase URL and anon key from `https://www.xabarim.uz/config.js`. For local development, you may create `.env` from `.env.example` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Never place a service-role key or Telegram bot token in the app. The client uses the existing Supabase Auth, `profiles` and `messages` tables, RLS policies and Realtime publication.

## Run

```sh
npm install
npx expo start
```

Press `a` in the Expo terminal or run `npm run android` to open Android. The Android preview APK build is configured with EAS (`npx eas-cli build --platform android --profile preview`).

## Implemented native features

- Username and password login and registration using the existing `${username}@xabarim.uz` convention.
- Encrypted session persistence through Expo SecureStore.
- Profile retrieval and editing, including follower/following statistics.
- Private text chat list, username search, conversation history, sending and read status.
- Realtime message updates from Supabase.
- Text posts, post reactions/comments, and 24-hour text notes.

Google OAuth, group/community screens, media uploads, push notification navigation, saved messages, and XCoin/Premium/Telegram flows still need migration. Those features are present in the web app but are not part of this native MVP.
# Xabarim Mobile releases

## Android install and in-app updates

Create the installable production APK with `npm run build:android`. Users install this APK once. Compatible JavaScript, screen layout, text, and bundled asset updates can then be published to the production channel with `npm run update:production -- --message "Describe the change"`. On app launch the app checks for an update and shows **Yangi versiya mavjud**; the user taps **Yangilash** to download and apply it.

The app uses Expo's `fingerprint` runtime policy. Native changes, app permissions, native dependencies, and SDK upgrades produce a different runtime and require a new APK. Publish native-dependent changes only with a build; EAS Update will target only builds with a matching runtime. To release a new APK, increment the app version in `app.json`, build it, and distribute the APK.

Use `npm run update:preview -- --message "Describe the change"` for updates to the preview channel. EAS CLI authentication and the linked EAS project are required to build or publish.
