import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './ptm/index.css';

const PTMApp = lazy(() => import('./ptm/App.jsx'));
const PDCAApp = lazy(() => import('./pdca/App.jsx'));
const page = new URLSearchParams(window.location.search).get('page');
const label = { ptm: 'PTM', pdca: 'PDCA', 'process-audit': 'Process Audit' }[page];
document.title = label || 'FME CMS Pages';
// The source already reports worksheet/editor views. Modal forms also count,
// including forms portaled into document.body, without changing their logic.
let editorOpen = false;
let lastFormState;
const publishFormState = (force = false) => {
  const open = editorOpen || Array.from(document.forms).some(form => form.getClientRects().length > 0);
  if (!force && open === lastFormState) return;
  lastFormState = open;
  window.parent.postMessage({ type: 'fme-cms-form-view', page, open }, window.location.origin);
};
const onFormViewChange = open => { editorOpen = Boolean(open); publishFormState(); };
new MutationObserver(() => publishFormState()).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
window.addEventListener('message', event => {
  if (event.origin === window.location.origin && event.source === window.parent && event.data?.type === 'fme-cms-state-request') publishFormState(true);
});


createRoot(document.getElementById('root')).render(
  <Suspense fallback={
    <div className="grid min-h-screen w-full place-items-center" role="status" aria-label="Loading page">
      <div aria-hidden="true" className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
    </div>
  }>
    {page === 'pdca' ? <PDCAApp onFormViewChange={onFormViewChange} /> : label ? <PTMApp embedded cmsIntegration activeSection={page} onFormViewChange={onFormViewChange} /> : <p>Unknown CMS page.</p>}
  </Suspense>
);
