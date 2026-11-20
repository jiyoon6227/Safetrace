import { SIDO_SHORT_NAME } from "../../utils/disasterRegion";

const toRegions = (sidos) => sidos.map((sido) => ({ sido, label: SIDO_SHORT_NAME[sido] }));

export const SIDO_REGIONS = toRegions([
  "서울특별시",
  "경기도",
  "인천광역시",
  "강원특별자치도",
  "세종특별자치시",
  "충청북도",
  "충청남도",
  "대전광역시",
  "경상북도",
  "대구광역시",
  "전북특별자치도",
  "광주광역시",
  "전라남도",
  "경상남도",
  "울산광역시",
  "부산광역시",
  "제주특별자치도",
]);

export const DISPLAY_REGIONS = toRegions([
  "서울특별시",
  "인천광역시",
  "대전광역시",
  "광주광역시",
  "대구광역시",
  "부산광역시",
  "강원특별자치도",
  "제주특별자치도",
]);

export const SHELTER_REGIONS = toRegions([
  "서울특별시",
  "인천광역시",
  "대전광역시",
  "부산광역시",
  "광주광역시",
  "대구광역시",
  "제주특별자치도",
  "세종특별자치시",
]);
