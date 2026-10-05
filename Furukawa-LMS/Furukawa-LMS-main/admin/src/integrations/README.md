# Embedded integrations

- `fme-dashboard/` is the admin frontend's existing PTM, PDCA, and Process Audit integration.
- `fme-dashboard-root/` preserves the repository root's existing integration variant. Its PTM toolbar differs from the admin version.

Both packages retain their own React/Tailwind dependencies and build separately from the host. Their build scripts retain the existing output location at `admin/public/cms-dashboard/`, which the host serves at `/cms-dashboard/`.

To rebuild the admin version using the existing installed integration toolchain, run from `admin/`:

```powershell
node src/integrations/fme-dashboard/build.mjs "$PWD/src/integrations/fme-dashboard-root"
npm run build
```

For a fresh installation, run `npm ci` inside the chosen integration package and then `npm run build`. The host's Tailwind scanning excludes this directory to keep the integration's styling isolated.
