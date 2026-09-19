import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // 개발 중에는 프론트(5173/5174)에서 /api, /uploads 요청을
  // Spring Boot(8080)로 넘긴다.
  // 이 proxy 설정은 Vite 개발 서버에서만 사용되고 production build에는 포함되지 않는다.
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})