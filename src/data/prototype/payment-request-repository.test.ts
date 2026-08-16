import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  approveDirectorPaymentRequest,
  approveManagerPaymentRequest,
  completePaymentRequest,
  createPaymentRequest,
  getPaymentRequestById,
  processPaymentRequest,
  reconcileCashAdvance,
  resolveCashAdvanceChildren,
  submitPaymentRequest,
} from '@/data/prototype/payment-request-repository';

let runtimeDir: string | undefined;

afterEach(async () => {
  delete process.env.ESTUARY_PROTOTYPE_RUNTIME_ROOT;
  if (runtimeDir) {
    await rm(runtimeDir, { recursive: true, force: true });
    runtimeDir = undefined;
  }
});

async function useTempRuntime(): Promise<void> {
  runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'estuary-payment-requests-'));
  process.env.ESTUARY_PROTOTYPE_RUNTIME_ROOT = runtimeDir;
}

describe('payment request repository', () => {
  it('handles invoice payment flow through complete', async () => {
    await useTempRuntime();
    const created = await createPaymentRequest({
      actorId: 'usr-afiq',
      type: 'INVOICE_PAYMENT',
      title: 'Vendor invoice April',
      payeeName: 'Metro Transit Services',
      lineItems: [
        {
          description: 'Transport services',
          accountCode: '5100',
          quantity: 1,
          unitAmount: 450,
        },
      ],
    });

    const requestId = created.request?.id;
    expect(requestId).toBeDefined();

    const submitted = await submitPaymentRequest(requestId!, 'usr-afiq');
    expect(submitted.request?.status).toBe('PENDING_PAYMENT');

    const processed = await processPaymentRequest({
      requestId: requestId!,
      actorId: 'usr-sarah',
      paymentDate: '2026-04-16',
      paymentReference: 'MBB-443200',
      receiptLink: 'https://local.example/receipt/MBB-443200',
      note: 'Processed through Maybank.',
    });
    expect(processed.request?.status).toBe('PROCESSED');

    const completed = await completePaymentRequest(
      requestId!,
      'usr-sarah',
      'Invoice closed in finance queue.'
    );
    expect(completed.request?.status).toBe('COMPLETE');
  });

  it('supports cash advance reconciliation with parent-child closure', async () => {
    await useTempRuntime();

    const child = await createPaymentRequest({
      actorId: 'usr-afiq',
      type: 'EXPENSE_CLAIM',
      title: 'Receipts for travel advance',
      payeeName: 'Afiq Rahman',
      lineItems: [
        {
          description: 'Fuel claim',
          accountCode: '5100',
          quantity: 1,
          unitAmount: 110,
        },
      ],
    });

    const parent = await createPaymentRequest({
      actorId: 'usr-afiq',
      type: 'CASH_ADVANCE',
      title: 'Advance for school outreach trip',
      payeeName: 'Afiq Rahman',
      managerApproverId: 'usr-maryam',
      directorApproverId: 'usr-farid',
      lineItems: [
        {
          description: 'Travel advance',
          accountCode: '5100',
          quantity: 1,
          unitAmount: 1000,
        },
      ],
    });

    const parentId = parent.request?.id;
    const childId = child.request?.id;
    expect(parentId).toBeDefined();
    expect(childId).toBeDefined();

    const submitted = await submitPaymentRequest(parentId!, 'usr-afiq');
    expect(submitted.request?.status).toBe('PENDING_MANAGER_APPROVAL');

    const managerApproved = await approveManagerPaymentRequest(
      parentId!,
      'usr-maryam',
      'Manager approved.'
    );
    expect(managerApproved.request?.status).toBe('PENDING_DIRECTOR_APPROVAL');

    const directorApproved = await approveDirectorPaymentRequest(
      parentId!,
      'usr-farid',
      'Director approved.'
    );
    expect(directorApproved.request?.status).toBe('APPROVED_PENDING_PAYMENT');

    const processed = await processPaymentRequest({
      requestId: parentId!,
      actorId: 'usr-sarah',
      paymentDate: '2026-04-16',
      paymentReference: 'MBB-443201',
      receiptLink: 'https://local.example/receipt/MBB-443201',
      note: 'Cash transferred.',
    });
    expect(processed.request?.status).toBe('PROCESSED_PENDING_RECONCILIATION');

    const reconciled = await reconcileCashAdvance({
      requestId: parentId!,
      actorId: 'usr-afiq',
      note: 'Linked receipts are still open.',
      childRequestIds: [childId!],
      pendingChildRequestIds: [childId!],
    });
    expect(reconciled.request?.status).toBe('RECON_PENDING_CHILD_CLOSURE');
    expect(reconciled.request?.childRequestIds).toContain(childId);

    const parentAfterReconcile = await getPaymentRequestById(parentId!);
    const childAfterReconcile = await getPaymentRequestById(childId!);
    expect(parentAfterReconcile?.reconciliation?.pendingChildRequestIds).toEqual([
      childId,
    ]);
    expect(childAfterReconcile?.parentRequestId).toBe(parentId);

    const resolved = await resolveCashAdvanceChildren({
      requestId: parentId!,
      actorId: 'usr-sarah',
      resolvedChildRequestIds: [childId!],
      note: 'Child receipts settled.',
    });
    expect(resolved.request?.status).toBe('CLOSED');
    expect(resolved.request?.reconciliation?.pendingChildRequestIds).toEqual([]);
  });
});
