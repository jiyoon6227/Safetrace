// 마지막으로 확인한 내 위치를 세션 동안 기억해 두는 키 - 화면을 옮겨도 위치를 다시 묻지 않도록
export const LOCATION_CACHE_KEY = "safetrace:last-location";

// 기억해 둔 위치를 { lat, lng }로 꺼냄. 없거나 값이 이상하면 null
export function readCachedLocation() {
  try {
    const raw = window.sessionStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
