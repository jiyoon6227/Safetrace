import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client", () => ({ authFetch: vi.fn() }));

import { authFetch } from "../../api/client";
import { fetchAirQualityStable } from "./publicInfoApi";
import { SIDO_REGIONS } from "./publicInfoConstants";

const air = (pm10, pm25) => ({
  available: true,
  pm10,
  pm25,
  pm10Grade: "보통",
  pm25Grade: "보통",
});

const payloadFor = (build) => Object.fromEntries(SIDO_REGIONS.map((region, index) => [region.sido, build(region, index)]));

describe("fetchAirQualityStable", () => {
  beforeEach(() => {
    authFetch.mockReset();
  });

  it("전국 대기질을 한 번만 요청하고 17개 시도 행을 순서대로 만든다", async () => {
    authFetch.mockResolvedValue(payloadFor((_, index) => air(30 + index, 15 + index)));

    const rows = await fetchAirQualityStable([]);

    expect(authFetch).toHaveBeenCalledTimes(1);
    expect(authFetch).toHaveBeenCalledWith("/api/environment/air-quality/nationwide");
    expect(rows).toHaveLength(17);
    expect(rows.map((row) => row.sido)).toEqual(SIDO_REGIONS.map((region) => region.sido));
    expect(rows[0]).toEqual({ ...SIDO_REGIONS[0], ...air(30, 15), available: true });
    expect(rows[16]).toEqual({ ...SIDO_REGIONS[16], ...air(46, 31), available: true });
  });

  it("조회 불가 지역은 이전에 성공한 값을 유지하고 나머지는 새 값을 쓴다", async () => {
    const previous = [{ ...SIDO_REGIONS[1], ...air(80, 40), available: true }];
    authFetch.mockResolvedValue(
      payloadFor((region) => (region.sido === SIDO_REGIONS[1].sido
        ? { available: false, message: "대기질 서버 응답이 지연되고 있습니다." }
        : air(20, 10)))
    );

    const rows = await fetchAirQualityStable(previous);

    expect(rows).toHaveLength(17);
    expect(rows[1]).toEqual({ ...SIDO_REGIONS[1], ...air(80, 40), available: true, cachedFallback: true });
    expect(rows[0]).toEqual({ ...SIDO_REGIONS[0], ...air(20, 10), available: true });
    expect(rows.filter((row) => row.cachedFallback)).toHaveLength(1);
  });

  it("이전 값이 없는 조회 불가 지역은 결과에서 빠진다", async () => {
    authFetch.mockResolvedValue(
      payloadFor((region) => (region.sido === SIDO_REGIONS[2].sido ? { available: false } : air(20, 10)))
    );

    const rows = await fetchAirQualityStable([]);

    expect(rows).toHaveLength(16);
    expect(rows.some((row) => row.sido === SIDO_REGIONS[2].sido)).toBe(false);
  });

  it("응답에 없는 시도도 조회 불가로 보고 이전 값을 유지한다", async () => {
    const previous = [{ ...SIDO_REGIONS[3], ...air(55, 25), available: true }];
    const payload = payloadFor(() => air(20, 10));
    delete payload[SIDO_REGIONS[3].sido];
    authFetch.mockResolvedValue(payload);

    const rows = await fetchAirQualityStable(previous);

    expect(rows[3]).toEqual({ ...SIDO_REGIONS[3], ...air(55, 25), available: true, cachedFallback: true });
  });

  it("요청 자체가 실패하면 이전 성공 값을 모두 유지한다", async () => {
    const previous = SIDO_REGIONS.map((region) => ({ ...region, ...air(40, 20), available: true }));
    authFetch.mockRejectedValue(new Error("network"));

    const rows = await fetchAirQualityStable(previous);

    expect(authFetch).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(17);
    expect(rows.every((row) => row.cachedFallback === true && row.pm25 === 20)).toBe(true);
  });

  it("요청이 실패하고 이전 값도 없으면 빈 배열을 반환한다", async () => {
    authFetch.mockRejectedValue(new Error("network"));

    expect(await fetchAirQualityStable([])).toEqual([]);
    expect(await fetchAirQualityStable(undefined)).toEqual([]);
  });

  it("이전 값 중 조회 불가로 저장된 행은 유지 대상에서 제외한다", async () => {
    const previous = [{ ...SIDO_REGIONS[0], available: false }];
    authFetch.mockRejectedValue(new Error("network"));

    expect(await fetchAirQualityStable(previous)).toEqual([]);
  });
});
