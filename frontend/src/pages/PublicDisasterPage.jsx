import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Megaphone,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { authFetch } from "../api/client";
import ServicePageLayout from "../components/ServicePageLayout";
import {
  MAIN_DISASTER_FILTERS,
  disasterFilterOf,
  disasterSummary,
  disasterTitle,
  extractSenderOrg,
  formatDisasterDateTime,
} from "../utils/disasterMessages";

const PAGE_SIZE = 10;

const messageKey = (message) =>
  message?.sn ||
  `${message?.createdAt || "time"}|${message?.region || "region"}|${message?.message || "message"}`;

function DisasterTypeBadge({ message }) {
  const label = disasterFilterOf(message);
  return (
    <span className="inline-flex min-w-[46px] items-center justify-center border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
      {label}
    </span>
  );
}

export default function PublicDisasterPage({
  initialMessageSn,
  onBackToHome,
  onOpenShelters,
  onOpenReport,
  onNavigate,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("전체");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [page, setPage] = useState(1);

  const move = (pageName, state = {}) => {
    if (typeof onNavigate === "function") onNavigate(pageName, state);
  };

  const loadMessages = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await authFetch("/api/environment/disaster-messages/nationwide?limit=100");
      const rows = Array.isArray(data) ? data : [];
      setMessages(rows);

      if (initialMessageSn) {
        const initial = rows.find((row) => String(row?.sn || "") === String(initialMessageSn));
        if (initial) setSelectedMessage(initial);
      }
    } catch (e) {
      setMessages([]);
      setSelectedMessage(null);
      setError(e?.message || "재난문자를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const filteredMessages = useMemo(() => {
    const q = query.trim().toLowerCase();

    return messages.filter((message) => {
      if (filter !== "전체" && disasterFilterOf(message) !== filter) return false;
      if (!q) return true;

      const text = `${message.message || ""} ${message.region || ""} ${disasterFilterOf(message)} ${
        message.emergencyLevel || ""
      }`.toLowerCase();

      return text.includes(q);
    });
  }, [messages, filter, query]);

  useEffect(() => {
    setPage(1);
  }, [filter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredMessages.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleMessages = filteredMessages.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 10) return Array.from({ length: totalPages }, (_, index) => index + 1);
    let start = Math.max(1, safePage - 4);
    let end = Math.min(totalPages, start + 9);
    start = Math.max(1, end - 9);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [safePage, totalPages]);


  return (
    <ServicePageLayout
      activeNav="disaster-info"
      onNavigate={onNavigate}
      sectionTitle="서비스 안내"
      pageTitle="재난문자"
      breadcrumbParent="서비스 안내"
      description="전국에 발송된 공식 재난문자를 조회하고 지역·유형별로 필요한 안전정보를 확인할 수 있습니다."
      headerAction={
        <button
          type="button"
          onClick={loadMessages}
          disabled={loading}
          className="inline-flex h-10 cursor-pointer items-center gap-2 border border-slate-300 bg-white px-4 text-[12px] font-bold text-slate-600 hover:border-[#0B5FB3] hover:text-[#0B5FB3] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 새로고침
        </button>
      }
    >
      {selectedMessage ? (
        <>
          <button
            type="button"
            onClick={() => setSelectedMessage(null)}
            className="mb-5 inline-flex cursor-pointer items-center gap-1 text-[12px] font-bold text-slate-500 hover:text-[#0B5FB3]"
          >
            <ArrowLeft className="h-4 w-4" /> 목록으로
          </button>

          <article className="border-t border-slate-300">
            <div className="border-b border-slate-200 bg-[#F7F8FA] px-5 py-5">
              <div className="mb-3 flex items-center gap-2">
                <DisasterTypeBadge message={selectedMessage} />
                {selectedMessage.emergencyLevel && (
                  <span className="text-[11px] font-semibold text-slate-500">{selectedMessage.emergencyLevel}</span>
                )}
              </div>

              <h2 className="text-[20px] font-extrabold leading-8 text-[#26384E]">{disasterTitle(selectedMessage)}</h2>
              <p className="mt-2 text-[12px] leading-5 text-slate-500">{disasterSummary(selectedMessage)}</p>
            </div>

            <div className="grid border-b border-slate-200 sm:grid-cols-2">
              <DetailInfo icon={Clock3} label="발송일시" value={formatDisasterDateTime(selectedMessage.createdAt)} />
              <DetailInfo icon={MapPin} label="송출지역" value={selectedMessage.region || "정보 없음"} />
              <DetailInfo icon={Megaphone} label="발송기관" value={extractSenderOrg(selectedMessage)} />
              <DetailInfo icon={ShieldAlert} label="긴급단계" value={selectedMessage.emergencyLevel || "정보 없음"} />
            </div>

            <div className="min-h-[280px] border-b border-slate-200 px-5 py-8">
              <h3 className="text-[14px] font-extrabold text-[#26384E]">재난문자 내용</h3>
              <p className="mt-4 whitespace-pre-wrap break-keep text-[14px] leading-8 text-slate-700">
                {selectedMessage.message || "-"}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 py-6">
              <button
                type="button"
                onClick={onOpenShelters}
                className="h-10 border border-slate-300 bg-white px-5 text-[12px] font-bold text-slate-600 hover:border-[#0B5FB3] hover:text-[#0B5FB3]"
              >
                대피시설 찾기
              </button>
              <button
                type="button"
                onClick={onOpenReport}
                className="h-10 bg-[#0B2A52] px-5 text-[12px] font-bold text-white hover:bg-[#153D68]"
              >
                현장 제보하기
              </button>
            </div>
          </article>
        </>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(queryInput.trim());
              setPage(1);
            }}
            className="grid gap-3 border border-slate-200 bg-[#F7F9FC] p-4 sm:grid-cols-[150px_minmax(0,1fr)_76px]"
          >
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-10 border border-slate-300 bg-white px-3 text-[12px] text-slate-600 outline-none focus:border-[#0B5FB3]"
            >
              {MAIN_DISASTER_FILTERS.map((label) => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>

            <div className="relative min-w-0">
              <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="재난문자 내용 또는 지역을 검색하세요."
                className="h-10 w-full border border-slate-300 bg-white pl-3 pr-10 text-[12px] outline-none focus:border-[#0B5FB3]"
              />
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <button type="submit" className="h-10 bg-[#0B5FB3] text-[12px] font-bold text-white hover:bg-[#09539D]">
              검색
            </button>
          </form>

          <p className="mt-6 text-[12px] text-slate-500">
            전체 <strong className="font-bold text-[#0B5FB3]">{filteredMessages.length}</strong> 건
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed border-collapse text-[12px]">
              <thead>
                <tr className="border-y border-slate-300 bg-[#F7F8FA] text-slate-600">
                  <th className="w-[80px] px-3 py-3 font-bold">구분</th>
                  <th className="px-3 py-3 font-bold">재난문자</th>
                  <th className="w-[135px] px-3 py-3 font-bold">발송일시</th>
                  <th className="w-[150px] px-3 py-3 font-bold">송출지역</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="py-16 text-center text-slate-400">재난문자를 불러오는 중입니다.</td></tr>
                ) : error ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-red-500">
                      <div className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</div>
                    </td>
                  </tr>
                ) : visibleMessages.length === 0 ? (
                  <tr><td colSpan={4} className="py-16 text-center text-slate-400">조건에 맞는 재난문자가 없습니다.</td></tr>
                ) : (
                  visibleMessages.map((message) => (
                    <tr
                      key={messageKey(message)}
                      onClick={() => setSelectedMessage(message)}
                      className="cursor-pointer border-b border-slate-200 hover:bg-slate-50"
                    >
                      <td className="px-3 py-4 text-center"><DisasterTypeBadge message={message} /></td>
                      <td className="px-3 py-4 text-left">
                        <strong className="block truncate font-semibold text-[#26384E]">{disasterTitle(message)}</strong>
                        <span className="mt-1 block truncate text-[11px] text-slate-400">{disasterSummary(message)}</span>
                      </td>
                      <td className="px-3 py-4 text-center text-slate-500">{formatDisasterDateTime(message.createdAt)}</td>
                      <td className="px-3 py-4 text-center text-slate-500"><span className="block truncate">{message.region || "-"}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && !error && filteredMessages.length > 0 && (
            <div className="mt-7 flex items-center justify-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-400 disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`h-8 min-w-8 border px-2 text-[11px] font-bold ${
                    pageNumber === safePage
                      ? "border-[#0B5FB3] bg-[#0B5FB3] text-white"
                      : "border-slate-200 bg-white text-slate-500 hover:border-[#0B5FB3] hover:text-[#0B5FB3]"
                  }`}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-400 disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </ServicePageLayout>
  );
}

function DetailInfo({ icon: Icon, label, value }) {
  return (
    <div className="flex min-h-[62px] items-center gap-3 border-b border-slate-100 px-5 py-3 sm:border-r sm:odd:border-r">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-blue-50 text-[#0B5FB3]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <span className="block text-[10px] font-bold text-slate-400">{label}</span>
        <strong className="mt-1 block break-keep text-[12px] font-semibold text-[#26384E]">{value}</strong>
      </div>
    </div>
  );
}
