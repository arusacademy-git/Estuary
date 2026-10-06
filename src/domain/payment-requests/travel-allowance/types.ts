export type TravelMealType = "BREAKFAST" | "LUNCH" | "DINNER";

export type TravelAllowanceStatus =
  | "PENDING_MANAGER_REVIEW"
  | "PENDING_DIRECTOR_APPROVAL"
  | "PENDING_FINANCE_VERIFICATION"
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
  financePaymentDate?: string;
  financePaymentReference?: string;
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