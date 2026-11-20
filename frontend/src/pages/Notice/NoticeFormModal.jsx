import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { authFetch, authUpload } from "../../api/client";

export default function NoticeFormModal({ initialNotice, onClose, onSaved }) {
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
                <img src={imageUrl} alt="공지 첨부" className="h-full w-full object-contain" />
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
