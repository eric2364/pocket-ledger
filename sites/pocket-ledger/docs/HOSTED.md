# Owner-private hosted Wallet

This Worker is supported only on the confirmed **owner-private** Site. Sites dispatch handles ChatGPT browser sign-in and private service access. Browser record/sync/backup routes reject requests without the injected `oai-authenticated-user-id` header. Do not change audience to public or shared while this single-owner service is deployed.

## Durable storage

Declare logical `DB` D1 and `BUCKET` R2 bindings in the tracked hosting manifest, preserving the existing project ID. Sites provisions these resources. No cloud API keys appear in browser code.

- D1 `wallet_records` stores entity payloads and optimistic versions.
- R2 `archives/` retains original workbook and migration archives.
- `drizzle/0000_wallet.sql` is schema-only. `drizzle/meta/_journal.json` identifies its initial migration. Build copies these to `dist/.openai/drizzle`, matching Sites' migration convention. Sites applies migrations before uploading Worker code.
- Never run CREATE/ALTER TABLE in a request handler. Append new migrations for schema changes.

## Package

Export the main Expo application to `../../dist-web` first. From this Site checkout:

```sh
node --test tests/api.test.mjs
bash scripts/build.sh
node scripts/validate-artifact.mjs
```

Node's SQLite test fixture requires Node 22.13+ (or newer). The Worker starter has no runtime dependency. `embed-web.mjs` generates a single ESM file with all Expo assets, because this starter copies only `worker/index.js` and the hosting manifest. It rejects common private-data file names. Do not place any private file in `dist-web`.

The Site owner uses the supported Sites source synchronization and private deployment workflow. Keep its deployment credentials in session memory/stdin; never put them in source files, shell arguments or logs.

## API contract

- `GET /api/session`: `{authenticated:true}` for an authenticated owner.
- `GET /api/records?after=<id>&since=<ISO>&until=<ISO>`: up to 500 records plus a string `nextCursor` or null and `checkpoint`. Each record is `{id,entity,payload,version}`. First page captures current server time when `until` is omitted; reuse it for subsequent pages. Persist the checkpoint only after every page succeeds. Later pulls use inclusive `since`, allowing harmless replays of records saved exactly at the previous boundary. Timestamps must be canonical UTC ISO with milliseconds. Updates after the current upper bound are picked up by the next pull.
- `POST /api/sync`: `{records:[...]}`, at most 100. Returns `{results:[{id,status,version,remote?}]}`. `version:0` creates a new ID, positive versions update only the matching current version. Repeated identical contents acknowledge a lost response. Stale different content produces a conflict and preserves the remote record.
- `GET /api/backup`: restore-compatible `backupVersion:1`, records with JSON-string payloads and synced state, empty settings/conflicts and archive inventory as downloadable JSON. Device-only preferences and unresolved local conflicts are absent from cloud backups.
- `GET /api/archive`: archive inventory. `GET /api/archive?name=<safe-name>` downloads original bytes.
- `POST /api/import`: compact migration payload or `{records:[...]}`. Inserts missing IDs and retains all existing records, including edits. Repeat safely after partial failure. Large initial imports may be split into record batches.
- `POST /api/archive?name=<safe-name>`: raw file bytes, up to 30 MiB. Existing archive names are retained, not overwritten. Use checksum-based names.

Service initialization (`/api/import` and archive upload) may lack visitor headers because dispatch consumes the Site service token. These endpoints rely on the confirmed owner-private platform boundary. Browser mutations also reject a foreign Origin.

Financial source archives belong in R2 and initial records in D1, never in schema migrations or embedded assets. Backup JSON records can be restored via insert-only import into a new wallet; original files must also be restored separately.
