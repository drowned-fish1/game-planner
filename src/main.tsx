import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toaster } from './components/Toaster'
import { ConfirmHost } from './components/ConfirmHost'
import { LocaleProvider } from './i18n/LocaleProvider'
import { initTheme } from './utils/theme'
import './index.css'

initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocaleProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <Toaster />
      <ConfirmHost />
    </LocaleProvider>
  </React.StrictMode>,
)

// Use contextBridge
window.electronAPI?.on('main-process-message', (message) => {
  if (import.meta.env.DEV) console.log(message)
})
