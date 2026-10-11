# Install on your iPhone

Your chosen installation is Safari **Add to Home Screen**. No Apple Developer membership or computer is needed to use the deployed app.

1. Open [Pocket Ledger](https://YOUR-PRIVATE-SITE.chatgpt.site) in **Safari** on your iPhone.
2. Sign in with the same ChatGPT account that owns this project if prompted. The site is private to that account.
3. Tap **Share → Add to Home Screen → Add**.
4. Open the new icon. On first launch, keep an internet connection while your existing records download. The status should become **Synced**.
5. Add an expense once. Reports update from that record; no second Excel entry is needed. Use **History → Export CSV** when you want data in Excel.

The deployed version uses a private Cloudflare D1 database and R2 file archive through Sites. Supabase setup is unnecessary for this version. Original workbook files and migration archives are separate from application code. Settings provides cloud synchronization, backup downloads, original-file downloads and complete export.

The app caches its interface and keeps records in IndexedDB for offline entry after an initial online launch. Reconnect to synchronize. Clearing Safari/site data or removing the app can remove local records; synchronize and export a backup first. If authentication expires, reconnect and sign in again.

## Check on your phone

Safari installation and these physical-device checks still need your phone:

- Wait for **Synced**, find an existing transaction and open an original archive in Settings.
- Add an invented small expense, close/reopen the app, and confirm it appears once.
- After the initial online launch, try an offline entry, reconnect, and confirm synchronization.
- Export CSV and a full backup to Files, then delete the invented entry.

Automated checks and desktop browser checks passed; they do not establish that installation, offline caching or file sharing has been verified on your iPhone.

## Developer alternatives

For local work, run `npm ci`, `npm run typecheck`, `npm test`, then `npm run web`. Build the installable web assets with `npm run export:web`. Hosting source and tests are in `sites/pocket-ledger`; preserve the current private access policy when updating the deployment.

The optional Supabase backend is documented in [SUPABASE.md](SUPABASE.md). Native EAS profiles remain in `eas.json`; signed iPhone ad hoc distribution requires an Expo project, Apple signing and a registered device. They have not been provisioned and are not needed for the selected Safari route. Never include financial archives in source or build uploads.
