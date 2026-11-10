import { MIN_REPORT_DATE } from "./constants";

function clampDate(value, todayStr, setToast) {
  if (value < MIN_REPORT_DATE) {
    setToast(`${MIN_REPORT_DATE} 이전 날짜는 선택할 수 없습니다.`);
    return MIN_REPORT_DATE;
  }
  if (value > todayStr) {
    setToast("미래 날짜는 선택할 수 없습니다.");
    return todayStr;
  }
  return value;
}

// 제보/사건 탭 공용 날짜 필터 - 타이핑 중엔 그대로 받아주고(연도 입력 중 매 자리마다 막히는 것 방지), 포커스 벗어날 때만 보정.
// 실제 필터링은 "조회" 버튼을 눌러야 반영됨
export function createDateRangeHandlers({
  dateFrom, dateTo, setDateFrom, setDateTo, setAppliedDateFrom, setAppliedDateTo, setPage, todayStr, setToast,
}) {
  const handleDateFromChange = (value) => setDateFrom(value);
  const handleDateFromBlur = () => {
    if (!dateFrom) return;
    const v = clampDate(dateFrom, todayStr, setToast);
    if (v !== dateFrom) setDateFrom(v);
    if (dateTo && v > dateTo) {
      setDateTo(v); // 시작일이 종료일보다 늦어지면 종료일도 같이 밀어줌
      setToast("시작일이 종료일보다 늦어 종료일을 시작일에 맞춰 조정했습니다.");
    }
  };

  const handleDateToChange = (value) => setDateTo(value);
  const handleDateToBlur = () => {
    if (!dateTo) return;
    const v = clampDate(dateTo, todayStr, setToast);
    if (v !== dateTo) setDateTo(v);
    if (dateFrom && v < dateFrom) {
      setDateFrom(v); // 종료일이 시작일보다 빨라지면 시작일도 같이 당겨줌
      setToast("종료일이 시작일보다 빨라 시작일을 종료일에 맞춰 조정했습니다.");
    }
  };

  // "조회" 버튼 - 여기서 눌러야 입력해둔 날짜 범위가 실제 목록 필터링에 반영됨
  const applyDateFilter = () => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setPage(1);
  };

  return { handleDateFromChange, handleDateFromBlur, handleDateToChange, handleDateToBlur, applyDateFilter };
}
