'use client';

import type { ComponentProps } from 'react';

import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { PaymentVoucherRecordList } from '@/features/payment-voucher/components/payment-voucher-record-list';

type Props = ComponentProps<typeof PaymentVoucherRecordList>;

export function PaginatedPaymentVoucherRecordList({ vouchers, ...props }: Props) {
    const pagination = useListPagination(vouchers);

    return <>
        <PaymentVoucherRecordList {...props} vouchers={pagination.pageRecords} />
        <ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
    </>;
}