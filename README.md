# Personal Wallet

A phone-first personal finance application replacing repeated spreadsheet entry. Add a record once and derive spending/income reports, project totals and exports from the same history.

The existing workbook is a private migration source. Do not commit it, generated imports, receipt images, database exports or credentials. Source-code releases contain no personal financial history.

## Start

```sh
npm ci
npm run typecheck
npm test
npx expo start
```

Install [Pocket Ledger](https://eric2364.github.io/pocket-ledger/) through Safari → Share → Add to Home Screen. Sign in with your existing Supabase account, as used by the weight-check app. [Phone installation](docs/INSTALL.md) covers setup and device checks. GitHub Pages serves public code; Supabase stores private records. Summary and original-file downloads require an additional password.

## Project records

- [Implementation plan and acceptance criteria](docs/PLAN.md)
- [Progress and outstanding setup](docs/PROGRESS.md)
- [Install on your phone](docs/INSTALL.md)
- [Preserve and import workbook history](docs/MIGRATION.md)
- [Connect private Supabase storage and synchronization](docs/SUPABASE.md)

Local tests and production exports can be checked with the commands above. Source-only GitHub publication is available at [pocket-ledger](https://github.com/eric2364/pocket-ledger). The published copy uses sanitized documentation and fresh history; this original workspace history must not be pushed. Inspect the Pages workflow for deployment status. Financial history stays outside source, GitHub and static bundles. Keep backups before uninstalling or changing accounts.
