# Personal cloud setup

The app works locally before cloud setup. Cloud storage has not been deployed automatically: it needs your own Supabase project.

1. Create a Supabase project in your preferred region.
2. Run `supabase/migrations/202610110001_wallet.sql` once through the SQL Editor, or apply it with the Supabase CLI. It creates private per-user wallet records, the conflict-checking save function and the private `wallet-private` file bucket.
3. In the app's Settings, enter the project's HTTPS URL and **publishable key** (or legacy anon key). Never use a secret or service-role key. Build-time environment variables are not required.
4. Create an account in the app. If email confirmation is enabled, confirm the email before signing in. The app uses email/password sign-in and does not require a browser redirect.
5. Import your migration JSON and tap Sync. The app uploads transactions, categories, modules, historical summaries, review records, source metadata and recurring templates. Import source archive files through the app's private file upload feature if exposed by your build.

## Storage and synchronization

Native iOS stores local records in SQLite and authentication tokens in SecureStore. The installed web app uses IndexedDB for records and browser localStorage for its session/configuration. Passwords are sent to Supabase only during sign-in and never persisted by the app. Keep the installed web app on a trusted device, use HTTPS, and export backups: a browser can evict local data even when persistence is requested.

Each local record has a stable ID, server version and visible synchronization status. The save RPC checks the expected version and serializes concurrent writes. Identical retried requests succeed without duplicate records. If another device has changed the same record, both versions are retained in local conflict storage; the app does not silently overwrite either. A concurrent local edit during upload remains pending. Synchronization covers all records, including those above the default server pagination limit. Device settings such as last-selected category remain local.

A wallet binds to the first account it synchronizes with. The app blocks syncing the same local wallet to a different user or changing a bound cloud project, preventing accidental mixing of private records. Switching accounts requires a separate wallet/reset flow with backup first.

Original workbook files are stored in the private bucket using a path beginning with your authenticated user ID. Downloads use short-lived signed URLs. Database row policies and file object policies only permit your own user. The mutation RPC derives user identity from the authenticated session, never a user ID supplied by the client.

## Preservation and backups

The original workbook remains on your computer. Its source hash and original cells are preserved by the migration importer. Repeating the same source import is a no-op; overlapping stable IDs preserve existing records. Soft deletion is reversible. Cloud deletion also retains a tombstone record, so it can propagate to other devices without resurrecting a transaction.

Download CSVs for analysis and the complete JSON backup for restoration. Back up the database and uploaded files separately: a database backup does not include actual Storage file bytes. A complete archive should contain the original workbook, migration data, current app backup and attached files. Keep at least one copy outside Supabase.

## Deployment verification

Before treating cloud setup as complete, verify with two separate test users that one cannot list the other's wallet records or private file paths. Then edit a test record independently on two devices and synchronize both: one should become a preserved conflict. Also simulate a lost response/retry and verify that the record ID appears only once. These checks require a live project and have not been run without your credentials.
