import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    rolldownOptions: {
      output: {
        // 라이브러리는 따로 묶어 둔다: 앱 코드가 바뀌어도 브라우저가 라이브러리 파일을 다시 받지 않고,
        // 아이콘이 페이지마다 수십 개의 작은 파일로 쪼개지는 것도 막는다.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/ },
          ],
        },
      },
    },
  },

  // 개발 중에는 프론트(5173/5174)에서 /api, /uploads, /ws 요청을
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
      // socket.js가 현재 페이지 origin(window.location) 기준으로 ws:// URL을 만들기 때문에,
      // 로컬에서도 배포 때와 똑같이 동작하려면 /ws도 여기서 8080으로 넘겨줘야 한다.
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})