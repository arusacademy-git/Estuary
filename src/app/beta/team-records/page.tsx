"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  fetchTeamRecords,
  type TeamRecord,
} from "@/data/team-records/team-records-api";
import { fetchProjectBudgetPositions } from "@/data/projects/project-budget-api";
import type { ProjectBudgetPosition } from "@/domain/projects/project-budget-types";
import { readBetaSession, type BetaAccount } from "@/lib/auth/beta-accounts";

import { TeamRecordsWorkspace } from "./team-records-workspace";

export default function TeamRecordsPage() {
  const searchParameters = useSearchParams();
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [records, setRecords] = useState<TeamRecord[]>([]);
  const [budgetPositions, setBudgetPositions] = useState<
    ProjectBudgetPosition[]
  >([]);
  const [budgetError, setBudgetError] = useState("");
  const [error, setError] = useState(() =>
    account ? "" : "Sign in to view Team Records.",
  );
  const [loading, setLoading] = useState(Boolean(account));

  useEffect(() => {
    if (!account) return;
    let active = true;
    const recordsRequest = fetchTeamRecords(account).then((nextRecords) => {
      if (active) setRecords(nextRecords);
    });
    const budgetsRequest = fetchProjectBudgetPositions(
      "beta-arus-org",
      account.id,
      new Date().getFullYear(),
    )
      .then((result) => {
        if (active) setBudgetPositions(result.positions);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setBudgetError(
          reason instanceof Error
            ? reason.message
            : "Project budget positions could not load.",
        );
      });
    Promise.allSettled([recordsRequest, budgetsRequest]).then((results) => {
      if (!active) return;
      const recordsResult = results[0];
      if (recordsResult.status === "rejected") {
        setError(
          recordsResult.reason instanceof Error
            ? recordsResult.reason.message
            : "Team Records could not load.",
        );
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [account]);

  if (error) return <TeamRecordsWorkspace error={error} records={[]} />;
  if (loading || !account) return <TeamRecordsWorkspace loading records={[]} />;
  const requestedGroup = searchParameters.get("group");
  const initialView =
    searchParameters.get("view") === "analysis" ? "ANALYSIS" : "RECORDS";
  const initialGroup = [
    "APPROVAL",
    "PAYMENT",
    "COMPLETED",
    "RECONCILED",
    "INACTIVE",
  ].includes(requestedGroup ?? "")
    ? (requestedGroup as
      | "APPROVAL"
      | "PAYMENT"
      | "COMPLETED"
      | "RECONCILED"
      | "INACTIVE")
    : "APPROVAL";
  return (
    <TeamRecordsWorkspace
      account={account}
      budgetError={budgetError}
      budgetPositions={budgetPositions}
      initialGroup={initialGroup}
      initialView={initialView}
      records={records}
    />
  );
}
