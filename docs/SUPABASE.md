# Private cloud storage

The current iPhone app uses GitHub Pages for public code and Supabase for private data. It shares the Supabase authentication project with the weight-check app; sign in with the same email and password. Wallet tables and its file bucket remain separate from that app's records.

The production build supplies the project URL and publishable/anon key automatically. These are public connection settings, not administrative credentials. Authentication and server-side ownership policies protect the records. Never put a secret or service-role key in browser code, environment variables beginning `EXPO_PUBLIC_`, or GitHub.

## Backend deployment

Apply the SQL migrations under `supabase/migrations` in order. Deploy the `wallet-summary` Edge Function from `supabase/functions/wallet-summary`. Its administrative credential lives only in Supabase's server environment. Summary encryption uses Web Crypto AES-GCM and a password-derived key; the function verifies the signed-in user before every action.

Ordinary synchronization calls `save_wallet_record`, which validates the expected server version and rejects protected Summary writes. Downloads use the ownership-filtered `wallet_records_safe` view, which returns placeholders for protected records. Direct reads of the underlying table and direct downloads from the private archive bucket are denied. The Summary function lists archive metadata and requires the separate Summary password before returning protected records, a cloud backup or original file bytes.

For a source-only deployment, configure GitHub repository variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`, enable Pages from GitHub Actions and run the Pages workflow. Do not upload migration payloads, databases, workbook files, private screenshots or financial histories to GitHub.

## Synchronization and device storage

The web app stores ordinary records in IndexedDB and its Supabase session in browser storage. Login and Summary passwords are not persisted by app code. Native builds use SQLite for records and SecureStore for authentication tokens. Keep the app on a trusted phone.

Stable record IDs and server versions prevent duplicate retried entries. Concurrent edits retain both versions for review. Downloads paginate through all records, and pending local edits survive cloud refresh. The device wallet binds to the first synchronized account and rejects other users to prevent accidental mixing. Signing out clears visible wallet state and locks Summary without discarding pending local entries.

## Preservation and exports

Original workbook files and cell archives remain private and unchanged. Mobile records preserve reporting periods, source references and unresolved review items. Summary source snapshots are read-only; current transactions drive reports and CSV exports.

Use **Summary → Download complete app backup** to include local records, pending edits, local settings, conflicts and unlocked summary records. A cloud-only backup contains the current cloud records in the same restorable JSON format, with empty device settings and conflicts. CSV export produces Excel-compatible tables; backups preserve the full record payloads. Archive files are downloaded separately because database backups do not contain Storage file bytes.

Keep a backup outside Supabase. A forgotten Summary password cannot decrypt protected records; retain the original workbook privately.
