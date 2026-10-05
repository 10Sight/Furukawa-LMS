# Furukawa LMS

All application files now live inside this folder. The outer workspace retains Git metadata.

```text
Furukawa-LMS/
├── Furukawa-LMS-main/
│   ├── admin/        # Main LMS frontend
│   │   └── src/integrations/  # Separately built CMS dashboards
│   ├── portal/       # Preserved former workspace-root frontend
│   │   ├── src/
│   │   ├── public/
│   │   ├── dist/
│   │   └── package.json
│   ├── server/       # Backend
│   ├── shared/       # Shared backend/frontend rules
│   └── nginx/        # Reverse proxy configuration
├── docs/             # Guides and restructuring audit
├── scripts/          # Shared structure validator and maintenance
├── logs/
└── .gitignore
```

The frontends have existing authentication and screen differences, so both remain separate packages. Their source folders follow the [organization guide](docs/architecture/project-structure.md). Environment files and frontend configuration remain with their corresponding application.

Run the former root frontend:

```sh
cd Furukawa-LMS-main/portal
npm install
npm run dev
npm run build
npm run check:structure
node --test src/utils/authSession.test.js
```

For the main admin frontend, use the same commands from `Furukawa-LMS-main/admin`. See its [frontend guide](Furukawa-LMS-main/admin/README.md).

When hosting the former root frontend on Vercel, set the project Root Directory to `Furukawa-LMS/Furukawa-LMS-main/portal` relative to the Git repository. Its existing build command, output directory, headers, and rewrites are preserved in `portal/vercel.json`.
