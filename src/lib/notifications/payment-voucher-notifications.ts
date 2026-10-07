export type PaymentVoucherNotification = {
  to: string;
  subject: string;
  body: string;
  deepLink: string;
};

export interface PaymentVoucherNotificationService {
  queue(notification: PaymentVoucherNotification): Promise<void>;
}

export class SesPaymentVoucherNotificationService
  implements PaymentVoucherNotificationService
{
  async queue(notification: PaymentVoucherNotification): Promise<void> {
    void notification;
    throw new Error('Connect this service to the existing AWS SES configuration.');
  }
}
