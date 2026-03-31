// import { StrictMode } from 'react'
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true);
    }
  },
})

import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner';
import './index.css'
import App from './App.jsx'
import { Provider } from 'react-redux'
import store from './Redux/store.js'
import AuthProvider from './components/AuthProvider.jsx'
import { SocketProvider } from './contexts/SocketContext.jsx'

createRoot(document.getElementById('root')).render(
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
