import { describe, expect, it, vi } from "vitest";
import {
  belongsToSido,
  buildRegionQueries,
  fetchDistrictMessages,
  isSidoWideMessage,
  mergeDisasterMessages,
  messageTimestamp,
} from "./disasterRegion";

describe("buildRegionQueries", () => {
  it("대전광역시 동구는 시/도+구, 구, 약칭+구, 시/도 순서의 후보를 만든다", () => {
    expect(buildRegionQueries("대전광역시", "동구")).toEqual({
      regionQuery: "대전광역시 동구",
      regionFallback: "동구",
      regionShortFallback: "대전 동구",
      regionSidoOnlyFallback: "대전광역시",
    });
  });

  it("구가 없는 세종특별자치시는 시/도명만 조회한다", () => {
    expect(buildRegionQueries("세종특별자치시", "")).toEqual({
      regionQuery: "세종특별자치시",
      regionFallback: null,
      regionShortFallback: null,
      regionSidoOnlyFallback: null,
    });
  });

  it("충청남도 당진시는 약칭 충남으로 재시도 후보를 만든다", () => {
    expect(buildRegionQueries("충청남도", "당진시")).toEqual({
      regionQuery: "충청남도 당진시",
      regionFallback: "당진시",
      regionShortFallback: "충남 당진시",
      regionSidoOnlyFallback: "충청남도",
    });
  });
});

describe("belongsToSido", () => {
  it("대전 동구 기준으로 부산 동구 문자는 제외한다", () => {
    expect(belongsToSido({ region: "대전광역시 동구" }, "대전광역시")).toBe(true);
    expect(belongsToSido({ region: "대전 동구" }, "대전광역시")).toBe(true);
    expect(belongsToSido({ region: "부산광역시 동구" }, "대전광역시")).toBe(false);
    expect(belongsToSido({}, "대전광역시")).toBe(false);
  });
});

describe("isSidoWideMessage", () => {
  it("콤마 목록에 시/도명이 정확히 있을 때만 시/도 전체 문자로 본다", () => {
    expect(isSidoWideMessage({ region: "강원도,경기도, 충청남도" }, "충청남도")).toBe(true);
    expect(isSidoWideMessage({ region: "충청남도" }, "충청남도")).toBe(true);
    expect(isSidoWideMessage({ region: "충청남도 당진시" }, "충청남도")).toBe(false);
    expect(isSidoWideMessage({ region: null }, "충청남도")).toBe(false);
  });
});

describe("messageTimestamp", () => {
  it("슬래시와 하이픈 형식의 CRT_DT를 같은 시각으로 읽는다", () => {
    const slash = messageTimestamp({ createdAt: "2026/09/12 10:00:00" });
    const hyphen = messageTimestamp({ createdAt: "2026-09-12 10:00:00" });

    expect(slash).toBe(new Date(2026, 8, 12, 10, 0, 0).getTime());
    expect(hyphen).toBe(slash);
  });

  it("값이 없거나 날짜가 아니면 0으로 처리한다", () => {
    expect(messageTimestamp({})).toBe(0);
    expect(messageTimestamp({ createdAt: "날짜 아님" })).toBe(0);
  });
});

describe("mergeDisasterMessages", () => {
  it("SN 또는 시각+지역+내용으로 중복을 지우고 최신순으로 정렬한다", () => {
    const district = [
      { sn: "1", createdAt: "2026/09/12 09:00:00", region: "대전광역시 동구", message: "A" },
      { createdAt: "2026/09/12 11:00:00", region: "대전광역시 동구", message: "B" },
    ];
    const sido = [
      { sn: "1", createdAt: "2026/09/12 09:00:00", region: "대전광역시 동구", message: "A" },
      { createdAt: "2026/09/12 11:00:00", region: "대전광역시 동구", message: "B" },
      { sn: "2", createdAt: "2026/09/12 10:00:00", region: "대전광역시", message: "C" },
    ];

    const merged = mergeDisasterMessages(district, sido);

    expect(merged.map((m) => m.message)).toEqual(["B", "C", "A"]);
  });

  it("목록이 비어 있거나 없어도 빈 배열을 돌려준다", () => {
    expect(mergeDisasterMessages(null, undefined)).toEqual([]);
  });
});

describe("fetchDistrictMessages", () => {
  it("결과가 0건일 때만 다음 후보로 넘어가고, 찾으면 멈춘다", async () => {
    const fetchByRegion = vi.fn(async (rgnNm) => {
      if (rgnNm === "동구") return [{ region: "부산광역시 동구", message: "다른 시/도" }];
      if (rgnNm === "대전 동구") return [{ region: "대전 동구", message: "약칭 결과" }];
      return [];
    });

    const result = await fetchDistrictMessages(fetchByRegion, buildRegionQueries("대전광역시", "동구"), "대전광역시");

    expect(fetchByRegion.mock.calls.map(([rgnNm]) => rgnNm)).toEqual(["대전광역시 동구", "동구", "대전 동구"]);
    expect(result.map((m) => m.message)).toEqual(["약칭 결과"]);
  });

  it("1차 조회에서 결과가 있으면 재시도하지 않는다", async () => {
    const fetchByRegion = vi.fn(async () => [{ region: "대전광역시 동구", message: "1차 결과" }]);

    await fetchDistrictMessages(fetchByRegion, buildRegionQueries("대전광역시", "동구"), "대전광역시");

    expect(fetchByRegion).toHaveBeenCalledTimes(1);
  });
});
