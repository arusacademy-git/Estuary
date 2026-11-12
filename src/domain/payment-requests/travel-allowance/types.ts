export type TravelMealType = "BREAKFAST" | "LUNCH" | "DINNER";

export type TravelAllowanceStatus =
  | "PENDING_MANAGER_REVIEW"
  | "PENDING_DIRECTOR_APPROVAL"
  | "PENDING_FINANCE_VERIFICATION"
  | "PAYMENT_PROCESSED"
  | "TRANSACTION_PROOF_UPLOADED"
  | "RETURNED_TO_STAFF"
  | "COMPLETED";

export const TRAVEL_ALLOWANCE_PROJECTS = [
  "N-AOC-UNDP",
  "N-MARCOMMS-ARUS",
  "O-BD-ARUS",
  "O-BMOFFICE-ARUS",
  "O-HR-ARUS",
  "O-KLOFFICE-ARUS",
  "O-L&D-ARUS",
  "O-MAKERSPACE-ARUS",
  "O-MANAGEMENT-ARUS",
  "O-WELFARE-ARUS",
  "P-BJCK-ARUS",
  "P-MAKERPROG-ARUS",
  "P-PWCDTT-UNICEF",
  "V-BAITBAIK-DAP",
  "V-BAITBAIK-SERI",
  "V-BESMART-CIMB",
  "V-FFL-FWDT",
  "V-FFLU-FWDI",
  "V-FS4A-GOOGLE",
  "V-FS4A-MISC",
  "V-FS4A-UNICEF",
  "V-IDENTIFAKE-USEMB",
  "V-KARISMA-YH",
  "V-MAKMUR-JICA",
  "V-ME4A-USEMB",
  "V-PJCC-MBPJ",
  "V-SEL-MISC",
  "V-STEAM-MISC",
  "V-VIA-TEF",
] as const;

export type PaymentRequestDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
};

export type TravelAllowanceLine = {
  id: string;
  employeeId: string;
  employeeName: string;
  travelDate: string;
  projectName: string;
  isOtherProject: boolean;
  reason: string;
  meals: TravelMealType[];
  specialAllowance: number;
  specialAllowanceReason?: string;
};

export type CreateTravelAllowanceInput = {
  organizationId: string;
  requestDate: string;
  requesterId: string;
  requesterName: string;
  requesterRole: "staff" | "manager";
  requesterPosition: string;
  contact: string;
  managerApproverId?: string;
  projectDirectorId: string;
  currency: "MYR";
  lines: TravelAllowanceLine[];
  supportingDocuments: PaymentRequestDocument[];
  supportingDocumentLinks?: string[];
  remarks?: string;
};

export type TravelAllowanceRecord = CreateTravelAllowanceInput & {
  id: string;
  requestNumber: string;
  requestType: "TRAVEL_ALLOWANCE";
  status: TravelAllowanceStatus;
  totalAmount: number;
  paymentDueDate: string;
  directorReviewedAt?: string;
  directorReviewedById?: string;
  directorReturnedAt?: string;
  directorReturnedById?: string;
  directorReturnRemarks?: string;
  financeVerifiedAt?: string;
  financeVerifiedById?: string;
  financeProofUploadedAt?: string;
  completedAt?: string;
  financePaymentDate?: string;
  financePaymentReference?: string;
  financeTransactionProof?: PaymentRequestDocument;
  financeRemarks?: string;
  financeReturnedAt?: string;
  financeReturnedById?: string;
  financeReturnRemarks?: string;
  managerReviewedAt?: string;
  managerReviewedById?: string;
  managerReturnedAt?: string;
  managerReturnedById?: string;
  managerReturnRemarks?: string;
  createdAt: string;
  updatedAt: string;
};

export const TRAVEL_MEAL_RATES: Record<TravelMealType, number> = {
  BREAKFAST: 10,
  LUNCH: 20,
  DINNER: 20,
};

export function travelLineMealSubtotal(line: TravelAllowanceLine) {
  return line.meals.reduce((total, meal) => total + TRAVEL_MEAL_RATES[meal], 0);
}

export function travelLineTotal(line: TravelAllowanceLine) {
  return travelLineMealSubtotal(line) + line.specialAllowance;
}

/**
 * Single source of truth for the Travel Allowance progress tracker.
 * Every screen (record detail, Manager, Director and Finance reviews) uses
 * this so a status can never fall through to the wrong step again.
 */
export type TravelAllowanceProgressStage =
  | "SUBMITTED"
  | "MANAGER_REVIEW"
  | "DIRECTOR_REVIEW"
  | "FINANCE_VERIFICATION"
  | "TRANSACTION_PROOF"
  | "COMPLETED";

type ProgressRecord = Pick<
  TravelAllowanceRecord,
  | "status"
  | "requesterRole"
  | "managerReturnedAt"
  | "directorReturnedAt"
  | "financeReturnedAt"
>;

export function travelAllowanceProgressStages(
  record: Pick<TravelAllowanceRecord, "requesterRole">,
): TravelAllowanceProgressStage[] {
  return record.requesterRole === "manager"
    ? [
        "SUBMITTED",
        "DIRECTOR_REVIEW",
        "FINANCE_VERIFICATION",
        "TRANSACTION_PROOF",
        "COMPLETED",
      ]
    : [
        "SUBMITTED",
        "MANAGER_REVIEW",
        "DIRECTOR_REVIEW",
        "FINANCE_VERIFICATION",
        "TRANSACTION_PROOF",
        "COMPLETED",
      ];
}

function latestReturnStage(
  record: ProgressRecord,
): TravelAllowanceProgressStage {
  const returns: Array<[TravelAllowanceProgressStage, string | undefined]> = [
    ["MANAGER_REVIEW", record.managerReturnedAt],
    ["DIRECTOR_REVIEW", record.directorReturnedAt],
    ["FINANCE_VERIFICATION", record.financeReturnedAt],
  ];
  const latest = returns
    .filter((entry): entry is [TravelAllowanceProgressStage, string] =>
      Boolean(entry[1]),
    )
    .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())[0];
  if (latest) return latest[0];
  return record.requesterRole === "manager" ? "DIRECTOR_REVIEW" : "MANAGER_REVIEW";
}

/** The stage the request is currently waiting on. */
export function travelAllowanceCurrentStage(
  record: ProgressRecord,
): TravelAllowanceProgressStage {
  switch (record.status) {
    case "PENDING_MANAGER_REVIEW":
      return "MANAGER_REVIEW";
    case "PENDING_DIRECTOR_APPROVAL":
      return "DIRECTOR_REVIEW";
    case "PENDING_FINANCE_VERIFICATION":
      return "FINANCE_VERIFICATION";
    // Finance has verified and recorded the payment; proof upload is next.
    case "PAYMENT_PROCESSED":
      return "TRANSACTION_PROOF";
    // Proof is uploaded; Finance only needs to confirm completion.
    case "TRANSACTION_PROOF_UPLOADED":
    case "COMPLETED":
      return "COMPLETED";
    case "RETURNED_TO_STAFF":
      return latestReturnStage(record);
    default:
      return "SUBMITTED";
  }
}

export type TravelAllowanceProgressState =
  | "complete"
  | "active"
  | "returned"
  | "pending";

export function travelAllowanceProgress(record: ProgressRecord) {
  const stages = travelAllowanceProgressStages(record);
  const current = travelAllowanceCurrentStage(record);
  const index = stages.indexOf(current);
  const active = index >= 0 ? index + 1 : 1;
  const isCompleted = record.status === "COMPLETED";

  function stateOf(stepNumber: number): TravelAllowanceProgressState {
    if (stepNumber < active || (isCompleted && stepNumber === stages.length)) {
      return "complete";
    }
    if (stepNumber === active) {
      return record.status === "RETURNED_TO_STAFF" ? "returned" : "active";
    }
    return "pending";
  }

  return { stages, active, total: stages.length, stateOf };
}

export function travelAllowanceStageTitle(
  stage: TravelAllowanceProgressStage,
  record: Pick<TravelAllowanceRecord, "requesterRole">,
) {
  switch (stage) {
    case "SUBMITTED":
      return record.requesterRole === "manager"
        ? "Manager Request Submitted"
        : "Request Submitted";
    case "MANAGER_REVIEW":
      return "Manager Review";
    case "DIRECTOR_REVIEW":
      return "Director Review";
    case "FINANCE_VERIFICATION":
      return "Finance Verification";
    case "TRANSACTION_PROOF":
      return "Payment transaction proof uploaded";
    case "COMPLETED":
      return "Completed";
  }
}
