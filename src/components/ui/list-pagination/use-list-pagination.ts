'use client';

import { useEffect, useMemo, useState } from 'react';

const MAX_SUPPORTED_RECORDS = 1000;

export function useListPagination<T>(records: readonly T[], initialPageSize = 25) {
    const limitedRecords = useMemo(
        () => records.slice(0, MAX_SUPPORTED_RECORDS),
        [records],
    );
    const [page, setPageState] = useState(1);
    const [pageSize, setPageSizeState] = useState(initialPageSize);
    const pageCount = Math.max(1, Math.ceil(limitedRecords.length / pageSize));
    const currentPage = Math.min(page, pageCount);

    useEffect(() => {
        setPageState(1);
    }, [records]);

    const pageRecords = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return limitedRecords.slice(start, start + pageSize);
    }, [currentPage, limitedRecords, pageSize]);

    function setPage(nextPage: number) {
        setPageState(Math.min(Math.max(1, nextPage), pageCount));
    }

    function setPageSize(nextPageSize: number) {
        setPageSizeState(nextPageSize);
        setPageState(1);
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
