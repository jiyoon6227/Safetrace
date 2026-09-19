import React, { useState } from "react";
import { X, MapPin, Loader2, Search, Camera } from "lucide-react";
import { authFetch, authUpload } from "../api/client";
import { useEscapeKey } from "../hooks/useEscapeKey";

const DISASTER_TYPES = ["침수", "화재", "산사태", "강풍", "폭염", "한파", "기타"];
const PHONE_PREFIXES = ["010", "011", "016", "017", "018", "019"];
const MAX_PHOTOS = 5;


function ReportField({ isPage, label, required = false, children }) {
  if (!isPage) {
    return (
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
        {children}
      </div>
    );
  }

  return (
    <div className="grid gap-3 border-b border-slate-100 py-5 sm:grid-cols-[130px_minmax(0,1fr)]">
      <div className="pt-2 text-[13px] font-bold text-[#26384E]">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function ReportForm({ onClose, onSuccess, variant = "modal" }) {
  const isPage = variant === "page";

  const [disasterType, setDisasterType] = useState(DISASTER_TYPES[0]);
  const [content, setContent] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("010");
  const [phoneMid, setPhoneMid] = useState("");
  const [phoneLast, setPhoneLast] = useState("");
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [addressResult, setAddressResult] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const safeClose = typeof onClose === "function" ? onClose : () => {};
  useEscapeKey(!isPage, safeClose);

  const reverseGeocode = (lat, lng) => {
    if (!window.kakao || !window.kakao.maps) return;

    window.kakao.maps.load(() => {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2Address(lng, lat, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          const addr =
            result[0].road_address?.address_name ||
            result[0].address?.address_name ||
            "";
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
        setAddressResult("");
        reverseGeocode(lat, lng);
        setLocating(false);
      },
      () => {
        setError("위치 정보를 가져오지 못했습니다. 주소 검색을 이용하세요.");
        setLocating(false);
      }
    );
  };

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
          setCoords({
            lat: Number(result[0].y),
            lng: Number(result[0].x),
          });
          setAddressResult(address);
        } else {
          setError("좌표 변환에 실패했습니다. 다른 주소로 다시 검색해주세요.");
        }
      });
    });
  };

  const handleAddressSearch = () => {
    setError("");

    if (!window.daum || !window.daum.Postcode) {
      setError("주소 검색 서비스를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data) => {
        const fullAddress = data.roadAddress || data.jibunAddress;
        geocodeAddress(fullAddress);
      },
    }).open();
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";

    if (files.length === 0) return;

    const room = MAX_PHOTOS - photoFiles.length;

    if (room <= 0) {
      setError(`사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`);
      return;
    }

    const toAdd = files.slice(0, room);

    for (const file of toAdd) {
      if (!file.type.startsWith("image/")) {
        setError("이미지 파일만 첨부할 수 있습니다.");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError("사진 용량은 5MB 이하만 가능합니다.");
        return;
      }
    }

    setError("");
    setPhotoFiles((prev) => [...prev, ...toAdd]);
    setPhotoPreviewUrls((prev) => [
      ...prev,
      ...toAdd.map((file) => URL.createObjectURL(file)),
    ]);
  };

  const handleRemovePhoto = (index) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== index));
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

    const phoneFilled = phoneMid.length === 4 && phoneLast.length === 4;
    const phoneEmpty = phoneMid === "" && phoneLast === "";

    if (!phoneFilled && !phoneEmpty) {
      setError(
        "연락처를 입력하시려면 뒷자리 8자리를 모두 입력해주세요. 남기지 않으려면 비워두세요."
      );
      return;
    }

    setSubmitting(true);

    try {
      let photoUrl = null;
      let additionalPhotoUrls = [];

      if (photoFiles.length > 0) {
        const uploadedUrls = await Promise.all(
          photoFiles.map(async (file) => {
            const formData = new FormData();
            formData.append("file", file);

            const uploadResult = await authUpload("/api/uploads", formData);
            return uploadResult.url;
          })
        );

        photoUrl = uploadedUrls[0];
        additionalPhotoUrls = uploadedUrls.slice(1);
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
          additionalPhotoUrls,
          reporterPhone:
            phoneMid && phoneLast
              ? `${phonePrefix}-${phoneMid}-${phoneLast}`
              : null,
        }),
      });

      if (typeof onSuccess === "function") {
        onSuccess();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const form = (
    <form onSubmit={handleSubmit} className={isPage ? "" : "space-y-4"}>
      <ReportField isPage={isPage} label="재난유형" required>
        <select
          value={disasterType}
          onChange={(e) => setDisasterType(e.target.value)}
          className={`border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0B5FB3] ${
            isPage ? "h-11 w-full max-w-[340px]" : "w-full rounded-lg"
          }`}
        >
          {DISASTER_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </ReportField>

      <ReportField isPage={isPage} label="현장 상황" required>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="예: 도로에 물이 차서 차량 통행이 어렵습니다"
          rows={isPage ? 5 : 3}
          maxLength={1000}
          className={`w-full resize-none border border-slate-200 px-3 py-3 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-[#0B5FB3] ${
            isPage ? "" : "rounded-lg"
          }`}
        />

        {isPage && (
          <div className="mt-1 text-right text-[11px] text-slate-400">
            {content.length} / 1000
          </div>
        )}
      </ReportField>

      <ReportField isPage={isPage} label="연락처 (선택)">
        <div className="flex max-w-[460px] items-center gap-2">
          <select
            value={phonePrefix}
            onChange={(e) => setPhonePrefix(e.target.value)}
            className={`h-11 w-[90px] shrink-0 border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#0B5FB3] ${
              isPage ? "" : "rounded-lg"
            }`}
          >
            {PHONE_PREFIXES.map((prefix) => (
              <option key={prefix} value={prefix}>
                {prefix}
              </option>
            ))}
          </select>

          <span className="text-slate-300">-</span>

          <input
            type="tel"
            inputMode="numeric"
            maxLength={4}
            value={phoneMid}
            onChange={(e) =>
              setPhoneMid(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="1234"
            className={`h-11 min-w-0 flex-1 border border-slate-200 px-3 text-center text-sm outline-none focus:border-[#0B5FB3] ${
              isPage ? "" : "rounded-lg"
            }`}
          />

          <span className="text-slate-300">-</span>

          <input
            type="tel"
            inputMode="numeric"
            maxLength={4}
            value={phoneLast}
            onChange={(e) =>
              setPhoneLast(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="5678"
            className={`h-11 min-w-0 flex-1 border border-slate-200 px-3 text-center text-sm outline-none focus:border-[#0B5FB3] ${
              isPage ? "" : "rounded-lg"
            }`}
          />
        </div>

        <p className="mt-2 text-[11px] text-slate-400">
          현장 확인이 필요할 때 담당자가 연락드릴 수 있어요.
        </p>
      </ReportField>

      <ReportField isPage={isPage} label={`사진 (선택, 최대 ${MAX_PHOTOS}장)`}>
        <div className={`grid gap-2 ${isPage ? "max-w-[620px] grid-cols-2 sm:grid-cols-5" : "grid-cols-3"}`}>
          {photoPreviewUrls.map((url, index) => (
            <div key={url} className="relative">
              <img
                src={url}
                alt={`첨부 사진 미리보기 ${index + 1}`}
                className={`${isPage ? "h-24" : "h-20 rounded-lg"} w-full border border-slate-200 object-cover`}
              />

              <button
                type="button"
                onClick={() => handleRemovePhoto(index)}
                className="absolute right-1 top-1 cursor-pointer bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <X className="h-3 w-3" />
              </button>

              {index === 0 && (
                <span className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  대표
                </span>
              )}
            </div>
          ))}

          {photoFiles.length < MAX_PHOTOS && (
            <label
              className={`flex cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-slate-300 text-[11px] font-semibold text-[#0F2540] hover:bg-slate-50 ${
                isPage ? "h-24" : "h-20 rounded-lg"
              }`}
            >
              <Camera className="h-5 w-5" />
              사진 추가
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          )}
        </div>
      </ReportField>

      <ReportField isPage={isPage} label="위치" required>
        <div className="max-w-[620px]">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleAddressSearch}
              disabled={geocoding}
              className={`flex h-11 cursor-pointer items-center justify-center gap-2 border border-slate-200 bg-white text-sm font-bold text-[#0F2540] hover:bg-slate-50 disabled:opacity-50 ${
                isPage ? "" : "rounded-lg"
              }`}
            >
              {geocoding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              주소 검색
            </button>

            <button
              type="button"
              onClick={handleLocate}
              disabled={locating}
              className={`flex h-11 cursor-pointer items-center justify-center gap-2 border border-slate-200 bg-white text-sm font-bold text-[#0F2540] hover:bg-slate-50 disabled:opacity-50 ${
                isPage ? "" : "rounded-lg"
              }`}
            >
              {locating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              현재 위치로 자동확인
            </button>
          </div>

          {coords && (
            <div
              className={`mt-3 border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 ${
                isPage ? "" : "rounded-lg"
              }`}
            >
              ✓ 위치가 확인되었습니다.
              {addressResult ? ` ${addressResult}` : " 주소 확인 중..."}
            </div>
          )}
        </div>
      </ReportField>

      {error && (
        <div
          className={
            isPage
              ? "mt-5 border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-600"
              : "rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500"
          }
        >
          {error}
        </div>
      )}

      {isPage ? (
        <div className="flex justify-end gap-2 pt-6">
          <button
            type="button"
            onClick={safeClose}
            className="h-11 min-w-[110px] cursor-pointer border border-slate-300 bg-white px-6 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            취소
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="h-11 min-w-[150px] cursor-pointer bg-[#0B2A52] px-7 text-sm font-bold text-white hover:bg-[#173B65] disabled:opacity-50"
          >
            {submitting ? "제보 접수 중..." : "제보하기"}
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={submitting}
          className="w-full cursor-pointer rounded-lg bg-[#0F2540] py-2.5 text-sm font-bold text-white hover:bg-[#1B3A5C] disabled:opacity-50"
        >
          {submitting ? "제보 접수 중..." : "제보하기"}
        </button>
      )}
    </form>
  );

  if (isPage) {
    return (
      <div className="border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[17px] font-extrabold text-[#17283E]">
            현장 제보 작성
          </h2>
          <span className="text-[11px] text-slate-400">
            * 표시는 필수 입력 항목입니다.
          </span>
        </div>

        <div className="px-5 pb-6 sm:px-7">{form}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-[#0F2540]">현장제보</h2>
          <button
            type="button"
            onClick={safeClose}
            className="cursor-pointer text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {form}
      </div>
    </div>
  );
}
