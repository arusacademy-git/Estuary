'use client';

import { useMemo, useState } from 'react';

export type QueueSort = 'UPDATED_DESC' | 'UPDATED_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC';

type Options<T, S extends string> = {
    records: T[];
    initialStatus: S;
    getUpdatedAt: (record: T) => string;
    getAmount: (record: T) => number;
    getSearchText: (record: T) => Array<string | undefined | null>;
    matchesStatus: (record: T, status: S) => boolean;
};

export function useActionQueueFilter<T, S extends string>({
    records,
    initialStatus,
    getUpdatedAt,
    getAmount,
    getSearchText,
    matchesStatus,
}: Options<T, S>) {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<S>(initialStatus);
    const [month, setMonth] = useState('');
    const [exactDate, setExactDate] = useState('');
    const [sort, setSort] = useState<QueueSort>('UPDATED_DESC');

    const filteredRecords = useMemo(() => {
        const query = search.trim().toLowerCase();
        const matching = records.filter((record) => {
            if (!matchesStatus(record, status)) return false;
            const date = getUpdatedAt(record).slice(0, 10);
            if (month && !date.startsWith(month)) return false;
            if (exactDate && date !== exactDate) return false;
            if (!query) return true;
            return getSearchText(record).some((value) => value?.toLowerCase().includes(query));
        });

        return [...matching].sort((first, second) => {
            if (sort === 'AMOUNT_DESC') return getAmount(second) - getAmount(first);
            if (sort === 'AMOUNT_ASC') return getAmount(first) - getAmount(second);
            const difference = new Date(getUpdatedAt(first)).getTime() - new Date(getUpdatedAt(second)).getTime();
            return sort === 'UPDATED_ASC' ? difference : -difference;
        });
    }, [exactDate, getAmount, getSearchText, getUpdatedAt, matchesStatus, month, records, search, sort, status]);

    function changeMonth(value: string) {
        setMonth(value);
        if (exactDate && !exactDate.startsWith(value)) setExactDate('');
    }

    function clear() {
        setSearch('');
        setStatus(initialStatus);
        setMonth('');
        setExactDate('');
        setSort('UPDATED_DESC');
    }

    return { filteredRecords, search, setSearch, status, setStatus, month, changeMonth, exactDate, setExactDate, sort, setSort, clear };
}
