export type PaymentVoucherPdfInput = {
  voucherId: string;
  directorSignatureKey: string;
  recipientSignatureKey: string;
  paymentReference: string;
};

export async function generatePaymentVoucherBetaPdf(
  _input: PaymentVoucherPdfInput
): Promise<Uint8Array> {
  throw new Error('Implement with React-PDF or Puppeteer after the PV template is approved.');
}
