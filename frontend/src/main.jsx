import { createRoot } from 'react-dom/client'
import './index.css'
import MainPage from './MainPage.jsx'
import SessionExpiryModal from './components/SessionExpiryModal.jsx'

// StrictMode 미사용 (개발 모드의 useEffect 2회 실행으로 호출량 제한 API 호출이 2배)
// StrictMode 사용 시:
// import { StrictMode } from 'react'
// createRoot(...).render(<StrictMode><MainPage /></StrictMode>)
//
// SessionExpiryModal은 MainPage 바깥에 독립 마운트 (MainPage가 페이지별로 조기 return)
createRoot(document.getElementById('root')).render(
  <>
    <MainPage />
    <SessionExpiryModal />
  </>,
)
