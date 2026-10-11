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

Open your deployed private Site URL. On your iPhone, open it in Safari, sign in with the owner’s ChatGPT account, then choose Share → Add to Home Screen. Follow [phone installation](docs/INSTALL.md) for first-launch and device checks. Cloud records use private D1/R2 storage; no Supabase setup is needed for this deployment.

## Project records

- [Implementation plan and acceptance criteria](docs/PLAN.md)
- [Progress and outstanding setup](docs/PROGRESS.md)
- [Install on your phone](docs/INSTALL.md)
- [Preserve and import workbook history](docs/MIGRATION.md)
- [Connect private Supabase storage and synchronization](docs/SUPABASE.md)

Local tests and production exports passed. GitHub workflows validate source and bundles. Financial history stays outside source, GitHub and static bundles. Keep backups before uninstalling or changing accounts.
