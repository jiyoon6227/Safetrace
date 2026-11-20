import { describe, expect, it } from "vitest";
import {
  flattenWeatherAlertRegions,
  splitWeatherAlertRegions,
  weatherAlertTypeLabel,
} from "./publicInfoUtils";

describe("splitWeatherAlertRegions", () => {
  it("쉼표, 세미콜론, 슬래시, 줄바꿈으로 구역을 나눈다", () => {
    expect(splitWeatherAlertRegions("서울, 인천;대전/부산\n광주")).toEqual(["서울", "인천", "대전", "부산", "광주"]);
  });

  it("괄호 안의 쉼표는 구역 구분으로 보지 않는다", () => {
    expect(splitWeatherAlertRegions("제주도(제주도산지, 추자도 제외), 울릉도.독도")).toEqual([
      "제주도(제주도산지, 추자도 제외)",
      "울릉도.독도",
    ]);
  });

  it("값이 비어 있으면 빈 배열이다", () => {
    expect(splitWeatherAlertRegions("")).toEqual([]);
    expect(splitWeatherAlertRegions(null)).toEqual([]);
  });
});

describe("weatherAlertTypeLabel", () => {
  it("풍랑주의보는 풍랑주의보로 표시한다", () => {
    expect(weatherAlertTypeLabel({ type: "풍랑", level: "주의보", title: "서해전해상 풍랑주의보" })).toBe("풍랑주의보");
  });

  it("폭풍해일과 황사 특보도 유형 이름을 그대로 표시한다", () => {
    expect(weatherAlertTypeLabel({ type: "폭풍해일", level: "경보", title: "부산 폭풍해일경보" })).toBe("폭풍해일경보");
    expect(weatherAlertTypeLabel({ type: "황사", level: "경보", title: "서울 황사경보" })).toBe("황사경보");
  });
});

describe("flattenWeatherAlertRegions", () => {
  it("같은 구역의 여러 특보는 한 줄로 합치고 괄호 안 쉼표로 구역이 갈라지지 않는다", () => {
    const rows = flattenWeatherAlertRegions([
      { region: "제주도(제주도산지, 추자도 제외)", type: "강풍", level: "주의보", title: "제주도(제주도산지, 추자도 제외) 강풍주의보", announcedAt: "202611210000" },
      { region: "제주도(제주도산지, 추자도 제외)", type: "건조", level: "주의보", title: "제주도(제주도산지, 추자도 제외) 건조주의보", announcedAt: "202611210000" },
      { region: "전북자치도 고창", type: "대설", level: "주의보", title: "전북자치도 고창 대설주의보", announcedAt: "202611210000" },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].region).toBe("제주도(제주도산지, 추자도 제외)");
    expect(rows[0].types).toEqual(["강풍주의보", "건조주의보"]);
    expect(rows[1].region).toBe("전북자치도 고창");
  });
});
