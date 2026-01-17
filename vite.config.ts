import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // === 关键修改 1：必须添加这个，否则打包后软件打开是白屏 ===
  base: './', 
  
  plugins: [
    react(),
    electron({
      main: {
        // === 关键修改 2：指向我们刚才创建的 .js 文件，而不是 .ts ===
        entry: 'electron/main.js',
      },
      // === 关键修改 3：因为我们没写 preload 脚本，先把这段注释掉，防止报错 ===
      // preload: {
      //   input: path.join(__dirname, 'electron/preload.ts'),
      // },
      
      renderer: process.env.NODE_ENV === 'test'
        ? undefined
        : {},
    }),
  ],
})
