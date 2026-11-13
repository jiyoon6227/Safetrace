import { useMyResources } from "../ControlBoard/useMyResources";

// ADMIN 자원 요청 화면의 데이터. 목록·검색·상태별 건수·처리 이력은 STAFF 자원 관리와 같은 훅을 쓰고,
// 여기서는 ADMIN만 하는 승인·반려·출고·승인 취소·손실 확정을 더한다.
export function useAdminRequests({ setToast }) {
  const data = useMyResources({ setToast });
  const { act } = data;

  return {
    ...data,
    approve: (requestId) => act(requestId, "approve", "요청을 승인했습니다."),
    reject: (requestId, reason) =>
      act(requestId, "reject", "요청을 반려했습니다.", { body: JSON.stringify({ reason: reason.trim() }) }),
    dispatch: (requestId) => act(requestId, "dispatch", "출고 처리했습니다."),
    cancel: (requestId) => act(requestId, "cancel", "승인을 취소했습니다."),
    // expectedProcessedQty는 화면에 보인 처리 수량. 그사이 다른 처리가 있었으면 서버가 거절한다.
    loss: (request, lostQty, reason) =>
      act(request.requestId, `/api/resources/admin/requests/${request.requestId}/loss`, "손실을 확정했습니다.", {
        body: JSON.stringify({
          lostQty: Number(lostQty),
          reason: reason.trim(),
          expectedProcessedQty: (request.returnedQty || 0) + (request.lostQty || 0),
        }),
      }),
  };
}
