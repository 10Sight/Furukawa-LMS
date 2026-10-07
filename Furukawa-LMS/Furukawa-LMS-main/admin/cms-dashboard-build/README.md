# CMS dashboard modules

The module source now lives in the single admin source tree, split between `admin/src/pages` and `admin/src/components`. Dashboard build inputs and tooling live in `admin/cms-dashboard-build`; no source is nested in a second `src` directory:

| Folder | Responsibility |
| --- | --- |
| `ptm/` | Existing PTM components and forms |
| `pdca/` | Existing PDCA components, forms and browser persistence |
| `process-audit/` | Existing Process Audit views and forms |
| `man-machine-interlink/` | Existing hosted integration URL |
| `lpa/` | LPA page, workbook import/edit helpers and regression tests |
| `shared/` | CMS iframe adapter and shared form helpers |

The admin and portal frontends serve the same generated dashboard bundle. The module source is maintained once under `admin/src`; the build helper reads it from there and copies the output to both frontends.

## Rendering and navigation

PTM, PDCA and Process Audit retain their separately built, same-origin iframe at `/cms-dashboard/index.html?page=…`. This keeps their existing React and Tailwind toolchain isolated from the host. The CMS adapter in `admin/src/components/shared/FmeDashboardPage.jsx` forwards the current user context and form-view messages.

LPA is rendered by the CMS host from `admin/src/pages/lpa/LpaPage.jsx`, preserving its existing dashboard state, full-screen sheet controls and PDCA bridge. It is not added to the iframe entry point, which would change its existing host/router/store behavior.

Man-Machine Interlink retains its existing hosted URL, sidebar hyperlink and adapter behavior. Its URL is defined once in `admin/src/components/man-machine-interlink/integration.js`.

The existing CMS routes and navigation behavior are retained during this source reorganization. The standalone bundle continues to serve PTM, PDCA and Process Audit at `/cms-dashboard/index.html?page=…`; the LPA and Man-Machine Interlink module sources remain in their dedicated page and component folders.

## Storage dependencies

PTM, PDCA and Process Audit keep their existing frontend storage. PDCA receives the cached logged-in user, department and section context from the CMS host, without department/section API requests. Its existing standard department options remain available. Man-Machine Interlink retains its own hosted implementation.

LPA workbooks are saved in IndexedDB (`fme-cms-lpa`) on the current browser/origin and isolated by the cached CMS user ID. IndexedDB transactions preserve separate uploads and reject stale updates. Local LPA draft caches remain recovery aids. No LPA API or SQL dependency remains; existing server database records are not deleted or automatically migrated. Browser storage is not shared across devices and is removed if site data is cleared.

## Build and checks

From `Furukawa-LMS-main/admin`:

```powershell
node cms-dashboard-build/build.mjs
npm run build
node --test src/pages/lpa/lpaWorkbook.test.js src/pages/pdca/data/*.test.js src/components/shared/formPersistence.test.js
```

The integration build writes the same bundle to both frontend public directories. Existing generated assets are retained. From the `cms-dashboard-build` folder, `npm run build` builds the CMS bundle. Build the admin host from its own project directory as usual.
