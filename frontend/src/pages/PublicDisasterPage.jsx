import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Home,
  MapPin,
  Megaphone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { authFetch } from "../api/client";
import {
  MAIN_DISASTER_FILTERS,
  disasterBadgeClass,
  disasterFilterOf,
  disasterSummary,
  disasterTitle,
  extractSenderOrg,
  formatDisasterDateTime,
  formatDisasterTime,
} from "../utils/disasterMessages";

const PAGE_SIZE = 6;

const messageKey = (message) =>
  message?.sn ||
  `${message?.createdAt || "time"}|${message?.region || "region"}|${
    message?.message || "message"
  }`;

export default function PublicDisasterPage({
  initialMessageSn,
  onBackToHome,
  onOpenShelters,
  onOpenReport,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("전체");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [page, setPage] = useState(1);

  const loadMessages = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await authFetch(
        "/api/environment/disaster-messages/nationwide?limit=100"
      );
      const rows = Array.isArray(data) ? data : [];

      setMessages(rows);
      setSelectedMessage((current) => {
        if (initialMessageSn) {
          const initial = rows.find(
            (row) => String(row?.sn || "") === String(initialMessageSn)
          );
          if (initial) return initial;
        }

        if (!current) return rows[0] || null;

        const stillExists = rows.find(
          (row) => messageKey(row) === messageKey(current)
        );
        return stillExists || rows[0] || null;
      });
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
      if (filter !== "전체" && disasterFilterOf(message) !== filter) {
        return false;
      }

      if (!q) return true;

      const text = `${message.message || ""} ${message.region || ""} ${
        disasterFilterOf(message)
      } ${message.emergencyLevel || ""}`.toLowerCase();

      return text.includes(q);
    });
  }, [messages, filter, query]);

  useEffect(() => {
    setPage(1);
  }, [filter, query]);

  useEffect(() => {
    if (filteredMessages.length === 0) {
      setSelectedMessage(null);
      return;
    }

    const selectedStillVisible =
      selectedMessage &&
      filteredMessages.some(
        (message) => messageKey(message) === messageKey(selectedMessage)
      );

    if (!selectedStillVisible) {
      setSelectedMessage(filteredMessages[0]);
    }
  }, [filteredMessages, selectedMessage]);

  const filterCount = (label) => {
    if (label === "전체") return messages.length;
    return messages.filter((message) => disasterFilterOf(message) === label)
      .length;
  };

  const totalPages = Math.max(1, Math.ceil(filteredMessages.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleMessages = filteredMessages.slice(
    pageStart,
    pageStart + PAGE_SIZE
  );


  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    let start = Math.max(1, safePage - 2);
    let end = Math.min(totalPages, start + 4);
    start = Math.max(1, end - 4);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [safePage, totalPages]);

  return (
    <div className="pd-page">
      <style>{PAGE_CSS}</style>

      <header className="pd-header">
        <div className="pd-header-inner">
          <button className="pd-brand" onClick={onBackToHome}>
            <span className="pd-brand-icon">
              <ShieldAlert size={20} strokeWidth={2.3} />
            </span>
            <span className="pd-brand-copy">
              <strong>세이프트레이스</strong>
              <small>함께 만드는 더 안전한 일상</small>
            </span>
          </button>

          <nav className="pd-nav" aria-label="주 메뉴">
            <span className="active">재난정보</span>
            <button onClick={onOpenShelters}>안전지도</button>
            <button onClick={onOpenReport}>현장 제보</button>
            <span>행동요령</span>
            <span>공지사항</span>
          </nav>

          <button
            className="pd-refresh-top"
            onClick={loadMessages}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "pd-spin" : ""} />
            최신 정보 갱신
          </button>
        </div>
      </header>

      <section className="pd-hero">
        <div className="pd-hero-glow pd-hero-glow-1" />
        <div className="pd-hero-glow pd-hero-glow-2" />
        <div className="pd-hero-inner">
          <div className="pd-hero-copy">
            <div className="pd-eyebrow">SAFETRACE · DISASTER INFORMATION</div>
            <h1>실시간 재난 · 안전 정보</h1>
            <p>공식 재난문자를 통해, 더 빠르고 안전하게 상황을 확인하세요.</p>
          </div>

          <div className="pd-hero-note">
            <span className="pd-hero-note-icon">
              <ShieldCheck size={24} />
            </span>
            <div>
              <strong>작은 관심이 큰 안전을 만듭니다.</strong>
              <p>최신 재난문자와 행동요령을 한 화면에서 확인할 수 있어요.</p>
            </div>
          </div>
        </div>
      </section>

      <main className="pd-main">
        <div className="pd-breadcrumb">
          <Home size={14} />
          <button onClick={onBackToHome}>홈</button>
          <ChevronRight size={14} />
          <span>재난정보</span>
          <ChevronRight size={14} />
          <strong>실시간 재난 · 안전 정보</strong>
        </div>

        <section className="pd-content-grid">
          <article className="pd-card pd-list-card">
            <div className="pd-list-head">
              <div>
                <h2>
                  <span className="pd-live-dot" />
                  재난 · 안전 정보 목록
                </h2>
                <p>총 {filteredMessages.length}건</p>
              </div>
              <button
                className="pd-icon-button"
                onClick={loadMessages}
                disabled={loading}
                aria-label="재난문자 새로고침"
              >
                <RefreshCw size={16} className={loading ? "pd-spin" : ""} />
              </button>
            </div>

            <div className="pd-filters">
              {MAIN_DISASTER_FILTERS.map((label) => (
                <button
                  key={label}
                  className={filter === label ? "active" : ""}
                  onClick={() => setFilter(label)}
                >
                  {label} <span>({filterCount(label)})</span>
                </button>
              ))}
            </div>

            <form
              className="pd-search-row"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(queryInput.trim());
                setPage(1);
              }}
            >
              <label className="pd-search-box">
                <Search size={18} />
                <input
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="제목, 내용, 지역으로 검색하세요."
                />
              </label>

              <button type="submit" className="pd-search-button">
                검색
              </button>
            </form>

            <div className="pd-list-body">
              {loading && (
                <div className="pd-empty">재난문자를 불러오는 중입니다.</div>
              )}

              {!loading && error && (
                <div className="pd-empty pd-empty-error">
                  <AlertTriangle size={30} />
                  <strong>{error}</strong>
                  <button onClick={loadMessages}>다시 불러오기</button>
                </div>
              )}

              {!loading && !error && filteredMessages.length === 0 && (
                <div className="pd-empty">조건에 맞는 재난문자가 없습니다.</div>
              )}

              {!loading &&
                !error &&
                visibleMessages.map((message) => {
                  const key = messageKey(message);
                  const selected =
                    selectedMessage && key === messageKey(selectedMessage);

                  return (
                    <button
                      key={key}
                      className={`pd-message-row ${selected ? "selected" : ""}`}
                      onClick={() => setSelectedMessage(message)}
                    >
                      <span
                        className={`pd-badge ${disasterBadgeClass(message)}`}
                      >
                        {disasterFilterOf(message)}
                      </span>

                      <span className="pd-message-copy">
                        <strong>{disasterTitle(message)}</strong>
                        <small>{disasterSummary(message)}</small>
                      </span>

                      <span className="pd-message-time">
                        {formatDisasterTime(message.createdAt)}
                      </span>
                      <ChevronRight size={17} className="pd-row-arrow" />
                    </button>
                  );
                })}
            </div>

            {!loading && !error && filteredMessages.length > 0 && (
              <div className="pd-pagination">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                  aria-label="이전 페이지"
                >
                  <ChevronLeft size={16} />
                </button>

                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    className={pageNumber === safePage ? "active" : ""}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}

                <button
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={safePage >= totalPages}
                  aria-label="다음 페이지"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </article>

          <article className="pd-card pd-detail-card">
            {!selectedMessage ? (
              <div className="pd-empty pd-detail-empty">
                <Bell size={38} />
                <strong>재난문자를 선택해 주세요.</strong>
                <span>선택한 재난문자의 상세 내용이 이곳에 표시됩니다.</span>
              </div>
            ) : (
              <>
                <div className="pd-detail-head">
                  <div className="pd-detail-badges">
                    <span
                      className={`pd-badge ${disasterBadgeClass(
                        selectedMessage
                      )}`}
                    >
                      {disasterFilterOf(selectedMessage)}
                    </span>
                    {selectedMessage.emergencyLevel && (
                      <span className="pd-level-badge">
                        {selectedMessage.emergencyLevel}
                      </span>
                    )}
                  </div>

                  <div className="pd-detail-title-row">
                    <div>
                      <h2>{disasterTitle(selectedMessage)}</h2>
                      <p>{disasterSummary(selectedMessage)}</p>
                    </div>
                    <time>{formatDisasterDateTime(selectedMessage.createdAt)}</time>
                  </div>
                </div>

                <div className="pd-detail-top-grid">
                  <div className="pd-info-table">
                    <DetailInfo
                      icon={Clock3}
                      label="발송일시"
                      value={formatDisasterDateTime(selectedMessage.createdAt)}
                    />
                    <DetailInfo
                      icon={MapPin}
                      label="송출지역"
                      value={selectedMessage.region || "정보 없음"}
                    />
                    <DetailInfo
                      icon={Megaphone}
                      label="발송기관"
                      value={extractSenderOrg(selectedMessage)}
                    />
                    <DetailInfo
                      icon={ShieldAlert}
                      label="긴급단계"
                      value={selectedMessage.emergencyLevel || "정보 없음"}
                    />
                  </div>
                </div>

                <section className="pd-detail-section pd-message-section">
                  <h3>
                    <Megaphone size={18} />
                    주요 내용
                  </h3>
                  <p>{selectedMessage.message || "-"}</p>
                </section>
              </>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}

function DetailInfo({ icon: Icon, label, value }) {
  return (
    <div className="pd-info-row">
      <span className="pd-info-icon">
        <Icon size={18} />
      </span>
      <span className="pd-info-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}


const PAGE_CSS = `
  .pd-page {
    min-height: 100vh;
    background: #ffffff;
    color: #102a4d;
    font-family: inherit;
  }

  .pd-page *,
  .pd-page *::before,
  .pd-page *::after {
    box-sizing: border-box;
  }

  .pd-page button,
  .pd-page input {
    font: inherit;
  }

  .pd-header {
    position: sticky;
    top: 0;
    z-index: 50;
    height: 72px;
    background: rgba(255, 255, 255, 0.98);
    border-bottom: 1px solid #e8eef5;
  }

  .pd-header-inner,
  .pd-hero-inner,
  .pd-main {
    width: min(1480px, calc(100% - 48px));
    margin: 0 auto;
  }

  .pd-header-inner {
    height: 100%;
    display: grid;
    grid-template-columns: 270px 1fr 270px;
    align-items: center;
    gap: 24px;
  }

  .pd-brand {
    display: inline-flex;
    align-items: center;
    gap: 11px;
    border: 0;
    background: transparent;
    padding: 0;
    cursor: pointer;
    color: #0b2a52;
    justify-self: start;
  }

  .pd-brand-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: #0b2a52;
    display: grid;
    place-items: center;
    color: #f7c948;
    box-shadow: 0 5px 14px rgba(11, 42, 82, 0.14);
  }

  .pd-brand-copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.15;
  }

  .pd-brand-copy strong {
    font-size: 20px;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .pd-brand-copy small {
    margin-top: 4px;
    color: #8a9ab0;
    font-size: 10px;
  }

  .pd-nav {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: clamp(20px, 3vw, 40px);
    font-size: 14px;
    font-weight: 800;
    color: #173b65;
    white-space: nowrap;
  }

  .pd-nav button,
  .pd-nav span {
    border: 0;
    background: transparent;
    color: inherit;
    padding: 26px 0 22px;
    cursor: pointer;
    position: relative;
  }

  .pd-nav .active {
    color: #1976ed;
  }

  .pd-nav .active::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 13px;
    height: 3px;
    border-radius: 10px;
    background: #2b83f6;
  }

  .pd-refresh-top {
    justify-self: end;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #355579;
    border-radius: 999px;
    height: 38px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .pd-refresh-top:disabled,
  .pd-icon-button:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .pd-spin {
    animation: pd-spin 0.9s linear infinite;
  }

  @keyframes pd-spin {
    to { transform: rotate(360deg); }
  }

  .pd-hero {
    position: relative;
    overflow: hidden;
    background: linear-gradient(120deg, #071b34 0%, #0b2a52 52%, #123e6f 100%);
    border-bottom: 1px solid #173c67;
  }

  .pd-hero::after {
    content: "";
    position: absolute;
    left: 40%;
    right: 6%;
    bottom: -2px;
    height: 72px;
    opacity: 0.10;
    background:
      linear-gradient(to top, rgba(93, 168, 237, 0.24), rgba(93, 168, 237, 0)) 0 100% / 100% 100% no-repeat,
      repeating-linear-gradient(90deg, rgba(75, 148, 217, 0.18) 0 18px, transparent 18px 34px);
    clip-path: polygon(0 100%, 4% 75%, 7% 75%, 7% 47%, 10% 47%, 10% 68%, 14% 68%, 14% 36%, 17% 36%, 17% 64%, 21% 64%, 21% 52%, 24% 52%, 24% 72%, 28% 72%, 28% 40%, 31% 40%, 31% 66%, 36% 66%, 36% 28%, 39% 28%, 39% 62%, 44% 62%, 44% 44%, 48% 44%, 48% 70%, 53% 70%, 53% 36%, 56% 36%, 56% 64%, 61% 64%, 61% 45%, 65% 45%, 65% 72%, 70% 72%, 70% 51%, 74% 51%, 74% 68%, 79% 68%, 79% 39%, 82% 39%, 82% 66%, 87% 66%, 87% 53%, 91% 53%, 91% 76%, 95% 76%, 95% 58%, 100% 58%, 100% 100%);
  }

  .pd-hero-glow {
    position: absolute;
    border-radius: 999px;
    filter: blur(2px);
    pointer-events: none;
  }

  .pd-hero-glow-1 {
    width: 420px;
    height: 420px;
    right: 20%;
    top: -300px;
    background: rgba(74, 160, 255, 0.18);
  }

  .pd-hero-glow-2 {
    width: 250px;
    height: 250px;
    left: -60px;
    bottom: -190px;
    background: rgba(86, 170, 255, 0.16);
  }

  .pd-hero-inner {
    min-height: 148px;
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 48px;
    padding: 24px 8px;
  }

  .pd-eyebrow {
    color: #8ec5ff;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.16em;
    margin-bottom: 7px;
  }

  .pd-hero-copy h1 {
    margin: 0;
    font-size: clamp(30px, 3vw, 44px);
    line-height: 1.12;
    letter-spacing: -0.045em;
    color: #ffffff;
    font-weight: 950;
  }

  .pd-hero-copy p {
    margin: 10px 0 0;
    color: #d9e8f8;
    font-size: 14px;
  }

  .pd-hero-note {
    width: min(400px, 38vw);
    display: flex;
    align-items: center;
    gap: 15px;
    background: rgba(255, 255, 255, 0.10);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.14);
    border-radius: 18px;
    padding: 16px 18px;
    backdrop-filter: blur(8px);
  }

  .pd-hero-note-icon {
    width: 48px;
    height: 48px;
    flex: 0 0 48px;
    display: grid;
    place-items: center;
    border-radius: 15px;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.12);
  }

  .pd-hero-note strong {
    display: block;
    font-size: 14px;
    color: #ffffff;
  }

  .pd-hero-note p {
    margin: 5px 0 0;
    color: #d3e0ef;
    font-size: 12px;
    line-height: 1.55;
  }

  .pd-main {
    background: #ffffff;
    padding-top: 16px;
    padding-bottom: 40px;
  }

  .pd-breadcrumb {
    min-height: 28px;
    display: flex;
    align-items: center;
    gap: 7px;
    color: #91a0b2;
    font-size: 12px;
    margin-bottom: 12px;
  }

  .pd-breadcrumb button {
    border: 0;
    background: transparent;
    color: inherit;
    padding: 0;
    cursor: pointer;
  }

  .pd-breadcrumb strong {
    color: #314e70;
  }

  .pd-content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
    gap: 14px;
    align-items: stretch;
  }

  .pd-card {
    min-width: 0;
    background: #ffffff;
    border: 1px solid #d3deea;
    border-radius: 18px;
    box-shadow: 0 8px 24px rgba(26, 58, 93, 0.07);
  }

  .pd-list-card,
  .pd-detail-card {
    min-height: 620px;
    overflow: hidden;
  }

  .pd-list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 8px;
  }

  .pd-list-head h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 9px;
    color: #0b2a52;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: -0.025em;
  }

  .pd-list-head p {
    margin: 5px 0 0 20px;
    color: #8696aa;
    font-size: 11px;
  }

  .pd-live-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ff4056;
    box-shadow: 0 0 0 4px #fff0f2;
  }

  .pd-icon-button {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    border: 1px solid #dde6ef;
    background: #ffffff;
    color: #6f849e;
    cursor: pointer;
  }

  .pd-filters {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 20px 10px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .pd-filters::-webkit-scrollbar { display: none; }

  .pd-filters button {
    flex: 0 0 auto;
    border: 1px solid #e2e9f1;
    background: #f5f8fb;
    color: #5d728c;
    border-radius: 9px;
    padding: 8px 13px;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .pd-filters button span {
    color: #9bacbe;
  }

  .pd-filters button.active {
    color: #ffffff;
    background: #0b2a52;
    border-color: #0b2a52;
    box-shadow: 0 6px 14px rgba(11, 42, 82, 0.12);
  }

  .pd-filters button.active span { color: #d9e7f7; }

  .pd-search-row {
    margin: 0 20px 12px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 76px;
    gap: 8px;
  }

  .pd-search-box {
    margin: 0;
    height: 42px;
    border: 1px solid #dfe7f0;
    border-radius: 11px;
    background: #fbfcfe;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 13px;
    color: #69809a;
  }

  .pd-search-box:focus-within {
    border-color: #9dc6f4;
    box-shadow: 0 0 0 3px rgba(51, 132, 231, 0.08);
  }

  .pd-search-box input {
    border: 0;
    outline: 0;
    background: transparent;
    min-width: 0;
    width: 100%;
    color: #1f3f63;
    font-size: 13px;
  }

  .pd-search-box input::placeholder { color: #a7b4c4; }

  .pd-search-button {
    height: 42px;
    border: 0;
    border-radius: 11px;
    background: #0b2a52;
    color: #ffffff;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    transition: 0.18s ease;
  }

  .pd-search-button:hover {
    background: #123d72;
  }

  .pd-list-body {
    min-height: 398px;
    border-top: 1px solid #edf1f5;
  }

  .pd-message-row {
    width: 100%;
    min-height: 72px;
    border: 0;
    border-bottom: 1px solid #edf1f5;
    border-left: 3px solid transparent;
    background: #ffffff;
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto 18px;
    gap: 12px;
    align-items: center;
    padding: 10px 16px 10px 17px;
    text-align: left;
    cursor: pointer;
    transition: 0.16s ease;
  }

  .pd-message-row:hover { background: #f8fbff; }

  .pd-message-row.selected {
    border-left-color: #2484f4;
    background: linear-gradient(90deg, #eef6ff 0%, #f7fbff 100%);
    box-shadow: inset 0 0 0 1px #bad9ff;
  }

  .pd-badge {
    min-width: 56px;
    max-width: 70px;
    justify-self: start;
    text-align: center;
    border-radius: 9px;
    padding: 6px 8px;
    font-size: 11px;
    font-weight: 900;
    white-space: nowrap;
  }

  .pd-message-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .pd-message-copy strong {
    color: #13365f;
    font-size: 14px;
    font-weight: 900;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .pd-message-copy small {
    color: #697f99;
    font-size: 12px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .pd-message-time {
    color: #4f6d8e;
    font-size: 12px;
    white-space: nowrap;
  }

  .pd-row-arrow { color: #7b99ba; }

  .pd-empty {
    min-height: 398px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8c9bad;
    font-size: 13px;
  }

  .pd-empty-error {
    flex-direction: column;
    gap: 10px;
    color: #b07928;
    text-align: center;
    padding: 30px;
  }

  .pd-empty-error strong {
    color: #5e6b7b;
    font-size: 13px;
  }

  .pd-empty-error button {
    border: 0;
    border-radius: 9px;
    background: #0b2a52;
    color: #fff;
    padding: 8px 13px;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  .pd-pagination {
    min-height: 58px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 10px 16px;
  }

  .pd-pagination button {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid #e1e8f0;
    background: #ffffff;
    color: #57708d;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .pd-pagination button.active {
    background: #4c9cf2;
    border-color: #4c9cf2;
    color: #ffffff;
  }

  .pd-pagination button:disabled {
    opacity: 0.10;
    cursor: default;
  }

  .pd-detail-card {
    display: flex;
    flex-direction: column;
    padding: 0;
  }

  .pd-detail-empty {
    min-height: 620px;
    flex-direction: column;
    gap: 9px;
    text-align: center;
  }

  .pd-detail-empty strong { color: #3f5875; }
  .pd-detail-empty span { font-size: 11px; }

  .pd-detail-head {
    padding: 18px 20px 15px;
    border-bottom: 1px solid #edf1f5;
  }

  .pd-detail-badges {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .pd-level-badge {
    border-radius: 999px;
    background: #3f94ef;
    color: white;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 900;
  }

  .pd-detail-title-row {
    margin-top: 12px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 16px;
  }

  .pd-detail-title-row h2 {
    margin: 0;
    color: #0b2a52;
    font-size: 24px;
    line-height: 1.28;
    letter-spacing: -0.035em;
    font-weight: 950;
  }

  .pd-detail-title-row p {
    margin: 7px 0 0;
    color: #58718d;
    font-size: 13px;
  }

  .pd-detail-title-row time {
    color: #456583;
    font-size: 12px;
    white-space: nowrap;
  }

  .pd-detail-top-grid {
    display: block;
    padding: 14px 20px 0;
  }

  .pd-info-table {
    border: 1px solid #e0e7ef;
    border-radius: 12px;
    overflow: hidden;
  }

  .pd-info-row {
    min-height: 47px;
    display: grid;
    grid-template-columns: 32px 72px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    padding: 8px 10px;
    border-bottom: 1px solid #edf1f5;
  }

  .pd-info-row:last-child { border-bottom: 0; }

  .pd-info-icon {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    color: #1f7ce2;
    border-radius: 8px;
    background: #eff6ff;
  }

  .pd-info-label {
    color: #405c79;
    font-size: 12px;
    font-weight: 800;
  }

  .pd-info-row strong {
    min-width: 0;
    color: #173653;
    font-size: 12px;
    line-height: 1.4;
    font-weight: 800;
    word-break: break-word;
  }


  .pd-detail-section {
    margin: 12px 20px 0;
    border-radius: 12px;
    padding: 13px 14px;
  }

  .pd-detail-section h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 900;
  }

  .pd-message-section {
    background: #eef6ff;
    border: 1px solid #d8e9fc;
  }

  .pd-message-section h3 { color: #1b67bd; }

  .pd-message-section p {
    margin: 8px 0 0;
    color: #344f6c;
    font-size: 13px;
    line-height: 1.7;
    white-space: pre-wrap;
  }


  @media (max-width: 1120px) {
    .pd-header-inner {
      grid-template-columns: 230px 1fr auto;
    }

    .pd-nav { gap: 17px; font-size: 12px; }
    .pd-refresh-top { width: 40px; padding: 0; justify-content: center; }
    .pd-refresh-top { font-size: 0; }

    .pd-content-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

  }

  @media (max-width: 900px) {
    .pd-header-inner,
    .pd-hero-inner,
    .pd-main {
      width: min(100% - 28px, 1480px);
    }

    .pd-header-inner {
      grid-template-columns: 1fr auto;
    }

    .pd-nav { display: none; }

    .pd-hero-inner {
      min-height: 142px;
      padding: 24px 0;
    }

    .pd-hero-note { display: none; }

    .pd-content-grid {
      grid-template-columns: 1fr;
    }

    .pd-list-card,
    .pd-detail-card {
      min-height: auto;
    }

    .pd-detail-card {
      min-height: 600px;
    }
  }

  @media (max-width: 620px) {
    .pd-header { height: 64px; }
    .pd-brand-copy strong { font-size: 17px; }
    .pd-brand-copy small { display: none; }

    .pd-hero-copy h1 { font-size: 27px; }
    .pd-hero-copy p { font-size: 12px; }

    .pd-list-head { padding-left: 14px; padding-right: 14px; }
    .pd-filters { padding-left: 14px; padding-right: 14px; }
    .pd-search-row { margin-left: 14px; margin-right: 14px; }

    .pd-message-row {
      grid-template-columns: 58px minmax(0, 1fr) auto;
      gap: 9px;
      padding-left: 11px;
      padding-right: 11px;
    }

    .pd-row-arrow { display: none; }
    .pd-message-time { font-size: 10px; }

    .pd-detail-title-row {
      grid-template-columns: 1fr;
      gap: 7px;
    }

    .pd-detail-title-row h2 { font-size: 21px; }

  }
`;
