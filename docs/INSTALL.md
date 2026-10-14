# Install on your iPhone

1. Open [Pocket Ledger](https://eric2364.github.io/pocket-ledger/) in **Safari**.
2. Sign in using the same Supabase email and password as your weight-check app. ChatGPT sign-in is unnecessary. Each app stores its records separately.
3. Tap **Share → Add to Home Screen → Add**.
4. Open the new icon while online and wait for **Saved to cloud** before checking your existing records.
5. Add a transaction once. Reports update automatically; use **History → Export CSV** when you need Excel-compatible data.
6. Use **Settings → Quick add** to choose up to ten shortcuts. Entry dates use a calendar picker.
7. Open **Summary**, create its separate password if prompted, and unlock yearly summaries and original-file downloads.

GitHub Pages serves public application code. Personal records are stored in a private Supabase database and private file bucket, protected by authentication and ownership policies. No financial records, workbooks or credentials belong in the repository or static website files.

The app keeps records on your phone for offline entry after an initial online launch. Reconnect to synchronize. Signing out hides the wallet and locks Summary. Device records remain saved to avoid losing unsynchronized entries; the wallet stays bound to its original account. Synchronize and export a complete backup before clearing Safari data or removing the app.

## Check on your phone

- Wait for **Saved to cloud**, find an existing transaction and choose a year in Summary.
- Add an invented expense, close and reopen the app, and confirm it appears once.
- Try an offline entry, reconnect and check synchronization.
- Export CSV and a complete backup to Files, then delete the invented entry.
- Sign out and confirm the sign-in screen hides your wallet.

Automated and desktop checks do not replace installation and sharing checks on your physical iPhone.

## Developer builds

Use `npm ci`, `npm run typecheck` and `npm test` locally. Build with `EXPO_PUBLIC_BASE_PATH=/pocket-ledger`, `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, then `npm run export:web`. The key must be a publishable or legacy anon key, never an administrative key. The Pages workflow uses repository variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

Native signing is unnecessary for this Safari installation. Existing native EAS profiles and the earlier Sites implementation remain available for development, but neither is the current iPhone hosting path.
