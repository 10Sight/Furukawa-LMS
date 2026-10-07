# Local demo mode

Both `Furukawa-LMS-main/admin` and `Furukawa-LMS-main/portal` support an isolated, read-only frontend demo. No database or backend process is needed for these demo screens.

From either frontend directory, put `VITE_DEMO_MODE=true` in `.env.demo`, then run `npm run dev:demo`. This workspace also has the flag in the ignored `.env.local`, so `npm run dev` enables it locally. Restart an existing Vite server after changing the flag.

Sign in with username `ST080014` and password `ST080014@FME`. This is a synthetic admin account. Sample operators, departments, courses, and dashboard metrics are supplied from `shared/demoData.js` through the normal Axios client and Redux login flow.

Demo mode is read-only. Screens without fixtures return an explicit unavailable response. Requests do not fall through to the real backend. No real account is created or altered, and these credentials do not authenticate against a production server. The demo adapter is disabled in production builds even if the flag is present.

To restore normal local backend requests, set `VITE_DEMO_MODE=false` in `.env.local` and restart Vite.

Run `node --test Furukawa-LMS-main/shared/demoData.test.mjs` from this project folder to check demo login, access control, and production isolation.
