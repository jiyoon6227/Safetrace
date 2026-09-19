import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Home,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { authFetch, authUpload, getCurrentUser } from "../api/client";
import SiteHeader from "../components/SiteHeader";
import { buildServiceSidebarItems } from "../components/ServicePageLayout";

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

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${hh}:${mm}`;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function NoticeTypeBadge({ type }) {
  const meta = NOTICE_TYPE_META[type] || NOTICE_TYPE_META.NORMAL;
  return (
    <span className={`inline-flex min-w-[42px] items-center justify-center rounded-[3px] border px-2 py-1 text-[11px] font-semibold leading-none ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function NoticeFormModal({ initialNotice, onClose, onSaved }) {
  const isEdit = !!initialNotice;
  const [title, setTitle] = useState(initialNotice?.title || "");
  const [content, setContent] = useState(initialNotice?.content || "");
  const [noticeType, setNoticeType] = useState(initialNotice?.noticeType || "NORMAL");
  const [isPinned, setIsPinned] = useState(initialNotice?.isPinned === "Y");
  const [imageUrl, setImageUrl] = useState(initialNotice?.noticeImageUrl || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 첨부할 수 있습니다.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await authUpload("/api/uploads", formData);
      setImageUrl(result.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 입력해주세요.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        noticeType,
        isPinned: isPinned ? "Y" : "N",
        noticeImageUrl: imageUrl || null,
      };

      const saved = isEdit
        ? await authFetch(`/api/notices/${initialNotice.noticeId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await authFetch("/api/notices", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      onSaved(saved, isEdit);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <div className="max-h-[92vh] w-full max-w-[650px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-extrabold text-[#0B2A52]">{isEdit ? "공지사항 수정" : "공지사항 등록"}</h2>
            <p className="mt-1 text-[11px] text-slate-400">등록된 공지는 로그인 여부와 관계없이 공개됩니다.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">구분</label>
              <select
                value={noticeType}
                onChange={(e) => setNoticeType(e.target.value)}
                className="h-11 w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0B2A52]"
              >
                <option value="NORMAL">안내</option>
                <option value="URGENT">긴급</option>
                <option value="MAINTENANCE">점검</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">제목</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0B2A52]"
                placeholder="공지 제목을 입력하세요."
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-[#0B5FB3]"
            />
            <span>
              <span className="block text-xs font-bold text-[#26384E]">목록 상단 고정</span>
              <span className="mt-0.5 block text-[10px] text-slate-400">
                STAFF가 체크하면 이 공지가 일반 공지보다 위에 표시됩니다.
              </span>
            </span>
          </label>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600">내용</label>
              <span className="text-[10px] text-slate-400">{content.length}/2000</span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              rows={9}
              className="w-full resize-none rounded-md border border-slate-300 px-3 py-3 text-sm leading-6 outline-none focus:border-[#0B2A52]"
              placeholder="공지 내용을 입력하세요."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-600">첨부 이미지 (선택 · 1장)</label>
            {imageUrl ? (
              <div className="relative h-52 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                <img src={`http://localhost:8080${imageUrl}`} alt="공지 첨부" className="h-full w-full object-contain" />
                <button type="button" onClick={() => setImageUrl("")} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex h-24 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500 hover:bg-slate-100">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploading ? "업로드 중..." : "이미지 선택"}
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={uploading} />
              </label>
            )}
          </div>

          {error && <p className="border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
            <button type="button" onClick={onClose} className="h-10 cursor-pointer rounded-md border border-slate-300 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50">취소</button>
            <button type="submit" disabled={saving || uploading} className="h-10 cursor-pointer rounded-md bg-[#0B2A52] px-5 text-sm font-bold text-white hover:bg-[#153d68] disabled:opacity-50">
              {saving ? "저장 중..." : isEdit ? "수정" : "등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NoticePage({ onBackToHome, onNavigate, initialNoticeId = null }) {
  const currentUser = getCurrentUser();
  const isStaff = currentUser?.role === "STAFF";

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
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
    setPage(1);
  }, [filter, searchQuery]);

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

  const totalPages = Math.max(1, Math.ceil(filteredNotices.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedNotices = filteredNotices.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  const move = (pageName, state = {}) => {
    if (typeof onNavigate === "function") {
      onNavigate(pageName, state);
    }
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
                            <td className="px-3 py-3.5 text-center text-slate-500">{formatDate(notice.createdAt)}</td>
                            <td className="px-3 py-3.5 text-center text-slate-500">{notice.viewCount ?? 0}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {!loading && filteredNotices.length > 0 && (
                <div className="mt-7 flex items-center justify-center gap-1">
                  <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-400 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNo) => (
                    <button key={pageNo} type="button" onClick={() => setPage(pageNo)} className={`h-8 min-w-8 border px-2 text-[11px] font-bold ${safePage === pageNo ? "border-[#0B5FB3] bg-[#0B5FB3] text-white" : "border-slate-200 bg-white text-slate-500 hover:border-[#0B5FB3] hover:text-[#0B5FB3]"}`}>{pageNo}</button>
                  ))}
                  <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-400 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
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
                          <span>등록일 : {formatDateTime(selectedNotice.createdAt)}</span>
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
                      <img src={`http://localhost:8080${selectedNotice.noticeImageUrl}`} alt="공지 첨부" className="mx-auto max-h-[520px] max-w-full object-contain" />
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
