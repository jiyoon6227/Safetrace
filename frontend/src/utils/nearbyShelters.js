import { authFetch } from "../api/client";
import { SIDO_SHORT_NAME } from "./disasterRegion";
import { coordToRegion } from "./kakaoGeo";

// 내 위치 기준 대피시설 조회 결과를 화면 사이에서 공유한다.
// 지도 화면/대피시설 화면이 같은 좌표로 들어오면 공공데이터 API를 다시 부르지 않고 바로 보여준다.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_PREFIX = "safetrace:shelters:";
const MAX_STORED_ENTRIES = 5;

const memoryCache = new Map();
const inflight = new Map();

const cacheKey = (lat, lng) => `${lat},${lng}`;

function readStored(key) {
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStored(key, entry) {
  try {
    window.sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));

    const stored = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const name = window.sessionStorage.key(i);
      if (name?.startsWith(CACHE_PREFIX)) {
        const item = readStored(name.slice(CACHE_PREFIX.length));
        stored.push({ name, savedAt: item?.savedAt ?? 0 });
      }
    }
    stored
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(MAX_STORED_ENTRIES)
      .forEach(({ name }) => window.sessionStorage.removeItem(name));
  } catch {
    // 저장 공간이 없거나 사용할 수 없으면 메모리 캐시만 사용한다.
  }
}

/** 캐시에 있는 결과({ list, label, query })를 바로 꺼냄. 없거나 오래됐으면 null */
export function readCachedShelters(lat, lng) {
  const key = cacheKey(lat, lng);
  const entry = memoryCache.get(key) || readStored(key);
  if (!entry || Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
  memoryCache.set(key, entry);
  return entry.value;
}

async function fetchShelters(lat, lng) {
  const region = await coordToRegion(lat, lng).catch(() => null);
  const sido = region?.region_1depth_name || "";
  const gu = region?.region_2depth_name || "";
  if (!sido) return { list: [], label: "", query: "", noRegion: true };

  const label = [sido, gu].filter(Boolean).join(" ");
  const queries = [
    label,
    gu || null,
    gu && SIDO_SHORT_NAME[sido] ? `${SIDO_SHORT_NAME[sido]} ${gu}` : null,
  ].filter(Boolean);

  let lastError = null;
  let answered = false;
  for (const guName of queries) {
    try {
      const data = await authFetch(
        `/api/environment/shelters?guName=${encodeURIComponent(guName)}&lat=${lat}&lng=${lng}&limit=100`
      );
      answered = true;
      if (Array.isArray(data) && data.length > 0) {
        return { list: data, label, query: guName, noRegion: false };
      }
    } catch (error) {
      lastError = error;
    }
  }

  // 모든 요청이 실패했을 때만 오류로 알린다(빈 결과는 정상 응답으로 본다).
  if (!answered && lastError) throw lastError;
  return { list: [], label, query: queries[0], noRegion: false };
}

/**
 * 좌표 기준 대피시설 조회. 같은 좌표는 10분간 캐시를 쓰고, 같은 좌표의 동시 요청은 하나로 합친다.
 * force=true면 캐시를 무시하고 다시 조회한다. 빈 결과는 캐시하지 않는다.
 */
export function loadNearbyShelters(lat, lng, { force = false } = {}) {
  const key = cacheKey(lat, lng);
  if (!force) {
    const cached = readCachedShelters(lat, lng);
    if (cached) return Promise.resolve(cached);
  }
  if (inflight.has(key)) return inflight.get(key);

  const task = fetchShelters(lat, lng)
    .then((value) => {
      if (value.list.length > 0) {
        const entry = { savedAt: Date.now(), value };
        memoryCache.set(key, entry);
        writeStored(key, entry);
      }
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, task);
  return task;
}
