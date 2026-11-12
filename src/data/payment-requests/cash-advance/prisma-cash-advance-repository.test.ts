import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db/prisma', () => ({
  prisma: { submission: { findFirst } },
}));

import { getCashAdvanceFromDatabase } from './prisma-cash-advance-repository';

const at = new Date('2026-11-12T03:00:00Z');
const transition = (action_code: string, actor_user_id: string, metadata_json: object = {}, to_state_code = '') => ({
  action_code,
  actor_user_id,
  metadata_json,
  to_state_code,
  created_at: at,
  reason_text: null,
});

describe('Cash Advance transition mapping', () => {
  beforeEach(() => {
    findFirst.mockReset();
    findFirst.mockResolvedValue({
      id: 'ca-test-id',
      submission_number: 'CA-TEST-01',
      current_state_code: 'PENDING_RECONCILIATION',
      total_amount: 300,
      created_at: at,
      updated_at: at,
      ca_detail: { paid_at: at, paid_reference: 'TEST-NO-TRANSFER' },
      transitions: [
        transition('CREATE', 'staff-test', { snapshot: { requesterId: 'staff-test' } }),
        transition('PREVIEW_BY_MANAGER', 'manager-test', {}, 'PENDING_DIRECTOR_APPROVAL'),
        transition('APPROVE_BY_DIRECTOR', 'director-test', { signatureKey: 'director-signature' }),
        transition('PAYMENT_PROCESSED', 'finance-test'),
        transition('UPLOAD_TRANSACTION_PROOF', 'finance-test', {
          transactionProof: { id: 'proof-test', fileName: 'TEST_ONLY_NO_TRANSFER.png', mimeType: 'image/png', size: 100, dataUrl: 'data:image/png;base64,AA==' },
        }),
      ],
      approval_steps: [],
      lines: [],
      evidence: [],
    });
  });

  it('reads legacy Manager approval and the actual Finance payment and proof events', async () => {
    const record = await getCashAdvanceFromDatabase('CA-TEST-01');
    expect(record?.managerApprovedAt).toBe(at.toISOString());
    expect(record?.financePaidById).toBe('finance-test');
    expect(record?.financeTransactionProof?.fileName).toBe('TEST_ONLY_NO_TRANSFER.png');
  });

  it('does not treat an informational Manager preview as approval', async () => {
    const stored = await findFirst();
    findFirst.mockResolvedValue({
      ...stored,
      transitions: stored.transitions.map((item: { action_code: string }) => item.action_code === 'PREVIEW_BY_MANAGER'
        ? { ...item, to_state_code: 'PENDING_MANAGER_APPROVAL' }
        : item),
    });
    const record = await getCashAdvanceFromDatabase('CA-TEST-01');
    expect(record?.managerPreviewedAt).toBe(at.toISOString());
    expect(record?.managerApprovedAt).toBeUndefined();
  });
});
