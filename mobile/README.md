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
