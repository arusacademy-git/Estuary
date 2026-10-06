import type {
  CreatePaymentVoucherInput,
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

type ApiEnvelope<T> = {
  data?: T;
  message?: string;
};

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    throw new Error(
      body?.message ?? `Payment Voucher request failed (${response.status}).`,
    );
  }

  if (!body || body.data === undefined) {
    throw new Error('The Payment Voucher API returned no data.');
  }

  return body;
}

export async function fetchPaymentVouchers() {
  const response = await fetch('/api/v1/payment-vouchers', {
    cache: 'no-store',
  });

  return (await readEnvelope<PaymentVoucherRecord[]>(response)).data ?? [];
}

export async function fetchPaymentVoucher(id: string) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data ?? null;
}

export async function createPaymentVoucher(
  input: CreatePaymentVoucherInput,
  submitForApproval = true,
) {
  const response = await fetch('/api/v1/payment-vouchers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...input,
      submitForApproval,
    }),
  });

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function resubmitPaymentVoucher(
  id: string,
  input: CreatePaymentVoucherInput,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/resubmit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function submitDraftPaymentVoucher(
  id: string,
  staffId: string,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/submit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ staffId }),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function approvePaymentVoucher(
  id: string,
  directorId: string,
  signatureKey: string,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/approve`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        directorId,
        signatureKey,
      }),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function rejectPaymentVoucher(
  id: string,
  directorId: string,
  remarks: string,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/reject`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        directorId,
        remarks,
      }),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function markPaymentVoucherManagerViewed(
  id: string,
  managerId: string,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/manager-preview`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        managerId,
      }),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function startPaymentVoucherFinanceProcessing(
  id: string,
  financeId: string,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/finance/start-processing`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ financeId }),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export type SaveFinancePaymentInformationInput = {
  financeId: string;
  paymentDate: string;
  paymentReference: string;
  paymentRemarks?: string;
  paymentProofFileName?: string;
};

export type IssuedRecipientLink = {
  voucher: PaymentVoucherRecord;
  token: string;
  expiresAt: string;
};

export async function savePaymentVoucherFinanceInformation(
  id: string,
  input: SaveFinancePaymentInformationInput,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/finance/payment-information`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function recordPaymentVoucherPdfGenerated(
  id: string,
  financeId: string,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/pdf`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ financeId }),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function issuePaymentVoucherRecipientLink(
  id: string,
  requesterId: string,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/recipient-link`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requesterId }),
    },
  );

  return (await readEnvelope<IssuedRecipientLink>(response)).data as IssuedRecipientLink;
}

export async function fetchPaymentVoucherByRecipientToken(token: string) {
  const response = await fetch(
    `/api/v1/recipient/payment-vouchers/${encodeURIComponent(token)}`,
    { cache: 'no-store' },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export type SubmitRecipientSignatureInput = {
  signatureFileName: string;
  signatureDataUrl: string;
  confirmedPaymentReceived: boolean;
};

export async function submitPaymentVoucherRecipientSignature(
  token: string,
  input: SubmitRecipientSignatureInput,
) {
  const response = await fetch(
    `/api/v1/recipient/payment-vouchers/${encodeURIComponent(token)}/signature`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export type SubmitManualSignedPaymentVoucherInput = {
  fileName: string;
  dataUrl: string;
  confirmedPaymentReceived: boolean;
};

export async function submitManualSignedPaymentVoucherByRecipient(
  token: string,
  input: SubmitManualSignedPaymentVoucherInput,
) {
  const response = await fetch(
    `/api/v1/recipient/payment-vouchers/${encodeURIComponent(token)}/manual-signature`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function uploadManualSignedPaymentVoucherByStaff(
  id: string,
  requesterId: string,
  input: SubmitManualSignedPaymentVoucherInput,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/staff-manual-signature`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requesterId, ...input }),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function confirmRecipientSignedPaymentVoucher(
  id: string,
  requesterId: string,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/staff-confirmation`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requesterId }),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function completePaymentVoucher(
  id: string,
  financeId: string,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/finance/complete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ financeId }),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function markPaymentVoucherInactive(
  id: string,
  financeId: string,
  remarks: string,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/finance/inactive`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ financeId, remarks }),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}

export async function returnPaymentVoucherForNewSignature(
  id: string,
  financeId: string,
  remarks: string,
) {
  const response = await fetch(
    `/api/v1/payment-vouchers/${encodeURIComponent(id)}/finance/return-signature`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ financeId, remarks }),
    },
  );

  return (await readEnvelope<PaymentVoucherRecord>(response)).data as PaymentVoucherRecord;
}
