import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toaster } from './utils/toast'
import { ConfirmHost } from './utils/confirm'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <Toaster />
    <ConfirmHost />
  </React.StrictMode>,
)

// Use contextBridge
window.electronAPI?.on('main-process-message', (message) => {
  console.log(message)
})
