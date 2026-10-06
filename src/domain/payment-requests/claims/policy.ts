import type {
    ClaimLine,
    ClaimPolicyContext,
    ClaimRecord,
    ClaimType,
    CreateClaimInput,
} from './types';

export const INTERNET_COMMUTE_LIMIT = 70;
export const MEDICAL_ANNUAL_LIMIT = 500;
export const PD_LIMIT = 500;
export const TECH_STANDARD_LIMIT = 500;
export const TECH_EXTENDED_LIMIT = 1000;
export const TECH_EXTENDED_LOCK_YEARS = 3;

export function mileageRate(kilometers: number) {
    if (kilometers <= 0) return 0;
    return kilometers <= 500 ? 0.5 : 0.3;
}

export function claimLineAmount(type: ClaimType, line: ClaimLine) {
    if (type === 'MILEAGE') return Number(line.kilometers || 0) * mileageRate(Number(line.kilometers || 0));
    return Number(line.amount || 0);
}

export function claimTotal(type: ClaimType, lines: ClaimLine[]) {
    return lines.reduce((sum, line) => sum + claimLineAmount(type, line), 0);
}

export function claimLimit(input: Pick<CreateClaimInput, 'claimType' | 'techExtended'>, context: ClaimPolicyContext) {
    if (input.claimType === 'INTERNET_COMMUTE') return INTERNET_COMMUTE_LIMIT;
    if (input.claimType === 'MEDICAL') return Math.max(0, MEDICAL_ANNUAL_LIMIT - context.medicalUsedThisYear);
    if (input.claimType === 'PD') return PD_LIMIT;
    if (input.claimType === 'TECH') return input.techExtended ? TECH_EXTENDED_LIMIT : TECH_STANDARD_LIMIT;
    return null;
}

export function validateClaimInput(input: CreateClaimInput, context: ClaimPolicyContext) {
    if (!input.requesterContact.trim() || !input.claimDate) return 'Complete the claim date and contact information.';
    if (input.requesterRole !== 'director' && !input.managerApproverId?.trim()) {
        return input.requesterRole === 'finance'
            ? 'Choose the Finance Manager who will review this claim.'
            : 'Choose the Manager who will review this claim.';
    }
    if (input.requesterRole === 'finance' && input.managerApproverId === input.requesterId) {
        return 'A Finance claimant cannot review their own claim. Choose their Finance Manager.';
    }
    if (input.requesterRole !== 'director' && !input.directorApproverId?.trim()) return 'Choose the Director who will preview this claim.';
    if (!input.lines.length) return 'Add at least one claim item.';
    if (input.claimType === 'TECH' && context.techExtendedLockedUntil) {
        return `Tech claims are unavailable until ${formatDate(context.techExtendedLockedUntil)} because the RM1,000.00 option was previously used.`;
    }

    const incomplete = input.lines.some((line) => {
        if (!line.expenseDate || !line.details.trim()) return true;
        if (input.claimType === 'MILEAGE') {
            return !line.division.trim() || !line.from.trim() || !line.to.trim() || Number(line.kilometers) <= 0;
        }
        const hasReceipt = Boolean(line.receiptDocumentId || line.receiptLink?.trim() || (line.receiptFileName.trim() && Number(line.receiptFileSize) > 0));
        if (!line.supplier.trim() || !hasReceipt || Number(line.amount) <= 0) return true;
        if (input.claimType === 'EXPENSE') return !line.accountType.trim() || !line.division.trim();
        return false;
    });
    if (incomplete) return input.claimType === 'MILEAGE'
        ? 'Complete every trip, including its division, route and positive distance.'
        : 'Complete every claim item, provide its receipt link or upload, and enter a positive amount.';

    const total = claimTotal(input.claimType, input.lines);
    if (total <= 0) return 'The claim total must be greater than RM0.00.';
    const limit = claimLimit(input, context);
    if (limit !== null && total > limit) {
        if (input.claimType === 'MEDICAL') return `This claim exceeds the remaining annual medical balance of RM${limit.toFixed(2)}.`;
        return `This claim exceeds the RM${limit.toFixed(2)} ${input.claimType === 'TECH' && input.techExtended ? 'extended ' : ''}limit.`;
    }
    return '';
}

export function claimPolicyContext(records: ClaimRecord[], requesterId: string, claimDate: string): ClaimPolicyContext {
    const year = Number(claimDate.slice(0, 4));
    const medicalUsedThisYear = records
        .filter((record) => record.requesterId === requesterId && record.claimType === 'MEDICAL' && Number(record.claimDate.slice(0, 4)) === year)
        .reduce((sum, record) => sum + record.totalAmount, 0);

    const latestExtendedTech = records
        .filter((record) => record.requesterId === requesterId && record.claimType === 'TECH' && record.techExtended)
        .sort((a, b) => b.claimDate.localeCompare(a.claimDate))[0];
    let techExtendedLockedUntil: string | undefined;
    if (latestExtendedTech) {
        const lockDate = new Date(`${latestExtendedTech.claimDate}T12:00:00`);
        lockDate.setFullYear(lockDate.getFullYear() + TECH_EXTENDED_LOCK_YEARS);
        const candidate = lockDate.toISOString().slice(0, 10);
        if (candidate > claimDate) techExtendedLockedUntil = candidate;
    }
    return { medicalUsedThisYear, techExtendedLockedUntil };
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}
