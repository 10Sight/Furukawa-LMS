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


class IntegrationErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('CMS Integration error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#334155' }}>
          <h2 style={{ color: '#e11d48', fontSize: '1.25rem', fontWeight: 'bold' }}>CMS Page Could Not Load</h2>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>An error occurred while loading this page:</p>
          <pre style={{ marginTop: '0.5rem', padding: '1rem', background: '#f1f5f9', borderRadius: '0.5rem', fontSize: '0.75rem', overflowX: 'auto' }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <IntegrationErrorBoundary>
    <Suspense fallback={
      <div className="grid min-h-screen w-full place-items-center" role="status" aria-label="Loading page">
        <div aria-hidden="true" className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    }>
      {page === 'pdca' ? <PDCAApp onFormViewChange={onFormViewChange} /> : label ? <PTMApp embedded cmsIntegration activeSection={page} onFormViewChange={onFormViewChange} /> : <p>Unknown CMS page.</p>}
    </Suspense>
  </IntegrationErrorBoundary>
);

