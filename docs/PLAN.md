# Personal Wallet implementation plan

## Outcome

Enter each financial event once on a phone. Reports, project totals and shared balances derive from those records. Keep all workbook source information and export CSV whenever Excel analysis is useful. The user chose iPhone installation through Safari Add to Home Screen, with private HTTPS hosting and no store submission.

## Architecture

- Expo / React Native / TypeScript phone application.
- IndexedDB for the selected web route; SQLite retained for native builds. Persistent outgoing change queue.
- Private Sites authentication, Cloudflare D1 records and R2 archives for the deployed app; optional Supabase implementation retained.
- Workbook migration tooling runs on the computer. Private generated data stays outside Git history and application bundles.
- GitHub tracks source, milestones, checks and installation instructions.

## Scope and acceptance

| Stage | Scope | Acceptance |
| --- | --- | --- |
| Workbook migration | Inventory every populated cell; immutable source archive, formulas and cached values; source references; normalized transactions; review queue; historical summaries | Reimport is idempotent; sheet coverage is complete; reconciliation differences are visible |
| Everyday entry | Expense, income, transfer, category, account, currency, date, reporting period, note, project and personal share | Save once and reports update; transfers/card settlements/repayments are excluded from expense/income totals |
| Offline/cloud | Persistent local entries, explicit sync states, retry-safe IDs, authenticated cloud records | Restart retains entries; retries create no duplicates; conflicting edits require resolution |
| Reports/export | Monthly/annual cashflow, categories, search, filtered transaction CSV and complete backup | Export handles Chinese text, commas and quotes; derived totals match exported records |
| Historical modules | Debt, travel, rent/coffee projects, cards, insurance, tax estimates and investment records | Imported source sections remain accessible, with ambiguities marked rather than fabricated |
| Personal installation | Private HTTPS PWA, manifest and offline cache; optional native profiles | Home-screen app installs and is tested on the user's iPhone |

## Convenience improvements

First: remember category/account, quick amount entry, favourites, duplicate entry, automatic reports, project tags, offline queue, search and CSV sharing.

Next: recurring confirmations, payment reminders, budgets, receipt attachments, fuller shared-payment workflows and module-specific editors.

Later: receipt extraction with review and bank-statement matching. Neither automatic financial imports nor OCR should silently create duplicate records.

## Financial invariants

- Transfers do not contribute to expense or income.
- Credit-card purchases are expenses; card repayments are transfers.
- Shared purchases retain paid amount and personal share separately.
- Debt repayments settle receivables/payables rather than count as earnings.
- Investment contributions are distinguishable from consumption.
- Historical source dates, original categories, reporting periods, FX rates and cell references remain recoverable.
- Summary formulas are evidence, not additional transactions.
- Money uses exact integer minor units or database decimals; calculation precision and rounding are explicit.

## Completion rule

The full Excel replacement is complete only after workbook reconciliation, all existing module data remains accessible, cloud backup/restore is tested and the home-screen app is tested on the chosen phone. See [PROGRESS.md](PROGRESS.md) for evidence and outstanding items.
