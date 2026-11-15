import { useMyResources } from "../ControlBoard/useMyResources";

const BASE = "/api/resources/admin/return-applications";

// ADMIN 반납 신청 데이터: 목록·검색·기간·상태별 건수·페이징은 요청 목록과 같은 훅이 하고(주소만 반납 신청),
// 여기서는 ADMIN만 하는 반납 확인·반려를 더한다. 처음에는 전체를 보여준다(서버에는 ALL로 보낸다).
// act의 첫 인자는 요청 ID다: 처리 중 표시와, 열려 있는 그 요청의 처리 이력 새로 읽기에 쓴다.
export function useAdminReturns({ setToast }) {
  const data = useMyResources({ setToast, basePath: BASE, statusAll: "ALL" });
  const { act } = data;

  return {
    ...data,
    confirm: (item) => act(item.requestId, `${BASE}/${item.returnId}/confirm`, "반납을 확인했습니다. 가용 수량에 반영됐습니다."),
    reject: (item, reason) =>
      act(item.requestId, `${BASE}/${item.returnId}/reject`, "반납 신청을 반려했습니다.", { body: JSON.stringify({ reason: reason.trim() }) }),
  };
}
