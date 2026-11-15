import { useEffect, useState } from "react";
import { Boxes, PackageCheck, PackageX, Package, Pause, Plus } from "lucide-react";
import RequestStatusBadge from "../ControlBoard/RequestStatusBadge";
import ResourceFilterBar, { FILTER_CONTROL } from "../ControlBoard/ResourceFilterBar";
import ResourceSummaryCards from "../ControlBoard/ResourceSummaryCards";
import { CATEGORY_ICON } from "../ControlBoard/ResourceRequestCard";
import { formatDateTime } from "../ControlBoard/constants";
import {
  ITEM_CATEGORY_FILTERS, ITEM_CATEGORY_LABEL, STOCK_STATUS_FILTERS, STOCK_STATUS_LABEL, STOCK_STATUS_STYLE, formatQty, returnableLabel,
} from "../../constants/resource";
import { useAdminStock } from "./useAdminStock";
import AdminTable, { SHOW_3XL, SHOW_4XL } from "./AdminTable";
import AdminStockDetail, { AdminItemDetail } from "./AdminStockDetail";
import AdminFormModal from "./AdminFormModal";

// 현황 카드는 재고 행(부서·품목 한 줄) 수만 센다: 단위가 다른 품목의 수량을 더한 값은 의미가 없어 만들지 않는다
const STOCK_CARDS = [
  { label: "전체 재고", Icon: Boxes, tone: "bg-blue-50 text-blue-600" },
  { label: STOCK_STATUS_LABEL.ACTIVE, hint: "요청·승인·입고 가능", Icon: PackageCheck, tone: "bg-emerald-50 text-emerald-600", statuses: ["ACTIVE"] },
  { label: STOCK_STATUS_LABEL.INACTIVE, hint: "새 요청·승인·입고 불가", Icon: Pause, tone: "bg-slate-100 text-slate-600", statuses: ["INACTIVE"] },
  { label: "가용 없음", hint: "활성이지만 가용 수량 0", Icon: PackageX, tone: "bg-amber-50 text-amber-600", statuses: ["EMPTY"] },
];
const ITEM_CARDS = [
  { label: "전체 품목", Icon: Boxes, tone: "bg-blue-50 text-blue-600" },
  ...Object.entries(ITEM_CATEGORY_LABEL).map(([category, label]) => ({
    label, hint: "등록된 품목", Icon: CATEGORY_ICON[category], tone: "bg-sky-50 text-sky-600", statuses: [category],
  })),
];

const nameCell = (name, category, sub) => {
  const Icon = CATEGORY_ICON[category] || Package;
  return (
    <>
      <span className="inline-flex items-center gap-2 font-bold text-slate-900"><Icon className="w-[18px] h-[18px] text-[#244D7C]" /> {name}</span>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </>
  );
};

// 재고 표: 예약·출고 중 칸은 넓을 때만 보이고, 좁으면 가용 칸 아래에 붙는다
const STOCK_COLUMNS = [
  { head: "부서", cell: (r) => <span className="font-bold text-slate-900">{r.departmentName}</span> },
  { head: "품목", cell: (r) => nameCell(r.itemName, r.category, `${ITEM_CATEGORY_LABEL[r.category] || r.category} · ${returnableLabel(r)}`) },
  { head: "총 보유량", cell: (r) => <b className="text-slate-900">{formatQty(r.totalQty, r.unit)}</b> },
  {
    head: "가용",
    cell: (r) => (
      <>
        <b className={r.availableQty === 0 ? "text-amber-600" : "text-slate-900"}>{formatQty(r.availableQty, r.unit)}</b>
        <div className="@3xl:hidden text-xs text-slate-500">예약 {formatQty(r.reservedQty)} · 출고 중 {formatQty(r.dispatchedQty)}</div>
      </>
    ),
  },
  { head: "예약", show: SHOW_3XL, cell: (r) => <span className="text-slate-700">{formatQty(r.reservedQty, r.unit)}</span> },
  { head: "출고 중", show: SHOW_3XL, cell: (r) => <span className="text-slate-700">{formatQty(r.dispatchedQty, r.unit)}</span> },
  {
    head: "상태",
    cell: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <RequestStatusBadge status={r.status} labels={STOCK_STATUS_LABEL} styles={STOCK_STATUS_STYLE} className="px-3 py-1 text-xs" />
        {r.qtyConsistent === false && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700">점검 필요</span>}
      </span>
    ),
  },
];
const ITEM_COLUMNS = [
  { head: "품목명", cell: (r) => nameCell(r.name, r.category) },
  { head: "분류", cell: (r) => <span className="text-slate-700">{ITEM_CATEGORY_LABEL[r.category] || r.category}</span> },
  { head: "단위", cell: (r) => <span className="text-slate-700">{r.unit}</span> },
  { head: "유형", cell: (r) => <span className="text-slate-700">{returnableLabel(r)}</span> },
  { head: "설명", show: SHOW_4XL, cell: (r) => <span className="block max-w-[16rem] truncate text-slate-600">{r.description}</span> },
  { head: "등록일", show: SHOW_4XL, cell: (r) => <span className="text-slate-700">{formatDateTime(r.createdAt)}</span> },
];

// ADMIN 재고 관리 - 재고 현황(부서·품목별 수량, 입고·조정·사용 중지·재개)과 품목 관리(등록·제한적 수정), 각자 오른쪽 상세 패널.
export default function AdminStockTab({ setToast, header, refreshRef }) {
  const [tab, setTab] = useState("stock");
  const [modal, setModal] = useState(null); // { kind: STOCK_FORMS의 이름, target }
  const { stocks, items, departments, submit } = useAdminStock({ setToast });

  const isStock = tab === "stock";
  const list = isStock ? stocks : items;
  const filtered = Boolean(list.keyword || list.status || (isStock && (stocks.filters.departmentId || stocks.filters.category)));
  const options = { departmentId: departments.map((d) => [d.departmentId, d.name]), itemId: items.all.map((i) => [i.itemId, `${i.name} (${i.unit})`]) };
  const tabs = [["stock", "재고 현황"], ["items", "품목 관리"]];

  // 탭을 옮기거나 사이드바에서 이 메뉴를 다시 누르면 보이는 목록과 열린 상세를 다시 읽는다
  useEffect(() => {
    refreshRef.current = list.reload;
  });
  const changeTab = (next) => {
    setTab(next);
    (next === "stock" ? stocks : items).reload();
  };

  return (
    <>
      <div className="@container flex-1 min-w-0 space-y-4">
        {header}
        <ResourceSummaryCards
          summary={list.summary}
          cards={isStock ? STOCK_CARDS : ITEM_CARDS}
          scopeHint={isStock ? "등록된 부서·품목별 재고" : "등록된 전체 품목"}
          large
        />

        <div className="flex items-end gap-3 border-b border-slate-200">
          <div role="tablist" className="flex gap-1">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => changeTab(key)}
                className={`-mb-px border-b-2 px-5 py-2.5 text-sm font-extrabold cursor-pointer ${tab === key ? "border-[#0F2540] text-[#0F2540]" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setModal({ kind: isStock ? "stockCreate" : "itemCreate" })}
            className="ml-auto mb-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[#0F2540] px-3.5 py-2 text-[13px] font-bold text-white hover:bg-[#193A5B] cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {isStock ? "재고 등록" : "품목 등록"}
          </button>
        </div>

        <ResourceFilterBar
          data={list}
          filters={isStock ? STOCK_STATUS_FILTERS : ITEM_CATEGORY_FILTERS}
          searchFirst
          filterLabel={isStock ? "상태별 보기" : "분류별 보기"}
          placeholder={isStock ? "품목명, 부서명으로 검색하세요." : "품목명, 설명으로 검색하세요."}
        >
          {isStock && (
            <>
              <select value={stocks.filters.departmentId} onChange={(e) => stocks.changeFilter("departmentId", e.target.value)} aria-label="부서 선택" className={FILTER_CONTROL}>
                <option value="">전체 부서</option>
                {options.departmentId.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
              </select>
              <select value={stocks.filters.category} onChange={(e) => stocks.changeFilter("category", e.target.value)} aria-label="분류 선택" className={FILTER_CONTROL}>
                <option value="">전체 분류</option>
                {Object.entries(ITEM_CATEGORY_LABEL).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
              </select>
            </>
          )}
        </ResourceFilterBar>

        {list.error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{list.error}</div>}

        <AdminTable
          data={list}
          columns={isStock ? STOCK_COLUMNS : ITEM_COLUMNS}
          rowKey={(row) => (isStock ? row.stockId : row.itemId)}
          selectedKey={isStock ? stocks.selected?.stockId : items.item?.itemId}
          onSelect={list.open}
          emptyText={filtered ? "조건에 맞는 항목이 없습니다" : isStock ? "등록된 재고가 없습니다. 재고 등록으로 부서별 재고를 추가해주세요." : "등록된 품목이 없습니다. 품목 등록으로 추가해주세요."}
        />
      </div>

      {isStock && stocks.selected && (
        <AdminStockDetail stock={stocks.selected} history={stocks.history} onAction={(kind, target) => setModal({ kind, target })} onClose={stocks.close} />
      )}
      {!isStock && items.item && (
        <AdminItemDetail item={items.item} history={items.history} onEdit={(target) => setModal({ kind: "itemEdit", target })} onClose={items.close} />
      )}

      {modal && (
        <AdminFormModal
          kind={modal.kind}
          target={modal.target}
          options={options}
          onSubmit={(values) => submit(modal.kind, modal.target, values)}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
