import { createRoot } from 'react-dom/client'
import './index.css'
import MainPage from './MainPage.jsx'
import SessionExpiryModal from './components/SessionExpiryModal.jsx'

// StrictMode를 빼놨음 - 켜놓으면 개발 모드에서 useEffect가 일부러 2번씩 실행돼서
// 재난문자 API(safetydata.go.kr, 하루 100건 제한)처럼 호출량 제한 있는 API를 테스트할 때
// 실제 호출이 배로 나가버림. 개발 다 끝나고 다시 켜고 싶으면 아래처럼 되돌리면 됨:
// import { StrictMode } from 'react'
// createRoot(...).render(<StrictMode><MainPage /></StrictMode>)
//
// SessionExpiryModal은 MainPage와 나란히 독립적으로 마운트. MainPage.jsx가 page별로 여러 곳에서
// 일찍 return하는 구조라 MainPage 내부 어딘가에 끼워넣으면 특정 페이지에서만 동작하게 됨 -
// 그래서 바깥에서 한 번만 띄워서 어느 페이지에 있든 항상 감시하게 함.
createRoot(document.getElementById('root')).render(
  <>
    <MainPage />
    <SessionExpiryModal />
  </>,
)
