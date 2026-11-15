// 카카오 지도 SDK(services)와 다음 우편번호 호출을 한곳에 모은 헬퍼
export const MAP_SDK_NOT_READY = "지도 API를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";

// SDK가 autoload=false라 maps.load 안에서 services를 써야 한다. 준비 전이면 MAP_SDK_NOT_READY 오류로 거절한다
function withGeocoder(lookup) {
  return new Promise((resolve, reject) => {
    if (!window.kakao?.maps) {
      reject(new Error(MAP_SDK_NOT_READY));
      return;
    }
    window.kakao.maps.load(() => {
      const services = window.kakao.maps.services;
      if (!services) {
        reject(new Error(MAP_SDK_NOT_READY));
        return;
      }
      lookup(new services.Geocoder(), services.Status.OK, resolve);
    });
  });
}

// 주소 -> { lat, lng }. 못 찾으면 null
export const addressToCoords = (address) =>
  withGeocoder((geocoder, ok, resolve) =>
    geocoder.addressSearch(address, (result, status) =>
      resolve(status === ok && result[0] ? { lat: Number(result[0].y), lng: Number(result[0].x) } : null)));

// 좌표 -> 도로명(없으면 지번) 주소 문자열. 못 찾으면 null
export const coordToAddress = (lat, lng) =>
  withGeocoder((geocoder, ok, resolve) =>
    geocoder.coord2Address(lng, lat, (result, status) =>
      resolve(status === ok && result[0] ? result[0].road_address?.address_name || result[0].address?.address_name || null : null)));

// 좌표 -> 행정구역(법정동 H 우선) 정보. region_1depth_name이 시도, region_2depth_name이 시군구. 못 찾으면 null
export const coordToRegion = (lat, lng) =>
  withGeocoder((geocoder, ok, resolve) =>
    geocoder.coord2RegionCode(lng, lat, (result, status) =>
      resolve(status === ok && result?.length ? result.find((item) => item.region_type === "H") || result[0] : null)));

// 다음 우편번호 팝업을 열고 고른 주소(도로명 우선)를 onSelect로 넘긴다. 스크립트가 아직 없으면 false
export function openPostcode(onSelect, openOptions) {
  if (!window.daum?.Postcode) return false;
  new window.daum.Postcode({ oncomplete: (data) => onSelect(data.roadAddress || data.jibunAddress) }).open(openOptions);
  return true;
}
