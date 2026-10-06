import { CashAdvanceStaffDetail } from '@/features/payment-request/components/cash-advance/staff/cash-advance-staff-detail';

export default async function CashAdvanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ id }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  const initialView =
    query.view === 'reconciliation'
      ? 'reconciliation'
      : 'view';

  return (
    <CashAdvanceStaffDetail
      id={decodeURIComponent(id)}
      initialView={initialView}
    />
  );
}