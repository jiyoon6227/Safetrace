import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, Home, Loader2, Search, X } from "lucide-react";
import { authFetch } from "../api/client";
import SiteHeader from "../components/SiteHeader";
import {
  disasterFilterOf,
  disasterSummary,
  disasterTitle,
  formatDisasterDateTime,
} from "../utils/disasterMessages";
import { SAFETY_GUIDES, SAFETY_GUIDE_ORDER } from "../data/safetyGuides";

const TABS = [
  { key: "all", label: "통합검색" },
  { key: "disaster", label: "재난정보" },
  { key: "shelter", label: "대피시설" },
  { key: "guide", label: "행동요령" },
  { key: "notice", label: "공지사항" },
];

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function uniqueShelters(rows) {
  const map = new Map();

  rows.forEach((item) => {
    if (!item) return;
    const key = `${item.name || ""}|${item.address || ""}`;
    if (!map.has(key)) map.set(key, item);
  });

  return [...map.values()];
}

function ResultSection({
  title,
  count,
  items,
  activeTab,
  tabKey,
  onShowMore,
  renderItem,
}) {
  if (activeTab !== "all" && activeTab !== tabKey) return null;

  const visible = activeTab === "all" ? items.slice(0, 3) : items.slice(0, 30);

  return (
    <section className="mt-9">
      <div className="flex items-center justify-between border-b border-[#26384E] pb-2">
        <h2 className="text-[15px] font-extrabold text-[#17283E]">
          {title} <span className="ml-1 text-[#0B5FB3]">[{count}건]</span>
        </h2>

        {activeTab === "all" && count > 3 && (
          <button
            type="button"
            onClick={onShowMore}
            className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#0B5FB3]"
          >
            더 많은 검색결과 보기
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {visible.length > 0 ? (
        <div>
          {visible.map(renderItem)}
        </div>
      ) : (
        <div className="border-b border-slate-200 py-8 text-center text-[12px] text-slate-400">
          검색 결과가 없습니다.
        </div>
      )}
    </section>
  );
}

export default function SearchPage({ initialQuery = "", onNavigate }) {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim());
  const [activeTab, setActiveTab] = useState("all");

  const [disasters, setDisasters] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [notices, setNotices] = useState([]);

  const [loading, setLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");

  const move = (page, state = {}) => {
    if (typeof onNavigate === "function") onNavigate(page, state);
  };

  const guides = useMemo(
    () => SAFETY_GUIDE_ORDER.map((key) => SAFETY_GUIDES[key]).filter(Boolean),
    []
  );

  useEffect(() => {
    const q = query.trim();

    if (!q) {
      setDisasters([]);
      setShelters([]);
      setNotices([]);
      setSourceError("");
      setLoading(false);
      return undefined;
    }

    let alive = true;
    setLoading(true);
    setSourceError("");

    const load = async () => {
      const shelterKeywordUrl =
        `/api/environment/shelters/search?keyword=${encodeURIComponent(q)}&page=1&size=100`;
      const shelterRegionUrl =
        `/api/environment/shelters/search?region=${encodeURIComponent(q)}&page=1&size=100`;

      const results = await Promise.allSettled([
        authFetch("/api/environment/disaster-messages/nationwide?limit=100"),
        authFetch("/api/notices"),
        authFetch(shelterKeywordUrl),
        authFetch(shelterRegionUrl),
      ]);

      if (!alive) return;

      const disasterData =
        results[0].status === "fulfilled" && Array.isArray(results[0].value)
          ? results[0].value
          : [];

      const noticeData =
        results[1].status === "fulfilled" && Array.isArray(results[1].value)
          ? results[1].value
          : [];

      const keywordShelters =
        results[2].status === "fulfilled" && Array.isArray(results[2].value?.items)
          ? results[2].value.items
          : [];

      const regionShelters =
        results[3].status === "fulfilled" && Array.isArray(results[3].value?.items)
          ? results[3].value.items
          : [];

      const failed = results.filter((result) => result.status === "rejected").length;
      if (failed > 0) {
        setSourceError("일부 공개정보를 불러오지 못해 확인 가능한 결과만 표시합니다.");
      }

      setDisasters(disasterData);
      setNotices(noticeData);
      setShelters(uniqueShelters([...keywordShelters, ...regionShelters]));
      setLoading(false);
    };

    load().catch(() => {
      if (!alive) return;
      setDisasters([]);
      setShelters([]);
      setNotices([]);
      setSourceError("검색 정보를 불러오지 못했습니다.");
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [query]);

  const normalizedQuery = normalize(query);

  const disasterResults = useMemo(() => {
    if (!normalizedQuery) return [];

    return disasters.filter((item) => {
      const text = normalize(
        [
          item?.message,
          item?.region,
          item?.emergencyLevel,
          item?.disasterType,
          disasterFilterOf(item),
          disasterTitle(item),
        ].join(" ")
      );
      return text.includes(normalizedQuery);
    });
  }, [disasters, normalizedQuery]);

  const shelterResults = useMemo(() => {
    if (!normalizedQuery) return [];

    return shelters.filter((item) =>
      normalize([item?.name, item?.address, item?.region, item?.floorType].join(" "))
        .includes(normalizedQuery)
    );
  }, [shelters, normalizedQuery]);

  const guideResults = useMemo(() => {
    if (!normalizedQuery) return [];

    return guides.filter((guide) => {
      const searchable = [
        guide.label,
        guide.shortDescription,
        guide.sourceLabel,
        ...(guide.quickTips || []).flatMap((tip) => [tip.title, tip.description]),
        ...(guide.phases || []).flatMap((phase) => [
          phase.title,
          phase.subtitle,
          ...(phase.items || []),
        ]),
        ...(guide.checklist || []),
      ].join(" ");

      return normalize(searchable).includes(normalizedQuery);
    });
  }, [guides, normalizedQuery]);

  const noticeResults = useMemo(() => {
    if (!normalizedQuery) return [];

    return notices.filter((notice) =>
      normalize(
        [notice?.title, notice?.content, notice?.writerName, notice?.noticeType].join(" ")
      ).includes(normalizedQuery)
    );
  }, [notices, normalizedQuery]);

  const totalCount =
    disasterResults.length +
    shelterResults.length +
    guideResults.length +
    noticeResults.length;

  const submitSearch = (e) => {
    e?.preventDefault();

    const next = input.trim();
    if (!next) return;

    setQuery(next);
    setActiveTab("all");

    window.history.replaceState(
      { ...window.history.state, page: "search", searchQuery: next },
      ""
    );
  };

  const clearSearch = () => {
    setInput("");
    setQuery("");
    setActiveTab("all");
    window.history.replaceState(
      { ...window.history.state, page: "search", searchQuery: "" },
      ""
    );
  };

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <SiteHeader active="" onNavigate={onNavigate} />

      <div className="border-b border-blue-100 bg-[#EDF4FB]">
        <div className="mx-auto flex h-11 max-w-[1180px] items-center gap-2 px-6 text-[11px] text-slate-500">
          <Home className="h-3.5 w-3.5" />
          <ChevronRight className="h-3 w-3" />
          <strong className="font-bold text-[#0B5FB3]">통합검색</strong>
        </div>
      </div>

      <main className="mx-auto max-w-[1040px] px-6 pb-16 pt-14">
        <div className="text-center">
          <h1 className="text-[31px] font-extrabold tracking-tight text-[#17283E]">
            통합검색
          </h1>
          <p className="mt-2 text-[12px] text-slate-500">
            재난정보, 대피시설, 행동요령, 공지사항을 한 번에 검색할 수 있습니다.
          </p>
        </div>

        <form
          onSubmit={submitSearch}
          className="mx-auto mt-8 flex max-w-[720px] items-stretch"
        >
          <div className="relative min-w-0 flex-1">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="검색어를 입력하세요."
              className="h-12 w-full border border-slate-400 bg-white px-4 pr-10 text-[13px] text-slate-700 outline-none focus:border-[#0B2A52]"
            />

            {input && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600"
                aria-label="검색어 지우기"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="flex h-12 w-14 cursor-pointer items-center justify-center bg-[#17283E] text-white hover:bg-[#0B2A52]"
            aria-label="검색"
          >
            <Search className="h-5 w-5" />
          </button>
        </form>

        <div className="mx-auto mt-7 grid max-w-[820px] grid-cols-5 border border-slate-300">
          {TABS.map((tab, index) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`h-10 cursor-pointer border-r border-slate-300 text-[12px] font-semibold last:border-r-0 ${
                activeTab === tab.key
                  ? "bg-[#222] text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {!query ? (
          <div className="py-24 text-center text-[13px] text-slate-400">
            검색어를 입력해주세요.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            검색 중입니다.
          </div>
        ) : (
          <>
            <div className="mt-12 text-center text-[16px] text-slate-700">
              검색어 <strong className="text-[#0B5FB3]">'{query}'</strong>에 대해 검색한 결과,
              총 <strong className="text-[#0B5FB3]">{totalCount}</strong>건이 검색되었습니다.
            </div>

            {sourceError && (
              <div className="mt-5 border border-slate-200 bg-slate-50 px-4 py-3 text-center text-[11px] text-slate-500">
                {sourceError}
              </div>
            )}

            <ResultSection
              title="재난정보"
              count={disasterResults.length}
              items={disasterResults}
              activeTab={activeTab}
              tabKey="disaster"
              onShowMore={() => setActiveTab("disaster")}
              renderItem={(item, index) => (
                <button
                  key={item.sn || `${item.createdAt}-${index}`}
                  type="button"
                  onClick={() => move("disaster-info", { disasterSn: item.sn || null })}
                  className="grid w-full cursor-pointer gap-2 border-b border-slate-200 py-3.5 text-left hover:bg-slate-50 sm:grid-cols-[230px_minmax(0,1fr)_130px]"
                >
                  <strong className="truncate text-[12px] text-[#17283E]">
                    {disasterTitle(item)}
                  </strong>
                  <span className="truncate text-[11px] text-slate-500">
                    {disasterSummary(item)}
                  </span>
                  <span className="text-right text-[11px] text-slate-400">
                    {formatDisasterDateTime(item.createdAt)}
                  </span>
                </button>
              )}
            />

            <ResultSection
              title="대피시설"
              count={shelterResults.length}
              items={shelterResults}
              activeTab={activeTab}
              tabKey="shelter"
              onShowMore={() => setActiveTab("shelter")}
              renderItem={(item, index) => (
                <button
                  key={`${item.name}-${item.address}-${index}`}
                  type="button"
                  onClick={() => move("shelters", { shelterFocus: item })}
                  className="grid w-full cursor-pointer gap-2 border-b border-slate-200 py-3.5 text-left hover:bg-slate-50 sm:grid-cols-[230px_minmax(0,1fr)_130px]"
                >
                  <strong className="truncate text-[12px] text-[#17283E]">
                    {item.name || "대피시설"}
                  </strong>
                  <span className="truncate text-[11px] text-slate-500">
                    {[item.address, item.capacity ? `수용인원 ${item.capacity}명` : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="text-right text-[11px] text-slate-400">
                    {item.region || ""}
                  </span>
                </button>
              )}
            />

            <ResultSection
              title="행동요령"
              count={guideResults.length}
              items={guideResults}
              activeTab={activeTab}
              tabKey="guide"
              onShowMore={() => setActiveTab("guide")}
              renderItem={(guide) => (
                <button
                  key={guide.key}
                  type="button"
                  onClick={() => move("safety-guides", { safetyGuideKey: guide.key })}
                  className="grid w-full cursor-pointer gap-2 border-b border-slate-200 py-3.5 text-left hover:bg-slate-50 sm:grid-cols-[230px_minmax(0,1fr)_130px]"
                >
                  <strong className="truncate text-[12px] text-[#17283E]">
                    {guide.label} 행동요령
                  </strong>
                  <span className="truncate text-[11px] text-slate-500">
                    {guide.shortDescription}
                  </span>
                  <span className="text-right text-[11px] text-slate-400">
                    {guide.sourceLabel || ""}
                  </span>
                </button>
              )}
            />

            <ResultSection
              title="공지사항"
              count={noticeResults.length}
              items={noticeResults}
              activeTab={activeTab}
              tabKey="notice"
              onShowMore={() => setActiveTab("notice")}
              renderItem={(notice) => (
                <button
                  key={notice.noticeId}
                  type="button"
                  onClick={() => move("notices", { noticeId: notice.noticeId })}
                  className="grid w-full cursor-pointer gap-2 border-b border-slate-200 py-3.5 text-left hover:bg-slate-50 sm:grid-cols-[230px_minmax(0,1fr)_130px]"
                >
                  <strong className="truncate text-[12px] text-[#17283E]">
                    {notice.title || "공지사항"}
                  </strong>
                  <span className="truncate text-[11px] text-slate-500">
                    {String(notice.content || "").replace(/\s+/g, " ")}
                  </span>
                  <span className="text-right text-[11px] text-slate-400">
                    {formatDate(notice.createdAt)}
                  </span>
                </button>
              )}
            />
          </>
        )}
      </main>
    </div>
  );
}