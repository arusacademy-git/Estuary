'use client';

import styles from './list-pagination.module.css';

type ListPaginationProps = {
    currentPage: number;
    firstRecord: number;
    lastRecord: number;
    pageCount: number;
    pageSize: number;
    totalRecords: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
};

function pagesToDisplay(currentPage: number, pageCount: number) {
    const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
    return [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b);
}

export function ListPagination({ currentPage, firstRecord, lastRecord, pageCount, pageSize, totalRecords, onPageChange, onPageSizeChange }: ListPaginationProps) {
    if (totalRecords === 0) return null;
    const pages = pagesToDisplay(currentPage, pageCount);

    return <nav aria-label="List pagination" className={styles.pagination}>
        <div className={styles.summary}>Showing <strong>{firstRecord}–{lastRecord}</strong> of <strong>{totalRecords}</strong></div>
        <label className={styles.pageSize}><span>Rows per page</span><select aria-label="Rows per page" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
        <div className={styles.controls}>
            <button aria-label="First page" disabled={currentPage === 1} type="button" onClick={() => onPageChange(1)}>«</button>
            <button aria-label="Previous page" disabled={currentPage === 1} type="button" onClick={() => onPageChange(currentPage - 1)}>‹</button>
            {pages.map((page, index) => <span className={styles.pageSlot} key={page}>{index > 0 && page - pages[index - 1] > 1 && <span aria-hidden="true" className={styles.ellipsis}>…</span>}<button aria-current={page === currentPage ? 'page' : undefined} data-active={page === currentPage} type="button" onClick={() => onPageChange(page)}>{page}</button></span>)}
            <button aria-label="Next page" disabled={currentPage === pageCount} type="button" onClick={() => onPageChange(currentPage + 1)}>›</button>
            <button aria-label="Last page" disabled={currentPage === pageCount} type="button" onClick={() => onPageChange(pageCount)}>»</button>
        </div>
    </nav>;
}