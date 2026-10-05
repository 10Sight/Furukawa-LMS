# Admin frontend

React, Vite, Redux Toolkit, and RTK Query power the LMS admin frontend. Application pages are grouped by feature; role-specific screens live within those feature folders.

```text
src/
├── App.jsx                     # Application entry component
├── main.jsx                    # React bootstrapping and providers
├── sw.js                       # PWA service worker entry
├── assets/
│   ├── images/
│   ├── icons/
│   ├── logos/
│   └── fonts/
├── components/
│   ├── common/                 # Shared UI and reusable domain components
│   ├── layout/                 # Role layouts, shells, and sidebar composition
│   ├── navbar/                 # Reusable navigation controls
│   ├── sidebar/                # Reserved for standalone sidebar components
│   ├── forms/                  # Forms, input primitives, and filters
│   └── tables/                 # Table primitives and reusable spreadsheet UI
├── pages/
│   ├── dashboard/              # Admin, instructor, and student dashboards
│   ├── login/
│   ├── users/                  # Operators, instructors, roles, and contractors
│   ├── reports/
│   ├── courses/
│   ├── assessments/
│   ├── certificates/
│   ├── departments/
│   ├── dojo-hiring/
│   ├── skills/
│   ├── training/
│   ├── production/
│   ├── meetings/
│   └── ...                     # Attendance, requirements, account, and system pages
├── services/
│   ├── api/                    # RTK Query endpoints and generated hooks
│   └── requests/               # Axios clients and shared request adapters
├── hooks/                      # Reusable React hooks
├── integrations/               # Separately built CMS dashboard packages
├── context/
│   ├── providers/              # Authentication provider
│   └── state/                  # Redux store and slices
├── utils/                      # Formatting, exports, media, and spreadsheet engines
├── constants/                  # Navigation, monitoring, localization, and catalogs
├── routes/                     # Route configuration and access guards
└── styles/                     # Global and component styles
```

## Commands

```sh
npm install
npm run dev
npm run build
npm run check:structure
node --test src/utils/authSession.test.js
```

## Where new code belongs

- Put a complete screen under its feature in `pages/`. Use `admin/`, `instructor/`, `student/`, or `super-admin/` when a feature has role-specific screens.
- Put components used only by a feature in that feature's `components/` folder. Shared components belong in `components/`.
- Put all API endpoint definitions in `services/api/` and transport code in `services/requests/`.
- Keep Redux state in `context/state/`; keep providers in `context/`.
- Use the `@/` alias for imports across feature boundaries. Relative imports are appropriate within a feature.
- React component filenames use PascalCase; utilities and hooks use camelCase; feature folders use lowercase or kebab-case. Existing external API export names are preserved.

## Preserved behavior and build boundaries

`routes/AppRoutes.jsx` contains the existing 237 route declarations. URL paths, access guards, lazy loading, and layout composition are unchanged.

The active store is `context/state/store.js`. The existing alternative store is `context/state/variants/refetchStore.js`. Its department API invalidates query tags after meeting saves; the active API patches cached data and sends the loaded version. These are distinct implementations, so both are retained under explicit paths.

`public/` contains PWA icons, offline documents, and the separately built CMS dashboard served at stable public URLs. Application logos and photos live in `src/assets/`. Do not move generated CMS output into React source.

The sibling `portal/` package has another frontend entrypoint with pre-existing differences in authentication and several screens. Both entrypoints were organized, and those differences were preserved. The server, shared backend rules, and standalone CMS integration remain separate packages.

See [the organization guide](../../docs/architecture/project-structure.md), [the file-move manifest](../../docs/architecture/restructure-manifest.json), and [the validation report](../../docs/architecture/validation-report.json).
