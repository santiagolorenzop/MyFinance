# iPhone installation

MyFinance is an installable Progressive Web App. It is **not** distributed through the Apple App Store.

## Install from Safari

1. Open the site in **Safari** on your iPhone (HTTPS required outside localhost).
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Confirm the name and tap **Add**.
5. Open the app from the new Home Screen icon.

In standalone mode the app should feel like a native application (no Safari chrome).

## Offline use

After the first successful load (and service worker install), essential features work without internet. Financial data is stored locally in IndexedDB on the device.

## Notes

- Use Safari for “Add to Home Screen” reliability on iOS.
- Local browser storage is not infallible—use backups periodically when that feature ships (Phase 8).
- The in-app install guide is available at **Settings → Install on iPhone**.
