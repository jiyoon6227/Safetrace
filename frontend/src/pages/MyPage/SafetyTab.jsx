import { useEffect, useState } from "react";
import { ShieldAlert, User, Users, CheckCircle2, AlertTriangle, Send, Clock, FileText } from "lucide-react";
import { authFetch } from "../../api/client";
import { SAFETY_STATUS_LABEL, SAFETY_STATUS_STYLE, SAFETY_STATUS_ICON, formatDateTimeFull, SAFETY_HISTORY_FILTERS } from "./constants";

// ---- 안전확인 이력 --------------------------------------------------------------

// 상태별 아이콘 + 색이 있는 배지 (보낸/받은 요청 표에서 공용으로 사용)
function SafetyStatusBadge({ status }) {
  const Icon = SAFETY_STATUS_ICON[status] || Clock;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${SAFETY_STATUS_STYLE[status] || "bg-slate-100 text-slate-500"}`}>
      <Icon className="w-3 h-3 shrink-0" />{SAFETY_STATUS_LABEL[status] || status}
    </span>
  );
}

export default function SafetyTab({ sentChecks, receivedChecks, families, onChanged }) {
  const SAFETY_PAGE_SIZE = 5;
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [sentPage, setSentPage] = useState(1);
  const [receivedPage, setReceivedPage] = useState(1);

  const respond = async (checkId, status) => {
    try {
      await authFetch(`/api/safety-checks/${checkId}/respond`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  // 상대방 id로 가족 관계 라벨(형제자매/친구 등)을 찾아 이름 아래 보조 텍스트로 표시
  const relationOf = (memberId) => families.find((f) => f.familyMemberId === memberId)?.relationType;

  const showSent = filter !== "received";
  const showReceived = filter !== "sent";

  const sentTotalPages = Math.max(1, Math.ceil(sentChecks.length / SAFETY_PAGE_SIZE));
  const receivedTotalPages = Math.max(1, Math.ceil(receivedChecks.length / SAFETY_PAGE_SIZE));

  const pagedSentChecks = sentChecks.slice(
    (sentPage - 1) * SAFETY_PAGE_SIZE,
    sentPage * SAFETY_PAGE_SIZE
  );
  const pagedReceivedChecks = receivedChecks.slice(
    (receivedPage - 1) * SAFETY_PAGE_SIZE,
    receivedPage * SAFETY_PAGE_SIZE
  );

  useEffect(() => {
    if (sentPage > sentTotalPages) setSentPage(sentTotalPages);
  }, [sentPage, sentTotalPages]);

  useEffect(() => {
    if (receivedPage > receivedTotalPages) setReceivedPage(receivedTotalPages);
  }, [receivedPage, receivedTotalPages]);

  const renderPagination = (currentPage, totalPages, setPage) => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-slate-100 bg-white">
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className={`w-8 h-8 rounded-lg border text-sm font-bold transition ${
            currentPage === 1
              ? "border-slate-200 text-slate-300 cursor-not-allowed"
              : "border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
          }`}
        >
          ‹
        </button>

        {Array.from({ length: totalPages }, (_, index) => {
          const page = index + 1;
          return (
            <button
              key={page}
              type="button"
              onClick={() => setPage(page)}
              className={`min-w-8 h-8 px-2 rounded-lg text-sm font-bold transition cursor-pointer ${
                currentPage === page
                  ? "bg-[#0F2540] text-white"
                  : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {page}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className={`w-8 h-8 rounded-lg border text-sm font-bold transition ${
            currentPage === totalPages
              ? "border-slate-200 text-slate-300 cursor-not-allowed"
              : "border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
          }`}
        >
          ›
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#0F2540] flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0" /> 안전확인 이력
        </h2>
        <p className="text-sm text-slate-500 mt-1">가족과 지인에게 보낸 요청과 받은 요청을 확인할 수 있습니다.</p>
      </div>

      <div className="flex gap-2">
        {SAFETY_HISTORY_FILTERS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setFilter(t.key);
              setSentPage(1);
              setReceivedPage(1);
            }}
            className={`text-sm font-bold px-4 py-2 rounded-full transition cursor-pointer ${
              filter === t.key ? "bg-[#0F2540] text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {showSent && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[#0F2540]">내가 보낸 요청</h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate">내가 보낸 안전확인 요청 내역입니다.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full shrink-0">총 {sentChecks.length}건</span>
          </div>

          {sentChecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
              <FileText className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">아직 보낸 안전확인 요청이 없어요.</p>
              <p className="text-xs text-slate-300 mt-0.5">가족이나 지인에게 안전 여부를 확인해보세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[24%]" />
                  <col className="w-[20%]" />
                  <col className="w-[28%]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-bold text-slate-500 tracking-wide">
                    <th className="pl-[70px] pr-5 py-3 align-middle text-left">대상</th>
                    <th className="px-5 py-3 align-middle whitespace-nowrap text-center">요청 시간</th>
                    <th className="px-5 py-3 align-middle whitespace-nowrap text-center">상태</th>
                    <th className="px-5 py-3 align-middle whitespace-nowrap text-center">응답 시간</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSentChecks.map((c) => (
                    <tr key={c.checkId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                      <td className="px-7 py-3 align-middle">
                        <div className="flex items-center justify-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 text-left">
                            <p className="text-sm font-semibold text-slate-700 truncate">
                              {c.targetMemberName} <span className="text-xs font-medium text-slate-400">({relationOf(c.targetMemberId) || "지인"})</span>
                            </p>
                            {c.incidentTitle && (
                              <p className="text-[11px] text-slate-400 truncate">{c.incidentTitle}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 align-middle text-center text-xs text-slate-500 whitespace-nowrap">{formatDateTimeFull(c.requestedAt)}</td>
                      <td className="px-5 py-3 align-middle text-center whitespace-nowrap"><div className="flex justify-center"><SafetyStatusBadge status={c.status} /></div></td>
                      <td className="px-5 py-3 align-middle text-center text-xs text-slate-500 whitespace-nowrap">{c.confirmedAt ? formatDateTimeFull(c.confirmedAt) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sentChecks.length > 0 && renderPagination(sentPage, sentTotalPages, setSentPage)}
        </div>
      )}

      {showReceived && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[#0F2540]">내가 받은 요청</h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate">다른 사람이 나에게 보낸 안전확인 요청 내역입니다.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full shrink-0">총 {receivedChecks.length}건</span>
          </div>

          {receivedChecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
              <Users className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">아직 받은 안전확인 요청이 없어요.</p>
              <p className="text-xs text-slate-300 mt-0.5">요청이 오면 여기서 확인하고 응답할 수 있어요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[24%]" />
                  <col className="w-[20%]" />
                  <col className="w-[28%]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-bold text-slate-500 tracking-wide">
                    <th className="pl-[70px] pr-5 py-3 align-middle text-left">요청자</th>
                    <th className="px-5 py-3 align-middle whitespace-nowrap text-center">요청 시간</th>
                    <th className="px-5 py-3 align-middle whitespace-nowrap text-center">상태</th>
                    <th className="px-5 py-3 align-middle whitespace-nowrap text-center">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedReceivedChecks.map((c) => (
                    <tr key={c.checkId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                      <td className="px-7 py-3 align-middle">
                        <div className="flex items-center justify-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 text-left">
                            <p className="text-sm font-semibold text-slate-700 truncate">
                              {c.requesterName} <span className="text-xs font-medium text-slate-400">({relationOf(c.requesterId) || "지인"})</span>
                            </p>
                            {c.incidentTitle && (
                              <p className="text-[11px] text-slate-400 truncate">{c.incidentTitle}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 align-middle text-center text-xs text-slate-500 whitespace-nowrap">{formatDateTimeFull(c.requestedAt)}</td>
                      <td className="px-5 py-3 align-middle text-center whitespace-nowrap"><div className="flex justify-center"><SafetyStatusBadge status={c.status} /></div></td>
                      <td className="px-5 py-3 align-middle text-center whitespace-nowrap">
                        {c.status === "PENDING" ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => respond(c.checkId, "SAFE")}
                              className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-3 py-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> 안전해요
                            </button>
                            <button
                              onClick={() => respond(c.checkId, "HELP")}
                              className="flex items-center gap-1 text-xs font-bold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 cursor-pointer"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" /> 도움이 필요해요
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {receivedChecks.length > 0 && renderPagination(receivedPage, receivedTotalPages, setReceivedPage)}
        </div>
      )}
    </div>
  );
}
