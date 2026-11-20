import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { SIDO_CENTER } from "./constants";
import { DISPLAY_REGIONS } from "./publicInfoConstants";
import { weatherEmoji, formatWeatherBaseTime, formatRainfall } from "./publicInfoUtils";

export default function NationwideWeatherMap({ weatherRows }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlayRefs = useRef([]);
  const [selectedSido, setSelectedSido] = useState(weatherRows[0]?.sido || "서울특별시");
  const [mapReady, setMapReady] = useState(false);

  const selected = weatherRows.find((item) => item.sido === selectedSido) || weatherRows[0];

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    const initMap = () => {
      if (cancelled) return;
      if (!mapRef.current || !window.kakao?.maps) {
        retryTimer = window.setTimeout(initMap, 200);
        return;
      }

      window.kakao.maps.load(() => {
        if (cancelled || !mapRef.current) return;

        const map = new window.kakao.maps.Map(mapRef.current, {
          center: new window.kakao.maps.LatLng(36.2, 127.8),
          level: 13,
        });

        // 공공정보 화면에서도 일반 지도처럼 직접 이동/확대할 수 있게 둔다.
        map.setDraggable(true);
        map.setZoomable(true);

        const zoomControl = new window.kakao.maps.ZoomControl();
        map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

        // 제주까지 포함한 주요 8개 권역이 첫 화면에 들어오도록 자동 맞춤한다.
        const bounds = new window.kakao.maps.LatLngBounds();
        DISPLAY_REGIONS.forEach((region) => {
          const center = SIDO_CENTER[region.sido];
          if (center) bounds.extend(new window.kakao.maps.LatLng(center.lat, center.lng));
        });
        map.setBounds(bounds, 36, 36, 36, 36);

        mapInstanceRef.current = map;
        setMapReady(true);
      });
    };

    initMap();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      overlayRefs.current.forEach((overlay) => overlay.setMap(null));
      overlayRefs.current = [];
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!mapReady || !map || !window.kakao?.maps) return;

    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];

    // 수도권처럼 실제 좌표가 가까운 곳은 화면에서만 살짝 벌려 겹침을 줄인다.
    const visualOffset = {
      서울: { x: 18, y: -18 },
      인천: { x: -24, y: 8 },
      대전: { x: -4, y: -5 },
      광주: { x: -12, y: 4 },
      대구: { x: 14, y: -5 },
      부산: { x: 16, y: 12 },
      강원: { x: 8, y: -8 },
      제주: { x: 0, y: 6 },
    };

    weatherRows.forEach((item) => {
      const center = SIDO_CENTER[item.sido];
      if (!center) return;

      const active = item.sido === selected?.sido;
      const offset = visualOffset[item.label] || { x: 0, y: 0 };
      const content = document.createElement("button");
      content.type = "button";
      content.setAttribute("aria-label", `${item.label} 날씨 상세 보기`);
      content.style.cssText = [
        "display:flex",
        "align-items:center",
        "gap:5px",
        "min-width:58px",
        "height:34px",
        "padding:0 8px",
        "border-radius:17px",
        `border:${active ? "2px solid #60a5fa" : "1px solid rgba(255,255,255,.95)"}`,
        "background:rgba(255,255,255,.96)",
        "box-shadow:0 3px 10px rgba(15,37,64,.18)",
        "font-family:inherit",
        "cursor:pointer",
        "white-space:nowrap",
        `transform:translate(${offset.x}px, ${offset.y}px)`,
      ].join(";");

      const city = document.createElement("span");
      city.textContent = item.label;
      city.style.cssText = "font-size:10px;font-weight:800;color:#475569;";

      const icon = document.createElement("span");
      icon.textContent = weatherEmoji(item);
      icon.style.cssText = "font-size:14px;line-height:1;";

      const temp = document.createElement("strong");
      temp.textContent = `${item.temperature ?? "-"}℃`;
      temp.style.cssText = "font-size:11px;font-weight:800;color:#0F2540;";

      content.append(city, icon, temp);
      content.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedSido(item.sido);
      });

      const overlay = new window.kakao.maps.CustomOverlay({
        map,
        position: new window.kakao.maps.LatLng(center.lat, center.lng),
        content,
        xAnchor: 0.5,
        yAnchor: 0.5,
        clickable: true,
        zIndex: active ? 4 : 3,
      });

      overlayRefs.current.push(overlay);
    });

    return () => {
      overlayRefs.current.forEach((overlay) => overlay.setMap(null));
      overlayRefs.current = [];
    };
  }, [mapReady, weatherRows, selected?.sido]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.38fr_0.62fr] gap-3 md:h-[340px]">
      <div className="relative min-h-[300px] md:min-h-0 overflow-hidden rounded-xl border border-slate-100 bg-[#dcebfa]">
        <div ref={mapRef} className="absolute inset-0" />

        {!mapReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-sky-50">
            <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
          </div>
        ) : null}

        <div className="absolute left-2.5 bottom-2.5 rounded-lg border border-white/80 bg-white/90 px-2 py-1 shadow-sm pointer-events-none">
          <span className="text-[9px] font-semibold text-slate-500">마커 선택 · 지도 이동/확대 가능</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50/65 px-3.5 py-3 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-[14px] font-extrabold text-[#0F2540]">{selected?.label || "-"}</h4>
            <p className="text-[9px] text-slate-400 mt-0.5">{formatWeatherBaseTime(selected)}</p>
          </div>
          <span className="text-[32px] leading-none">{weatherEmoji(selected)}</span>
        </div>

        <div className="mt-4 flex items-end gap-2">
          <strong className="text-[30px] leading-none text-[#0F2540]">{selected?.temperature ?? "-"}℃</strong>
          <span className="text-[11px] font-semibold text-slate-500 pb-0.5">{selected?.precipitationType || "-"}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <WeatherMetric label="습도" value={`${selected?.humidity ?? "-"}%`} />
          <WeatherMetric label="풍속" value={`${selected?.windSpeed ?? "-"}m/s`} />
          <WeatherMetric label="1시간 강수" value={formatRainfall(selected?.hourlyRainfall)} />
          <WeatherMetric label="관측" value="초단기실황" />
        </div>

      </div>
    </div>
  );
}

function WeatherMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2">
      <p className="text-[9px] text-slate-400">{label}</p>
      <p className="text-[12px] font-bold text-slate-700 mt-0.5 whitespace-nowrap">{value}</p>
    </div>
  );
}
