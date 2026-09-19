import React, { useEffect, useState } from "react";
import { ShieldAlert, User, Lock, Mail, Eye, EyeOff, ArrowRight, ShieldCheck, Search, Bell } from "lucide-react";

export default function LoginPage({ onLoginSuccess, onBackToHome, onSearch, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode); // "login" | "signup"
  const [showPassword, setShowPassword] = useState(false);

  // 로그인 필드
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  // 회원가입 전용 필드
  const [name, setName] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [email, setEmail] = useState("");

  // 이메일 인증 상태
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [emailNotice, setEmailNotice] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async (id, pw) => {
    const res = await fetch("http://localhost:8080/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId: id, password: pw }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "로그인에 실패했습니다.");
    }
    const data = await res.json();
    localStorage.setItem("token", data.token);
    onLoginSuccess(data.token);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await doLogin(loginId, password);
    } catch (err) {
      setError(err.message || "아이디 또는 비밀번호를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  // 이메일 바뀌면 이전 인증 상태는 무효화
  const handleEmailChange = (value) => {
    setEmail(value);
    setEmailVerified(false);
    setCodeSent(false);
    setVerificationCode("");
    setEmailNotice("");
  };

  const sendVerificationCode = async () => {
    if (!email.trim()) {
      setEmailNotice("이메일을 먼저 입력해주세요.");
      return;
    }
    setSendingCode(true);
    setEmailNotice("");
    try {
      const res = await fetch("http://localhost:8080/api/auth/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "인증번호 발송에 실패했습니다.");
      }
      setCodeSent(true);
      setEmailNotice("인증번호를 발송했습니다. 메일함을 확인해주세요.");
    } catch (err) {
      setEmailNotice(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  const verifyCode = async () => {
    if (!verificationCode.trim()) return;
    setVerifyingCode(true);
    setEmailNotice("");
    try {
      const res = await fetch("http://localhost:8080/api/auth/email/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verificationCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "인증번호가 올바르지 않습니다.");
      }
      setEmailVerified(true);
      setEmailNotice("이메일 인증이 완료되었습니다.");
    } catch (err) {
      setEmailNotice(err.message);
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (name.trim() === "") {
      setError("이름을 입력해주세요.");
      return;
    }
    if (!email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }
    if (!emailVerified) {
      setError("이메일 인증을 완료해주세요.");
      return;
    }    

    setLoading(true);
    try {
      const res = await fetch("http://localhost:8080/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password, name, email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "회원가입에 실패했습니다.");
      }
      // 회원가입 성공 → 같은 계정으로 바로 로그인까지 처리
      await doLogin(loginId, password);
    } catch (err) {
      setError(err.message || "회원가입 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m) => {
  setMode(m);
  setError("");
  setLoginId("");
  setPassword("");
  setPasswordConfirm("");
  setEmail("");
  setEmailVerified(false);
  setCodeSent(false);
  setVerificationCode("");
  setEmailNotice("");
};

  return (
    <div className="min-h-screen bg-slate-100 text-[#0F2540]">
      {/* 상단 헤더 - 메인페이지와 동일한 메뉴 구성 */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-[1450px] mx-auto px-6 h-[72px] flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center gap-3 hover:opacity-80 transition cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-[#0B2A52] flex items-center justify-center shadow-sm">
              <ShieldAlert className="w-5 h-5 text-amber-400" strokeWidth={2.4} />
            </div>
            <div className="text-left leading-tight">
              <div className="font-extrabold text-xl text-[#0B2A52] tracking-tight">세이프트레이스</div>
              <div className="text-[10px] text-slate-400">함께 만드는 더 안전한 일상</div>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-10 text-[16px] font-semibold text-[#0B2A52]">
            <button type="button" onClick={onBackToHome} className="hover:text-blue-600 cursor-pointer transition">재난정보</button>
            <button type="button" onClick={onBackToHome} className="hover:text-blue-600 cursor-pointer transition">안전지도</button>
            <button type="button" onClick={onBackToHome} className="hover:text-blue-600 cursor-pointer transition">대피시설</button>
            <button type="button" onClick={onBackToHome} className="hover:text-blue-600 cursor-pointer transition">현장 제보</button>
            <button type="button" onClick={onBackToHome} className="hover:text-blue-600 cursor-pointer transition">행동요령</button>
            <button type="button" onClick={onBackToHome} className="hover:text-blue-600 cursor-pointer transition">공지사항</button>
          </nav>

          <div className="flex items-center gap-4 text-[#0B2A52]">
            <button
              type="button"
              onClick={onSearch ?? onBackToHome}
              className="hidden md:flex w-9 h-9 items-center justify-center hover:bg-slate-100 transition cursor-pointer"
              aria-label="통합검색"
              title="통합검색"
            >
              <Search className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => switchMode("login")}
              className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 transition cursor-pointer"
              aria-label="알림"
            >
              <Bell className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => switchMode("login")}
              className="hidden sm:block font-bold text-sm cursor-pointer hover:text-blue-600 transition"
            >
              로그인
            </button>
          </div>
        </div>
      </header>

      {/* 메인 */}
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center px-5 py-12 bg-[#F4F7FB]">
        <div className="w-full max-w-[420px]">
          <div className="bg-white rounded-2xl border border-slate-200 px-6 sm:px-8 py-7 sm:py-8">
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#0F2540] flex items-center justify-center mb-4">
                <ShieldAlert className="w-7 h-7 text-amber-400" strokeWidth={2.5} />
              </div>

              <h2 className="text-2xl font-black tracking-[-0.03em]">
                세이프트레이스
              </h2>

              <p className="text-sm font-bold text-[#355D84] mt-1 text-center">
                {mode === "login"
                  ? "지금, 더 안전한 일상을 시작하세요."
                  : "지금, 더 안전한 세상을 만들어보세요."}
              </p>
            </div>

                {/* 탭 */}
                <div className="grid grid-cols-2 border border-[#CFDBE9] rounded-xl overflow-hidden mb-5 bg-white">
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className={`h-11 text-sm font-extrabold transition ${
                      mode === "login"
                        ? "bg-[#0F2540] text-white"
                        : "text-[#617892] hover:bg-slate-50"
                    } cursor-pointer`}
                  >
                    로그인
                  </button>

                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className={`h-11 text-sm font-extrabold transition ${
                      mode === "signup"
                        ? "bg-[#0F2540] text-white"
                        : "text-[#617892] hover:bg-slate-50"
                    } cursor-pointer`}
                  >
                    회원가입
                  </button>
                </div>

                <form
                  onSubmit={mode === "login" ? handleLoginSubmit : handleSignupSubmit}
                  className="space-y-3.5"
                >
                  <div>
                    <label className="block text-xs font-extrabold text-[#294D72] mb-1.5">
                      아이디
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7896B6]" />
                      <input
                        type="text"
                        value={loginId}
                        onChange={(e) => {
                          setLoginId(e.target.value);
                          setError("");
                        }}
                        className="w-full h-12 rounded-xl border border-[#CBD8E7] bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70 transition"
                        placeholder="아이디를 입력하세요"
                        required
                      />
                    </div>
                  </div>

                  {mode === "signup" && (
                    <div>
                      <label className="block text-xs font-extrabold text-[#294D72] mb-1.5">
                        이름
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7896B6]" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            setError("");
                          }}
                          className="w-full h-12 rounded-xl border border-[#CBD8E7] bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70 transition"
                          placeholder="이름을 입력하세요"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {mode === "signup" && (
                    <div>
                      <label className="block text-xs font-extrabold text-[#294D72] mb-1.5">
                        이메일
                      </label>

                      <div className="flex gap-2">
                        <div className="relative flex-1 min-w-0">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7896B6]" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => handleEmailChange(e.target.value)}
                            disabled={emailVerified}
                            className="w-full h-12 rounded-xl border border-[#CBD8E7] bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70 disabled:bg-slate-50 transition"
                            placeholder="name@email.com"
                          />
                        </div>

                        {!emailVerified && (
                          <button
                            type="button"
                            onClick={sendVerificationCode}
                            disabled={sendingCode}
                            className="h-12 px-3.5 rounded-xl border border-[#CBD8E7] bg-white text-xs font-extrabold text-[#17385E] hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                          >
                            {sendingCode ? "발송 중" : codeSent ? "재발송" : "인증"}
                          </button>
                        )}
                      </div>

                      {emailVerified && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-emerald-600">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          이메일 인증 완료
                        </p>
                      )}

                      {codeSent && !emailVerified && (
                        <div className="flex gap-2 mt-2">
                          <input
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                            maxLength={6}
                            className="flex-1 h-10 rounded-xl border border-[#CBD8E7] px-3 text-sm outline-none focus:border-blue-500"
                            placeholder="인증번호 6자리"
                          />
                          <button
                            type="button"
                            onClick={verifyCode}
                            disabled={verifyingCode}
                            className="h-10 px-4 rounded-xl bg-[#0F2540] hover:bg-[#173B65] text-white text-xs font-extrabold disabled:opacity-50 cursor-pointer"
                          >
                            {verifyingCode ? "확인 중" : "확인"}
                          </button>
                        </div>
                      )}

                      {emailNotice && !emailVerified && (
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          {emailNotice}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-extrabold text-[#294D72] mb-1.5">
                      비밀번호
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7896B6]" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError("");
                        }}
                        className="w-full h-12 rounded-xl border border-[#CBD8E7] bg-white pl-10 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70 transition"
                        placeholder="비밀번호를 입력하세요"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7896B6] hover:text-[#274D75] cursor-pointer"
                        aria-label="비밀번호 표시 전환"
                      >
                        {showPassword
                          ? <EyeOff className="w-4 h-4" />
                          : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {mode === "signup" && (
                    <div>
                      <label className="block text-xs font-extrabold text-[#294D72] mb-1.5">
                        비밀번호 확인
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7896B6]" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={passwordConfirm}
                          onChange={(e) => {
                            setPasswordConfirm(e.target.value);
                            setError("");
                          }}
                          className="w-full h-12 rounded-xl border border-[#CBD8E7] bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70 transition"
                          placeholder="비밀번호를 다시 입력하세요"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {mode === "login" && (
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#4D6B87]">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 accent-[#0F2540]"
                      />
                      로그인 상태 유지
                    </label>
                  )}

                  {error && (
                    <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-[#0F2540] hover:bg-[#173B65] text-white text-[15px] font-extrabold flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(15,37,64,0.16)] transition disabled:opacity-50 cursor-pointer"
                  >
                    {loading
                      ? "처리 중..."
                      : mode === "login"
                        ? "로그인"
                        : "회원가입"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>

                {mode === "login" && (
                  <div className="mt-5 flex items-center justify-center gap-4 text-xs font-bold text-[#55769A]">
                    <button type="button" className="hover:text-blue-600 cursor-pointer">아이디 찾기</button>
                    <span className="text-slate-300">|</span>
                    <button type="button" className="hover:text-blue-600 cursor-pointer">비밀번호 찾기</button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={onBackToHome}
                      className="hover:text-blue-600 cursor-pointer"
                    >
                      홈으로 돌아가기
                    </button>
                  </div>
                )}

                <div className="h-px bg-slate-200 mt-5 mb-4" />

                <div className="rounded-2xl bg-[#EEF6FF] px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-[#17385E]">
                      세이프트레이스는
                    </p>
                    <p className="text-[11px] text-[#728CA7] mt-0.5">
                      국민의 소중한 일상을 지키기 위해 항상 노력합니다.
                    </p>
                  </div>
                </div>
          </div>
        </div>
      </main>
    </div>
  );
}
