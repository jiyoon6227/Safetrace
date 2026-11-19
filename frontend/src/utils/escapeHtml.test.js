import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escapeHtml";

describe("escapeHtml", () => {
  it("태그와 따옴표, &를 글자로 바꾼다", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(escapeHtml(`<img src=x onerror='alert(1)'>`)).toBe("&lt;img src=x onerror=&#39;alert(1)&#39;&gt;");
    expect(escapeHtml("A&B")).toBe("A&amp;B");
  });

  it("이미 바꾼 &는 한 번만 바꾼다", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("일반 글자와 한글은 그대로 둔다", () => {
    expect(escapeHtml("대전광역시 유성구 · 침수 12건")).toBe("대전광역시 유성구 · 침수 12건");
  });

  it("숫자는 문자열로, null과 undefined는 빈 문자열로 바꾼다", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(0)).toBe("0");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("속성값 밖으로 빠져나가는 따옴표도 막는다", () => {
    const html = `<span title="${escapeHtml('" onmouseover="alert(1)')}">x</span>`;
    expect(html).toBe(`<span title="&quot; onmouseover=&quot;alert(1)">x</span>`);
  });
});
