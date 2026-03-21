/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer
  electronAPI?: {
    minimize: () => void
    maximize: () => void
    close: () => void
    send: (channel: string, data?: unknown) => void
    sendSync: (channel: string, data?: unknown) => unknown
    invoke: <T = unknown>(channel: string, data?: unknown) => Promise<T>
    on: (channel: string, listener: (...args: unknown[]) => void) => (() => void) | void
  }
}
