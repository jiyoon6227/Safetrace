import { History, Info, Package, PackageCheck, TriangleAlert } from "lucide-react";
import { formatDateTime } from "../ControlBoard/constants";
import RequestHistoryTimeline from "../ControlBoard/RequestHistoryTimeline";
import RequestStatusBadge from "../ControlBoard/RequestStatusBadge";
import { CATEGORY_ICON } from "../ControlBoard/ResourceRequestCard";
import AdminDetailPanel, { DetailInfo, SECTION_TITLE } from "./AdminDetailPanel";
import {
  ACTION_BUTTON, ADMIN_BUTTON_STYLE, ITEM_CATEGORY_LABEL, STOCK_FORMS, STOCK_STATUS_LABEL, STOCK_STATUS_STYLE, formatQty, getStockActions, returnableLabel,
} from "../../constants/resource";

// 재고 처리 버튼 색: 입고·사용 재개는 남색, 수량 조정은 어두운 테두리, 사용 중지는 붉은 테두리
const ACTION_STYLE = {
  stockReceive: ADMIN_BUTTON_STYLE.approve,
  stockAdjust: ADMIN_BUTTON_STYLE.reject,
  stockDeactivate: ADMIN_BUTTON_STYLE.loss,
  stockReactivate: ADMIN_BUTTON_STYLE.approve,
};
// 패널 맨 위 요약: 품목 아이콘, 이름, 보조 줄, 오른쪽 배지
function PanelHead({ category, title, sub, badge }) {
  const Icon = CATEGORY_ICON[category] || Package;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[#F3F7FD] p-3">
      <span className="shrink-0 w-12 h-12 rounded-xl bg-white text-[#244D7C] flex items-center justify-center shadow-sm">
        <Icon className="w-6 h-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xl font-extrabold text-[#0F2540] leading-tight break-keep [overflow-wrap:anywhere]">{title}</div>
        <div className="text-[13px] text-slate-500">{sub}</div>
      </div>
      {badge}
    </div>
  );
}

const HistorySection = ({ title, history, emptyText }) => (
  <section>
    <h3 className={SECTION_TITLE}><History className="w-4 h-4 text-[#244D7C]" /> {title}</h3>
    <RequestHistoryTimeline history={history} compact emptyText={emptyText} />
  </section>
);

// 재고 상세 패널 - 기본 정보, 수량 현황(총보유량·가용·예약·출고 중), 변동 이력, 재고 상태에 맞는 처리 버튼
export default function AdminStockDetail({ stock, history, onAction, onClose }) {
  const qty = (value) => formatQty(value, stock.unit);
  const amounts = [["총 보유량", stock.totalQty, ""], ["가용", stock.availableQty, stock.availableQty === 0 && "text-amber-600"], ["예약", stock.reservedQty, ""], ["출고 중", stock.dispatchedQty, ""]];
  return (
    <AdminDetailPanel
      title="재고 상세"
      onClose={onClose}
      notice={stock.status === "INACTIVE" && "비활성 재고입니다. 새 요청·승인·입고가 막혀 있어 수량 조정과 사용 재개만 할 수 있습니다."}
      actions={getStockActions(stock).map((action) => (
        <button key={action} type="button" onClick={() => onAction(action, stock)} className={`grow ${ACTION_BUTTON} ${ACTION_STYLE[action]}`}>
          {STOCK_FORMS[action].title}
        </button>
      ))}
    >
      <PanelHead
        category={stock.category}
        title={stock.itemName}
        sub={stock.departmentName}
        badge={<RequestStatusBadge status={stock.status} labels={STOCK_STATUS_LABEL} styles={STOCK_STATUS_STYLE} className="px-3 py-1.5 text-[13px]" />}
      />

      <section>
        <h3 className={SECTION_TITLE}><Info className="w-4 h-4 text-[#244D7C]" /> 기본 정보</h3>
        <DetailInfo
          rows={[
            ["부서", stock.departmentName],
            ["품목", stock.itemName],
            ["분류", ITEM_CATEGORY_LABEL[stock.category] || stock.category],
            ["단위·유형", `${stock.unit} · ${returnableLabel(stock)}`],
            ["설명", stock.itemDescription],
            ["최종 변경", stock.updatedAt && formatDateTime(stock.updatedAt)],
          ]}
        />
      </section>

      <section>
        <h3 className={SECTION_TITLE}><PackageCheck className="w-4 h-4 text-[#244D7C]" /> 수량 현황</h3>
        <div className="rounded-lg border border-slate-200 p-3.5">
          <dl className="grid grid-cols-4 gap-1.5 text-center">
            {amounts.map(([label, value, tone]) => (
              <div key={label} className="rounded-lg bg-slate-50 px-0.5 py-2">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className={`mt-0.5 text-lg font-extrabold ${tone || "text-[#0F2540]"}`}>{qty(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2.5 text-[13px] text-slate-500">예약은 승인된 요청, 출고 중은 출고 후 반납·손실이 정리되지 않은 수량입니다.</p>
          {stock.qtyConsistent === false && (
            <p className="mt-2 flex gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
              총 보유량 − 가용({qty(stock.totalQty - stock.availableQty)})이 예약 + 출고 중({qty(stock.reservedQty + stock.dispatchedQty)})과 다릅니다. 데이터 점검이 필요합니다.
            </p>
          )}
        </div>
      </section>

      <HistorySection title="변동 이력" history={history} emptyText="재고 변동 이력이 없습니다." />
    </AdminDetailPanel>
  );
}

// 품목 상세 패널 - 기본 정보와 수정 이력. 수정은 이름·분류·설명만 가능하다.
export function AdminItemDetail({ item, history, onEdit, onClose }) {
  return (
    <AdminDetailPanel
      title="품목 상세"
      onClose={onClose}
      actions={<button type="button" onClick={() => onEdit(item)} className={`grow ${ACTION_BUTTON} ${ADMIN_BUTTON_STYLE.approve}`}>품목 수정</button>}
    >
      <PanelHead category={item.category} title={item.name} sub={ITEM_CATEGORY_LABEL[item.category] || item.category} badge={<span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-bold text-slate-600">{returnableLabel(item)}</span>} />

      <section>
        <h3 className={SECTION_TITLE}><Info className="w-4 h-4 text-[#244D7C]" /> 기본 정보</h3>
        <DetailInfo
          rows={[
            ["품목명", item.name],
            ["분류", ITEM_CATEGORY_LABEL[item.category] || item.category],
            ["단위", item.unit],
            ["유형", returnableLabel(item)],
            ["설명", item.description],
            ["등록일", item.createdAt && formatDateTime(item.createdAt)],
          ]}
        />
        <p className="mt-2 text-[13px] text-slate-500">단위와 반납형 여부는 기존 재고·요청 해석에 영향을 주어 수정할 수 없습니다.</p>
      </section>

      <HistorySection title="수정 이력" history={history} emptyText="수정 이력이 없습니다." />
    </AdminDetailPanel>
  );
}
