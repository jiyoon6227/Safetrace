import { useEffect, useState } from "react";
import { ShieldAlert, Users, Trash2, UserPlus, User, X } from "lucide-react";
import { authFetch } from "../../api/client";
import { RELATION_TYPES, SAFETY_STATUS_STYLE, SAFETY_STATUS_LABEL, formatDateTime } from "./constants";

// ---- 가족 관리 --------------------------------------------------------------

export default function FamilyTab({ families, familiesLoading, onChanged, latestStatusFor }) {
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [relationType, setRelationType] = useState("가족");
  const [requestingSafetyId, setRequestingSafetyId] = useState(null);

  const loadRequests = () => {
    setLoading(true);
    setError("");
    Promise.all([authFetch("/api/family/sent"), authFetch("/api/family/received")])
      .then(([s, r]) => {
        setSent(s);
        setReceived(r);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadRequests, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await authFetch(`/api/family/search?loginId=${encodeURIComponent(searchQuery)}`);
      setSearchResults(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (targetLoginId) => {
    setError("");
    try {
      await authFetch("/api/family/request", {
        method: "POST",
        body: JSON.stringify({ targetLoginId, relationType }),
      });
      setSearchResults([]);
      setSearchQuery("");
      loadRequests();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const accept = async (relationId) => {
    try {
      await authFetch(`/api/family/${relationId}/accept`, { method: "PATCH" });
      loadRequests();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (relationId) => {
    try {
      await authFetch(`/api/family/${relationId}`, { method: "DELETE" });
      loadRequests();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  // 이 사람 한 명한테만 바로 안전확인 요청 (일반 요청, 특정 사건과 무관)
  const requestSafetyCheck = async (targetMemberId) => {
    setRequestingSafetyId(targetMemberId);
    try {
      await authFetch("/api/safety-checks", {
        method: "POST",
        body: JSON.stringify({ targetMemberIds: [targetMemberId], incidentId: null }),
      });
      alert("안전확인 요청을 보냈습니다.");
    } catch (err) {
      setError(err.message);
    } finally {
      setRequestingSafetyId(null);
    }
  };

  if (loading) return <p className="text-sm text-slate-400">불러오는 중...</p>;

  const pendingSentCount = sent.filter((s) => s.status === "PENDING").length;

  // 화면에 한 목록으로 합쳐서 보여줄 항목들: 등록된 가족(ACCEPTED) + 내가 보낸 대기중 요청(PENDING)
  const combinedList = [
    ...families.map((f) => ({ ...f, kind: "ACCEPTED" })),
    ...sent.filter((s) => s.status === "PENDING").map((s) => ({ ...s, kind: "PENDING_SENT" })),
  ];

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div>
        <h2 className="text-xl font-extrabold text-[#0F2540]">가족 관리</h2>
        <p className="text-sm text-slate-500">가족을 등록하고 안전확인 요청을 보낼 수 있습니다.</p>
      </div>

      {/* 통계 카드 2개 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">등록된 가족</p>
            <p className="text-xl font-extrabold text-[#0F2540]">{families.length}명</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">대기 중인 요청</p>
            <p className="text-xl font-extrabold text-[#0F2540]">{received.length}건</p>
          </div>
        </div>
      </div>

      {/* 나한테 온 요청 - 수락 필요 (실사용에 꼭 필요한 부분이라 별도로 눈에 띄게) */}
      {received.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-sm p-5">
          <h3 className="font-bold text-[#0F2540] mb-3">나한테 온 요청 - 수락 대기</h3>
          <ul className="space-y-2">
            {received.map((r) => (
              <li key={r.relationId} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200">
                <span className="text-sm text-slate-700">
                  {r.familyMemberName} <span className="text-slate-400">({r.familyMemberLoginId})</span> · {r.relationType}(으)로 등록 요청
                </span>
                <button
                  onClick={() => accept(r.relationId)}
                  className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-1.5 cursor-pointer"
                >
                  수락
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 가족 추가하기 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-[#0F2540] mb-1 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center"><UserPlus className="w-4 h-4" /></span>
          가족 추가하기
        </h3>
        <p className="text-xs text-slate-400 mb-3 ml-9">함께할 가족의 로그인 ID를 검색하여 가족 등록 요청을 보낼 수 있습니다.</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="상대방 로그인ID를 입력하세요"
              className="w-full border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:border-[#0F2540]"
            />
            {(searchQuery || searchResults.length > 0) && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={relationType}
            onChange={(e) => setRelationType(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 text-sm focus:outline-none focus:border-[#0F2540]"
          >
            {RELATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="text-sm font-semibold text-white bg-[#0F2540] hover:bg-[#1B3A5C] rounded-lg px-4 disabled:opacity-50 cursor-pointer"
          >
            검색
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">검색 결과</p>
            <ul className="space-y-2">
              {searchResults.map((m) => (
                <li key={m.memberId} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sky-500">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{m.name} ({m.loginId})</span>
                  </div>
                  <button
                    onClick={() => sendRequest(m.loginId)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg px-3 py-2 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> 가족 요청 보내기
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 등록된 가족 + 보낸 요청(대기중) 통합 목록 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[#0F2540]">등록된 가족 {families.length > 0 && `${families.length}명`}</h3>
        </div>
        {familiesLoading ? (
          <p className="text-sm text-slate-400">불러오는 중...</p>
        ) : combinedList.length === 0 ? (
          <p className="text-sm text-slate-400">등록된 가족이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {combinedList.map((f) => {
              const isPending = f.kind === "PENDING_SENT";
              const status = !isPending ? latestStatusFor(f.familyMemberId) : null;
              return (
                <li key={f.relationId} className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-700">
                          {f.familyMemberName} <span className="text-slate-400 font-normal">({f.familyMemberLoginId})</span>
                        </span>
                        {isPending ? (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">대기중</span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">가족</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {f.relationType} · {formatDateTime(f.createdAt)} {isPending ? "요청" : "등록"}
                        {f.familyMemberPhone && ` · ${f.familyMemberPhone}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isPending && status && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${SAFETY_STATUS_STYLE[status]}`}>
                        {SAFETY_STATUS_LABEL[status]}
                      </span>
                    )}
                    {isPending ? (
                      <button
                        onClick={() => remove(f.relationId)}
                        className="text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 cursor-pointer"
                      >
                        요청 취소
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => requestSafetyCheck(f.familyMemberId)}
                          disabled={requestingSafetyId === f.familyMemberId}
                          className="flex items-center gap-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg px-3 py-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" /> 안전확인 요청
                        </button>
                        <button
                          onClick={() => remove(f.relationId)}
                          className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg px-3 py-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> 삭제
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 안내 박스 */}
      <div className="bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
        <h3 className="font-bold text-[#0F2540] mb-2">가족 관리 안내</h3>
        <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
          <li>가족 등록은 상대방의 동의(수락)가 필요합니다.</li>
          <li>등록된 가족에게는 언제든지 안전확인 요청을 보낼 수 있습니다.</li>
        </ul>
      </div>
    </div>
  );
}
