# Protected summary and reconciliation

Open Summary in the deployed private app and create a password of at least ten characters. Enter it only in the app. The password is kept in browser memory for the current unlocked visit; it is not written to IndexedDB, source, GitHub or application logs. Setup encrypts stored summary records with AES-GCM and PBKDF2; the server enforces protection for summary data, backups and original archive downloads. Cryptographic operations use [Cloudflare's Web Crypto API](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/).

Summary automatically locks when leaving the tab, backgrounding the app, hiding the browser or after five minutes. An online connection is required to unlock it. Ordinary transaction entry and its offline storage remain separate. Summary source snapshots are read-only, and updated mobile entries drive current reports.

The view provides annual income, spending and savings; original annual saving figures and rounding differences; monthly income and spending; monthly income categories; annual expense category ranking; original tax and investment summary detail; and workbook-versus-app reconciliation. Categories are grouped without letter case for Excel-style matching, while original spellings remain preserved.

Reconciliation compares gross monthly income, expense and net totals, entry counts and category amounts against an immutable workbook baseline. It distinguishes added, edited and deleted entries. Personal share spending is shown separately. Source reporting months remain authoritative even where the original dates differ. Blank-amount templates are review items, not fabricated zero-value expenses. Missing baselines or missing conversions never report a successful match.

Use the export and original-file controls inside the unlocked Summary. Exports intentionally contain readable personal data; keep them private. Original archive bytes remain unchanged in private R2 storage and downloads require the Summary password. Summary encryption does not encrypt ordinary transaction records or the original workbook archive itself.

Set a password before relying on encryption at rest: existing summary rows remain owner-private and hidden from generic APIs before setup, then are encrypted atomically during setup. A forgotten password cannot recover encrypted summary data; retain the original workbook privately. There is no automatic password reset or password-change workflow in this release.

Older synchronized summary caches are redacted. Unsynchronized local edits are retained for recovery, hidden from ordinary views and excluded from generic sync. Complete app backup after unlocking preserves those local edits. They are not automatically merged into read-only original summary snapshots.

Generated reconciliation payloads, source audits, screenshots and financial values remain under private/ and never enter GitHub. Source-only updates retain the established sanitized publication boundary.
