"use client";

import { useEffect, useRef, useState } from "react";

import {
  deleteManualFormDraft,
  fetchManualFormDraft,
  saveManualFormDraft,
} from "@/data/payment-requests/manual-drafts/api";
import type { ManualDraftType } from "@/domain/payment-requests/manual-drafts/types";

export function useManualFormDraft<T>({
  paymentType,
  requesterId,
  organizationId = "beta-arus-org",
  disabled = false,
  getSnapshot,
  restoreSnapshot,
}: {
  paymentType: ManualDraftType;
  requesterId?: string;
  organizationId?: string;
  disabled?: boolean;
  getSnapshot: () => T;
  restoreSnapshot: (snapshot: T) => void;
}) {
  const getSnapshotRef = useRef(getSnapshot);
  const restoreSnapshotRef = useRef(restoreSnapshot);
  getSnapshotRef.current = getSnapshot;
  restoreSnapshotRef.current = restoreSnapshot;
  const [draftId, setDraftId] = useState<string>();
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");

  useEffect(() => {
    if (!requesterId || disabled) return;
    const shouldRestore =
      new URLSearchParams(window.location.search).get("draft") === "1";
    if (!shouldRestore) return;
    let cancelled = false;
    fetchManualFormDraft<T>(paymentType, organizationId, requesterId)
      .then((draft) => {
        if (cancelled || !draft) return;
        setDraftId(draft.id);
        restoreSnapshotRef.current(draft.snapshot);
        setDraftMessage(
          `Draft restored from ${new Date(draft.updatedAt).toLocaleString("en-MY")}.`,
        );
      })
      .catch(() => {
        if (!cancelled)
          setDraftMessage("A previous draft could not be restored.");
      });
    return () => {
      cancelled = true;
    };
  }, [disabled, organizationId, paymentType, requesterId]);

  async function saveDraft() {
    if (!requesterId) throw new Error("Sign in before saving a draft.");
    setIsSavingDraft(true);
    setDraftMessage("");
    try {
      const draft = await saveManualFormDraft({
        organizationId,
        requesterId,
        paymentType,
        snapshot: getSnapshotRef.current(),
      });
      setDraftId(draft.id);
      setDraftMessage("Draft saved. You can safely continue it later.");
      window.dispatchEvent(new Event("estuary:action-counts-changed"));
      return draft;
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function clearDraft() {
    if (!draftId || !requesterId) return;
    try {
      await deleteManualFormDraft(draftId, organizationId, requesterId);
      setDraftId(undefined);
      setDraftMessage("");
      window.dispatchEvent(new Event("estuary:action-counts-changed"));
    } catch {
      // Submission has already succeeded. Draft cleanup must not make the
      // requester submit the same payment twice.
      setDraftMessage(
        "The request was submitted, but its saved draft could not be removed.",
      );
    }
  }

  return { draftMessage, isSavingDraft, saveDraft, clearDraft };
}
