import { useEffect, useState } from "react";
import { User, Users, Bell, MapPin, Camera, Lock } from "lucide-react";
import { authFetch, authUpload } from "../../api/client";
import { formatPhoneNumber, ROLE_LABEL, SAFETY_STATUS_STYLE, SAFETY_STATUS_LABEL } from "./constants";
import PasswordChangeModal from "./PasswordChangeModal";

// ---- 내 정보 --------------------------------------------------------------

export default function InfoTab({
  member: initialMember, memberLoading, memberError, onSaved,
  families, familiesLoading, latestStatusFor, regions,
  onGoToFamily, onGoToRegions, onGoToNotify,
}) {
  const [draft, setDraft] = useState(initialMember);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    if (initialMember) setDraft(initialMember);
  }, [initialMember]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await authFetch("/api/mypage", {
        method: "PUT",
        body: JSON.stringify({
          name: draft.name,
          phone: draft.phone,
          address: draft.address,
          addressDetail: draft.addressDetail,
          profileImageUrl: draft.profileImageUrl,
        }),
      });
      setSuccess("저장되었습니다.");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(initialMember);
    setError("");
    setSuccess("");
  };

  const handleProfileImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { url } = await authUpload("/api/uploads", formData);
      setDraft((prev) => ({ ...prev, profileImageUrl: url }));
      // 프로필 사진은 바로 저장 - 폼 전체 저장 누르기 전까지 기다릴 필요 없게
      await authFetch("/api/mypage", {
        method: "PUT",
        body: JSON.stringify({ ...draft, profileImageUrl: url }),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  const openAddressSearch = () => {
    if (!window.daum || !window.daum.Postcode) {
      alert("주소 검색 스크립트를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        setDraft((prev) => ({ ...prev, address: data.roadAddress || data.address }));
      },
    }).open();
  };

  if (memberLoading) return <p className="text-sm text-slate-400">불러오는 중...</p>;
  if (!draft) return <p className="text-sm text-red-500">{memberError || "정보를 불러오지 못했습니다."}</p>;

  const previewFamilies = families.slice(0, 3);
  const previewRegions = regions.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 왼쪽: 프로필 정보 요약 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-[#0F2540] mb-1 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center"><User className="w-4 h-4" /></span>
            프로필 정보
          </h3>
          <p className="text-xs text-slate-400 mb-5 ml-9">내 프로필 정보를 관리할 수 있습니다.</p>

          <div className="flex items-center gap-4 mb-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-100 to-indigo-100 overflow-hidden flex items-center justify-center shrink-0 border-2 border-slate-200">
              {draft.profileImageUrl ? (
                <img src={`http://localhost:8080${draft.profileImageUrl}`} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-sky-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#0F2540]">{draft.name}</span>
                <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                  {ROLE_LABEL[draft.role] || draft.role}
                </span>
              </div>
            </div>
          </div>

          <ul className="space-y-3 text-sm text-slate-600 mb-6">
            <li className="flex items-center gap-2"><span className="text-slate-400 w-16 shrink-0">이메일</span>{draft.email || "-"}</li>
            <li className="flex items-center gap-2"><span className="text-slate-400 w-16 shrink-0">전화번호</span>{draft.phone || "-"}</li>
            <li className="flex items-center gap-2"><span className="text-slate-400 w-16 shrink-0">거주 지역</span>{draft.address || "-"}</li>
            {draft.addressDetail && (
              <li className="flex items-center gap-2"><span className="text-slate-400 w-16 shrink-0">상세주소</span>{draft.addressDetail}</li>
            )}
          </ul>

          <div className="flex gap-2 mt-6">
            <label className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#0F2540] border border-slate-200 rounded-lg py-2.5 cursor-pointer hover:bg-sky-50 hover:border-sky-200">
              <Camera className="w-3.5 h-3.5" /> 프로필 이미지 변경
              <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageChange} />
            </label>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#0F2540] border border-slate-200 rounded-lg py-2.5 hover:bg-sky-50 hover:border-sky-200 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" /> 비밀번호 변경
            </button>
          </div>
        </div>

        {/* 오른쪽: 기본 정보 수정 폼 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-[#0F2540] mb-1 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center"><Lock className="w-4 h-4" /></span>
            기본 정보
          </h3>
          <p className="text-xs text-slate-400 mb-5 ml-9">정확한 정보는 재난 상황 시 신속한 도움을 받을 수 있도록 도와줍니다.</p>

          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">이름</label>
                <input
                  type="text"
                  value={draft.name || ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">이메일</label>
                <input
                  type="email"
                  value={draft.email || ""}
                  disabled
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                  placeholder="example@email.com"
                />
                <p className="text-[11px] text-slate-400 mt-1 px-3">이메일은 변경할 수 없습니다.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">전화번호</label>
              <input
                type="text"
                value={draft.phone || ""}
                onChange={(e) => setDraft({ ...draft, phone: formatPhoneNumber(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                placeholder="010-1234-5678"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">주소</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={draft.address || ""}
                  onClick={openAddressSearch}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-pointer bg-white"
                  placeholder="클릭해서 주소 검색"
                />
                <button
                  type="button"
                  onClick={openAddressSearch}
                  className="text-xs font-semibold text-[#0F2540] border border-slate-200 rounded-lg px-3 hover:bg-slate-50 shrink-0 cursor-pointer"
                >
                  주소 검색
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">상세주소</label>
              <input
                type="text"
                value={draft.addressDetail || ""}
                onChange={(e) => setDraft({ ...draft, addressDetail: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
                placeholder="상세주소 입력"
              />
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">{success}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-[#0F2540] hover:bg-[#1B3A5C] text-white font-bold rounded-lg py-2.5 text-sm disabled:opacity-50 cursor-pointer"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg py-2.5 hover:bg-slate-50 cursor-pointer"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 미리보기 3분할 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-[#0F2540] flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-sky-100 text-sky-600 flex items-center justify-center"><Users className="w-3.5 h-3.5" /></span>
              가족 관리 미리보기
            </h3>
            <button onClick={onGoToFamily} className="text-xs text-sky-600 font-semibold hover:underline cursor-pointer">전체보기 →</button>
          </div>
          <p className="text-xs text-slate-400 mb-3">등록된 가족 {families.length}명의 안전을 지켜주세요.</p>
          {familiesLoading ? (
            <p className="text-xs text-slate-400">불러오는 중...</p>
          ) : previewFamilies.length === 0 ? (
            <p className="text-xs text-slate-400">등록된 가족이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {previewFamilies.map((f, i) => {
                const status = latestStatusFor(f.familyMemberId);
                const avatarColors = ["from-sky-100 to-blue-100 text-sky-500", "from-rose-100 to-pink-100 text-rose-500", "from-amber-100 to-orange-100 text-amber-500"];
                return (
                  <li key={f.relationId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 ${avatarColors[i % avatarColors.length]}`}>
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-slate-700 truncate">{f.familyMemberName} <span className="text-slate-400 font-normal">({f.familyMemberLoginId})</span></span>
                          <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-1 py-0.5 rounded">{f.relationType}</span>
                        </div>
                        {f.familyMemberPhone && <p className="text-[10px] text-slate-400">{f.familyMemberPhone}</p>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${status ? SAFETY_STATUS_STYLE[status] : "bg-slate-100 text-slate-400"}`}>
                      {status ? SAFETY_STATUS_LABEL[status] : "기록 없음"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-[#0F2540] flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center"><MapPin className="w-3.5 h-3.5" /></span>
              관심 지역
            </h3>
            <button onClick={onGoToRegions} className="text-xs text-sky-600 font-semibold hover:underline cursor-pointer">전체보기 →</button>
          </div>
          <p className="text-xs text-slate-400 mb-3">재난 정보를 받고 싶은 지역을 설정하세요.</p>
          <div className="flex flex-wrap gap-1.5">
            {previewRegions.length === 0 ? (
              <p className="text-xs text-slate-400">등록된 관심지역이 없습니다.</p>
            ) : (
              previewRegions.map((r) => (
                <span key={r.memberRegionId} className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-3 py-1.5">
                  {r.regionName}
                </span>
              ))
            )}
          </div>
          <button onClick={onGoToRegions} className="mt-3 text-xs font-semibold text-[#0F2540] hover:underline cursor-pointer">
            + 관심지역 추가
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-[#0F2540] flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center"><Bell className="w-3.5 h-3.5" /></span>
              알림 설정
            </h3>
            <button onClick={onGoToNotify} className="text-xs text-sky-600 font-semibold hover:underline cursor-pointer">전체보기 →</button>
          </div>
          <p className="text-xs text-slate-400 mb-3">중요한 재난 정보와 가족의 안전 알림을 받아보세요.</p>
          <ul className="space-y-2.5 text-xs">
            {[
              ["가족 안전확인 이메일", draft.emailNotifyEnabled],
              ["재난 알림", draft.disasterNotifyEnabled],
              ["내 제보 상태변경", draft.reportNotifyEnabled],
            ].map(([label, val]) => (
              <li key={label} className="flex items-center justify-between">
                <span className="text-slate-600">{label}</span>
                <span className={`inline-block w-8 h-[18px] rounded-full relative ${val === "Y" ? "bg-[#0F2540]" : "bg-slate-200"}`}>
                  <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition ${val === "Y" ? "right-0.5" : "left-0.5"}`} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {showPasswordModal && <PasswordChangeModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}
