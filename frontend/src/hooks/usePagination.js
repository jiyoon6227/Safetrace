import { useState } from "react";

// 목록을 쪽 단위로 자르는 공용 훅. 목록이 줄어 현재 쪽이 범위를 넘으면 마지막 쪽으로 보여준다
export function usePagination(items, pageSize) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  return { page: safePage, setPage, totalPages, pageItems: items.slice((safePage - 1) * pageSize, safePage * pageSize) };
}
