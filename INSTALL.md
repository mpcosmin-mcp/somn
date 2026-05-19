# Install somn

Three ways to put somn on a device, ordered from easiest to most "official".

## 1. PWA install — desktop + Android (Chrome / Edge / Brave)

Open https://somn-xi.vercel.app, then:

- **Desktop**: address-bar shows a ⊕ install icon → click → "Install". Or use the in-app `↓` button in the top bar / the floating prompt.
- **Android Chrome**: tap the in-app "Instalează" banner on the login screen, OR Chrome menu → "Install app" / "Add to Home Screen".

The installed app launches in its own window, no browser chrome, with the moon icon. Updates ship automatically the next time the app opens.

## 2. PWA install — iPhone / iPad (Safari)

iOS doesn't have a native prompt, so it's manual:

1. Open https://somn-xi.vercel.app in **Safari** (not Chrome — Chrome on iOS can't install PWAs).
2. Tap the **Share** icon in the Safari toolbar.
3. Scroll down in the share sheet and pick **Add to Home Screen**.
4. Confirm with **Add** in the top right.

The login banner explains this when it detects you're on iOS Safari.

## 3. Real Android APK (via PWABuilder · TWA)

For a sideloadable `.apk` or a Play Store listing, wrap the PWA in a Trusted Web Activity using [pwabuilder.com](https://www.pwabuilder.com):

1. Open https://www.pwabuilder.com.
2. Paste `https://somn-xi.vercel.app` → **Start**.
3. PWABuilder scans the manifest + service worker and shows a score. We expect ≥ 90 because we ship:
   - `public/manifest.json` with `name`, `short_name`, `description`, `id`, `scope`, `start_url`, `display=standalone`, `theme_color`, `background_color`, three icons (SVG + 192 PNG + 512 PNG), and the `health / lifestyle / productivity` categories.
   - `public/sw.js` — minimal service worker (precaches the shell, network-first navigations, stale-while-revalidate static, skips `/api/*`).
4. Click **Package for Stores → Android**.
5. Choose either:
   - **Signed APK**: download immediately, sideload onto any device (enable "Install unknown apps" for the source on Android).
   - **Signed AAB**: upload to Google Play Console — needs a $25 one-time developer account.
6. The output ships the PWA as a real Android app with its own icon and splash screen. Updates flow automatically because the TWA renders the live URL — no APK rebuild needed for content changes.

### Notes on TWA
- Digital Asset Links: PWABuilder generates an `assetlinks.json` for you. Drop it at `public/.well-known/assetlinks.json` and redeploy so Android verifies the app↔site link and hides the URL bar in the TWA. Without this the address bar shows under the title.
- App name + version: PWABuilder asks for these at packaging time. Keep `name = somn`, bump the version each time you publish.

## 4. iOS App Store

Not currently planned. PWAs work well enough on iOS via Safari, and a TWA equivalent doesn't exist for iOS. If we ever want a native iOS build, the path is Capacitor (`@capacitor/cli`) wrapping the same web bundle, then signing through an Apple Developer account ($99/year).

## Troubleshooting

- **No install icon on Chromium**: hard reload (`Ctrl/Cmd + Shift + R`). The service worker is registered only in production, so `localhost` won't fire the install prompt — try the deployed URL instead.
- **Already installed but want to re-install**: in Chrome → `chrome://apps` → right click somn → Remove. Or on the launched app: menu → Uninstall.
- **Manifest changes not picked up**: PWAs cache aggressively. Bump the `CACHE` constant in `public/sw.js` (currently `somn-v1` → `somn-v2`) so old caches get cleared on the next visit.
