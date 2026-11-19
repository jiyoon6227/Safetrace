// CSV 한 칸 값 만들기. 엑셀이 =, +, -, @ (또는 탭·줄바꿈)으로 시작하는 글을 수식으로 실행하지 못하게 앞에 ' 를 붙인다.
// 숫자(-3, "+12.5%")와 값이 없다는 뜻의 "-"는 그대로 둔다.
const FORMULA_START = /^[\t\r]|^\s*[=+\-@]/;
const PLAIN_NUMBER = /^(?:[+-]?\d[\d,]*(?:\.\d+)?%?|-)$/;

export function escapeCsv(value) {
  let text = String(value ?? "");
  if (typeof value !== "number" && FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}
