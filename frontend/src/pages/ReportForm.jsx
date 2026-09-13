import React, { useState } from "react";
import { X, MapPin, Loader2, Search, Camera } from "lucide-react";
import { authFetch, authUpload } from "../api/client";
import { useEscapeKey } from "../hooks/useEscapeKey";

const DISASTER_TYPES = ["침수", "화재", "산사태", "강풍", "폭염", "한파", "기타"];
const PHONE_PREFIXES = ["010", "011", "016", "017", "018", "019"];

export default function ReportForm({ onClose, onSuccess }) {
  const [disasterType, setDisasterType] = useState(DISASTER_TYPES[0]);
  const [content, setContent] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("010");
  const [phoneMid, setPhoneMid] = useState("");
  const [phoneLast, setPhoneLast] = useState("");
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [addressResult, setAddressResult] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEscapeKey(true, onClose);

  // 위경도 -> 실제 주소 문자열로 변환 (카카오 리버스 지오코딩)
  const reverseGeocode = (lat, lng) => {
    if (!window.kakao || !window.kakao.maps) return;
    window.kakao.maps.load(() => {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2Address(lng, lat, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          const addr = result[0].road_address?.address_name || result[0].address?.address_name || "";
          setAddressResult(addr);
        }
      });
    });
  };

  const handleLocate = () => {
    setLocating(true);
    setError("");
    if (!navigator.geolocation) {
      setError("이 브라우저는 위치 정보를 지원하지 않습니다. 주소 검색을 이용하세요.");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setAddressResult(""); // 주소 도착 전까지는 비워두고, 도착하면 reverseGeocode가 채움
        reverseGeocode(lat, lng);
        setLocating(false);
      },
      () => {
        setError("위치 정보를 가져오지 못했습니다. 주소 검색을 이용하세요.");
        setLocating(false);
      }
    );
  };

  // 주소 문자열 -> 위경도 좌표 변환 (카카오 Geocoder)
  const geocodeAddress = (address) => {
    if (!window.kakao || !window.kakao.maps) {
      setError("지도 API를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setGeocoding(true);
    window.kakao.maps.load(() => {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(address, (result, status) => {
        setGeocoding(false);
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          setCoords({ lat: Number(result[0].y), lng: Number(result[0].x) });
          setAddressResult(address);
        } else {
          setError("좌표 변환에 실패했습니다. 다른 주소로 다시 검색해주세요.");
        }
      });
    });
  };

  // "주소 검색" 버튼 -> 다음(Daum) 우편번호 검색 팝업 오픈
  const handleAddressSearch = () => {
    setError("");
    if (!window.daum || !window.daum.Postcode) {
      setError("주소 검색 서비스를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        // 도로명주소 우선, 없으면 지번주소
        const fullAddress = data.roadAddress || data.jibunAddress;
        geocodeAddress(fullAddress);
      },
    }).open();
  };

  // 사진 선택 -> 미리보기용 URL만 먼저 만들어둠 (실제 업로드는 제출 시점에)
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 첨부할 수 있습니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("사진 용량은 5MB 이하만 가능합니다.");
      return;
    }

    setError("");
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!coords) {
      setError("위치를 먼저 확인해주세요.");
      return;
    }
    if (content.trim() === "") {
      setError("현장 상황을 간단히 입력해주세요.");
      return;
    }
    // 연락처는 선택이지만, 반쯤만 입력한 채로 제출되면 나중에 연락이 안 가니
    // "둘 다 채우거나 둘 다 비우거나" 중 하나로 명확히 하게 함
    const phoneFilled = phoneMid.length === 4 && phoneLast.length === 4;
    const phoneEmpty = phoneMid === "" && phoneLast === "";
    if (!phoneFilled && !phoneEmpty) {
      setError("연락처를 입력하시려면 뒷자리 8자리를 모두 입력해주세요. 남기지 않으려면 비워두세요.");
      return;
    }

    setSubmitting(true);
    try {
      let photoUrl = null;

      // 사진을 첨부했으면 먼저 업로드해서 URL부터 받아옴
      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);
        const uploadResult = await authUpload("/api/uploads", formData);
        photoUrl = uploadResult.url;
      }

      await authFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          disasterType,
          content,
          latitude: coords.lat,
          longitude: coords.lng,
          address: addressResult || null,
          photoUrl,
          reporterPhone: phoneMid && phoneLast ? `${phonePrefix}-${phoneMid}-${phoneLast}` : null,
        }),
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#0F2540]">현장제보</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">재난유형</label>
            <select
              value={disasterType}
              onChange={(e) => setDisasterType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0F2540]"
            >
              {DISASTER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">현장 상황</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="예: 도로에 물이 차서 차량 통행이 어렵습니다"
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0F2540]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">연락처 (선택)</label>
            <div className="flex items-center gap-1.5">
              <select
                value={phonePrefix}
                onChange={(e) => setPhonePrefix(e.target.value)}
                className="w-[84px] shrink-0 border border-slate-200 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:border-[#0F2540]"
              >
                {PHONE_PREFIXES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <span className="text-slate-300">-</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={4}
                value={phoneMid}
                onChange={(e) => setPhoneMid(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="1234"
                className="w-full min-w-0 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-center focus:outline-none focus:border-[#0F2540]"
              />
              <span className="text-slate-300">-</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={4}
                value={phoneLast}
                onChange={(e) => setPhoneLast(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="5678"
                className="w-full min-w-0 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-center focus:outline-none focus:border-[#0F2540]"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">현장 확인이 필요할 때 담당자가 연락드릴 수 있어요.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">사진 (선택)</label>

            {!photoPreviewUrl ? (
              <label className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0F2540] border border-dashed border-slate-300 rounded-lg py-4 hover:bg-slate-50 cursor-pointer">
                <Camera className="w-4 h-4" />
                사진 첨부하기
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </label>
            ) : (
              <div className="relative">
                <img src={photoPreviewUrl} alt="첨부 사진 미리보기" className="w-full h-40 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">위치</label>

            <button
              type="button"
              onClick={handleAddressSearch}
              disabled={geocoding}
              className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0F2540] border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 mb-1.5 cursor-pointer"
            >
              {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              주소 검색
            </button>

            <button
              type="button"
              onClick={handleLocate}
              disabled={locating}
              className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0F2540] border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              현재 위치로 자동확인
            </button>

            {coords && (
              <p className="text-xs text-emerald-600 mt-1.5">
                ✓ 위치 확인됨{addressResult ? ` — ${addressResult}` : " (주소 확인 중...)"}
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#0F2540] hover:bg-[#1B3A5C] text-white font-bold rounded-lg py-2.5 text-sm disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "제보 접수 중..." : "제보하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
