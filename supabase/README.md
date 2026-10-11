# Private wallet backend

Deploy both SQL migrations in filename order, then deploy the `wallet-summary` Edge Function. `functions/wallet-summary/deploy.ts` is the single-file dashboard-editor version; `index.ts`, `crypto.mjs` and `backup.mjs` are the modular source. Regenerate the single-file version whenever any changes. The function's JWT gateway setting is disabled because the function verifies **every request** using Supabase Auth `getUser`; an anonymous key alone grants no access. Configure `WALLET_OWNER_ID` as a private Edge secret for a single-account wallet. Never put service credentials, imported records or archives in the code repository.

Generic authenticated clients use `wallet_records_safe` and `save_wallet_record`. They cannot read the base table, access Summary configuration, or write protected records. The view applies `auth.uid()` explicitly and replaces all protected payloads with locked placeholders. Direct original-file downloads are disabled by Storage policy. The Edge Function alone reads protected data and private files, always scoped to the verified owner's UUID.

## Edge API

POST `/functions/v1/wallet-summary` with `Authorization: Bearer <user access token>` and JSON:

- `{action:"status"}` → `{configured:boolean}`
- `{action:"setup",password,confirm}` → `{configured:true,records:[...]}`
- `{action:"unlock",password}` → `{configured:true,records:[...]}`
- `{action:"backup",password}` → restore-compatible `{backupVersion:1,createdAt,records:[...],settings:[],conflicts:[],archives:[...]}` including decrypted protected records
- `{action:"archives"}` → `{archives:[{name,size,uploaded}]}`
- `{action:"archive",password,key}` → file bytes, with a safe single filename

Setup/unlock record payloads are objects. Backup record payloads are JSON strings and their state is `synced`, matching the app restore format. Setup needs at least 10 characters. It encrypts all protected records atomically with AES-GCM using a PBKDF2 key and random salt/IV. ID and entity are authenticated encryption context. Summary passwords and plaintext keys are never persisted. Decrypted records belong in client memory only; clear them on lock/background. Password verification has a per-account attempt limit. A forgotten Summary password cannot be reset to recover encrypted records; preserve the original workbook securely.

Before setup, imported Summary rows remain private server plaintext, invisible through generic reads. Original archive bytes are preserved unchanged in private Storage and password-gated when downloaded; this does not encrypt archive objects themselves. Complete the private migration before allowing Summary setup. Later protected imports require a deliberate encrypted migration, not ordinary sync.

## Verification

`node --test supabase/tests/*.test.mjs` exercises real cryptography with synthetic records. Deployments must additionally verify SQL policies/RPC behavior on the live project: generic base-table SELECT denied, owner-only safe view, protected write/recast rejected, unauthenticated Edge denied, another account cannot read the owner, and direct archive download denied. These database checks are not covered by the crypto tests.
