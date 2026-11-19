import { describe, expect, it } from "vitest";
import { escapeCsv } from "./escapeCsv";

describe("escapeCsv", () => {
  it("일반 글자는 큰따옴표로 감싸고 안의 큰따옴표는 두 번 쓴다", () => {
    expect(escapeCsv("대전광역시")).toBe('"대전광역시"');
    expect(escapeCsv('a"b')).toBe('"a""b"');
  });

  it("null과 undefined는 빈 칸이 된다", () => {
    expect(escapeCsv(null)).toBe('""');
    expect(escapeCsv(undefined)).toBe('""');
  });

  it("=, +, -, @ 로 시작하는 글은 앞에 작은따옴표를 붙여 수식 실행을 막는다", () => {
    expect(escapeCsv("=HYPERLINK(\"http://evil\",\"x\")")).toBe('"\'=HYPERLINK(""http://evil"",""x"")"');
    expect(escapeCsv("+cmd|' /C calc'!A0")).toBe('"\'+cmd|\' /C calc\'!A0"');
    expect(escapeCsv("-2+3")).toBe('"\'-2+3"');
    expect(escapeCsv("@SUM(1+1)")).toBe('"\'@SUM(1+1)"');
  });

  it("탭이나 줄바꿈(CR)으로 시작하거나 공백 뒤에 수식이 오는 경우도 막는다", () => {
    expect(escapeCsv("\t=1+1")).toBe('"\'\t=1+1"');
    expect(escapeCsv("\r=1+1")).toBe('"\'\r=1+1"');
    expect(escapeCsv("  =1+1")).toBe('"\'  =1+1"');
  });

  it("수식 기호가 글 중간에 있으면 그대로 둔다", () => {
    expect(escapeCsv("강남 = 침수")).toBe('"강남 = 침수"');
    expect(escapeCsv("a+b")).toBe('"a+b"');
  });

  it("숫자와 숫자처럼 생긴 값(음수, 부호, 퍼센트)은 그대로 둔다", () => {
    expect(escapeCsv(-3)).toBe('"-3"');
    expect(escapeCsv(12)).toBe('"12"');
    expect(escapeCsv("-3")).toBe('"-3"');
    expect(escapeCsv("+12.5%")).toBe('"+12.5%"');
    expect(escapeCsv("-8.0%")).toBe('"-8.0%"');
    expect(escapeCsv("1,234")).toBe('"1,234"');
    expect(escapeCsv("-")).toBe('"-"');
  });
});
