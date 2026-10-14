# Protected annual summary

Open Summary in the signed-in app and create any non-empty password, with no length or character rules. Enter it only in the app. The password is kept in browser memory for the current unlocked visit; it is not written to IndexedDB, source, GitHub or application logs. Setup encrypts stored summary records with AES-GCM and PBKDF2; the server enforces protection for summary data, backups and original archive downloads. The Supabase Edge Function performs encryption using Web Crypto; no administrative credential is sent to the phone.

Summary remains unlocked for ten elapsed minutes, including time spent on other tabs or with the app in the background. Reloading, signing out, manual Lock or expiry clears the in-memory unlock. Background time counts toward expiry; returning to the app must check the deadline. An online connection is required to unlock it. Ordinary transaction entry and its offline storage remain separate. Summary source snapshots are read-only, and updated mobile entries drive current reports.

The view opens with a year selector and annual net savings, income and spending. It includes annual income categories and a twelve-month breakdown; expense category details are omitted. Undated annual adjustments are shown separately from the months and included in the annual total. Foreign-currency records without a stored HKD amount are identified as excluded from HKD totals; separate annual totals show their recorded currency. No automatic currency conversion is suggested. Displayed monetary amounts use accounting formatting: grouped thousands, parentheses for negatives and a dash for zero, with aligned tabular digits. Editing amounts and CSV values retain their numeric format.

The annual view has no workbook-versus-app comparisons, reconciliation actions or difference columns. Imported baselines, source references and review records remain preserved for backups and exports. Original workbook figures and tax/investment source cells remain available inside an optional original-details section. Category names are shown and grouped in uppercase. Original spellings remain preserved in source data and originalCategory. Source reporting months remain authoritative even where original dates differ. Blank-amount templates remain review records rather than fabricated purchases.

Use the export and original-file controls inside the unlocked Summary. Exports intentionally contain readable personal data; keep them private. Original archive bytes remain unchanged in private Supabase Storage and downloads require the Summary password. Summary encryption does not encrypt ordinary transaction records or the original workbook archive itself.

Set a password before relying on encryption at rest: existing summary rows remain owner-private and hidden from generic APIs before setup, then are encrypted during password setup. A forgotten password cannot recover encrypted summary data; retain the original workbook privately. There is no automatic password reset or password-change workflow in this release.

Older synchronized summary caches are redacted. Unsynchronized local edits are retained for recovery, hidden from ordinary views and excluded from generic sync. Complete app backup after unlocking preserves those local edits. They are not automatically merged into read-only original summary snapshots.

Generated reconciliation payloads, source audits, screenshots and financial values remain under private/ and never enter GitHub. Source-only updates retain the established sanitized publication boundary.

## Horizontal comparisons

Summary opens with **Yearly comparison**: choose an ending year and 1–10 years. Years run left to right; income, expenses, net saving and annual/ad hoc items run down the rows. **Monthly salary** allows an ending month and 1–36 months, with selectable income categories so salary is not confused with unrelated income. These tables scroll sideways while row labels remain visible. **Year details** retains the individual-year reports and original workbook references.

Comparisons use the same saved transactions and recorded HKD equivalents as existing reports. No new transactions or automatic currency conversions are created. Annual adjustments remain in year totals; undated annual items are not assigned to a fabricated month. Zero amounts appear as an accounting dash; missing recorded HKD amounts are explicitly flagged.

## Add annual or ad hoc items

1. Unlock **Summary** and choose **Annual & ad hoc**.
2. Select the year and tap **Add yearly item**.
3. Choose Income or Expense, then enter the amount, category and description. Keep **Yearly item** selected and choose its reporting year.
4. Save and wait for **Saved to cloud**.

A yearly item belongs to the whole year, with no fabricated monthly date. It appears in annual totals and the annual/ad hoc list, but not in an individual month's totals. Tap an existing item to edit it. Do not add it again as a monthly transaction. Imported annual adjustments retain their signed amounts, source references and reporting year. These ledger items use the wallet's normal private cloud storage; they are not encrypted original-summary snapshots.

## Card payments

The separate Card payments tab lists recorded card settlements and the original monthly workbook card references. Record a payment with its date, card/account and amount. Settlements use the card_payment type and are excluded from expenses so purchases are not counted twice. Imported workbook snapshots remain references and are not automatically treated as new payment transactions.
