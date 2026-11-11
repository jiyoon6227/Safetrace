import { REPORT_STATE_LABEL, REPORT_STATE_STYLE } from "../constants/report";

// 제보의 현재 상태(코드/이름표/배지 색) - 사건 상태와 분리해서 표시
// 제보: 등록 -> 검토중 -> 사건연결 / 반려 (status가 비어 있으면 사건 연결 여부로 판단)
export const reportStateOf = (report) => {
  const code = report.status || (report.incidentId ? "LINKED" : "RECEIVED");
  return {
    code,
    label: REPORT_STATE_LABEL[code] || code,
    style: REPORT_STATE_STYLE[code] || REPORT_STATE_STYLE.RECEIVED,
  };
};
