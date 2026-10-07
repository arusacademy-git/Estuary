export type PaymentVoucherFileKind =
  | 'SUPPORTING_DOCUMENT'
  | 'DIRECTOR_SIGNATURE'
  | 'PAYMENT_RECEIPT'
  | 'RECIPIENT_SIGNATURE'
  | 'FINAL_PDF';

export interface PaymentVoucherStorage {
  upload(input: {
    organizationId: string;
    voucherId: string;
    kind: PaymentVoucherFileKind;
    fileName: string;
    contentType: string;
    body: Uint8Array;
  }): Promise<{ storageKey: string }>;
}

export class S3PaymentVoucherStorage implements PaymentVoucherStorage {
  async upload(input: {
    organizationId: string;
    voucherId: string;
    kind: PaymentVoucherFileKind;
    fileName: string;
    contentType: string;
    body: Uint8Array;
  }): Promise<{ storageKey: string }> {
    void input;
    throw new Error('Connect this service to the existing AWS S3 configuration.');
  }
}
