import { ArrowRight, History, Info, Package, PackageCheck } from "lucide-react";
import { formatDateTime } from "../ControlBoard/constants";
import RequestHistoryTimeline from "../ControlBoard/RequestHistoryTimeline";
import { CATEGORY_ICON } from "../ControlBoard/ResourceRequestCard";
import RequestStatusBadge from "../ControlBoard/RequestStatusBadge";
import AdminDetailPanel, { DetailInfo, SECTION_TITLE } from "./AdminDetailPanel";
import {
  ACTION_BUTTON, ADMIN_ACTION_LABEL, ADMIN_BUTTON_STYLE, ADMIN_STATUS_LABEL, ITEM_CATEGORY_LABEL, RETURN_STATUS_LABEL, RETURN_STATUS_STYLE,
  formatCode, formatQty, getAdminRequestActions,
} from "../../constants/resource";

// ADMIN 오른쪽 상세 패널 - 기본 정보, 처리 현황(수량), 처리 이력, 처리 버튼. 세 화면이 같이 쓴다:
//  요청·출고 관리: 승인·반려·출고. 손실 확정은 반납·정산 관리에서 하므로 onGoReturns(그 화면으로 가는 버튼)를 넘긴다.
//  미정산 출고: onGoReturns 없이 쓰면 손실 확정 버튼이 나온다.
//  반납 신청: applied(반납 신청 한 건)를 넘기면 그 신청의 정보와 반납 확인·반려 버튼이 나온다. 수량 현황은 request(그 요청) 기준이다.
// 처리 창에는 눌린 대상(반납 신청이면 신청 한 건)을 onAction(action, 대상)으로 넘긴다.
export default function AdminRequestDetail({ request, history, applied, title = "자원 요청 상세", busy, onAction, onGoReturns, onClose }) {
  const Icon = CATEGORY_ICON[request.category] || Package;
  const dispatched = ["DISPATCHED", "SETTLED", "COMPLETED"].includes(request.status);
  const settles = dispatched && request.returnable === "Y"; // 반납·손실을 정산하는 요청(출고된 반납형)
  const qty = (value) => formatQty(value || 0, request.unit);
  const pct = (value) => Math.min(100, Math.round(((value || 0) / request.quantity) * 100)); // 막대 길이용. 정확한 수량은 위 칸에 있다
  const pending = request.pendingReturnQty || 0; // 반납 신청은 했지만 관리자가 아직 확인하지 않은 수량 - 반납으로 세지 않는다
  const incident = [
    ["사건번호", <b key="inc" className="text-[#244D7C]">{formatCode("INC", request.incidentId)}</b>],
    ["사건명", request.incidentTitle],
  ];
  const info = [
    ...incident,
    ...(applied ? [
      ["신청자", applied.applicantName],
      ["신청 수량", <b key="qty">{qty(applied.appliedQty)}</b>],
      ["신청 메모", applied.applyMemo],
      ["처리", applied.processedAt && `${applied.processedByName} · ${formatDateTime(applied.processedAt)}`],
      ["반려 사유", applied.status === "REJECTED" && applied.rejectReason && <span className="text-rose-700">{applied.rejectReason}</span>],
    ] : [
      ["요청자", request.requesterName],
      ["요청 부서", request.requesterDepartmentName],
      ["보유 부서", request.departmentName !== request.requesterDepartmentName && request.departmentName], // 같으면 한 번만 보인다
      ["요청 사유", request.reason],
      ["필요 시각", request.neededAt && formatDateTime(request.neededAt)],
      ["반려 사유", request.status === "REJECTED" && request.rejectReason && <span className="text-rose-700">{request.rejectReason}</span>],
    ]),
  ].filter(([, value]) => value);
  // 수량은 서버가 준 값을 그대로 보여준다. 미처리 = 아직 신청되지 않은 수량 + 확인 대기 중인 반납
  const unsettled = (request.applicableReturnQty || 0) + pending;
  // 출고된 뒤에는 요청 수량과 출고 수량이 같으므로 한 칸(출고)만 보여 준다
  const amounts = [
    dispatched ? ["출고", qty(request.quantity), ""] : ["요청", qty(request.quantity), ""],
    ["반납 확정", settles ? qty(request.returnedQty) : "-", request.returnedQty > 0 && "text-emerald-700"],
    ["손실 확정", settles ? qty(request.lostQty) : "-", request.lostQty > 0 && "text-rose-600"],
    ["미처리", settles ? qty(unsettled) : "-", settles && unsettled > 0 && "text-amber-600"],
  ];
  const actions = applied
    ? (applied.status === "PENDING" ? ["returnConfirm", "returnReject"] : [])
    : getAdminRequestActions(request).filter((action) => action !== "loss" || !onGoReturns);
  // 미정산 출고 화면의 안내: 손실 확정은 실제 분실·파손이 확인된 때만, 확인 대기 반납이 남았으면 그것부터 처리
  const lossNotice = !applied && !onGoReturns && request.status === "DISPATCHED"
    ? (actions.includes("loss")
      ? "손실 확정은 실제 분실·파손이 확인된 경우에만 진행해 주세요. 손실 수량과 사유를 입력해야 하며, 확정하면 총 보유량이 줄어듭니다."
      : pending > 0 && "확인 대기 중인 반납 신청을 먼저 확인하거나 반려해야 남은 수량을 손실로 확정할 수 있습니다.")
    : "";

  return (
    <AdminDetailPanel
      title={title}
      onClose={onClose}
      notice={lossNotice}
      actions={(
        <>
          {actions.map((action) => (
            <button key={action} type="button" onClick={() => onAction(action, applied || request)} disabled={busy} className={`grow ${ACTION_BUTTON} ${ADMIN_BUTTON_STYLE[action]}`}>
              {ADMIN_ACTION_LABEL[action]}
            </button>
          ))}
          {request.status === "DISPATCHED" && settles && onGoReturns && (
            <button type="button" onClick={onGoReturns} className={`grow ${ACTION_BUTTON} inline-flex items-center justify-center gap-1 text-[#0F2540] border-[#0F2540] bg-white hover:bg-slate-100`}>
              반납·정산 관리로 이동 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </>
      )}
    >
      <div className="flex items-center gap-3 rounded-xl bg-[#F3F7FD] p-3">
        <span className="shrink-0 w-12 h-12 rounded-xl bg-white text-[#244D7C] flex items-center justify-center shadow-sm">
          <Icon className="w-6 h-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-extrabold text-[#0F2540] leading-tight">{formatCode("REQ", request.requestId)}</div>
          <div className="text-[13px] text-slate-500">{applied ? `신청일시 ${formatDateTime(applied.appliedAt)}` : `요청일시 ${formatDateTime(request.createdAt)}`}</div>
        </div>
        {applied
          ? <RequestStatusBadge status={applied.status} labels={RETURN_STATUS_LABEL} styles={RETURN_STATUS_STYLE} className="px-3 py-1.5 text-[13px]" />
          : <RequestStatusBadge status={request.status} request={request} labels={ADMIN_STATUS_LABEL} className="px-3 py-1.5 text-[13px]" />}
      </div>

      <section>
        <h3 className={SECTION_TITLE}><Info className="w-4 h-4 text-[#244D7C]" /> 기본 정보</h3>
        <DetailInfo rows={info} />
      </section>

      <section>
        <h3 className={SECTION_TITLE}><PackageCheck className="w-4 h-4 text-[#244D7C]" /> 자원 처리 현황</h3>
        <div className="rounded-lg border border-slate-200 p-3.5">
          <div className="flex flex-wrap items-baseline gap-x-2 text-base font-extrabold text-[#0F2540]">
            {request.itemName}
            <span className="text-[13px] font-semibold text-slate-500">
              {ITEM_CATEGORY_LABEL[request.category] || request.category} · {request.returnable === "Y" ? "반납형" : "소모품"}
            </span>
          </div>
          <dl className="mt-2.5 grid grid-flow-col auto-cols-fr gap-1.5 text-center">
            {amounts.map(([label, value, tone]) => (
              <div key={label} className="rounded-lg bg-slate-50 px-0.5 py-2">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className={`mt-0.5 text-lg font-extrabold ${tone || "text-[#0F2540]"}`}>{value}</dd>
              </div>
            ))}
          </dl>
          {settles && (
            <div className="mt-3">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`반납 확정 ${pct(request.returnedQty)}%`}>
                <span className="bg-emerald-500" style={{ width: `${pct(request.returnedQty)}%` }} />
                <span className="bg-rose-400" style={{ width: `${pct(request.lostQty)}%` }} />
                <span className="bg-amber-300" style={{ width: `${pct(pending)}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[13px] text-slate-500">
                <span>반납 확정 진행률</span>
                <b className="text-slate-700">{pct(request.returnedQty)}%</b>
              </div>
              {pending > 0 && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                  반납 신청 {qty(pending)}은 확인 대기 중입니다. 관리자가 확인하기 전에는 반납 수량에 넣지 않습니다.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className={SECTION_TITLE}><History className="w-4 h-4 text-[#244D7C]" /> 처리 이력</h3>
        <RequestHistoryTimeline history={history} compact />
      </section>
    </AdminDetailPanel>
  );
}
