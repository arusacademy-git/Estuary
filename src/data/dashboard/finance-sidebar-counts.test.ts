import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentType } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { listPettyCashFromDatabase } from '@/data/payment-requests/petty-cash/prisma-repository';
import { listClaimsFromDatabase } from '@/data/payment-requests/claims/prisma-repository';
import { financeSidebarCounts } from './finance-sidebar-counts';

vi.mock('@/lib/db/prisma', () => ({ prisma: { submission: { count: vi.fn(), findMany: vi.fn() } } }));
vi.mock('@/data/payment-requests/petty-cash/prisma-repository', () => ({ listPettyCashFromDatabase: vi.fn() }));
vi.mock('@/data/payment-requests/claims/prisma-repository', () => ({ listClaimsFromDatabase: vi.fn() }));

describe('financeSidebarCounts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the existing Finance badge counts without loading full voucher, invoice, travel, or cash records', async () => {
    vi.mocked(prisma.submission.count).mockImplementation(async ({ where }) => {
      if (where?.payment_type === PaymentType.PAYMENT_VOUCHER) return 5;
      if (where?.payment_type === PaymentType.INVOICE_PAYMENT) return 1;
      if (where?.payment_type === PaymentType.TRAVEL_ALLOWANCE) return 4;
      throw new Error('Unexpected count query');
    });
    vi.mocked(prisma.submission.findMany).mockResolvedValue([
      { current_state_code: 'PENDING_FINANCE_PROCESSING' },
      { current_state_code: 'PENDING_MANAGER_APPROVAL' },
    ] as never);
    vi.mocked(listPettyCashFromDatabase).mockResolvedValue([
      { status: 'PENDING_FINANCE_REVIEW', financeReviewerId: 'siti-farhana' },
      { status: 'PENDING_FINANCE_REVIEW', financeReviewerId: 'another-user' },
      { status: 'PENDING_FINANCE_PAYMENT' },
    ] as never);
    vi.mocked(listClaimsFromDatabase).mockResolvedValue([
      { status: 'PENDING_FINANCE_VERIFICATION' },
      { status: 'PAYMENT_PROCESSED' },
      { status: 'COMPLETED' },
    ] as never);

    await expect(financeSidebarCounts('siti-farhana')).resolves.toEqual({
      PAYMENT_VOUCHER: 5,
      INVOICE_PAYMENT: 1,
      TRAVEL_ALLOWANCE: 4,
      CASH_ADVANCE: 1,
      PETTY_CASH: 2,
      EXPENSE_CLAIM: 2,
      ALL_PENDING: 15,
      MY_REQUESTS: 0,
    });
    expect(prisma.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { current_state_code: true },
      take: 1000,
    }));
  });
});
