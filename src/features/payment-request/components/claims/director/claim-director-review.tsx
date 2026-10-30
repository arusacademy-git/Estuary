"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchClaimRequest,
  forwardClaimByDirector,
  returnClaimByDirector,
} from "@/data/payment-requests/claims/api";
import { notifyClaimDirectorForwarded } from "@/features/payment-request/notifications/claim-notifications";
import type { ClaimRecord } from "@/domain/payment-requests/claims/types";
import { readBetaSession, type BetaAccount } from "@/lib/auth/beta-accounts";
import { ClaimReviewDetails, ClaimWorkflow } from "../claim-review-shared";
import styles from "../claim-workflow.module.css";

export function ClaimDirectorReview({ requestId }: { requestId: string }) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<ClaimRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setAccount(readBetaSession());
    fetchClaimRequest(requestId)
      .then(setRecord)
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "The Claim could not be loaded.",
        ),
      )
      .finally(() => setChecked(true));
  }, [requestId]);
  async function forward() {
    if (!account || !record) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await forwardClaimByDirector(record.id, account.id);
      notifyClaimDirectorForwarded(updated, account);
      setRecord(updated);
      setSuccess(
        "Claim approved. It has returned to Finance for payment processing.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The Claim could not be approved.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function reject() {
    if (!account || !record || remarks.trim().length < 3) return;
    setSaving(true);
    setError("");
    try {
      const updated = await returnClaimByDirector(
        record.id,
        account.id,
        remarks.trim(),
      );
      setRecord(updated);
      setSuccess("Claim rejected. The claimant can see the rejection reason.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The Claim could not be rejected.",
      );
    } finally {
      setSaving(false);
    }
  }
  if (!checked)
    return (
      <State title="Loading Claim" copy="Reading the Claim and receipts…" />
    );
  if (!account || account.role !== "director")
    return (
      <State
        title="Director access required"
        copy="This page is available only to Directors."
      />
    );
  if (!record)
    return (
      <State
        title="Claim not found"
        copy={error || "This Claim could not be found."}
      />
    );
  if (
    record.directorApproverId !== account.id &&
    record.requesterId !== account.id
  )
    return (
      <State
        title="Claim assigned to another Director"
        copy="You cannot preview this Claim."
      />
    );
  const actionable =
    record.status === "PENDING_DIRECTOR_APPROVAL" &&
    record.directorApproverId === account.id;
  return (
    <main className={styles.page}>
      <div className={styles.back}>
        <Link href="/beta/director/payment-requests/claims">
          ← Back to Claims
        </Link>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className={styles.success} role="status">
          {success}
        </div>
      )}
      <div className={styles.detailLayout}>
        <section className={styles.detailMain}>
          <ClaimReviewDetails
            contextLabel="Director final decision"
            record={record}
            userId={account.id}
          />
        </section>
        <aside className={styles.rail}>
          <section className={styles.actionCard}>
            <p>Director action</p>
            <h2>
              {actionable ? "Approve or reject Claim" : "Decision recorded"}
            </h2>
            {actionable ? (
              <>
                <span>
                  Finance has verified this Claim. Approve it for payment or
                  reject it with a reason.
                </span>
                <button
                  className={styles.primary}
                  disabled={saving}
                  onClick={forward}
                  type="button"
                >
                  Approve for payment →
                </button>
                <div className={styles.divider}>or reject with reason</div>
                <label>
                  <span>Rejection reason</span>
                  <textarea
                    rows={4}
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    placeholder="Explain why this Claim is rejected"
                  />
                </label>
                <button
                  className={styles.returnButton}
                  disabled={saving || remarks.trim().length < 3}
                  onClick={reject}
                  type="button"
                >
                  Reject Claim
                </button>
              </>
            ) : (
              <>
                <span>This Claim is currently {record.status}.</span>
                {record.returnRemarks && (
                  <p className={styles.remark}>
                    <strong>Reason of rejection:</strong> {record.returnRemarks}
                  </p>
                )}
              </>
            )}
          </section>
          <ClaimWorkflow record={record} />
        </aside>
      </div>
    </main>
  );
}
function State({ title, copy }: { title: string; copy: string }) {
  return (
    <main className={styles.state}>
      <h1>{title}</h1>
      <p>{copy}</p>
      <Link href="/beta/director/payment-requests/claims">
        Back to Director Claims
      </Link>
    </main>
  );
}
