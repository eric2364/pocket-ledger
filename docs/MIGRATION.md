# Workbook migration

The importer reads the original workbook and verifies its SHA-256 before and after processing. It never saves or alters that workbook. Keep the original file as the authoritative binary archive: it retains formatting, embedded objects and Excel features that JSON cannot reproduce.

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/migrate_workbook.py "your-workbook.xlsx"
.venv/bin/python -m unittest discover -s tests/migration -v
```

Outputs are private and must remain ignored by Git:

- `private/migration.json`: complete import plus source cells with original values, formulas, cached values, comments, hyperlinks, number formats, hidden-sheet state and merged ranges.
- `private/import.json`: compact app import with transactions, categories, auxiliary module rows, historical summaries and review items.
- `private/migration-report.json`: reconciliation results and migration counts.

Mobile settings can import the compact JSON. IDs are derived deterministically from sheet and cell location. Same-file imports are a no-op for existing IDs. Revised imports add newly sourced IDs while keeping existing records and mobile edits; changing an existing source record requires explicit correction or conflict review. Manually entered mobile transactions use independent IDs. Do not assume that reimporting a revised workbook overwrites its older imported values.

Monthly expense columns B:D and income columns G:I are the primary ledger. Their category summary and annual reports are not new transactions. Original dates and the source reporting month are separate fields. Invalid dates remain null and appear in review items. Blank amounts remain in the source archive and review list rather than becoming zero-value purchases.

`Saving` exceptional expense/income cells become undated annual adjustments. Their reporting period is the year, with negative expense and positive income amounts. For the two years whose exceptional-expense sum includes the aggregate vehicle row, rows 28–31 remain archival detail and are excluded from the ledger. Auxiliary trip and purchase records stay in modules rather than becoming duplicate expenses. Some expenses may already overlap monthly records; review source context before changing their historical treatment.

Debt, travel, projects, cards, insurance, investments and tax records retain exact cell references and full populated row contents in `modules[].fields.cells`. They are source snapshots rather than inferred transfers, repayments or investment trades. Travel FX, inclusion flags, payer and split details are preserved with their original formulas and cached values. Monthly card and insurance snapshots retain their reporting periods.

Money uses integer cents with decimal half-up rounding. The original higher precision remains in the source archive. Monthly reconciliation includes both raw total versus cached total and the sum of rounded imported cents. Annual reconciliation reports the cents difference transparently; no balancing transaction is invented. Formulas use their saved Excel results and are not recalculated. Missing caches remain review items.

The original workbook and JSON files contain private financial information. Upload them only into a private storage bucket associated with the authenticated owner, and keep them out of GitHub and public build assets. Restoring from JSON restores records; retaining the original workbook is necessary for its original layout and objects.
