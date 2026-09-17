export const MAIN_DISASTER_FILTERS = [
  "전체",
  "호우",
  "태풍",
  "지진",
  "화재",
  "기타",
];

export function parseDisasterDate(value) {
  if (!value) return null;

  const normalized = String(value)
    .trim()
    .replace(/\//g, "-")
    .replace(/\./g, "-")
    .replace(" ", "T");

  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDisasterTime(value) {
  const date = parseDisasterDate(value);

  if (!date) return "-";

  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDisasterDateTime(value) {
  const date = parseDisasterDate(value);

  if (!date) return value || "-";

  const pad = (n) => String(n).padStart(2, "0");

  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function disasterFilterOf(message) {
  /*
   * API의 disasterType 값을 그대로 믿지 않고
   * 실제 재난문자 내용을 기준으로 화면 카테고리를 분류한다.
   *
   * 예:
   * "시내버스 파업 예정" -> 기타
   * "공장 화재 발생"     -> 화재
   * "호우주의보 발효"    -> 호우
   */

  const text = String(message?.message || "");

  if (/호우|폭우|집중호우|홍수|침수|범람/.test(text)) {
    return "호우";
  }

  if (/태풍/.test(text)) {
    return "태풍";
  }

  if (/지진|여진/.test(text)) {
    return "지진";
  }

  if (/화재|산불|불길|화염|연기/.test(text)) {
    return "화재";
  }

  return "기타";
}

export function disasterTone(message) {
  const text = `${message?.emergencyLevel || ""} ${
    message?.message || ""
  }`;

  if (
    /위급|긴급|심각|경계|대피|지진|화재|산불|호우|홍수/.test(text)
  ) {
    return "red";
  }

  if (/주의|강풍|태풍|폭염|대설|한파|풍랑/.test(text)) {
    return "amber";
  }

  return "blue";
}

export function disasterBadgeClass(message) {
  const tone = disasterTone(message);

  if (tone === "red") {
    return "bg-red-50 text-red-500 border-red-100";
  }

  if (tone === "amber") {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }

  return "bg-blue-50 text-blue-600 border-blue-100";
}

export function extractSenderOrg(message) {
  /*
   * 백엔드에서 senderOrg가 있으면 그 값을 우선 사용한다.
   */
  if (message?.senderOrg) {
    return message.senderOrg;
  }

  /*
   * senderOrg가 없을 경우 문자 원문에
   * [기상청], [천안시], [행정안전부] 같은 형식이 있는지 확인한다.
   */
  const raw = String(message?.message || "");

  const bracketMatches = [...raw.matchAll(/\[([^\]]{1,40})\]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .filter(
      (value) =>
        !/^(안전안내문자|긴급재난문자|위급재난문자|재난문자|주의|경보)$/.test(
          value
        )
    );

  const likelyOrg = bracketMatches.find((value) =>
    /(시청|군청|구청|도청|광역시|특별시|특별자치시|특별자치도|기상청|행정안전부|소방|경찰|환경부|산림청|홍수통제소|공사|공단|본부|센터|청$|부$|처$|시$|군$|구$)/.test(
      value
    )
  );

  return likelyOrg || "확인되지 않음";
}

export function disasterTitle(message) {
  const raw = String(message?.message || "")
    .replace(/\[[^\]]{1,40}\]/g, "")
    .trim();

  if (raw) {
    const firstSentence =
      raw.split(/(?<=[.!?。])\s+/)[0]?.trim() || raw;

    if (firstSentence.length <= 42) {
      return firstSentence;
    }

    return `${firstSentence.slice(0, 42).trim()}…`;
  }

  const type = message?.disasterType || "재난안내";

  const region = String(message?.region || "")
    .split(",")[0]
    ?.trim();

  return region ? `${region} ${type}` : type;
}

export function disasterSummary(message) {
  const region = String(message?.region || "").trim();
  const level = String(message?.emergencyLevel || "").trim();

  return (
    [region, level].filter(Boolean).join(" · ") ||
    "송출지역 정보 없음"
  );
}