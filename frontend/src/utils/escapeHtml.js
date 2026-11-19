// 문자열로 HTML을 만들어 document.write 하는 곳(인쇄 창)에서 값에 섞인 태그가 실행되지 않게 바꿔준다
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}
