# Frontend organization

The main frontend is `Furukawa-LMS-main/admin/`. The existing directory spelling is retained. Its [README](../../Furukawa-LMS-main/admin/README.md) explains each folder and the development commands.

The former workspace-root frontend now lives in `Furukawa-LMS-main/portal/`. It remains a separate build entrypoint because its authentication and several screen implementations differ from the admin application. All project files are under `Furukawa-LMS/`; only Git metadata remains at the outer workspace root. Shared documentation and scripts live beside `Furukawa-LMS-main/`. Frontend environment files, configuration, static resources, and generated output live with their corresponding package.

Integration packages live in `Furukawa-LMS-main/admin/src/integrations/`. `fme-dashboard/` retains the admin version, while `fme-dashboard-root/` retains the original root version. Their build output remains at the existing `admin/public/cms-dashboard/` URL boundary. The former root and admin-level `integrations/` folders have been removed.

## Migration decisions

- Pages are grouped by feature, with role-specific subfolders where needed.
- Component placement was based on imports and transitive page consumers. Components used by one feature live alongside that feature; components shared across features remain reusable UI.
- The old `Redux/` and `store/` trees were consolidated into `services/api/` and `context/state/`.
- `Layout/` compatibility exports now point directly to the implementations in `components/layout/`.
- `Helper/` and `lib/axios/` are consolidated into `services/requests/`.
- Navigation registries, monitoring configuration, translations, and spreadsheet catalogs live in `constants/`.
- Spreadsheet evaluation engines and helper functions live in `utils/spreadsheets/`; their React UI lives in `components/tables/spreadsheet/`.
- Route guards live in `routes/guards/`, and the existing route tree lives in `routes/AppRoutes.jsx`.
- Styles were moved into `styles/`, including editor and slide CSS. Tailwind scanning exclusions were adjusted relative to the moved global stylesheet.
- Application logo and plant image files were moved into `assets/logos/` and `assets/images/`. JSX, generated HTML, exported reports, and the favicon now reference those assets through Vite.
- Developer documentation lives in `docs/`; the existing one-off sheet editing utility lives in `scripts/maintenance/`.

Each frontend originally contained 538 source files. The migration consolidated 82 transparent wrappers or equivalent implementations per frontend. The file-move manifest accounts for every original source file, including files consolidated into another implementation.

The department API variants are intentionally retained because their cache and concurrency behavior differs. The active application's imports continue to select the active API and store. The namespace configuration adapters in `constants/monitoring/compatibility/` retain their existing default-export contract.

## Validation

Run `npm run check:structure` from either frontend. The validator checks both source trees for missing destinations, unresolved relative/alias imports, invalid named/default imports, identical duplicate modules, and unexpected changes to module logic. Module logic is compared with syntax-tree fingerprints recorded during the migration, excluding import locations. Resource relocations are recorded separately because they add asset imports and replace legacy resource URLs.

Production builds validate the application's reachable code, CSS, assets, lazy page imports, and PWA service worker. Authentication tests cover both frontend entrypoints. The existing 237 route declarations are preserved in each application.

When deliberately editing application behavior later, update or retire the migration fingerprints as part of that reviewed change; they are a restructuring audit, not a restriction on future feature work.
