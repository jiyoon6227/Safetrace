import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  Home,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { authFetch, getCurrentUser } from "../api/client";
import SiteHeader from "../components/SiteHeader";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "./ControlBoard/TablePagination";
import { buildServiceSidebarItems } from "../components/ServicePageLayout";
import { formatDotDate, formatDotDateTime } from "../utils/dateFormat";
import NoticeFormModal from "./Notice/NoticeFormModal";

const PAGE_SIZE = 10;

const NOTICE_TYPE_META = {
  NORMAL: {
    label: "안내",
    className: "border-slate-300 bg-slate-50 text-slate-600",
  },
  URGENT: {
    label: "긴급",
    className: "border-red-200 bg-red-50 text-red-600",
  },
  MAINTENANCE: {
    label: "점검",
    className: "border-blue-200 bg-blue-50 text-blue-600",
  },
};

const FILTERS = [
  { key: "ALL", label: "전체" },
  { key: "URGENT", label: "긴급" },
  { key: "MAINTENANCE", label: "점검" },
  { key: "NORMAL", label: "안내" },
];

function NoticeTypeBadge({ type }) {
  const meta = NOTICE_TYPE_META[type] || NOTICE_TYPE_META.NORMAL;
  return (
    <span className={`inline-flex min-w-[42px] items-center justify-center rounded-[3px] border px-2 py-1 text-[11px] font-semibold leading-none ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export default function NoticePage({ onNavigate, initialNoticeId = null }) {
  const currentUser = getCurrentUser();
  const isStaff = currentUser?.role === "STAFF";

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNoticeId, setSelectedNoticeId] = useState(initialNoticeId);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);

  const loadNotices = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await authFetch("/api/notices");
      setNotices(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, []);

  useEffect(() => {
    if (selectedNoticeId == null) {
      setSelectedNotice(null);
      return;
    }

    setDetailLoading(true);
    setError("");
    authFetch(`/api/notices/${selectedNoticeId}`)
      .then((notice) => {
        setSelectedNotice(notice);
        setNotices((prev) => prev.map((item) => item.noticeId === notice.noticeId ? { ...item, viewCount: notice.viewCount } : item));
      })
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false));
  }, [selectedNoticeId]);

  const filteredNotices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notices.filter((notice) => {
      const matchType = filter === "ALL" || notice.noticeType === filter;
      const matchSearch = !q || `${notice.title || ""} ${notice.content || ""} ${notice.writerName || ""}`.toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [notices, filter, searchQuery]);

  const { page: safePage, setPage, totalPages, pageItems: pagedNotices } = usePagination(filteredNotices, PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter, searchQuery, setPage]);

  const selectedNoticeIndex = useMemo(() => {
    if (selectedNoticeId == null) return -1;
    return notices.findIndex((notice) => notice.noticeId === selectedNoticeId);
  }, [notices, selectedNoticeId]);

  const previousNotice = selectedNoticeIndex > 0 ? notices[selectedNoticeIndex - 1] : null;
  const nextNotice = selectedNoticeIndex >= 0 && selectedNoticeIndex < notices.length - 1
    ? notices[selectedNoticeIndex + 1]
    : null;

  const openDetail = (noticeId) => {
    setSelectedNoticeId(noticeId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeDetail = () => {
    setSelectedNoticeId(null);
    setSelectedNotice(null);
  };

  const handleDelete = async (noticeId) => {
    if (!window.confirm("이 공지를 삭제하시겠습니까?")) return;
    try {
      await authFetch(`/api/notices/${noticeId}`, { method: "DELETE" });
      closeDetail();
      await loadNotices();
    } catch (err) {
      window.alert(err.message);
    }
  };

  const handleSaved = async (savedNotice, wasEdit) => {
    setFormOpen(false);
    setEditingNotice(null);
    if (wasEdit && selectedNoticeId === savedNotice?.noticeId) {
      setSelectedNotice(savedNotice);
    }
    await loadNotices();
  };

  const sidebarItems = buildServiceSidebarItems("notices", onNavigate).map((item) =>
    item.key === "notices"
      ? { ...item, onClick: () => closeDetail() }
      : item
  );

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <SiteHeader active="notices" onNavigate={onNavigate} />

      <div className="border-b border-blue-100 bg-[#EDF4FB]">
        <div className="mx-auto flex h-11 max-w-[1180px] items-center gap-2 px-6 text-[11px] text-slate-500">
          <Home className="h-3.5 w-3.5" />
          <ChevronRight className="h-3 w-3" />
          <span>서비스 안내</span>
          <ChevronRight className="h-3 w-3" />
          <strong className="font-bold text-blue-700">공지사항</strong>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1180px] gap-10 px-6 py-12 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <h2 className="border-b-2 border-[#0B5FB3] pb-3 text-[22px] font-extrabold text-[#0B2A52]">서비스 안내</h2>
          <nav className="mt-3 border-t border-slate-200">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={`flex w-full cursor-pointer items-center justify-between border-b border-slate-200 px-3 py-3.5 text-left text-[13px] font-semibold transition-colors ${item.active ? "bg-[#1269C7] text-white" : "bg-white text-slate-600 hover:bg-slate-50 hover:text-[#0B5FB3]"}`}
              >
                <span>{item.label}</span>
                {item.active && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          {selectedNoticeId == null ? (
            <>
              <div className="flex flex-col gap-4 border-b-2 border-[#26384E] pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-[30px] font-extrabold tracking-tight text-[#17283E]">공지사항</h1>
                  <p className="mt-2 text-[12px] text-slate-500">세이프트레이스의 운영 소식과 주요 안내사항을 확인할 수 있습니다.</p>
                </div>
                {isStaff && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNotice(null);
                      setFormOpen(true);
                    }}
                    className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[#0B2A52] px-4 text-xs font-bold text-white hover:bg-[#153d68]"
                  >
                    <Plus className="h-4 w-4" /> 공지 등록
                  </button>
                )}
              </div>

              <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] text-slate-500">
                  전체게시물 : <strong className="font-bold text-[#0B5FB3]">{filteredNotices.length}</strong> 건
                </p>

                <div className="flex w-full gap-2 sm:w-auto">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="h-10 min-w-[96px] cursor-pointer border border-slate-300 bg-white px-3 text-xs text-slate-600 outline-none focus:border-[#0B5FB3]"
                  >
                    {FILTERS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </select>
                  <div className="relative min-w-0 flex-1 sm:w-[260px]">
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="검색어를 입력하세요."
                      className="h-10 w-full border border-slate-300 bg-white pl-3 pr-10 text-xs outline-none focus:border-[#0B5FB3]"
                    />
                    <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[760px] table-fixed border-collapse text-[12px]">
                  <thead>
                    <tr className="border-y border-slate-300 bg-[#F7F8FA] text-slate-600">
                      <th className="w-[72px] px-3 py-3 font-bold">번호</th>
                      <th className="w-[78px] px-3 py-3 font-bold">구분</th>
                      <th className="px-3 py-3 font-bold">제목</th>
                      <th className="w-[105px] px-3 py-3 font-bold">작성자</th>
                      <th className="w-[110px] px-3 py-3 font-bold">등록일</th>
                      <th className="w-[80px] px-3 py-3 font-bold">조회수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="py-16 text-center text-slate-400"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />불러오는 중...</span></td></tr>
                    ) : error ? (
                      <tr><td colSpan={6} className="py-16 text-center text-red-500">{error}</td></tr>
                    ) : pagedNotices.length === 0 ? (
                      <tr><td colSpan={6} className="py-16 text-center text-slate-400">등록된 공지사항이 없습니다.</td></tr>
                    ) : (
                      pagedNotices.map((notice, index) => {
                        const number = filteredNotices.length - ((safePage - 1) * PAGE_SIZE + index);
                        return (
                          <tr key={notice.noticeId} onClick={() => openDetail(notice.noticeId)} className="cursor-pointer border-b border-slate-200 hover:bg-slate-50">
                            <td className="px-3 py-3.5 text-center text-slate-500">{number}</td>
                            <td className="px-3 py-3.5 text-center"><NoticeTypeBadge type={notice.noticeType} /></td>
                            <td className="px-3 py-3.5 text-left font-semibold text-[#26384E]"><span className="block truncate">{notice.title}</span></td>
                            <td className="px-3 py-3.5 text-center text-slate-500">{notice.writerName || "담당자"}</td>
                            <td className="px-3 py-3.5 text-center text-slate-500">{formatDotDate(notice.createdAt)}</td>
                            <td className="px-3 py-3.5 text-center text-slate-500">{notice.viewCount ?? 0}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {!loading && filteredNotices.length > 0 && (
                <TablePagination variant="square" currentPage={safePage} totalPages={totalPages} setPage={setPage} />
              )}
            </>
          ) : (
            <>
              <div className="flex items-end justify-between border-b border-slate-300 pb-4">
                <h1 className="text-[30px] font-extrabold tracking-tight text-[#17283E]">공지사항</h1>
                <div className="hidden items-center gap-1 text-[11px] text-slate-400 sm:flex">
                  <Home className="h-3.5 w-3.5" />
                  <ChevronRight className="h-3 w-3" />
                  <span>서비스 안내</span>
                  <ChevronRight className="h-3 w-3" />
                  <strong className="font-semibold text-slate-600">공지사항</strong>
                </div>
              </div>

              {detailLoading || !selectedNotice ? (
                <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중...</div>
              ) : (
                <article className="mt-6">
                  <div className="border-y border-slate-300 px-2 py-5 sm:px-3">
                    <div className="mb-3"><NoticeTypeBadge type={selectedNotice.noticeType} /></div>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h2 className="text-[19px] font-extrabold leading-8 text-[#1E2D40]">{selectedNotice.title}</h2>
                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-500">
                          <span>작성자 : {selectedNotice.writerName || "담당자"}</span>
                          <span>등록일 : {formatDotDateTime(selectedNotice.createdAt)}</span>
                          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> 조회수 : {selectedNotice.viewCount ?? 0}</span>
                        </div>
                      </div>
                      {isStaff && (
                        <div className="flex shrink-0 gap-2">
                          <button type="button" onClick={() => { setEditingNotice(selectedNotice); setFormOpen(true); }} className="h-9 border border-slate-300 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50">수정</button>
                          <button type="button" onClick={() => handleDelete(selectedNotice.noticeId)} className="h-9 border border-slate-300 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50">삭제</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedNotice.noticeImageUrl && (
                    <div className="border-b border-slate-200 bg-[#FAFAFA] px-3 py-3">
                      <img src={selectedNotice.noticeImageUrl} alt="공지 첨부" className="mx-auto max-h-[520px] max-w-full object-contain" />
                    </div>
                  )}

                  <div className="min-h-[300px] border-b border-slate-200 px-3 py-8 sm:py-10">
                    <p className="whitespace-pre-wrap text-[13px] leading-7 text-slate-700">{selectedNotice.content}</p>
                  </div>

                  <div className="mt-7 border-y border-slate-200 text-[12px]">
                    <div className="grid min-h-[46px] grid-cols-[92px_minmax(0,1fr)] items-center border-b border-slate-200">
                      <div className="flex items-center gap-2 px-3 font-semibold text-slate-500">
                        <span>이전글</span>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </div>
                      {previousNotice ? (
                        <button
                          type="button"
                          onClick={() => openDetail(previousNotice.noticeId)}
                          className="min-w-0 cursor-pointer px-3 text-left text-slate-600 hover:text-[#0B5FB3]"
                        >
                          <span className="block truncate">{previousNotice.title}</span>
                        </button>
                      ) : (
                        <div className="px-3 text-slate-400">이전글이 존재하지 않습니다.</div>
                      )}
                    </div>

                    <div className="grid min-h-[46px] grid-cols-[92px_minmax(0,1fr)] items-center">
                      <div className="flex items-center gap-2 px-3 font-semibold text-slate-500">
                        <span>다음글</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </div>
                      {nextNotice ? (
                        <button
                          type="button"
                          onClick={() => openDetail(nextNotice.noticeId)}
                          className="min-w-0 cursor-pointer px-3 text-left text-slate-600 hover:text-[#0B5FB3]"
                        >
                          <span className="block truncate">{nextNotice.title}</span>
                        </button>
                      ) : (
                        <div className="px-3 text-slate-400">다음글이 존재하지 않습니다.</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={closeDetail}
                      className="h-10 min-w-[62px] border border-slate-400 bg-white px-4 text-xs font-bold text-slate-600 hover:border-[#0B5FB3] hover:text-[#0B5FB3]"
                    >
                      목록
                    </button>
                  </div>
                </article>
              )}
            </>
          )}
        </section>
      </main>

      {formOpen && (
        <NoticeFormModal
          initialNotice={editingNotice}
          onClose={() => {
            setFormOpen(false);
            setEditingNotice(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
