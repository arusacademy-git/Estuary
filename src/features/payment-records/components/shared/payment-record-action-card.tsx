import Link from "next/link";

import type { BetaAccount } from "@/lib/auth/beta-accounts";

import styles from "./payment-record-action-card.module.css";

export type PaymentRecordType = "PV" | "PC" | "INV" | "TA" | "CA" | "CL";

type Props = {
  account: BetaAccount;
  status: string;
  paymentType: PaymentRecordType;
  requestId: string;
  reference: string;
  managerApproverId?: string;
  directorApproverId?: string;
};

const managerStatuses = new Set(["PENDING_MANAGER_REVIEW", "PENDING_MANAGER_APPROVAL"]);
const directorStatuses = new Set(["PENDING_DIRECTOR_REVIEW", "PENDING_DIRECTOR_APPROVAL"]);
const financeStatuses = new Set([
  "PENDING_FINANCE_REVIEW",
  "PENDING_FINANCE_VERIFICATION",
  "PENDING_FINANCE_PROCESSING",
  "FINANCE_PROCESSING",
  "PENDING_FINANCE_PAYMENT",
  "APPROVED_FOR_PAYMENT",
  "FINANCE_VERIFIED",
  "TRANSACTION_PROOF_UPLOADED",
  "PENDING_FINANCE_RECONCILIATION",
  "RECON_PENDING_CHILD_CLOSURE",
]);

export function PaymentRecordActionCard(props: Props) {
  const { account, status, paymentType, requestId, reference, managerApproverId, directorApproverId } = props;
  const owner = actionOwner({ account, status, managerApproverId, directorApproverId });
  if (!owner) return null;

  const content = {
    manager: { title: "Manager review required", copy: "Review this request and approve it or return it with correction remarks.", label: "Open Manager review", queue: "/beta/project-manager/pending-approvals" },
    director: { title: "Director action required", copy: "Review the full request and complete the assigned approval or preview action.", label: "Open Director review", queue: "/beta/director/pending-approvals" },
    finance: { title: "Finance action required", copy: "Complete the current Finance verification, payment or reconciliation action.", label: "Pending Processing", queue: "/beta/finance/pending-processing" },
  }[owner];
  const href = `${content.queue}?type=${paymentType}&request=${encodeURIComponent(requestId || reference)}`;

  return <aside className={styles.card}>
    <p className={styles.eyebrow}><i aria-hidden="true" /> Action required</p>
    <h2>{content.title}</h2>
    <p className={styles.copy}>{content.copy}</p>
    <Link className={styles.action} href={href}>{content.label} <span aria-hidden="true">→</span></Link>
  </aside>;
}

function actionOwner({ account, status, managerApproverId, directorApproverId }: Pick<Props, "account" | "status" | "managerApproverId" | "directorApproverId">) {
  if (account.role === "manager" && managerStatuses.has(status) && (!managerApproverId || managerApproverId === account.id)) return "manager" as const;
  if (account.role === "director" && directorStatuses.has(status) && (!directorApproverId || directorApproverId === account.id)) return "director" as const;
  if (account.role === "finance" && financeStatuses.has(status)) return "finance" as const;
  return null;
}
