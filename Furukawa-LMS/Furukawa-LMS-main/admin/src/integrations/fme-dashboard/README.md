# FME Dashboard integration in CMS

CMS exposes **PTM → PDCA → Process Audit** at `/cms/ptm`, `/cms/pdca` and `/cms/process-audit`. Its sidebar uses actual hyperlinks with `target="_blank"` and `rel="noopener noreferrer"`. The new tabs retain the existing CMS layout and authentication. The page registry retains normal restrictions; assign `cms-ptm`, `cms-pdca` and `cms-process-audit` to restricted roles as needed.

The source folders were copied from `D:/FME Dashboard/src`. The original project was not modified. The integrated pages run in a same-origin iframe with a separately built bundle under `admin/public/cms-dashboard`. No second dashboard server is required. This preserves the source project's React/router/icon versions and Tailwind 3 styles, without affecting the host's React dependencies or Tailwind 4 styles. Host CSS scanning explicitly excludes these source and generated folders.

## Essential adaptations

- PTM's existing `embedded` mode hides its sidebar. An integration flag hides its redundant top navbar; the existing list and form export controls remain.
- PDCA retains its provider and route patterns inside a HashRouter. Its embedded layout hides the separate sidebar and navbar. The navbar's all-records export remains available as **Export All Records**, alongside the existing filtered export.
- PDCA copy links point to `/cms/pdca?sheet=<id>`. A small route observer synchronizes the parent URL, so shared sheet links and refresh return to the same sheet.
- Process Audit continues to use PTM's existing Process Audit view, including its original tabs, forms and unit selection.
- The forms, validators, storage handlers, worksheets, attachments, data and business logic remain in the copied source components.

The source uses client-side data, localStorage and sessionStorage. These keys and behaviors remain unchanged on the CMS origin. Browser data on a different original-dashboard origin is not automatically migrated or overwritten. The original PDCA provider keeps dashboard additions in memory, as before; this integration does not introduce backend persistence.

## Build

The generated bundle is included, so the normal `admin` build and dev server serve the pages immediately.

To rebuild after changing the integration source:

```powershell
cd admin/src/integrations/fme-dashboard
npm ci
npm run build
cd ../../..
npm run build
```

Alternatively, use the original project's already installed, locked toolchain without changing that project:

```powershell
node build.mjs 'D:\FME Dashboard'
```

The build checks its output path and replaces only the generated `admin/public/cms-dashboard` directory. Deploy the entire `admin/dist` directory, including `cms-dashboard`; retain the existing SPA fallback for CMS URLs.

## Validation

- Both the isolated dashboard build and host CMS build pass, with bundle-size warnings.
- Browser clicks opened all three correct URLs in new tabs while `/cms` stayed open with its existing records.
- Unit selection and PTM search filtered the original records; PTM form editing, undo and Save were verified, restoring the sample value.
- PDCA required-field validation, editing, Back, copied links and sheet refresh were verified. Existing export handlers remain; the in-app browser did not expose a downloadable file to its download-event API.
- Procedure, Auditor List, Auditor Plan, Process Audit Check Sheet and NC List views rendered their existing records. The procedure worksheet opened correctly.
- One CMS sidebar and header were present around the embedded pages. The default narrow viewport was verified; its existing mobile sidebar overlay behavior remains unchanged.

No real records were deleted, and no external messages or uploads were sent during validation.

## Full-screen forms

Opening a PTM matrix, PDCA sheet, any Process Audit editor or an add-form dialog hides both the host CMS sidebar and navbar. The iframe fills the viewport without the dashboard card padding or sidebar margin. Back and Cancel restore the CMS layout. The source form-view callbacks and visible HTML modal forms drive a small same-origin state bridge; the host verifies the message origin, iframe window and page.

Verified: PTM matrix, PDCA deep-linked sheet, audit procedure and check-sheet editor, plus add dialogs on all three pages. Host navigation counts are zero in form mode and restore to one sidebar and one navbar when returning to lists. Both builds pass, and the new host adapter passes its ESLint check.
