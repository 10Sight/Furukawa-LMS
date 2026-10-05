import { authSession } from "./utils/authSession.js";
import { restoreSession } from "./context/state/slices/AuthSlice.js";
// import { StrictMode } from 'react'
import { registerSW } from 'virtual:pwa-register'

import { createRoot } from 'react-dom/client'
import { Toaster, toast } from 'sonner';
import "./styles/global.css"
import App from "./App.jsx"
import { Provider } from 'react-redux'
import store from "./context/state/store.js"
import AuthProvider from "./context/providers/AuthProvider.jsx"
import { SocketProvider } from "./context/SocketContext.jsx"

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    toast('A new version is available', {
      description: 'Reload to get the latest features and fixes.',
      duration: Infinity,
      action: {
        label: 'Reload',
        onClick: () => updateSW(true),
      },
    })
  },
})

const root = createRoot(document.getElementById('root'));
authSession.subscribe(() => store.dispatch(restoreSession()));
window.addEventListener('pagehide', () => authSession.disconnect());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) authSession.resume();
});

authSession.initialize().then(() => {
store.dispatch(restoreSession());
root.render(
  <Provider store={store}>
    <AuthProvider>
      <SocketProvider>
        <App />
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          expand={true}
          duration={4000}
          toastOptions={{
            style: {
              borderRadius: '12px',
              fontSize: '14px',
            },
          }}
        />
      </SocketProvider>
    </AuthProvider>
  </Provider>,
)
});
