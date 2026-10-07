'use client';

import { useMemo, useState } from 'react';

const MAX_SUPPORTED_RECORDS = 1000;

export function useListPagination<T>(records: readonly T[], initialPageSize = 25) {
    const limitedRecords = useMemo(
        () => records.slice(0, MAX_SUPPORTED_RECORDS),
        [records],
    );
    const [paginationState, setPaginationState] = useState({ records, page: 1 });
    const [pageSize, setPageSizeState] = useState(initialPageSize);
    const pageCount = Math.max(1, Math.ceil(limitedRecords.length / pageSize));
    const page = paginationState.records === records ? paginationState.page : 1;
    const currentPage = Math.min(page, pageCount);

    const pageRecords = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return limitedRecords.slice(start, start + pageSize);
    }, [currentPage, limitedRecords, pageSize]);

    function setPage(nextPage: number) {
        setPaginationState({
            records,
            page: Math.min(Math.max(1, nextPage), pageCount),
        });
    }

    function setPageSize(nextPageSize: number) {
        setPageSizeState(nextPageSize);
        setPaginationState({ records, page: 1 });
    }

    const firstRecord = limitedRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const lastRecord = Math.min(currentPage * pageSize, limitedRecords.length);

    return {
        currentPage,
        firstRecord,
        lastRecord,
        pageCount,
        pageRecords,
        pageSize,
        setPage,
        setPageSize,
        totalRecords: limitedRecords.length,
        wasLimited: records.length > MAX_SUPPORTED_RECORDS,
    };
}
