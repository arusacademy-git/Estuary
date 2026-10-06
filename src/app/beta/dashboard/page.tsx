'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { fetchDashboardSummary } from '@/data/dashboard/api';
import type { DashboardSummaryPaymentType, DashboardSummaryRecord } from '@/domain/dashboard/types';
import { getPaymentVoucherStatusLabel } from '@/domain/payment-vouchers/status';
import type { PaymentVoucherRecord } from '@/domain/payment-vouchers/types';
import { readBetaSession, type BetaAccount, type BetaRole } from '@/lib/auth/beta-accounts';

import styles from './dashboard.module.css';

type DashboardType = DashboardSummaryPaymentType;
type Tone = 'blue' | 'amber' | 'green' | 'red' | 'gray';
type AnalyticsRange = 'LAST_6_MONTHS' | 'THIS_YEAR' | 'ALL_TIME';
type DashboardRecord = {
  id: string;
  reference: string;
  type: DashboardType;
  typeLabel: string;
  requesterId: string;
  requesterName: string;
  status: string;
  statusLabel: string;
  amount: number;
  updatedAt: string;
  href: string;
  managerViewed?: boolean;
  claimManagerPreviewed?: boolean;
  claimDirectorPreviewed?: boolean;
  currentAssigneeId?: string;
};
const typeOrder: DashboardType[] = ['PAYMENT_VOUCHER', 'INVOICE_PAYMENT', 'TRAVEL_ALLOWANCE', 'CASH_ADVANCE', 'PETTY_CASH', 'EXPENSE_CLAIM'];
const typeLabels: Record<DashboardType, string> = {
  PAYMENT_VOUCHER: 'Payment Vouchers',
  INVOICE_PAYMENT: 'Invoice Payments',
  TRAVEL_ALLOWANCE: 'Travel Allowances',
  CASH_ADVANCE: 'Cash Advances',
  PETTY_CASH: 'Petty Cash',
  EXPENSE_CLAIM: 'Claims',
};
const typeCodes: Record<DashboardType, string> = { PAYMENT_VOUCHER: 'PV', INVOICE_PAYMENT: 'INV', TRAVEL_ALLOWANCE: 'TA', CASH_ADVANCE: 'CA', PETTY_CASH: 'PC', EXPENSE_CLAIM: 'CL' };
const analyticsRangeLabels: Record<AnalyticsRange, string> = {
  LAST_6_MONTHS: 'Last 6 Months',
  THIS_YEAR: 'This Year',
  ALL_TIME: 'All Time',
};
const completedStatuses = new Set(['COMPLETED', 'COMPLETE', 'CLOSED', 'PAID']);
const returnedStatuses = new Set(['REJECTED', 'RETURNED_TO_STAFF', 'RETURNED_TO_CLAIMANT']);
const inactiveStatuses = new Set(['INACTIVE']);

const roleCopy: Record<BetaRole, { title: string; description: string }> = {
  staff: { title: 'My payment workspace', description: 'Create payments, follow every request type and respond to corrections from one place.' },
  manager: { title: 'Manager workspace', description: 'Preview Payment Vouchers and review assigned Payment Requests across every request type.' },
  director: { title: 'Director workspace', description: 'Review assigned approvals and monitor requests already forwarded to Finance.' },
  finance: { title: 'Finance workspace', description: 'Process approved payments, verify evidence and monitor completion across all payment types.' },
};

function titleCase(value: string) {
  return value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function money(value: number) {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function monthlyExpenditure(records: DashboardRecord[], range: AnalyticsRange) {
  const completed = records.filter((record) => completedStatuses.has(record.status) && !Number.isNaN(new Date(record.updatedAt).getTime()));
  const today = new Date();
  const currentMonth = monthStart(today);
  const earliestRecord = completed.reduce<Date | null>((earliest, record) => {
    const recordMonth = monthStart(new Date(record.updatedAt));
    return !earliest || recordMonth < earliest ? recordMonth : earliest;
  }, null);
  const start = range === 'LAST_6_MONTHS'
    ? addMonths(currentMonth, -5)
    : range === 'THIS_YEAR'
      ? new Date(today.getFullYear(), 0, 1)
      : earliestRecord ?? currentMonth;
  const months: Array<{
    key: string;
    label: string;
    values: Record<DashboardType, number>;
    total: number;
  }> = [];

  for (let cursor = start; cursor <= currentMonth; cursor = addMonths(cursor, 1)) {
    months.push({
      key: monthKey(cursor),
      label: cursor.toLocaleDateString('en-MY', {
        month: 'short',
        ...(range === 'ALL_TIME' ? { year: '2-digit' as const } : {}),
      }),
      values: Object.fromEntries(typeOrder.map((type) => [type, 0])) as Record<DashboardType, number>,
      total: 0,
    });
  }

  const byMonth = new Map(months.map((month) => [month.key, month]));
  completed.forEach((record) => {
    const month = byMonth.get(monthKey(new Date(record.updatedAt)));
    if (!month) return;
    month.values[record.type] += record.amount;
    month.total += record.amount;
  });
  return months;
}

function detailHref(type: DashboardType, id: string, account: BetaAccount, requesterId: string) {
  const encoded = encodeURIComponent(id);
  if (type === 'CASH_ADVANCE' && requesterId === account.id) return `/beta/payment-records/cash-advances/${encoded}`;
  if (type === 'PAYMENT_VOUCHER') return `/beta/payment-vouchers/${encoded}`;
  if (type === 'EXPENSE_CLAIM') return account.role === 'manager' ? `/beta/project-manager/payment-requests/claims/${encoded}` : account.role === 'director' ? `/beta/director/payment-requests/claims/${encoded}` : account.role === 'finance' ? `/beta/finance/payment-requests/claims/${encoded}` : '/beta/payment-records/claims';
  const segments: Record<Exclude<DashboardType, 'PAYMENT_VOUCHER' | 'EXPENSE_CLAIM'>, string> = {
    INVOICE_PAYMENT: 'invoice-payments', TRAVEL_ALLOWANCE: 'travel-allowances', CASH_ADVANCE: 'cash-advance', PETTY_CASH: 'petty-cash',
  };
  const segment = segments[type as keyof typeof segments];
  if (account.role === 'manager') return `/beta/project-manager/payment-requests/${segment}/${encoded}`;
  if (account.role === 'director' && type !== 'PETTY_CASH') return `/beta/director/payment-requests/${segment}/${encoded}`;
  if (account.role === 'finance') return `/beta/finance/payment-requests/${segment}/${encoded}`;
  const recordSegment = type === 'CASH_ADVANCE' ? 'cash-advances' : segment;
  return `/beta/payment-records/${recordSegment}/${encoded}`;
}

function typeHref(type: DashboardType, role: BetaRole) {
  if (type === 'PAYMENT_VOUCHER') return role === 'manager' ? '/beta/project-manager/payment-vouchers' : role === 'director' ? '/beta/approvals' : role === 'finance' ? '/beta/finance' : '/beta/payment-vouchers';
  if (type === 'EXPENSE_CLAIM') return role === 'manager' ? '/beta/project-manager/payment-requests/claims' : role === 'director' ? '/beta/director/payment-requests/claims' : role === 'finance' ? '/beta/finance/payment-requests/claims' : '/beta/payment-records/claims';
  const segment = type === 'INVOICE_PAYMENT' ? 'invoice-payments' : type === 'TRAVEL_ALLOWANCE' ? 'travel-allowances' : type === 'CASH_ADVANCE' ? 'cash-advance' : 'petty-cash';
  if (role === 'manager') return `/beta/project-manager/payment-requests/${segment}`;
  if (role === 'director') return type === 'PETTY_CASH' ? '/beta/payment-records/petty-cash' : `/beta/director/payment-requests/${segment}`;
  if (role === 'finance') return type === 'PETTY_CASH' ? '/beta/finance/payment-requests/petty-cash' : `/beta/finance/payment-requests/${segment}`;
  const staffRecords: Record<Exclude<DashboardType, 'PAYMENT_VOUCHER' | 'EXPENSE_CLAIM'>, string> = {
    INVOICE_PAYMENT: '/beta/payment-records/invoice-payments',
    TRAVEL_ALLOWANCE: '/beta/payment-records/travel-allowances',
    CASH_ADVANCE: '/beta/payment-records/cash-advances',
    PETTY_CASH: '/beta/payment-records/petty-cash',
  };
  return staffRecords[type as keyof typeof staffRecords];
}

function needsAction(record: DashboardRecord, role: BetaRole, userId: string) {
  if (record.type === 'CASH_ADVANCE' && record.requesterId === userId && ['RETURNED_TO_STAFF', 'PENDING_RECONCILIATION'].includes(record.status)) return true;
  if (record.type === 'EXPENSE_CLAIM' && record.status === 'DRAFT') return true;
  if (role === 'staff') return ['DRAFT', 'REJECTED', 'RETURNED_TO_STAFF', 'AWAITING_STAFF_CONFIRMATION', 'AWAITING_SIGNED_PV_UPLOAD', 'AWAITING_STAFF_VERIFICATION', 'PENDING_RECONCILIATION', 'PROCESSED_PENDING_RECONCILIATION'].includes(record.status);
  if (role === 'manager') return record.type === 'PAYMENT_VOUCHER'
    ? record.status === 'APPROVED_FOR_PAYMENT' && !record.managerViewed
    : record.type === 'EXPENSE_CLAIM'
      ? !record.claimManagerPreviewed && !['DRAFT', 'RETURNED_TO_CLAIMANT'].includes(record.status)
      : ['PENDING_MANAGER_APPROVAL', 'PENDING_MANAGER_REVIEW'].includes(record.status);
  if (role === 'director') return record.type === 'EXPENSE_CLAIM'
    ? !record.claimDirectorPreviewed && !['DRAFT', 'RETURNED_TO_CLAIMANT'].includes(record.status)
    : ['PENDING_DIRECTOR_APPROVAL', 'PENDING_DIRECTOR_REVIEW'].includes(record.status);
  if (record.status === 'PENDING_FINANCE_REVIEW') return record.currentAssigneeId === userId;
  return ['APPROVED_FOR_PAYMENT', 'FINANCE_PROCESSING', 'PENDING_FINANCE_VERIFICATION', 'PENDING_FINANCE_PAYMENT', 'PENDING_FINANCE_PROCESSING', 'PENDING_FINANCE_RECONCILIATION', 'FINANCE_VERIFIED', 'APPROVED_PENDING_PAYMENT', 'PENDING_PAYMENT', 'RECON_PENDING_CHILD_CLOSURE'].includes(record.status);
}

function tone(record: DashboardRecord, role: BetaRole, userId: string): Tone {
  if (completedStatuses.has(record.status)) return 'green';
  if (returnedStatuses.has(record.status) || inactiveStatuses.has(record.status)) return 'red';
  if (needsAction(record, role, userId)) return 'amber';
  return 'blue';
}

function normalizeSummary(account: BetaAccount, records: DashboardSummaryRecord[]): DashboardRecord[] {
  return records.map((record) => ({
    id: record.id,
    reference: record.reference,
    type: record.paymentType,
    typeLabel: typeLabels[record.paymentType],
    requesterId: record.requesterId,
    requesterName: record.requesterName,
    status: record.status,
    statusLabel: record.paymentType === 'PAYMENT_VOUCHER'
      ? getPaymentVoucherStatusLabel(record.status as PaymentVoucherRecord['status'])
      : titleCase(record.status),
    amount: record.amount,
    updatedAt: record.updatedAt,
    href: detailHref(record.paymentType, record.id, account, record.requesterId),
    managerViewed: record.managerViewed,
    claimManagerPreviewed: record.claimManagerPreviewed,
    claimDirectorPreviewed: record.claimDirectorPreviewed,
    currentAssigneeId: record.currentAssigneeId,
  }));
}

export default function BetaDashboardPage() {
  const router = useRouter();
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [records, setRecords] = useState<DashboardRecord[]>([]);
  const [analyticsRecords, setAnalyticsRecords] = useState<DashboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('LAST_6_MONTHS');

  useEffect(() => {
    const session = readBetaSession();
    if (!session) { router.replace('/beta'); return; }
    const signedInAccount = session;
    setAccount(signedInAccount);
    let active = true;
    const organizationAnalytics = signedInAccount.role === 'director' || signedInAccount.role === 'finance';
    Promise.all([
      fetchDashboardSummary({ role: signedInAccount.role, userId: signedInAccount.id }),
      organizationAnalytics
        ? fetchDashboardSummary({ role: signedInAccount.role, userId: signedInAccount.id, view: 'ORGANIZATION_COMPLETED' })
        : Promise.resolve([]),
    ])
      .then(([items, analyticsItems]) => {
        if (!active) return;
        setRecords(normalizeSummary(signedInAccount, items));
        setAnalyticsRecords(normalizeSummary(signedInAccount, analyticsItems));
      })
      .catch(() => {
        if (active) setWarnings(['Dashboard records could not be loaded.']);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [router]);

  const summary = useMemo(() => {
    const attention = records.filter((record) => account && needsAction(record, account.role, account.id)).length;
    const completed = records.filter((record) => completedStatuses.has(record.status)).length;
    const returned = records.filter((record) => returnedStatuses.has(record.status)).length;
    const inProgress = records.filter((record) => !completedStatuses.has(record.status) && !returnedStatuses.has(record.status) && !inactiveStatuses.has(record.status)).length;
    return { attention, completed, returned, inProgress };
  }, [account, records]);
  const recent = useMemo(() => [...records].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 8), [records]);
  const expenditureMonths = useMemo(() => monthlyExpenditure(analyticsRecords, analyticsRange), [analyticsRange, analyticsRecords]);
  const expenditureMaximum = Math.max(...expenditureMonths.map((month) => month.total), 0);
  const expenditureTotal = expenditureMonths.reduce((sum, month) => sum + month.total, 0);

  if (loading || !account) return <div className={styles.loading}>Loading your Estuary workspace…</div>;
  const copy = roleCopy[account.role];

  return <main className={styles.dashboard}>
    <section className={styles.hero}>
      <div><p>Dashboard · {account.position}</p><h1>{copy.title}</h1><span>{copy.description}</span></div>
    </section>

    {warnings.length > 0 && <div className={styles.warning} role="status">Showing available data. {warnings.join(' ')}</div>}

    <section className={styles.stats} aria-label="Dashboard statistics">
      <article><span>Visible records</span><strong>{records.length}</strong><small>Across all payment types</small></article>
      <article data-tone={summary.attention ? 'amber' : 'default'}><span>Need your action</span><strong>{summary.attention}</strong><small>Tasks assigned to your role</small></article>
      <article data-tone="blue"><span>In progress</span><strong>{summary.inProgress}</strong><small>Moving through the workflow</small></article>
      <article data-tone="green"><span>Completed</span><strong>{summary.completed}</strong><small>Paid or fully closed</small></article>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><p>Payment portfolio</p><h2>Records by payment type</h2><span>Counts and action items update from live request data.</span></div></div>
      <div className={styles.typeGrid}>{typeOrder.map((type) => {
        const items = records.filter((record) => record.type === type);
        const attention = items.filter((record) => needsAction(record, account.role, account.id)).length;
        const total = items.reduce((sum, record) => sum + record.amount, 0);
        return <Link className={styles.typeCard} href={typeHref(type, account.role)} key={type}>
          <div className={styles.typeCardTop}><i>{typeCodes[type]}</i><span className={styles.actionBadge} data-attention={attention > 0}>{attention > 0 ? `${attention} need${attention === 1 ? 's' : ''} your action` : 'No action required'}</span></div>
          <h3>{typeLabels[type]}</h3>
          <small>{items.length} record{items.length === 1 ? '' : 's'} tracked</small>
          <div className={styles.volume}><span>Total Requested</span><strong>{money(total)}</strong></div>
          <footer><b>View category →</b></footer>
        </Link>;
      })}</div>
    </section>

    {(account.role === 'director' || account.role === 'finance') && <section className={`${styles.section} ${styles.analyticsSection}`}>
      <div className={styles.analyticsHeading}>
        <div><p>Expenditure analytics</p><h2>Monthly completed expenditure</h2><span>Organization-wide paid and completed amounts, shared across all Director and Finance dashboards.</span></div>
        <div className={styles.rangeTabs} aria-label="Expenditure period" role="group">
          {(Object.keys(analyticsRangeLabels) as AnalyticsRange[]).map((range) => <button aria-pressed={analyticsRange === range} data-active={analyticsRange === range} key={range} onClick={() => setAnalyticsRange(range)} type="button">{analyticsRangeLabels[range]}</button>)}
        </div>
      </div>
      <div className={styles.analyticsLegend} aria-label="Payment type legend">
        {typeOrder.map((type) => <span key={type}><i data-type={type} />{typeLabels[type]} ({typeCodes[type]})</span>)}
      </div>
      {expenditureMaximum === 0 ? <div className={styles.analyticsEmpty}><h3>No completed expenditure yet</h3><p>Paid or completed records will appear in this chart.</p></div> : <>
        <div className={styles.chartViewport}>
          <div className={styles.chart} style={{ minWidth: `${Math.max(620, expenditureMonths.length * 86)}px` }}>
            {expenditureMonths.map((month) => <div className={styles.chartColumn} key={month.key}>
              <strong>{month.total > 0 ? money(month.total) : ''}</strong>
              <div className={styles.chartBar} aria-label={`${month.label}: ${money(month.total)}`}>
                {typeOrder.map((type) => month.values[type] > 0 && <span data-type={type} key={type} style={{ height: `${(month.values[type] / expenditureMaximum) * 100}%` }} title={`${typeLabels[type]}: ${money(month.values[type])}`} />)}
              </div>
              <small>{month.label}</small>
            </div>)}
          </div>
        </div>
        <div className={styles.analyticsFooter}><span><i />Completed expenditure in this period</span><strong>{money(expenditureTotal)}</strong></div>
      </>}
    </section>}

    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><p>Recent activity</p><h2>{account.role === 'staff' ? 'My latest payments and requests' : 'Latest records visible to your role'}</h2><span>Combined activity from every supported payment workflow.</span></div><Link href={account.role === 'staff' ? '/beta/payment-records?scope=mine' : '/beta/payment-records'}>View all records</Link></div>
      {recent.length === 0 ? <div className={styles.empty}><h3>No records yet</h3><p>New Payment Vouchers and Payment Requests will appear here.</p></div> : <div className={styles.tableWrap}><table><thead><tr><th>Reference</th><th>Type</th><th>Requester</th><th>Amount</th><th>Updated</th><th>Status</th><th /></tr></thead><tbody>{recent.map((record) => <tr key={`${record.type}-${record.id}`}><td><strong>{record.reference}</strong></td><td>{record.typeLabel}</td><td>{record.requesterName}</td><td><strong>{money(record.amount)}</strong></td><td>{date(record.updatedAt)}</td><td><span className={styles.status} data-tone={tone(record, account.role, account.id)}>{record.statusLabel}</span></td><td><Link href={record.href}>Open</Link></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
