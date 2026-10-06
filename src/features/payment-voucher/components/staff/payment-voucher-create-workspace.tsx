'use client';

import {
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PaymentPageState } from '@/shared/payment-page-state';

import {
  fetchPaymentVoucher,
} from '@/data/payment-vouchers/payment-voucher-api';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import {
  PaymentVoucherCreateFlow,
} from './payment-voucher-create-flow';

import {
  BulkPaymentVoucherCreateFlow,
} from '@/features/payment-voucher/components/staff/bulk/bulk-payment-voucher-create-flow';

import styles from '@/features/payment-voucher/components/staff/bulk/bulk-payment-voucher.module.css';

type CreationMode =
  | 'single'
  | 'multiple'
  | null;

function SingleVoucherIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7.25 3.75h6.7l3.3 3.3v13.2h-10V3.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />

      <path
        d="M13.75 3.75v3.5h3.5M9.75 11h5M9.75 14h5M9.75 17h3.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MultipleVoucherIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
    >
      <rect
        height="13"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        width="10"
        x="8.25"
        y="5.25"
      />

      <path
        d="M5.75 8.25v10a1.5 1.5 0 0 0 1.5 1.5h7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 20 20"
    >
      <path
        d="M4.5 10h11M11.5 6l4 4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function PaymentVoucherCreateWorkspace() {
  const searchParams = useSearchParams();

  const amendmentVoucherId =
    searchParams.get('amend');

  const isAmendmentRequest =
    Boolean(amendmentVoucherId);

  const [
    initialVoucher,
    setInitialVoucher,
  ] =
    useState<PaymentVoucherRecord | null>(
      null,
    );

  const [
    isLoadingAmendment,
    setIsLoadingAmendment,
  ] = useState(isAmendmentRequest);

  const [
    amendmentError,
    setAmendmentError,
  ] = useState('');

  const [
    creationMode,
    setCreationMode,
  ] = useState<CreationMode>(
    isAmendmentRequest
      ? 'single'
      : null,
  );

  const [
    singleFlowStep,
    setSingleFlowStep,
  ] = useState<'form' | 'review'>('form');

  useEffect(() => {
    let cancelled = false;

    if (!amendmentVoucherId) {
      setInitialVoucher(null);
      setIsLoadingAmendment(false);
      setAmendmentError('');

      return;
    }

    setIsLoadingAmendment(true);
    setAmendmentError('');

    async function loadAmendment() {
      try {
        const voucher = await fetchPaymentVoucher(
          amendmentVoucherId!,
        );

        if (cancelled) return;

        if (!voucher) {
          setInitialVoucher(null);
          setAmendmentError(
            'The Payment Voucher could not be found.',
          );
          return;
        }

        if (voucher.status !== 'REJECTED') {
          setInitialVoucher(null);
          setAmendmentError(
            'Only a rejected Payment Voucher can be amended.',
          );
          return;
        }

        setInitialVoucher(voucher);
        setCreationMode('single');
      } catch (error) {
        if (cancelled) return;

        setInitialVoucher(null);
        setAmendmentError(
          error instanceof Error
            ? error.message
            : 'The Payment Voucher could not be loaded.',
        );
      } finally {
        if (!cancelled) {
          setIsLoadingAmendment(false);
        }
      }
    }

    void loadAmendment();

    return () => {
      cancelled = true;
    };
  }, [amendmentVoucherId]);

  if (
    isAmendmentRequest &&
    isLoadingAmendment
  ) {
    return <PaymentPageState title="Loading Payment Voucher" copy="Preparing the returned Payment Voucher for editing…" backHref="/beta/payment-records" backLabel="Back to Payment Records" />;
  }

  if (
    isAmendmentRequest &&
    amendmentError
  ) {
    return (
      <div className={styles.workspace}>
        <section
          className={styles.choicePanel}
        >
          <header
            className={
              styles.choiceHeader
            }
          >
            <p
              className={
                styles.choiceEyebrow
              }
            >
              Unable to amend voucher
            </p>

            <h1>
              Payment Voucher unavailable
            </h1>

            <p>{amendmentError}</p>
          </header>

          <Link
            className={
              styles.changeMethodButton
            }
            href="/beta/payment-vouchers"
          >
            Back to payment records
          </Link>
        </section>
      </div>
    );
  }

  const selectedModeLabel =
    isAmendmentRequest
      ? 'Amend payment voucher'
      : creationMode === 'single'
        ? 'Single Payment Voucher'
        : 'Multiple Payment Vouchers';

  return (
    <div className={styles.workspace}>
      {creationMode === null ? (
        <section
          className={styles.choicePanel}
        >
          <header
            className={
              styles.choiceHeader
            }
          >
            <p
              className={
                styles.choiceEyebrow
              }
            >
              Create Payment Voucher
            </p>

            <h1>
              How many vouchers are you
              creating?
            </h1>

            <p>
              Choose your preferred method
              to generate payment vouchers
              for processing.
            </p>
          </header>

          <div
            className={styles.choiceGrid}
          >
            <article
              className={styles.choiceCard}
            >
              <span
                className={
                  styles.choiceIcon
                }
              >
                <SingleVoucherIcon />
              </span>

              <h2>
                Single Payment Voucher
              </h2>

              <p>
                Create one voucher using
                the complete form. Best for
                one-off payments or
                detailed line-item entry.
              </p>

              <button
                className={
                  styles.choiceAction
                }
                type="button"
                onClick={() =>
                  setCreationMode(
                    'single',
                  )
                }
              >
                <span>
                  Select Single Payment Voucher
                </span>

                <ArrowIcon />
              </button>
            </article>

            <article
              className={styles.choiceCard}
            >
              <span
                className={
                  styles.choiceIcon
                }
              >
                <MultipleVoucherIcon />
              </span>

              <h2>
                Multiple Payment Vouchers
              </h2>

              <p>
                Prepare several vouchers
                together. Upload a CSV for
                bulk creation or enter rows
                in a spreadsheet-style
                grid.
              </p>

              <button
                className={
                  styles.choiceAction
                }
                type="button"
                onClick={() =>
                  setCreationMode(
                    'multiple',
                  )
                }
              >
                <span>
                  Select Multiple Payment Vouchers
                </span>

                <ArrowIcon />
              </button>
            </article>
          </div>
        </section>
      ) : creationMode === 'single' &&
        singleFlowStep === 'review' ? null : (
        <div
          className={`${styles.activeWorkspace} ${isAmendmentRequest
              ? styles.amendmentWorkspace
              : ''
            }`}
        >
          <div
            className={
              styles.workspaceToolbar
            }
          >
            <div
              className={
                styles.workspaceToolbarText
              }
            >
              <span>
                {isAmendmentRequest
                  ? 'Current action'
                  : 'Creation method'}
              </span>

              <strong>
                {selectedModeLabel}
              </strong>
            </div>

            {!isAmendmentRequest && (
              <button
                className={
                  styles.changeMethodButton
                }
                type="button"
                onClick={() =>
                  setCreationMode(null)
                }
              >
                Change creation method
              </button>
            )}

            {isAmendmentRequest && (
              <Link
                className={
                  styles.changeMethodButton
                }
                href={
                  initialVoucher
                    ? `/beta/payment-vouchers/${initialVoucher.id}`
                    : '/beta/payment-vouchers'
                }
              >
                Cancel amendment
              </Link>
            )}
          </div>
        </div>
      )}

      {/*
       * For amendment mode, wait until the
       * rejected voucher has been loaded.
       *
       * The key ensures the form is recreated
       * with the correct initial voucher.
       */}
      <div
        hidden={
          creationMode !== 'single'
        }
      >
        {(!isAmendmentRequest ||
          initialVoucher) && (
            <PaymentVoucherCreateFlow
              key={
                initialVoucher?.id ??
                'new-payment-voucher'
              }
              initialVoucher={
                initialVoucher ?? undefined
              }
              onStepChange={
                setSingleFlowStep
              }
            />
          )}
      </div>

      {/*
       * Bulk creation is unavailable during
       * amendment because an amendment updates
       * one existing rejected voucher.
       */}
      {!isAmendmentRequest && (
        <div
          hidden={
            creationMode !== 'multiple'
          }
        >
          <BulkPaymentVoucherCreateFlow />
        </div>
      )}
    </div>
  );
}
