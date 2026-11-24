"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
    fetchTeamRecords,
    type TeamRecord,
} from "@/data/team-records/team-records-api";
import { readBetaSession, type BetaAccount } from "@/lib/auth/beta-accounts";

import {
    WorkflowHealthWorkspace,
    type WorkflowStage,
} from "./workflow-health-workspace";

const stages: WorkflowStage[] = ["APPROVAL", "PAYMENT", "RECONCILIATION"];

export default function WorkflowHealthPage() {
    const searchParameters = useSearchParams();
    const [account] = useState<BetaAccount | null>(() => readBetaSession());
    const [records, setRecords] = useState<TeamRecord[]>([]);
    const [error, setError] = useState(() =>
        account ? "" : "Sign in to view Workflow health.",
    );
    const [loading, setLoading] = useState(Boolean(account));

    useEffect(() => {
        if (!account) return;
        let active = true;
        fetchTeamRecords(account)
            .then((nextRecords) => {
                if (active) setRecords(nextRecords);
            })
            .catch((reason: unknown) => {
                if (!active) return;
                setError(
                    reason instanceof Error
                        ? reason.message
                        : "Workflow health could not load.",
                );
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [account]);

    const requestedStage = searchParameters.get("stage") as WorkflowStage | null;
    const initialStage =
        requestedStage && stages.includes(requestedStage)
            ? requestedStage
            : "APPROVAL";

    return (
        <WorkflowHealthWorkspace
            account={account ?? undefined}
            error={error}
            initialStage={initialStage}
            loading={loading}
            records={records}
        />
    );
}
