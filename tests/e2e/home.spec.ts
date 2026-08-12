import { expect, test } from '@playwright/test';

test('renders the Estuary prototype shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Loading workflow data/i)).toHaveCount(0, {
    timeout: 20000,
  });

  const issueVoucherLink = page.getByRole('link', {
    name: /Issue payment voucher/i,
  });
  if (await issueVoucherLink.count()) {
    await issueVoucherLink.first().click();
  } else {
    await page.goto('/payment-vouchers/new?user=usr-afiq');
  }

  await page.waitForURL(/payment-(vouchers|requests)\/new/i, {
    timeout: 15000,
  });

  await expect(page.getByRole('button', { name: /Add line/i })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Download draft PDF|Download payment voucher PDF/i })
  ).toBeVisible();

  const lineRows = page.locator('tbody tr');
  await expect(lineRows).toHaveCount(1);

  await page.getByRole('button', { name: /Add line/i }).click();

  await expect(lineRows).toHaveCount(2);
});
