import { parseDisasterDate } from "./disasterMessages";

// 시/도 약칭 매핑 (행안부 지역명의 정식명/약칭 혼용 대응)
export const SIDO_SHORT_NAME = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원도: "강원",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전라북도: "전북",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

// 재난문자 조회용 지역 이름 후보 (구가 없는 지역은 시/도명만)
export function buildRegionQueries(sido, gu) {
  return {
    regionQuery: gu ? `${sido} ${gu}` : sido,
    regionFallback: gu || null,
    regionShortFallback: gu && SIDO_SHORT_NAME[sido] ? `${SIDO_SHORT_NAME[sido]} ${gu}` : null,
    regionSidoOnlyFallback: gu ? sido : null,
  };
}

// msg.region에 해당 시/도(정식명·약칭) 포함 여부 (다른 시/도의 같은 이름 구 제외)
export function belongsToSido(msg, sido) {
  const shortSido = SIDO_SHORT_NAME[sido];
  const region = msg.region || "";
  return region.includes(sido) || (!!shortSido && region.includes(shortSido));
}

// 시/도 전체 대상 문자 여부 (region 콤마 목록에 시/도명 토큰이 정확히 있는지)
export function isSidoWideMessage(msg, sido) {
  return (msg.region || "")
    .split(",")
    .map((r) => r.trim())
    .includes(sido);
}

// 정렬용 발송 시각 (파싱 실패 시 0)
export function messageTimestamp(msg) {
  const date = parseDisasterDate(msg.createdAt);
  return date ? date.getTime() : 0;
}

// 구 단위 문자 + 시/도 전체 문자 병합 (중복 제거 후 최신순)
export function mergeDisasterMessages(districtMessages, sidoMessages) {
  const seen = new Set();
  const merged = [...(districtMessages || []), ...(sidoMessages || [])].filter((msg) => {
    // 백엔드 중복 기준과 동일 (SN 우선, 없으면 시각+지역+내용)
    const key = msg.sn ? `SN:${msg.sn}` : `${msg.createdAt}|${msg.region}|${msg.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  merged.sort((a, b) => messageTimestamp(b) - messageTimestamp(a));
  return merged;
}

// 구 단위 문자 조회 (시/도+구 → 구 → 약칭+구 순서, 결과 0건일 때만 다음 후보)
export async function fetchDistrictMessages(fetchByRegion, queries, sido) {
  const { regionQuery, regionFallback, regionShortFallback } = queries;
  const fetchFiltered = async (rgnNm) =>
    (await fetchByRegion(rgnNm)).filter((msg) => belongsToSido(msg, sido));

  let data = await fetchFiltered(regionQuery);
  if (!data.length && regionFallback) data = await fetchFiltered(regionFallback);
  if (!data.length && regionShortFallback) data = await fetchFiltered(regionShortFallback);
  return data;
}

// 시/도 전체 대상 문자 조회 (실패 시 빈 목록)
export function fetchSidoWideMessages(fetchByRegion, regionSidoOnlyFallback) {
  if (!regionSidoOnlyFallback) return Promise.resolve([]);
  return fetchByRegion(regionSidoOnlyFallback)
    .then((data) => data.filter((msg) => isSidoWideMessage(msg, regionSidoOnlyFallback)))
    .catch(() => []);
}
