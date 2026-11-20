import { authFetch } from "../../api/client";
import { SIDO_CENTER } from "./constants";
import { SIDO_REGIONS } from "./publicInfoConstants";
import { dedupeMessages, parseExternalDate } from "./publicInfoUtils";

// 17개 시도 대기질은 서버가 시도별 캐시·동시 요청 제한·재시도를 처리하므로 한 번만 요청한다.
// 일부 지역이 실패해도 성공한 지역은 그대로 쓰고, 실패한 지역은 마지막으로 성공했던 값을 유지한다.
export async function fetchAirQualityStable(previousRows = []) {
  const successMap = new Map();

  const nationwide = await authFetch("/api/environment/air-quality/nationwide").catch(() => null);
  SIDO_REGIONS.forEach((region) => {
    const data = nationwide?.[region.sido];
    if (data?.available) successMap.set(region.sido, { ...region, ...data, available: true });
  });

  // 재시도까지 실패한 지역은 이전에 성공했던 값이 있으면 유지한다.
  const previousMap = new Map(
    (Array.isArray(previousRows) ? previousRows : [])
      .filter((row) => row?.sido && row?.available !== false)
      .map((row) => [row.sido, row])
  );

  return SIDO_REGIONS.flatMap((region) => {
    const fresh = successMap.get(region.sido);
    if (fresh) return [fresh];

    const previous = previousMap.get(region.sido);
    if (previous) {
      return [{ ...region, ...previous, available: true, cachedFallback: true }];
    }

    return [];
  });
}

export async function fetchNationwideMessagesFallback() {
  const results = await Promise.allSettled(
    Object.keys(SIDO_CENTER).map((sido) =>
      authFetch(`/api/environment/disaster-messages?rgnNm=${encodeURIComponent(sido)}&limit=12`)
    )
  );

  return dedupeMessages(
    results
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => Array.isArray(result.value) ? result.value : [])
  ).sort((a, b) => parseExternalDate(b.createdAt) - parseExternalDate(a.createdAt));
}
